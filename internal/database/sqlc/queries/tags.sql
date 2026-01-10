-- name: CreateTag :one
INSERT INTO tags (name, slug, color, created_at)
VALUES (?, ?, ?, CURRENT_TIMESTAMP)
RETURNING *;

-- name: UpdateTag :exec
UPDATE tags SET name = ?, slug = ?, color = ? WHERE id = ?;

-- name: DeleteTag :exec
DELETE FROM tags WHERE id = ?;

-- name: GetTagByID :one
SELECT * FROM tags WHERE id = ?;

-- name: GetTagBySlug :one
SELECT * FROM tags WHERE slug = ?;

-- name: ListTags :many
SELECT * FROM tags ORDER BY name;

-- name: ListTagsWithCounts :many
SELECT t.*,
    (SELECT COUNT(*) FROM bookmark_tags bt WHERE bt.tag_id = t.id) +
    (SELECT COUNT(*) FROM post_tags pt WHERE pt.tag_id = t.id) as usage_count
FROM tags t
ORDER BY usage_count DESC, t.name;
