package models

import (
	"database/sql"
	"strings"
	"time"
)

// Collection represents a bookmark collection/folder
type Collection struct {
	ID            int64          `json:"id"`
	Name          string         `json:"name"`
	Slug          string         `json:"slug"`
	Description   sql.NullString `json:"description"`
	Color         sql.NullString `json:"color"`
	ParentID      sql.NullInt64  `json:"parent_id"`
	SortOrder     int            `json:"sort_order"`
	IsPublic      bool           `json:"is_public"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	BookmarkCount int            `json:"bookmark_count,omitempty"`
	Children      []Collection   `json:"children,omitempty"`
}

// GetDescription returns the description or empty string
func (c *Collection) GetDescription() string {
	if c.Description.Valid {
		return c.Description.String
	}
	return ""
}

// GetColor returns the color or empty string
func (c *Collection) GetColor() string {
	if c.Color.Valid {
		return c.Color.String
	}
	return ""
}

// CreateCollectionInput represents input for creating a collection
type CreateCollectionInput struct {
	Name        string `json:"name"`
	Slug        string `json:"slug"`
	Description string `json:"description"`
	Color       string `json:"color"`
	ParentID    *int64 `json:"parent_id"`
	IsPublic    bool   `json:"is_public"`
}

// UpdateCollectionInput represents input for updating a collection
type UpdateCollectionInput struct {
	Name        string `json:"name"`
	Slug        string `json:"slug"`
	Description string `json:"description"`
	Color       string `json:"color"`
	ParentID    *int64 `json:"parent_id"`
	IsPublic    bool   `json:"is_public"`
	SortOrder   int    `json:"sort_order"`
}

// Validate validates the CreateCollectionInput and returns field-level errors
func (input CreateCollectionInput) Validate() *FormErrors {
	errors := NewFormErrors()

	// Name validation
	name := strings.TrimSpace(input.Name)
	if name == "" {
		errors.AddField("name", "Name is required")
	} else if len(name) > 100 {
		errors.AddField("name", "Name cannot exceed 100 characters")
	}

	// Slug validation
	slug := strings.TrimSpace(input.Slug)
	if slug == "" {
		errors.AddField("slug", "Slug is required")
	} else if len(slug) > 100 {
		errors.AddField("slug", "Slug cannot exceed 100 characters")
	} else if !IsValidSlug(slug) {
		errors.AddField("slug", "Slug can only contain lowercase letters, numbers, and hyphens")
	}

	// Description validation (optional, max 500)
	if len(input.Description) > 500 {
		errors.AddField("description", "Description cannot exceed 500 characters")
	}

	// Color validation (optional, must be valid hex if provided)
	if input.Color != "" && !IsValidHexColor(input.Color) {
		errors.AddField("color", "Color must be a valid hex color (e.g., #3b82f6)")
	}

	if errors.HasErrors() {
		return errors
	}
	return nil
}

// Validate validates the UpdateCollectionInput and returns field-level errors
func (input UpdateCollectionInput) Validate() *FormErrors {
	errors := NewFormErrors()

	// Name validation
	name := strings.TrimSpace(input.Name)
	if name == "" {
		errors.AddField("name", "Name is required")
	} else if len(name) > 100 {
		errors.AddField("name", "Name cannot exceed 100 characters")
	}

	// Slug validation
	slug := strings.TrimSpace(input.Slug)
	if slug == "" {
		errors.AddField("slug", "Slug is required")
	} else if len(slug) > 100 {
		errors.AddField("slug", "Slug cannot exceed 100 characters")
	} else if !IsValidSlug(slug) {
		errors.AddField("slug", "Slug can only contain lowercase letters, numbers, and hyphens")
	}

	// Description validation (optional, max 500)
	if len(input.Description) > 500 {
		errors.AddField("description", "Description cannot exceed 500 characters")
	}

	// Color validation (optional, must be valid hex if provided)
	if input.Color != "" && !IsValidHexColor(input.Color) {
		errors.AddField("color", "Color must be a valid hex color (e.g., #3b82f6)")
	}

	if errors.HasErrors() {
		return errors
	}
	return nil
}
