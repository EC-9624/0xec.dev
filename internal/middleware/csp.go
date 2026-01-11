package middleware

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"net/http"
	"strings"
)

type cspNonceKey string

// CSPNonceContextKey is the context key for CSP nonce
const CSPNonceContextKey cspNonceKey = "csp_nonce"

const cspNonceLen = 16

// CSPConfig holds CSP middleware configuration
type CSPConfig struct {
	// ReportOnly uses Content-Security-Policy-Report-Only header (for testing)
	ReportOnly bool
	// ReportURI optional endpoint to receive violation reports
	ReportURI string
}

// CSP middleware adds Content-Security-Policy headers to responses.
// It generates a unique nonce per request for inline scripts.
func CSP(cfg CSPConfig) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Generate a random nonce for this request
			nonce := generateCSPNonce()

			// Add nonce to context so templates can use it
			ctx := context.WithValue(r.Context(), CSPNonceContextKey, nonce)
			r = r.WithContext(ctx)

			// Build CSP policy
			policy := buildCSPPolicy(nonce, cfg.ReportURI)

			// Set the appropriate header
			headerName := "Content-Security-Policy"
			if cfg.ReportOnly {
				headerName = "Content-Security-Policy-Report-Only"
			}
			w.Header().Set(headerName, policy)

			// Additional security headers
			w.Header().Set("X-Content-Type-Options", "nosniff")
			w.Header().Set("X-Frame-Options", "DENY")
			w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")

			next.ServeHTTP(w, r)
		})
	}
}

// GetCSPNonce retrieves the CSP nonce from the request context.
// Use this in handlers/templates to get the nonce for inline scripts.
func GetCSPNonce(r *http.Request) string {
	nonce, ok := r.Context().Value(CSPNonceContextKey).(string)
	if !ok {
		return ""
	}
	return nonce
}

// buildCSPPolicy constructs the Content-Security-Policy value
func buildCSPPolicy(nonce, reportURI string) string {
	directives := []string{
		// Default: only allow resources from same origin
		"default-src 'self'",

		// Scripts: self + nonced inline scripts (for filter initialization etc.)
		fmt.Sprintf("script-src 'self' 'nonce-%s'", nonce),

		// Styles: self only (all styles are in CSS files now)
		// Note: We allow 'unsafe-inline' for style="" attributes using CSS custom properties
		// CSS custom properties (--var: value) in style attributes are safe
		"style-src 'self' 'unsafe-inline'",

		// Fonts: self only (JetBrains Mono is self-hosted)
		"font-src 'self'",

		// Connections: self only (HTMX, fetch, XHR)
		"connect-src 'self'",

		// Images: self + data URIs (for inline SVGs)
		// During migration, we also allow Google favicons temporarily
		"img-src 'self' data: https://www.google.com",

		// Frames: none (prevent clickjacking)
		"frame-ancestors 'none'",

		// Base URI: self only (prevent base tag injection)
		"base-uri 'self'",

		// Forms: self only
		"form-action 'self'",

		// Upgrade insecure requests in production
		"upgrade-insecure-requests",
	}

	if reportURI != "" {
		directives = append(directives, fmt.Sprintf("report-uri %s", reportURI))
	}

	return strings.Join(directives, "; ")
}

// generateCSPNonce creates a cryptographically secure random nonce
func generateCSPNonce() string {
	b := make([]byte, cspNonceLen)
	if _, err := rand.Read(b); err != nil {
		// Fallback should never happen, but handle gracefully
		panic("csp: failed to generate random nonce: " + err.Error())
	}
	return base64.StdEncoding.EncodeToString(b)
}
