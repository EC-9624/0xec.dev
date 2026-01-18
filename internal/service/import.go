package service

import (
	"context"
	"fmt"
	"regexp"
	"strings"
	"time"

	"github.com/EC-9624/0xec.dev/internal/models"
)

// ImportedBookmark represents a bookmark parsed from an import file
type ImportedBookmark struct {
	URL     string
	Title   string
	AddedAt time.Time
	Folder  string // The folder path from the import (e.g., "Bookmarks Bar/Tech")
}

// ImportResult contains the results of an import operation
type ImportResult struct {
	Total   int
	Created int
	Updated int
	Skipped int
	Errors  []string
}

// ParseChromeBookmarks parses a Chrome bookmarks HTML export file
func ParseChromeBookmarks(html string) ([]ImportedBookmark, error) {
	var bookmarks []ImportedBookmark
	var currentFolder []string

	// Split by lines for easier processing
	lines := strings.Split(html, "\n")

	// Regex patterns
	folderStartRe := regexp.MustCompile(`(?i)<DT><H3[^>]*>([^<]+)</H3>`)
	folderEndRe := regexp.MustCompile(`(?i)</DL>`)
	bookmarkRe := regexp.MustCompile(`(?i)<DT><A\s+HREF="([^"]+)"[^>]*ADD_DATE="(\d+)"[^>]*>([^<]*)</A>`)
	bookmarkNoDateRe := regexp.MustCompile(`(?i)<DT><A\s+HREF="([^"]+)"[^>]*>([^<]*)</A>`)

	for _, line := range lines {
		line = strings.TrimSpace(line)

		// Check for folder start
		if matches := folderStartRe.FindStringSubmatch(line); len(matches) > 1 {
			folderName := cleanHTMLEntities(matches[1])
			currentFolder = append(currentFolder, folderName)
			continue
		}

		// Check for folder end
		if folderEndRe.MatchString(line) && len(currentFolder) > 0 {
			currentFolder = currentFolder[:len(currentFolder)-1]
			continue
		}

		// Check for bookmark with date
		if matches := bookmarkRe.FindStringSubmatch(line); len(matches) > 3 {
			url := matches[1]
			timestamp := matches[2]
			title := cleanHTMLEntities(matches[3])

			// Parse Unix timestamp
			var addedAt time.Time
			if ts, err := parseUnixTimestamp(timestamp); err == nil {
				addedAt = ts
			} else {
				addedAt = time.Now()
			}

			bookmarks = append(bookmarks, ImportedBookmark{
				URL:     url,
				Title:   title,
				AddedAt: addedAt,
				Folder:  strings.Join(currentFolder, "/"),
			})
			continue
		}

		// Check for bookmark without date
		if matches := bookmarkNoDateRe.FindStringSubmatch(line); len(matches) > 2 {
			url := matches[1]
			title := cleanHTMLEntities(matches[2])

			bookmarks = append(bookmarks, ImportedBookmark{
				URL:     url,
				Title:   title,
				AddedAt: time.Now(),
				Folder:  strings.Join(currentFolder, "/"),
			})
		}
	}

	return bookmarks, nil
}

// ImportBookmarks imports a list of bookmarks, handling duplicates
// It fetches metadata for each bookmark in the background
func (s *Service) ImportBookmarks(ctx context.Context, bookmarks []ImportedBookmark, defaultCollectionID *int64) (*ImportResult, error) {
	result := &ImportResult{
		Total: len(bookmarks),
	}

	// Collect IDs of newly created bookmarks for metadata fetching
	var createdIDs []int64

	for _, ib := range bookmarks {
		// Skip empty URLs
		if ib.URL == "" {
			result.Skipped++
			continue
		}

		// Check if bookmark already exists by URL
		existing, err := s.GetBookmarkByURL(ctx, ib.URL)
		if err == nil && existing != nil {
			// Update existing bookmark if title is empty
			if existing.Title == "" && ib.Title != "" {
				_, err := s.UpdateBookmark(ctx, existing.ID, models.UpdateBookmarkInput{
					URL:          existing.URL,
					Title:        ib.Title,
					Description:  existing.GetDescription(),
					CoverImage:   existing.GetCoverImage(),
					CollectionID: getInt64Ptr(existing.CollectionID),
					IsPublic:     existing.IsPublic,
					IsFavorite:   existing.IsFavorite,
				})
				if err != nil {
					result.Errors = append(result.Errors, "Failed to update: "+ib.URL)
				} else {
					result.Updated++
				}
			} else {
				result.Skipped++
			}
			continue
		}

		// Create new bookmark
		title := ib.Title
		if title == "" {
			title = ib.URL // Fallback to URL if no title
		}

		bookmark, err := s.CreateBookmark(ctx, models.CreateBookmarkInput{
			URL:          ib.URL,
			Title:        title,
			CollectionID: defaultCollectionID,
			IsPublic:     true,
			IsFavorite:   false,
		})
		if err != nil {
			result.Errors = append(result.Errors, "Failed to create: "+ib.URL)
		} else {
			result.Created++
			createdIDs = append(createdIDs, bookmark.ID)
		}
	}

	// Fetch metadata for newly created bookmarks in background
	if len(createdIDs) > 0 {
		go s.fetchMetadataForBookmarks(createdIDs)
	}

	return result, nil
}

// RefreshBookmarkMetadata re-fetches metadata for a single bookmark
func (s *Service) RefreshBookmarkMetadata(ctx context.Context, id int64) error {
	bookmark, err := s.GetBookmarkByID(ctx, id)
	if err != nil {
		return err
	}

	metadata, err := s.FetchPageMetadata(ctx, bookmark.URL)
	if err != nil {
		return err
	}

	input := models.UpdateBookmarkInput{
		URL:          bookmark.URL,
		Title:        bookmark.Title,
		Description:  bookmark.GetDescription(),
		CoverImage:   bookmark.GetCoverImage(),
		Favicon:      bookmark.GetFavicon(),
		CollectionID: getInt64Ptr(bookmark.CollectionID),
		IsPublic:     bookmark.IsPublic,
		IsFavorite:   bookmark.IsFavorite,
	}

	// Update with fetched data (overwrite if we got new data)
	if metadata.Title != "" {
		input.Title = metadata.Title
	}
	if metadata.Description != "" {
		input.Description = metadata.Description
	}
	if metadata.Image != "" {
		input.CoverImage = metadata.Image
	}
	if metadata.Favicon != "" {
		input.Favicon = metadata.Favicon
	}

	_, err = s.UpdateBookmark(ctx, id, input)
	return err
}

// RefreshAllMissingMetadataAsync refreshes metadata in background with progress callback
func (s *Service) RefreshAllMissingMetadataAsync(progressChan chan<- string) {
	go func() {
		defer close(progressChan)
		ctx := context.Background()

		// Get all bookmarks
		bookmarks, err := s.ListBookmarks(ctx, BookmarkListOptions{
			Limit:      1000,
			PublicOnly: false,
		})
		if err != nil {
			progressChan <- "error:Failed to list bookmarks"
			return
		}

		// Count bookmarks needing refresh
		var toRefresh []models.Bookmark
		for _, bookmark := range bookmarks {
			if bookmark.GetCoverImage() == "" {
				toRefresh = append(toRefresh, bookmark)
			}
		}

		total := len(toRefresh)
		if total == 0 {
			progressChan <- "done:0:0:All bookmarks already have cover images"
			return
		}

		progressChan <- fmt.Sprintf("start:%d", total)

		updated := 0
		failed := 0
		for i, bookmark := range toRefresh {
			err := s.RefreshBookmarkMetadata(ctx, bookmark.ID)
			if err != nil {
				failed++
			} else {
				updated++
			}
			progressChan <- fmt.Sprintf("progress:%d:%d:%s", i+1, total, bookmark.Title)
			time.Sleep(300 * time.Millisecond)
		}

		progressChan <- fmt.Sprintf("done:%d:%d:Completed", updated, failed)
	}()
}

// fetchMetadataForBookmarks fetches and updates metadata for a list of bookmark IDs
func (s *Service) fetchMetadataForBookmarks(ids []int64) {
	ctx := context.Background()

	for _, id := range ids {
		// Get the bookmark
		bookmark, err := s.GetBookmarkByID(ctx, id)
		if err != nil {
			continue
		}

		// Fetch metadata from URL
		metadata, err := s.FetchPageMetadata(ctx, bookmark.URL)
		if err != nil {
			continue
		}

		// Update bookmark with fetched metadata
		input := models.UpdateBookmarkInput{
			URL:          bookmark.URL,
			Title:        bookmark.Title,
			Description:  bookmark.GetDescription(),
			CoverImage:   bookmark.GetCoverImage(),
			Favicon:      bookmark.GetFavicon(),
			CollectionID: getInt64Ptr(bookmark.CollectionID),
			IsPublic:     bookmark.IsPublic,
			IsFavorite:   bookmark.IsFavorite,
		}

		// Only update if we got better data
		if metadata.Title != "" && bookmark.Title == bookmark.URL {
			input.Title = metadata.Title
		}
		if metadata.Description != "" && bookmark.GetDescription() == "" {
			input.Description = metadata.Description
		}
		if metadata.Image != "" && bookmark.GetCoverImage() == "" {
			input.CoverImage = metadata.Image
		}
		if metadata.Favicon != "" && bookmark.GetFavicon() == "" {
			input.Favicon = metadata.Favicon
		}

		s.UpdateBookmark(ctx, id, input)
	}
}

// GetBookmarkByURL finds a bookmark by its URL
func (s *Service) GetBookmarkByURL(ctx context.Context, url string) (*models.Bookmark, error) {
	bookmark, err := s.queries.GetBookmarkByURL(ctx, url)
	if err != nil {
		return nil, err
	}
	return dbBookmarkToModel(bookmark), nil
}

// Helper to parse Unix timestamp string
func parseUnixTimestamp(s string) (time.Time, error) {
	var ts int64
	for _, c := range s {
		if c >= '0' && c <= '9' {
			ts = ts*10 + int64(c-'0')
		}
	}
	return time.Unix(ts, 0), nil
}

// Helper to clean HTML entities
func cleanHTMLEntities(s string) string {
	s = strings.ReplaceAll(s, "&amp;", "&")
	s = strings.ReplaceAll(s, "&lt;", "<")
	s = strings.ReplaceAll(s, "&gt;", ">")
	s = strings.ReplaceAll(s, "&quot;", `"`)
	s = strings.ReplaceAll(s, "&#39;", "'")
	s = strings.ReplaceAll(s, "&apos;", "'")
	return strings.TrimSpace(s)
}

// Helper to get *int64 from sql.NullInt64
func getInt64Ptr(n struct {
	Int64 int64
	Valid bool
}) *int64 {
	if n.Valid {
		v := n.Int64
		return &v
	}
	return nil
}
