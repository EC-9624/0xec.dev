-- name: CreateActivity :one
INSERT INTO activities (action, entity_type, entity_id, entity_title, metadata, created_at)
VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
RETURNING *;

-- name: ListRecentActivities :many
SELECT * FROM activities
ORDER BY created_at DESC
LIMIT ? OFFSET ?;

-- name: DeleteOldActivities :exec
DELETE FROM activities
WHERE created_at < ?;
