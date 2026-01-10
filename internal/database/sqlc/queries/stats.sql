-- name: GetBookmarksCreatedSince :one
SELECT COUNT(*) FROM bookmarks
WHERE created_at >= ?;

-- name: GetPostsCreatedSince :one
SELECT COUNT(*) FROM posts
WHERE created_at >= ?;

-- name: GetBookmarkCountsByCollection :many
SELECT 
    COALESCE(c.name, 'Unsorted') as collection_name,
    COUNT(b.id) as bookmark_count
FROM bookmarks b
LEFT JOIN collections c ON b.collection_id = c.id
GROUP BY b.collection_id
ORDER BY bookmark_count DESC
LIMIT ?;

-- name: GetTopDomains :many
SELECT 
    domain,
    COUNT(*) as count
FROM bookmarks
WHERE domain IS NOT NULL AND domain != ''
GROUP BY domain
ORDER BY count DESC
LIMIT ?;

-- name: GetDatabaseStats :one
SELECT 
    (SELECT COUNT(*) FROM bookmarks) as total_bookmarks,
    (SELECT COUNT(*) FROM posts) as total_posts,
    (SELECT COUNT(*) FROM collections) as total_collections,
    (SELECT COUNT(*) FROM tags) as total_tags;
