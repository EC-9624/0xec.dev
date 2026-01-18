-- name: CreateTag :one
INSERT INTO tags (name, slug, created_at)
VALUES (?, ?, CURRENT_TIMESTAMP)
RETURNING *;

-- name: DeleteTag :exec
DELETE FROM tags WHERE id = ?;

-- name: GetTagBySlug :one
SELECT * FROM tags WHERE slug = ?;

-- name: GetTagByName :one
SELECT * FROM tags WHERE name = ?;

-- name: ListTags :many
SELECT * FROM tags ORDER BY name;

-- name: ListTagsWithCounts :many
SELECT t.*,
    (SELECT COUNT(*) FROM post_tags pt WHERE pt.tag_id = t.id) as usage_count
FROM tags t
ORDER BY usage_count DESC, t.name;

-- name: GetPostsByTagID :many
SELECT p.id, p.title, p.slug, p.is_draft, p.published_at, p.created_at
FROM posts p
JOIN post_tags pt ON p.id = pt.post_id
WHERE pt.tag_id = ?
ORDER BY p.created_at DESC;
