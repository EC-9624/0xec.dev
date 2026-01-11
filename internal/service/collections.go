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
		// Convert to same type
		for _, r := range rows {
			collections = append(collections, db.ListAllCollectionsWithCountsRow{
				ID:            r.ID,
				Name:          r.Name,
				Slug:          r.Slug,
				Description:   r.Description,
				ParentID:      r.ParentID,
				SortOrder:     r.SortOrder,
				IsPublic:      r.IsPublic,
				CreatedAt:     r.CreatedAt,
				UpdatedAt:     r.UpdatedAt,
				BookmarkCount: r.BookmarkCount,
			})
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
	if c.ParentID != nil {
		collection.ParentID = sql.NullInt64{Int64: *c.ParentID, Valid: true}
	}

	return collection
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
	if c.ParentID != nil {
		collection.ParentID = sql.NullInt64{Int64: *c.ParentID, Valid: true}
	}

	return collection
}
