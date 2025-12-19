package api

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/nolouch/alerts-platform-v2/internal/db"
	"github.com/nolouch/alerts-platform-v2/internal/models"
	"github.com/nolouch/alerts-platform-v2/internal/services"
)

// DashboardDataResponse matches the frontend expectation
type DashboardDataResponse struct {
	TotalAlerts    MetricStat       `json:"totalAlerts"`
	ProdAlerts     MetricStat       `json:"prodAlerts"`
	NonProdAlerts  MetricStat       `json:"nonProdAlerts"`
	CriticalAlerts MetricStat       `json:"criticalAlerts"`
	FakeAlarmRate  MetricStat       `json:"fakeAlarmRate"`
	HandlingRate   MetricStat       `json:"handlingRate"`
	ByPriority     []PriorityCount  `json:"byPriority"`
	BySignature    []SignatureCount `json:"bySignature"`
	ByComponent    []ComponentCount `json:"byComponent"`
	ByTenant       []TenantCount    `json:"byTenant"`
	ByCluster      []ClusterCount   `json:"byCluster"` // NEW
	DailyTrend     []DailyTrend     `json:"dailyTrend"`
	DateRange      DateRange        `json:"dateRange"`
}

type TenantCount struct {
	TenantID   string  `json:"tenant_id"`
	TenantName string  `json:"tenant_name"` // NEW
	Current    int     `json:"current"`
	Previous   int     `json:"previous"`
	Change     float64 `json:"change"`
	Trend      string  `json:"trend"`
}

type ClusterCount struct {
	ClusterID   string  `json:"cluster_id"`
	ClusterName string  `json:"cluster_name"`
	TenantName  string  `json:"tenant_name"`
	Current     int     `json:"current"`
	Previous    int     `json:"previous"`
	Change      float64 `json:"change"`
	Trend       string  `json:"trend"`
}

type MetricStat struct {
	Current  float64 `json:"current"`
	Previous float64 `json:"previous"`
	Change   float64 `json:"change"`
	Trend    string  `json:"trend"`
}

type PriorityCount struct {
	Priority string `json:"priority"`
	Count    int    `json:"count"`
}

type SignatureCount struct {
	Signature  string `json:"signature"`
	TotalCount int    `json:"total_count"`
	LastSeen   string `json:"last_seen"`
}

type ComponentCount struct {
	Component string `json:"component"`
	Count     int    `json:"count"`
}

type DailyTrend struct {
	Date          string `json:"date"`
	TotalAlerts   int    `json:"total_alerts"`
	CriticalCount int    `json:"critical_count"`
	MajorCount    int    `json:"major_count"`
	WarningCount  int    `json:"warning_count"`
}

type DateRange struct {
	Start string `json:"start"`
	End   string `json:"end"`
	Days  int    `json:"days"`
}

func calculateChange(current, previous int) (float64, string) {
	if previous == 0 {
		if current == 0 {
			return 0, "neutral"
		}
		return 100, "up"
	}
	change := float64(current-previous) / float64(previous) * 100
	trend := "neutral"
	if change > 0 {
		trend = "up"
	} else if change < 0 {
		trend = "down"
	}
	return change, trend
}

// GetDashboardData aggregates data for the global dashboard
func GetDashboardData(c *gin.Context) {
	daysStr := c.DefaultQuery("days", "30")
	envStr := c.DefaultQuery("env", "all") // all, prod, non_prod

	// NEW: Filter parameters
	componentFilter := c.Query("component")
	tenantFilter := c.Query("tenant_id")
	signatureFilter := c.Query("signature")

	var days int
	fmt.Sscanf(daysStr, "%d", &days)
	if days <= 0 {
		days = 30
	}

	now := time.Now().UTC()

	// Current Period
	endDate := now.Format("2006-01-02 15:04:05")
	startDate := now.AddDate(0, 0, -days).Format("2006-01-02 15:04:05")

	// Previous Period
	prevEndDate := startDate
	prevStartDate := now.AddDate(0, 0, -days*2).Format("2006-01-02 15:04:05")

	// Base Condition for Environment
	envCondition := ""
	if envStr == "prod" {
		envCondition = " AND alert_signature LIKE '[PROD]%'"
	} else if envStr == "non_prod" {
		envCondition = " AND alert_signature NOT LIKE '[PROD]%'"
	}

	// Build additional filter conditions
	filterCondition := ""
	if componentFilter != "" {
		filterCondition += " AND components LIKE '%" + componentFilter + "%'"
	}
	if tenantFilter != "" {
		filterCondition += " AND tenant_id = '" + tenantFilter + "'"
	}
	if signatureFilter != "" {
		filterCondition += " AND alert_signature = '" + signatureFilter + "'"
	}
	if clusterFilter := c.Query("cluster_id"); clusterFilter != "" {
		filterCondition += " AND cluster_id = '" + clusterFilter + "'"
	}

	// Helper to fetch basic stats for a range
	fetchStats := func(start, end string) (total, prod, nonProd, critical int) {
		queryBase := `FROM issues WHERE is_alert = 1 ` + envCondition + filterCondition + ` AND REPLACE(created, ' UTC', '') BETWEEN ? AND ?`
		var result struct {
			Total    int
			Prod     int
			NonProd  int
			Critical int
		}
		db.DB.Raw(`
			SELECT
				COUNT(*) as total,
				SUM(CASE WHEN alert_signature LIKE '[PROD]%' THEN 1 ELSE 0 END) as prod,
				SUM(CASE WHEN alert_signature NOT LIKE '[PROD]%' THEN 1 ELSE 0 END) as non_prod,
				SUM(CASE WHEN priority = 'Critical' THEN 1 ELSE 0 END) as critical
		`+queryBase, start, end).Scan(&result)
		return result.Total, result.Prod, result.NonProd, result.Critical
	}

	currTotal, currProd, currNonProd, currCrit := fetchStats(startDate, endDate)
	prevTotal, prevProd, prevNonProd, prevCrit := fetchStats(prevStartDate, prevEndDate)

	// 1.5 Rate Stats (Current)
	var currFake int64
	db.DB.Model(&models.Issue{}).
		Where("is_alert = 1 "+envCondition+filterCondition+" AND REPLACE(created, ' UTC', '') BETWEEN ? AND ? AND status = 'FAKE ALARM'", startDate, endDate).
		Count(&currFake)

	var currHandled int64
	db.DB.Model(&models.Issue{}).
		Where("is_alert = 1 "+envCondition+filterCondition+" AND REPLACE(created, ' UTC', '') BETWEEN ? AND ? AND status != 'Created'", startDate, endDate).
		Count(&currHandled)

	// 1.6 Rate Stats (Previous)
	var prevFake int64
	db.DB.Model(&models.Issue{}).
		Where("is_alert = 1 "+envCondition+filterCondition+" AND REPLACE(created, ' UTC', '') BETWEEN ? AND ? AND status = 'FAKE ALARM'", prevStartDate, prevEndDate).
		Count(&prevFake)

	var prevHandled int64
	db.DB.Model(&models.Issue{}).
		Where("is_alert = 1 "+envCondition+filterCondition+" AND REPLACE(created, ' UTC', '') BETWEEN ? AND ? AND status != 'Created'", prevStartDate, prevEndDate).
		Count(&prevHandled)

	calcRate := func(num, den int64) float64 {
		if den == 0 {
			return 0
		}
		return float64(num) / float64(den) * 100
	}

	currFakeRate := calcRate(currFake, int64(currTotal))
	currHandlingRate := calcRate(currHandled, int64(currTotal))
	prevFakeRate := calcRate(prevFake, int64(prevTotal))
	prevHandlingRate := calcRate(prevHandled, int64(prevTotal))

	fakeChange := currFakeRate - prevFakeRate
	handlingChange := currHandlingRate - prevHandlingRate

	fakeTrend := "neutral"
	if fakeChange > 0 {
		fakeTrend = "up"
	} else if fakeChange < 0 {
		fakeTrend = "down"
	}

	handlingTrend := "neutral"
	if handlingChange > 0 {
		handlingTrend = "up"
	} else if handlingChange < 0 {
		handlingTrend = "down"
	}

	// 2. Top Tenants (NEW - with Names)
	var tenants []TenantCount

	// First get top N current tenants
	type TenantBasic struct {
		TenantID string
		Count    int
	}
	var topTenants []TenantBasic
	db.DB.Raw(`
		SELECT tenant_id, COUNT(*) as count
		FROM issues
		WHERE is_alert = 1 `+envCondition+filterCondition+` AND REPLACE(created, ' UTC', '') BETWEEN ? AND ?
		AND tenant_id != '' AND tenant_id IS NOT NULL
		GROUP BY tenant_id
		ORDER BY count DESC
		LIMIT 10
	`, startDate, endDate).Scan(&topTenants)

	// For each top tenant, get previous stats and resolve name
	for _, t := range topTenants {
		var prevCount int64
		db.DB.Model(&models.Issue{}).
			Where("is_alert = 1 "+envCondition+filterCondition+" AND tenant_id = ? AND REPLACE(created, ' UTC', '') BETWEEN ? AND ?", t.TenantID, prevStartDate, prevEndDate).
			Count(&prevCount)

		change, trend := calculateChange(t.Count, int(prevCount))

		// Resolve Name
		info, _ := services.GetNameResolver().Resolve(t.TenantID)

		tenants = append(tenants, TenantCount{
			TenantID:   t.TenantID,
			TenantName: info.Name,
			Current:    t.Count,
			Previous:   int(prevCount),
			Change:     change,
			Trend:      trend,
		})
	}

	// 2.5 Top Clusters (NEW)
	var clusters []ClusterCount

	type ClusterBasic struct {
		ClusterID string
		Count     int
	}
	var topClusters []ClusterBasic
	db.DB.Raw(`
		SELECT cluster_id, COUNT(*) as count
		FROM issues
		WHERE is_alert = 1 `+envCondition+filterCondition+` AND REPLACE(created, ' UTC', '') BETWEEN ? AND ?
		AND cluster_id != '' AND cluster_id IS NOT NULL
		GROUP BY cluster_id
		ORDER BY count DESC
		LIMIT 10
	`, startDate, endDate).Scan(&topClusters)

	for _, c := range topClusters {
		var prevCount int64
		db.DB.Model(&models.Issue{}).
			Where("is_alert = 1 "+envCondition+filterCondition+" AND cluster_id = ? AND REPLACE(created, ' UTC', '') BETWEEN ? AND ?", c.ClusterID, prevStartDate, prevEndDate).
			Count(&prevCount)

		change, trend := calculateChange(c.Count, int(prevCount))

		// Resolve Name
		info, _ := services.GetNameResolver().Resolve(c.ClusterID)

		clusters = append(clusters, ClusterCount{
			ClusterID:   c.ClusterID,
			ClusterName: info.Name,
			TenantName:  info.TenantName,
			Current:     c.Count,
			Previous:    int(prevCount),
			Change:      change,
			Trend:       trend,
		})
	}

	// 3. Top Signatures (Current)
	var signatures []SignatureCount
	db.DB.Raw(`
		SELECT 
			alert_signature as signature,
			COUNT(*) as total_count,
			MAX(created) as last_seen
		FROM issues
		WHERE is_alert = 1 `+envCondition+filterCondition+`
			AND alert_signature IS NOT NULL 
			AND REPLACE(created, ' UTC', '') BETWEEN ? AND ?
		GROUP BY alert_signature
		ORDER BY total_count DESC
		LIMIT 10
	`, startDate, endDate).Scan(&signatures)

	// 4. Top Components (Current)
	var components []ComponentCount
	db.DB.Raw(`
		SELECT 
			CASE 
				WHEN components IS NULL OR components = '[]' OR components = '' THEN 'No Component'
				ELSE json_extract(components, '$[0]')
			END as component,
			COUNT(*) as count
		FROM issues WHERE is_alert = 1 `+envCondition+filterCondition+` AND REPLACE(created, ' UTC', '') BETWEEN ? AND ?
		GROUP BY component
		ORDER BY count DESC
		LIMIT 10
	`, startDate, endDate).Scan(&components)

	step := c.DefaultQuery("step", "day") // day, week, month

	// 5. Trend (Current)
	var trend []DailyTrend

	// Determine time format for grouping
	dateSelect := ""
	if step == "week" {
		// Week requires strftime
		dateSelect = "strftime('%Y-%W', REPLACE(created, ' UTC', '')) as date"
	} else if step == "month" {
		dateSelect = "SUBSTR(REPLACE(created, ' UTC', ''), 1, 7) as date"
	} else {
		dateSelect = "SUBSTR(REPLACE(created, ' UTC', ''), 1, 10) as date"
	}

	db.DB.Raw(`
		SELECT 
			`+dateSelect+`,
			COUNT(*) as total_alerts,
			SUM(CASE WHEN priority = 'Critical' THEN 1 ELSE 0 END) as critical_count,
			SUM(CASE WHEN priority = 'Major' THEN 1 ELSE 0 END) as major_count,
			SUM(CASE WHEN priority = 'Warning' THEN 1 ELSE 0 END) as warning_count
		FROM issues
		WHERE is_alert = 1 `+envCondition+filterCondition+` AND SUBSTR(REPLACE(created, ' UTC', ''), 1, 10) BETWEEN ? AND ?
		GROUP BY date
		ORDER BY date ASC
	`, startDate[:10], endDate[:10]).Scan(&trend)

	// Priority Breakdown
	var priorityCounts []PriorityCount
	db.DB.Raw(`SELECT priority, COUNT(*) as count FROM issues WHERE is_alert=1 `+envCondition+filterCondition+` AND REPLACE(created, ' UTC', '') BETWEEN ? AND ? GROUP BY priority`, startDate, endDate).Scan(&priorityCounts)

	// Build MetricStats
	totalChange, totalTrend := calculateChange(currTotal, prevTotal)
	prodChange, prodTrend := calculateChange(currProd, prevProd)
	nonProdChange, nonProdTrend := calculateChange(currNonProd, prevNonProd)
	critChange, critTrend := calculateChange(currCrit, prevCrit)

	resp := DashboardDataResponse{
		TotalAlerts:    MetricStat{Current: float64(currTotal), Previous: float64(prevTotal), Change: totalChange, Trend: totalTrend},
		ProdAlerts:     MetricStat{Current: float64(currProd), Previous: float64(prevProd), Change: prodChange, Trend: prodTrend},
		NonProdAlerts:  MetricStat{Current: float64(currNonProd), Previous: float64(prevNonProd), Change: nonProdChange, Trend: nonProdTrend},
		CriticalAlerts: MetricStat{Current: float64(currCrit), Previous: float64(prevCrit), Change: critChange, Trend: critTrend},
		FakeAlarmRate:  MetricStat{Current: currFakeRate, Previous: prevFakeRate, Change: fakeChange, Trend: fakeTrend},
		HandlingRate:   MetricStat{Current: currHandlingRate, Previous: prevHandlingRate, Change: handlingChange, Trend: handlingTrend},
		ByPriority:     priorityCounts,
		BySignature:    signatures,
		ByComponent:    components,
		ByTenant:       tenants,
		ByCluster:      clusters,
		DailyTrend:     trend,
		DateRange: DateRange{
			Start: startDate,
			End:   endDate,
			Days:  days,
		},
	}

	c.JSON(http.StatusOK, resp)
}

// GetDashboardIssues returns a list of issues matching the dashboard filters
func GetDashboardIssues(c *gin.Context) {
	daysStr := c.DefaultQuery("days", "30")
	envStr := c.DefaultQuery("env", "all")
	componentFilter := c.Query("component")
	tenantFilter := c.Query("tenant_id")
	signatureFilter := c.Query("signature")
	metricType := c.Query("metric_type")
	category := c.Query("category")
	priorityFilter := c.Query("priority") // NEW: generic priority filter (e.g. "Critical,Major")

	// Pagination
	pageStr := c.DefaultQuery("page", "1")
	pageSizeStr := c.DefaultQuery("page_size", "50")

	var days int
	fmt.Sscanf(daysStr, "%d", &days)
	if days <= 0 {
		days = 30
	}

	var page, pageSize int
	fmt.Sscanf(pageStr, "%d", &page)
	if page < 1 {
		page = 1
	}
	fmt.Sscanf(pageSizeStr, "%d", &pageSize)
	if pageSize < 1 {
		pageSize = 50
	}
	offset := (page - 1) * pageSize

	now := time.Now().UTC()
	endDate := now.Format("2006-01-02 15:04:05")
	startDate := now.AddDate(0, 0, -days).Format("2006-01-02 15:04:05")

	envCondition := ""
	if envStr == "prod" {
		envCondition = " AND alert_signature LIKE '[PROD]%'"
	} else if envStr == "non_prod" {
		envCondition = " AND alert_signature NOT LIKE '[PROD]%'"
	}

	filterCondition := ""
	if componentFilter != "" {
		if componentFilter == "Serverless" {
			category = "essential"
		} else if componentFilter == "old-rules" {
			// Special handling for old-rules
			filterCondition += " AND (stability_governance = '' OR stability_governance IS NULL) AND (biz_type NOT LIKE '%nextgen%')"
		} else {
			// Normal component
			// We need to know the category to apply strict filtering (exclude old-rules)
			// Ideally we should import `api.getCategory` but it's private in same package.
			// Since we represent same package `api`, we can use `getCategory`.
			// However `getCategory` is in components.go.
			cat := getCategory(componentFilter)
			if cat != "Resilience" && cat != "Serverless" {
				filterCondition += " AND NOT ((stability_governance = '' OR stability_governance IS NULL) AND (biz_type NOT LIKE '%nextgen%'))"
			}
			filterCondition += " AND components LIKE '%" + componentFilter + "%'"
		}
	}
	if tenantFilter != "" {
		filterCondition += " AND tenant_id = '" + tenantFilter + "'"
	}
	if signatureFilter != "" {
		filterCondition += " AND alert_signature = '" + signatureFilter + "'"
	}
	if clusterFilter := c.Query("cluster_id"); clusterFilter != "" {
		filterCondition += " AND cluster_id = '" + clusterFilter + "'"
	}

	if category != "" {
		switch category {
		case "premium":
			filterCondition += " AND (biz_type LIKE '%nextgen%')"
		case "essential":
			filterCondition += " AND (biz_type LIKE '%devtier%')"
		case "dedicated":
			filterCondition += " AND (biz_type NOT LIKE '%nextgen%' AND biz_type NOT LIKE '%devtier%')"
		}
	}

	// Filter by metric type
	if metricType == "fake" {
		filterCondition += " AND status = 'FAKE ALARM'"
	} else if metricType == "handled" {
		filterCondition += " AND status != 'Created'"
	} else if metricType == "critical" {
		filterCondition += " AND priority = 'Critical'"
	} else if metricType == "prod" {
		filterCondition += " AND alert_signature LIKE '[PROD]%'"
	} else if metricType == "non_prod" {
		filterCondition += " AND alert_signature NOT LIKE '[PROD]%'"
	}

	// Generic Priority Filter
	if priorityFilter != "" {
		// Expects comma separated 'Critical,Major'
		priorities := strings.Split(priorityFilter, ",")
		quoted := make([]string, len(priorities))
		for i, p := range priorities {
			quoted[i] = "'" + strings.TrimSpace(p) + "'"
		}
		filterCondition += " AND priority IN (" + strings.Join(quoted, ",") + ")"
	}

	var issues []models.Issue
	db.DB.Model(&models.Issue{}).
		Select("issues.*").
		Joins("LEFT JOIN muted_issues ON muted_issues.issue_id = issues.id").
		Where("muted_issues.issue_id IS NULL").
		Where("is_alert = 1 "+envCondition+filterCondition+" AND REPLACE(issues.created, ' UTC', '') BETWEEN ? AND ?", startDate, endDate).
		Order("issues.created DESC").
		Limit(pageSize).
		Offset(offset).
		Find(&issues)

	c.JSON(http.StatusOK, issues)
}

// MuteIssue mutes an issue
func MuteIssue(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id required"})
		return
	}

	muted := models.MutedIssue{
		IssueID: id,
		Reason:  "User muted via dashboard",
	}

	if err := db.DB.Create(&muted).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to mute issue"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}
