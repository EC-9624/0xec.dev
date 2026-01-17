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

	return dbBookmarkToModel(bookmark), nil
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
		result = append(result, *dbBookmarkToModel(b))
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

// Helper function to convert sqlc Bookmark to domain model
func dbBookmarkToModel(b db.Bookmark) *models.Bookmark {
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

// MoveBookmark moves a bookmark to a new position within a collection (or unsorted).
// collectionID: target collection (nil = unsorted column)
// afterBookmarkID: bookmark ID to insert after (nil = insert at the beginning)
func (s *Service) MoveBookmark(ctx context.Context, bookmarkID int64, collectionID *int64, afterBookmarkID *int64) error {
	const (
		defaultGap    = 1000
		minGap        = 1
		rebalanceGap  = 1000
		firstPosition = 1000
	)

	// Get all bookmark sort orders in the target column
	var sortOrders []struct {
		ID        int64
		SortOrder int64
	}

	if collectionID != nil {
		rows, err := s.queries.GetCollectionBookmarkSortOrders(ctx, collectionID)
		if err != nil {
			return err
		}
		for _, r := range rows {
			sortOrders = append(sortOrders, struct {
				ID        int64
				SortOrder int64
			}{ID: r.ID, SortOrder: r.SortOrder})
		}
	} else {
		rows, err := s.queries.GetUnsortedBookmarkSortOrders(ctx)
		if err != nil {
			return err
		}
		for _, r := range rows {
			sortOrders = append(sortOrders, struct {
				ID        int64
				SortOrder int64
			}{ID: r.ID, SortOrder: r.SortOrder})
		}
	}

	// Filter out the bookmark being moved (it might already be in this column)
	filtered := make([]struct {
		ID        int64
		SortOrder int64
	}, 0, len(sortOrders))
	for _, so := range sortOrders {
		if so.ID != bookmarkID {
			filtered = append(filtered, so)
		}
	}
	sortOrders = filtered

	// Calculate new sort_order based on position
	var newSortOrder int64

	if afterBookmarkID == nil {
		// Insert at the beginning
		if len(sortOrders) == 0 {
			newSortOrder = firstPosition
		} else {
			// Place before the first item
			firstOrder := sortOrders[0].SortOrder
			if firstOrder > minGap {
				newSortOrder = firstOrder / 2
			} else {
				// Need to rebalance - shift everything down
				newSortOrder = firstPosition
				if err := s.rebalanceBookmarks(ctx, collectionID, sortOrders, rebalanceGap, firstPosition+rebalanceGap); err != nil {
					return err
				}
			}
		}
	} else {
		// Find the position of afterBookmarkID
		afterIndex := -1
		for i, so := range sortOrders {
			if so.ID == *afterBookmarkID {
				afterIndex = i
				break
			}
		}

		if afterIndex == -1 {
			// afterBookmarkID not found in target column, insert at end
			if len(sortOrders) == 0 {
				newSortOrder = firstPosition
			} else {
				newSortOrder = sortOrders[len(sortOrders)-1].SortOrder + defaultGap
			}
		} else if afterIndex == len(sortOrders)-1 {
			// Insert at the end (after the last item)
			newSortOrder = sortOrders[afterIndex].SortOrder + defaultGap
		} else {
			// Insert between afterIndex and afterIndex+1
			prevOrder := sortOrders[afterIndex].SortOrder
			nextOrder := sortOrders[afterIndex+1].SortOrder
			gap := nextOrder - prevOrder

			if gap > minGap {
				newSortOrder = prevOrder + gap/2
			} else {
				// Need to rebalance
				newSortOrder = prevOrder + rebalanceGap/2
				if err := s.rebalanceBookmarks(ctx, collectionID, sortOrders, rebalanceGap, firstPosition); err != nil {
					return err
				}
				// Recalculate position after rebalance
				newSortOrder = int64(afterIndex+1)*rebalanceGap + rebalanceGap/2
			}
		}
	}

	// Update the bookmark's position
	return s.queries.UpdateBookmarkPosition(ctx, db.UpdateBookmarkPositionParams{
		CollectionID: collectionID,
		SortOrder:    &newSortOrder,
		ID:           bookmarkID,
	})
}

// rebalanceBookmarks reassigns sort_order values with consistent gaps
func (s *Service) rebalanceBookmarks(ctx context.Context, collectionID *int64, sortOrders []struct {
	ID        int64
	SortOrder int64
}, gap int64, startAt int64) error {
	for i, so := range sortOrders {
		newOrder := startAt + int64(i)*gap
		err := s.queries.UpdateBookmarkPosition(ctx, db.UpdateBookmarkPositionParams{
			CollectionID: collectionID,
			SortOrder:    &newOrder,
			ID:           so.ID,
		})
		if err != nil {
			return err
		}
	}
	return nil
}

// BulkMoveBookmarks moves multiple bookmarks to a collection with position support.
// collectionID: target collection (nil = unsorted column)
// afterBookmarkID: bookmark ID to insert after (nil = insert at the beginning)
// Bookmarks are inserted in the order provided, maintaining their relative positions.
func (s *Service) BulkMoveBookmarks(ctx context.Context, bookmarkIDs []int64, collectionID *int64, afterBookmarkID *int64) error {
	if len(bookmarkIDs) == 0 {
		return nil
	}

	const (
		defaultGap    = 1000
		minGap        = 1
		rebalanceGap  = 1000
		firstPosition = 1000
	)

	// Get all bookmark sort orders in the target column (excluding the ones we're moving)
	var sortOrders []struct {
		ID        int64
		SortOrder int64
	}

	if collectionID != nil {
		rows, err := s.queries.GetCollectionBookmarkSortOrders(ctx, collectionID)
		if err != nil {
			return err
		}
		for _, r := range rows {
			sortOrders = append(sortOrders, struct {
				ID        int64
				SortOrder int64
			}{ID: r.ID, SortOrder: r.SortOrder})
		}
	} else {
		rows, err := s.queries.GetUnsortedBookmarkSortOrders(ctx)
		if err != nil {
			return err
		}
		for _, r := range rows {
			sortOrders = append(sortOrders, struct {
				ID        int64
				SortOrder int64
			}{ID: r.ID, SortOrder: r.SortOrder})
		}
	}

	// Create a set of bookmark IDs we're moving for fast lookup
	movingSet := make(map[int64]bool)
	for _, id := range bookmarkIDs {
		movingSet[id] = true
	}

	// Filter out the bookmarks being moved
	filtered := make([]struct {
		ID        int64
		SortOrder int64
	}, 0, len(sortOrders))
	for _, so := range sortOrders {
		if !movingSet[so.ID] {
			filtered = append(filtered, so)
		}
	}
	sortOrders = filtered

	// Calculate starting sort_order based on afterBookmarkID
	var startSortOrder int64

	if afterBookmarkID == nil {
		// Insert at the beginning
		if len(sortOrders) == 0 {
			startSortOrder = firstPosition
		} else {
			firstOrder := sortOrders[0].SortOrder
			// Need enough room for all bookmarks
			neededSpace := int64(len(bookmarkIDs)) * defaultGap
			if firstOrder > neededSpace {
				startSortOrder = firstOrder - neededSpace
			} else {
				// Rebalance existing bookmarks to make room
				startSortOrder = firstPosition
				startOffset := firstPosition + int64(len(bookmarkIDs))*defaultGap
				if err := s.rebalanceBookmarks(ctx, collectionID, sortOrders, rebalanceGap, startOffset); err != nil {
					return err
				}
			}
		}
	} else {
		// Find the position of afterBookmarkID
		afterIndex := -1
		for i, so := range sortOrders {
			if so.ID == *afterBookmarkID {
				afterIndex = i
				break
			}
		}

		if afterIndex == -1 {
			// afterBookmarkID not found, insert at end
			if len(sortOrders) == 0 {
				startSortOrder = firstPosition
			} else {
				startSortOrder = sortOrders[len(sortOrders)-1].SortOrder + defaultGap
			}
		} else if afterIndex == len(sortOrders)-1 {
			// Insert after the last item
			startSortOrder = sortOrders[afterIndex].SortOrder + defaultGap
		} else {
			// Insert between afterIndex and afterIndex+1
			prevOrder := sortOrders[afterIndex].SortOrder
			nextOrder := sortOrders[afterIndex+1].SortOrder
			gap := nextOrder - prevOrder
			neededSpace := int64(len(bookmarkIDs)) * minGap

			if gap > neededSpace {
				// Enough space, distribute evenly
				startSortOrder = prevOrder + gap/int64(len(bookmarkIDs)+1)
			} else {
				// Need to rebalance
				startSortOrder = prevOrder + defaultGap
				// Rebalance items after the insertion point
				itemsToRebalance := sortOrders[afterIndex+1:]
				startOffset := startSortOrder + int64(len(bookmarkIDs))*defaultGap
				if err := s.rebalanceBookmarks(ctx, collectionID, itemsToRebalance, rebalanceGap, startOffset); err != nil {
					return err
				}
			}
		}
	}

	// Update each bookmark with new collection and sort_order
	for i, id := range bookmarkIDs {
		sortOrder := startSortOrder + int64(i)*defaultGap
		err := s.queries.UpdateBookmarkPosition(ctx, db.UpdateBookmarkPositionParams{
			CollectionID: collectionID,
			SortOrder:    &sortOrder,
			ID:           id,
		})
		if err != nil {
			return err
		}
	}

	// Log activity for bulk move
	count := len(bookmarkIDs)
	s.LogActivity(ctx, ActionBookmarkUpdated, EntityBookmark, 0, "", map[string]interface{}{
		"action":       "bulk_move",
		"count":        count,
		"bookmark_ids": bookmarkIDs,
	})

	return nil
}

// BulkDeleteBookmarks deletes multiple bookmarks
func (s *Service) BulkDeleteBookmarks(ctx context.Context, bookmarkIDs []int64) error {
	for _, id := range bookmarkIDs {
		err := s.queries.DeleteBookmark(ctx, id)
		if err != nil {
			return err
		}
	}

	// Log activity for bulk delete
	count := len(bookmarkIDs)
	s.LogActivity(ctx, ActionBookmarkDeleted, EntityBookmark, 0, "", map[string]interface{}{
		"action":       "bulk_delete",
		"count":        count,
		"bookmark_ids": bookmarkIDs,
	})

	return nil
}

// ListUnsortedBookmarks retrieves bookmarks without a collection
func (s *Service) ListUnsortedBookmarks(ctx context.Context, limit, offset int) ([]models.Bookmark, error) {
	bookmarks, err := s.queries.ListUnsortedBookmarks(ctx, db.ListUnsortedBookmarksParams{
		Limit:  int64(limit),
		Offset: int64(offset),
	})
	if err != nil {
		return nil, err
	}

	result := make([]models.Bookmark, 0, len(bookmarks))
	for _, b := range bookmarks {
		result = append(result, *dbBookmarkToModel(b))
	}

	return result, nil
}
