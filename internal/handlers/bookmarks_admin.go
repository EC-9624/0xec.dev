package handlers

import (
	"net/http"
	"strconv"

	"github.com/EC-9624/0xec.dev/internal/errors"
	"github.com/EC-9624/0xec.dev/internal/logger"
	"github.com/EC-9624/0xec.dev/internal/models"
	"github.com/EC-9624/0xec.dev/internal/service"
	"github.com/EC-9624/0xec.dev/web/templates/admin"
)

// ============================================
// ADMIN BOOKMARK HANDLERS
// ============================================
// These handlers manage bookmarks in the admin panel.

// AdminBookmarksList handles the admin bookmarks page with board or table view
func (h *Handlers) AdminBookmarksList(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Determine view mode (default to "board")
	view := r.URL.Query().Get("view")
	if view == "" {
		view = "board"
	}

	// Check if filtering to a specific collection
	collectionParam := r.URL.Query().Get("collection")

	// Build page data
	data := admin.BookmarksPageData{
		View: view,
	}

	// Handle different views
	if view == "board" && collectionParam == "" {
		// Board view - show Kanban columns with all bookmarks
		boardData, err := h.service.GetBoardViewData(ctx, 100) // All bookmarks per collection (up to 100)
		if err != nil {
			errors.WriteInternalError(w, r, "Failed to load board data", err)
			return
		}
		data.BoardData = boardData
	} else {
		// Table view - show bookmark list
		data.View = "table" // Force table view when filtering

		collections, err := h.service.ListCollections(ctx, false)
		if err != nil {
			logger.Error(ctx, "failed to load collections for bookmarks list", "error", err)
		}
		data.Collections = collections

		// Handle filtering
		if collectionParam == "unsorted" {
			// Filter to unsorted bookmarks
			data.FilteredCollectionID = "unsorted"
			bookmarks, err := h.service.ListUnsortedBookmarks(ctx, h.config.AdminBookmarksLimit, 0)
			if err != nil {
				errors.WriteInternalError(w, r, "Failed to load unsorted bookmarks", err)
				return
			}
			data.Bookmarks = bookmarks
		} else if collectionParam != "" {
			// Filter to specific collection
			collectionID, err := strconv.ParseInt(collectionParam, 10, 64)
			if err == nil {
				collection, err := h.service.GetCollectionByID(ctx, collectionID)
				if err == nil {
					data.FilteredCollection = collection
					data.PreselectedCollectionID = collectionID
				}

				bookmarks, err := h.service.ListBookmarks(ctx, service.BookmarkListOptions{
					CollectionID: &collectionID,
					Limit:        h.config.AdminBookmarksLimit,
					Offset:       0,
				})
				if err != nil {
					errors.WriteInternalError(w, r, "Failed to load bookmarks", err)
					return
				}
				data.Bookmarks = bookmarks
			}
		} else {
			// All bookmarks
			bookmarks, err := h.service.ListBookmarks(ctx, service.BookmarkListOptions{
				Limit:  h.config.AdminBookmarksLimit,
				Offset: 0,
			})
			if err != nil {
				errors.WriteInternalError(w, r, "Failed to load bookmarks", err)
				return
			}
			data.Bookmarks = bookmarks
		}
	}

	render(w, r, admin.BookmarksPage(data))
}

// AdminBookmarkNew handles the new bookmark form
func (h *Handlers) AdminBookmarkNew(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	collections, err := h.service.ListCollections(ctx, false)
	if err != nil {
		logger.Error(ctx, "failed to load collections for new bookmark form", "error", err)
	}
	render(w, r, admin.BookmarkForm(nil, collections, true, nil, nil))
}

// AdminBookmarkCreate handles creating a new bookmark
func (h *Handlers) AdminBookmarkCreate(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	if err := r.ParseForm(); err != nil {
		http.Error(w, "Invalid form data", http.StatusBadRequest)
		return
	}

	isDrawer := r.FormValue("_drawer") == "true"

	var collectionID *int64
	if cid := r.FormValue("collection_id"); cid != "" {
		id, err := strconv.ParseInt(cid, 10, 64)
		if err == nil {
			collectionID = &id
		}
	}

	input := models.CreateBookmarkInput{
		URL:          r.FormValue("url"),
		Title:        r.FormValue("title"),
		Description:  r.FormValue("description"),
		CoverImage:   r.FormValue("cover_image"),
		CollectionID: collectionID,
		IsPublic:     r.FormValue("is_public") == "true",
		IsFavorite:   r.FormValue("is_favorite") == "true",
	}

	// Validate input
	formErrors := input.Validate()

	// Check URL uniqueness (only if URL is valid so far)
	if formErrors == nil || !formErrors.HasField("url") {
		existing, _ := h.service.GetBookmarkByURL(ctx, input.URL)
		if existing != nil {
			if formErrors == nil {
				formErrors = models.NewFormErrors()
			}
			formErrors.AddField("url", "A bookmark with this URL already exists")
		}
	}

	// Re-render form with errors if validation failed
	if formErrors != nil && formErrors.HasErrors() {
		collections, _ := h.service.ListCollections(ctx, false)
		w.WriteHeader(http.StatusUnprocessableEntity)
		if isDrawer {
			render(w, r, admin.BookmarkFormDrawer(nil, collections, true, formErrors, &input))
		} else {
			render(w, r, admin.BookmarkForm(nil, collections, true, formErrors, &input))
		}
		return
	}

	bookmark, err := h.service.CreateBookmark(ctx, input)
	if err != nil {
		logger.Error(ctx, "failed to create bookmark", "error", err, "url", input.URL)
		formErrors := models.NewFormErrors()
		formErrors.General = "Failed to create bookmark. Please try again."
		collections, _ := h.service.ListCollections(ctx, false)
		w.WriteHeader(http.StatusInternalServerError)
		if isDrawer {
			render(w, r, admin.BookmarkFormDrawer(nil, collections, true, formErrors, &input))
		} else {
			render(w, r, admin.BookmarkForm(nil, collections, true, formErrors, &input))
		}
		return
	}

	// For drawer requests, return success response with close trigger and OOB row
	if isDrawer {
		collections, _ := h.service.ListCollections(ctx, false)
		w.Header().Set("HX-Trigger", "closeDrawer")
		w.Header().Set("HX-Reswap", "none")
		// Return OOB swap to prepend new row to table
		render(w, r, admin.BookmarkRowOOBPrepend(*bookmark, collections))
		return
	}

	http.Redirect(w, r, "/admin/bookmarks", http.StatusSeeOther)
}

// AdminBookmarkEdit handles the edit bookmark form
func (h *Handlers) AdminBookmarkEdit(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		errors.WriteBadRequest(w, r, "Invalid bookmark ID")
		return
	}

	bookmark, err := h.service.GetBookmarkByID(ctx, id)
	if err != nil {
		errors.WriteNotFound(w, r, "Bookmark")
		return
	}

	collections, err := h.service.ListCollections(ctx, false)
	if err != nil {
		logger.Error(ctx, "failed to load collections for bookmark edit form", "error", err)
	}
	render(w, r, admin.BookmarkForm(bookmark, collections, false, nil, nil))
}

// AdminBookmarkUpdate handles updating a bookmark
func (h *Handlers) AdminBookmarkUpdate(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		errors.WriteBadRequest(w, r, "Invalid bookmark ID")
		return
	}

	bookmark, err := h.service.GetBookmarkByID(ctx, id)
	if err != nil {
		errors.WriteNotFound(w, r, "Bookmark")
		return
	}

	if err := r.ParseForm(); err != nil {
		errors.WriteBadRequest(w, r, "Invalid form data")
		return
	}

	isDrawer := r.FormValue("_drawer") == "true"

	var collectionID *int64
	if cid := r.FormValue("collection_id"); cid != "" {
		cid, err := strconv.ParseInt(cid, 10, 64)
		if err == nil {
			collectionID = &cid
		}
	}

	input := models.UpdateBookmarkInput{
		URL:          r.FormValue("url"),
		Title:        r.FormValue("title"),
		Description:  r.FormValue("description"),
		CoverImage:   r.FormValue("cover_image"),
		CollectionID: collectionID,
		IsPublic:     r.FormValue("is_public") == "true",
		IsFavorite:   r.FormValue("is_favorite") == "true",
	}

	// Validate input
	formErrors := input.Validate()

	// Check URL uniqueness (only if URL changed and is valid so far)
	if (formErrors == nil || !formErrors.HasField("url")) && input.URL != bookmark.URL {
		existing, _ := h.service.GetBookmarkByURL(ctx, input.URL)
		if existing != nil {
			if formErrors == nil {
				formErrors = models.NewFormErrors()
			}
			formErrors.AddField("url", "A bookmark with this URL already exists")
		}
	}

	// Re-render form with errors if validation failed
	if formErrors != nil && formErrors.HasErrors() {
		collections, _ := h.service.ListCollections(ctx, false)
		// Convert UpdateBookmarkInput to CreateBookmarkInput for re-rendering
		formInput := &models.CreateBookmarkInput{
			URL:          input.URL,
			Title:        input.Title,
			Description:  input.Description,
			CoverImage:   input.CoverImage,
			CollectionID: input.CollectionID,
			IsPublic:     input.IsPublic,
			IsFavorite:   input.IsFavorite,
		}
		w.WriteHeader(http.StatusUnprocessableEntity)
		if isDrawer {
			render(w, r, admin.BookmarkFormDrawer(bookmark, collections, false, formErrors, formInput))
		} else {
			render(w, r, admin.BookmarkForm(bookmark, collections, false, formErrors, formInput))
		}
		return
	}

	updatedBookmark, err := h.service.UpdateBookmark(ctx, id, input)
	if err != nil {
		logger.Error(ctx, "failed to update bookmark", "error", err, "id", id)
		formErrors := models.NewFormErrors()
		formErrors.General = "Failed to update bookmark. Please try again."
		collections, _ := h.service.ListCollections(ctx, false)
		formInput := &models.CreateBookmarkInput{
			URL:          input.URL,
			Title:        input.Title,
			Description:  input.Description,
			CoverImage:   input.CoverImage,
			CollectionID: input.CollectionID,
			IsPublic:     input.IsPublic,
			IsFavorite:   input.IsFavorite,
		}
		w.WriteHeader(http.StatusInternalServerError)
		if isDrawer {
			render(w, r, admin.BookmarkFormDrawer(bookmark, collections, false, formErrors, formInput))
		} else {
			render(w, r, admin.BookmarkForm(bookmark, collections, false, formErrors, formInput))
		}
		return
	}

	// For drawer requests, return success response with close trigger and OOB row update
	if isDrawer {
		collections, _ := h.service.ListCollections(ctx, false)
		w.Header().Set("HX-Trigger", "closeDrawer")
		w.Header().Set("HX-Reswap", "none")
		// Return OOB swap to update the row
		render(w, r, admin.BookmarkRowOOB(*updatedBookmark, collections))
		return
	}

	http.Redirect(w, r, "/admin/bookmarks", http.StatusSeeOther)
}

// AdminBookmarkDelete handles deleting a bookmark
func (h *Handlers) AdminBookmarkDelete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		errors.WriteBadRequest(w, r, "Invalid bookmark ID")
		return
	}

	if err := h.service.DeleteBookmark(r.Context(), id); err != nil {
		errors.WriteInternalError(w, r, "Failed to delete bookmark", err)
		return
	}

	if r.Header.Get("HX-Request") == "true" {
		w.Header().Set("HX-Redirect", "/admin/bookmarks")
		w.WriteHeader(http.StatusOK)
		return
	}

	http.Redirect(w, r, "/admin/bookmarks", http.StatusSeeOther)
}
