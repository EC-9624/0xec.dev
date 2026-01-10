package repository

import (
	"database/sql"
	"time"

	"github.com/EC-9624/0xec.dev/internal/models"
)

// CollectionRepository handles collection database operations
type CollectionRepository struct {
	db *sql.DB
}

// NewCollectionRepository creates a new CollectionRepository
func NewCollectionRepository(db *sql.DB) *CollectionRepository {
	return &CollectionRepository{db: db}
}

// Create creates a new collection
func (r *CollectionRepository) Create(input models.CreateCollectionInput) (*models.Collection, error) {
	now := time.Now()

	var parentID sql.NullInt64
	if input.ParentID != nil {
		parentID = sql.NullInt64{Int64: *input.ParentID, Valid: true}
	}

	result, err := r.db.Exec(
		`INSERT INTO collections (name, slug, description, icon, color, parent_id, is_public, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		input.Name, input.Slug, nullString(input.Description),
		nullString(input.Icon), nullString(input.Color),
		parentID, input.IsPublic, now, now,
	)
	if err != nil {
		return nil, err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}

	return r.GetByID(id)
}

// Update updates an existing collection
func (r *CollectionRepository) Update(id int64, input models.UpdateCollectionInput) (*models.Collection, error) {
	var parentID sql.NullInt64
	if input.ParentID != nil {
		parentID = sql.NullInt64{Int64: *input.ParentID, Valid: true}
	}

	_, err := r.db.Exec(
		`UPDATE collections SET name = ?, slug = ?, description = ?, icon = ?, color = ?, 
		parent_id = ?, sort_order = ?, is_public = ?, updated_at = ? WHERE id = ?`,
		input.Name, input.Slug, nullString(input.Description),
		nullString(input.Icon), nullString(input.Color),
		parentID, input.SortOrder, input.IsPublic, time.Now(), id,
	)
	if err != nil {
		return nil, err
	}

	return r.GetByID(id)
}

// Delete deletes a collection
func (r *CollectionRepository) Delete(id int64) error {
	_, err := r.db.Exec(`DELETE FROM collections WHERE id = ?`, id)
	return err
}

// GetByID retrieves a collection by ID
func (r *CollectionRepository) GetByID(id int64) (*models.Collection, error) {
	var collection models.Collection
	err := r.db.QueryRow(
		`SELECT id, name, slug, description, icon, color, parent_id, sort_order, is_public, created_at, updated_at
		FROM collections WHERE id = ?`,
		id,
	).Scan(&collection.ID, &collection.Name, &collection.Slug, &collection.Description,
		&collection.Icon, &collection.Color, &collection.ParentID, &collection.SortOrder,
		&collection.IsPublic, &collection.CreatedAt, &collection.UpdatedAt)
	if err != nil {
		return nil, err
	}

	// Get bookmark count
	count, err := r.getBookmarkCount(id)
	if err != nil {
		return nil, err
	}
	collection.BookmarkCount = count

	return &collection, nil
}

// GetBySlug retrieves a collection by slug
func (r *CollectionRepository) GetBySlug(slug string) (*models.Collection, error) {
	var collection models.Collection
	err := r.db.QueryRow(
		`SELECT id, name, slug, description, icon, color, parent_id, sort_order, is_public, created_at, updated_at
		FROM collections WHERE slug = ?`,
		slug,
	).Scan(&collection.ID, &collection.Name, &collection.Slug, &collection.Description,
		&collection.Icon, &collection.Color, &collection.ParentID, &collection.SortOrder,
		&collection.IsPublic, &collection.CreatedAt, &collection.UpdatedAt)
	if err != nil {
		return nil, err
	}

	// Get bookmark count
	count, err := r.getBookmarkCount(collection.ID)
	if err != nil {
		return nil, err
	}
	collection.BookmarkCount = count

	return &collection, nil
}

// List retrieves all collections with bookmark counts
func (r *CollectionRepository) List(publicOnly bool) ([]models.Collection, error) {
	query := `SELECT c.id, c.name, c.slug, c.description, c.icon, c.color, c.parent_id, 
		c.sort_order, c.is_public, c.created_at, c.updated_at,
		(SELECT COUNT(*) FROM bookmarks b WHERE b.collection_id = c.id) as bookmark_count
		FROM collections c`

	if publicOnly {
		query += ` WHERE c.is_public = 1`
	}
	query += ` ORDER BY c.sort_order, c.name`

	rows, err := r.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var collections []models.Collection
	for rows.Next() {
		var collection models.Collection
		err := rows.Scan(&collection.ID, &collection.Name, &collection.Slug, &collection.Description,
			&collection.Icon, &collection.Color, &collection.ParentID, &collection.SortOrder,
			&collection.IsPublic, &collection.CreatedAt, &collection.UpdatedAt, &collection.BookmarkCount)
		if err != nil {
			return nil, err
		}
		collections = append(collections, collection)
	}

	return collections, nil
}

// getBookmarkCount returns the number of bookmarks in a collection
func (r *CollectionRepository) getBookmarkCount(collectionID int64) (int, error) {
	var count int
	err := r.db.QueryRow(
		`SELECT COUNT(*) FROM bookmarks WHERE collection_id = ?`,
		collectionID,
	).Scan(&count)
	return count, err
}
