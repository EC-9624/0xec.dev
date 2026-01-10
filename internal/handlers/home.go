package handlers

import (
	"net/http"

	"github.com/EC-9624/0xec.dev/internal/service"
	"github.com/EC-9624/0xec.dev/web/templates/pages"
)

// Home handles the home page
func (h *Handlers) Home(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}

	ctx := r.Context()

	// Get recent posts
	posts, err := h.service.ListPosts(ctx, true, 5, 0)
	if err != nil {
		http.Error(w, "Failed to load posts", http.StatusInternalServerError)
		return
	}

	// Get recent bookmarks
	bookmarks, err := h.service.ListBookmarks(ctx, service.BookmarkListOptions{
		PublicOnly: true,
		Limit:      6,
		Offset:     0,
	})
	if err != nil {
		http.Error(w, "Failed to load bookmarks", http.StatusInternalServerError)
		return
	}

	render(w, r, pages.Home(posts, bookmarks))
}
