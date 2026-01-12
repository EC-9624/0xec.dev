package service

import (
	"context"
	"time"

	"github.com/EC-9624/0xec.dev/internal/models"
)

// MockService is a test double for ServiceInterface.
// Each method can be overridden by setting the corresponding function field.
// If a function field is nil, the method returns zero values or errors.
type MockService struct {
	// User methods
	CreateUserFunc             func(ctx context.Context, username, password string) (*models.User, error)
	GetUserByIDFunc            func(ctx context.Context, id int64) (*models.User, error)
	GetUserByUsernameFunc      func(ctx context.Context, username string) (*models.User, error)
	ValidatePasswordFunc       func(user *models.User, password string) bool
	CreateSessionFunc          func(ctx context.Context, userID int64, duration time.Duration) (*models.Session, error)
	GetSessionFunc             func(ctx context.Context, sessionID string) (*models.Session, error)
	DeleteSessionFunc          func(ctx context.Context, sessionID string) error
	CleanupExpiredSessionsFunc func(ctx context.Context) error
	EnsureAdminExistsFunc      func(ctx context.Context, username, password string) error

	// Bookmark methods
	CreateBookmarkFunc                 func(ctx context.Context, input models.CreateBookmarkInput) (*models.Bookmark, error)
	UpdateBookmarkFunc                 func(ctx context.Context, id int64, input models.UpdateBookmarkInput) (*models.Bookmark, error)
	DeleteBookmarkFunc                 func(ctx context.Context, id int64) error
	GetBookmarkByIDFunc                func(ctx context.Context, id int64) (*models.Bookmark, error)
	GetBookmarkByURLFunc               func(ctx context.Context, url string) (*models.Bookmark, error)
	ListBookmarksFunc                  func(ctx context.Context, opts BookmarkListOptions) ([]models.Bookmark, error)
	CountBookmarksFunc                 func(ctx context.Context, opts BookmarkListOptions) (int, error)
	UpdateBookmarkPublicFunc           func(ctx context.Context, id int64, isPublic bool) error
	UpdateBookmarkFavoriteFunc         func(ctx context.Context, id int64, isFavorite bool) error
	UpdateBookmarkCollectionFunc       func(ctx context.Context, id int64, collectionID *int64) error
	UpdateBookmarkTitleFunc            func(ctx context.Context, id int64, title string) error
	RefreshBookmarkMetadataFunc        func(ctx context.Context, id int64) error
	RefreshAllMissingMetadataAsyncFunc func(progressChan chan<- string)

	// Import methods
	ImportBookmarksFunc func(ctx context.Context, bookmarks []ImportedBookmark, defaultCollectionID *int64) (*ImportResult, error)

	// Post methods
	CreatePostFunc      func(ctx context.Context, input models.CreatePostInput) (*models.Post, error)
	UpdatePostFunc      func(ctx context.Context, id int64, input models.UpdatePostInput) (*models.Post, error)
	DeletePostFunc      func(ctx context.Context, id int64) error
	GetPostByIDFunc     func(ctx context.Context, id int64) (*models.Post, error)
	GetPostBySlugFunc   func(ctx context.Context, slug string) (*models.Post, error)
	ListPostsFunc       func(ctx context.Context, publishedOnly bool, limit, offset int) ([]models.Post, error)
	CountPostsFunc      func(ctx context.Context, publishedOnly bool) (int, error)
	UpdatePostDraftFunc func(ctx context.Context, id int64, isDraft bool) error

	// Collection methods
	CreateCollectionFunc           func(ctx context.Context, input models.CreateCollectionInput) (*models.Collection, error)
	UpdateCollectionFunc           func(ctx context.Context, id int64, input models.UpdateCollectionInput) (*models.Collection, error)
	DeleteCollectionFunc           func(ctx context.Context, id int64) error
	GetCollectionByIDFunc          func(ctx context.Context, id int64) (*models.Collection, error)
	GetCollectionBySlugFunc        func(ctx context.Context, slug string) (*models.Collection, error)
	ListCollectionsFunc            func(ctx context.Context, publicOnly bool) ([]models.Collection, error)
	UpdateCollectionNameFunc       func(ctx context.Context, id int64, name string) error
	UpdateCollectionPublicFunc     func(ctx context.Context, id int64, isPublic bool) error
	GetBookmarksByCollectionIDFunc func(ctx context.Context, collectionID int64) ([]CollectionBookmark, error)

	// Tag methods
	CreateTagFunc         func(ctx context.Context, input models.CreateTagInput) (*models.Tag, error)
	UpdateTagFunc         func(ctx context.Context, id int64, input models.CreateTagInput) (*models.Tag, error)
	DeleteTagFunc         func(ctx context.Context, id int64) error
	GetTagByIDFunc        func(ctx context.Context, id int64) (*models.Tag, error)
	GetTagBySlugFunc      func(ctx context.Context, slug string) (*models.Tag, error)
	ListTagsFunc          func(ctx context.Context) ([]models.Tag, error)
	GetOrCreateTagFunc    func(ctx context.Context, name, slug string) (*models.Tag, error)
	GetTagsWithCountsFunc func(ctx context.Context) ([]TagWithCount, error)
	GetPostsByTagIDFunc   func(ctx context.Context, tagID int64) ([]TagPost, error)

	// Stats methods
	GetDashboardStatsFunc func(ctx context.Context) (*DashboardStats, error)

	// Activity methods
	LogActivityFunc               func(ctx context.Context, action, entityType string, entityID int64, title string, metadata map[string]interface{}) (*Activity, error)
	ListRecentActivitiesFunc      func(ctx context.Context, limit, offset int) ([]Activity, error)
	CountActivitiesFunc           func(ctx context.Context) (int, error)
	DeleteActivitiesForEntityFunc func(ctx context.Context, entityType string, entityID int64) error

	// Metadata methods
	FetchPageMetadataFunc func(ctx context.Context, url string) (*PageMetadata, error)
}

// Ensure MockService implements ServiceInterface
var _ ServiceInterface = (*MockService)(nil)

// ============================================
// USER SERVICE METHODS
// ============================================

func (m *MockService) CreateUser(ctx context.Context, username, password string) (*models.User, error) {
	if m.CreateUserFunc != nil {
		return m.CreateUserFunc(ctx, username, password)
	}
	return nil, nil
}

func (m *MockService) GetUserByID(ctx context.Context, id int64) (*models.User, error) {
	if m.GetUserByIDFunc != nil {
		return m.GetUserByIDFunc(ctx, id)
	}
	return nil, nil
}

func (m *MockService) GetUserByUsername(ctx context.Context, username string) (*models.User, error) {
	if m.GetUserByUsernameFunc != nil {
		return m.GetUserByUsernameFunc(ctx, username)
	}
	return nil, nil
}

func (m *MockService) ValidatePassword(user *models.User, password string) bool {
	if m.ValidatePasswordFunc != nil {
		return m.ValidatePasswordFunc(user, password)
	}
	return false
}

func (m *MockService) CreateSession(ctx context.Context, userID int64, duration time.Duration) (*models.Session, error) {
	if m.CreateSessionFunc != nil {
		return m.CreateSessionFunc(ctx, userID, duration)
	}
	return nil, nil
}

func (m *MockService) GetSession(ctx context.Context, sessionID string) (*models.Session, error) {
	if m.GetSessionFunc != nil {
		return m.GetSessionFunc(ctx, sessionID)
	}
	return nil, nil
}

func (m *MockService) DeleteSession(ctx context.Context, sessionID string) error {
	if m.DeleteSessionFunc != nil {
		return m.DeleteSessionFunc(ctx, sessionID)
	}
	return nil
}

func (m *MockService) CleanupExpiredSessions(ctx context.Context) error {
	if m.CleanupExpiredSessionsFunc != nil {
		return m.CleanupExpiredSessionsFunc(ctx)
	}
	return nil
}

func (m *MockService) EnsureAdminExists(ctx context.Context, username, password string) error {
	if m.EnsureAdminExistsFunc != nil {
		return m.EnsureAdminExistsFunc(ctx, username, password)
	}
	return nil
}

// ============================================
// BOOKMARK SERVICE METHODS
// ============================================

func (m *MockService) CreateBookmark(ctx context.Context, input models.CreateBookmarkInput) (*models.Bookmark, error) {
	if m.CreateBookmarkFunc != nil {
		return m.CreateBookmarkFunc(ctx, input)
	}
	return nil, nil
}

func (m *MockService) UpdateBookmark(ctx context.Context, id int64, input models.UpdateBookmarkInput) (*models.Bookmark, error) {
	if m.UpdateBookmarkFunc != nil {
		return m.UpdateBookmarkFunc(ctx, id, input)
	}
	return nil, nil
}

func (m *MockService) DeleteBookmark(ctx context.Context, id int64) error {
	if m.DeleteBookmarkFunc != nil {
		return m.DeleteBookmarkFunc(ctx, id)
	}
	return nil
}

func (m *MockService) GetBookmarkByID(ctx context.Context, id int64) (*models.Bookmark, error) {
	if m.GetBookmarkByIDFunc != nil {
		return m.GetBookmarkByIDFunc(ctx, id)
	}
	return nil, nil
}

func (m *MockService) GetBookmarkByURL(ctx context.Context, url string) (*models.Bookmark, error) {
	if m.GetBookmarkByURLFunc != nil {
		return m.GetBookmarkByURLFunc(ctx, url)
	}
	return nil, nil
}

func (m *MockService) ListBookmarks(ctx context.Context, opts BookmarkListOptions) ([]models.Bookmark, error) {
	if m.ListBookmarksFunc != nil {
		return m.ListBookmarksFunc(ctx, opts)
	}
	return nil, nil
}

func (m *MockService) CountBookmarks(ctx context.Context, opts BookmarkListOptions) (int, error) {
	if m.CountBookmarksFunc != nil {
		return m.CountBookmarksFunc(ctx, opts)
	}
	return 0, nil
}

func (m *MockService) UpdateBookmarkPublic(ctx context.Context, id int64, isPublic bool) error {
	if m.UpdateBookmarkPublicFunc != nil {
		return m.UpdateBookmarkPublicFunc(ctx, id, isPublic)
	}
	return nil
}

func (m *MockService) UpdateBookmarkFavorite(ctx context.Context, id int64, isFavorite bool) error {
	if m.UpdateBookmarkFavoriteFunc != nil {
		return m.UpdateBookmarkFavoriteFunc(ctx, id, isFavorite)
	}
	return nil
}

func (m *MockService) UpdateBookmarkCollection(ctx context.Context, id int64, collectionID *int64) error {
	if m.UpdateBookmarkCollectionFunc != nil {
		return m.UpdateBookmarkCollectionFunc(ctx, id, collectionID)
	}
	return nil
}

func (m *MockService) UpdateBookmarkTitle(ctx context.Context, id int64, title string) error {
	if m.UpdateBookmarkTitleFunc != nil {
		return m.UpdateBookmarkTitleFunc(ctx, id, title)
	}
	return nil
}

func (m *MockService) RefreshBookmarkMetadata(ctx context.Context, id int64) error {
	if m.RefreshBookmarkMetadataFunc != nil {
		return m.RefreshBookmarkMetadataFunc(ctx, id)
	}
	return nil
}

func (m *MockService) RefreshAllMissingMetadataAsync(progressChan chan<- string) {
	if m.RefreshAllMissingMetadataAsyncFunc != nil {
		m.RefreshAllMissingMetadataAsyncFunc(progressChan)
	}
}

// ============================================
// IMPORT SERVICE METHODS
// ============================================

func (m *MockService) ImportBookmarks(ctx context.Context, bookmarks []ImportedBookmark, defaultCollectionID *int64) (*ImportResult, error) {
	if m.ImportBookmarksFunc != nil {
		return m.ImportBookmarksFunc(ctx, bookmarks, defaultCollectionID)
	}
	return nil, nil
}

// ============================================
// POST SERVICE METHODS
// ============================================

func (m *MockService) CreatePost(ctx context.Context, input models.CreatePostInput) (*models.Post, error) {
	if m.CreatePostFunc != nil {
		return m.CreatePostFunc(ctx, input)
	}
	return nil, nil
}

func (m *MockService) UpdatePost(ctx context.Context, id int64, input models.UpdatePostInput) (*models.Post, error) {
	if m.UpdatePostFunc != nil {
		return m.UpdatePostFunc(ctx, id, input)
	}
	return nil, nil
}

func (m *MockService) DeletePost(ctx context.Context, id int64) error {
	if m.DeletePostFunc != nil {
		return m.DeletePostFunc(ctx, id)
	}
	return nil
}

func (m *MockService) GetPostByID(ctx context.Context, id int64) (*models.Post, error) {
	if m.GetPostByIDFunc != nil {
		return m.GetPostByIDFunc(ctx, id)
	}
	return nil, nil
}

func (m *MockService) GetPostBySlug(ctx context.Context, slug string) (*models.Post, error) {
	if m.GetPostBySlugFunc != nil {
		return m.GetPostBySlugFunc(ctx, slug)
	}
	return nil, nil
}

func (m *MockService) ListPosts(ctx context.Context, publishedOnly bool, limit, offset int) ([]models.Post, error) {
	if m.ListPostsFunc != nil {
		return m.ListPostsFunc(ctx, publishedOnly, limit, offset)
	}
	return nil, nil
}

func (m *MockService) CountPosts(ctx context.Context, publishedOnly bool) (int, error) {
	if m.CountPostsFunc != nil {
		return m.CountPostsFunc(ctx, publishedOnly)
	}
	return 0, nil
}

func (m *MockService) UpdatePostDraft(ctx context.Context, id int64, isDraft bool) error {
	if m.UpdatePostDraftFunc != nil {
		return m.UpdatePostDraftFunc(ctx, id, isDraft)
	}
	return nil
}

// ============================================
// COLLECTION SERVICE METHODS
// ============================================

func (m *MockService) CreateCollection(ctx context.Context, input models.CreateCollectionInput) (*models.Collection, error) {
	if m.CreateCollectionFunc != nil {
		return m.CreateCollectionFunc(ctx, input)
	}
	return nil, nil
}

func (m *MockService) UpdateCollection(ctx context.Context, id int64, input models.UpdateCollectionInput) (*models.Collection, error) {
	if m.UpdateCollectionFunc != nil {
		return m.UpdateCollectionFunc(ctx, id, input)
	}
	return nil, nil
}

func (m *MockService) DeleteCollection(ctx context.Context, id int64) error {
	if m.DeleteCollectionFunc != nil {
		return m.DeleteCollectionFunc(ctx, id)
	}
	return nil
}

func (m *MockService) GetCollectionByID(ctx context.Context, id int64) (*models.Collection, error) {
	if m.GetCollectionByIDFunc != nil {
		return m.GetCollectionByIDFunc(ctx, id)
	}
	return nil, nil
}

func (m *MockService) GetCollectionBySlug(ctx context.Context, slug string) (*models.Collection, error) {
	if m.GetCollectionBySlugFunc != nil {
		return m.GetCollectionBySlugFunc(ctx, slug)
	}
	return nil, nil
}

func (m *MockService) ListCollections(ctx context.Context, publicOnly bool) ([]models.Collection, error) {
	if m.ListCollectionsFunc != nil {
		return m.ListCollectionsFunc(ctx, publicOnly)
	}
	return nil, nil
}

func (m *MockService) UpdateCollectionName(ctx context.Context, id int64, name string) error {
	if m.UpdateCollectionNameFunc != nil {
		return m.UpdateCollectionNameFunc(ctx, id, name)
	}
	return nil
}

func (m *MockService) UpdateCollectionPublic(ctx context.Context, id int64, isPublic bool) error {
	if m.UpdateCollectionPublicFunc != nil {
		return m.UpdateCollectionPublicFunc(ctx, id, isPublic)
	}
	return nil
}

func (m *MockService) GetBookmarksByCollectionID(ctx context.Context, collectionID int64) ([]CollectionBookmark, error) {
	if m.GetBookmarksByCollectionIDFunc != nil {
		return m.GetBookmarksByCollectionIDFunc(ctx, collectionID)
	}
	return nil, nil
}

// ============================================
// TAG SERVICE METHODS
// ============================================

func (m *MockService) CreateTag(ctx context.Context, input models.CreateTagInput) (*models.Tag, error) {
	if m.CreateTagFunc != nil {
		return m.CreateTagFunc(ctx, input)
	}
	return nil, nil
}

func (m *MockService) UpdateTag(ctx context.Context, id int64, input models.CreateTagInput) (*models.Tag, error) {
	if m.UpdateTagFunc != nil {
		return m.UpdateTagFunc(ctx, id, input)
	}
	return nil, nil
}

func (m *MockService) DeleteTag(ctx context.Context, id int64) error {
	if m.DeleteTagFunc != nil {
		return m.DeleteTagFunc(ctx, id)
	}
	return nil
}

func (m *MockService) GetTagByID(ctx context.Context, id int64) (*models.Tag, error) {
	if m.GetTagByIDFunc != nil {
		return m.GetTagByIDFunc(ctx, id)
	}
	return nil, nil
}

func (m *MockService) GetTagBySlug(ctx context.Context, slug string) (*models.Tag, error) {
	if m.GetTagBySlugFunc != nil {
		return m.GetTagBySlugFunc(ctx, slug)
	}
	return nil, nil
}

func (m *MockService) ListTags(ctx context.Context) ([]models.Tag, error) {
	if m.ListTagsFunc != nil {
		return m.ListTagsFunc(ctx)
	}
	return nil, nil
}

func (m *MockService) GetOrCreateTag(ctx context.Context, name, slug string) (*models.Tag, error) {
	if m.GetOrCreateTagFunc != nil {
		return m.GetOrCreateTagFunc(ctx, name, slug)
	}
	return nil, nil
}

func (m *MockService) GetTagsWithCounts(ctx context.Context) ([]TagWithCount, error) {
	if m.GetTagsWithCountsFunc != nil {
		return m.GetTagsWithCountsFunc(ctx)
	}
	return nil, nil
}

func (m *MockService) GetPostsByTagID(ctx context.Context, tagID int64) ([]TagPost, error) {
	if m.GetPostsByTagIDFunc != nil {
		return m.GetPostsByTagIDFunc(ctx, tagID)
	}
	return nil, nil
}

// ============================================
// STATS SERVICE METHODS
// ============================================

func (m *MockService) GetDashboardStats(ctx context.Context) (*DashboardStats, error) {
	if m.GetDashboardStatsFunc != nil {
		return m.GetDashboardStatsFunc(ctx)
	}
	return nil, nil
}

// ============================================
// ACTIVITY SERVICE METHODS
// ============================================

func (m *MockService) LogActivity(ctx context.Context, action, entityType string, entityID int64, title string, metadata map[string]interface{}) (*Activity, error) {
	if m.LogActivityFunc != nil {
		return m.LogActivityFunc(ctx, action, entityType, entityID, title, metadata)
	}
	return nil, nil
}

func (m *MockService) ListRecentActivities(ctx context.Context, limit, offset int) ([]Activity, error) {
	if m.ListRecentActivitiesFunc != nil {
		return m.ListRecentActivitiesFunc(ctx, limit, offset)
	}
	return nil, nil
}

func (m *MockService) CountActivities(ctx context.Context) (int, error) {
	if m.CountActivitiesFunc != nil {
		return m.CountActivitiesFunc(ctx)
	}
	return 0, nil
}

func (m *MockService) DeleteActivitiesForEntity(ctx context.Context, entityType string, entityID int64) error {
	if m.DeleteActivitiesForEntityFunc != nil {
		return m.DeleteActivitiesForEntityFunc(ctx, entityType, entityID)
	}
	return nil
}

// ============================================
// METADATA SERVICE METHODS
// ============================================

func (m *MockService) FetchPageMetadata(ctx context.Context, url string) (*PageMetadata, error) {
	if m.FetchPageMetadataFunc != nil {
		return m.FetchPageMetadataFunc(ctx, url)
	}
	return nil, nil
}
