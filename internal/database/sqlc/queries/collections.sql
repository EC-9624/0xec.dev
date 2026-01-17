-- name: CreateCollection :one
INSERT INTO collections (name, slug, description, color, parent_id, sort_order, is_public, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
RETURNING *;

-- name: UpdateCollection :exec
UPDATE collections 
SET name = ?, slug = ?, description = ?, color = ?,
    parent_id = ?, sort_order = ?, is_public = ?, updated_at = CURRENT_TIMESTAMP 
WHERE id = ?;

-- name: DeleteCollection :exec
DELETE FROM collections WHERE id = ?;

-- name: GetCollectionByID :one
SELECT * FROM collections WHERE id = ?;

-- name: GetCollectionBySlug :one
SELECT * FROM collections WHERE slug = ?;

-- name: ListAllCollections :many
SELECT * FROM collections ORDER BY sort_order, name;

-- name: ListPublicCollections :many
SELECT * FROM collections WHERE is_public = 1 ORDER BY sort_order, name;

-- name: ListAllCollectionsWithCounts :many
SELECT c.*, 
    (SELECT COUNT(*) FROM bookmarks b WHERE b.collection_id = c.id) as bookmark_count
FROM collections c
ORDER BY c.sort_order, c.name;

-- name: ListPublicCollectionsWithCounts :many
SELECT c.*, 
    (SELECT COUNT(*) FROM bookmarks b WHERE b.collection_id = c.id) as bookmark_count
FROM collections c
WHERE c.is_public = 1
ORDER BY c.sort_order, c.name;

-- name: GetCollectionBookmarkCount :one
SELECT COUNT(*) FROM bookmarks WHERE collection_id = ?;

-- ============================================
-- INLINE EDITING QUERIES
-- ============================================

-- name: UpdateCollectionName :exec
UPDATE collections SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;

-- name: UpdateCollectionPublic :exec
UPDATE collections SET is_public = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;

-- name: GetBookmarksByCollectionID :many
SELECT id, title, url, domain, is_public, is_favorite, created_at
FROM bookmarks
WHERE collection_id = ?
ORDER BY COALESCE(sort_order, 999999) ASC, updated_at DESC
LIMIT 6;

-- name: GetRecentBookmarksByCollectionID :many
SELECT id, title, url, domain, is_favorite, is_public, updated_at
FROM bookmarks
WHERE collection_id = ?
ORDER BY COALESCE(sort_order, 999999) ASC, updated_at DESC
LIMIT ?;
