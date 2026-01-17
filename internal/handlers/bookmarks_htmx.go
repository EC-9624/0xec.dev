package handlers

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/EC-9624/0xec.dev/internal/logger"
	"github.com/EC-9624/0xec.dev/internal/models"
	"github.com/EC-9624/0xec.dev/web/templates/admin"
)

// ============================================
// ADMIN HTMX HANDLERS (BOOKMARKS)
// ============================================
// These handlers serve HTMX partial responses for bookmark management.

// AdminBookmarkFetchMetadata handles fetching metadata for a URL via HTMX
func (h *Handlers) AdminBookmarkFetchMetadata(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Error(w, "Invalid form data", http.StatusBadRequest)
		return
	}

	url := r.FormValue("url")
	if url == "" {
		// Return empty fields
		render(w, r, admin.BookmarkMetadataFields(nil))
		return
	}

	metadata, err := h.service.FetchPageMetadata(r.Context(), url)
	if err != nil {
		// On error, return empty fields (user can fill manually)
		render(w, r, admin.BookmarkMetadataFields(nil))
		return
	}

	// Create a temporary bookmark struct to populate the form
	bookmark := &models.Bookmark{
		Title: metadata.Title,
	}
	// Set description and cover image via the nullable fields
	if metadata.Description != "" {
		bookmark.Description.String = metadata.Description
		bookmark.Description.Valid = true
	}
	if metadata.Image != "" {
		bookmark.CoverImage.String = metadata.Image
		bookmark.CoverImage.Valid = true
	}

	render(w, r, admin.BookmarkMetadataFields(bookmark))
}

// AdminRefreshAllMetadata streams progress of metadata refresh using SSE
func (h *Handlers) AdminRefreshAllMetadata(w http.ResponseWriter, r *http.Request) {
	// Set SSE headers
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "SSE not supported", http.StatusInternalServerError)
		return
	}

	// Create progress channel
	progressChan := make(chan string, 10)
	h.service.RefreshAllMissingMetadataAsync(progressChan)

	// Stream progress to client
	for msg := range progressChan {
		fmt.Fprintf(w, "data: %s\n\n", msg)
		flusher.Flush()
	}
}

// AdminRefreshBookmarkMetadata refreshes metadata for a single bookmark
func (h *Handlers) AdminRefreshBookmarkMetadata(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		http.Error(w, "Invalid bookmark ID", http.StatusBadRequest)
		return
	}

	if err := h.service.RefreshBookmarkMetadata(r.Context(), id); err != nil {
		http.Error(w, "Failed to refresh metadata", http.StatusInternalServerError)
		return
	}

	// Redirect back to edit page
	http.Redirect(w, r, fmt.Sprintf("/admin/bookmarks/%d/edit", id), http.StatusSeeOther)
}

// ============================================
// INLINE EDITING HANDLERS (HTMX)
// ============================================

// AdminToggleBookmarkPublic toggles the public/private status of a bookmark
func (h *Handlers) AdminToggleBookmarkPublic(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		http.Error(w, "Invalid bookmark ID", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	bookmark, err := h.service.GetBookmarkByID(ctx, id)
	if err != nil {
		http.Error(w, "Bookmark not found", http.StatusNotFound)
		return
	}

	// Toggle the public status
	newStatus := !bookmark.IsPublic
	err = h.service.UpdateBookmarkPublic(ctx, id, newStatus)
	if err != nil {
		http.Error(w, "Failed to update bookmark", http.StatusInternalServerError)
		return
	}

	// Send HX-Trigger to update row data attributes for filtering
	w.Header().Set("HX-Trigger", fmt.Sprintf(`{"updateRowData": {"id": %d, "isPublic": %t}}`, id, newStatus))

	// Return the updated badge with success animation
	render(w, r, admin.BookmarkPublicBadge(id, newStatus, true))
}

// AdminToggleBookmarkFavorite toggles the favorite status of a bookmark
func (h *Handlers) AdminToggleBookmarkFavorite(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		http.Error(w, "Invalid bookmark ID", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	bookmark, err := h.service.GetBookmarkByID(ctx, id)
	if err != nil {
		http.Error(w, "Bookmark not found", http.StatusNotFound)
		return
	}

	// Toggle the favorite status
	newStatus := !bookmark.IsFavorite
	err = h.service.UpdateBookmarkFavorite(ctx, id, newStatus)
	if err != nil {
		http.Error(w, "Failed to update bookmark", http.StatusInternalServerError)
		return
	}

	// Send HX-Trigger to update row data attributes for filtering
	w.Header().Set("HX-Trigger", fmt.Sprintf(`{"updateRowData": {"id": %d, "isFavorite": %t}}`, id, newStatus))

	// Return the updated star with success animation
	render(w, r, admin.BookmarkFavoriteStar(id, newStatus, true))
}

// AdminUpdateBookmarkCollection updates the collection and position of a bookmark
func (h *Handlers) AdminUpdateBookmarkCollection(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		http.Error(w, "Invalid bookmark ID", http.StatusBadRequest)
		return
	}

	if err := r.ParseForm(); err != nil {
		http.Error(w, "Invalid form data", http.StatusBadRequest)
		return
	}

	ctx := r.Context()

	// Parse collection ID (empty string means no collection/unsorted)
	var collectionID *int64
	cidStr := r.FormValue("collection_id")

	if cidStr != "" {
		cid, err := strconv.ParseInt(cidStr, 10, 64)
		if err == nil {
			collectionID = &cid
		}
	}

	// Parse after_id for position (empty string means insert at beginning)
	var afterBookmarkID *int64
	afterIDStr := r.FormValue("after_id")

	if afterIDStr != "" {
		aid, err := strconv.ParseInt(afterIDStr, 10, 64)
		if err == nil {
			afterBookmarkID = &aid
		}
	}

	// Use MoveBookmark which handles both collection and position
	err = h.service.MoveBookmark(ctx, id, collectionID, afterBookmarkID)
	if err != nil {
		logger.Error(ctx, "failed to move bookmark", "error", err, "bookmark_id", id)
		http.Error(w, "Failed to move bookmark", http.StatusInternalServerError)
		return
	}

	// Get collections for the dropdown
	collections, err := h.service.ListCollections(ctx, false)
	if err != nil {
		logger.Error(ctx, "failed to load collections for dropdown", "error", err)
	}

	// Return the updated dropdown with success animation
	hasCollection := collectionID != nil
	var currentCollectionID int64
	if hasCollection {
		currentCollectionID = *collectionID
	}

	// Send HX-Trigger to update row data attributes for filtering
	if hasCollection {
		w.Header().Set("HX-Trigger", fmt.Sprintf(`{"updateRowData": {"id": %d, "collectionId": "%d"}}`, id, currentCollectionID))
	} else {
		w.Header().Set("HX-Trigger", fmt.Sprintf(`{"updateRowData": {"id": %d, "collectionId": ""}}`, id))
	}

	render(w, r, admin.BookmarkCollectionDropdown(id, currentCollectionID, hasCollection, collections, true))
}

// ============================================
// HTMX PARTIAL HANDLERS (DRAWER)
// ============================================

// HTMXAdminBookmarkNewDrawer returns the new bookmark form for the drawer
func (h *Handlers) HTMXAdminBookmarkNewDrawer(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	collections, err := h.service.ListCollections(ctx, false)
	if err != nil {
		logger.Error(ctx, "failed to load collections for new bookmark drawer", "error", err)
	}

	// Check for preselected collection from query param
	var input *models.CreateBookmarkInput
	if collectionIDStr := r.URL.Query().Get("collection_id"); collectionIDStr != "" {
		if collectionID, err := strconv.ParseInt(collectionIDStr, 10, 64); err == nil {
			input = &models.CreateBookmarkInput{
				CollectionID: &collectionID,
			}
		}
	}

	render(w, r, admin.BookmarkFormDrawer(nil, collections, true, nil, input))
}

// HTMXAdminBookmarkEditDrawer returns the edit bookmark form for the drawer
func (h *Handlers) HTMXAdminBookmarkEditDrawer(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	bookmark, err := h.service.GetBookmarkByID(ctx, id)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	collections, err := h.service.ListCollections(ctx, false)
	if err != nil {
		logger.Error(ctx, "failed to load collections for bookmark edit drawer", "error", err)
	}
	render(w, r, admin.BookmarkFormDrawer(bookmark, collections, false, nil, nil))
}
