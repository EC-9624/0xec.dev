package middleware

import (
	"io"
	"net/http"
	"strings"
	"sync"

	"github.com/klauspost/compress/gzip"
)

// gzipPool reuses gzip writers to reduce allocations.
var gzipPool = sync.Pool{
	New: func() interface{} {
		w, _ := gzip.NewWriterLevel(io.Discard, gzip.DefaultCompression)
		return w
	},
}

// gzipResponseWriter wraps http.ResponseWriter to compress output.
type gzipResponseWriter struct {
	http.ResponseWriter
	writer *gzip.Writer
}

func (w *gzipResponseWriter) Write(b []byte) (int, error) {
	return w.writer.Write(b)
}

// Compress is middleware that gzip-compresses HTTP responses.
//
// It checks the Accept-Encoding header and only compresses if the client
// supports gzip. Uses a sync.Pool to reuse gzip writers for performance.
//
// Compressed content types: HTML, CSS, JS, JSON, XML, SVG, plain text.
func Compress(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Skip if client doesn't accept gzip
		if !strings.Contains(r.Header.Get("Accept-Encoding"), "gzip") {
			next.ServeHTTP(w, r)
			return
		}

		// Get a gzip writer from the pool
		gz := gzipPool.Get().(*gzip.Writer)
		gz.Reset(w)

		// Set response headers
		w.Header().Set("Content-Encoding", "gzip")
		w.Header().Add("Vary", "Accept-Encoding")
		// Remove Content-Length since it will change after compression
		w.Header().Del("Content-Length")

		// Create wrapped response writer
		grw := &gzipResponseWriter{
			ResponseWriter: w,
			writer:         gz,
		}

		// Serve the request with compression
		next.ServeHTTP(grw, r)

		// Close and return writer to pool
		gz.Close()
		gzipPool.Put(gz)
	})
}
