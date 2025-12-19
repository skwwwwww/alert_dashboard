package models

import (
	"time"
)

// Issue maps to the 'issues' table with full JIRA data
type Issue struct {
	ID             string `gorm:"primaryKey" json:"id"`
	Title          string `json:"title"`
	Description    string `gorm:"type:text" json:"description"` // For category filtering
	Created        string `json:"created"`                      // Stored as text (e.g., "2025-01-15 10:30:45 UTC")
	Priority       string `json:"priority"`
	Labels         string `gorm:"type:text" json:"labels"`              // JSON array of labels
	IssueType      string `json:"issuetype"`                            // Issue type name
	ComponentsJSON string `gorm:"column:components;type:text" json:"-"` // Raw JSON string
	Project        string `json:"project"`                              // JIRA project key (e.g., "O11Y")

	// Alert specific fields
	IsAlert        bool   `json:"is_alert"`
	AlertSignature string `json:"alert_signature"`

	// Metadata for filtering
	ClusterID string `json:"cluster_id"`
	TenantID  string `json:"tenant_id"`
	BizType   string `json:"biz_type"` // "prod" or other
	Status    string `json:"status"`
	IsSubtask bool   `json:"is_subtask"` // Whether this is a subtask

	// New fields extracted from raw data
	StabilityGovernance string `json:"stability_governance"`
	Visibility          string `json:"visibility"`     // internal/external or empty
	ComponentName       string `json:"component_name"` // component from raw data, renamed to avoid conflict
	SourceComponent     string `json:"source_component"`
	AlertGroup          string `json:"alert_group"`

	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
}

func (Issue) TableName() string {
	return "issues"
}

// ComponentStat maps to the 'component_stats' table
type ComponentStat struct {
	Component  string `gorm:"primaryKey" json:"component"`
	Date       string `gorm:"primaryKey" json:"date"`
	AlertCount int    `json:"alert_count"`
}

func (ComponentStat) TableName() string {
	return "component_stats"
}

// DailyStat maps to 'daily_stats'
type DailyStat struct {
	Date          string `gorm:"primaryKey" json:"date"`
	TotalAlerts   int    `json:"total_alerts"`
	CriticalCount int    `json:"critical_count"`
	MajorCount    int    `json:"major_count"`
}

func (DailyStat) TableName() string {
	return "daily_stats"
}

// AlertRule maps to 'alert_rules'
type AlertRule struct {
	ID        uint   `gorm:"primaryKey" json:"id"`
	AlertName string `json:"alert_name"`
	Component string `json:"component"`
	Severity  string `json:"severity"`
	Expr      string `json:"expr"`
	// ... other fields as needed
}

func (AlertRule) TableName() string {
	return "alert_rules"
}

// MutedIssue maps to 'muted_issues'
type MutedIssue struct {
	IssueID string    `gorm:"primaryKey" json:"issue_id"`
	MutedAt time.Time `gorm:"autoCreateTime" json:"muted_at"`
	Reason  string    `json:"reason"`
}

func (MutedIssue) TableName() string {
	return "muted_issues"
}
