package middleware

import (
	"net/http"
	"path/filepath"
	"strings"
)

// StaticFileServer serves static files with appropriate caching headers.
//
// Cache policies:
//   - CSS, JS, fonts: 1 year, immutable (content-hashed or versioned)
//   - Images: 1 year (typically don't change)
//   - Other files: 1 day (safe default)
//
// The "immutable" directive tells browsers the file will never change,
// preventing conditional requests (If-Modified-Since) entirely.
func StaticFileServer(dir string) http.Handler {
	fs := http.FileServer(http.Dir(dir))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Set cache headers based on file extension
		ext := strings.ToLower(filepath.Ext(r.URL.Path))

		switch ext {
		case ".css", ".js", ".woff", ".woff2", ".ttf", ".eot":
			// Immutable assets - cache forever (1 year)
			// These files should be versioned or content-hashed
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")

		case ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp", ".avif":
			// Images - cache for 1 year
			w.Header().Set("Cache-Control", "public, max-age=31536000")

		default:
			// Other files - cache for 1 day
			w.Header().Set("Cache-Control", "public, max-age=86400")
		}

		fs.ServeHTTP(w, r)
	})
}
