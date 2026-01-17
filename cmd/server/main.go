package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/EC-9624/0xec.dev/internal/config"
	"github.com/EC-9624/0xec.dev/internal/database"
	"github.com/EC-9624/0xec.dev/internal/handlers"
	"github.com/EC-9624/0xec.dev/internal/logger"
	"github.com/EC-9624/0xec.dev/internal/middleware"
)

func main() {
	// Load configuration
	cfg := config.Load()

	// Initialize structured logging (must be before validation for proper log output)
	logger.Setup(cfg.Environment)

	// Validate configuration (fails fast in production with insecure defaults)
	cfg.MustValidate()

	// Initialize database
	db, err := database.Init(cfg.DatabaseURL)
	if err != nil {
		slog.Error("failed to initialize database", "error", err)
		os.Exit(1)
	}
	defer db.Close()

	// Create handlers
	h := handlers.NewWithDB(cfg, db)

	// Ensure admin user exists
	if err := h.EnsureAdminExists(context.Background(), cfg.AdminUser, cfg.AdminPass); err != nil {
		slog.Warn("failed to ensure admin user exists", "error", err)
	}

	// Create router
	mux := http.NewServeMux()

	// CSRF middleware configuration (secure cookies in production)
	csrfConfig := middleware.CSRFConfig{
		Secure: !cfg.IsDevelopment(),
	}
	csrfMiddleware := middleware.CSRF(csrfConfig)

	// Rate limiter for login endpoint (5 attempts per minute per IP)
	loginLimiter := middleware.NewRateLimiter(5.0/60.0, 5)

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

	// Health check endpoint
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		// Check database connectivity
		if err := db.Ping(); err != nil {
			w.WriteHeader(http.StatusServiceUnavailable)
			w.Write([]byte(`{"status":"unhealthy","error":"database connection failed"}`))
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"healthy"}`))
	})

	// ============================================
	// AUTH ROUTES (CSRF protected, no auth required)
	// ============================================

	// Login routes need CSRF but not auth
	// Rate limiting applied to prevent brute-force attacks
	authMux := http.NewServeMux()
	authMux.HandleFunc("GET /admin/login", h.LoginPage)
	authMux.HandleFunc("POST /admin/login", h.Login)
	mux.Handle("/admin/login", loginLimiter.Limit(csrfMiddleware(authMux)))

	// Logout needs CSRF + auth (handled via admin routes below)

	// ============================================
	// ADMIN ROUTES (CSRF + Auth protected)
	// ============================================

	adminMux := http.NewServeMux()

	// Dashboard
	adminMux.HandleFunc("GET /admin", h.AdminDashboard)
	adminMux.HandleFunc("GET /admin/", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/admin", http.StatusSeeOther)
	})

	// Logout (in admin routes so it gets auth + csrf)
	adminMux.HandleFunc("POST /admin/logout", h.Logout)

	// ============================================
	// ADMIN PAGE ROUTES
	// ============================================

	// Posts
	adminMux.HandleFunc("GET /admin/posts", h.AdminPostsList)
	adminMux.HandleFunc("POST /admin/posts", h.AdminPostCreate)
	adminMux.HandleFunc("GET /admin/posts/new", h.AdminPostNew)
	adminMux.HandleFunc("GET /admin/posts/{slug}/edit", h.AdminPostEdit)
	adminMux.HandleFunc("POST /admin/posts/{slug}", h.AdminPostUpdate)
	adminMux.HandleFunc("DELETE /admin/posts/{slug}", h.AdminPostDelete)

	// Bookmarks
	adminMux.HandleFunc("GET /admin/bookmarks", h.AdminBookmarksList)
	adminMux.HandleFunc("POST /admin/bookmarks", h.AdminBookmarkCreate)
	adminMux.HandleFunc("GET /admin/bookmarks/new", h.AdminBookmarkNew)
	adminMux.HandleFunc("GET /admin/bookmarks/{id}/edit", h.AdminBookmarkEdit)
	adminMux.HandleFunc("POST /admin/bookmarks/{id}", h.AdminBookmarkUpdate)
	adminMux.HandleFunc("DELETE /admin/bookmarks/{id}", h.AdminBookmarkDelete)

	// Import
	adminMux.HandleFunc("GET /admin/import", h.AdminImportPage)
	adminMux.HandleFunc("POST /admin/import", h.AdminImportBookmarks)

	// Collections
	adminMux.HandleFunc("GET /admin/collections", h.AdminCollectionsList)
	adminMux.HandleFunc("POST /admin/collections", h.AdminCollectionCreate)
	adminMux.HandleFunc("GET /admin/collections/new", h.AdminCollectionNew)
	adminMux.HandleFunc("GET /admin/collections/{id}/edit", h.AdminCollectionEdit)
	adminMux.HandleFunc("POST /admin/collections/{id}", h.AdminCollectionUpdate)
	adminMux.HandleFunc("DELETE /admin/collections/{id}", h.AdminCollectionDelete)

	// Tags
	adminMux.HandleFunc("GET /admin/tags", h.AdminTagsList)
	adminMux.HandleFunc("DELETE /admin/tags/{id}", h.AdminTagDelete)

	// ============================================
	// ADMIN HTMX PARTIAL ROUTES
	// ============================================

	// Posts (HTMX)
	adminMux.HandleFunc("POST /admin/htmx/posts/{id}/toggle-draft", h.AdminTogglePostDraft)

	// Bookmarks (HTMX)
	adminMux.HandleFunc("GET /admin/htmx/bookmarks/new-drawer", h.HTMXAdminBookmarkNewDrawer)
	adminMux.HandleFunc("GET /admin/htmx/bookmarks/{id}/edit-drawer", h.HTMXAdminBookmarkEditDrawer)
	adminMux.HandleFunc("POST /admin/htmx/bookmarks/fetch-metadata", h.AdminBookmarkFetchMetadata)
	adminMux.HandleFunc("GET /admin/htmx/bookmarks/refresh-all", h.AdminRefreshAllMetadata)
	adminMux.HandleFunc("POST /admin/htmx/bookmarks/{id}/refresh", h.AdminRefreshBookmarkMetadata)
	adminMux.HandleFunc("POST /admin/htmx/bookmarks/{id}/toggle-public", h.AdminToggleBookmarkPublic)
	adminMux.HandleFunc("POST /admin/htmx/bookmarks/{id}/toggle-favorite", h.AdminToggleBookmarkFavorite)
	adminMux.HandleFunc("POST /admin/htmx/bookmarks/{id}/collection", h.AdminUpdateBookmarkCollection)

	// Collections (HTMX)
	adminMux.HandleFunc("GET /admin/htmx/collections/new-drawer", h.HTMXAdminCollectionNewDrawer)
	adminMux.HandleFunc("GET /admin/htmx/collections/{id}/edit-drawer", h.HTMXAdminCollectionEditDrawer)
	adminMux.HandleFunc("GET /admin/htmx/collections/{id}/bookmarks", h.AdminCollectionBookmarks)
	adminMux.HandleFunc("POST /admin/htmx/collections/{id}/toggle-public", h.AdminToggleCollectionPublic)

	// Tags (HTMX)
	adminMux.HandleFunc("POST /admin/htmx/tags/create-inline", h.AdminTagCreateInline)
	adminMux.HandleFunc("GET /admin/htmx/tags/{id}/posts", h.AdminTagPosts)

	// Test routes (development only)
	if cfg.IsDevelopment() {
		adminMux.HandleFunc("GET /admin/test/errors", h.TestErrorPage)
		adminMux.HandleFunc("GET /admin/test/error-500", h.TestError500)
		adminMux.HandleFunc("GET /admin/test/slow", h.TestSlow)
		adminMux.HandleFunc("GET /admin/test/success", h.TestSuccess)
		adminMux.HandleFunc("GET /admin/test/retry-workflow", h.TestRetryWorkflow)
		adminMux.HandleFunc("POST /admin/test/reset-retry", h.TestResetRetry)
	}

	// Wrap admin routes with CSRF + Auth middleware
	// Order: CSRF runs first (sets token), then Auth checks session
	authMiddleware := middleware.Auth(h.AuthService())
	protectedAdmin := csrfMiddleware(authMiddleware(adminMux))
	mux.Handle("/admin", protectedAdmin)
	mux.Handle("/admin/", protectedAdmin)

	// Apply global middleware
	// Order: Logger → SecurityHeaders → Recoverer → Router
	var handler http.Handler = mux
	handler = middleware.Recoverer(handler)
	if cfg.IsDevelopment() {
		handler = middleware.SecurityHeaders(handler)
	} else {
		handler = middleware.SecurityHeadersWithHSTS(handler)
	}
	handler = middleware.Logger(handler)

	// Get absolute path for static directory
	if absPath, err := filepath.Abs(staticDir); err == nil {
		if _, err := os.Stat(absPath); os.IsNotExist(err) {
			slog.Warn("static directory does not exist", "path", absPath)
		}
	}

	// Configure server with timeouts
	addr := ":" + cfg.Port
	server := &http.Server{
		Addr:         addr,
		Handler:      handler,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in a goroutine
	go func() {
		slog.Info("starting server",
			"address", "http://localhost"+addr,
			"admin", "http://localhost"+addr+"/admin",
		)
		if cfg.IsDevelopment() {
			slog.Debug("development credentials",
				"user", cfg.AdminUser,
				"pass", cfg.AdminPass,
			)
		}

		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("server failed", "error", err)
			os.Exit(1)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown the server
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	slog.Info("shutting down server")

	// Give outstanding requests 30 seconds to complete
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		slog.Error("server forced to shutdown", "error", err)
		os.Exit(1)
	}

	slog.Info("server stopped gracefully")
}
