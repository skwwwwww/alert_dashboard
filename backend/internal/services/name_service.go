package services

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"time"
)

type NameInfo struct {
	Type       string `json:"type"`
	ID         string `json:"id"`
	Name       string `json:"name"`
	TenantID   string `json:"tenantId"`
	TenantName string `json:"tenantName"`
}

type nameApiResponse struct {
	Success bool     `json:"success"`
	Data    NameInfo `json:"data"`
}

type NameResolver struct {
	cache      map[string]NameInfo
	cacheMutex sync.RWMutex
	client     *http.Client
}

var (
	resolverInstance *NameResolver
	resolverOnce     sync.Once
)

func GetNameResolver() *NameResolver {
	resolverOnce.Do(func() {
		resolverInstance = &NameResolver{
			cache: make(map[string]NameInfo),
			client: &http.Client{
				Timeout: 2 * time.Second,
			},
		}
	})
	return resolverInstance
}

func isNumeric(s string) bool {
	for _, c := range s {
		if c < '0' || c > '9' {
			return false
		}
	}
	return len(s) > 0
}

func (nr *NameResolver) Resolve(id string) (NameInfo, error) {
	if id == "" {
		return NameInfo{}, fmt.Errorf("empty id")
	}

	if !isNumeric(id) {
		return NameInfo{ID: id, Name: id}, nil
	}

	// Check cache
	nr.cacheMutex.RLock()
	if info, ok := nr.cache[id]; ok {
		nr.cacheMutex.RUnlock()
		return info, nil
	}
	nr.cacheMutex.RUnlock()

	// Fetch from API
	// API: http://10.2.8.101:3535/api/name?id={id}
	url := fmt.Sprintf("http://10.2.8.101:3535/api/name?id=%s", id)
	resp, err := nr.client.Get(url)
	if err != nil {
		return NameInfo{ID: id, Name: id}, err // Return ID as name on error fallback? Or just error.
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return NameInfo{ID: id, Name: id}, fmt.Errorf("api returned status: %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return NameInfo{ID: id, Name: id}, err
	}

	var apiResp nameApiResponse
	if err := json.Unmarshal(body, &apiResp); err != nil {
		return NameInfo{ID: id, Name: id}, err
	}

	if !apiResp.Success {
		return NameInfo{ID: id, Name: id}, fmt.Errorf("api returned success=false")
	}

	// Update cache
	nr.cacheMutex.Lock()
	nr.cache[id] = apiResp.Data
	nr.cacheMutex.Unlock()

	return apiResp.Data, nil
}
