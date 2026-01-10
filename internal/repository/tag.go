package repository

import (
	"database/sql"
	"time"

	"github.com/EC-9624/0xec.dev/internal/models"
)

// TagRepository handles tag database operations
type TagRepository struct {
	db *sql.DB
}

// NewTagRepository creates a new TagRepository
func NewTagRepository(db *sql.DB) *TagRepository {
	return &TagRepository{db: db}
}

// Create creates a new tag
func (r *TagRepository) Create(input models.CreateTagInput) (*models.Tag, error) {
	result, err := r.db.Exec(
		`INSERT INTO tags (name, slug, color) VALUES (?, ?, ?)`,
		input.Name, input.Slug, nullString(input.Color),
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

// Update updates an existing tag
func (r *TagRepository) Update(id int64, input models.CreateTagInput) (*models.Tag, error) {
	_, err := r.db.Exec(
		`UPDATE tags SET name = ?, slug = ?, color = ? WHERE id = ?`,
		input.Name, input.Slug, nullString(input.Color), id,
	)
	if err != nil {
		return nil, err
	}

	return r.GetByID(id)
}

// Delete deletes a tag
func (r *TagRepository) Delete(id int64) error {
	_, err := r.db.Exec(`DELETE FROM tags WHERE id = ?`, id)
	return err
}

// GetByID retrieves a tag by ID
func (r *TagRepository) GetByID(id int64) (*models.Tag, error) {
	var tag models.Tag
	err := r.db.QueryRow(
		`SELECT id, name, slug, color, created_at FROM tags WHERE id = ?`,
		id,
	).Scan(&tag.ID, &tag.Name, &tag.Slug, &tag.Color, &tag.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &tag, nil
}

// GetBySlug retrieves a tag by slug
func (r *TagRepository) GetBySlug(slug string) (*models.Tag, error) {
	var tag models.Tag
	err := r.db.QueryRow(
		`SELECT id, name, slug, color, created_at FROM tags WHERE slug = ?`,
		slug,
	).Scan(&tag.ID, &tag.Name, &tag.Slug, &tag.Color, &tag.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &tag, nil
}

// List retrieves all tags
func (r *TagRepository) List() ([]models.Tag, error) {
	rows, err := r.db.Query(
		`SELECT id, name, slug, color, created_at FROM tags ORDER BY name`,
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

// GetOrCreate gets a tag by name or creates it if it doesn't exist
func (r *TagRepository) GetOrCreate(name, slug string) (*models.Tag, error) {
	tag, err := r.GetBySlug(slug)
	if err == sql.ErrNoRows {
		return r.Create(models.CreateTagInput{
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

// GetTagsWithCounts returns all tags with their usage counts
func (r *TagRepository) GetTagsWithCounts() ([]TagWithCount, error) {
	rows, err := r.db.Query(`
		SELECT t.id, t.name, t.slug, t.color, t.created_at,
			(SELECT COUNT(*) FROM bookmark_tags bt WHERE bt.tag_id = t.id) +
			(SELECT COUNT(*) FROM post_tags pt WHERE pt.tag_id = t.id) as usage_count
		FROM tags t
		ORDER BY usage_count DESC, t.name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tags []TagWithCount
	for rows.Next() {
		var tag TagWithCount
		var createdAt time.Time
		err := rows.Scan(&tag.ID, &tag.Name, &tag.Slug, &tag.Color, &createdAt, &tag.Count)
		if err != nil {
			return nil, err
		}
		tag.CreatedAt = createdAt
		tags = append(tags, tag)
	}

	return tags, nil
}

// TagWithCount represents a tag with its usage count
type TagWithCount struct {
	models.Tag
	Count int `json:"count"`
}
