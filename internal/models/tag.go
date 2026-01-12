package models

import (
	"time"
)

// Tag represents a tag for posts
type Tag struct {
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	Slug      string    `json:"slug"`
	CreatedAt time.Time `json:"created_at"`
}

// CreateTagInput represents input for creating a tag
type CreateTagInput struct {
	Name string `json:"name"`
	Slug string `json:"slug"`
}
