package services

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"gopkg.in/yaml.v3"
)

type RulesNotifyEntry struct {
	Type string `json:"type" yaml:"type"` // "tenant" or "cluster"
	ID   string `json:"id" yaml:"id"`
}

type RulesNotifyConfig struct {
	NextgenBlacklist   []RulesNotifyEntry `json:"nextgen_blacklist" yaml:"nextgen_blacklist"`
	DedicatedWhitelist []RulesNotifyEntry `json:"dedicated_whitelist" yaml:"dedicated_whitelist"`
}

type RulesNotifyManagerService struct {
	ConfigPath string
	mu         sync.RWMutex
}

var (
	rulesNotifyManagerService     *RulesNotifyManagerService
	rulesNotifyManagerServiceOnce sync.Once
)

func GetRulesNotifyManager() *RulesNotifyManagerService {
	rulesNotifyManagerServiceOnce.Do(func() {
		// Determine config path relative to binary execution or fixed for dev
		// Similar to existing services logic
		configPath := "config/rules_notify_manager.yaml"
		// Try to find it if we are deeper
		if _, err := os.Stat(configPath); os.IsNotExist(err) {
			if _, err := os.Stat("../" + configPath); err == nil {
				configPath = "../" + configPath
			} else if _, err := os.Stat("../../" + configPath); err == nil {
				configPath = "../../" + configPath
			}
		}

		rulesNotifyManagerService = &RulesNotifyManagerService{
			ConfigPath: configPath,
		}
	})
	return rulesNotifyManagerService
}

func (s *RulesNotifyManagerService) GetRules() (*RulesNotifyConfig, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	data, err := os.ReadFile(s.ConfigPath)
	if err != nil {
		if os.IsNotExist(err) {
			// Return empty config if file doesn't exist
			return &RulesNotifyConfig{
				NextgenBlacklist:   []RulesNotifyEntry{},
				DedicatedWhitelist: []RulesNotifyEntry{},
			}, nil
		}
		return nil, err
	}

	var config RulesNotifyConfig
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse rules notify config: %w", err)
	}

	// Ensure partial non-nil slices for JSON friendliness
	if config.NextgenBlacklist == nil {
		config.NextgenBlacklist = []RulesNotifyEntry{}
	}
	if config.DedicatedWhitelist == nil {
		config.DedicatedWhitelist = []RulesNotifyEntry{}
	}

	return &config, nil
}

func (s *RulesNotifyManagerService) UpdateRules(config RulesNotifyConfig) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	// Create directory if not exists
	dir := filepath.Dir(s.ConfigPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create config directory: %w", err)
	}

	data, err := yaml.Marshal(&config)
	if err != nil {
		return fmt.Errorf("failed to marshal rules notify config: %w", err)
	}

	if err := os.WriteFile(s.ConfigPath, data, 0644); err != nil {
		return fmt.Errorf("failed to write rules notify config: %w", err)
	}

	return nil
}
