package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/nolouch/alerts-platform-v2/internal/db"
	"github.com/nolouch/alerts-platform-v2/internal/models"
	"github.com/nolouch/alerts-platform-v2/internal/services"
)

// HandleGetTasks returns all tasks for a specific component
func HandleGetTasks(c *gin.Context) {
	componentName := c.DefaultQuery("component", "")
	if componentName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "component query parameter is required"})
		return
	}

	taskService := services.NewTaskService(db.DB, services.NewRulesService())
	tasks, err := taskService.GetTasksByComponent(componentName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, tasks)
}

// HandleCreateTask creates a new rule task
func HandleCreateTask(c *gin.Context) {
	var task models.Task
	if err := c.ShouldBindJSON(&task); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if task.Component == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "component is required"})
		return
	}

	taskService := services.NewTaskService(db.DB, services.NewRulesService())
	if err := taskService.CreateTask(&task); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, task)
}
