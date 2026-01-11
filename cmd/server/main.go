package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"github.com/EC-9624/0xec.dev/internal/config"
	"github.com/EC-9624/0xec.dev/internal/database"
	"github.com/EC-9624/0xec.dev/internal/handlers"
	"github.com/EC-9624/0xec.dev/internal/middleware"
)

func main() {
	// Load configuration
	cfg := config.Load()

	// Initialize database
	if err := database.Init(cfg.DatabaseURL); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer database.Close()

	// Create handlers
	h := handlers.New(cfg, database.DB)

	// Ensure admin user exists
	if err := h.Service().EnsureAdminExists(context.Background(), cfg.AdminUser, cfg.AdminPass); err != nil {
		log.Printf("Warning: Failed to ensure admin user exists: %v", err)
	}

	// Create router
	mux := http.NewServeMux()

	// Static files
	staticDir := "./web/static"
	mux.Handle("GET /static/", http.StripPrefix("/static/", http.FileServer(http.Dir(staticDir))))

	// ============================================
	// PUBLIC ROUTES
	// ============================================

	mux.HandleFunc("GET /{$}", h.Home)
	mux.HandleFunc("GET /posts", h.PostsIndex)
	mux.HandleFunc("GET /posts/{slug}", h.PostShow)
	mux.HandleFunc("GET /bookmarks", h.BookmarksIndex)
	mux.HandleFunc("GET /bookmarks/{slug}", h.BookmarksByCollection)

	// HTMX partial routes
	mux.HandleFunc("GET /htmx/posts/{slug}", h.HTMXPostContent)
	mux.HandleFunc("GET /htmx/bookmarks", h.HTMXBookmarksContent)
	mux.HandleFunc("GET /htmx/bookmarks/more", h.HTMXBookmarksMore)
	mux.HandleFunc("GET /htmx/bookmarks/more/{slug}", h.HTMXBookmarksMore)
	mux.HandleFunc("GET /htmx/bookmarks/{slug}", h.HTMXBookmarksCollectionContent)

	// RSS feeds
	mux.HandleFunc("GET /feed.xml", h.PostsFeed)
	mux.HandleFunc("GET /posts/feed.xml", h.PostsFeed)
	mux.HandleFunc("GET /bookmarks/feed.xml", h.BookmarksFeed)

	// ============================================
	// AUTH ROUTES
	// ============================================

	mux.HandleFunc("GET /admin/login", h.LoginPage)
	mux.HandleFunc("POST /admin/login", h.Login)
	mux.HandleFunc("POST /admin/logout", h.Logout)

	// ============================================
	// ADMIN ROUTES (protected)
	// ============================================

	adminMux := http.NewServeMux()

	// Dashboard
	adminMux.HandleFunc("GET /admin", h.AdminDashboard)
	adminMux.HandleFunc("GET /admin/", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/admin", http.StatusSeeOther)
	})

	// Posts admin
	adminMux.HandleFunc("GET /admin/posts", h.AdminPostsList)
	adminMux.HandleFunc("POST /admin/posts", h.AdminPostCreate)
	adminMux.HandleFunc("GET /admin/posts/new", h.AdminPostNew)
	adminMux.HandleFunc("GET /admin/posts/{slug}/edit", h.AdminPostEdit)
	adminMux.HandleFunc("POST /admin/posts/{slug}", h.AdminPostUpdate)
	adminMux.HandleFunc("DELETE /admin/posts/{slug}", h.AdminPostDelete)

	// Bookmarks admin
	adminMux.HandleFunc("GET /admin/bookmarks", h.AdminBookmarksList)
	adminMux.HandleFunc("POST /admin/bookmarks", h.AdminBookmarkCreate)
	adminMux.HandleFunc("GET /admin/bookmarks/new", h.AdminBookmarkNew)
	adminMux.HandleFunc("POST /admin/bookmarks/fetch-metadata", h.AdminBookmarkFetchMetadata)
	adminMux.HandleFunc("GET /admin/bookmarks/refresh-all", h.AdminRefreshAllMetadata)
	adminMux.HandleFunc("GET /admin/bookmarks/{id}/edit", h.AdminBookmarkEdit)
	adminMux.HandleFunc("POST /admin/bookmarks/{id}", h.AdminBookmarkUpdate)
	adminMux.HandleFunc("DELETE /admin/bookmarks/{id}", h.AdminBookmarkDelete)
	adminMux.HandleFunc("POST /admin/bookmarks/{id}/refresh", h.AdminRefreshBookmarkMetadata)
	// Inline editing routes (HTMX)
	adminMux.HandleFunc("POST /admin/bookmarks/{id}/toggle-public", h.AdminToggleBookmarkPublic)
	adminMux.HandleFunc("POST /admin/bookmarks/{id}/toggle-favorite", h.AdminToggleBookmarkFavorite)
	adminMux.HandleFunc("POST /admin/bookmarks/{id}/collection", h.AdminUpdateBookmarkCollection)
	adminMux.HandleFunc("GET /admin/bookmarks/{id}/edit-title", h.AdminGetBookmarkTitleEdit)
	adminMux.HandleFunc("POST /admin/bookmarks/{id}/title", h.AdminUpdateBookmarkTitle)

	// Import
	adminMux.HandleFunc("GET /admin/import", h.AdminImportPage)
	adminMux.HandleFunc("POST /admin/import", h.AdminImportBookmarks)

	// Collections admin
	adminMux.HandleFunc("GET /admin/collections", h.AdminCollectionsList)
	adminMux.HandleFunc("POST /admin/collections", h.AdminCollectionCreate)
	adminMux.HandleFunc("GET /admin/collections/new", h.AdminCollectionNew)
	adminMux.HandleFunc("GET /admin/collections/{id}/edit", h.AdminCollectionEdit)
	adminMux.HandleFunc("POST /admin/collections/{id}", h.AdminCollectionUpdate)
	adminMux.HandleFunc("DELETE /admin/collections/{id}", h.AdminCollectionDelete)

	// Wrap admin routes with auth middleware
	authMiddleware := middleware.Auth(h.Service())
	mux.Handle("/admin", authMiddleware(adminMux))
	mux.Handle("/admin/", authMiddleware(adminMux))

	// Apply global middleware
	handler := middleware.Logger(middleware.Recoverer(mux))

	// Get absolute path for static directory
	if absPath, err := filepath.Abs(staticDir); err == nil {
		if _, err := os.Stat(absPath); os.IsNotExist(err) {
			log.Printf("Warning: Static directory does not exist: %s", absPath)
		}
	}

	// Start server
	addr := ":" + cfg.Port
	log.Printf("Starting server on http://localhost%s", addr)
	log.Printf("Admin panel: http://localhost%s/admin", addr)
	log.Printf("Default credentials: %s / %s", cfg.AdminUser, cfg.AdminPass)

	if err := http.ListenAndServe(addr, handler); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
