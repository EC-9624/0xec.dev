-- name: CreateImage :one
INSERT INTO images (hash, content_type, data, size, source_url)
VALUES (?, ?, ?, ?, ?)
RETURNING *;

-- name: GetImageByID :one
SELECT * FROM images WHERE id = ?;

-- name: GetImageByHash :one
SELECT * FROM images WHERE hash = ?;

-- name: DeleteImage :exec
DELETE FROM images WHERE id = ?;

-- name: DeleteUnusedImages :exec
DELETE FROM images 
WHERE id NOT IN (
    SELECT cover_image_id FROM bookmarks WHERE cover_image_id IS NOT NULL
    UNION
    SELECT favicon_id FROM bookmarks WHERE favicon_id IS NOT NULL
);

-- name: CountImages :one
SELECT COUNT(*) FROM images;

-- name: GetImageStats :one
SELECT 
    COUNT(*) as count,
    COALESCE(SUM(size), 0) as total_size
FROM images;
