package middleware

import (
	"fmt"
	"net/http"
	"time"
)

// CacheControl adds Cache-Control headers for browser caching.
// This helps prefetch work with hx-boost by allowing the browser
// to reuse prefetched responses for faster navigation.
//
// Only applies to GET requests. Other methods are passed through unchanged.
func CacheControl(maxAge time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Only cache GET requests
			if r.Method == http.MethodGet {
				// public: allows CDN/proxy caching
				// max-age: browser cache TTL in seconds
				// must-revalidate: ensures stale content is revalidated
				w.Header().Set("Cache-Control",
					fmt.Sprintf("public, max-age=%d, must-revalidate", int(maxAge.Seconds())))
			}
			next.ServeHTTP(w, r)
		})
	}
}
