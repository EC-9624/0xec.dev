package service

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"time"

	"github.com/EC-9624/0xec.dev/internal/database/sqlc/db"
	"github.com/EC-9624/0xec.dev/internal/models"

	"golang.org/x/crypto/bcrypt"
)

// CreateUser creates a new user with hashed password
func (s *Service) CreateUser(ctx context.Context, username, password string) (*models.User, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}

	user, err := s.queries.CreateUser(ctx, db.CreateUserParams{
		Username:     username,
		PasswordHash: string(hash),
	})
	if err != nil {
		return nil, err
	}

	return dbUserToModel(user), nil
}

// GetUserByID retrieves a user by ID
func (s *Service) GetUserByID(ctx context.Context, id int64) (*models.User, error) {
	user, err := s.queries.GetUserByID(ctx, id)
	if err != nil {
		return nil, err
	}
	return dbUserToModel(user), nil
}

// GetUserByUsername retrieves a user by username
func (s *Service) GetUserByUsername(ctx context.Context, username string) (*models.User, error) {
	user, err := s.queries.GetUserByUsername(ctx, username)
	if err != nil {
		return nil, err
	}
	return dbUserToModel(user), nil
}

// ValidatePassword checks if the provided password matches the user's hash
func (s *Service) ValidatePassword(user *models.User, password string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password))
	return err == nil
}

// CreateSession creates a new session for the user
func (s *Service) CreateSession(ctx context.Context, userID int64, duration time.Duration) (*models.Session, error) {
	token := make([]byte, 32)
	if _, err := rand.Read(token); err != nil {
		return nil, err
	}

	sessionID := hex.EncodeToString(token)
	expiresAt := time.Now().Add(duration)

	session, err := s.queries.CreateSession(ctx, db.CreateSessionParams{
		ID:        sessionID,
		UserID:    userID,
		ExpiresAt: expiresAt,
	})
	if err != nil {
		return nil, err
	}

	return dbSessionToModel(session), nil
}

// GetSession retrieves a valid session by ID
func (s *Service) GetSession(ctx context.Context, sessionID string) (*models.Session, error) {
	session, err := s.queries.GetValidSession(ctx, db.GetValidSessionParams{
		ID:        sessionID,
		ExpiresAt: time.Now(),
	})
	if err != nil {
		return nil, err
	}
	return dbSessionToModel(session), nil
}

// DeleteSession deletes a session
func (s *Service) DeleteSession(ctx context.Context, sessionID string) error {
	return s.queries.DeleteSession(ctx, sessionID)
}

// CleanupExpiredSessions removes all expired sessions
func (s *Service) CleanupExpiredSessions(ctx context.Context) error {
	return s.queries.CleanupExpiredSessions(ctx, time.Now())
}

// EnsureAdminExists creates the admin user if it doesn't exist
func (s *Service) EnsureAdminExists(ctx context.Context, username, password string) error {
	_, err := s.GetUserByUsername(ctx, username)
	if err == sql.ErrNoRows {
		_, err = s.CreateUser(ctx, username, password)
		return err
	}
	return err
}

// Helper functions to convert between sqlc models and domain models

func dbUserToModel(u db.User) *models.User {
	return &models.User{
		ID:           u.ID,
		Username:     u.Username,
		PasswordHash: u.PasswordHash,
		CreatedAt:    derefTime(u.CreatedAt),
		UpdatedAt:    derefTime(u.UpdatedAt),
	}
}

func dbSessionToModel(s db.Session) *models.Session {
	return &models.Session{
		ID:        s.ID,
		UserID:    s.UserID,
		ExpiresAt: s.ExpiresAt,
		CreatedAt: derefTime(s.CreatedAt),
	}
}

func derefTime(t *time.Time) time.Time {
	if t == nil {
		return time.Time{}
	}
	return *t
}
