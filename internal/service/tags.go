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
		Name: input.Name,
		Slug: input.Slug,
	})
	if err != nil {
		return nil, err
	}

	return dbTagToModel(tag), nil
}

// UpdateTag updates an existing tag
func (s *Service) UpdateTag(ctx context.Context, id int64, input models.CreateTagInput) (*models.Tag, error) {
	err := s.queries.UpdateTag(ctx, db.UpdateTagParams{
		Name: input.Name,
		Slug: input.Slug,
		ID:   id,
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
			Name: name,
			Slug: slug,
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
				CreatedAt: derefTime(t.CreatedAt),
			},
			Count: int(t.UsageCount),
		})
	}

	return result, nil
}

// TagPost represents a minimal post for tag listings
type TagPost struct {
	ID          int64
	Title       string
	Slug        string
	IsDraft     bool
	PublishedAt sql.NullTime
	CreatedAt   time.Time
}

// GetPostsByTagID returns all posts that have a specific tag
func (s *Service) GetPostsByTagID(ctx context.Context, tagID int64) ([]TagPost, error) {
	rows, err := s.queries.GetPostsByTagID(ctx, tagID)
	if err != nil {
		return nil, err
	}

	result := make([]TagPost, 0, len(rows))
	for _, r := range rows {
		post := TagPost{
			ID:    r.ID,
			Title: r.Title,
			Slug:  r.Slug,
		}
		// Handle nullable fields
		if r.IsDraft != nil {
			post.IsDraft = *r.IsDraft == 1
		}
		if r.PublishedAt != nil {
			post.PublishedAt = sql.NullTime{Time: *r.PublishedAt, Valid: true}
		}
		if r.CreatedAt != nil {
			post.CreatedAt = *r.CreatedAt
		}
		result = append(result, post)
	}

	return result, nil
}

// Helper function to convert sqlc Tag to domain model
func dbTagToModel(t db.Tag) *models.Tag {
	return &models.Tag{
		ID:        t.ID,
		Name:      t.Name,
		Slug:      t.Slug,
		CreatedAt: derefTime(t.CreatedAt),
	}
}
