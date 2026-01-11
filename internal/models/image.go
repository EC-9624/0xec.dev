package models

import (
	"database/sql"
	"time"
)

// Image represents a stored image (cover image or favicon)
type Image struct {
	ID          int64          `json:"id"`
	Hash        string         `json:"hash"`         // SHA256 hash for deduplication
	ContentType string         `json:"content_type"` // MIME type
	Data        []byte         `json:"-"`            // Binary data (excluded from JSON)
	Size        int64          `json:"size"`         // Size in bytes
	SourceURL   sql.NullString `json:"source_url"`   // Original URL
	CreatedAt   time.Time      `json:"created_at"`
}

// ImageStats contains aggregate statistics about stored images
type ImageStats struct {
	Count     int64 `json:"count"`
	TotalSize int64 `json:"total_size"`
}

// MaxCoverImageSize is the maximum size for cover images (2MB)
const MaxCoverImageSize = 2 * 1024 * 1024

// MaxFaviconSize is the maximum size for favicons (50KB)
const MaxFaviconSize = 50 * 1024

// AllowedImageTypes lists the allowed MIME types for images
var AllowedImageTypes = map[string]bool{
	"image/jpeg":               true,
	"image/png":                true,
	"image/gif":                true,
	"image/webp":               true,
	"image/svg+xml":            true,
	"image/x-icon":             true,
	"image/vnd.microsoft.icon": true,
}

// IsAllowedImageType checks if the content type is allowed
func IsAllowedImageType(contentType string) bool {
	return AllowedImageTypes[contentType]
}
