-- name: CreateBookmark :one
INSERT INTO bookmarks (url, title, description, cover_image, favicon, domain, collection_id, is_public, is_favorite, sort_order, created_at, updated_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
RETURNING *;

-- name: UpdateBookmark :exec
UPDATE bookmarks 
SET url = ?, title = ?, description = ?, cover_image = ?, favicon = ?, domain = ?,
    collection_id = ?, is_public = ?, is_favorite = ?, updated_at = CURRENT_TIMESTAMP 
WHERE id = ?;

-- name: DeleteBookmark :exec
DELETE FROM bookmarks WHERE id = ?;

-- name: GetBookmarkByID :one
SELECT * FROM bookmarks WHERE id = ?;

-- name: GetBookmarkByURL :one
SELECT * FROM bookmarks WHERE url = ? LIMIT 1;

-- name: ListAllBookmarks :many
SELECT * FROM bookmarks 
ORDER BY sort_order, created_at DESC 
LIMIT ? OFFSET ?;

-- name: ListPublicBookmarks :many
SELECT * FROM bookmarks 
WHERE is_public = 1 
ORDER BY sort_order, created_at DESC 
LIMIT ? OFFSET ?;

-- name: ListBookmarksByCollection :many
SELECT * FROM bookmarks 
WHERE collection_id = ? 
ORDER BY sort_order, created_at DESC 
LIMIT ? OFFSET ?;

-- name: ListPublicBookmarksByCollection :many
SELECT * FROM bookmarks 
WHERE is_public = 1 AND collection_id = ? 
ORDER BY sort_order, created_at DESC 
LIMIT ? OFFSET ?;

-- name: ListFavoriteBookmarks :many
SELECT * FROM bookmarks 
WHERE is_favorite = 1 
ORDER BY sort_order, created_at DESC 
LIMIT ? OFFSET ?;

-- name: ListPublicFavoriteBookmarks :many
SELECT * FROM bookmarks 
WHERE is_public = 1 AND is_favorite = 1 
ORDER BY sort_order, created_at DESC 
LIMIT ? OFFSET ?;

-- name: CountAllBookmarks :one
SELECT COUNT(*) FROM bookmarks;

-- name: CountPublicBookmarks :one
SELECT COUNT(*) FROM bookmarks WHERE is_public = 1;

-- name: CountBookmarksByCollection :one
SELECT COUNT(*) FROM bookmarks WHERE collection_id = ?;

-- name: CountPublicBookmarksByCollection :one
SELECT COUNT(*) FROM bookmarks WHERE is_public = 1 AND collection_id = ?;

-- name: CountFavoriteBookmarks :one
SELECT COUNT(*) FROM bookmarks WHERE is_favorite = 1;

-- name: CountPublicFavoriteBookmarks :one
SELECT COUNT(*) FROM bookmarks WHERE is_public = 1 AND is_favorite = 1;

-- ============================================
-- INLINE EDITING QUERIES
-- ============================================

-- name: UpdateBookmarkPublic :exec
UPDATE bookmarks SET is_public = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;

-- name: UpdateBookmarkFavorite :exec
UPDATE bookmarks SET is_favorite = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;

-- name: UpdateBookmarkCollection :exec
UPDATE bookmarks SET collection_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;

-- name: UpdateBookmarkTitle :exec
UPDATE bookmarks SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?;

-- ============================================
-- BOARD VIEW QUERIES
-- ============================================

-- name: CountUnsortedBookmarks :one
SELECT COUNT(*) FROM bookmarks WHERE collection_id IS NULL;

-- name: ListRecentUnsortedBookmarks :many
SELECT id, title, url, domain, is_favorite, is_public, updated_at
FROM bookmarks
WHERE collection_id IS NULL
ORDER BY COALESCE(sort_order, 999999) ASC, updated_at DESC
LIMIT ?;

-- name: ListUnsortedBookmarks :many
SELECT * FROM bookmarks
WHERE collection_id IS NULL
ORDER BY COALESCE(sort_order, 999999) ASC, updated_at DESC
LIMIT ? OFFSET ?;

-- ============================================
-- POSITION/SORT ORDER QUERIES
-- ============================================

-- name: GetCollectionBookmarkSortOrders :many
SELECT id, COALESCE(sort_order, 999999) as sort_order
FROM bookmarks
WHERE collection_id = ?
ORDER BY COALESCE(sort_order, 999999) ASC, updated_at DESC;

-- name: GetUnsortedBookmarkSortOrders :many
SELECT id, COALESCE(sort_order, 999999) as sort_order
FROM bookmarks
WHERE collection_id IS NULL
ORDER BY COALESCE(sort_order, 999999) ASC, updated_at DESC;

-- name: UpdateBookmarkPosition :exec
UPDATE bookmarks 
SET collection_id = ?, sort_order = ?, updated_at = CURRENT_TIMESTAMP 
WHERE id = ?;
