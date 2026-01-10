package service

import (
	"context"
	"database/sql"
	"time"

	"github.com/EC-9624/0xec.dev/internal/database/sqlc/db"
	"github.com/EC-9624/0xec.dev/internal/models"
)

// CreateTag creates a new tag
func (s *Service) CreateTag(ctx context.Context, input models.CreateTagInput) (*models.Tag, error) {
	tag, err := s.queries.CreateTag(ctx, db.CreateTagParams{
		Name:  input.Name,
		Slug:  input.Slug,
		Color: strPtr(input.Color),
	})
	if err != nil {
		return nil, err
	}

	return dbTagToModel(tag), nil
}

// UpdateTag updates an existing tag
func (s *Service) UpdateTag(ctx context.Context, id int64, input models.CreateTagInput) (*models.Tag, error) {
	err := s.queries.UpdateTag(ctx, db.UpdateTagParams{
		Name:  input.Name,
		Slug:  input.Slug,
		Color: strPtr(input.Color),
		ID:    id,
	})
	if err != nil {
		return nil, err
	}

	return s.GetTagByID(ctx, id)
}

// DeleteTag deletes a tag
func (s *Service) DeleteTag(ctx context.Context, id int64) error {
	return s.queries.DeleteTag(ctx, id)
}

// GetTagByID retrieves a tag by ID
func (s *Service) GetTagByID(ctx context.Context, id int64) (*models.Tag, error) {
	tag, err := s.queries.GetTagByID(ctx, id)
	if err != nil {
		return nil, err
	}
	return dbTagToModel(tag), nil
}

// GetTagBySlug retrieves a tag by slug
func (s *Service) GetTagBySlug(ctx context.Context, slug string) (*models.Tag, error) {
	tag, err := s.queries.GetTagBySlug(ctx, slug)
	if err != nil {
		return nil, err
	}
	return dbTagToModel(tag), nil
}

// ListTags retrieves all tags
func (s *Service) ListTags(ctx context.Context) ([]models.Tag, error) {
	tags, err := s.queries.ListTags(ctx)
	if err != nil {
		return nil, err
	}

	result := make([]models.Tag, 0, len(tags))
	for _, t := range tags {
		result = append(result, *dbTagToModel(t))
	}

	return result, nil
}

// GetOrCreateTag gets a tag by name or creates it if it doesn't exist
func (s *Service) GetOrCreateTag(ctx context.Context, name, slug string) (*models.Tag, error) {
	tag, err := s.GetTagBySlug(ctx, slug)
	if err == sql.ErrNoRows {
		return s.CreateTag(ctx, models.CreateTagInput{
			Name:  name,
			Slug:  slug,
			Color: "",
		})
	}
	if err != nil {
		return nil, err
	}
	return tag, nil
}

// TagWithCount represents a tag with its usage count
type TagWithCount struct {
	models.Tag
	Count int `json:"count"`
}

// GetTagsWithCounts returns all tags with their usage counts
func (s *Service) GetTagsWithCounts(ctx context.Context) ([]TagWithCount, error) {
	tags, err := s.queries.ListTagsWithCounts(ctx)
	if err != nil {
		return nil, err
	}

	result := make([]TagWithCount, 0, len(tags))
	for _, t := range tags {
		result = append(result, TagWithCount{
			Tag: models.Tag{
				ID:        t.ID,
				Name:      t.Name,
				Slug:      t.Slug,
				Color:     toNullString(t.Color),
				CreatedAt: derefTime(t.CreatedAt),
			},
			Count: int(t.UsageCount),
		})
	}

	return result, nil
}

// Helper function to convert sqlc Tag to domain model
func dbTagToModel(t db.Tag) *models.Tag {
	return &models.Tag{
		ID:        t.ID,
		Name:      t.Name,
		Slug:      t.Slug,
		Color:     toNullString(t.Color),
		CreatedAt: derefTime(t.CreatedAt),
	}
}

func toNullString(s *string) sql.NullString {
	if s == nil {
		return sql.NullString{}
	}
	return sql.NullString{String: *s, Valid: true}
}

func toNullInt64(i *int64) sql.NullInt64 {
	if i == nil {
		return sql.NullInt64{}
	}
	return sql.NullInt64{Int64: *i, Valid: true}
}

func toNullTime(t *time.Time) sql.NullTime {
	if t == nil {
		return sql.NullTime{}
	}
	return sql.NullTime{Time: *t, Valid: true}
}
