package services

import (
	"context"
	"fmt"
	"os"
	"time"

	jira "github.com/andygrunwald/go-jira"
)

// JiraClient wraps the JIRA client
type JiraClient struct {
	client *jira.Client
	ctx    context.Context
}

// JiraIssue represents a simplified JIRA issue structure
type JiraIssue struct {
	Key    string
	Fields JiraIssueFields
}

// JiraIssueFields contains issue field data
type JiraIssueFields struct {
	Summary      string
	Description  string
	Created      string
	Priority     *JiraPriority
	Labels       []string
	IssueType    *JiraIssueType
	Component    []JiraComponent
	Project      JiraProject
	Status       *JiraStatus
	RawAlertData interface{} // customfield_10160
	Parent       *JiraParent
}

type JiraPriority struct {
	Name string
}

type JiraIssueType struct {
	Name    string
	Subtask bool
}

type JiraComponent struct {
	Name string
}

type JiraProject struct {
	Key string
}

type JiraStatus struct {
	Name string
}

type JiraParent struct {
	Key string
}

// JiraSearchResult contains search results
type JiraSearchResult struct {
	Issues     []JiraIssue
	StartAt    int
	MaxResults int
	Total      int
}

// NewJiraClient creates a new JIRA client using credentials from environment
func NewJiraClient() (*JiraClient, error) {
	server := os.Getenv("JIRA_SERVER")
	username := os.Getenv("JIRA_USER")
	token := os.Getenv("JIRA_TOKEN")

	if server == "" {
		server = "https://tidb.atlassian.net"
	}

	if username == "" || token == "" {
		return nil, fmt.Errorf("JIRA credentials not found in environment variables")
	}

	// Create transport with basic auth
	tp := jira.BasicAuthTransport{
		Username: username,
		Password: token, // Use Password field for API token in v1
	}

	// Create JIRA client
	client, err := jira.NewClient(tp.Client(), server)
	if err != nil {
		return nil, fmt.Errorf("failed to create JIRA client: %w", err)
	}

	return &JiraClient{
		client: client,
		ctx:    context.Background(),
	}, nil
}

// TestConnection tests the JIRA connection
func (c *JiraClient) TestConnection() error {
	_, _, err := c.client.User.GetSelf()
	if err != nil {
		return fmt.Errorf("JIRA connection test failed: %w", err)
	}
	return nil
}

// SearchIssues searches for issues using JQL with V2 API
func (c *JiraClient) SearchIssues(jql string, startAt int, maxResults int) (*JiraSearchResult, error) {
	// Use SearchV2JQL which uses /rest/api/2/search/jql (the new endpoint after migration)
	// Note: This is different from Search() which uses deprecated /rest/api/2/search
	opts := &jira.SearchOptionsV2{
		Fields:     []string{"summary", "description", "created", "priority", "labels", "issuetype", "components", "status", "project", "customfield_10160", "parent"},
		MaxResults: maxResults,
	}

	issues, resp, err := c.client.Issue.SearchV2JQL(jql, opts)
	if err != nil {
		return nil, fmt.Errorf("JIRA search error: %w", err)
	}

	// Convert to our structure
	result := &JiraSearchResult{
		StartAt:    startAt,
		MaxResults: maxResults,
		Total:      resp.Total,
		Issues:     make([]JiraIssue, 0, len(issues)),
	}

	for _, issue := range issues {
		converted := JiraIssue{
			Key: issue.Key,
			Fields: JiraIssueFields{
				Summary:     issue.Fields.Summary,
				Description: issue.Fields.Description,
				Created:     (*time.Time)(&issue.Fields.Created).Format("2006-01-02T15:04:05.000-0700"),
				Labels:      issue.Fields.Labels,
			},
		}

		// Priority
		if issue.Fields.Priority != nil {
			converted.Fields.Priority = &JiraPriority{Name: issue.Fields.Priority.Name}
		}

		// Issue type
		if issue.Fields.Type.Name != "" {
			converted.Fields.IssueType = &JiraIssueType{
				Name:    issue.Fields.Type.Name,
				Subtask: issue.Fields.Type.Subtask,
			}
		}

		// Components
		if issue.Fields.Components != nil {
			for _, comp := range issue.Fields.Components {
				converted.Fields.Component = append(converted.Fields.Component, JiraComponent{Name: comp.Name})
			}
		}

		// Project
		converted.Fields.Project = JiraProject{Key: issue.Fields.Project.Key}

		// Status
		if issue.Fields.Status != nil {
			converted.Fields.Status = &JiraStatus{Name: issue.Fields.Status.Name}
		}

		// Parent (for subtasks)
		if issue.Fields.Parent != nil {
			converted.Fields.Parent = &JiraParent{Key: issue.Fields.Parent.Key}
		}

		// Raw alert data (customfield_10160)
		if issue.Fields.Unknowns != nil {
			if rawData, ok := issue.Fields.Unknowns["customfield_10160"]; ok {
				converted.Fields.RawAlertData = rawData
			}
		}

		result.Issues = append(result.Issues, converted)
	}

	return result, nil
}

// SearchAllIssues searches and collects all issues matching JQL (with pagination using NextPageToken)
func (c *JiraClient) SearchAllIssues(jql string, pageSize int, label string) ([]JiraIssue, error) {
	if pageSize <= 0 {
		pageSize = 100
	}

	fmt.Printf("\n🔍 [%s] Starting search with JQL: %s\n", label, jql)

	var allIssues []JiraIssue
	nextPageToken := ""
	pageNum := 0
	maxPages := 500 // Safety limit to prevent infinite loops

	for {
		pageNum++

		// Safety check
		if pageNum > maxPages {
			fmt.Printf("⚠️  [WARNING] Reached max page limit (%d). Stopping pagination.\n", maxPages)
			break
		}
		// Use SearchV2JQL with NextPageToken for pagination
		opts := &jira.SearchOptionsV2{
			Fields:        []string{"summary", "description", "created", "priority", "labels", "issuetype", "components", "status", "project", "customfield_10160", "parent"},
			MaxResults:    pageSize,
			NextPageToken: nextPageToken,
		}

		fmt.Printf("[DEBUG] [%s] Fetching page %d (pageSize=%d, token=%s)\n", label, pageNum, pageSize, nextPageToken)
		issues, resp, err := c.client.Issue.SearchV2JQL(jql, opts)
		if err != nil {
			return nil, fmt.Errorf("JIRA search error on page %d: %w", pageNum, err)
		}
		fmt.Printf("[DEBUG] [%s] Page %d: got %d issues, nextToken=%s\n", label, pageNum, len(issues), resp.NextPageToken)

		// Convert issues to our format
		for _, issue := range issues {
			converted := JiraIssue{
				Key: issue.Key,
				Fields: JiraIssueFields{
					Summary:     issue.Fields.Summary,
					Description: issue.Fields.Description,
					Created:     (*time.Time)(&issue.Fields.Created).Format("2006-01-02T15:04:05.000-0700"),
					Labels:      issue.Fields.Labels,
				},
			}

			// Priority
			if issue.Fields.Priority != nil {
				converted.Fields.Priority = &JiraPriority{Name: issue.Fields.Priority.Name}
			}

			// Issue type
			if issue.Fields.Type.Name != "" {
				converted.Fields.IssueType = &JiraIssueType{
					Name:    issue.Fields.Type.Name,
					Subtask: issue.Fields.Type.Subtask,
				}
			}

			// Components
			if issue.Fields.Components != nil {
				for _, comp := range issue.Fields.Components {
					converted.Fields.Component = append(converted.Fields.Component, JiraComponent{Name: comp.Name})
				}
			}

			// Project
			converted.Fields.Project = JiraProject{Key: issue.Fields.Project.Key}

			// Status
			if issue.Fields.Status != nil {
				converted.Fields.Status = &JiraStatus{Name: issue.Fields.Status.Name}
			}

			// Parent (for subtasks)
			if issue.Fields.Parent != nil {
				converted.Fields.Parent = &JiraParent{Key: issue.Fields.Parent.Key}
			}

			// Raw alert data (customfield_10160)
			if issue.Fields.Unknowns != nil {
				if rawData, ok := issue.Fields.Unknowns["customfield_10160"]; ok {
					converted.Fields.RawAlertData = rawData
				}
			}

			allIssues = append(allIssues, converted)
		}

		// Check if there's a next page using NextPageToken from response
		if resp.NextPageToken == "" {
			fmt.Printf("[DEBUG] [%s] No more pages (empty nextToken). Total pages fetched: %d\n", label, pageNum)
			break
		}

		// IMPORTANT: Check if nextPageToken is the same (infinite loop detection)
		if resp.NextPageToken == nextPageToken {
			fmt.Printf("⚠️  [WARNING] [%s] NextPageToken repeated (infinite loop detected). Stopping at page %d\n", label, pageNum)
			break
		}

		nextPageToken = resp.NextPageToken
	}

	fmt.Printf("✅ [PAGINATION COMPLETE] [%s] Total issues collected: %d across %d pages\n", label, len(allIssues), pageNum)
	return allIssues, nil
}
