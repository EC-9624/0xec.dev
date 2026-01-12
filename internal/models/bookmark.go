package models

import (
	"database/sql"
	"errors"
	"time"
)

// Bookmark represents a saved bookmark
type Bookmark struct {
	ID           int64          `json:"id"`
	URL          string         `json:"url"`
	Title        string         `json:"title"`
	Description  sql.NullString `json:"description"`
	Excerpt      sql.NullString `json:"excerpt"`
	CoverImage   sql.NullString `json:"cover_image"`
	Favicon      sql.NullString `json:"favicon"`
	Domain       sql.NullString `json:"domain"`
	CollectionID sql.NullInt64  `json:"collection_id"`
	IsPublic     bool           `json:"is_public"`
	IsFavorite   bool           `json:"is_favorite"`
	SortOrder    int            `json:"sort_order"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	Tags         []Tag          `json:"tags,omitempty"`
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
	URL          string  `json:"url"`
	Title        string  `json:"title"`
	Description  string  `json:"description"`
	CoverImage   string  `json:"cover_image"`
	Favicon      string  `json:"favicon"`
	CollectionID *int64  `json:"collection_id"`
	IsPublic     bool    `json:"is_public"`
	IsFavorite   bool    `json:"is_favorite"`
	TagIDs       []int64 `json:"tag_ids"`
}

// UpdateBookmarkInput represents input for updating a bookmark
type UpdateBookmarkInput struct {
	URL          string  `json:"url"`
	Title        string  `json:"title"`
	Description  string  `json:"description"`
	CoverImage   string  `json:"cover_image"`
	Favicon      string  `json:"favicon"`
	CollectionID *int64  `json:"collection_id"`
	IsPublic     bool    `json:"is_public"`
	IsFavorite   bool    `json:"is_favorite"`
	TagIDs       []int64 `json:"tag_ids"`
}

// Validate validates the CreateBookmarkInput
func (input CreateBookmarkInput) Validate() error {
	if input.URL == "" {
		return errors.New("URL is required")
	}
	if input.Title == "" {
		return errors.New("title is required")
	}
	return nil
}

// Validate validates the UpdateBookmarkInput
func (input UpdateBookmarkInput) Validate() error {
	if input.URL == "" {
		return errors.New("URL is required")
	}
	if input.Title == "" {
		return errors.New("title is required")
	}
	return nil
}
