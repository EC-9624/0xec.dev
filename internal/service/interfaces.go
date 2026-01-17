package service

import (
	"context"
	"time"

	"github.com/EC-9624/0xec.dev/internal/models"
)

// ============================================
// SERVICE INTERFACES
// ============================================
// These interfaces define the contracts for the service layer.
// They enable dependency injection and make the code testable.

// UserService defines user and session management operations
type UserService interface {
	CreateUser(ctx context.Context, username, password string) (*models.User, error)
	GetUserByID(ctx context.Context, id int64) (*models.User, error)
	GetUserByUsername(ctx context.Context, username string) (*models.User, error)
	ValidatePassword(user *models.User, password string) bool
	CreateSession(ctx context.Context, userID int64, duration time.Duration) (*models.Session, error)
	GetSession(ctx context.Context, sessionID string) (*models.Session, error)
	DeleteSession(ctx context.Context, sessionID string) error
	RotateSession(ctx context.Context, userID int64, oldSessionID string, duration time.Duration) (*models.Session, error)
	CleanupExpiredSessions(ctx context.Context) error
	EnsureAdminExists(ctx context.Context, username, password string) error
}

// BookmarkService defines bookmark management operations
type BookmarkService interface {
	CreateBookmark(ctx context.Context, input models.CreateBookmarkInput) (*models.Bookmark, error)
	UpdateBookmark(ctx context.Context, id int64, input models.UpdateBookmarkInput) (*models.Bookmark, error)
	DeleteBookmark(ctx context.Context, id int64) error
	GetBookmarkByID(ctx context.Context, id int64) (*models.Bookmark, error)
	GetBookmarkByURL(ctx context.Context, url string) (*models.Bookmark, error)
	ListBookmarks(ctx context.Context, opts BookmarkListOptions) ([]models.Bookmark, error)
	CountBookmarks(ctx context.Context, opts BookmarkListOptions) (int, error)
	UpdateBookmarkPublic(ctx context.Context, id int64, isPublic bool) error
	UpdateBookmarkFavorite(ctx context.Context, id int64, isFavorite bool) error
	UpdateBookmarkCollection(ctx context.Context, id int64, collectionID *int64) error
	UpdateBookmarkTitle(ctx context.Context, id int64, title string) error
	RefreshBookmarkMetadata(ctx context.Context, id int64) error
	RefreshAllMissingMetadataAsync(progressChan chan<- string)
}

// ImportService defines bookmark import operations
type ImportService interface {
	ImportBookmarks(ctx context.Context, bookmarks []ImportedBookmark, defaultCollectionID *int64) (*ImportResult, error)
}

// PostService defines post management operations
type PostService interface {
	CreatePost(ctx context.Context, input models.CreatePostInput) (*models.Post, error)
	UpdatePost(ctx context.Context, id int64, input models.UpdatePostInput) (*models.Post, error)
	DeletePost(ctx context.Context, id int64) error
	GetPostByID(ctx context.Context, id int64) (*models.Post, error)
	GetPostBySlug(ctx context.Context, slug string) (*models.Post, error)
	ListPosts(ctx context.Context, publishedOnly bool, limit, offset int) ([]models.Post, error)
	CountPosts(ctx context.Context, publishedOnly bool) (int, error)
	UpdatePostDraft(ctx context.Context, id int64, isDraft bool) error
}

// CollectionService defines collection management operations
type CollectionService interface {
	CreateCollection(ctx context.Context, input models.CreateCollectionInput) (*models.Collection, error)
	UpdateCollection(ctx context.Context, id int64, input models.UpdateCollectionInput) (*models.Collection, error)
	DeleteCollection(ctx context.Context, id int64) error
	GetCollectionByID(ctx context.Context, id int64) (*models.Collection, error)
	GetCollectionBySlug(ctx context.Context, slug string) (*models.Collection, error)
	ListCollections(ctx context.Context, publicOnly bool) ([]models.Collection, error)
	UpdateCollectionName(ctx context.Context, id int64, name string) error
	UpdateCollectionPublic(ctx context.Context, id int64, isPublic bool) error
	GetBookmarksByCollectionID(ctx context.Context, collectionID int64) ([]CollectionBookmark, error)
}

// TagService defines tag management operations
type TagService interface {
	CreateTag(ctx context.Context, input models.CreateTagInput) (*models.Tag, error)
	UpdateTag(ctx context.Context, id int64, input models.CreateTagInput) (*models.Tag, error)
	DeleteTag(ctx context.Context, id int64) error
	GetTagByID(ctx context.Context, id int64) (*models.Tag, error)
	GetTagBySlug(ctx context.Context, slug string) (*models.Tag, error)
	ListTags(ctx context.Context) ([]models.Tag, error)
	GetOrCreateTag(ctx context.Context, name, slug string) (*models.Tag, error)
	GetTagsWithCounts(ctx context.Context) ([]TagWithCount, error)
	GetPostsByTagID(ctx context.Context, tagID int64) ([]TagPost, error)
}

// StatsService defines statistics operations
type StatsService interface {
	GetDashboardStats(ctx context.Context) (*DashboardStats, error)
}

// ActivityService defines activity logging operations
type ActivityService interface {
	LogActivity(ctx context.Context, action, entityType string, entityID int64, title string, metadata map[string]interface{}) (*Activity, error)
	ListRecentActivities(ctx context.Context, limit, offset int) ([]Activity, error)
	CountActivities(ctx context.Context) (int, error)
	DeleteActivitiesForEntity(ctx context.Context, entityType string, entityID int64) error
}

// MetadataService defines URL metadata fetching operations
type MetadataService interface {
	FetchPageMetadata(ctx context.Context, url string) (*PageMetadata, error)
}

// ============================================
// COMPOSITE SERVICE INTERFACE
// ============================================

// ServiceInterface combines all service interfaces.
// Use this when you need access to all service functionality.
type ServiceInterface interface {
	UserService
	BookmarkService
	PostService
	CollectionService
	TagService
	StatsService
	ActivityService
	MetadataService
	ImportService
}

// Ensure Service implements ServiceInterface at compile time
var _ ServiceInterface = (*Service)(nil)
