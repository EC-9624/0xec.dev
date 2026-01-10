-- name: CreateUser :one
INSERT INTO users (username, password_hash, created_at, updated_at)
VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
RETURNING *;

-- name: GetUserByID :one
SELECT * FROM users WHERE id = ?;

-- name: GetUserByUsername :one
SELECT * FROM users WHERE username = ?;

-- name: CreateSession :one
INSERT INTO sessions (id, user_id, expires_at, created_at)
VALUES (?, ?, ?, CURRENT_TIMESTAMP)
RETURNING *;

-- name: GetValidSession :one
SELECT * FROM sessions WHERE id = ? AND expires_at > ?;

-- name: DeleteSession :exec
DELETE FROM sessions WHERE id = ?;

-- name: CleanupExpiredSessions :exec
DELETE FROM sessions WHERE expires_at < ?;
