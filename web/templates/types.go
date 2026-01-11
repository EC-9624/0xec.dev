package templates

import "github.com/EC-9624/0xec.dev/internal/models"

// BookmarksData holds all data needed for bookmarks pages
type BookmarksData struct {
	Bookmarks        []models.Bookmark
	Collections      []models.Collection
	ActiveCollection *models.Collection
	Total            int
	Page             int
	HasMore          bool
}

// PostData holds all data needed for post pages
type PostData struct {
	Post        *models.Post
	AllPosts    []models.Post
	ContentHTML string
}
