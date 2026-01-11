package service

import (
	"context"
	"database/sql"
	"net/url"

	"github.com/EC-9624/0xec.dev/internal/database/sqlc/db"
	"github.com/EC-9624/0xec.dev/internal/models"
)

// BookmarkListOptions contains options for listing bookmarks
type BookmarkListOptions struct {
	PublicOnly    bool
	CollectionID  *int64
	FavoritesOnly bool
	Limit         int
	Offset        int
}

// CreateBookmark creates a new bookmark
func (s *Service) CreateBookmark(ctx context.Context, input models.CreateBookmarkInput) (*models.Bookmark, error) {
	domain := extractDomain(input.URL)

	var isPublic int64 = 0
	if input.IsPublic {
		isPublic = 1
	}
	var isFavorite int64 = 0
	if input.IsFavorite {
		isFavorite = 1
	}

	bookmark, err := s.queries.CreateBookmark(ctx, db.CreateBookmarkParams{
		Url:          input.URL,
		Title:        input.Title,
		Description:  strPtr(input.Description),
		Excerpt:      nil,
		CoverImage:   strPtr(input.CoverImage),
		Favicon:      strPtr(input.Favicon),
		Domain:       strPtr(domain),
		CollectionID: input.CollectionID,
		IsPublic:     &isPublic,
		IsFavorite:   &isFavorite,
		SortOrder:    nil,
	})
	if err != nil {
		return nil, err
	}

	// Add tags
	if len(input.TagIDs) > 0 {
		if err := s.setBookmarkTags(ctx, bookmark.ID, input.TagIDs); err != nil {
			return nil, err
		}
	}

	// Log activity
	s.LogActivity(ctx, ActionBookmarkCreated, EntityBookmark, bookmark.ID, input.Title, nil)

	return s.GetBookmarkByID(ctx, bookmark.ID)
}

// UpdateBookmark updates an existing bookmark
func (s *Service) UpdateBookmark(ctx context.Context, id int64, input models.UpdateBookmarkInput) (*models.Bookmark, error) {
	domain := extractDomain(input.URL)

	var isPublic int64 = 0
	if input.IsPublic {
		isPublic = 1
	}
	var isFavorite int64 = 0
	if input.IsFavorite {
		isFavorite = 1
	}

	err := s.queries.UpdateBookmark(ctx, db.UpdateBookmarkParams{
		Url:          input.URL,
		Title:        input.Title,
		Description:  strPtr(input.Description),
		CoverImage:   strPtr(input.CoverImage),
		Favicon:      strPtr(input.Favicon),
		Domain:       strPtr(domain),
		CollectionID: input.CollectionID,
		IsPublic:     &isPublic,
		IsFavorite:   &isFavorite,
		ID:           id,
	})
	if err != nil {
		return nil, err
	}

	// Update tags
	if err := s.setBookmarkTags(ctx, id, input.TagIDs); err != nil {
		return nil, err
	}

	// Log activity
	s.LogActivity(ctx, ActionBookmarkUpdated, EntityBookmark, id, input.Title, nil)

	return s.GetBookmarkByID(ctx, id)
}

// DeleteBookmark deletes a bookmark
func (s *Service) DeleteBookmark(ctx context.Context, id int64) error {
	// Get bookmark title for activity log before deleting
	bookmark, _ := s.GetBookmarkByID(ctx, id)
	title := ""
	if bookmark != nil {
		title = bookmark.Title
	}

	err := s.queries.DeleteBookmark(ctx, id)
	if err != nil {
		return err
	}

	// Log activity
	s.LogActivity(ctx, ActionBookmarkDeleted, EntityBookmark, id, title, nil)

	return nil
}

// GetBookmarkByID retrieves a bookmark by ID
func (s *Service) GetBookmarkByID(ctx context.Context, id int64) (*models.Bookmark, error) {
	bookmark, err := s.queries.GetBookmarkByID(ctx, id)
	if err != nil {
		return nil, err
	}

	tags, err := s.queries.GetBookmarkTags(ctx, id)
	if err != nil {
		return nil, err
	}

	return dbBookmarkToModel(bookmark, tags), nil
}

// ListBookmarks retrieves bookmarks with optional filtering
func (s *Service) ListBookmarks(ctx context.Context, opts BookmarkListOptions) ([]models.Bookmark, error) {
	var bookmarks []db.Bookmark
	var err error

	limit := int64(opts.Limit)
	offset := int64(opts.Offset)

	// Handle different filter combinations
	if opts.FavoritesOnly {
		if opts.PublicOnly {
			bookmarks, err = s.queries.ListPublicFavoriteBookmarks(ctx, db.ListPublicFavoriteBookmarksParams{
				Limit:  limit,
				Offset: offset,
			})
		} else {
			bookmarks, err = s.queries.ListFavoriteBookmarks(ctx, db.ListFavoriteBookmarksParams{
				Limit:  limit,
				Offset: offset,
			})
		}
	} else if opts.CollectionID != nil {
		if opts.PublicOnly {
			bookmarks, err = s.queries.ListPublicBookmarksByCollection(ctx, db.ListPublicBookmarksByCollectionParams{
				CollectionID: opts.CollectionID,
				Limit:        limit,
				Offset:       offset,
			})
		} else {
			bookmarks, err = s.queries.ListBookmarksByCollection(ctx, db.ListBookmarksByCollectionParams{
				CollectionID: opts.CollectionID,
				Limit:        limit,
				Offset:       offset,
			})
		}
	} else {
		if opts.PublicOnly {
			bookmarks, err = s.queries.ListPublicBookmarks(ctx, db.ListPublicBookmarksParams{
				Limit:  limit,
				Offset: offset,
			})
		} else {
			bookmarks, err = s.queries.ListAllBookmarks(ctx, db.ListAllBookmarksParams{
				Limit:  limit,
				Offset: offset,
			})
		}
	}

	if err != nil {
		return nil, err
	}

	result := make([]models.Bookmark, 0, len(bookmarks))
	for _, b := range bookmarks {
		tags, err := s.queries.GetBookmarkTags(ctx, b.ID)
		if err != nil {
			return nil, err
		}
		result = append(result, *dbBookmarkToModel(b, tags))
	}

	return result, nil
}

// CountBookmarks returns the total number of bookmarks
func (s *Service) CountBookmarks(ctx context.Context, opts BookmarkListOptions) (int, error) {
	var count int64
	var err error

	if opts.FavoritesOnly {
		if opts.PublicOnly {
			count, err = s.queries.CountPublicFavoriteBookmarks(ctx)
		} else {
			count, err = s.queries.CountFavoriteBookmarks(ctx)
		}
	} else if opts.CollectionID != nil {
		if opts.PublicOnly {
			count, err = s.queries.CountPublicBookmarksByCollection(ctx, opts.CollectionID)
		} else {
			count, err = s.queries.CountBookmarksByCollection(ctx, opts.CollectionID)
		}
	} else {
		if opts.PublicOnly {
			count, err = s.queries.CountPublicBookmarks(ctx)
		} else {
			count, err = s.queries.CountAllBookmarks(ctx)
		}
	}

	return int(count), err
}

// setBookmarkTags replaces all tags for a bookmark
func (s *Service) setBookmarkTags(ctx context.Context, bookmarkID int64, tagIDs []int64) error {
	if err := s.queries.DeleteBookmarkTags(ctx, bookmarkID); err != nil {
		return err
	}

	for _, tagID := range tagIDs {
		if err := s.queries.AddBookmarkTag(ctx, db.AddBookmarkTagParams{
			BookmarkID: bookmarkID,
			TagID:      tagID,
		}); err != nil {
			return err
		}
	}

	return nil
}

// Helper function to convert sqlc Bookmark to domain model
func dbBookmarkToModel(b db.Bookmark, tags []db.Tag) *models.Bookmark {
	bookmark := &models.Bookmark{
		ID:         b.ID,
		URL:        b.Url,
		Title:      b.Title,
		IsPublic:   derefInt64(b.IsPublic) == 1,
		IsFavorite: derefInt64(b.IsFavorite) == 1,
		SortOrder:  int(derefInt64(b.SortOrder)),
		CreatedAt:  derefTime(b.CreatedAt),
		UpdatedAt:  derefTime(b.UpdatedAt),
	}

	if b.Description != nil {
		bookmark.Description = sql.NullString{String: *b.Description, Valid: true}
	}
	if b.Excerpt != nil {
		bookmark.Excerpt = sql.NullString{String: *b.Excerpt, Valid: true}
	}
	if b.CoverImage != nil {
		bookmark.CoverImage = sql.NullString{String: *b.CoverImage, Valid: true}
	}
	if b.Favicon != nil {
		bookmark.Favicon = sql.NullString{String: *b.Favicon, Valid: true}
	}
	if b.Domain != nil {
		bookmark.Domain = sql.NullString{String: *b.Domain, Valid: true}
	}
	if b.CollectionID != nil {
		bookmark.CollectionID = sql.NullInt64{Int64: *b.CollectionID, Valid: true}
	}

	bookmark.Tags = make([]models.Tag, 0, len(tags))
	for _, t := range tags {
		bookmark.Tags = append(bookmark.Tags, *dbTagToModel(t))
	}

	return bookmark
}

// extractDomain extracts the domain from a URL
func extractDomain(rawURL string) string {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return ""
	}
	return parsed.Host
}

// ============================================
// INLINE EDITING METHODS
// ============================================

// UpdateBookmarkPublic updates only the public status of a bookmark
func (s *Service) UpdateBookmarkPublic(ctx context.Context, id int64, isPublic bool) error {
	var val int64 = 0
	if isPublic {
		val = 1
	}
	return s.queries.UpdateBookmarkPublic(ctx, db.UpdateBookmarkPublicParams{
		IsPublic: &val,
		ID:       id,
	})
}

// UpdateBookmarkFavorite updates only the favorite status of a bookmark
func (s *Service) UpdateBookmarkFavorite(ctx context.Context, id int64, isFavorite bool) error {
	var val int64 = 0
	if isFavorite {
		val = 1
	}
	return s.queries.UpdateBookmarkFavorite(ctx, db.UpdateBookmarkFavoriteParams{
		IsFavorite: &val,
		ID:         id,
	})
}

// UpdateBookmarkCollection updates only the collection of a bookmark
func (s *Service) UpdateBookmarkCollection(ctx context.Context, id int64, collectionID *int64) error {
	return s.queries.UpdateBookmarkCollection(ctx, db.UpdateBookmarkCollectionParams{
		CollectionID: collectionID,
		ID:           id,
	})
}

// UpdateBookmarkTitle updates only the title of a bookmark
func (s *Service) UpdateBookmarkTitle(ctx context.Context, id int64, title string) error {
	return s.queries.UpdateBookmarkTitle(ctx, db.UpdateBookmarkTitleParams{
		Title: title,
		ID:    id,
	})
}
