package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/nolouch/alerts-platform-v2/internal/services"
)

func GetRulesNotifyConfig(c *gin.Context) {
	service := services.GetRulesNotifyManager()
	rules, err := service.GetRules()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, rules)
}

func UpdateRulesNotifyConfig(c *gin.Context) {
	var config services.RulesNotifyConfig
	if err := c.ShouldBindJSON(&config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	service := services.GetRulesNotifyManager()
	if err := service.UpdateRules(config); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "success", "message": "Rules notify config updated successfully"})
}
