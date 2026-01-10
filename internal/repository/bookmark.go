package repository

import (
	"database/sql"
	"net/url"
	"time"

	"github.com/EC-9624/0xec.dev/internal/models"
)

// BookmarkRepository handles bookmark database operations
type BookmarkRepository struct {
	db *sql.DB
}

// NewBookmarkRepository creates a new BookmarkRepository
func NewBookmarkRepository(db *sql.DB) *BookmarkRepository {
	return &BookmarkRepository{db: db}
}

// Create creates a new bookmark
func (r *BookmarkRepository) Create(input models.CreateBookmarkInput) (*models.Bookmark, error) {
	now := time.Now()

	var collectionID sql.NullInt64
	if input.CollectionID != nil {
		collectionID = sql.NullInt64{Int64: *input.CollectionID, Valid: true}
	}

	// Extract domain from URL
	domain := extractDomain(input.URL)

	result, err := r.db.Exec(
		`INSERT INTO bookmarks (url, title, description, cover_image, domain, collection_id, is_public, is_favorite, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		input.URL, input.Title, nullString(input.Description),
		nullString(input.CoverImage), nullString(domain),
		collectionID, input.IsPublic, input.IsFavorite, now, now,
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

// Update updates an existing bookmark
func (r *BookmarkRepository) Update(id int64, input models.UpdateBookmarkInput) (*models.Bookmark, error) {
	var collectionID sql.NullInt64
	if input.CollectionID != nil {
		collectionID = sql.NullInt64{Int64: *input.CollectionID, Valid: true}
	}

	domain := extractDomain(input.URL)

	_, err := r.db.Exec(
		`UPDATE bookmarks SET url = ?, title = ?, description = ?, cover_image = ?, domain = ?,
		collection_id = ?, is_public = ?, is_favorite = ?, updated_at = ? WHERE id = ?`,
		input.URL, input.Title, nullString(input.Description),
		nullString(input.CoverImage), nullString(domain),
		collectionID, input.IsPublic, input.IsFavorite, time.Now(), id,
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

// Delete deletes a bookmark
func (r *BookmarkRepository) Delete(id int64) error {
	_, err := r.db.Exec(`DELETE FROM bookmarks WHERE id = ?`, id)
	return err
}

// GetByID retrieves a bookmark by ID
func (r *BookmarkRepository) GetByID(id int64) (*models.Bookmark, error) {
	var bookmark models.Bookmark
	err := r.db.QueryRow(
		`SELECT id, url, title, description, excerpt, cover_image, favicon, domain, 
		collection_id, is_public, is_favorite, sort_order, created_at, updated_at
		FROM bookmarks WHERE id = ?`,
		id,
	).Scan(&bookmark.ID, &bookmark.URL, &bookmark.Title, &bookmark.Description,
		&bookmark.Excerpt, &bookmark.CoverImage, &bookmark.Favicon, &bookmark.Domain,
		&bookmark.CollectionID, &bookmark.IsPublic, &bookmark.IsFavorite,
		&bookmark.SortOrder, &bookmark.CreatedAt, &bookmark.UpdatedAt)
	if err != nil {
		return nil, err
	}

	tags, err := r.getTags(id)
	if err != nil {
		return nil, err
	}
	bookmark.Tags = tags

	return &bookmark, nil
}

// List retrieves bookmarks with optional filtering
func (r *BookmarkRepository) List(opts BookmarkListOptions) ([]models.Bookmark, error) {
	query := `SELECT id, url, title, description, excerpt, cover_image, favicon, domain, 
		collection_id, is_public, is_favorite, sort_order, created_at, updated_at
		FROM bookmarks WHERE 1=1`
	args := []interface{}{}

	if opts.PublicOnly {
		query += ` AND is_public = 1`
	}
	if opts.CollectionID != nil {
		query += ` AND collection_id = ?`
		args = append(args, *opts.CollectionID)
	}
	if opts.FavoritesOnly {
		query += ` AND is_favorite = 1`
	}

	query += ` ORDER BY sort_order, created_at DESC LIMIT ? OFFSET ?`
	args = append(args, opts.Limit, opts.Offset)

	rows, err := r.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var bookmarks []models.Bookmark
	for rows.Next() {
		var bookmark models.Bookmark
		err := rows.Scan(&bookmark.ID, &bookmark.URL, &bookmark.Title, &bookmark.Description,
			&bookmark.Excerpt, &bookmark.CoverImage, &bookmark.Favicon, &bookmark.Domain,
			&bookmark.CollectionID, &bookmark.IsPublic, &bookmark.IsFavorite,
			&bookmark.SortOrder, &bookmark.CreatedAt, &bookmark.UpdatedAt)
		if err != nil {
			return nil, err
		}
		bookmarks = append(bookmarks, bookmark)
	}

	// Get tags for each bookmark
	for i := range bookmarks {
		tags, err := r.getTags(bookmarks[i].ID)
		if err != nil {
			return nil, err
		}
		bookmarks[i].Tags = tags
	}

	return bookmarks, nil
}

// Count returns the total number of bookmarks
func (r *BookmarkRepository) Count(opts BookmarkListOptions) (int, error) {
	query := `SELECT COUNT(*) FROM bookmarks WHERE 1=1`
	args := []interface{}{}

	if opts.PublicOnly {
		query += ` AND is_public = 1`
	}
	if opts.CollectionID != nil {
		query += ` AND collection_id = ?`
		args = append(args, *opts.CollectionID)
	}
	if opts.FavoritesOnly {
		query += ` AND is_favorite = 1`
	}

	var count int
	err := r.db.QueryRow(query, args...).Scan(&count)
	return count, err
}

// BookmarkListOptions contains options for listing bookmarks
type BookmarkListOptions struct {
	PublicOnly    bool
	CollectionID  *int64
	FavoritesOnly bool
	Limit         int
	Offset        int
}

// setTags replaces all tags for a bookmark
func (r *BookmarkRepository) setTags(bookmarkID int64, tagIDs []int64) error {
	// Remove existing tags
	_, err := r.db.Exec(`DELETE FROM bookmark_tags WHERE bookmark_id = ?`, bookmarkID)
	if err != nil {
		return err
	}

	// Add new tags
	for _, tagID := range tagIDs {
		_, err := r.db.Exec(`INSERT INTO bookmark_tags (bookmark_id, tag_id) VALUES (?, ?)`, bookmarkID, tagID)
		if err != nil {
			return err
		}
	}

	return nil
}

// getTags retrieves all tags for a bookmark
func (r *BookmarkRepository) getTags(bookmarkID int64) ([]models.Tag, error) {
	rows, err := r.db.Query(
		`SELECT t.id, t.name, t.slug, t.color, t.created_at
		FROM tags t
		INNER JOIN bookmark_tags bt ON t.id = bt.tag_id
		WHERE bt.bookmark_id = ?`,
		bookmarkID,
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

// extractDomain extracts the domain from a URL
func extractDomain(rawURL string) string {
	parsed, err := url.Parse(rawURL)
	if err != nil {
		return ""
	}
	return parsed.Host
}
