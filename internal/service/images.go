package service

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/EC-9624/0xec.dev/internal/database/sqlc/db"
	"github.com/EC-9624/0xec.dev/internal/models"
)

// DownloadAndStoreImage downloads an image from a URL and stores it in the database.
// It returns the image ID if successful, or an error if the download fails or the image is invalid.
// If an image with the same hash already exists, it returns the existing image's ID (deduplication).
func (s *Service) DownloadAndStoreImage(ctx context.Context, imageURL string, maxSize int64) (int64, error) {
	if imageURL == "" {
		return 0, fmt.Errorf("empty image URL")
	}

	// Download the image
	client := &http.Client{
		Timeout: 15 * time.Second,
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, imageURL, nil)
	if err != nil {
		return 0, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36")
	req.Header.Set("Accept", "image/*,*/*;q=0.8")

	resp, err := client.Do(req)
	if err != nil {
		return 0, fmt.Errorf("failed to download image: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("image download returned status %d", resp.StatusCode)
	}

	// Check content type
	contentType := resp.Header.Get("Content-Type")
	// Handle content types with charset suffix like "image/png; charset=utf-8"
	contentType = strings.Split(contentType, ";")[0]
	contentType = strings.TrimSpace(contentType)

	if !models.IsAllowedImageType(contentType) {
		return 0, fmt.Errorf("unsupported image type: %s", contentType)
	}

	// Read with size limit
	limitedReader := io.LimitReader(resp.Body, maxSize+1) // +1 to detect if exceeded
	data, err := io.ReadAll(limitedReader)
	if err != nil {
		return 0, fmt.Errorf("failed to read image: %w", err)
	}

	if int64(len(data)) > maxSize {
		return 0, fmt.Errorf("image exceeds maximum size of %d bytes", maxSize)
	}

	if len(data) == 0 {
		return 0, fmt.Errorf("empty image data")
	}

	// Calculate hash for deduplication
	hash := sha256.Sum256(data)
	hashStr := hex.EncodeToString(hash[:])

	// Check if image already exists
	existing, err := s.queries.GetImageByHash(ctx, hashStr)
	if err == nil {
		// Image already exists, return existing ID
		return existing.ID, nil
	}

	// Store new image
	img, err := s.queries.CreateImage(ctx, db.CreateImageParams{
		Hash:        hashStr,
		ContentType: contentType,
		Data:        data,
		Size:        int64(len(data)),
		SourceUrl:   &imageURL,
	})
	if err != nil {
		return 0, fmt.Errorf("failed to store image: %w", err)
	}

	return img.ID, nil
}

// GetImage retrieves an image by ID
func (s *Service) GetImage(ctx context.Context, id int64) (*models.Image, error) {
	img, err := s.queries.GetImageByID(ctx, id)
	if err != nil {
		return nil, err
	}

	return dbImageToModel(&img), nil
}

// GetImageByHash retrieves an image by its hash
func (s *Service) GetImageByHash(ctx context.Context, hash string) (*models.Image, error) {
	img, err := s.queries.GetImageByHash(ctx, hash)
	if err != nil {
		return nil, err
	}

	return dbImageToModel(&img), nil
}

// dbImageToModel converts db.Image to models.Image
func dbImageToModel(img *db.Image) *models.Image {
	m := &models.Image{
		ID:          img.ID,
		Hash:        img.Hash,
		ContentType: img.ContentType,
		Data:        img.Data,
		Size:        img.Size,
	}
	if img.SourceUrl != nil {
		m.SourceURL.Valid = true
		m.SourceURL.String = *img.SourceUrl
	}
	if img.CreatedAt != nil {
		m.CreatedAt = *img.CreatedAt
	}
	return m
}

// DeleteImage deletes an image by ID
func (s *Service) DeleteImage(ctx context.Context, id int64) error {
	return s.queries.DeleteImage(ctx, id)
}

// DeleteUnusedImages removes images that are no longer referenced by any bookmark
func (s *Service) DeleteUnusedImages(ctx context.Context) error {
	return s.queries.DeleteUnusedImages(ctx)
}

// GetImageStats returns statistics about stored images
func (s *Service) GetImageStats(ctx context.Context) (*models.ImageStats, error) {
	stats, err := s.queries.GetImageStats(ctx)
	if err != nil {
		return nil, err
	}

	var totalSize int64
	if stats.TotalSize != nil {
		switch v := stats.TotalSize.(type) {
		case int64:
			totalSize = v
		case float64:
			totalSize = int64(v)
		}
	}

	return &models.ImageStats{
		Count:     stats.Count,
		TotalSize: totalSize,
	}, nil
}

// UpdateBookmarkImageIDs updates the image IDs for a bookmark
func (s *Service) UpdateBookmarkImageIDs(ctx context.Context, bookmarkID int64, coverImageID, faviconID *int64) error {
	return s.queries.UpdateBookmarkImageIDs(ctx, db.UpdateBookmarkImageIDsParams{
		CoverImageID: coverImageID,
		FaviconID:    faviconID,
		ID:           bookmarkID,
	})
}

// DownloadAndStoreBookmarkImages downloads and stores both cover image and favicon for a bookmark.
// It updates the bookmark with the new image IDs.
func (s *Service) DownloadAndStoreBookmarkImages(ctx context.Context, bookmarkID int64, coverImageURL, faviconURL string) error {
	var coverImageID, faviconID *int64

	// Download cover image
	if coverImageURL != "" {
		id, err := s.DownloadAndStoreImage(ctx, coverImageURL, models.MaxCoverImageSize)
		if err == nil {
			coverImageID = &id
		}
		// Ignore errors - we don't want to fail the whole operation if one image fails
	}

	// Download favicon
	if faviconURL != "" {
		id, err := s.DownloadAndStoreImage(ctx, faviconURL, models.MaxFaviconSize)
		if err == nil {
			faviconID = &id
		}
	}

	// Update bookmark if we got any images
	if coverImageID != nil || faviconID != nil {
		return s.UpdateBookmarkImageIDs(ctx, bookmarkID, coverImageID, faviconID)
	}

	return nil
}

// ListBookmarksWithExternalImages returns bookmarks that have external image URLs but no local image IDs
func (s *Service) ListBookmarksWithExternalImages(ctx context.Context) ([]models.Bookmark, error) {
	dbBookmarks, err := s.queries.ListBookmarksWithExternalImages(ctx)
	if err != nil {
		return nil, err
	}

	bookmarks := make([]models.Bookmark, 0, len(dbBookmarks))
	for _, b := range dbBookmarks {
		bookmarks = append(bookmarks, *dbBookmarkToModel(b, nil))
	}
	return bookmarks, nil
}

// CountBookmarksWithExternalImages returns the count of bookmarks with external images
func (s *Service) CountBookmarksWithExternalImages(ctx context.Context) (int64, error) {
	return s.queries.CountBookmarksWithExternalImages(ctx)
}
