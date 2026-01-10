package service

import (
	"context"
	"database/sql"
	"time"

	"github.com/EC-9624/0xec.dev/internal/database/sqlc/db"
	"github.com/EC-9624/0xec.dev/internal/models"
)

// CreatePost creates a new post
func (s *Service) CreatePost(ctx context.Context, input models.CreatePostInput) (*models.Post, error) {
	var publishedAt *time.Time
	var isDraft int64 = 1
	if !input.IsDraft {
		isDraft = 0
		now := time.Now()
		publishedAt = &now
	}

	post, err := s.queries.CreatePost(ctx, db.CreatePostParams{
		Title:       input.Title,
		Slug:        input.Slug,
		Content:     input.Content,
		Excerpt:     strPtr(input.Excerpt),
		CoverImage:  strPtr(input.CoverImage),
		IsDraft:     &isDraft,
		PublishedAt: publishedAt,
	})
	if err != nil {
		return nil, err
	}

	// Add tags
	if len(input.TagIDs) > 0 {
		if err := s.setPostTags(ctx, post.ID, input.TagIDs); err != nil {
			return nil, err
		}
	}

	// Log activity
	s.LogActivity(ctx, ActionPostCreated, EntityPost, post.ID, input.Title, nil)

	return s.GetPostByID(ctx, post.ID)
}

// UpdatePost updates an existing post
func (s *Service) UpdatePost(ctx context.Context, id int64, input models.UpdatePostInput) (*models.Post, error) {
	post, err := s.GetPostByID(ctx, id)
	if err != nil {
		return nil, err
	}

	var publishedAt *time.Time
	var isDraft int64 = 1
	if !input.IsDraft {
		isDraft = 0
		if post.IsDraft {
			// Publishing for the first time
			now := time.Now()
			publishedAt = &now
		} else if post.PublishedAt.Valid {
			// Keep existing published date
			publishedAt = &post.PublishedAt.Time
		}
	}

	err = s.queries.UpdatePost(ctx, db.UpdatePostParams{
		Title:       input.Title,
		Slug:        input.Slug,
		Content:     input.Content,
		Excerpt:     strPtr(input.Excerpt),
		CoverImage:  strPtr(input.CoverImage),
		IsDraft:     &isDraft,
		PublishedAt: publishedAt,
		ID:          id,
	})
	if err != nil {
		return nil, err
	}

	// Update tags
	if err := s.setPostTags(ctx, id, input.TagIDs); err != nil {
		return nil, err
	}

	// Log activity - check if this is a publish action
	wasPublished := post.IsDraft && !input.IsDraft
	if wasPublished {
		s.LogActivity(ctx, ActionPostPublished, EntityPost, id, input.Title, nil)
	} else {
		s.LogActivity(ctx, ActionPostUpdated, EntityPost, id, input.Title, nil)
	}

	return s.GetPostByID(ctx, id)
}

// DeletePost deletes a post
func (s *Service) DeletePost(ctx context.Context, id int64) error {
	// Get post title for activity log before deleting
	post, _ := s.GetPostByID(ctx, id)
	title := ""
	if post != nil {
		title = post.Title
	}

	err := s.queries.DeletePost(ctx, id)
	if err != nil {
		return err
	}

	// Log activity
	s.LogActivity(ctx, ActionPostDeleted, EntityPost, id, title, nil)

	return nil
}

// GetPostByID retrieves a post by ID
func (s *Service) GetPostByID(ctx context.Context, id int64) (*models.Post, error) {
	post, err := s.queries.GetPostByID(ctx, id)
	if err != nil {
		return nil, err
	}

	tags, err := s.queries.GetPostTags(ctx, id)
	if err != nil {
		return nil, err
	}

	return dbPostToModel(post, tags), nil
}

// GetPostBySlug retrieves a post by slug
func (s *Service) GetPostBySlug(ctx context.Context, slug string) (*models.Post, error) {
	post, err := s.queries.GetPostBySlug(ctx, slug)
	if err != nil {
		return nil, err
	}

	tags, err := s.queries.GetPostTags(ctx, post.ID)
	if err != nil {
		return nil, err
	}

	return dbPostToModel(post, tags), nil
}

// ListPosts retrieves posts with optional filtering
func (s *Service) ListPosts(ctx context.Context, publishedOnly bool, limit, offset int) ([]models.Post, error) {
	var posts []db.Post
	var err error

	if publishedOnly {
		posts, err = s.queries.ListPublishedPosts(ctx, db.ListPublishedPostsParams{
			Limit:  int64(limit),
			Offset: int64(offset),
		})
	} else {
		posts, err = s.queries.ListAllPosts(ctx, db.ListAllPostsParams{
			Limit:  int64(limit),
			Offset: int64(offset),
		})
	}
	if err != nil {
		return nil, err
	}

	result := make([]models.Post, 0, len(posts))
	for _, p := range posts {
		tags, err := s.queries.GetPostTags(ctx, p.ID)
		if err != nil {
			return nil, err
		}
		result = append(result, *dbPostToModel(p, tags))
	}

	return result, nil
}

// CountPosts returns the total number of posts
func (s *Service) CountPosts(ctx context.Context, publishedOnly bool) (int, error) {
	var count int64
	var err error

	if publishedOnly {
		count, err = s.queries.CountPublishedPosts(ctx)
	} else {
		count, err = s.queries.CountAllPosts(ctx)
	}

	return int(count), err
}

// setPostTags replaces all tags for a post
func (s *Service) setPostTags(ctx context.Context, postID int64, tagIDs []int64) error {
	if err := s.queries.DeletePostTags(ctx, postID); err != nil {
		return err
	}

	for _, tagID := range tagIDs {
		if err := s.queries.AddPostTag(ctx, db.AddPostTagParams{
			PostID: postID,
			TagID:  tagID,
		}); err != nil {
			return err
		}
	}

	return nil
}

// Helper function to convert sqlc Post to domain model
func dbPostToModel(p db.Post, tags []db.Tag) *models.Post {
	post := &models.Post{
		ID:        p.ID,
		Title:     p.Title,
		Slug:      p.Slug,
		Content:   p.Content,
		IsDraft:   derefInt64(p.IsDraft) == 1,
		CreatedAt: derefTime(p.CreatedAt),
		UpdatedAt: derefTime(p.UpdatedAt),
	}

	if p.Excerpt != nil {
		post.Excerpt = sql.NullString{String: *p.Excerpt, Valid: true}
	}
	if p.CoverImage != nil {
		post.CoverImage = sql.NullString{String: *p.CoverImage, Valid: true}
	}
	if p.PublishedAt != nil {
		post.PublishedAt = sql.NullTime{Time: *p.PublishedAt, Valid: true}
	}

	post.Tags = make([]models.Tag, 0, len(tags))
	for _, t := range tags {
		post.Tags = append(post.Tags, *dbTagToModel(t))
	}

	return post
}

func strPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func derefInt64(p *int64) int64 {
	if p == nil {
		return 0
	}
	return *p
}
