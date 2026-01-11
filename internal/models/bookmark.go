package models

import (
	"database/sql"
	"strconv"
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
	CoverImageID sql.NullInt64  `json:"cover_image_id"` // Local image ID
	FaviconID    sql.NullInt64  `json:"favicon_id"`     // Local favicon ID
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

// GetCoverImage returns the cover image URL or empty string.
// Prefers local image ID if available, falls back to external URL.
func (b *Bookmark) GetCoverImage() string {
	// If we have a local image ID, use that
	if b.CoverImageID.Valid {
		return "/images/" + strconv.FormatInt(b.CoverImageID.Int64, 10)
	}
	// Fall back to external URL
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
// Prefers local favicon ID if available, falls back to external URL or Google's service.
func (b *Bookmark) GetFaviconURL() string {
	// If we have a local favicon ID, use that
	if b.FaviconID.Valid {
		return "/images/" + strconv.FormatInt(b.FaviconID.Int64, 10)
	}
	// Fall back to stored external URL
	if b.Favicon.Valid && b.Favicon.String != "" {
		return b.Favicon.String
	}
	// Last resort: Google's favicon service
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
