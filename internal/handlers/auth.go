package handlers

import (
	"net/http"
	"time"

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

	// Get existing session ID if any (for rotation to prevent session fixation)
	var oldSessionID string
	if cookie, err := r.Cookie("session"); err == nil {
		oldSessionID = cookie.Value
	}

	// Create new session (and delete old one if it exists)
	session, err := h.service.RotateSession(r.Context(), user.ID, oldSessionID, sessionDuration)
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

	// Get dashboard stats
	stats, err := h.service.GetDashboardStats(ctx)
	if err != nil {
		http.Error(w, "Failed to load dashboard", http.StatusInternalServerError)
		return
	}

	// Get recent activities
	activities, _ := h.service.ListRecentActivities(ctx, 10, 0)

	render(w, r, admin.Dashboard(admin.DashboardData{
		Stats:      stats,
		Activities: activities,
	}))
}
