package middleware

import "net/http"

// SecurityHeaders adds security-related HTTP headers to all responses.
// This provides defense against common web vulnerabilities.
func SecurityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Prevent clickjacking - disallow embedding in iframes
		w.Header().Set("X-Frame-Options", "DENY")

		// Prevent MIME type sniffing - browser should trust Content-Type header
		w.Header().Set("X-Content-Type-Options", "nosniff")

		// Control referrer information sent with requests
		w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")

		// Disable sensitive browser features
		w.Header().Set("Permissions-Policy", "geolocation=(), microphone=(), camera=()")

		// Content Security Policy - moderate strictness
		// Allows 'unsafe-inline' for styles (required for Tailwind CSS)
		// Allows https: for images (external cover images, favicons)
		w.Header().Set("Content-Security-Policy",
			"default-src 'self'; "+
				"script-src 'self' 'unsafe-inline'; "+
				"style-src 'self' 'unsafe-inline'; "+
				"img-src 'self' data: https:; "+
				"font-src 'self'; "+
				"connect-src 'self'; "+
				"frame-ancestors 'none'")

		next.ServeHTTP(w, r)
	})
}

// SecurityHeadersWithHSTS wraps SecurityHeaders and adds HSTS header.
// Only use this in production with HTTPS enabled.
func SecurityHeadersWithHSTS(next http.Handler) http.Handler {
	return SecurityHeaders(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// HTTP Strict Transport Security - force HTTPS for 1 year
		w.Header().Set("Strict-Transport-Security", "max-age=31536000; includeSubDomains")
		next.ServeHTTP(w, r)
	}))
}
