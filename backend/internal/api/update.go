package api

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"github.com/nolouch/alerts-platform-v2/internal/services"
)

// UpdateController handles data update operations
type UpdateController struct {
	db          *gorm.DB
	dataUpdater *services.DataUpdater
	lastUpdate  *time.Time
	isUpdating  bool
}

// UpdateRequest represents an update request
type UpdateRequest struct {
	Type string `json:"type"` // "full" or "incremental"
}

// UpdateStatus represents update status
type UpdateStatus struct {
	Status        string     `json:"status"`
	LastUpdate    *time.Time `json:"last_update"`
	IsUpdating    bool       `json:"is_updating"`
	JiraConnected bool       `json:"jira_connected"`
	IssueCount    int64      `json:"issue_count"`
}

// NewUpdateController creates a new update controller
func NewUpdateController(db *gorm.DB) *UpdateController {
	// Get raw SQL DB from GORM
	sqlDB, err := db.DB()
	if err != nil {
		panic("failed to get database connection: " + err.Error())
	}

	dataUpdater, err := services.NewDataUpdater(sqlDB)
	if err != nil {
		// Log error but don't panic - JIRA cred might not be configured  yet
		println("⚠️  Warning: Failed to initialize data updater:", err.Error())
		println("   Data update features will be unavailable")
	}

	return &UpdateController{
		db:          db,
		dataUpdater: dataUpdater,
		lastUpdate:  nil,
		isUpdating:  false,
	}
}

// TriggerUpdate handles manual update trigger
func (c *UpdateController) TriggerUpdate(ctx *gin.Context) {
	if c.dataUpdater == nil {
		ctx.JSON(http.StatusServiceUnavailable, gin.H{
			"success": false,
			"error":   "Data updater not available - JIRA credentials not configured",
		})
		return
	}

	if c.isUpdating {
		ctx.JSON(http.StatusConflict, gin.H{
			"success": false,
			"error":   "Update already in progress",
		})
		return
	}

	var req UpdateRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		// Default to incremental if no type specified
		req.Type = "incremental"
	}

	// Run update in background
	go func() {
		c.isUpdating = true
		defer func() { c.isUpdating = false }()

		var count int
		var err error

		if req.Type == "full" {
			count, err = c.dataUpdater.FetchInitialData(30)
		} else {
			count, err = c.dataUpdater.IncrementalUpdate()
		}

		if err != nil {
			println("❌ Update failed:", err.Error())
			return
		}

		now := time.Now()
		c.lastUpdate = &now
		println("✅ Update completed successfully:", count, "issues processed")
	}()

	ctx.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "Update started in background",
		"type":    req.Type,
	})
}

// GetUpdateStatus returns the current update status
func (c *UpdateController) GetUpdateStatus(ctx *gin.Context) {
	// Get issue count from database
	var count int64
	c.db.Table("issues").Count(&count)

	jiraConnected := false
	if c.dataUpdater != nil {
		jiraConnected = true
	}

	status := UpdateStatus{
		Status:        "online",
		LastUpdate:    c.lastUpdate,
		IsUpdating:    c.isUpdating,
		JiraConnected: jiraConnected,
		IssueCount:    count,
	}

	ctx.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    status,
	})
}

// StartScheduler starts the automatic update scheduler
func (c *UpdateController) StartScheduler(interval time.Duration) {
	if c.dataUpdater == nil {
		println("⚠️  Update scheduler not started: Data updater not available")
		return
	}

	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		println("⏰ Automatic update scheduler started (Interval:", interval.String(), ")")

		// Run immediately on startup (optional, maybe wait for first tick)
		// Let's wait for first tick to avoid slowing down startup

		for range ticker.C {
			if c.isUpdating {
				println("⚠️  Skipping scheduled update: Update already in progress")
				continue
			}

			println("⏰ Starting scheduled incremental update...")
			c.isUpdating = true

			count, err := c.dataUpdater.IncrementalUpdate()
			c.isUpdating = false // Reset flag immediately after

			if err != nil {
				println("❌ Scheduled update failed:", err.Error())
			} else {
				now := time.Now()
				c.lastUpdate = &now
				if count > 0 {
					println("✅ Scheduled update completed:", count, "new issues processed")
				} else {
					println("✅ Scheduled update check completed: No new issues")
				}
			}
		}
	}()
}

// RegisterUpdateRoutes registers update-related routes
func RegisterUpdateRoutes(router *gin.Engine, db *gorm.DB) {
	controller := NewUpdateController(db)

	// Check if database is empty and trigger initial update
	var count int64
	db.Table("issues").Count(&count)
	if count == 0 {
		println("🆕 Empty database detected (issue count: 0)")
		if controller.dataUpdater != nil {
			println("🚀 Triggering initial FULL data import (last 30 days)...")
			go func() {
				// Wait a few seconds for server to start fully
				time.Sleep(5 * time.Second)

				controller.isUpdating = true
				defer func() { controller.isUpdating = false }()

				// Fetch last 30 days of data
				processed, err := controller.dataUpdater.FetchInitialData(30)
				if err != nil {
					println("❌ Initial update failed:", err.Error())
				} else {
					now := time.Now()
					controller.lastUpdate = &now
					println("✅ Initial update completed:", processed, "issues imported")
				}
			}()
		} else {
			println("⚠️  Skipping initial update: Data updater not configured (JIRA credentials missing)")
		}
	}

	// Start scheduler with 1 hour interval
	// TODO: Make configurable via env var
	controller.StartScheduler(1 * time.Hour)

	api := router.Group("/api")
	{
		api.POST("/update", controller.TriggerUpdate)
		api.GET("/update/status", controller.GetUpdateStatus)
	}
}
