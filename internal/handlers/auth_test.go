package handlers

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/EC-9624/0xec.dev/internal/models"
	"github.com/EC-9624/0xec.dev/internal/service"
)

func TestLoginPage_NotLoggedIn(t *testing.T) {
	mock := &mockService{}
	h := newTestHandlers(mock)

	req := httptest.NewRequest(http.MethodGet, "/admin/login", nil)
	rec := httptest.NewRecorder()

	h.LoginPage(rec, req)

	assertStatus(t, rec, http.StatusOK)
	assertBodyContains(t, rec, "Login")
}

func TestLoginPage_AlreadyLoggedIn(t *testing.T) {
	mock := &mockService{
		getSessionFunc: func(ctx context.Context, sessionID string) (*models.Session, error) {
			return &models.Session{
				ID:        sessionID,
				UserID:    1,
				ExpiresAt: time.Now().Add(time.Hour),
			}, nil
		},
	}
	h := newTestHandlers(mock)

	req := httptest.NewRequest(http.MethodGet, "/admin/login", nil)
	req.AddCookie(&http.Cookie{Name: "session", Value: "valid-session"})
	rec := httptest.NewRecorder()

	h.LoginPage(rec, req)

	assertRedirect(t, rec, "/admin")
}

func TestLoginPage_InvalidSession(t *testing.T) {
	mock := &mockService{
		getSessionFunc: func(ctx context.Context, sessionID string) (*models.Session, error) {
			return nil, sql.ErrNoRows
		},
	}
	h := newTestHandlers(mock)

	req := httptest.NewRequest(http.MethodGet, "/admin/login", nil)
	req.AddCookie(&http.Cookie{Name: "session", Value: "invalid-session"})
	rec := httptest.NewRecorder()

	h.LoginPage(rec, req)

	// Should show login page since session is invalid
	assertStatus(t, rec, http.StatusOK)
	assertBodyContains(t, rec, "Login")
}

func TestLogin_UserNotFound(t *testing.T) {
	mock := &mockService{
		getUserByUsernameFunc: func(ctx context.Context, username string) (*models.User, error) {
			return nil, sql.ErrNoRows
		},
	}
	h := newTestHandlers(mock)

	form := url.Values{}
	form.Set("username", "nonexistent")
	form.Set("password", "password")

	req := httptest.NewRequest(http.MethodPost, "/admin/login", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	rec := httptest.NewRecorder()

	h.Login(rec, req)

	assertStatus(t, rec, http.StatusOK)
	assertBodyContains(t, rec, "Invalid username or password")
}

func TestLogin_WrongPassword(t *testing.T) {
	testUser := &models.User{
		ID:           1,
		Username:     "admin",
		PasswordHash: "hashed-password",
	}

	mock := &mockService{
		getUserByUsernameFunc: func(ctx context.Context, username string) (*models.User, error) {
			if username == "admin" {
				return testUser, nil
			}
			return nil, sql.ErrNoRows
		},
		validatePasswordFunc: func(user *models.User, password string) bool {
			return false // Wrong password
		},
	}
	h := newTestHandlers(mock)

	form := url.Values{}
	form.Set("username", "admin")
	form.Set("password", "wrongpassword")

	req := httptest.NewRequest(http.MethodPost, "/admin/login", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	rec := httptest.NewRecorder()

	h.Login(rec, req)

	assertStatus(t, rec, http.StatusOK)
	assertBodyContains(t, rec, "Invalid username or password")
}

func TestLogin_Success(t *testing.T) {
	testUser := &models.User{
		ID:           1,
		Username:     "admin",
		PasswordHash: "hashed-password",
	}
	testSession := &models.Session{
		ID:        "new-session-id",
		UserID:    testUser.ID,
		ExpiresAt: time.Now().Add(7 * 24 * time.Hour),
	}

	mock := &mockService{
		getUserByUsernameFunc: func(ctx context.Context, username string) (*models.User, error) {
			if username == "admin" {
				return testUser, nil
			}
			return nil, sql.ErrNoRows
		},
		validatePasswordFunc: func(user *models.User, password string) bool {
			return password == "correctpassword"
		},
		createSessionFunc: func(ctx context.Context, userID int64, duration time.Duration) (*models.Session, error) {
			if userID == testUser.ID {
				return testSession, nil
			}
			return nil, errors.New("unexpected user ID")
		},
	}
	h := newTestHandlers(mock)

	form := url.Values{}
	form.Set("username", "admin")
	form.Set("password", "correctpassword")

	req := httptest.NewRequest(http.MethodPost, "/admin/login", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	rec := httptest.NewRecorder()

	h.Login(rec, req)

	assertRedirect(t, rec, "/admin")
	assertCookie(t, rec, "session", testSession.ID)
}

func TestLogin_SessionCreationFails(t *testing.T) {
	testUser := &models.User{
		ID:           1,
		Username:     "admin",
		PasswordHash: "hashed-password",
	}

	mock := &mockService{
		getUserByUsernameFunc: func(ctx context.Context, username string) (*models.User, error) {
			return testUser, nil
		},
		validatePasswordFunc: func(user *models.User, password string) bool {
			return true
		},
		createSessionFunc: func(ctx context.Context, userID int64, duration time.Duration) (*models.Session, error) {
			return nil, errors.New("database error")
		},
	}
	h := newTestHandlers(mock)

	form := url.Values{}
	form.Set("username", "admin")
	form.Set("password", "password")

	req := httptest.NewRequest(http.MethodPost, "/admin/login", strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	rec := httptest.NewRecorder()

	h.Login(rec, req)

	assertStatus(t, rec, http.StatusOK)
	assertBodyContains(t, rec, "Failed to create session")
}

func TestLogout(t *testing.T) {
	sessionDeleted := false
	mock := &mockService{
		deleteSessionFunc: func(ctx context.Context, sessionID string) error {
			sessionDeleted = true
			return nil
		},
	}
	h := newTestHandlers(mock)

	req := httptest.NewRequest(http.MethodPost, "/admin/logout", nil)
	req.AddCookie(&http.Cookie{Name: "session", Value: "session-to-delete"})
	rec := httptest.NewRecorder()

	h.Logout(rec, req)

	if !sessionDeleted {
		t.Error("Session should be deleted")
	}

	assertRedirect(t, rec, "/admin/login")
	assertCookieCleared(t, rec, "session")
}

func TestLogout_NoCookie(t *testing.T) {
	mock := &mockService{}
	h := newTestHandlers(mock)

	req := httptest.NewRequest(http.MethodPost, "/admin/logout", nil)
	rec := httptest.NewRecorder()

	h.Logout(rec, req)

	// Should still redirect and try to clear cookie
	assertRedirect(t, rec, "/admin/login")
}

func TestAdminDashboard(t *testing.T) {
	mock := &mockService{
		getDashboardStatsFunc: func(ctx context.Context) (*service.DashboardStats, error) {
			return &service.DashboardStats{
				TotalBookmarks:   100,
				TotalPosts:       50,
				TotalCollections: 10,
				TotalTags:        25,
			}, nil
		},
		listRecentActivitiesFunc: func(ctx context.Context, limit, offset int) ([]service.Activity, error) {
			return []service.Activity{
				{ID: 1, Action: "bookmark.created", Title: "Test Bookmark"},
			}, nil
		},
	}
	h := newTestHandlers(mock)

	req := httptest.NewRequest(http.MethodGet, "/admin", nil)
	rec := httptest.NewRecorder()

	h.AdminDashboard(rec, req)

	assertStatus(t, rec, http.StatusOK)
	// Dashboard should render with stats
	assertBodyContains(t, rec, "Dashboard")
}

func TestAdminDashboard_StatsError(t *testing.T) {
	mock := &mockService{
		getDashboardStatsFunc: func(ctx context.Context) (*service.DashboardStats, error) {
			return nil, errors.New("database error")
		},
	}
	h := newTestHandlers(mock)

	req := httptest.NewRequest(http.MethodGet, "/admin", nil)
	rec := httptest.NewRecorder()

	h.AdminDashboard(rec, req)

	assertStatus(t, rec, http.StatusInternalServerError)
}
