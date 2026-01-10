package middleware

import (
	"context"
	"net/http"

	"github.com/EC-9624/0xec.dev/internal/models"
	"github.com/EC-9624/0xec.dev/internal/repository"
)

type contextKey string

const UserContextKey contextKey = "user"

// Auth middleware checks for valid session
func Auth(userRepo *repository.UserRepository) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			cookie, err := r.Cookie("session")
			if err != nil {
				http.Redirect(w, r, "/admin/login", http.StatusSeeOther)
				return
			}

			session, err := userRepo.GetSession(cookie.Value)
			if err != nil {
				// Invalid or expired session
				http.SetCookie(w, &http.Cookie{
					Name:   "session",
					Value:  "",
					Path:   "/",
					MaxAge: -1,
				})
				http.Redirect(w, r, "/admin/login", http.StatusSeeOther)
				return
			}

			user, err := userRepo.GetByID(session.UserID)
			if err != nil {
				http.Redirect(w, r, "/admin/login", http.StatusSeeOther)
				return
			}

			// Add user to context
			ctx := context.WithValue(r.Context(), UserContextKey, user)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// GetUser retrieves the authenticated user from context
func GetUser(r *http.Request) *models.User {
	user, ok := r.Context().Value(UserContextKey).(*models.User)
	if !ok {
		return nil
	}
	return user
}
