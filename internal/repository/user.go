package repository

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"time"

	"github.com/EC-9624/0xec.dev/internal/models"

	"golang.org/x/crypto/bcrypt"
)

// UserRepository handles user database operations
type UserRepository struct {
	db *sql.DB
}

// NewUserRepository creates a new UserRepository
func NewUserRepository(db *sql.DB) *UserRepository {
	return &UserRepository{db: db}
}

// Create creates a new user with hashed password
func (r *UserRepository) Create(username, password string) (*models.User, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	result, err := r.db.Exec(
		`INSERT INTO users (username, password_hash) VALUES (?, ?)`,
		username, string(hash),
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

// GetByID retrieves a user by ID
func (r *UserRepository) GetByID(id int64) (*models.User, error) {
	var user models.User
	err := r.db.QueryRow(
		`SELECT id, username, password_hash, created_at, updated_at FROM users WHERE id = ?`,
		id,
	).Scan(&user.ID, &user.Username, &user.PasswordHash, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// GetByUsername retrieves a user by username
func (r *UserRepository) GetByUsername(username string) (*models.User, error) {
	var user models.User
	err := r.db.QueryRow(
		`SELECT id, username, password_hash, created_at, updated_at FROM users WHERE username = ?`,
		username,
	).Scan(&user.ID, &user.Username, &user.PasswordHash, &user.CreatedAt, &user.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// ValidatePassword checks if the provided password matches the user's hash
func (r *UserRepository) ValidatePassword(user *models.User, password string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password))
	return err == nil
}

// CreateSession creates a new session for the user
func (r *UserRepository) CreateSession(userID int64, duration time.Duration) (*models.Session, error) {
	token := make([]byte, 32)
	if _, err := rand.Read(token); err != nil {
		return nil, err
	}

	sessionID := hex.EncodeToString(token)
	expiresAt := time.Now().Add(duration)

	_, err := r.db.Exec(
		`INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`,
		sessionID, userID, expiresAt,
	)
	if err != nil {
		return nil, err
	}

	return &models.Session{
		ID:        sessionID,
		UserID:    userID,
		ExpiresAt: expiresAt,
		CreatedAt: time.Now(),
	}, nil
}

// GetSession retrieves a valid session by ID
func (r *UserRepository) GetSession(sessionID string) (*models.Session, error) {
	var session models.Session
	err := r.db.QueryRow(
		`SELECT id, user_id, expires_at, created_at FROM sessions WHERE id = ? AND expires_at > ?`,
		sessionID, time.Now(),
	).Scan(&session.ID, &session.UserID, &session.ExpiresAt, &session.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &session, nil
}

// DeleteSession deletes a session
func (r *UserRepository) DeleteSession(sessionID string) error {
	_, err := r.db.Exec(`DELETE FROM sessions WHERE id = ?`, sessionID)
	return err
}

// CleanupExpiredSessions removes all expired sessions
func (r *UserRepository) CleanupExpiredSessions() error {
	_, err := r.db.Exec(`DELETE FROM sessions WHERE expires_at < ?`, time.Now())
	return err
}

// EnsureAdminExists creates the admin user if it doesn't exist
func (r *UserRepository) EnsureAdminExists(username, password string) error {
	_, err := r.GetByUsername(username)
	if err == sql.ErrNoRows {
		_, err = r.Create(username, password)
		return err
	}
	return err
}
