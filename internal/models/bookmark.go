package models

import (
	"database/sql"
	"strings"
	"time"
)

// Bookmark represents a saved bookmark
type Bookmark struct {
	ID           int64          `json:"id"`
	URL          string         `json:"url"`
	Title        string         `json:"title"`
	Description  sql.NullString `json:"description"`
	CoverImage   sql.NullString `json:"cover_image"`
	Favicon      sql.NullString `json:"favicon"`
	Domain       sql.NullString `json:"domain"`
	CollectionID sql.NullInt64  `json:"collection_id"`
	IsPublic     bool           `json:"is_public"`
	IsFavorite   bool           `json:"is_favorite"`
	SortOrder    int            `json:"sort_order"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	Collection   *Collection    `json:"collection,omitempty"`
}

// GetDescription returns the description or empty string
func (b *Bookmark) GetDescription() string {
	if b.Description.Valid {
		return b.Description.String
	}
	return ""
}

// GetCoverImage returns the cover image URL or empty string
func (b *Bookmark) GetCoverImage() string {
	if b.CoverImage.Valid {
		return b.CoverImage.String
	}
	return ""
}

// GetFavicon returns the favicon URL or empty string
func (b *Bookmark) GetFavicon() string {
	if b.Favicon.Valid {
		return b.Favicon.String
	}
	return ""
}

// GetFaviconURL returns the favicon URL for display.
// Falls back to Google's favicon service if no favicon is stored.
func (b *Bookmark) GetFaviconURL() string {
	// Use stored favicon URL if available
	if b.Favicon.Valid && b.Favicon.String != "" {
		return b.Favicon.String
	}
	// Fall back to Google's favicon service
	domain := b.GetDomain()
	if domain == "" {
		return ""
	}
	return "https://www.google.com/s2/favicons?sz=32&domain=" + domain
}

// GetDomain returns the domain or empty string
func (b *Bookmark) GetDomain() string {
	if b.Domain.Valid {
		return b.Domain.String
	}
	return ""
}

// CreateBookmarkInput represents input for creating a bookmark
type CreateBookmarkInput struct {
	URL          string `json:"url"`
	Title        string `json:"title"`
	Description  string `json:"description"`
	CoverImage   string `json:"cover_image"`
	Favicon      string `json:"favicon"`
	CollectionID *int64 `json:"collection_id"`
	IsPublic     bool   `json:"is_public"`
	IsFavorite   bool   `json:"is_favorite"`
}

// UpdateBookmarkInput represents input for updating a bookmark
type UpdateBookmarkInput struct {
	URL          string `json:"url"`
	Title        string `json:"title"`
	Description  string `json:"description"`
	CoverImage   string `json:"cover_image"`
	Favicon      string `json:"favicon"`
	CollectionID *int64 `json:"collection_id"`
	IsPublic     bool   `json:"is_public"`
	IsFavorite   bool   `json:"is_favorite"`
}

// Validate validates the CreateBookmarkInput and returns field-level errors.
// It also trims whitespace from string fields.
func (input *CreateBookmarkInput) Validate() *FormErrors {
	// Trim whitespace from all string fields
	input.URL = strings.TrimSpace(input.URL)
	input.Title = strings.TrimSpace(input.Title)
	input.Description = strings.TrimSpace(input.Description)
	input.CoverImage = strings.TrimSpace(input.CoverImage)
	input.Favicon = strings.TrimSpace(input.Favicon)

	errors := NewFormErrors()
	validateBookmarkFields(input.URL, input.Title, input.Description, input.CoverImage, errors)
	if errors.HasErrors() {
		return errors
	}
	return nil
}

// Validate validates the UpdateBookmarkInput and returns field-level errors.
// It also trims whitespace from string fields.
func (input *UpdateBookmarkInput) Validate() *FormErrors {
	// Trim whitespace from all string fields
	input.URL = strings.TrimSpace(input.URL)
	input.Title = strings.TrimSpace(input.Title)
	input.Description = strings.TrimSpace(input.Description)
	input.CoverImage = strings.TrimSpace(input.CoverImage)
	input.Favicon = strings.TrimSpace(input.Favicon)

	errors := NewFormErrors()
	validateBookmarkFields(input.URL, input.Title, input.Description, input.CoverImage, errors)
	if errors.HasErrors() {
		return errors
	}
	return nil
}
