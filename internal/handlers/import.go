package handlers

import (
	"io"
	"net/http"
	"strconv"

	"github.com/EC-9624/0xec.dev/internal/service"
	"github.com/EC-9624/0xec.dev/web/templates/admin"
)

// AdminImportPage handles the import page
func (h *Handlers) AdminImportPage(w http.ResponseWriter, r *http.Request) {
	collections, _ := h.service.ListCollections(r.Context(), false)
	render(w, r, admin.ImportPage(collections))
}

// AdminImportBookmarks handles the bookmark import form submission
func (h *Handlers) AdminImportBookmarks(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Parse multipart form (max 10MB)
	if err := r.ParseMultipartForm(10 << 20); err != nil {
		http.Error(w, "Failed to parse form", http.StatusBadRequest)
		return
	}

	// Get the file
	file, _, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "Failed to get file", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Read file contents
	content, err := io.ReadAll(file)
	if err != nil {
		http.Error(w, "Failed to read file", http.StatusInternalServerError)
		return
	}

	// Parse the bookmarks
	bookmarks, err := service.ParseChromeBookmarks(string(content))
	if err != nil {
		http.Error(w, "Failed to parse bookmarks file", http.StatusBadRequest)
		return
	}

	// Get optional collection ID
	var collectionID *int64
	if cid := r.FormValue("collection_id"); cid != "" {
		id, err := strconv.ParseInt(cid, 10, 64)
		if err == nil {
			collectionID = &id
		}
	}

	// Import the bookmarks
	result, err := h.service.ImportBookmarks(ctx, bookmarks, collectionID)
	if err != nil {
		http.Error(w, "Failed to import bookmarks", http.StatusInternalServerError)
		return
	}

	render(w, r, admin.ImportResult(result))
}
