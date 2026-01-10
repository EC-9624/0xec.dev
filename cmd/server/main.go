package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

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
	mux.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir(staticDir))))

	// Public routes
	mux.HandleFunc("/", h.Home)
	mux.HandleFunc("/posts", h.PostsIndex)
	mux.HandleFunc("/posts/", h.PostShow)
	mux.HandleFunc("/bookmarks", h.BookmarksIndex)
	mux.HandleFunc("/bookmarks/", h.BookmarksByCollection)

	// RSS feeds
	mux.HandleFunc("/feed.xml", h.PostsFeed)
	mux.HandleFunc("/posts/feed.xml", h.PostsFeed)
	mux.HandleFunc("/bookmarks/feed.xml", h.BookmarksFeed)

	// Auth routes
	mux.HandleFunc("/admin/login", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			h.Login(w, r)
		} else {
			h.LoginPage(w, r)
		}
	})
	mux.HandleFunc("/admin/logout", h.Logout)

	// Admin routes (protected)
	adminMux := http.NewServeMux()

	// Dashboard
	adminMux.HandleFunc("/admin", h.AdminDashboard)
	adminMux.HandleFunc("/admin/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/admin/" {
			http.Redirect(w, r, "/admin", http.StatusSeeOther)
			return
		}
		http.NotFound(w, r)
	})

	// Posts admin
	adminMux.HandleFunc("/admin/posts", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			h.AdminPostCreate(w, r)
		} else {
			h.AdminPostsList(w, r)
		}
	})
	adminMux.HandleFunc("/admin/posts/new", h.AdminPostNew)
	adminMux.HandleFunc("/admin/posts/", func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		switch {
		case strings.HasSuffix(path, "/edit"):
			h.AdminPostEdit(w, r)
		case r.Method == http.MethodPost:
			h.AdminPostUpdate(w, r)
		case r.Method == http.MethodDelete:
			h.AdminPostDelete(w, r)
		default:
			http.NotFound(w, r)
		}
	})

	// Bookmarks admin
	adminMux.HandleFunc("/admin/bookmarks", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			h.AdminBookmarkCreate(w, r)
		} else {
			h.AdminBookmarksList(w, r)
		}
	})
	adminMux.HandleFunc("/admin/bookmarks/new", h.AdminBookmarkNew)
	adminMux.HandleFunc("/admin/bookmarks/", func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		switch {
		case strings.HasSuffix(path, "/edit"):
			h.AdminBookmarkEdit(w, r)
		case r.Method == http.MethodPost:
			h.AdminBookmarkUpdate(w, r)
		case r.Method == http.MethodDelete:
			h.AdminBookmarkDelete(w, r)
		default:
			http.NotFound(w, r)
		}
	})

	// Collections admin
	adminMux.HandleFunc("/admin/collections", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			h.AdminCollectionCreate(w, r)
		} else {
			h.AdminCollectionsList(w, r)
		}
	})
	adminMux.HandleFunc("/admin/collections/new", h.AdminCollectionNew)
	adminMux.HandleFunc("/admin/collections/", func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		switch {
		case strings.HasSuffix(path, "/edit"):
			h.AdminCollectionEdit(w, r)
		case r.Method == http.MethodPost:
			h.AdminCollectionUpdate(w, r)
		case r.Method == http.MethodDelete:
			h.AdminCollectionDelete(w, r)
		default:
			http.NotFound(w, r)
		}
	})

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
