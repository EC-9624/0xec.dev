package handlers

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/EC-9624/0xec.dev/internal/models"
	"github.com/EC-9624/0xec.dev/internal/service"
)

func TestBookmarksIndex(t *testing.T) {
	testBookmarks := []models.Bookmark{
		{ID: 1, URL: "https://example.com", Title: "Example Site", IsPublic: true},
		{ID: 2, URL: "https://test.com", Title: "Test Site", IsPublic: true},
	}

	mock := &mockService{
		listBookmarksFunc: func(ctx context.Context, opts service.BookmarkListOptions) ([]models.Bookmark, error) {
			return testBookmarks, nil
		},
		countBookmarksFunc: func(ctx context.Context, opts service.BookmarkListOptions) (int, error) {
			return len(testBookmarks), nil
		},
		listCollectionsFunc: func(ctx context.Context, publicOnly bool) ([]models.Collection, error) {
			return []models.Collection{
				{ID: 1, Name: "Tech", Slug: "tech"},
			}, nil
		},
	}
	h := newTestHandlers(mock)

	req := httptest.NewRequest(http.MethodGet, "/bookmarks", nil)
	rec := httptest.NewRecorder()

	h.BookmarksIndex(rec, req)

	assertStatus(t, rec, http.StatusOK)
	assertBodyContains(t, rec, "Example Site")
	assertBodyContains(t, rec, "Test Site")
}

func TestBookmarksIndex_Empty(t *testing.T) {
	mock := &mockService{
		listBookmarksFunc: func(ctx context.Context, opts service.BookmarkListOptions) ([]models.Bookmark, error) {
			return []models.Bookmark{}, nil
		},
		countBookmarksFunc: func(ctx context.Context, opts service.BookmarkListOptions) (int, error) {
			return 0, nil
		},
		listCollectionsFunc: func(ctx context.Context, publicOnly bool) ([]models.Collection, error) {
			return []models.Collection{}, nil
		},
	}
	h := newTestHandlers(mock)

	req := httptest.NewRequest(http.MethodGet, "/bookmarks", nil)
	rec := httptest.NewRecorder()

	h.BookmarksIndex(rec, req)

	assertStatus(t, rec, http.StatusOK)
}

func TestBookmarksIndex_ServiceError(t *testing.T) {
	mock := &mockService{
		listBookmarksFunc: func(ctx context.Context, opts service.BookmarkListOptions) ([]models.Bookmark, error) {
			return nil, errors.New("database error")
		},
	}
	h := newTestHandlers(mock)

	req := httptest.NewRequest(http.MethodGet, "/bookmarks", nil)
	rec := httptest.NewRecorder()

	h.BookmarksIndex(rec, req)

	assertStatus(t, rec, http.StatusInternalServerError)
}

func TestHTMXBookmarksMore(t *testing.T) {
	testBookmarks := []models.Bookmark{
		{ID: 3, URL: "https://page2.com", Title: "Page 2 Bookmark", IsPublic: true},
	}

	mock := &mockService{
		listBookmarksFunc: func(ctx context.Context, opts service.BookmarkListOptions) ([]models.Bookmark, error) {
			return testBookmarks, nil
		},
		countBookmarksFunc: func(ctx context.Context, opts service.BookmarkListOptions) (int, error) {
			return 15, nil // More than one page
		},
	}
	h := newTestHandlers(mock)

	req := httptest.NewRequest(http.MethodGet, "/htmx/bookmarks/more?page=2", nil)
	rec := httptest.NewRecorder()

	h.HTMXBookmarksMore(rec, req)

	assertStatus(t, rec, http.StatusOK)
	assertBodyContains(t, rec, "Page 2 Bookmark")
}

func TestHTMXBookmarksMore_NoMore(t *testing.T) {
	mock := &mockService{
		listBookmarksFunc: func(ctx context.Context, opts service.BookmarkListOptions) ([]models.Bookmark, error) {
			return []models.Bookmark{}, nil
		},
		countBookmarksFunc: func(ctx context.Context, opts service.BookmarkListOptions) (int, error) {
			return 5, nil // Less than items per page
		},
	}
	h := newTestHandlers(mock)

	req := httptest.NewRequest(http.MethodGet, "/htmx/bookmarks/more?page=1", nil)
	rec := httptest.NewRecorder()

	h.HTMXBookmarksMore(rec, req)

	assertStatus(t, rec, http.StatusOK)
}

func TestAdminBookmarksList(t *testing.T) {
	testBookmarks := []models.Bookmark{
		{ID: 1, URL: "https://example.com", Title: "Example", IsPublic: true},
		{ID: 2, URL: "https://private.com", Title: "Private", IsPublic: false},
	}

	mock := &mockService{
		listBookmarksFunc: func(ctx context.Context, opts service.BookmarkListOptions) ([]models.Bookmark, error) {
			// Admin should see all bookmarks (not just public)
			if opts.PublicOnly {
				t.Error("Admin list should not filter by public only")
			}
			return testBookmarks, nil
		},
		countBookmarksFunc: func(ctx context.Context, opts service.BookmarkListOptions) (int, error) {
			return len(testBookmarks), nil
		},
		listCollectionsFunc: func(ctx context.Context, publicOnly bool) ([]models.Collection, error) {
			return []models.Collection{}, nil
		},
	}
	h := newTestHandlers(mock)

	req := httptest.NewRequest(http.MethodGet, "/admin/bookmarks", nil)
	rec := httptest.NewRecorder()

	h.AdminBookmarksList(rec, req)

	assertStatus(t, rec, http.StatusOK)
	assertBodyContains(t, rec, "Bookmarks")
}

func TestAdminBookmarkNew(t *testing.T) {
	mock := &mockService{
		listCollectionsFunc: func(ctx context.Context, publicOnly bool) ([]models.Collection, error) {
			return []models.Collection{
				{ID: 1, Name: "Tech", Slug: "tech"},
			}, nil
		},
	}
	h := newTestHandlers(mock)

	req := httptest.NewRequest(http.MethodGet, "/admin/bookmarks/new", nil)
	rec := httptest.NewRecorder()

	h.AdminBookmarkNew(rec, req)

	assertStatus(t, rec, http.StatusOK)
	assertBodyContains(t, rec, "Add Bookmark")
}

func TestAdminBookmarkEdit(t *testing.T) {
	testBookmark := &models.Bookmark{
		ID:    1,
		URL:   "https://example.com",
		Title: "Example Site",
	}

	mock := &mockService{
		getBookmarkByIDFunc: func(ctx context.Context, id int64) (*models.Bookmark, error) {
			if id == 1 {
				return testBookmark, nil
			}
			return nil, sql.ErrNoRows
		},
		listCollectionsFunc: func(ctx context.Context, publicOnly bool) ([]models.Collection, error) {
			return []models.Collection{}, nil
		},
	}
	h := newTestHandlers(mock)

	req := httptest.NewRequest(http.MethodGet, "/admin/bookmarks/1/edit", nil)
	req.SetPathValue("id", "1")
	rec := httptest.NewRecorder()

	h.AdminBookmarkEdit(rec, req)

	assertStatus(t, rec, http.StatusOK)
	assertBodyContains(t, rec, "Edit Bookmark")
	assertBodyContains(t, rec, "Example Site")
}

func TestAdminBookmarkEdit_NotFound(t *testing.T) {
	mock := &mockService{
		getBookmarkByIDFunc: func(ctx context.Context, id int64) (*models.Bookmark, error) {
			return nil, sql.ErrNoRows
		},
	}
	h := newTestHandlers(mock)

	req := httptest.NewRequest(http.MethodGet, "/admin/bookmarks/999/edit", nil)
	req.SetPathValue("id", "999")
	rec := httptest.NewRecorder()

	h.AdminBookmarkEdit(rec, req)

	assertStatus(t, rec, http.StatusNotFound)
}

func TestAdminBookmarkDelete(t *testing.T) {
	deleted := false
	mock := &mockService{
		deleteBookmarkFunc: func(ctx context.Context, id int64) error {
			if id == 1 {
				deleted = true
				return nil
			}
			return sql.ErrNoRows
		},
	}
	h := newTestHandlers(mock)

	req := httptest.NewRequest(http.MethodDelete, "/admin/bookmarks/1", nil)
	req.SetPathValue("id", "1")
	rec := httptest.NewRecorder()

	h.AdminBookmarkDelete(rec, req)

	if !deleted {
		t.Error("Bookmark should be deleted")
	}

	// Check for redirect or success response
	if rec.Code != http.StatusOK && rec.Code != http.StatusSeeOther {
		t.Errorf("Expected 200 or 303, got %d", rec.Code)
	}
}

func TestAdminToggleBookmarkPublic(t *testing.T) {
	currentPublic := true
	mock := &mockService{
		getBookmarkByIDFunc: func(ctx context.Context, id int64) (*models.Bookmark, error) {
			return &models.Bookmark{
				ID:       id,
				IsPublic: currentPublic,
				Title:    "Test",
			}, nil
		},
		updateBookmarkPublicFunc: func(ctx context.Context, id int64, isPublic bool) error {
			currentPublic = isPublic
			return nil
		},
	}
	h := newTestHandlers(mock)

	req := httptest.NewRequest(http.MethodPost, "/admin/bookmarks/1/toggle-public", nil)
	req.SetPathValue("id", "1")
	rec := httptest.NewRecorder()

	h.AdminToggleBookmarkPublic(rec, req)

	assertStatus(t, rec, http.StatusOK)

	// Should have toggled from true to false
	if currentPublic != false {
		t.Error("Public status should be toggled to false")
	}
}

func TestAdminToggleBookmarkFavorite(t *testing.T) {
	currentFavorite := false
	mock := &mockService{
		getBookmarkByIDFunc: func(ctx context.Context, id int64) (*models.Bookmark, error) {
			return &models.Bookmark{
				ID:         id,
				IsFavorite: currentFavorite,
				Title:      "Test",
			}, nil
		},
		updateBookmarkFavoriteFunc: func(ctx context.Context, id int64, isFavorite bool) error {
			currentFavorite = isFavorite
			return nil
		},
	}
	h := newTestHandlers(mock)

	req := httptest.NewRequest(http.MethodPost, "/admin/bookmarks/1/toggle-favorite", nil)
	req.SetPathValue("id", "1")
	rec := httptest.NewRecorder()

	h.AdminToggleBookmarkFavorite(rec, req)

	assertStatus(t, rec, http.StatusOK)

	// Should have toggled from false to true
	if currentFavorite != true {
		t.Error("Favorite status should be toggled to true")
	}
}

func TestAdminBookmarkFetchMetadata(t *testing.T) {
	mock := &mockService{
		fetchPageMetadataFunc: func(ctx context.Context, url string) (*service.PageMetadata, error) {
			return &service.PageMetadata{
				Title:       "Fetched Title",
				Description: "Fetched description",
				Image:       "https://example.com/image.jpg",
				Favicon:     "https://example.com/favicon.ico",
			}, nil
		},
	}
	h := newTestHandlers(mock)

	req := httptest.NewRequest(http.MethodPost, "/admin/bookmarks/fetch-metadata?url=https://example.com", nil)
	rec := httptest.NewRecorder()

	h.AdminBookmarkFetchMetadata(rec, req)

	assertStatus(t, rec, http.StatusOK)
	assertBodyContains(t, rec, "Fetched Title")
}

func TestAdminBookmarkCreate_DuplicateURL(t *testing.T) {
	mock := &mockService{
		getBookmarkByURLFunc: func(ctx context.Context, url string) (*models.Bookmark, error) {
			// Bookmark already exists
			return &models.Bookmark{ID: 1, URL: url}, nil
		},
		listCollectionsFunc: func(ctx context.Context, publicOnly bool) ([]models.Collection, error) {
			return []models.Collection{}, nil
		},
	}
	h := newTestHandlers(mock)

	req := httptest.NewRequest(http.MethodPost, "/admin/bookmarks", nil)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.ParseForm()
	req.Form.Set("url", "https://existing.com")
	req.Form.Set("title", "Existing Site")
	rec := httptest.NewRecorder()

	h.AdminBookmarkCreate(rec, req)

	// 422 Unprocessable Entity is returned for validation errors
	assertStatus(t, rec, http.StatusUnprocessableEntity)
	assertBodyContains(t, rec, "already exists")
}

func TestAdminBookmarkCreate_Success(t *testing.T) {
	createdBookmark := &models.Bookmark{
		ID:        1,
		URL:       "https://new.com",
		Title:     "New Site",
		CreatedAt: time.Now(),
	}

	mock := &mockService{
		getBookmarkByURLFunc: func(ctx context.Context, url string) (*models.Bookmark, error) {
			return nil, sql.ErrNoRows // Not a duplicate
		},
		createBookmarkFunc: func(ctx context.Context, input models.CreateBookmarkInput) (*models.Bookmark, error) {
			return createdBookmark, nil
		},
		listCollectionsFunc: func(ctx context.Context, publicOnly bool) ([]models.Collection, error) {
			return []models.Collection{}, nil
		},
	}
	h := newTestHandlers(mock)

	req := httptest.NewRequest(http.MethodPost, "/admin/bookmarks", nil)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.ParseForm()
	req.Form.Set("url", "https://new.com")
	req.Form.Set("title", "New Site")
	rec := httptest.NewRecorder()

	h.AdminBookmarkCreate(rec, req)

	// Should redirect to bookmarks list on success
	assertRedirect(t, rec, "/admin/bookmarks")
}
