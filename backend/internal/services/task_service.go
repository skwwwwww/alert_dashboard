package services

import (
	"fmt"
	"math/rand"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"github.com/nolouch/alerts-platform-v2/internal/models"
	"gorm.io/gorm"
)

type TaskService struct {
	DB           *gorm.DB
	RulesService *RulesService
}

func NewTaskService(db *gorm.DB, rulesService *RulesService) *TaskService {
	return &TaskService{
		DB:           db,
		RulesService: rulesService,
	}
}

// CreateTask saves a new task and starts the simulation worker
func (s *TaskService) CreateTask(task *models.Task) error {
	task.Status = "submitted"
	if err := s.DB.Create(task).Error; err != nil {
		return err
	}

	// Trigger simulation for "Claude Code" processing
	go s.simulateProcessing(task.ID)
	return nil
}

func (s *TaskService) GetTasksByComponent(component string) ([]models.Task, error) {
	var tasks []models.Task
	// Order by newest first
	if err := s.DB.Where("component = ?", component).Order("created_at desc").Find(&tasks).Error; err != nil {
		return nil, err
	}
	return tasks, nil
}

// simulateProcessing mimics the async backend flow:
// 1. Submitted -> Processing (Agent picks up task)
// 2. Processing -> Waiting For Review (PR created)
// simulateProcessing mimics the async backend flow:
// 1. Submitted -> Processing (Agent picks up task)
// 2. Processing -> Waiting For Review (PR created)
func (s *TaskService) simulateProcessing(taskID uint) {
	// Step 1: Wait a bit, then move to processing
	time.Sleep(2 * time.Second)
	s.updateStatus(taskID, "processing", "")

	// Retrieve the task to get details
	var task models.Task
	if err := s.DB.First(&task, taskID).Error; err != nil {
		fmt.Printf("❌ Failed to load task %d: %v\n", taskID, err)
		return
	}

	fmt.Printf("🔍 Agent looking for rule '%s' in component '%s'...\n", task.RuleName, task.Component)

	existingRules, err := s.RulesService.GetRulesForComponent(task.Component)
	var existingRuleContent string
	var filePath string
	var relativePath string

	if err == nil {
		for _, r := range existingRules {
			if r.Alert == task.RuleName {
				filePath = r.FilePath
				// Read original file content
				data, _ := os.ReadFile(filePath)
				existingRuleContent = string(data)

				// Calculate relative path for Claude
				if rel, err := filepath.Rel(s.RulesService.RepoPath, filePath); err == nil {
					relativePath = rel
				} else {
					relativePath = filepath.Base(filePath)
				}
				break
			}
		}
	} else {
		fmt.Printf("⚠️ Failed to fetch rules: %v\n", err)
	}

	// Try running Claude Code
	claudeSuccess := false
	var diff string

	if filePath != "" && s.RulesService.RepoPath != "" {
		// Construct prompt
		prompt := fmt.Sprintf("Edit %s to match this new rule definition: %s", relativePath, task.RuleContent)

		fmt.Printf("🤖 invoking 'claude code --headless' in %s\n", s.RulesService.RepoPath)
		cmd := exec.Command("claude", "code", "--headless", "-p", prompt)
		cmd.Dir = s.RulesService.RepoPath

		output, err := cmd.CombinedOutput()
		if err == nil {
			fmt.Printf("✅ Claude Code executed successfully\n")
			// In a real scenario, we'd PARSE the output or `git diff` to get the diff.
			// Re-read file to see if it changed
			newData, _ := os.ReadFile(filePath)
			if string(newData) != existingRuleContent {
				// It changed!
				diff = fmt.Sprintf("--- %s (ORIGINAL)\n+++ %s (MODIFIED BY CLAUDE)\n@@ -1 +1 @@\n", relativePath, relativePath)
				diff += "- " + existingRuleContent + "\n"
				diff += "+ " + string(newData)
				claudeSuccess = true
			} else {
				// Command success but no change?
				fmt.Println("⚠️ Claude finished but file didn't change.")
			}
		} else {
			fmt.Printf("⚠️ Claude Code failed or not found: %v. Output: %s\n", err, string(output))
		}
	}

	// Fallback simulation if Claude didn't run or didn't change anything
	if !claudeSuccess {
		fmt.Println("🔄 Falling back to simulated diff")
		if filePath != "" {
			diff = fmt.Sprintf("--- %s\n+++ %s (PROPOSED)\n@@ -1 +1 @@\n", filePath, filePath)
			diff += fmt.Sprintf("- Original Content Length: %d bytes\n", len(existingRuleContent))
		} else {
			diff = "--- /dev/null\n+++ New Rule (PROPOSED)\n@@ -0,0 +1 @@\n"
		}
		diff += "+ New Definition (JSON):\n"
		diff += task.RuleContent
	}

	// Update Task with Diff
	s.DB.Model(&task).Update("diff", diff)

	// Step 3: Wait a bit more
	time.Sleep(3 * time.Second)

	// Generate random PR  link
	prLink := fmt.Sprintf("https://github.com/org/repo/pull/%d", rand.Intn(1000)+1000)
	s.updateStatus(taskID, "waiting_for_review", prLink)

	fmt.Printf("🔔 [Notification] Task %d ready. PR: %s\n", taskID, prLink)
}

func (s *TaskService) updateStatus(taskID uint, status string, prLink string) {
	updates := map[string]interface{}{"status": status}
	if prLink != "" {
		updates["pr_link"] = prLink
	}
	s.DB.Model(&models.Task{}).Where("id = ?", taskID).Updates(updates)
}
