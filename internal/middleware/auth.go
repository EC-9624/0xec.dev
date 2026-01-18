package middleware

import (
	"context"
	"net/http"

	"github.com/EC-9624/0xec.dev/internal/models"
)

type contextKey string

const UserContextKey contextKey = "user"

// AuthService defines the interface for authentication-related service methods.
// This interface allows for easier testing by enabling mock implementations.
type AuthService interface {
	GetSession(ctx context.Context, sessionID string) (*models.Session, error)
	GetUserByID(ctx context.Context, id int64) (*models.User, error)
}

// Auth middleware checks for valid session
func Auth(svc AuthService) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			ctx := r.Context()
			cookie, err := r.Cookie("session")
			if err != nil {
				http.Redirect(w, r, "/admin/login", http.StatusSeeOther)
				return
			}

			session, err := svc.GetSession(ctx, cookie.Value)
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

			user, err := svc.GetUserByID(ctx, session.UserID)
			if err != nil {
				http.Redirect(w, r, "/admin/login", http.StatusSeeOther)
				return
			}

			// Add user to context
			ctx = context.WithValue(ctx, UserContextKey, user)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}
