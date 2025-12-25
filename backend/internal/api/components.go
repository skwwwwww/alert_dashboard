package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/nolouch/alerts-platform-v2/internal/db"
	"github.com/nolouch/alerts-platform-v2/internal/models"
	"github.com/nolouch/alerts-platform-v2/internal/services"
	"gopkg.in/yaml.v3"
)

// ComponentResponse tailored for the sidebar
type ComponentResponse struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Category string `json:"category"`
	Status   string `json:"status"`
}

var (
	categoryMap       map[string]string
	orderedCategories []string
	categoryLock      sync.RWMutex
	lastLoaded        time.Time
)

type Config struct {
	Categories map[string][]string `yaml:"categories"`
}

func loadCategories() {
	// Reload if it's been more than 1 minute (simple dynamic reloading)
	if time.Since(lastLoaded) < 1*time.Minute && len(categoryMap) > 0 {
		return
	}

	categoryLock.Lock()
	defer categoryLock.Unlock()

	// Double check
	if time.Since(lastLoaded) < 1*time.Minute && len(categoryMap) > 0 {
		return
	}

	// Try to load from standard locations
	paths := []string{
		"../config/component_categories.yaml",
		"../../config/component_categories.yaml",
		"config/component_categories.yaml",
	}

	var data []byte
	for _, p := range paths {
		if d, e := os.ReadFile(p); e == nil {
			data = d
			break
		}
	}

	if data == nil {
		fmt.Println("Warning: Could not find component_categories.yaml")
		return
	}

	// Use yaml.Node to preserve order
	var node yaml.Node
	if err := yaml.Unmarshal(data, &node); err != nil {
		fmt.Printf("Error unmarshaling config: %v\n", err)
		return
	}

	newMap := make(map[string]string)
	var newOrder []string

	if len(node.Content) > 0 && node.Content[0].Kind == yaml.MappingNode {
		root := node.Content[0]
		for i := 0; i < len(root.Content); i += 2 {
			if root.Content[i].Value == "categories" {
				catNode := root.Content[i+1]
				for j := 0; j < len(catNode.Content); j += 2 {
					catName := catNode.Content[j].Value
					newOrder = append(newOrder, catName)

					// components list
					listNode := catNode.Content[j+1]
					for _, comp := range listNode.Content {
						newMap[comp.Value] = catName
					}
				}
				break
			}
		}
	}

	categoryMap = newMap
	orderedCategories = newOrder
	lastLoaded = time.Now()
	fmt.Printf("Loaded %d categories and %d components. Categories: %v\n", len(newOrder), len(newMap), newOrder)
}

func GetCategories(c *gin.Context) {
	loadCategories()
	categoryLock.RLock()
	defer categoryLock.RUnlock()
	c.JSON(http.StatusOK, orderedCategories)
}

func getCategory(name string) string {
	loadCategories()

	categoryLock.RLock()
	defer categoryLock.RUnlock()

	if name == "Serverless" {
		return "Serverless"
	}

	if cat, ok := categoryMap[name]; ok {
		return cat
	}
	return "Other"
}

// GetComponents fetches all distinct components found in the stats or issues
func GetComponents(c *gin.Context) {
	var componentNames []string

	// 1. Try querying distinct components from component_stats
	db.DB.Model(&models.ComponentStat{}).Distinct("component").Pluck("component", &componentNames)

	// 2. If empty, fallback to scanning issues table
	if len(componentNames) == 0 {
		var rawComponents []string
		db.DB.Model(&models.Issue{}).
			Where("is_alert = ?", true).
			Order("created DESC").
			Limit(5000).
			Pluck("components", &rawComponents)

		seen := make(map[string]bool)
		for _, rawJSON := range rawComponents {
			if rawJSON == "" || rawJSON == "[]" {
				continue
			}

			// Try JSON unmarshal
			var comps []string
			if err := json.Unmarshal([]byte(rawJSON), &comps); err == nil {
				for _, comp := range comps {
					if comp != "" && !seen[comp] {
						seen[comp] = true
						componentNames = append(componentNames, comp)
					}
				}
				continue
			}

			// Fallback cleanup
			cleaned := strings.ReplaceAll(rawJSON, "[", "")
			cleaned = strings.ReplaceAll(cleaned, "]", "")
			cleaned = strings.ReplaceAll(cleaned, "\"", "")
			cleaned = strings.ReplaceAll(cleaned, "'", "")
			parts := strings.Split(cleaned, ",")
			for _, part := range parts {
				part = strings.TrimSpace(part)
				if part != "" && !seen[part] {
					seen[part] = true
					componentNames = append(componentNames, part)
				}
			}
		}
	}

	// Always add "Serverless" as a specific component
	foundServerless := false
	for _, name := range componentNames {
		if name == "Serverless" {
			foundServerless = true
			break
		}
	}
	if !foundServerless {
		componentNames = append(componentNames, "Serverless")
	}

	// Build response with strict category filtering
	// Only show components that are explicitly defined in component_categories.yaml
	var response []ComponentResponse
	seen := make(map[string]bool)

	for _, name := range componentNames {
		if name == "" {
			continue
		}

		cat := getCategory(name)
		if cat == "Other" {
			// Skip components not defined in configuration (e.g., historical dirty data like "etcd")
			continue
		}

		// Add original component
		if !seen[name] {
			response = append(response, ComponentResponse{
				ID:       name,
				Name:     name,
				Category: cat,
				Status:   "Healthy",
			})
			seen[name] = true
		}
	}

	// Check if we need to add a single "old-rules" component for Resilience
	// This aggregates ALL issues with empty stability_governance AND (biz_type NOT LIKE '%nextgen%')
	var countEmpty int64
	db.DB.Model(&models.Issue{}).
		Where("is_alert = ? AND (stability_governance = '' OR stability_governance IS NULL) AND (biz_type NOT LIKE '%nextgen%')", true).
		Count(&countEmpty)

	if countEmpty > 0 {
		response = append(response, ComponentResponse{
			ID:       "old-rules",
			Name:     "old-rules",
			Category: "Resilience",
			Status:   "Healthy",
		})
	}

	c.JSON(http.StatusOK, response)
}

// MetricStat reused from dashboard (define locally or import if package loop allows, here we redefine simpler)
type ComponentMetricStat struct {
	Current  int64   `json:"current"`
	Previous int64   `json:"previous"`
	Change   float64 `json:"change"`
	Trend    string  `json:"trend"`
}

func calcCompChange(curr, prev int64) (float64, string) {
	if prev == 0 {
		if curr == 0 {
			return 0, "neutral"
		}
		return 100, "up"
	}
	change := float64(curr-prev) / float64(prev) * 100
	trend := "neutral"
	if change > 0 {
		trend = "up"
	} else if change < 0 {
		trend = "down"
	}
	return change, trend
}

func resolveNameInfo(componentName, id string) services.NameInfo {
	if getCategory(componentName) == "Serverless" {
		return services.NameInfo{ID: id, Name: id}
	}
	info, _ := services.GetNameResolver().Resolve(id)
	return info
}

// GetComponentStats returns aggregate stats
func GetComponentStats(c *gin.Context) {
	name := c.Param("name")
	daysStr := c.DefaultQuery("days", "30")
	envStr := c.DefaultQuery("env", "all")        // all, prod, non_prod
	categoryStr := c.DefaultQuery("category", "") // premium, dedicated, essential

	var days int
	fmt.Sscanf(daysStr, "%d", &days)
	if days <= 0 {
		days = 30
	}

	now := time.Now().UTC()

	// Current Period
	endDate := now.Format("2006-01-02 15:04:05")
	// Align start date to beginning of the day (00:00:00) to match daily trend aggregation
	startDateObj := now.AddDate(0, 0, -days)
	startDate := fmt.Sprintf("%s 00:00:00", startDateObj.Format("2006-01-02"))

	// Previous Period
	prevEndDate := startDate
	// Previous period also needs to measure full days
	prevStartDateObj := startDateObj.AddDate(0, 0, -days)
	prevStartDate := fmt.Sprintf("%s 00:00:00", prevStartDateObj.Format("2006-01-02"))

	// Environment filtering is handled via envCondition string (see below)

	// Build category condition based on biz_type field from raw alert data
	// Category mapping:
	// - Premium: biz_type contains "nextgen"
	// - Serverless: biz_type contains "devtier"
	// - Dedicated: all others
	categoryCondition := ""
	if categoryStr != "" {
		switch categoryStr {
		case "premium":
			// Premium = nextgen (biz_type contains "nextgen")
			categoryCondition = " AND (biz_type LIKE '%nextgen%')"
		case "essential":
			// Essential/Serverless = devtier (biz_type contains "devtier")
			categoryCondition = " AND (biz_type LIKE '%devtier%' OR biz_type LIKE '%TiDB Serverless%')"
		case "dedicated":
			// Dedicated = everything else (not nextgen and not devtier)
			categoryCondition = " AND (biz_type NOT LIKE '%nextgen%' AND biz_type NOT LIKE '%devtier%' AND biz_type NOT LIKE '%TiDB Serverless%')"
		}
	}

	// Determine the actual component name and stability governance filter
	targetName := name
	stabilityCondition := ""

	if name == "old-rules" {
		// Aggregation of all empty stability issues excluding premium (nextgen)
		stabilityCondition = " AND (stability_governance = '' OR stability_governance IS NULL) AND (biz_type NOT LIKE '%nextgen%')"
	} else {
		// Normal component logic
		cat := getCategory(name)
		// For non-Resilience and non-Serverless components, filter out issues that belong to "old-rules"
		if cat != "Resilience" && cat != "Serverless" {
			// Exclude (empty stability AND not premium)
			stabilityCondition = " AND NOT ((stability_governance = '' OR stability_governance IS NULL) AND (biz_type NOT LIKE '%nextgen%'))"
		}
	}

	componentFilter := "%\"" + targetName + "\"%"

	// Special handling for Serverless component
	if name == "Serverless" {
		// Serverless component aggregates all devtier issues
		// Override componentFilter to match everything (since we use biz_type to filter)
		componentFilter = "%"
		// Force category condition to devtier
		categoryCondition = " AND (biz_type LIKE '%devtier%' OR biz_type LIKE '%TiDB Serverless%')"
	}

	// Special handling for old-rules
	if name == "old-rules" {
		componentFilter = "%"
	}

	// Build environment condition
	// Check the title field for environment markers like [PROD] or [STAGING]
	// This is more reliable than biz_type field
	envCondition := ""
	if envStr == "prod" {
		// Match titles containing [PROD] prefix
		envCondition = " AND (title LIKE '%[PROD]%' OR title LIKE '%PROD%')"
	} else if envStr == "non_prod" {
		// Match titles containing [STAGING] or [STG] prefix
		envCondition = " AND (title LIKE '%[STAGING]%' OR title LIKE '%[STG]%' OR title LIKE '%STAGING%')"
	}

	// Build cluster filter to exclude test clusters
	clusterFilter := buildClusterFilterCondition()

	// 1. Total Alerts (Current & Previous)
	var currTotal int64
	db.DB.Model(&models.Issue{}).
		Where("is_alert = ? AND components LIKE ?"+envCondition+categoryCondition+stabilityCondition+clusterFilter+" AND REPLACE(created, ' UTC', '') BETWEEN ? AND ?",
			true, componentFilter, startDate, endDate).
		Count(&currTotal)

	var prevTotal int64
	db.DB.Model(&models.Issue{}).
		Where("is_alert = ? AND components LIKE ?"+envCondition+categoryCondition+stabilityCondition+clusterFilter+" AND REPLACE(created, ' UTC', '') BETWEEN ? AND ?",
			true, componentFilter, prevStartDate, prevEndDate).
		Count(&prevTotal)

	change, trend := calcCompChange(currTotal, prevTotal)

	// Helper for rates
	calcRate := func(numerator, denominator int64) float64 {
		if denominator == 0 {
			return 0
		}
		return float64(numerator) / float64(denominator) * 100
	}

	// 1.5 Rate Stats (Current)
	var currFake int64
	db.DB.Model(&models.Issue{}).
		Where("is_alert = ? AND components LIKE ?"+envCondition+categoryCondition+stabilityCondition+clusterFilter+" AND REPLACE(created, ' UTC', '') BETWEEN ? AND ? AND status = 'FAKE ALARM'",
			true, componentFilter, startDate, endDate).
		Count(&currFake)

	var currHandled int64
	db.DB.Model(&models.Issue{}).
		Where("is_alert = ? AND components LIKE ?"+envCondition+categoryCondition+stabilityCondition+clusterFilter+" AND REPLACE(created, ' UTC', '') BETWEEN ? AND ? AND status != 'Created'",
			true, componentFilter, startDate, endDate).
		Count(&currHandled)

	currFakeRate := calcRate(currFake, currTotal)
	currHandlingRate := calcRate(currHandled, currTotal)

	// 1.6 Rate Stats (Previous)
	var prevFake int64
	db.DB.Model(&models.Issue{}).
		Where("is_alert = ? AND components LIKE ?"+envCondition+categoryCondition+stabilityCondition+clusterFilter+" AND REPLACE(created, ' UTC', '') BETWEEN ? AND ? AND status = 'FAKE ALARM'",
			true, componentFilter, prevStartDate, prevEndDate).
		Count(&prevFake)

	var prevHandled int64
	db.DB.Model(&models.Issue{}).
		Where("is_alert = ? AND components LIKE ?"+envCondition+categoryCondition+stabilityCondition+clusterFilter+" AND REPLACE(created, ' UTC', '') BETWEEN ? AND ? AND status != 'Created'",
			true, componentFilter, prevStartDate, prevEndDate).
		Count(&prevHandled)

	prevFakeRate := calcRate(prevFake, prevTotal)
	prevHandlingRate := calcRate(prevHandled, prevTotal)

	// Calculate changes for rates (percentage point change)
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

	// 2. Daily Trend (Current)
	step := c.DefaultQuery("step", "day")
	dateSelect := ""
	if step == "week" {
		dateSelect = "strftime('%Y-%W', REPLACE(created, ' UTC', '')) as date"
	} else if step == "month" {
		dateSelect = "SUBSTR(REPLACE(created, ' UTC', ''), 1, 7) as date"
	} else {
		dateSelect = "SUBSTR(REPLACE(created, ' UTC', ''), 1, 10) as date"
	}

	trendData := []DailyTrend{}
	db.DB.Raw(`
		SELECT 
			`+dateSelect+`,
			COUNT(*) as total_alerts,
			SUM(CASE WHEN priority = 'Critical' THEN 1 ELSE 0 END) as critical_count,
			SUM(CASE WHEN priority = 'Major' THEN 1 ELSE 0 END) as major_count,
			SUM(CASE WHEN priority = 'Warning' THEN 1 ELSE 0 END) as warning_count
		FROM issues
		WHERE is_alert = 1 
			AND components LIKE ? `+envCondition+categoryCondition+stabilityCondition+clusterFilter+`
			AND SUBSTR(REPLACE(created, ' UTC', ''), 1, 10) BETWEEN ? AND ?
		GROUP BY date
		ORDER BY date ASC
	`, componentFilter, startDate[:10], endDate[:10]).Scan(&trendData)

	// 3. Recent Issues
	recentIssues := []models.Issue{}
	db.DB.Where("is_alert = ? AND components LIKE ? "+envCondition+categoryCondition+stabilityCondition+clusterFilter, true, componentFilter).
		Order("created DESC").
		Limit(10).
		Find(&recentIssues)

	// 4. Top Tenants (NEW)
	type TenantCount struct {
		TenantID   string  `json:"tenant_id"`
		TenantName string  `json:"tenant_name"`
		Current    int     `json:"current"`
		Previous   int     `json:"previous"`
		Change     float64 `json:"change"`
		Trend      string  `json:"trend"`
	}
	tenants := []TenantCount{}

	type TenantBasic struct {
		TenantID string
		Count    int
	}
	topTenants := []TenantBasic{}
	db.DB.Raw(`
		SELECT tenant_id, COUNT(*) as count
		FROM issues
		WHERE is_alert = 1 
			AND components LIKE ? `+envCondition+categoryCondition+stabilityCondition+clusterFilter+`
			AND REPLACE(created, ' UTC', '') BETWEEN ? AND ?
			AND tenant_id != '' AND tenant_id IS NOT NULL
		GROUP BY tenant_id
		ORDER BY count DESC
		LIMIT 10
	`, componentFilter, startDate, endDate).Scan(&topTenants)

	for _, t := range topTenants {
		var prevCount int64
		db.DB.Model(&models.Issue{}).
			Where("is_alert = 1 AND components LIKE ? "+envCondition+categoryCondition+stabilityCondition+clusterFilter+" AND tenant_id = ? AND REPLACE(created, ' UTC', '') BETWEEN ? AND ?",
				componentFilter, t.TenantID, prevStartDate, prevEndDate).
			Count(&prevCount)

		change, trend := calcCompChange(int64(t.Count), prevCount)
		// Resolve Name
		nameInfo := resolveNameInfo(targetName, t.TenantID)

		tenants = append(tenants, TenantCount{
			TenantID:   t.TenantID,
			TenantName: nameInfo.Name,
			Current:    t.Count,
			Previous:   int(prevCount),
			Change:     change,
			Trend:      trend,
		})
	}

	// 5. Top Clusters (NEW)
	type ClusterCount struct {
		ClusterID   string  `json:"cluster_id"`
		ClusterName string  `json:"cluster_name"`
		TenantName  string  `json:"tenant_name"`
		Current     int     `json:"current"`
		Previous    int     `json:"previous"`
		Change      float64 `json:"change"`
		Trend       string  `json:"trend"`
	}
	clusters := []ClusterCount{}

	type ClusterBasic struct {
		ClusterID string
		Count     int
	}
	topClusters := []ClusterBasic{}
	db.DB.Raw(`
		SELECT cluster_id, COUNT(*) as count
		FROM issues
		WHERE is_alert = 1 
			AND components LIKE ? `+envCondition+categoryCondition+stabilityCondition+clusterFilter+`
			AND REPLACE(created, ' UTC', '') BETWEEN ? AND ?
			AND cluster_id != '' AND cluster_id IS NOT NULL
		GROUP BY cluster_id
		ORDER BY count DESC
		LIMIT 10
	`, componentFilter, startDate, endDate).Scan(&topClusters)

	for _, c := range topClusters {
		var prevCount int64
		db.DB.Model(&models.Issue{}).
			Where("is_alert = 1 AND components LIKE ? "+envCondition+categoryCondition+stabilityCondition+clusterFilter+" AND cluster_id = ? AND REPLACE(created, ' UTC', '') BETWEEN ? AND ?",
				componentFilter, c.ClusterID, prevStartDate, prevEndDate).
			Count(&prevCount)

		change, trend := calcCompChange(int64(c.Count), prevCount)

		nameInfo := resolveNameInfo(targetName, c.ClusterID)

		clusters = append(clusters, ClusterCount{
			ClusterID:   c.ClusterID,
			ClusterName: nameInfo.Name,
			TenantName:  nameInfo.TenantName,
			Current:     c.Count,
			Previous:    int(prevCount),
			Change:      change,
			Trend:       trend,
		})
	}

	// 6. Top Alert Rules (NEW)
	type RuleCount struct {
		Signature string `json:"signature"`
		Count     int    `json:"count"`
	}
	topRules := []RuleCount{}
	db.DB.Raw(`
		SELECT alert_signature as signature, COUNT(*) as count
		FROM issues
		WHERE is_alert = 1 
			AND components LIKE ? `+envCondition+categoryCondition+stabilityCondition+clusterFilter+`
			AND REPLACE(created, ' UTC', '') BETWEEN ? AND ?
			AND alert_signature IS NOT NULL AND alert_signature != ''
		GROUP BY alert_signature
		ORDER BY count DESC
		LIMIT 10
	`, componentFilter, startDate, endDate).Scan(&topRules)

	// Enrich Recent Issues
	// Enrich Recent Issues
	type IssueWithNames struct {
		models.Issue
		ClusterName string `json:"cluster_name"`
	}
	recentIssuesEnriched := []IssueWithNames{}
	for _, issue := range recentIssues {
		clusterName := ""
		if issue.ClusterID != "" {
			ni := resolveNameInfo(targetName, issue.ClusterID)
			clusterName = ni.Name
		}
		recentIssuesEnriched = append(recentIssuesEnriched, IssueWithNames{
			Issue:       issue,
			ClusterName: clusterName,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"component":       name,
		"period":          fmt.Sprintf("Last %d Days", days),
		"env":             envStr,
		"total_alerts":    ComponentMetricStat{Current: currTotal, Previous: prevTotal, Change: change, Trend: trend},
		"fake_alarm_rate": ComponentMetricStat{Current: int64(currFakeRate * 100), Previous: int64(prevFakeRate * 100), Change: fakeChange, Trend: fakeTrend},
		"fake_alarm_rate_stat": gin.H{
			"current":  currFakeRate,
			"previous": prevFakeRate,
			"change":   fakeChange,
			"trend":    fakeTrend,
		},
		"handling_rate_stat": gin.H{
			"current":  currHandlingRate,
			"previous": prevHandlingRate,
			"change":   handlingChange,
			"trend":    handlingTrend,
		},
		"daily_trend":   trendData,
		"recent_issues": recentIssuesEnriched,
		"top_tenants":   tenants,
		"top_clusters":  clusters,
		"top_rules":     topRules,
	})
}

// GetComponentRules returns rules for a component, optionally filtered by category and rule_type
func GetComponentRules(c *gin.Context) {
	name := c.Param("name")
	category := c.Query("category")  // premium, dedicated, or essential
	ruleType := c.Query("rule_type") // prometheus, logging, or empty for all

	// Initialize service (in prod this should be injected or global)
	svc := services.NewRulesService()

	var rules []models.Rule
	var err error

	// If category is specified, use category-specific filtering
	if category != "" {
		if name == "Serverless" {
			name = "*"
		}
		rules, err = svc.GetRulesForComponentAndCategory(name, category)
	} else {
		// Otherwise use all paths
		rules, err = svc.GetRulesForComponent(name)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch rules"})
		return
	}

	// Filter by rule_type if specified
	if ruleType != "" {
		var filteredRules []models.Rule
		for _, rule := range rules {
			// Determine rule type based on file path
			isLogging := strings.Contains(rule.FilePath, "/logging/")
			if ruleType == "logging" && isLogging {
				filteredRules = append(filteredRules, rule)
			} else if ruleType == "prometheus" && !isLogging {
				filteredRules = append(filteredRules, rule)
			}
		}
		rules = filteredRules
	}

	// Add rule_type field to each rule for frontend
	type RuleWithType struct {
		models.Rule
		RuleType string `json:"rule_type"`
	}

	var response []RuleWithType
	for _, rule := range rules {
		ruleType := "prometheus"
		if strings.Contains(rule.FilePath, "/logging/") {
			ruleType = "logging"
		}
		response = append(response, RuleWithType{
			Rule:     rule,
			RuleType: ruleType,
		})
	}

	c.JSON(http.StatusOK, response)
}

type UpdateRuleRequest struct {
	FilePath      string      `json:"file_path"`
	OriginalAlert string      `json:"original_alert"`
	Rule          models.Rule `json:"rule"`
}

// UpdateComponentRule updates a specific rule
func UpdateComponentRule(c *gin.Context) {
	var req UpdateRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	if req.FilePath == "" || req.OriginalAlert == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file_path and original_alert are required"})
		return
	}

	svc := services.NewRulesService()
	if err := svc.UpdateRule(req.FilePath, req.OriginalAlert, req.Rule); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Failed to update rule: %v", err)})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}
