-- name: CreatePost :one
INSERT INTO posts (title, slug, content, excerpt, cover_image, is_draft, published_at, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
RETURNING *;

-- name: UpdatePost :exec
UPDATE posts 
SET title = ?, slug = ?, content = ?, excerpt = ?, cover_image = ?, 
    is_draft = ?, published_at = ?, updated_at = CURRENT_TIMESTAMP 
WHERE id = ?;

-- name: DeletePost :exec
DELETE FROM posts WHERE id = ?;

-- name: GetPostByID :one
SELECT * FROM posts WHERE id = ?;

-- name: GetPostBySlug :one
SELECT * FROM posts WHERE slug = ?;

-- name: ListAllPosts :many
SELECT * FROM posts 
ORDER BY COALESCE(published_at, created_at) DESC 
LIMIT ? OFFSET ?;

-- name: ListPublishedPosts :many
SELECT * FROM posts 
WHERE is_draft = 0 
ORDER BY COALESCE(published_at, created_at) DESC 
LIMIT ? OFFSET ?;

-- name: GetPostTags :many
SELECT t.id, t.name, t.slug, t.created_at
FROM tags t
INNER JOIN post_tags pt ON t.id = pt.tag_id
WHERE pt.post_id = ?;

-- name: DeletePostTags :exec
DELETE FROM post_tags WHERE post_id = ?;

-- name: AddPostTag :exec
INSERT INTO post_tags (post_id, tag_id, created_at) VALUES (?, ?, CURRENT_TIMESTAMP);

-- ============================================
-- INLINE EDITING QUERIES
-- ============================================

-- name: UpdatePostDraft :exec
UPDATE posts SET is_draft = ?, published_at = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;
