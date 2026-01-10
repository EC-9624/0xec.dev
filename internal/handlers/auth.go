package handlers

import (
	"net/http"
	"time"

	"github.com/EC-9624/0xec.dev/internal/service"
	"github.com/EC-9624/0xec.dev/web/templates/admin"
	"github.com/EC-9624/0xec.dev/web/templates/pages"
)

const sessionDuration = 7 * 24 * time.Hour // 7 days

// LoginPage handles the login page
func (h *Handlers) LoginPage(w http.ResponseWriter, r *http.Request) {
	// Check if already logged in
	if cookie, err := r.Cookie("session"); err == nil {
		if _, err := h.service.GetSession(r.Context(), cookie.Value); err == nil {
			http.Redirect(w, r, "/admin", http.StatusSeeOther)
			return
		}
	}

	render(w, r, pages.Login(""))
}

// Login handles the login form submission
func (h *Handlers) Login(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		render(w, r, pages.Login("Invalid form data"))
		return
	}

	username := r.FormValue("username")
	password := r.FormValue("password")

	user, err := h.service.GetUserByUsername(r.Context(), username)
	if err != nil {
		render(w, r, pages.Login("Invalid username or password"))
		return
	}

	if !h.service.ValidatePassword(user, password) {
		render(w, r, pages.Login("Invalid username or password"))
		return
	}

	// Create session
	session, err := h.service.CreateSession(r.Context(), user.ID, sessionDuration)
	if err != nil {
		render(w, r, pages.Login("Failed to create session"))
		return
	}

	// Set session cookie
	http.SetCookie(w, &http.Cookie{
		Name:     "session",
		Value:    session.ID,
		Path:     "/",
		HttpOnly: true,
		Secure:   !h.config.IsDevelopment(),
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int(sessionDuration.Seconds()),
	})

	http.Redirect(w, r, "/admin", http.StatusSeeOther)
}

// Logout handles logging out
func (h *Handlers) Logout(w http.ResponseWriter, r *http.Request) {
	if cookie, err := r.Cookie("session"); err == nil {
		h.service.DeleteSession(r.Context(), cookie.Value)
	}

	http.SetCookie(w, &http.Cookie{
		Name:   "session",
		Value:  "",
		Path:   "/",
		MaxAge: -1,
	})

	http.Redirect(w, r, "/admin/login", http.StatusSeeOther)
}

// AdminDashboard handles the admin dashboard
func (h *Handlers) AdminDashboard(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	postCount, _ := h.service.CountPosts(ctx, false)
	bookmarkCount, _ := h.service.CountBookmarks(ctx, service.BookmarkListOptions{})
	collections, _ := h.service.ListCollections(ctx, false)
	tags, _ := h.service.ListTags(ctx)

	stats := admin.DashboardStats{
		PostCount:       postCount,
		BookmarkCount:   bookmarkCount,
		CollectionCount: len(collections),
		TagCount:        len(tags),
	}

	render(w, r, admin.Dashboard(stats))
}
