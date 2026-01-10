package repository

import (
	"database/sql"
	"time"

	"github.com/EC-9624/0xec.dev/internal/models"
)

// PostRepository handles post database operations
type PostRepository struct {
	db *sql.DB
}

// NewPostRepository creates a new PostRepository
func NewPostRepository(db *sql.DB) *PostRepository {
	return &PostRepository{db: db}
}

// Create creates a new post
func (r *PostRepository) Create(input models.CreatePostInput) (*models.Post, error) {
	now := time.Now()
	var publishedAt sql.NullTime
	if !input.IsDraft {
		publishedAt = sql.NullTime{Time: now, Valid: true}
	}

	result, err := r.db.Exec(
		`INSERT INTO posts (title, slug, content, excerpt, cover_image, is_draft, published_at, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		input.Title, input.Slug, input.Content,
		nullString(input.Excerpt), nullString(input.CoverImage),
		input.IsDraft, publishedAt, now, now,
	)
	if err != nil {
		return nil, err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}

	// Add tags
	if len(input.TagIDs) > 0 {
		if err := r.setTags(id, input.TagIDs); err != nil {
			return nil, err
		}
	}

	return r.GetByID(id)
}

// Update updates an existing post
func (r *PostRepository) Update(id int64, input models.UpdatePostInput) (*models.Post, error) {
	post, err := r.GetByID(id)
	if err != nil {
		return nil, err
	}

	var publishedAt sql.NullTime
	if !input.IsDraft && post.IsDraft {
		// Publishing for the first time
		publishedAt = sql.NullTime{Time: time.Now(), Valid: true}
	} else if !input.IsDraft {
		// Keep existing published date
		publishedAt = post.PublishedAt
	}

	_, err = r.db.Exec(
		`UPDATE posts SET title = ?, slug = ?, content = ?, excerpt = ?, cover_image = ?, 
		is_draft = ?, published_at = ?, updated_at = ? WHERE id = ?`,
		input.Title, input.Slug, input.Content,
		nullString(input.Excerpt), nullString(input.CoverImage),
		input.IsDraft, publishedAt, time.Now(), id,
	)
	if err != nil {
		return nil, err
	}

	// Update tags
	if err := r.setTags(id, input.TagIDs); err != nil {
		return nil, err
	}

	return r.GetByID(id)
}

// Delete deletes a post
func (r *PostRepository) Delete(id int64) error {
	_, err := r.db.Exec(`DELETE FROM posts WHERE id = ?`, id)
	return err
}

// GetByID retrieves a post by ID
func (r *PostRepository) GetByID(id int64) (*models.Post, error) {
	var post models.Post
	err := r.db.QueryRow(
		`SELECT id, title, slug, content, excerpt, cover_image, is_draft, published_at, created_at, updated_at
		FROM posts WHERE id = ?`,
		id,
	).Scan(&post.ID, &post.Title, &post.Slug, &post.Content, &post.Excerpt, &post.CoverImage,
		&post.IsDraft, &post.PublishedAt, &post.CreatedAt, &post.UpdatedAt)
	if err != nil {
		return nil, err
	}

	tags, err := r.getTags(id)
	if err != nil {
		return nil, err
	}
	post.Tags = tags

	return &post, nil
}

// GetBySlug retrieves a post by slug
func (r *PostRepository) GetBySlug(slug string) (*models.Post, error) {
	var post models.Post
	err := r.db.QueryRow(
		`SELECT id, title, slug, content, excerpt, cover_image, is_draft, published_at, created_at, updated_at
		FROM posts WHERE slug = ?`,
		slug,
	).Scan(&post.ID, &post.Title, &post.Slug, &post.Content, &post.Excerpt, &post.CoverImage,
		&post.IsDraft, &post.PublishedAt, &post.CreatedAt, &post.UpdatedAt)
	if err != nil {
		return nil, err
	}

	tags, err := r.getTags(post.ID)
	if err != nil {
		return nil, err
	}
	post.Tags = tags

	return &post, nil
}

// List retrieves posts with optional filtering
func (r *PostRepository) List(publishedOnly bool, limit, offset int) ([]models.Post, error) {
	query := `SELECT id, title, slug, content, excerpt, cover_image, is_draft, published_at, created_at, updated_at
		FROM posts`
	args := []interface{}{}

	if publishedOnly {
		query += ` WHERE is_draft = 0`
	}
	query += ` ORDER BY COALESCE(published_at, created_at) DESC LIMIT ? OFFSET ?`
	args = append(args, limit, offset)

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var posts []models.Post
	for rows.Next() {
		var post models.Post
		err := rows.Scan(&post.ID, &post.Title, &post.Slug, &post.Content, &post.Excerpt, &post.CoverImage,
			&post.IsDraft, &post.PublishedAt, &post.CreatedAt, &post.UpdatedAt)
		if err != nil {
			return nil, err
		}
		posts = append(posts, post)
	}

	// Get tags for each post
	for i := range posts {
		tags, err := r.getTags(posts[i].ID)
		if err != nil {
			return nil, err
		}
		posts[i].Tags = tags
	}

	return posts, nil
}

// Count returns the total number of posts
func (r *PostRepository) Count(publishedOnly bool) (int, error) {
	query := `SELECT COUNT(*) FROM posts`
	if publishedOnly {
		query += ` WHERE is_draft = 0`
	}

	var count int
	err := r.db.QueryRow(query).Scan(&count)
	return count, err
}

// setTags replaces all tags for a post
func (r *PostRepository) setTags(postID int64, tagIDs []int64) error {
	// Remove existing tags
	_, err := r.db.Exec(`DELETE FROM post_tags WHERE post_id = ?`, postID)
	if err != nil {
		return err
	}

	// Add new tags
	for _, tagID := range tagIDs {
		_, err := r.db.Exec(`INSERT INTO post_tags (post_id, tag_id) VALUES (?, ?)`, postID, tagID)
		if err != nil {
			return err
		}
	}

	return nil
}

// getTags retrieves all tags for a post
func (r *PostRepository) getTags(postID int64) ([]models.Tag, error) {
	rows, err := r.db.Query(
		`SELECT t.id, t.name, t.slug, t.color, t.created_at
		FROM tags t
		INNER JOIN post_tags pt ON t.id = pt.tag_id
		WHERE pt.post_id = ?`,
		postID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tags []models.Tag
	for rows.Next() {
		var tag models.Tag
		err := rows.Scan(&tag.ID, &tag.Name, &tag.Slug, &tag.Color, &tag.CreatedAt)
		if err != nil {
			return nil, err
		}
		tags = append(tags, tag)
	}

	return tags, nil
}

// helper to convert string to sql.NullString
func nullString(s string) sql.NullString {
	if s == "" {
		return sql.NullString{}
	}
	return sql.NullString{String: s, Valid: true}
}
