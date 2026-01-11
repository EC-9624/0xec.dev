package handlers

import (
	"net/http"
	"strconv"
	"time"
)

// ServeImage serves a stored image by ID
// GET /images/{id}
func (h *Handlers) ServeImage(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	img, err := h.service.GetImage(r.Context(), id)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	// Set caching headers - images are immutable (identified by hash)
	// Cache for 1 year (max-age=31536000)
	w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	w.Header().Set("Content-Type", img.ContentType)
	w.Header().Set("Content-Length", strconv.FormatInt(img.Size, 10))
	w.Header().Set("ETag", `"`+img.Hash+`"`)

	// Handle conditional requests
	if match := r.Header.Get("If-None-Match"); match == `"`+img.Hash+`"` {
		w.WriteHeader(http.StatusNotModified)
		return
	}

	// Set Last-Modified for conditional requests
	if !img.CreatedAt.IsZero() {
		w.Header().Set("Last-Modified", img.CreatedAt.UTC().Format(time.RFC1123))
	}

	// Write the image data
	w.Write(img.Data)
}
