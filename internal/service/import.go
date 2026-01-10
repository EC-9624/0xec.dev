package service

import (
	"context"
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
func (s *Service) ImportBookmarks(ctx context.Context, bookmarks []ImportedBookmark, defaultCollectionID *int64) (*ImportResult, error) {
	result := &ImportResult{
		Total: len(bookmarks),
	}

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

		_, err = s.CreateBookmark(ctx, models.CreateBookmarkInput{
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
		}
	}

	return result, nil
}

// GetBookmarkByURL finds a bookmark by its URL
func (s *Service) GetBookmarkByURL(ctx context.Context, url string) (*models.Bookmark, error) {
	bookmark, err := s.queries.GetBookmarkByURL(ctx, url)
	if err != nil {
		return nil, err
	}
	return dbBookmarkToModel(bookmark, nil), nil
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
