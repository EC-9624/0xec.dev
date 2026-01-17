package service

import (
	"context"
	"database/sql"

	"github.com/EC-9624/0xec.dev/internal/database/sqlc/db"
	"github.com/EC-9624/0xec.dev/internal/models"
)

// CreateCollection creates a new collection
func (s *Service) CreateCollection(ctx context.Context, input models.CreateCollectionInput) (*models.Collection, error) {
	var isPublic int64 = 0
	if input.IsPublic {
		isPublic = 1
	}

	collection, err := s.queries.CreateCollection(ctx, db.CreateCollectionParams{
		Name:        input.Name,
		Slug:        input.Slug,
		Description: strPtr(input.Description),
		Color:       strPtr(input.Color),
		ParentID:    input.ParentID,
		SortOrder:   nil,
		IsPublic:    &isPublic,
	})
	if err != nil {
		return nil, err
	}

	// Log activity
	s.LogActivity(ctx, ActionCollectionCreated, EntityCollection, collection.ID, input.Name, nil)

	return s.GetCollectionByID(ctx, collection.ID)
}

// UpdateCollection updates an existing collection
func (s *Service) UpdateCollection(ctx context.Context, id int64, input models.UpdateCollectionInput) (*models.Collection, error) {
	var isPublic int64 = 0
	if input.IsPublic {
		isPublic = 1
	}
	sortOrder := int64(input.SortOrder)

	err := s.queries.UpdateCollection(ctx, db.UpdateCollectionParams{
		Name:        input.Name,
		Slug:        input.Slug,
		Description: strPtr(input.Description),
		Color:       strPtr(input.Color),
		ParentID:    input.ParentID,
		SortOrder:   &sortOrder,
		IsPublic:    &isPublic,
		ID:          id,
	})
	if err != nil {
		return nil, err
	}

	// Log activity
	s.LogActivity(ctx, ActionCollectionUpdated, EntityCollection, id, input.Name, nil)

	return s.GetCollectionByID(ctx, id)
}

// DeleteCollection deletes a collection
func (s *Service) DeleteCollection(ctx context.Context, id int64) error {
	// Get collection name for activity log before deleting
	collection, _ := s.GetCollectionByID(ctx, id)
	name := ""
	if collection != nil {
		name = collection.Name
	}

	err := s.queries.DeleteCollection(ctx, id)
	if err != nil {
		return err
	}

	// Log activity
	s.LogActivity(ctx, ActionCollectionDeleted, EntityCollection, id, name, nil)

	return nil
}

// GetCollectionByID retrieves a collection by ID
func (s *Service) GetCollectionByID(ctx context.Context, id int64) (*models.Collection, error) {
	collection, err := s.queries.GetCollectionByID(ctx, id)
	if err != nil {
		return nil, err
	}

	count, err := s.queries.GetCollectionBookmarkCount(ctx, &id)
	if err != nil {
		return nil, err
	}

	return dbCollectionToModel(collection, int(count)), nil
}

// GetCollectionBySlug retrieves a collection by slug
func (s *Service) GetCollectionBySlug(ctx context.Context, slug string) (*models.Collection, error) {
	collection, err := s.queries.GetCollectionBySlug(ctx, slug)
	if err != nil {
		return nil, err
	}

	count, err := s.queries.GetCollectionBookmarkCount(ctx, &collection.ID)
	if err != nil {
		return nil, err
	}

	return dbCollectionToModel(collection, int(count)), nil
}

// ListCollections retrieves all collections with bookmark counts
func (s *Service) ListCollections(ctx context.Context, publicOnly bool) ([]models.Collection, error) {
	var collections []db.ListAllCollectionsWithCountsRow
	var err error

	if publicOnly {
		rows, e := s.queries.ListPublicCollectionsWithCounts(ctx)
		err = e
		// Convert to same type (structs have identical fields)
		for _, r := range rows {
			collections = append(collections, db.ListAllCollectionsWithCountsRow(r))
		}
	} else {
		collections, err = s.queries.ListAllCollectionsWithCounts(ctx)
	}

	if err != nil {
		return nil, err
	}

	result := make([]models.Collection, 0, len(collections))
	for _, c := range collections {
		result = append(result, *dbCollectionRowToModel(c))
	}

	return result, nil
}

// Helper function to convert sqlc Collection to domain model
func dbCollectionToModel(c db.Collection, bookmarkCount int) *models.Collection {
	collection := &models.Collection{
		ID:            c.ID,
		Name:          c.Name,
		Slug:          c.Slug,
		SortOrder:     int(derefInt64(c.SortOrder)),
		IsPublic:      derefInt64(c.IsPublic) == 1,
		CreatedAt:     derefTime(c.CreatedAt),
		UpdatedAt:     derefTime(c.UpdatedAt),
		BookmarkCount: bookmarkCount,
	}

	if c.Description != nil {
		collection.Description = sql.NullString{String: *c.Description, Valid: true}
	}
	if c.Color != nil {
		collection.Color = sql.NullString{String: *c.Color, Valid: true}
	}
	if c.ParentID != nil {
		collection.ParentID = sql.NullInt64{Int64: *c.ParentID, Valid: true}
	}

	return collection
}

// ============================================
// INLINE EDITING METHODS
// ============================================

// UpdateCollectionName updates only the name of a collection
func (s *Service) UpdateCollectionName(ctx context.Context, id int64, name string) error {
	err := s.queries.UpdateCollectionName(ctx, db.UpdateCollectionNameParams{
		Name: name,
		ID:   id,
	})
	if err != nil {
		return err
	}

	// Log activity
	s.LogActivity(ctx, ActionCollectionUpdated, EntityCollection, id, name, nil)

	return nil
}

// UpdateCollectionPublic updates only the public status of a collection
func (s *Service) UpdateCollectionPublic(ctx context.Context, id int64, isPublic bool) error {
	var val int64 = 0
	if isPublic {
		val = 1
	}

	err := s.queries.UpdateCollectionPublic(ctx, db.UpdateCollectionPublicParams{
		IsPublic: &val,
		ID:       id,
	})
	if err != nil {
		return err
	}

	return nil
}

// CollectionBookmark represents a minimal bookmark for collection preview
type CollectionBookmark struct {
	ID         int64
	Title      string
	URL        string
	Domain     string
	IsPublic   bool
	IsFavorite bool
}

// GetBookmarksByCollectionID returns bookmarks for a collection (limited to 6 for preview)
func (s *Service) GetBookmarksByCollectionID(ctx context.Context, collectionID int64) ([]CollectionBookmark, error) {
	rows, err := s.queries.GetBookmarksByCollectionID(ctx, &collectionID)
	if err != nil {
		return nil, err
	}

	result := make([]CollectionBookmark, 0, len(rows))
	for _, r := range rows {
		bookmark := CollectionBookmark{
			ID:    r.ID,
			Title: r.Title,
			URL:   r.Url,
		}
		if r.Domain != nil {
			bookmark.Domain = *r.Domain
		}
		if r.IsPublic != nil {
			bookmark.IsPublic = *r.IsPublic == 1
		}
		if r.IsFavorite != nil {
			bookmark.IsFavorite = *r.IsFavorite == 1
		}
		result = append(result, bookmark)
	}

	return result, nil
}

// ============================================
// BOARD VIEW METHODS
// ============================================

// RecentBookmark represents a minimal bookmark for board view preview
type RecentBookmark struct {
	ID         int64
	Title      string
	URL        string
	Domain     string
	IsFavorite bool
	IsPublic   bool
}

// CollectionWithRecent represents a collection with its recent bookmarks for board view
type CollectionWithRecent struct {
	Collection      models.Collection
	RecentBookmarks []RecentBookmark
}

// UnsortedInfo represents the "unsorted" pseudo-collection for board view
type UnsortedInfo struct {
	Count           int
	RecentBookmarks []RecentBookmark
}

// BoardViewData contains all data needed for the bookmarks board view
type BoardViewData struct {
	Collections []CollectionWithRecent
	Unsorted    UnsortedInfo
}

// GetBoardViewData retrieves all data needed for the board view
func (s *Service) GetBoardViewData(ctx context.Context, recentLimit int) (*BoardViewData, error) {
	// Get all collections with counts
	collections, err := s.ListCollections(ctx, false)
	if err != nil {
		return nil, err
	}

	// Build collections with recent bookmarks
	collectionsWithRecent := make([]CollectionWithRecent, 0, len(collections))
	for _, c := range collections {
		recent, err := s.GetRecentBookmarksByCollectionID(ctx, c.ID, recentLimit)
		if err != nil {
			// Continue with empty recent on error
			recent = []RecentBookmark{}
		}
		collectionsWithRecent = append(collectionsWithRecent, CollectionWithRecent{
			Collection:      c,
			RecentBookmarks: recent,
		})
	}

	// Get unsorted info
	unsortedCount, err := s.queries.CountUnsortedBookmarks(ctx)
	if err != nil {
		unsortedCount = 0
	}

	unsortedRecent, err := s.GetRecentUnsortedBookmarks(ctx, recentLimit)
	if err != nil {
		unsortedRecent = []RecentBookmark{}
	}

	return &BoardViewData{
		Collections: collectionsWithRecent,
		Unsorted: UnsortedInfo{
			Count:           int(unsortedCount),
			RecentBookmarks: unsortedRecent,
		},
	}, nil
}

// GetRecentBookmarksByCollectionID returns recent bookmarks for a collection
func (s *Service) GetRecentBookmarksByCollectionID(ctx context.Context, collectionID int64, limit int) ([]RecentBookmark, error) {
	rows, err := s.queries.GetRecentBookmarksByCollectionID(ctx, db.GetRecentBookmarksByCollectionIDParams{
		CollectionID: &collectionID,
		Limit:        int64(limit),
	})
	if err != nil {
		return nil, err
	}

	result := make([]RecentBookmark, 0, len(rows))
	for _, r := range rows {
		bookmark := RecentBookmark{
			ID:    r.ID,
			Title: r.Title,
			URL:   r.Url,
		}
		if r.Domain != nil {
			bookmark.Domain = *r.Domain
		}
		if r.IsFavorite != nil {
			bookmark.IsFavorite = *r.IsFavorite == 1
		}
		if r.IsPublic != nil {
			bookmark.IsPublic = *r.IsPublic == 1
		}
		result = append(result, bookmark)
	}

	return result, nil
}

// GetRecentUnsortedBookmarks returns recent bookmarks without a collection
func (s *Service) GetRecentUnsortedBookmarks(ctx context.Context, limit int) ([]RecentBookmark, error) {
	rows, err := s.queries.ListRecentUnsortedBookmarks(ctx, int64(limit))
	if err != nil {
		return nil, err
	}

	result := make([]RecentBookmark, 0, len(rows))
	for _, r := range rows {
		bookmark := RecentBookmark{
			ID:    r.ID,
			Title: r.Title,
			URL:   r.Url,
		}
		if r.Domain != nil {
			bookmark.Domain = *r.Domain
		}
		if r.IsFavorite != nil {
			bookmark.IsFavorite = *r.IsFavorite == 1
		}
		if r.IsPublic != nil {
			bookmark.IsPublic = *r.IsPublic == 1
		}
		result = append(result, bookmark)
	}

	return result, nil
}

// Helper function to convert sqlc ListAllCollectionsWithCountsRow to domain model
func dbCollectionRowToModel(c db.ListAllCollectionsWithCountsRow) *models.Collection {
	collection := &models.Collection{
		ID:            c.ID,
		Name:          c.Name,
		Slug:          c.Slug,
		SortOrder:     int(derefInt64(c.SortOrder)),
		IsPublic:      derefInt64(c.IsPublic) == 1,
		CreatedAt:     derefTime(c.CreatedAt),
		UpdatedAt:     derefTime(c.UpdatedAt),
		BookmarkCount: int(c.BookmarkCount),
	}

	if c.Description != nil {
		collection.Description = sql.NullString{String: *c.Description, Valid: true}
	}
	if c.Color != nil {
		collection.Color = sql.NullString{String: *c.Color, Valid: true}
	}
	if c.ParentID != nil {
		collection.ParentID = sql.NullInt64{Int64: *c.ParentID, Valid: true}
	}

	return collection
}
