package models

import (
	"database/sql"
	"strings"
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

// Validate validates the CreatePostInput and returns field-level errors
func (input CreatePostInput) Validate() *FormErrors {
	errors := NewFormErrors()

	// Title validation
	title := strings.TrimSpace(input.Title)
	if title == "" {
		errors.AddField("title", "Title is required")
	} else if len(title) > 200 {
		errors.AddField("title", "Title cannot exceed 200 characters")
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

	// Content validation - required only if publishing
	if !input.IsDraft && strings.TrimSpace(input.Content) == "" {
		errors.AddField("content", "Content is required when publishing")
	}

	// Cover image URL validation
	if input.CoverImage != "" && !IsValidURL(input.CoverImage) {
		errors.AddField("cover_image", "Cover image must be a valid URL")
	}

	if errors.HasErrors() {
		return errors
	}
	return nil
}

// Validate validates the UpdatePostInput and returns field-level errors
func (input UpdatePostInput) Validate() *FormErrors {
	errors := NewFormErrors()

	// Title validation
	title := strings.TrimSpace(input.Title)
	if title == "" {
		errors.AddField("title", "Title is required")
	} else if len(title) > 200 {
		errors.AddField("title", "Title cannot exceed 200 characters")
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

	// Content validation - required only if publishing
	if !input.IsDraft && strings.TrimSpace(input.Content) == "" {
		errors.AddField("content", "Content is required when publishing")
	}

	// Cover image URL validation
	if input.CoverImage != "" && !IsValidURL(input.CoverImage) {
		errors.AddField("cover_image", "Cover image must be a valid URL")
	}

	if errors.HasErrors() {
		return errors
	}
	return nil
}
