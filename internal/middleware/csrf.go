package middleware

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"net/http"
)

const (
	csrfCookieName = "csrf_token"
	csrfHeaderName = "X-CSRF-Token"
	csrfFormField  = "csrf_token"
	csrfTokenLen   = 32
)

type csrfContextKey string

const CSRFTokenContextKey csrfContextKey = "csrf_token"

// CSRFConfig holds CSRF middleware configuration
type CSRFConfig struct {
	Secure bool // Use Secure cookie flag (true for HTTPS/production)
}

// CSRF middleware protects against Cross-Site Request Forgery attacks.
// It uses the Double Submit Cookie pattern:
// 1. Sets a CSRF token in a cookie (readable by JS)
// 2. Requires the same token in X-CSRF-Token header or csrf_token form field
// 3. Validates both match on state-changing requests (POST, PUT, DELETE, PATCH)
func CSRF(cfg CSRFConfig) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			var token string

			// Check for existing CSRF cookie
			cookie, err := r.Cookie(csrfCookieName)
			if err != nil || cookie.Value == "" {
				// Generate new token
				token = generateCSRFToken()
				http.SetCookie(w, &http.Cookie{
					Name:     csrfCookieName,
					Value:    token,
					Path:     "/",
					HttpOnly: false, // JS needs to read this for HTMX
					Secure:   cfg.Secure,
					SameSite: http.SameSiteStrictMode,
				})
			} else {
				token = cookie.Value
			}

			// Add token to context so templates can access it
			ctx := context.WithValue(r.Context(), CSRFTokenContextKey, token)
			r = r.WithContext(ctx)

			// For safe methods (GET, HEAD, OPTIONS), just continue
			if isSafeMethod(r.Method) {
				next.ServeHTTP(w, r)
				return
			}

			// For state-changing methods, validate the token
			requestToken := r.Header.Get(csrfHeaderName)
			if requestToken == "" {
				// Try form field as fallback (for traditional form submissions)
				requestToken = r.FormValue(csrfFormField)
			}

			// Constant-time comparison to prevent timing attacks
			if requestToken == "" || subtle.ConstantTimeCompare([]byte(requestToken), []byte(token)) != 1 {
				http.Error(w, "CSRF token invalid or missing", http.StatusForbidden)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// GetCSRFToken retrieves the CSRF token from the request context.
// Use this in handlers to pass the token to templates.
func GetCSRFToken(r *http.Request) string {
	token, ok := r.Context().Value(CSRFTokenContextKey).(string)
	if !ok {
		return ""
	}
	return token
}

// isSafeMethod returns true for HTTP methods that should not change state
func isSafeMethod(method string) bool {
	return method == http.MethodGet ||
		method == http.MethodHead ||
		method == http.MethodOptions ||
		method == http.MethodTrace
}

// generateCSRFToken creates a cryptographically secure random token
func generateCSRFToken() string {
	b := make([]byte, csrfTokenLen)
	if _, err := rand.Read(b); err != nil {
		// Fallback should never happen, but handle gracefully
		panic("csrf: failed to generate random token: " + err.Error())
	}
	return base64.URLEncoding.EncodeToString(b)
}
