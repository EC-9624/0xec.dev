package service

import (
	"context"
	"time"
)

// DashboardStats contains all statistics for the admin dashboard
type DashboardStats struct {
	// Total counts
	TotalBookmarks   int
	TotalPosts       int
	TotalCollections int
	TotalTags        int

	// This week counts (for trend indicators)
	BookmarksThisWeek int
	PostsThisWeek     int

	// Draft posts count
	DraftPosts int

	// Distribution data
	BookmarksByCollection []CollectionCount
}

// CollectionCount represents bookmarks count per collection
type CollectionCount struct {
	Name  string
	Color string
	Count int
}

// GetDashboardStats retrieves all stats needed for the dashboard
func (s *Service) GetDashboardStats(ctx context.Context) (*DashboardStats, error) {
	// Get total counts
	dbStats, err := s.queries.GetDatabaseStats(ctx)
	if err != nil {
		return nil, err
	}

	stats := &DashboardStats{
		TotalBookmarks:   int(dbStats.TotalBookmarks),
		TotalPosts:       int(dbStats.TotalPosts),
		TotalCollections: int(dbStats.TotalCollections),
		TotalTags:        int(dbStats.TotalTags),
	}

	// Get counts for this week
	weekAgo := time.Now().AddDate(0, 0, -7)
	bookmarksThisWeek, err := s.queries.GetBookmarksCreatedSince(ctx, &weekAgo)
	if err == nil {
		stats.BookmarksThisWeek = int(bookmarksThisWeek)
	}

	postsThisWeek, err := s.queries.GetPostsCreatedSince(ctx, &weekAgo)
	if err == nil {
		stats.PostsThisWeek = int(postsThisWeek)
	}

	// Get bookmarks by collection (top 8)
	collectionCounts, err := s.queries.GetBookmarkCountsByCollection(ctx, 8)
	if err == nil {
		stats.BookmarksByCollection = make([]CollectionCount, 0, len(collectionCounts))
		for _, c := range collectionCounts {
			stats.BookmarksByCollection = append(stats.BookmarksByCollection, CollectionCount{
				Name:  c.CollectionName,
				Color: c.CollectionColor,
				Count: int(c.BookmarkCount),
			})
		}
	}

	// Get draft posts count
	draftCount, err := s.queries.CountDraftPosts(ctx)
	if err == nil {
		stats.DraftPosts = int(draftCount)
	}

	return stats, nil
}
