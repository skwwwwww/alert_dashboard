package models

import (
	"time"

	"gorm.io/gorm"
)

type Task struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	RuleName    string `json:"rule_name"`
	RuleContent string `gorm:"type:text" json:"rule_content"` // JSON string of AlertRule
	Type        string `json:"type"`                          // ADD, EDIT, DELETE
	Status      string `json:"status"`                        // submitted, processing, waiting_for_review, merged, rejected
	PRLink      string `json:"pr_link"`
	Component   string `json:"component"`
	Owner       string `json:"owner"`
	Description string `json:"description"`
	Diff        string `gorm:"type:text" json:"diff"` // Unified Diff of the change
}
