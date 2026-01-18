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
)

func TestPostsIndex(t *testing.T) {
	testPosts := []models.Post{
		{ID: 1, Title: "First Post", Slug: "first-post", IsDraft: false},
		{ID: 2, Title: "Second Post", Slug: "second-post", IsDraft: false},
	}

	mock := &mockService{
		listPostsFunc: func(ctx context.Context, publishedOnly bool, limit, offset int) ([]models.Post, error) {
			if !publishedOnly {
				t.Error("Public posts index should only show published posts")
			}
			return testPosts, nil
		},
	}
	h := newTestHandlers(mock)

	req := httptest.NewRequest(http.MethodGet, "/posts", nil)
	rec := httptest.NewRecorder()

	h.PostsIndex(rec, req)

	assertStatus(t, rec, http.StatusOK)
	assertBodyContains(t, rec, "First Post")
	assertBodyContains(t, rec, "Second Post")
}

func TestPostsIndex_Empty(t *testing.T) {
	mock := &mockService{
		listPostsFunc: func(ctx context.Context, publishedOnly bool, limit, offset int) ([]models.Post, error) {
			return []models.Post{}, nil
		},
	}
	h := newTestHandlers(mock)

	req := httptest.NewRequest(http.MethodGet, "/posts", nil)
	rec := httptest.NewRecorder()

	h.PostsIndex(rec, req)

	assertStatus(t, rec, http.StatusOK)
}

func TestPostShow(t *testing.T) {
	testPost := &models.Post{
		ID:      1,
		Title:   "Test Post",
		Slug:    "test-post",
		Content: "This is the post content.",
		IsDraft: false,
		PublishedAt: sql.NullTime{
			Time:  time.Now(),
			Valid: true,
		},
	}

	mock := &mockService{
		getPostBySlugFunc: func(ctx context.Context, slug string) (*models.Post, error) {
			if slug == "test-post" {
				return testPost, nil
			}
			return nil, sql.ErrNoRows
		},
	}
	h := newTestHandlers(mock)

	req := httptest.NewRequest(http.MethodGet, "/posts/test-post", nil)
	req.SetPathValue("slug", "test-post")
	rec := httptest.NewRecorder()

	h.PostShow(rec, req)

	assertStatus(t, rec, http.StatusOK)
	assertBodyContains(t, rec, "Test Post")
	assertBodyContains(t, rec, "This is the post content")
}

func TestPostShow_NotFound(t *testing.T) {
	mock := &mockService{
		getPostBySlugFunc: func(ctx context.Context, slug string) (*models.Post, error) {
			return nil, sql.ErrNoRows
		},
	}
	h := newTestHandlers(mock)

	req := httptest.NewRequest(http.MethodGet, "/posts/nonexistent", nil)
	req.SetPathValue("slug", "nonexistent")
	rec := httptest.NewRecorder()

	h.PostShow(rec, req)

	assertStatus(t, rec, http.StatusNotFound)
}

func TestPostShow_Draft(t *testing.T) {
	draftPost := &models.Post{
		ID:      1,
		Title:   "Draft Post",
		Slug:    "draft-post",
		Content: "Draft content",
		IsDraft: true,
	}

	mock := &mockService{
		getPostBySlugFunc: func(ctx context.Context, slug string) (*models.Post, error) {
			return draftPost, nil
		},
	}
	h := newTestHandlers(mock)

	req := httptest.NewRequest(http.MethodGet, "/posts/draft-post", nil)
	req.SetPathValue("slug", "draft-post")
	rec := httptest.NewRecorder()

	h.PostShow(rec, req)

	// Draft posts should not be visible publicly
	assertStatus(t, rec, http.StatusNotFound)
}

func TestAdminPostsList(t *testing.T) {
	testPosts := []models.Post{
		{ID: 1, Title: "Published", Slug: "published", IsDraft: false},
		{ID: 2, Title: "Draft", Slug: "draft", IsDraft: true},
	}

	mock := &mockService{
		listPostsFunc: func(ctx context.Context, publishedOnly bool, limit, offset int) ([]models.Post, error) {
			if publishedOnly {
				t.Error("Admin list should show all posts including drafts")
			}
			return testPosts, nil
		},
	}
	h := newTestHandlers(mock)

	req := httptest.NewRequest(http.MethodGet, "/admin/posts", nil)
	rec := httptest.NewRecorder()

	h.AdminPostsList(rec, req)

	assertStatus(t, rec, http.StatusOK)
	assertBodyContains(t, rec, "Posts")
}

func TestAdminPostNew(t *testing.T) {
	mock := &mockService{
		listTagsFunc: func(ctx context.Context) ([]models.Tag, error) {
			return []models.Tag{
				{ID: 1, Name: "Go", Slug: "go"},
				{ID: 2, Name: "Web", Slug: "web"},
			}, nil
		},
	}
	h := newTestHandlers(mock)

	req := httptest.NewRequest(http.MethodGet, "/admin/posts/new", nil)
	rec := httptest.NewRecorder()

	h.AdminPostNew(rec, req)

	assertStatus(t, rec, http.StatusOK)
	assertBodyContains(t, rec, "New Post")
}

func TestAdminPostEdit(t *testing.T) {
	testPost := &models.Post{
		ID:      1,
		Title:   "Edit Me",
		Slug:    "edit-me",
		Content: "Original content",
	}

	mock := &mockService{
		getPostBySlugFunc: func(ctx context.Context, slug string) (*models.Post, error) {
			if slug == "edit-me" {
				return testPost, nil
			}
			return nil, sql.ErrNoRows
		},
		listTagsFunc: func(ctx context.Context) ([]models.Tag, error) {
			return []models.Tag{}, nil
		},
	}
	h := newTestHandlers(mock)

	req := httptest.NewRequest(http.MethodGet, "/admin/posts/edit-me/edit", nil)
	req.SetPathValue("slug", "edit-me")
	rec := httptest.NewRecorder()

	h.AdminPostEdit(rec, req)

	assertStatus(t, rec, http.StatusOK)
	assertBodyContains(t, rec, "Edit Post")
	assertBodyContains(t, rec, "Edit Me")
}

func TestAdminPostEdit_NotFound(t *testing.T) {
	mock := &mockService{
		getPostBySlugFunc: func(ctx context.Context, slug string) (*models.Post, error) {
			return nil, sql.ErrNoRows
		},
	}
	h := newTestHandlers(mock)

	req := httptest.NewRequest(http.MethodGet, "/admin/posts/nonexistent/edit", nil)
	req.SetPathValue("slug", "nonexistent")
	rec := httptest.NewRecorder()

	h.AdminPostEdit(rec, req)

	assertStatus(t, rec, http.StatusNotFound)
}

func TestAdminPostDelete(t *testing.T) {
	deleted := false
	mock := &mockService{
		getPostBySlugFunc: func(ctx context.Context, slug string) (*models.Post, error) {
			return &models.Post{ID: 1, Slug: slug}, nil
		},
		deletePostFunc: func(ctx context.Context, id int64) error {
			if id == 1 {
				deleted = true
				return nil
			}
			return sql.ErrNoRows
		},
	}
	h := newTestHandlers(mock)

	req := httptest.NewRequest(http.MethodDelete, "/admin/posts/test-post", nil)
	req.SetPathValue("slug", "test-post")
	rec := httptest.NewRecorder()

	h.AdminPostDelete(rec, req)

	if !deleted {
		t.Error("Post should be deleted")
	}

	// Check for redirect or success response
	if rec.Code != http.StatusOK && rec.Code != http.StatusSeeOther {
		t.Errorf("Expected 200 or 303, got %d", rec.Code)
	}
}

func TestAdminTogglePostDraft(t *testing.T) {
	currentDraft := true
	mock := &mockService{
		getPostByIDFunc: func(ctx context.Context, id int64) (*models.Post, error) {
			return &models.Post{
				ID:      id,
				Title:   "Test",
				Slug:    "test",
				Content: "Content for publishing",
				IsDraft: currentDraft,
			}, nil
		},
		updatePostDraftFunc: func(ctx context.Context, id int64, isDraft bool) error {
			currentDraft = isDraft
			return nil
		},
	}
	h := newTestHandlers(mock)

	req := httptest.NewRequest(http.MethodPost, "/admin/posts/1/toggle-draft", nil)
	req.SetPathValue("id", "1")
	rec := httptest.NewRecorder()

	h.AdminTogglePostDraft(rec, req)

	assertStatus(t, rec, http.StatusOK)

	// Should have toggled from draft to published
	if currentDraft != false {
		t.Error("Draft status should be toggled to false (published)")
	}
}

func TestAdminTogglePostDraft_NotFound(t *testing.T) {
	mock := &mockService{
		getPostByIDFunc: func(ctx context.Context, id int64) (*models.Post, error) {
			return nil, sql.ErrNoRows
		},
	}
	h := newTestHandlers(mock)

	req := httptest.NewRequest(http.MethodPost, "/admin/posts/999/toggle-draft", nil)
	req.SetPathValue("id", "999")
	rec := httptest.NewRecorder()

	h.AdminTogglePostDraft(rec, req)

	assertStatus(t, rec, http.StatusNotFound)
}

func TestAdminPostCreate_Success(t *testing.T) {
	createdPost := &models.Post{
		ID:        1,
		Title:     "New Post",
		Slug:      "new-post",
		Content:   "New content",
		IsDraft:   true,
		CreatedAt: time.Now(),
	}

	mock := &mockService{
		createPostFunc: func(ctx context.Context, input models.CreatePostInput) (*models.Post, error) {
			return createdPost, nil
		},
		listTagsFunc: func(ctx context.Context) ([]models.Tag, error) {
			return []models.Tag{}, nil
		},
	}
	h := newTestHandlers(mock)

	req := httptest.NewRequest(http.MethodPost, "/admin/posts", nil)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.ParseForm()
	req.Form.Set("title", "New Post")
	req.Form.Set("slug", "new-post")
	req.Form.Set("content", "New content")
	rec := httptest.NewRecorder()

	h.AdminPostCreate(rec, req)

	// Should redirect to edit page on success
	if rec.Code != http.StatusSeeOther {
		t.Errorf("Expected redirect, got %d", rec.Code)
	}
}

func TestAdminPostCreate_ValidationError(t *testing.T) {
	mock := &mockService{
		listTagsFunc: func(ctx context.Context) ([]models.Tag, error) {
			return []models.Tag{}, nil
		},
	}
	h := newTestHandlers(mock)

	req := httptest.NewRequest(http.MethodPost, "/admin/posts", nil)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.ParseForm()
	req.Form.Set("title", "") // Empty title - validation error
	req.Form.Set("slug", "valid-slug")
	rec := httptest.NewRecorder()

	h.AdminPostCreate(rec, req)

	// Should return form with validation errors (422 or 200 with error message)
	if rec.Code != http.StatusUnprocessableEntity && rec.Code != http.StatusOK {
		t.Errorf("Expected 422 or 200, got %d", rec.Code)
	}
}

func TestAdminPostUpdate_Success(t *testing.T) {
	existingPost := &models.Post{
		ID:      1,
		Title:   "Old Title",
		Slug:    "old-slug",
		Content: "Old content",
		IsDraft: true,
	}

	mock := &mockService{
		getPostBySlugFunc: func(ctx context.Context, slug string) (*models.Post, error) {
			// Return existing post only for the original slug
			if slug == "old-slug" {
				return existingPost, nil
			}
			// Return not found for new slug (no conflict)
			return nil, sql.ErrNoRows
		},
		updatePostFunc: func(ctx context.Context, id int64, input models.UpdatePostInput) (*models.Post, error) {
			return &models.Post{
				ID:      id,
				Title:   input.Title,
				Slug:    input.Slug,
				Content: input.Content,
				IsDraft: input.IsDraft,
			}, nil
		},
		listTagsFunc: func(ctx context.Context) ([]models.Tag, error) {
			return []models.Tag{}, nil
		},
	}
	h := newTestHandlers(mock)

	form := url.Values{}
	form.Set("title", "New Title")
	form.Set("slug", "new-slug")
	form.Set("content", "New content")
	form.Set("is_draft", "true") // Keep it as draft to avoid content validation issues

	req := httptest.NewRequest(http.MethodPost, "/admin/posts/old-slug", strings.NewReader(form.Encode()))
	req.SetPathValue("slug", "old-slug")
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	rec := httptest.NewRecorder()

	h.AdminPostUpdate(rec, req)

	// Should redirect on success
	if rec.Code != http.StatusSeeOther {
		t.Errorf("Expected redirect, got %d", rec.Code)
	}
}

func TestAdminPostUpdate_NotFound(t *testing.T) {
	mock := &mockService{
		getPostBySlugFunc: func(ctx context.Context, slug string) (*models.Post, error) {
			return nil, sql.ErrNoRows
		},
	}
	h := newTestHandlers(mock)

	req := httptest.NewRequest(http.MethodPost, "/admin/posts/nonexistent", nil)
	req.SetPathValue("slug", "nonexistent")
	rec := httptest.NewRecorder()

	h.AdminPostUpdate(rec, req)

	assertStatus(t, rec, http.StatusNotFound)
}

func TestPostsIndex_ServiceError(t *testing.T) {
	mock := &mockService{
		listPostsFunc: func(ctx context.Context, publishedOnly bool, limit, offset int) ([]models.Post, error) {
			return nil, errors.New("database error")
		},
	}
	h := newTestHandlers(mock)

	req := httptest.NewRequest(http.MethodGet, "/posts", nil)
	rec := httptest.NewRecorder()

	h.PostsIndex(rec, req)

	assertStatus(t, rec, http.StatusInternalServerError)
}
