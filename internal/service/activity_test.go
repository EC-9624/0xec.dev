package service

import "testing"

func TestGetActivityVerb(t *testing.T) {
	tests := []struct {
		action string
		want   string
	}{
		// Bookmark actions
		{ActionBookmarkCreated, "Added bookmark"},
		{ActionBookmarkUpdated, "Updated bookmark"},
		{ActionBookmarkDeleted, "Deleted bookmark"},

		// Post actions
		{ActionPostCreated, "Created post"},
		{ActionPostUpdated, "Updated post"},
		{ActionPostDeleted, "Deleted post"},
		{ActionPostPublished, "Published post"},

		// Collection actions
		{ActionCollectionCreated, "Created collection"},
		{ActionCollectionUpdated, "Updated collection"},
		{ActionCollectionDeleted, "Deleted collection"},

		// Tag actions
		{ActionTagCreated, "Created tag"},
		{ActionTagDeleted, "Deleted tag"},

		// Import actions
		{ActionImportStarted, "Started import"},
		{ActionImportCompleted, "Completed import"},

		// Metadata action
		{ActionMetadataFetched, "Fetched metadata"},

		// Unknown action - returns the action itself
		{"custom.action", "custom.action"},
		{"", ""},
	}

	for _, tt := range tests {
		t.Run(tt.action, func(t *testing.T) {
			got := GetActivityVerb(tt.action)
			if got != tt.want {
				t.Errorf("GetActivityVerb(%q) = %q, want %q", tt.action, got, tt.want)
			}
		})
	}
}

func TestActionConstants(t *testing.T) {
	// Verify action constants have expected format
	actions := []struct {
		name     string
		constant string
		prefix   string
	}{
		{"BookmarkCreated", ActionBookmarkCreated, "bookmark."},
		{"BookmarkUpdated", ActionBookmarkUpdated, "bookmark."},
		{"BookmarkDeleted", ActionBookmarkDeleted, "bookmark."},
		{"PostCreated", ActionPostCreated, "post."},
		{"PostUpdated", ActionPostUpdated, "post."},
		{"PostDeleted", ActionPostDeleted, "post."},
		{"PostPublished", ActionPostPublished, "post."},
		{"CollectionCreated", ActionCollectionCreated, "collection."},
		{"CollectionUpdated", ActionCollectionUpdated, "collection."},
		{"CollectionDeleted", ActionCollectionDeleted, "collection."},
		{"TagCreated", ActionTagCreated, "tag."},
		{"TagDeleted", ActionTagDeleted, "tag."},
		{"ImportStarted", ActionImportStarted, "import."},
		{"ImportCompleted", ActionImportCompleted, "import."},
		{"MetadataFetched", ActionMetadataFetched, "metadata."},
	}

	for _, tt := range actions {
		t.Run(tt.name, func(t *testing.T) {
			if len(tt.constant) < len(tt.prefix) {
				t.Errorf("%s constant %q is too short", tt.name, tt.constant)
				return
			}
			if tt.constant[:len(tt.prefix)] != tt.prefix {
				t.Errorf("%s constant %q should start with %q", tt.name, tt.constant, tt.prefix)
			}
		})
	}
}

func TestEntityConstants(t *testing.T) {
	// Verify entity constants exist and are non-empty
	entities := []struct {
		name     string
		constant string
	}{
		{"EntityBookmark", EntityBookmark},
		{"EntityPost", EntityPost},
		{"EntityCollection", EntityCollection},
	}

	for _, tt := range entities {
		t.Run(tt.name, func(t *testing.T) {
			if tt.constant == "" {
				t.Errorf("%s constant should not be empty", tt.name)
			}
		})
	}
}
