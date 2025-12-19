package services

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/nolouch/alerts-platform-v2/internal/models"
	"gopkg.in/yaml.v3"
)

type RulesService struct {
	RepoPath         string
	SubDirs          []string
	CategoryPathsMap map[string][]string // Maps category (premium/dedicated/essential) to paths
	ComponentGroups  map[string][]string // Maps component group name to list of components
}

type RulesConfig struct {
	Categories map[string]CategoryPaths `yaml:"categories"`
	RepoPath   string                   `yaml:"repo_path"`
}

type ComponentCategoriesConfig struct {
	Categories map[string][]string `yaml:"categories"`
}

type CategoryPaths struct {
	Prometheus []string `yaml:"prometheus"`
	Logging    []string `yaml:"logging"`
}

func NewRulesService() *RulesService {
	// Defaults matching the legacy python env vars
	repoPath := os.Getenv("RUNBOOKS_REPO_PATH")
	if repoPath == "" {
		repoPath = "/Users/nolouch/program/docs/runbooks"
	}

	subDirsEnv := os.Getenv("RUNBOOKS_RULES_SUBDIRS")
	var subDirs []string
	if subDirsEnv != "" {
		subDirs = strings.Split(subDirsEnv, ",")
	} else {
		subDirs = []string{"rules/cluster-next-gen", "rules/dedicated", "rules/logging"}
	}

	// Load category mapping from config file
	categoryPathsMap := make(map[string][]string)
	configPaths := []string{
		"../config/rules_categories.yaml",
		"../../config/rules_categories.yaml",
		"config/rules_categories.yaml",
	}

	for _, configPath := range configPaths {
		data, err := os.ReadFile(configPath)
		if err == nil {
			var config RulesConfig
			if err := yaml.Unmarshal(data, &config); err == nil {
				// Flatten CategoryPaths (prometheus + logging) into a single list per category
				for category, paths := range config.Categories {
					var allPaths []string
					allPaths = append(allPaths, paths.Prometheus...)
					allPaths = append(allPaths, paths.Logging...)
					categoryPathsMap[category] = allPaths
				}
				if config.RepoPath != "" && repoPath == "/Users/nolouch/program/docs/runbooks" {
					repoPath = config.RepoPath
				}
				fmt.Printf("✅ Loaded rules categories config from %s\n", configPath)
				break
			}
		}
	}

	if len(categoryPathsMap) == 0 {
		fmt.Println("⚠️  Warning: Could not load rules_categories.yaml, using default paths for all categories")
		// Fallback: use all paths for all categories
		categoryPathsMap = map[string][]string{
			"premium":   subDirs,
			"dedicated": subDirs,
			"essential": subDirs,
		}
	}

	// Load component categories map
	componentGroups := make(map[string][]string)
	compConfigPaths := []string{
		"../config/component_categories.yaml",
		"../../config/component_categories.yaml",
		"config/component_categories.yaml",
	}

	for _, configPath := range compConfigPaths {
		data, err := os.ReadFile(configPath)
		if err == nil {
			var config ComponentCategoriesConfig
			if err := yaml.Unmarshal(data, &config); err == nil {
				componentGroups = config.Categories
				fmt.Printf("✅ Loaded component categories config from %s\n", configPath)
				break
			}
		}
	}

	return &RulesService{
		RepoPath:         repoPath,
		SubDirs:          subDirs,
		CategoryPathsMap: categoryPathsMap,
		ComponentGroups:  componentGroups,
	}
}

// GetRulesForComponent scans all configured directories and filters rules by 'component' label
func (s *RulesService) GetRulesForComponent(componentName string) ([]models.Rule, error) {
	var matchedRules []models.Rule

	for _, subDir := range s.SubDirs {
		basePath := filepath.Join(s.RepoPath, strings.TrimSpace(subDir))

		err := filepath.Walk(basePath, func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return nil // Skip errors accessing files
			}
			if info.IsDir() {
				return nil
			}
			if !strings.HasSuffix(path, ".yaml") && !strings.HasSuffix(path, ".yml") {
				return nil
			}

			// Parse file
			fileRules, err := s.parseFile(path)
			if err != nil {
				// log error but continue
				fmt.Printf("Error parsing %s: %v\n", path, err)
				return nil
			}

			// Filter rules
			for _, rule := range fileRules {
				// Check if component label matches
				matched := false
				if comp, ok := rule.Labels["component"]; ok {
					if strings.Contains(strings.ToLower(comp), strings.ToLower(componentName)) {
						matched = true
					}
				}
				// Also check source_component if not matched yet
				if !matched {
					if sourceComp, ok := rule.Labels["source_component"]; ok {
						if strings.Contains(strings.ToLower(sourceComp), strings.ToLower(componentName)) {
							matched = true
						}
					}
				}

				if matched {
					rule.Category = filepath.Base(filepath.Dir(path)) // simplified category
					rule.FilePath = path
					matchedRules = append(matchedRules, rule)
				}
			}
			return nil
		})
		if err != nil {
			fmt.Printf("Error walking %s: %v\n", basePath, err)
		}
	}

	return matchedRules, nil
}

// GetRulesForComponentAndCategory scans category-specific directories and filters rules by 'component' label
func (s *RulesService) GetRulesForComponentAndCategory(componentName, category string) ([]models.Rule, error) {
	var matchedRules []models.Rule

	// Get paths for the specified category
	categoryPaths, ok := s.CategoryPathsMap[category]
	if !ok || len(categoryPaths) == 0 {
		// Fallback to all paths if category not found
		fmt.Printf("⚠️  Category '%s' not found in config, using all paths\n", category)
		categoryPaths = s.SubDirs
	}

	// Resolve target components from component_categories.yaml if it's a group
	targetComponents := []string{componentName}

	// Load component categories map on demand or cached?
	// For simplicity, let's load it here or add it to RulesService struct.
	// Better to add to struct, but I need to update NewRulesService.
	// Let's do it inline efficiently for now or assume I update NewRulesService first?
	// I'll update NewRulesService in the same file.

	// Actually, let's look at s.ComponentGroups if I add it.
	if s.ComponentGroups != nil {
		if group, ok := s.ComponentGroups[componentName]; ok {
			targetComponents = group
		}
	}

	// Also handle wildcard case if ever needed, but we rely on targetComponents now.

	for _, subDir := range categoryPaths {
		basePath := filepath.Join(s.RepoPath, strings.TrimSpace(subDir))

		err := filepath.Walk(basePath, func(path string, info os.FileInfo, err error) error {
			if err != nil {
				return nil // Skip errors accessing files
			}
			if info.IsDir() {
				return nil
			}
			if !strings.HasSuffix(path, ".yaml") && !strings.HasSuffix(path, ".yml") {
				return nil
			}

			// Parse file
			fileRules, err := s.parseFile(path)
			if err != nil {
				// log error but continue
				fmt.Printf("Error parsing %s: %v\n", path, err)
				return nil
			}

			// Filter rules
			for _, rule := range fileRules {
				matched := false

				for _, targetComp := range targetComponents {
					// Check component label
					if comp, ok := rule.Labels["component"]; ok {
						if targetComp == "*" || strings.Contains(strings.ToLower(comp), strings.ToLower(targetComp)) {
							matched = true
						}
					}
					// Check source_component label
					if !matched {
						if sourceComp, ok := rule.Labels["source_component"]; ok {
							if targetComp == "*" || strings.Contains(strings.ToLower(sourceComp), strings.ToLower(targetComp)) {
								matched = true
							}
						}
					}
					if matched {
						break
					}
				}

				if matched {
					rule.Category = filepath.Base(filepath.Dir(path)) // simplified category
					rule.FilePath = path
					matchedRules = append(matchedRules, rule)
				}
			}
			return nil
		})
		if err != nil {
			fmt.Printf("Error walking %s: %v\n", basePath, err)
		}
	}

	return matchedRules, nil
}

func (s *RulesService) parseFile(path string) ([]models.Rule, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var rf models.RuleFile
	if err := yaml.Unmarshal(data, &rf); err != nil {
		return nil, err
	}

	var rules []models.Rule
	for _, group := range rf.Groups {
		for _, rule := range group.Rules {
			if rule.Alert != "" {
				rules = append(rules, rule)
			}
		}
	}
	return rules, nil
}

// UpdateRule updates a specific rule in a specific file
func (s *RulesService) UpdateRule(filePath string, oldAlertName string, updatedRule models.Rule) error {
	// 1. Read the file
	data, err := os.ReadFile(filePath)
	if err != nil {
		return fmt.Errorf("failed to read file: %w", err)
	}

	var rf models.RuleFile
	if err := yaml.Unmarshal(data, &rf); err != nil {
		return fmt.Errorf("failed to parse yaml: %w", err)
	}

	// 2. Find and update the rule
	found := false
	for i, group := range rf.Groups {
		for j, rule := range group.Rules {
			if rule.Alert == oldAlertName {
				// Update fields
				rf.Groups[i].Rules[j] = updatedRule
				// Preserve fields that are not in updatedRule if needed?
				// Assuming updatedRule contains all necessary fields.
				// However, updatedRule might have extra fields like FilePath/Category that shouldn't be in YAML.
				// We should strip them by using the correct struct tags which we have.
				found = true
				break
			}
		}
		if found {
			break
		}
	}

	if !found {
		return fmt.Errorf("rule '%s' not found in %s", oldAlertName, filePath)
	}

	// 3. Write back to file
	newData, err := yaml.Marshal(&rf)
	if err != nil {
		return fmt.Errorf("failed to marshal yaml: %w", err)
	}

	if err := os.WriteFile(filePath, newData, 0644); err != nil {
		return fmt.Errorf("failed to write file: %w", err)
	}

	return nil
}
