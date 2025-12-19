package services

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"regexp"
	"strings"
	"time"
)

// DataUpdater handles data updates from JIRA
type DataUpdater struct {
	db         *sql.DB
	jiraClient *JiraClient
	logger     *log.Logger
}

// IssueData represents processed issue data ready for database insertion
type IssueData struct {
	ID             string
	Title          string
	Description    string
	Created        string
	Priority       string
	Labels         string // JSON array
	IssueType      string
	Components     string // JSON array
	Project        string
	IsAlert        bool
	AlertSignature string
	ClusterID      string
	TenantID       string
	BizType        string
	Status         string
	IsSubtask      bool

	// New fields
	StabilityGovernance string
	Visibility          string
	ComponentName       string
	SourceComponent     string
	AlertGroup          string
}

// NewDataUpdater creates a new data updater
func NewDataUpdater(db *sql.DB) (*DataUpdater, error) {
	jiraClient, err := NewJiraClient()
	if err != nil {
		return nil, fmt.Errorf("failed to create JIRA client: %w", err)
	}

	return &DataUpdater{
		db:         db,
		jiraClient: jiraClient,
		logger:     log.Default(),
	}, nil
}

// FetchInitialData fetches initial data for the last N days
func (u *DataUpdater) FetchInitialData(daysBack int) (int, error) {
	u.logger.Printf("[INFO] Starting initial data fetch for last %d days\n", daysBack)

	// Test connection first
	if err := u.jiraClient.TestConnection(); err != nil {
		return 0, fmt.Errorf("JIRA connection test failed: %w", err)
	}
	u.logger.Println("[SUCCESS] JIRA connection successful")

	endDate := time.Now().UTC()
	startDate := endDate.AddDate(0, 0, -daysBack)

	u.logger.Printf("[INFO] Fetching data from %s to %s\n", startDate.Format("2006-01-02"), endDate.Format("2006-01-02"))

	// Fetch all alerts from O11Y projects
	allIssues, err := u.fetchAllO11YAlerts(startDate, endDate)
	if err != nil {
		return 0, fmt.Errorf("failed to fetch alerts: %w", err)
	}

	u.logger.Printf("[INFO] Total fetched: %d issues\n", len(allIssues))

	// Process and store issues
	successCount := 0
	for i, issue := range allIssues {
		if u.processIssue(&issue) {
			successCount++
		}

		// Show progress every 50 issues
		if (i+1)%50 == 0 || (i+1) == len(allIssues) {
			progress := float64(i+1) / float64(len(allIssues)) * 100
			u.logger.Printf("[PROGRESS] Processed %d/%d issues (%.1f%%) - %d successful\n", i+1, len(allIssues), progress, successCount)
		}
	}

	u.logger.Printf("[SUCCESS] Initial data fetch completed: %d/%d successful\n", successCount, len(allIssues))
	return successCount, nil
}

// IncrementalUpdate performs incremental update - fetch only new data since last update
func (u *DataUpdater) IncrementalUpdate() (int, error) {
	u.logger.Println("[INFO] Starting incremental update")

	// Test connection first
	if err := u.jiraClient.TestConnection(); err != nil {
		return 0, fmt.Errorf("JIRA connection test failed: %w", err)
	}

	// Get latest issue date from database
	var latestDate sql.NullString
	err := u.db.QueryRow("SELECT MAX(created) FROM issues").Scan(&latestDate)
	if err != nil && err != sql.ErrNoRows {
		return 0, fmt.Errorf("failed to get latest issue date: %w", err)
	}

	var startDate time.Time
	if latestDate.Valid {
		// Parse the date and add 1 second to avoid duplicates
		t, err := time.Parse("2006-01-02 15:04:05", strings.TrimSuffix(latestDate.String, " UTC"))
		if err != nil {
			return 0, fmt.Errorf("failed to parse latest date: %w", err)
		}
		startDate = t.Add(1 * time.Second)
	} else {
		// If no data exists, fetch last 30 days
		startDate = time.Now().UTC().AddDate(0, 0, -30)
	}

	endDate := time.Now().UTC()

	u.logger.Printf("[INFO] Fetching new data from %s to %s\n", startDate.Format("2006-01-02 15:04:05"), endDate.Format("2006-01-02 15:04:05"))

	// Fetch all new alerts
	allIssues, err := u.fetchAllO11YAlerts(startDate, endDate)
	if err != nil {
		return 0, fmt.Errorf("failed to fetch alerts: %w", err)
	}

	u.logger.Printf("[INFO] Total fetched: %d new issues\n", len(allIssues))

	// Process and store issues
	successCount := 0
	for i, issue := range allIssues {
		if u.processIssue(&issue) {
			successCount++
		}

		// Show progress every 50 issues
		if (i+1)%50 == 0 || (i+1) == len(allIssues) {
			progress := float64(i+1) / float64(len(allIssues)) * 100
			u.logger.Printf("[PROGRESS] Processed %d/%d issues (%.1f%%) - %d successful\n", i+1, len(allIssues), progress, successCount)
		}
	}

	u.logger.Printf("[SUCCESS] Incremental update completed: %d/%d successful\n", successCount, len(allIssues))
	return successCount, nil
}

// fetchAllO11YAlerts fetches all alerts from O11Y-related projects
func (u *DataUpdater) fetchAllO11YAlerts(startDate, endDate time.Time) ([]JiraIssue, error) {
	projects := []struct {
		Key   string
		Label string
	}{
		{"O11YDEV", "O11YDEV"},
		{"O11YSTAG", "O11YSTAG"},
		{"O11Y", "O11Y"},
	}

	var allIssues []JiraIssue

	for _, proj := range projects {
		// Build JQL query with assignee and subtask filters to reduce data volume
		jql := fmt.Sprintf(
			"project = %s AND created >= '%s' AND created < '%s' AND assignee != EMPTY AND issuetype != Sub-task",
			proj.Key,
			startDate.Format("2006-01-02 15:04"),
			endDate.Format("2006-01-02 15:04"),
		)

		label := fmt.Sprintf("O11Y:%s", proj.Label)
		u.logger.Printf("\n[SEARCH] Searching %s for alerts...\n", proj.Key)
		u.logger.Printf("[JQL] %s\n", jql)

		issues, err := u.jiraClient.SearchAllIssues(jql, 100, label)
		if err != nil {
			u.logger.Printf(" [ERROR] Search failed for %s: %v\n", proj.Key, err)
			return nil, fmt.Errorf("failed to search %s: %w", proj.Key, err)
		}

		u.logger.Printf(" [RESULT] Fetched %d issues from %s\n", len(issues), proj.Key)
		allIssues = append(allIssues, issues...)
		u.logger.Printf("[CUMULATIVE] Total collected so far: %d issues\n", len(allIssues))
	}

	u.logger.Printf("\n[SUMMARY] Total issues fetched from all projects: %d\n", len(allIssues))
	return allIssues, nil
}

// processIssue processes and stores a single JIRA issue
func (u *DataUpdater) processIssue(issue *JiraIssue) bool {
	// Extract data
	issueData := u.extractIssueData(issue)

	// Insert or update in database
	return u.insertOrUpdateIssue(issueData)
}

// extractIssueData extracts and processes issue data
func (u *DataUpdater) extractIssueData(issue *JiraIssue) *IssueData {
	data := &IssueData{
		ID:          issue.Key,
		Title:       issue.Fields.Summary,
		Description: issue.Fields.Description,
		Created:     u.convertToUTC(issue.Fields.Created),
		IssueType:   "",
		Project:     issue.Fields.Project.Key,
		IsAlert:     false,
		IsSubtask:   false,
	}

	// Priority
	if issue.Fields.Priority != nil {
		data.Priority = u.convertPriority(issue.Fields.Priority.Name)
	}

	// Issue type
	if issue.Fields.IssueType != nil {
		data.IssueType = issue.Fields.IssueType.Name
		data.IsSubtask = issue.Fields.IssueType.Subtask || issue.Fields.Parent != nil
	}

	// Status
	if issue.Fields.Status != nil {
		data.Status = issue.Fields.Status.Name
	}

	// Labels
	if len(issue.Fields.Labels) > 0 {
		labelsJSON, _ := json.Marshal(issue.Fields.Labels)
		data.Labels = string(labelsJSON)
	} else {
		data.Labels = "[]"
	}

	// Components
	var components []string
	for _, comp := range issue.Fields.Component {
		components = append(components, comp.Name)
	}
	if len(components) > 0 {
		componentsJSON, _ := json.Marshal(components)
		data.Components = string(componentsJSON)
	} else {
		data.Components = "[]"
	}

	// Determine if this is an alert
	data.IsAlert = u.isAlert(data.Description, data.Title)
	if data.IsAlert {
		data.AlertSignature = data.Title
	}

	// Extract cluster_id, tenant_id, biz_type
	// IMPORTANT: Try from raw alert data first (customfield_10160)
	if issue.Fields.RawAlertData != nil {
		data.ClusterID, data.TenantID, data.BizType, data.Labels, data.StabilityGovernance, data.Visibility, data.ComponentName, data.SourceComponent, data.AlertGroup = u.extractFromRawAlertData(issue.Fields.RawAlertData, issue.Fields.Labels)
	}

	// Fallback to description if not found in raw alert data
	if data.ClusterID == "" || data.TenantID == "" || data.BizType == "" {
		clusterID, tenantID := u.extractIDsFromDescription(data.Description)
		if data.ClusterID == "" {
			data.ClusterID = clusterID
		}
		if data.TenantID == "" {
			data.TenantID = tenantID
		}
		if data.BizType == "" {
			data.BizType = u.extractBizTypeFromDescription(data.Description)
		}
	}

	// NEW: Try to resolve tenant_id from cluster_id if still missing
	if data.TenantID == "" && data.ClusterID != "" {
		if info, err := GetNameResolver().Resolve(data.ClusterID); err == nil && info.TenantID != "" {
			data.TenantID = info.TenantID
		}
	}

	return data
}

// convertPriority converts priority names (including Chinese)
func (u *DataUpdater) convertPriority(priority string) string {
	mapping := map[string]string{
		"严重":       "Critical",
		"重要":       "Major",
		"低":        "Low",
		"Medium":   "Medium",
		"High":     "Major",
		"Critical": "Critical",
		"Major":    "Major",
	}

	if mapped, ok := mapping[priority]; ok {
		return mapped
	}
	return priority
}

// convertToUTC converts JIRA timestamp to UTC format
func (u *DataUpdater) convertToUTC(jiraTime string) string {
	// JIRA time format: 2024-01-15T10:30:45.000+0800
	t, err := time.Parse("2006-01-02T15:04:05.000-0700", jiraTime)
	if err != nil {
		// Try alternative format
		t, err = time.Parse(time.RFC3339, jiraTime)
		if err != nil {
			u.logger.Printf("[WARN] Failed to parse time %s: %v\n", jiraTime, err)
			return jiraTime
		}
	}

	utc := t.UTC()
	return utc.Format("2006-01-02 15:04:05") + " UTC"
}

// isAlert determines if an issue is an alert
func (u *DataUpdater) isAlert(description, title string) bool {
	description = strings.ToLower(description)
	title = strings.ToLower(title)

	// Check for alert keywords
	return strings.Contains(description, "alert") ||
		strings.Contains(title, "alert") ||
		strings.Contains(description, "firing") ||
		strings.Contains(description, "prometheus")
}

// extractFromRawAlertData extracts cluster_id, tenant_id, biz_type and other labels from raw alert data
// Returns: clusterID, tenantID, bizType, dbLabels (JSON), stabilityGovernance, visibility, componentName, sourceComponent, alertGroup
func (u *DataUpdater) extractFromRawAlertData(rawData interface{}, existingLabels []string) (string, string, string, string, string, string, string, string, string) {
	var jsonData []byte
	var err error

	// Handle different types of rawData
	switch v := rawData.(type) {
	case string:
		// If it's already a JSON string, use it directly as bytes
		jsonData = []byte(v)
	default:
		// Otherwise marshal it (it might be a map from go-jira)
		jsonData, err = json.Marshal(rawData)
		if err != nil {
			return "", "", "", u.toJSON(existingLabels), "", "", "", "", ""
		}
	}

	var data map[string]interface{}
	// Use Unmarshal to handle both cases efficiently
	// If jsonData was a string literal of a JSON object (e.g. "{\"foo\":\"bar\"}"), Unmarshal might fail if we unmarshal into map directly?
	// Not quite.
	// If rawData is string "{\"labels\":...}", then jsonData is []byte(`{"labels":...}`). Unmarshal works.
	// If rawData is map, jsonData is []byte(`{"labels":...}`). Unmarshal works.
	// BUT, if rawData was string, json.Marshal(rawData) would have produced "\"{\\\"labels\\\":...}\"".
	// That's why the type switch above is critical.

	if err := json.Unmarshal(jsonData, &data); err != nil {
		// Log error for debugging
		// u.logger.Printf("[WARN] Failed to unmarshal raw alert data: %v (data: %s)\n", err, string(jsonData))
		return "", "", "", u.toJSON(existingLabels), "", "", "", "", ""
	}

	labels, ok := data["labels"].(map[string]interface{})
	if !ok {
		return "", "", "", u.toJSON(existingLabels), "", "", "", "", ""
	}

	// Basic fields
	clusterID, _ := labels["tidb_cluster_id"].(string)
	if clusterID == "" {
		clusterID, _ = labels["cluster_id"].(string)
	}
	tenantID, _ := labels["o11y_tenant_id"].(string)
	bizType, _ := labels["o11y_biz_type"].(string)

	// New fields
	stabilityGovernance, _ := labels["stability_governance"].(string)
	visibility, _ := labels["visibility"].(string)
	componentName, _ := labels["component"].(string)
	sourceComponent, _ := labels["source_component"].(string)
	alertGroup, _ := labels["alertgroup"].(string)

	// Merge extra labels into existing labels for backward compatibility / searchability
	uniqueLabels := make(map[string]bool)

	// Add existing labels first
	for _, l := range existingLabels {
		uniqueLabels[l] = true
	}

	// Add new fields as labels too (key:value format)
	if stabilityGovernance != "" {
		uniqueLabels["stability_governance:"+stabilityGovernance] = true
	}
	if visibility != "" {
		uniqueLabels["visibility:"+visibility] = true
	}
	if componentName != "" {
		uniqueLabels["component:"+componentName] = true
	}
	if sourceComponent != "" {
		uniqueLabels["source_component:"+sourceComponent] = true
	}
	if alertGroup != "" {
		uniqueLabels["alertgroup:"+alertGroup] = true
	}

	// Convert back to slice
	var finalLabels []string
	for l := range uniqueLabels {
		finalLabels = append(finalLabels, l)
	}

	labelsJSON, _ := json.Marshal(finalLabels)
	return clusterID, tenantID, bizType, string(labelsJSON), stabilityGovernance, visibility, componentName, sourceComponent, alertGroup
}

// Helper to convert string slice to JSON
func (u *DataUpdater) toJSON(v interface{}) string {
	b, _ := json.Marshal(v)
	return string(b)
}

// extractIDsFromDescription extracts cluster_id and tenant_id from description
func (u *DataUpdater) extractIDsFromDescription(description string) (string, string) {
	// Extract cluster ID
	clusterIDRegex := regexp.MustCompile(`tidb_cluster_id\s*[=:]\s*([^\s\n]+)`)
	clusterMatches := clusterIDRegex.FindStringSubmatch(description)
	clusterID := ""
	if len(clusterMatches) > 1 {
		clusterID = strings.TrimSpace(clusterMatches[1])
	}

	// Extract tenant ID
	tenantIDRegex := regexp.MustCompile(`o11y_tenant_id\s*[=:]\s*([^\s\n]+)`)
	tenantMatches := tenantIDRegex.FindStringSubmatch(description)
	tenantID := ""
	if len(tenantMatches) > 1 {
		tenantID = strings.TrimSpace(tenantMatches[1])
	}

	return clusterID, tenantID
}

// extractBizTypeFromDescription extracts biz_type from description (fallback)
func (u *DataUpdater) extractBizTypeFromDescription(description string) string {
	bizTypeRegex := regexp.MustCompile(`o11y_biz_type\s*[=:]\s*([^\s\n]+)`)
	matches := bizTypeRegex.FindStringSubmatch(description)
	if len(matches) > 1 {
		return strings.TrimSpace(matches[1])
	}
	return ""
}

// insertOrUpdateIssue inserts or updates an issue in the database
func (u *DataUpdater) insertOrUpdateIssue(data *IssueData) bool {
	query := `
		INSERT OR REPLACE INTO issues (
			id, title, description, created, priority, labels, issue_type,
			components, project, is_alert, alert_signature, cluster_id,
			tenant_id, biz_type, status, is_subtask,
			stability_governance, visibility, component_name, source_component, alert_group
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`

	_, err := u.db.Exec(
		query,
		data.ID,
		data.Title,
		data.Description,
		data.Created,
		data.Priority,
		data.Labels,
		data.IssueType,
		data.Components,
		data.Project,
		data.IsAlert,
		data.AlertSignature,
		data.ClusterID,
		data.TenantID,
		data.BizType,
		data.Status,
		data.IsSubtask,
		data.StabilityGovernance,
		data.Visibility,
		data.ComponentName,
		data.SourceComponent,
		data.AlertGroup,
	)

	if err != nil {
		u.logger.Printf("[ERROR] Failed to insert issue %s: %v\n", data.ID, err)
		return false
	}

	return true
}
