package handlers

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/EC-9624/0xec.dev/internal/config"
	"github.com/EC-9624/0xec.dev/internal/models"
	"github.com/EC-9624/0xec.dev/internal/service"
)

// ============================================
// MOCK SERVICE FOR HANDLER TESTS
// ============================================

// mockService implements service.ServiceInterface for testing handlers
type mockService struct {
	// User methods
	createUserFunc             func(ctx context.Context, username, password string) (*models.User, error)
	getUserByIDFunc            func(ctx context.Context, id int64) (*models.User, error)
	getUserByUsernameFunc      func(ctx context.Context, username string) (*models.User, error)
	validatePasswordFunc       func(user *models.User, password string) bool
	createSessionFunc          func(ctx context.Context, userID int64, duration time.Duration) (*models.Session, error)
	getSessionFunc             func(ctx context.Context, sessionID string) (*models.Session, error)
	deleteSessionFunc          func(ctx context.Context, sessionID string) error
	rotateSessionFunc          func(ctx context.Context, userID int64, oldSessionID string, duration time.Duration) (*models.Session, error)
	cleanupExpiredSessionsFunc func(ctx context.Context) error
	ensureAdminExistsFunc      func(ctx context.Context, username, password string) error

	// Bookmark methods
	createBookmarkFunc                 func(ctx context.Context, input models.CreateBookmarkInput) (*models.Bookmark, error)
	updateBookmarkFunc                 func(ctx context.Context, id int64, input models.UpdateBookmarkInput) (*models.Bookmark, error)
	deleteBookmarkFunc                 func(ctx context.Context, id int64) error
	getBookmarkByIDFunc                func(ctx context.Context, id int64) (*models.Bookmark, error)
	getBookmarkByURLFunc               func(ctx context.Context, url string) (*models.Bookmark, error)
	listBookmarksFunc                  func(ctx context.Context, opts service.BookmarkListOptions) ([]models.Bookmark, error)
	listUnsortedBookmarksFunc          func(ctx context.Context, limit, offset int) ([]models.Bookmark, error)
	countBookmarksFunc                 func(ctx context.Context, opts service.BookmarkListOptions) (int, error)
	updateBookmarkPublicFunc           func(ctx context.Context, id int64, isPublic bool) error
	updateBookmarkFavoriteFunc         func(ctx context.Context, id int64, isFavorite bool) error
	updateBookmarkCollectionFunc       func(ctx context.Context, id int64, collectionID *int64) error
	updateBookmarkTitleFunc            func(ctx context.Context, id int64, title string) error
	moveBookmarkFunc                   func(ctx context.Context, bookmarkID int64, collectionID *int64, afterBookmarkID *int64) error
	bulkMoveBookmarksFunc              func(ctx context.Context, bookmarkIDs []int64, collectionID *int64) error
	bulkDeleteBookmarksFunc            func(ctx context.Context, bookmarkIDs []int64) error
	refreshBookmarkMetadataFunc        func(ctx context.Context, id int64) error
	refreshAllMissingMetadataAsyncFunc func(progressChan chan<- string)

	// Post methods
	createPostFunc      func(ctx context.Context, input models.CreatePostInput) (*models.Post, error)
	updatePostFunc      func(ctx context.Context, id int64, input models.UpdatePostInput) (*models.Post, error)
	deletePostFunc      func(ctx context.Context, id int64) error
	getPostByIDFunc     func(ctx context.Context, id int64) (*models.Post, error)
	getPostBySlugFunc   func(ctx context.Context, slug string) (*models.Post, error)
	listPostsFunc       func(ctx context.Context, publishedOnly bool, limit, offset int) ([]models.Post, error)
	countPostsFunc      func(ctx context.Context, publishedOnly bool) (int, error)
	updatePostDraftFunc func(ctx context.Context, id int64, isDraft bool) error

	// Collection methods
	createCollectionFunc           func(ctx context.Context, input models.CreateCollectionInput) (*models.Collection, error)
	updateCollectionFunc           func(ctx context.Context, id int64, input models.UpdateCollectionInput) (*models.Collection, error)
	deleteCollectionFunc           func(ctx context.Context, id int64) error
	getCollectionByIDFunc          func(ctx context.Context, id int64) (*models.Collection, error)
	getCollectionBySlugFunc        func(ctx context.Context, slug string) (*models.Collection, error)
	listCollectionsFunc            func(ctx context.Context, publicOnly bool) ([]models.Collection, error)
	updateCollectionNameFunc       func(ctx context.Context, id int64, name string) error
	updateCollectionPublicFunc     func(ctx context.Context, id int64, isPublic bool) error
	getBookmarksByCollectionIDFunc func(ctx context.Context, collectionID int64) ([]service.CollectionBookmark, error)
	getBoardViewDataFunc           func(ctx context.Context, recentLimit int) (*service.BoardViewData, error)

	// Tag methods
	createTagFunc         func(ctx context.Context, input models.CreateTagInput) (*models.Tag, error)
	updateTagFunc         func(ctx context.Context, id int64, input models.CreateTagInput) (*models.Tag, error)
	deleteTagFunc         func(ctx context.Context, id int64) error
	getTagByIDFunc        func(ctx context.Context, id int64) (*models.Tag, error)
	getTagBySlugFunc      func(ctx context.Context, slug string) (*models.Tag, error)
	listTagsFunc          func(ctx context.Context) ([]models.Tag, error)
	getOrCreateTagFunc    func(ctx context.Context, name, slug string) (*models.Tag, error)
	getTagsWithCountsFunc func(ctx context.Context) ([]service.TagWithCount, error)
	getPostsByTagIDFunc   func(ctx context.Context, tagID int64) ([]service.TagPost, error)

	// Stats methods
	getDashboardStatsFunc func(ctx context.Context) (*service.DashboardStats, error)

	// Activity methods
	logActivityFunc               func(ctx context.Context, action, entityType string, entityID int64, title string, metadata map[string]interface{}) (*service.Activity, error)
	listRecentActivitiesFunc      func(ctx context.Context, limit, offset int) ([]service.Activity, error)
	countActivitiesFunc           func(ctx context.Context) (int, error)
	deleteActivitiesForEntityFunc func(ctx context.Context, entityType string, entityID int64) error

	// Metadata methods
	fetchPageMetadataFunc func(ctx context.Context, url string) (*service.PageMetadata, error)

	// Import methods
	importBookmarksFunc func(ctx context.Context, bookmarks []service.ImportedBookmark, defaultCollectionID *int64) (*service.ImportResult, error)
}

// Ensure mockService implements ServiceInterface
var _ service.ServiceInterface = (*mockService)(nil)

// ============================================
// TEST HELPERS
// ============================================

// testConfig returns a minimal config for testing
func testConfig() *config.Config {
	return &config.Config{
		Port:             "8080",
		DatabaseURL:      "test.db",
		AdminUser:        "admin",
		AdminPass:        "password",
		BookmarksPerPage: 10,
		PostsPerPage:     10,
		Environment:      "development",
	}
}

// newTestHandlers creates a Handlers instance with a mock service
func newTestHandlers(mock *mockService) *Handlers {
	return New(testConfig(), mock)
}

// assertStatus checks if the response status code matches expected
func assertStatus(t *testing.T, rec *httptest.ResponseRecorder, expected int) {
	t.Helper()
	if rec.Code != expected {
		t.Errorf("Status code = %d, want %d", rec.Code, expected)
	}
}

// assertRedirect checks if the response is a redirect to the expected location
func assertRedirect(t *testing.T, rec *httptest.ResponseRecorder, location string) {
	t.Helper()
	if rec.Code != http.StatusSeeOther && rec.Code != http.StatusFound && rec.Code != http.StatusTemporaryRedirect {
		t.Errorf("Expected redirect status, got %d", rec.Code)
	}
	if got := rec.Header().Get("Location"); got != location {
		t.Errorf("Redirect location = %q, want %q", got, location)
	}
}

// assertBodyContains checks if the response body contains the expected substring
func assertBodyContains(t *testing.T, rec *httptest.ResponseRecorder, substring string) {
	t.Helper()
	body := rec.Body.String()
	if !strings.Contains(body, substring) {
		t.Errorf("Response body should contain %q, got: %s", substring, truncate(body, 500))
	}
}

// assertCookie checks if the response sets a cookie with the expected name and value
func assertCookie(t *testing.T, rec *httptest.ResponseRecorder, name, expectedValue string) {
	t.Helper()
	cookies := rec.Result().Cookies()
	for _, c := range cookies {
		if c.Name == name {
			if expectedValue != "" && c.Value != expectedValue {
				t.Errorf("Cookie %q value = %q, want %q", name, c.Value, expectedValue)
			}
			return
		}
	}
	t.Errorf("Cookie %q not found in response", name)
}

// assertCookieCleared checks if the response clears a cookie (MaxAge = -1)
func assertCookieCleared(t *testing.T, rec *httptest.ResponseRecorder, name string) {
	t.Helper()
	cookies := rec.Result().Cookies()
	for _, c := range cookies {
		if c.Name == name {
			if c.MaxAge != -1 {
				t.Errorf("Cookie %q MaxAge = %d, want -1 (cleared)", name, c.MaxAge)
			}
			return
		}
	}
	t.Errorf("Cookie %q not found in response", name)
}

// truncate truncates a string to max length for error messages
func truncate(s string, max int) string {
	if len(s) <= max {
		return s
	}
	return s[:max] + "..."
}

// ============================================
// MOCK SERVICE METHOD IMPLEMENTATIONS
// ============================================

func (m *mockService) CreateUser(ctx context.Context, username, password string) (*models.User, error) {
	if m.createUserFunc != nil {
		return m.createUserFunc(ctx, username, password)
	}
	return nil, nil
}

func (m *mockService) GetUserByID(ctx context.Context, id int64) (*models.User, error) {
	if m.getUserByIDFunc != nil {
		return m.getUserByIDFunc(ctx, id)
	}
	return nil, nil
}

func (m *mockService) GetUserByUsername(ctx context.Context, username string) (*models.User, error) {
	if m.getUserByUsernameFunc != nil {
		return m.getUserByUsernameFunc(ctx, username)
	}
	return nil, nil
}

func (m *mockService) ValidatePassword(user *models.User, password string) bool {
	if m.validatePasswordFunc != nil {
		return m.validatePasswordFunc(user, password)
	}
	return false
}

func (m *mockService) CreateSession(ctx context.Context, userID int64, duration time.Duration) (*models.Session, error) {
	if m.createSessionFunc != nil {
		return m.createSessionFunc(ctx, userID, duration)
	}
	return nil, nil
}

func (m *mockService) GetSession(ctx context.Context, sessionID string) (*models.Session, error) {
	if m.getSessionFunc != nil {
		return m.getSessionFunc(ctx, sessionID)
	}
	return nil, nil
}

func (m *mockService) DeleteSession(ctx context.Context, sessionID string) error {
	if m.deleteSessionFunc != nil {
		return m.deleteSessionFunc(ctx, sessionID)
	}
	return nil
}

func (m *mockService) RotateSession(ctx context.Context, userID int64, oldSessionID string, duration time.Duration) (*models.Session, error) {
	if m.rotateSessionFunc != nil {
		return m.rotateSessionFunc(ctx, userID, oldSessionID, duration)
	}
	return nil, nil
}

func (m *mockService) CleanupExpiredSessions(ctx context.Context) error {
	if m.cleanupExpiredSessionsFunc != nil {
		return m.cleanupExpiredSessionsFunc(ctx)
	}
	return nil
}

func (m *mockService) EnsureAdminExists(ctx context.Context, username, password string) error {
	if m.ensureAdminExistsFunc != nil {
		return m.ensureAdminExistsFunc(ctx, username, password)
	}
	return nil
}

func (m *mockService) CreateBookmark(ctx context.Context, input models.CreateBookmarkInput) (*models.Bookmark, error) {
	if m.createBookmarkFunc != nil {
		return m.createBookmarkFunc(ctx, input)
	}
	return nil, nil
}

func (m *mockService) UpdateBookmark(ctx context.Context, id int64, input models.UpdateBookmarkInput) (*models.Bookmark, error) {
	if m.updateBookmarkFunc != nil {
		return m.updateBookmarkFunc(ctx, id, input)
	}
	return nil, nil
}

func (m *mockService) DeleteBookmark(ctx context.Context, id int64) error {
	if m.deleteBookmarkFunc != nil {
		return m.deleteBookmarkFunc(ctx, id)
	}
	return nil
}

func (m *mockService) GetBookmarkByID(ctx context.Context, id int64) (*models.Bookmark, error) {
	if m.getBookmarkByIDFunc != nil {
		return m.getBookmarkByIDFunc(ctx, id)
	}
	return nil, nil
}

func (m *mockService) GetBookmarkByURL(ctx context.Context, url string) (*models.Bookmark, error) {
	if m.getBookmarkByURLFunc != nil {
		return m.getBookmarkByURLFunc(ctx, url)
	}
	return nil, nil
}

func (m *mockService) ListBookmarks(ctx context.Context, opts service.BookmarkListOptions) ([]models.Bookmark, error) {
	if m.listBookmarksFunc != nil {
		return m.listBookmarksFunc(ctx, opts)
	}
	return nil, nil
}

func (m *mockService) ListUnsortedBookmarks(ctx context.Context, limit, offset int) ([]models.Bookmark, error) {
	if m.listUnsortedBookmarksFunc != nil {
		return m.listUnsortedBookmarksFunc(ctx, limit, offset)
	}
	return nil, nil
}

func (m *mockService) CountBookmarks(ctx context.Context, opts service.BookmarkListOptions) (int, error) {
	if m.countBookmarksFunc != nil {
		return m.countBookmarksFunc(ctx, opts)
	}
	return 0, nil
}

func (m *mockService) UpdateBookmarkPublic(ctx context.Context, id int64, isPublic bool) error {
	if m.updateBookmarkPublicFunc != nil {
		return m.updateBookmarkPublicFunc(ctx, id, isPublic)
	}
	return nil
}

func (m *mockService) UpdateBookmarkFavorite(ctx context.Context, id int64, isFavorite bool) error {
	if m.updateBookmarkFavoriteFunc != nil {
		return m.updateBookmarkFavoriteFunc(ctx, id, isFavorite)
	}
	return nil
}

func (m *mockService) UpdateBookmarkCollection(ctx context.Context, id int64, collectionID *int64) error {
	if m.updateBookmarkCollectionFunc != nil {
		return m.updateBookmarkCollectionFunc(ctx, id, collectionID)
	}
	return nil
}

func (m *mockService) UpdateBookmarkTitle(ctx context.Context, id int64, title string) error {
	if m.updateBookmarkTitleFunc != nil {
		return m.updateBookmarkTitleFunc(ctx, id, title)
	}
	return nil
}

func (m *mockService) MoveBookmark(ctx context.Context, bookmarkID int64, collectionID *int64, afterBookmarkID *int64) error {
	if m.moveBookmarkFunc != nil {
		return m.moveBookmarkFunc(ctx, bookmarkID, collectionID, afterBookmarkID)
	}
	return nil
}

func (m *mockService) BulkMoveBookmarks(ctx context.Context, bookmarkIDs []int64, collectionID *int64) error {
	if m.bulkMoveBookmarksFunc != nil {
		return m.bulkMoveBookmarksFunc(ctx, bookmarkIDs, collectionID)
	}
	return nil
}

func (m *mockService) BulkDeleteBookmarks(ctx context.Context, bookmarkIDs []int64) error {
	if m.bulkDeleteBookmarksFunc != nil {
		return m.bulkDeleteBookmarksFunc(ctx, bookmarkIDs)
	}
	return nil
}

func (m *mockService) RefreshBookmarkMetadata(ctx context.Context, id int64) error {
	if m.refreshBookmarkMetadataFunc != nil {
		return m.refreshBookmarkMetadataFunc(ctx, id)
	}
	return nil
}

func (m *mockService) RefreshAllMissingMetadataAsync(progressChan chan<- string) {
	if m.refreshAllMissingMetadataAsyncFunc != nil {
		m.refreshAllMissingMetadataAsyncFunc(progressChan)
	}
}

func (m *mockService) CreatePost(ctx context.Context, input models.CreatePostInput) (*models.Post, error) {
	if m.createPostFunc != nil {
		return m.createPostFunc(ctx, input)
	}
	return nil, nil
}

func (m *mockService) UpdatePost(ctx context.Context, id int64, input models.UpdatePostInput) (*models.Post, error) {
	if m.updatePostFunc != nil {
		return m.updatePostFunc(ctx, id, input)
	}
	return nil, nil
}

func (m *mockService) DeletePost(ctx context.Context, id int64) error {
	if m.deletePostFunc != nil {
		return m.deletePostFunc(ctx, id)
	}
	return nil
}

func (m *mockService) GetPostByID(ctx context.Context, id int64) (*models.Post, error) {
	if m.getPostByIDFunc != nil {
		return m.getPostByIDFunc(ctx, id)
	}
	return nil, nil
}

func (m *mockService) GetPostBySlug(ctx context.Context, slug string) (*models.Post, error) {
	if m.getPostBySlugFunc != nil {
		return m.getPostBySlugFunc(ctx, slug)
	}
	return nil, nil
}

func (m *mockService) ListPosts(ctx context.Context, publishedOnly bool, limit, offset int) ([]models.Post, error) {
	if m.listPostsFunc != nil {
		return m.listPostsFunc(ctx, publishedOnly, limit, offset)
	}
	return nil, nil
}

func (m *mockService) CountPosts(ctx context.Context, publishedOnly bool) (int, error) {
	if m.countPostsFunc != nil {
		return m.countPostsFunc(ctx, publishedOnly)
	}
	return 0, nil
}

func (m *mockService) UpdatePostDraft(ctx context.Context, id int64, isDraft bool) error {
	if m.updatePostDraftFunc != nil {
		return m.updatePostDraftFunc(ctx, id, isDraft)
	}
	return nil
}

func (m *mockService) CreateCollection(ctx context.Context, input models.CreateCollectionInput) (*models.Collection, error) {
	if m.createCollectionFunc != nil {
		return m.createCollectionFunc(ctx, input)
	}
	return nil, nil
}

func (m *mockService) UpdateCollection(ctx context.Context, id int64, input models.UpdateCollectionInput) (*models.Collection, error) {
	if m.updateCollectionFunc != nil {
		return m.updateCollectionFunc(ctx, id, input)
	}
	return nil, nil
}

func (m *mockService) DeleteCollection(ctx context.Context, id int64) error {
	if m.deleteCollectionFunc != nil {
		return m.deleteCollectionFunc(ctx, id)
	}
	return nil
}

func (m *mockService) GetCollectionByID(ctx context.Context, id int64) (*models.Collection, error) {
	if m.getCollectionByIDFunc != nil {
		return m.getCollectionByIDFunc(ctx, id)
	}
	return nil, nil
}

func (m *mockService) GetCollectionBySlug(ctx context.Context, slug string) (*models.Collection, error) {
	if m.getCollectionBySlugFunc != nil {
		return m.getCollectionBySlugFunc(ctx, slug)
	}
	return nil, nil
}

func (m *mockService) ListCollections(ctx context.Context, publicOnly bool) ([]models.Collection, error) {
	if m.listCollectionsFunc != nil {
		return m.listCollectionsFunc(ctx, publicOnly)
	}
	return nil, nil
}

func (m *mockService) UpdateCollectionName(ctx context.Context, id int64, name string) error {
	if m.updateCollectionNameFunc != nil {
		return m.updateCollectionNameFunc(ctx, id, name)
	}
	return nil
}

func (m *mockService) UpdateCollectionPublic(ctx context.Context, id int64, isPublic bool) error {
	if m.updateCollectionPublicFunc != nil {
		return m.updateCollectionPublicFunc(ctx, id, isPublic)
	}
	return nil
}

func (m *mockService) GetBookmarksByCollectionID(ctx context.Context, collectionID int64) ([]service.CollectionBookmark, error) {
	if m.getBookmarksByCollectionIDFunc != nil {
		return m.getBookmarksByCollectionIDFunc(ctx, collectionID)
	}
	return nil, nil
}

func (m *mockService) GetBoardViewData(ctx context.Context, recentLimit int) (*service.BoardViewData, error) {
	if m.getBoardViewDataFunc != nil {
		return m.getBoardViewDataFunc(ctx, recentLimit)
	}
	return nil, nil
}

func (m *mockService) CreateTag(ctx context.Context, input models.CreateTagInput) (*models.Tag, error) {
	if m.createTagFunc != nil {
		return m.createTagFunc(ctx, input)
	}
	return nil, nil
}

func (m *mockService) UpdateTag(ctx context.Context, id int64, input models.CreateTagInput) (*models.Tag, error) {
	if m.updateTagFunc != nil {
		return m.updateTagFunc(ctx, id, input)
	}
	return nil, nil
}

func (m *mockService) DeleteTag(ctx context.Context, id int64) error {
	if m.deleteTagFunc != nil {
		return m.deleteTagFunc(ctx, id)
	}
	return nil
}

func (m *mockService) GetTagByID(ctx context.Context, id int64) (*models.Tag, error) {
	if m.getTagByIDFunc != nil {
		return m.getTagByIDFunc(ctx, id)
	}
	return nil, nil
}

func (m *mockService) GetTagBySlug(ctx context.Context, slug string) (*models.Tag, error) {
	if m.getTagBySlugFunc != nil {
		return m.getTagBySlugFunc(ctx, slug)
	}
	return nil, nil
}

func (m *mockService) ListTags(ctx context.Context) ([]models.Tag, error) {
	if m.listTagsFunc != nil {
		return m.listTagsFunc(ctx)
	}
	return nil, nil
}

func (m *mockService) GetOrCreateTag(ctx context.Context, name, slug string) (*models.Tag, error) {
	if m.getOrCreateTagFunc != nil {
		return m.getOrCreateTagFunc(ctx, name, slug)
	}
	return nil, nil
}

func (m *mockService) GetTagsWithCounts(ctx context.Context) ([]service.TagWithCount, error) {
	if m.getTagsWithCountsFunc != nil {
		return m.getTagsWithCountsFunc(ctx)
	}
	return nil, nil
}

func (m *mockService) GetPostsByTagID(ctx context.Context, tagID int64) ([]service.TagPost, error) {
	if m.getPostsByTagIDFunc != nil {
		return m.getPostsByTagIDFunc(ctx, tagID)
	}
	return nil, nil
}

func (m *mockService) GetDashboardStats(ctx context.Context) (*service.DashboardStats, error) {
	if m.getDashboardStatsFunc != nil {
		return m.getDashboardStatsFunc(ctx)
	}
	return nil, nil
}

func (m *mockService) LogActivity(ctx context.Context, action, entityType string, entityID int64, title string, metadata map[string]interface{}) (*service.Activity, error) {
	if m.logActivityFunc != nil {
		return m.logActivityFunc(ctx, action, entityType, entityID, title, metadata)
	}
	return nil, nil
}

func (m *mockService) ListRecentActivities(ctx context.Context, limit, offset int) ([]service.Activity, error) {
	if m.listRecentActivitiesFunc != nil {
		return m.listRecentActivitiesFunc(ctx, limit, offset)
	}
	return nil, nil
}

func (m *mockService) CountActivities(ctx context.Context) (int, error) {
	if m.countActivitiesFunc != nil {
		return m.countActivitiesFunc(ctx)
	}
	return 0, nil
}

func (m *mockService) DeleteActivitiesForEntity(ctx context.Context, entityType string, entityID int64) error {
	if m.deleteActivitiesForEntityFunc != nil {
		return m.deleteActivitiesForEntityFunc(ctx, entityType, entityID)
	}
	return nil
}

func (m *mockService) FetchPageMetadata(ctx context.Context, url string) (*service.PageMetadata, error) {
	if m.fetchPageMetadataFunc != nil {
		return m.fetchPageMetadataFunc(ctx, url)
	}
	return nil, nil
}

func (m *mockService) ImportBookmarks(ctx context.Context, bookmarks []service.ImportedBookmark, defaultCollectionID *int64) (*service.ImportResult, error) {
	if m.importBookmarksFunc != nil {
		return m.importBookmarksFunc(ctx, bookmarks, defaultCollectionID)
	}
	return nil, nil
}
