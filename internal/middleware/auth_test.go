package middleware

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/EC-9624/0xec.dev/internal/models"
)

// mockAuthService is a test double for AuthService
type mockAuthService struct {
	getSessionFunc  func(ctx context.Context, sessionID string) (*models.Session, error)
	getUserByIDFunc func(ctx context.Context, id int64) (*models.User, error)
}

func (m *mockAuthService) GetSession(ctx context.Context, sessionID string) (*models.Session, error) {
	if m.getSessionFunc != nil {
		return m.getSessionFunc(ctx, sessionID)
	}
	return nil, errors.New("not implemented")
}

func (m *mockAuthService) GetUserByID(ctx context.Context, id int64) (*models.User, error) {
	if m.getUserByIDFunc != nil {
		return m.getUserByIDFunc(ctx, id)
	}
	return nil, errors.New("not implemented")
}

func TestAuth_NoSessionCookie(t *testing.T) {
	mock := &mockAuthService{}

	handler := Auth(mock)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("Handler should not be called without session cookie")
	}))

	req := httptest.NewRequest(http.MethodGet, "/admin/dashboard", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	// Should redirect to login
	if rec.Code != http.StatusSeeOther {
		t.Errorf("Status = %d, want %d", rec.Code, http.StatusSeeOther)
	}

	location := rec.Header().Get("Location")
	if location != "/admin/login" {
		t.Errorf("Location = %q, want %q", location, "/admin/login")
	}
}

func TestAuth_InvalidSession(t *testing.T) {
	mock := &mockAuthService{
		getSessionFunc: func(ctx context.Context, sessionID string) (*models.Session, error) {
			return nil, errors.New("session not found")
		},
	}

	handler := Auth(mock)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("Handler should not be called with invalid session")
	}))

	req := httptest.NewRequest(http.MethodGet, "/admin/dashboard", nil)
	req.AddCookie(&http.Cookie{Name: "session", Value: "invalid-session-id"})
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	// Should redirect to login
	if rec.Code != http.StatusSeeOther {
		t.Errorf("Status = %d, want %d", rec.Code, http.StatusSeeOther)
	}

	// Should clear the session cookie
	cookies := rec.Result().Cookies()
	var sessionCookie *http.Cookie
	for _, c := range cookies {
		if c.Name == "session" {
			sessionCookie = c
			break
		}
	}

	if sessionCookie == nil {
		t.Fatal("Should set session cookie to clear it")
	}

	if sessionCookie.MaxAge != -1 {
		t.Errorf("Session cookie MaxAge = %d, want -1 (delete)", sessionCookie.MaxAge)
	}

	if sessionCookie.Value != "" {
		t.Errorf("Session cookie Value = %q, want empty", sessionCookie.Value)
	}
}

func TestAuth_ExpiredSession(t *testing.T) {
	mock := &mockAuthService{
		getSessionFunc: func(ctx context.Context, sessionID string) (*models.Session, error) {
			// Simulating expired session by returning error
			return nil, errors.New("session expired")
		},
	}

	handler := Auth(mock)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("Handler should not be called with expired session")
	}))

	req := httptest.NewRequest(http.MethodGet, "/admin/dashboard", nil)
	req.AddCookie(&http.Cookie{Name: "session", Value: "expired-session"})
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusSeeOther {
		t.Errorf("Status = %d, want %d", rec.Code, http.StatusSeeOther)
	}
}

func TestAuth_UserNotFound(t *testing.T) {
	mock := &mockAuthService{
		getSessionFunc: func(ctx context.Context, sessionID string) (*models.Session, error) {
			return &models.Session{
				ID:        sessionID,
				UserID:    999, // User that doesn't exist
				ExpiresAt: time.Now().Add(time.Hour),
			}, nil
		},
		getUserByIDFunc: func(ctx context.Context, id int64) (*models.User, error) {
			return nil, errors.New("user not found")
		},
	}

	handler := Auth(mock)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Error("Handler should not be called when user is not found")
	}))

	req := httptest.NewRequest(http.MethodGet, "/admin/dashboard", nil)
	req.AddCookie(&http.Cookie{Name: "session", Value: "valid-session"})
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusSeeOther {
		t.Errorf("Status = %d, want %d", rec.Code, http.StatusSeeOther)
	}

	location := rec.Header().Get("Location")
	if location != "/admin/login" {
		t.Errorf("Location = %q, want %q", location, "/admin/login")
	}
}

func TestAuth_ValidSession(t *testing.T) {
	testUser := &models.User{
		ID:       1,
		Username: "testuser",
	}

	mock := &mockAuthService{
		getSessionFunc: func(ctx context.Context, sessionID string) (*models.Session, error) {
			return &models.Session{
				ID:        sessionID,
				UserID:    testUser.ID,
				ExpiresAt: time.Now().Add(time.Hour),
			}, nil
		},
		getUserByIDFunc: func(ctx context.Context, id int64) (*models.User, error) {
			if id == testUser.ID {
				return testUser, nil
			}
			return nil, errors.New("user not found")
		},
	}

	var capturedUser *models.User
	handler := Auth(mock)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedUser = GetUser(r)
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/admin/dashboard", nil)
	req.AddCookie(&http.Cookie{Name: "session", Value: "valid-session-id"})
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("Status = %d, want %d", rec.Code, http.StatusOK)
	}

	if capturedUser == nil {
		t.Fatal("User should be available in context")
	}

	if capturedUser.ID != testUser.ID {
		t.Errorf("User ID = %d, want %d", capturedUser.ID, testUser.ID)
	}

	if capturedUser.Username != testUser.Username {
		t.Errorf("Username = %q, want %q", capturedUser.Username, testUser.Username)
	}
}

func TestAuth_SessionIDPassedCorrectly(t *testing.T) {
	expectedSessionID := "my-unique-session-id-12345"
	var receivedSessionID string

	mock := &mockAuthService{
		getSessionFunc: func(ctx context.Context, sessionID string) (*models.Session, error) {
			receivedSessionID = sessionID
			return &models.Session{
				ID:        sessionID,
				UserID:    1,
				ExpiresAt: time.Now().Add(time.Hour),
			}, nil
		},
		getUserByIDFunc: func(ctx context.Context, id int64) (*models.User, error) {
			return &models.User{ID: 1, Username: "test"}, nil
		},
	}

	handler := Auth(mock)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/admin/dashboard", nil)
	req.AddCookie(&http.Cookie{Name: "session", Value: expectedSessionID})
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if receivedSessionID != expectedSessionID {
		t.Errorf("Received session ID = %q, want %q", receivedSessionID, expectedSessionID)
	}
}

func TestAuth_UserIDPassedCorrectly(t *testing.T) {
	expectedUserID := int64(42)
	var receivedUserID int64

	mock := &mockAuthService{
		getSessionFunc: func(ctx context.Context, sessionID string) (*models.Session, error) {
			return &models.Session{
				ID:        sessionID,
				UserID:    expectedUserID,
				ExpiresAt: time.Now().Add(time.Hour),
			}, nil
		},
		getUserByIDFunc: func(ctx context.Context, id int64) (*models.User, error) {
			receivedUserID = id
			return &models.User{ID: id, Username: "test"}, nil
		},
	}

	handler := Auth(mock)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/admin/dashboard", nil)
	req.AddCookie(&http.Cookie{Name: "session", Value: "session"})
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if receivedUserID != expectedUserID {
		t.Errorf("Received user ID = %d, want %d", receivedUserID, expectedUserID)
	}
}

func TestGetUser_NoUserInContext(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	user := GetUser(req)

	if user != nil {
		t.Errorf("GetUser without context should return nil, got %+v", user)
	}
}

func TestGetUser_WrongTypeInContext(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	ctx := context.WithValue(req.Context(), UserContextKey, "not a user")
	req = req.WithContext(ctx)

	user := GetUser(req)

	if user != nil {
		t.Errorf("GetUser with wrong type should return nil, got %+v", user)
	}
}

func TestGetUser_ValidUser(t *testing.T) {
	testUser := &models.User{
		ID:       123,
		Username: "testuser",
	}

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	ctx := context.WithValue(req.Context(), UserContextKey, testUser)
	req = req.WithContext(ctx)

	user := GetUser(req)

	if user == nil {
		t.Fatal("GetUser should return user from context")
	}

	if user.ID != testUser.ID {
		t.Errorf("User ID = %d, want %d", user.ID, testUser.ID)
	}

	if user.Username != testUser.Username {
		t.Errorf("Username = %q, want %q", user.Username, testUser.Username)
	}
}
