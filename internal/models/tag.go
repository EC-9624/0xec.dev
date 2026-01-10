package models

import (
	"database/sql"
	"time"
)

// Tag represents a tag for posts and bookmarks
type Tag struct {
	ID        int64          `json:"id"`
	Name      string         `json:"name"`
	Slug      string         `json:"slug"`
	Color     sql.NullString `json:"color"`
	CreatedAt time.Time      `json:"created_at"`
}

// GetColor returns the color or empty string
func (t *Tag) GetColor() string {
	if t.Color.Valid {
		return t.Color.String
	}
	return ""
}

// CreateTagInput represents input for creating a tag
type CreateTagInput struct {
	Name  string `json:"name"`
	Slug  string `json:"slug"`
	Color string `json:"color"`
}
