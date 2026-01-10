package models

import (
	"database/sql"
	"time"
)

// Collection represents a bookmark collection/folder
type Collection struct {
	ID            int64          `json:"id"`
	Name          string         `json:"name"`
	Slug          string         `json:"slug"`
	Description   sql.NullString `json:"description"`
	Icon          sql.NullString `json:"icon"`
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

// GetIcon returns the icon or empty string
func (c *Collection) GetIcon() string {
	if c.Icon.Valid {
		return c.Icon.String
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
	Icon        string `json:"icon"`
	Color       string `json:"color"`
	ParentID    *int64 `json:"parent_id"`
	IsPublic    bool   `json:"is_public"`
}

// UpdateCollectionInput represents input for updating a collection
type UpdateCollectionInput struct {
	Name        string `json:"name"`
	Slug        string `json:"slug"`
	Description string `json:"description"`
	Icon        string `json:"icon"`
	Color       string `json:"color"`
	ParentID    *int64 `json:"parent_id"`
	IsPublic    bool   `json:"is_public"`
	SortOrder   int    `json:"sort_order"`
}
