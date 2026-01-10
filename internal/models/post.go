package models

import (
	"database/sql"
	"time"
)

// Post represents a blog post
type Post struct {
	ID          int64          `json:"id"`
	Title       string         `json:"title"`
	Slug        string         `json:"slug"`
	Content     string         `json:"content"`
	Excerpt     sql.NullString `json:"excerpt"`
	CoverImage  sql.NullString `json:"cover_image"`
	IsDraft     bool           `json:"is_draft"`
	PublishedAt sql.NullTime   `json:"published_at"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	Tags        []Tag          `json:"tags,omitempty"`
}

// GetExcerpt returns the excerpt or empty string
func (p *Post) GetExcerpt() string {
	if p.Excerpt.Valid {
		return p.Excerpt.String
	}
	return ""
}

// GetCoverImage returns the cover image URL or empty string
func (p *Post) GetCoverImage() string {
	if p.CoverImage.Valid {
		return p.CoverImage.String
	}
	return ""
}

// GetPublishedAt returns the published date or nil
func (p *Post) GetPublishedAt() *time.Time {
	if p.PublishedAt.Valid {
		return &p.PublishedAt.Time
	}
	return nil
}

// CreatePostInput represents input for creating a post
type CreatePostInput struct {
	Title      string  `json:"title"`
	Slug       string  `json:"slug"`
	Content    string  `json:"content"`
	Excerpt    string  `json:"excerpt"`
	CoverImage string  `json:"cover_image"`
	IsDraft    bool    `json:"is_draft"`
	TagIDs     []int64 `json:"tag_ids"`
}

// UpdatePostInput represents input for updating a post
type UpdatePostInput struct {
	Title      string  `json:"title"`
	Slug       string  `json:"slug"`
	Content    string  `json:"content"`
	Excerpt    string  `json:"excerpt"`
	CoverImage string  `json:"cover_image"`
	IsDraft    bool    `json:"is_draft"`
	TagIDs     []int64 `json:"tag_ids"`
}
