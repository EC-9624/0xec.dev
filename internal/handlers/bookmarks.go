package handlers

import (
	"fmt"
	"log"
	"net/http"
	"strconv"

	"github.com/EC-9624/0xec.dev/internal/models"
	"github.com/EC-9624/0xec.dev/internal/service"
	"github.com/EC-9624/0xec.dev/web/templates"
	"github.com/EC-9624/0xec.dev/web/templates/admin"
	"github.com/EC-9624/0xec.dev/web/templates/pages"
)

// bookmarksPerPage returns the number of bookmarks per page from config
func (h *Handlers) bookmarksPerPage() int {
	return h.config.BookmarksPerPage
}

// BookmarksIndex handles the bookmarks listing page (full page only)
func (h *Handlers) BookmarksIndex(w http.ResponseWriter, r *http.Request) {
	data, err := h.getBookmarksData(r, nil)
	if err != nil {
		http.Error(w, "Failed to load bookmarks", http.StatusInternalServerError)
		return
	}
	render(w, r, pages.BookmarksIndex(data))
}

// HTMXBookmarksContent returns the bookmarks content partial + OOB sidebar update
func (h *Handlers) HTMXBookmarksContent(w http.ResponseWriter, r *http.Request) {
	data, err := h.getBookmarksData(r, nil)
	if err != nil {
		http.Error(w, "Failed to load bookmarks", http.StatusInternalServerError)
		return
	}
	render(w, r, pages.BookmarksContentPartial(data))
}

// HTMXBookmarksMore returns only new bookmark items for infinite scroll (append)
func (h *Handlers) HTMXBookmarksMore(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	page := getPageParam(r)

	// Extract collection slug if present
	slug := r.PathValue("slug")

	var collection *models.Collection
	var collectionID *int64

	if slug != "" {
		var err error
		collection, err = h.service.GetCollectionBySlug(ctx, slug)
		if err != nil || !collection.IsPublic {
			http.NotFound(w, r)
			return
		}
		collectionID = &collection.ID
	}

	perPage := h.bookmarksPerPage()
	limit := perPage
	offset := (page - 1) * perPage

	opts := service.BookmarkListOptions{
		PublicOnly:   true,
		CollectionID: collectionID,
		Limit:        limit,
		Offset:       offset,
	}

	bookmarks, err := h.service.ListBookmarks(ctx, opts)
	if err != nil {
		http.Error(w, "Failed to load bookmarks", http.StatusInternalServerError)
		return
	}

	countOpts := service.BookmarkListOptions{PublicOnly: true, CollectionID: collectionID}
	total, _ := h.service.CountBookmarks(ctx, countOpts)
	hasMore := (page * perPage) < total

	render(w, r, pages.BookmarkGridAppend(bookmarks, collection, page, hasMore))
}

// getBookmarksData fetches all data needed for bookmarks pages
func (h *Handlers) getBookmarksData(r *http.Request, collection *models.Collection) (templates.BookmarksData, error) {
	ctx := r.Context()
	page := getPageParam(r)

	var collectionID *int64
	if collection != nil {
		collectionID = &collection.ID
	}

	perPage := h.bookmarksPerPage()
	limit := perPage
	offset := (page - 1) * perPage

	opts := service.BookmarkListOptions{
		PublicOnly:   true,
		CollectionID: collectionID,
		Limit:        limit,
		Offset:       offset,
	}

	bookmarks, err := h.service.ListBookmarks(ctx, opts)
	if err != nil {
		return templates.BookmarksData{}, err
	}

	collections, err := h.service.ListCollections(ctx, true)
	if err != nil {
		return templates.BookmarksData{}, err
	}

	countOpts := service.BookmarkListOptions{PublicOnly: true, CollectionID: collectionID}
	total, err := h.service.CountBookmarks(ctx, countOpts)
	if err != nil {
		return templates.BookmarksData{}, err
	}

	// Always fetch global count for "All Bookmarks" sidebar item
	globalCountOpts := service.BookmarkListOptions{PublicOnly: true}
	totalAllBookmarks, err := h.service.CountBookmarks(ctx, globalCountOpts)
	if err != nil {
		return templates.BookmarksData{}, err
	}

	hasMore := (page * perPage) < total

	return templates.BookmarksData{
		Bookmarks:         bookmarks,
		Collections:       collections,
		ActiveCollection:  collection,
		Total:             total,
		TotalAllBookmarks: totalAllBookmarks,
		Page:              page,
		HasMore:           hasMore,
	}, nil
}

// BookmarksByCollection handles the bookmarks listing for a specific collection (full page only)
func (h *Handlers) BookmarksByCollection(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	slug := r.PathValue("slug")
	if slug == "" {
		h.BookmarksIndex(w, r)
		return
	}

	collection, err := h.service.GetCollectionBySlug(ctx, slug)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	if !collection.IsPublic {
		http.NotFound(w, r)
		return
	}

	data, err := h.getBookmarksData(r, collection)
	if err != nil {
		http.Error(w, "Failed to load bookmarks", http.StatusInternalServerError)
		return
	}

	render(w, r, pages.BookmarksIndex(data))
}

// HTMXBookmarksCollectionContent returns the collection bookmarks content partial + OOB sidebar
func (h *Handlers) HTMXBookmarksCollectionContent(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	slug := r.PathValue("slug")
	if slug == "" {
		h.HTMXBookmarksContent(w, r)
		return
	}

	collection, err := h.service.GetCollectionBySlug(ctx, slug)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	if !collection.IsPublic {
		http.NotFound(w, r)
		return
	}

	data, err := h.getBookmarksData(r, collection)
	if err != nil {
		http.Error(w, "Failed to load bookmarks", http.StatusInternalServerError)
		return
	}

	render(w, r, pages.BookmarksContentPartial(data))
}

// AdminBookmarksList handles the admin bookmarks listing
func (h *Handlers) AdminBookmarksList(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	bookmarks, err := h.service.ListBookmarks(ctx, service.BookmarkListOptions{
		Limit:  h.config.AdminBookmarksLimit, // Load more for client-side filtering
		Offset: 0,
	})
	if err != nil {
		http.Error(w, "Failed to load bookmarks", http.StatusInternalServerError)
		return
	}

	collections, err := h.service.ListCollections(ctx, false)
	if err != nil {
		log.Printf("Failed to load collections for bookmarks list: %v", err)
	}

	render(w, r, admin.BookmarksList(admin.BookmarksListData{
		Bookmarks:   bookmarks,
		Collections: collections,
	}))
}

// AdminBookmarkNew handles the new bookmark form
func (h *Handlers) AdminBookmarkNew(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	collections, err := h.service.ListCollections(ctx, false)
	if err != nil {
		log.Printf("Failed to load collections for new bookmark form: %v", err)
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
	errors := input.Validate()

	// Check URL uniqueness (only if URL is valid so far)
	if errors == nil || !errors.HasField("url") {
		existing, _ := h.service.GetBookmarkByURL(ctx, input.URL)
		if existing != nil {
			if errors == nil {
				errors = models.NewFormErrors()
			}
			errors.AddField("url", "A bookmark with this URL already exists")
		}
	}

	// Re-render form with errors if validation failed
	if errors != nil && errors.HasErrors() {
		collections, _ := h.service.ListCollections(ctx, false)
		w.WriteHeader(http.StatusUnprocessableEntity)
		render(w, r, admin.BookmarkForm(nil, collections, true, errors, &input))
		return
	}

	_, err := h.service.CreateBookmark(ctx, input)
	if err != nil {
		log.Printf("Failed to create bookmark: %v", err)
		formErrors := models.NewFormErrors()
		formErrors.General = "Failed to create bookmark. Please try again."
		collections, _ := h.service.ListCollections(ctx, false)
		w.WriteHeader(http.StatusInternalServerError)
		render(w, r, admin.BookmarkForm(nil, collections, true, formErrors, &input))
		return
	}

	http.Redirect(w, r, "/admin/bookmarks", http.StatusSeeOther)
}

// AdminBookmarkEdit handles the edit bookmark form
func (h *Handlers) AdminBookmarkEdit(w http.ResponseWriter, r *http.Request) {
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
		log.Printf("Failed to load collections for bookmark edit form: %v", err)
	}
	render(w, r, admin.BookmarkForm(bookmark, collections, false, nil, nil))
}

// AdminBookmarkUpdate handles updating a bookmark
func (h *Handlers) AdminBookmarkUpdate(w http.ResponseWriter, r *http.Request) {
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

	if err := r.ParseForm(); err != nil {
		http.Error(w, "Invalid form data", http.StatusBadRequest)
		return
	}

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
	errors := input.Validate()

	// Check URL uniqueness (only if URL changed and is valid so far)
	if (errors == nil || !errors.HasField("url")) && input.URL != bookmark.URL {
		existing, _ := h.service.GetBookmarkByURL(ctx, input.URL)
		if existing != nil {
			if errors == nil {
				errors = models.NewFormErrors()
			}
			errors.AddField("url", "A bookmark with this URL already exists")
		}
	}

	// Re-render form with errors if validation failed
	if errors != nil && errors.HasErrors() {
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
		render(w, r, admin.BookmarkForm(bookmark, collections, false, errors, formInput))
		return
	}

	_, err = h.service.UpdateBookmark(ctx, id, input)
	if err != nil {
		log.Printf("Failed to update bookmark: %v", err)
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
		render(w, r, admin.BookmarkForm(bookmark, collections, false, formErrors, formInput))
		return
	}

	http.Redirect(w, r, "/admin/bookmarks", http.StatusSeeOther)
}

// AdminBookmarkDelete handles deleting a bookmark
func (h *Handlers) AdminBookmarkDelete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	if err := h.service.DeleteBookmark(r.Context(), id); err != nil {
		http.Error(w, "Failed to delete bookmark", http.StatusInternalServerError)
		return
	}

	if r.Header.Get("HX-Request") == "true" {
		w.Header().Set("HX-Redirect", "/admin/bookmarks")
		w.WriteHeader(http.StatusOK)
		return
	}

	http.Redirect(w, r, "/admin/bookmarks", http.StatusSeeOther)
}

func getPageParam(r *http.Request) int {
	pageStr := r.URL.Query().Get("page")
	page, err := strconv.Atoi(pageStr)
	if err != nil || page < 1 {
		return 1
	}
	return page
}

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

// AdminUpdateBookmarkCollection updates the collection of a bookmark
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

	// Parse collection ID (empty string means no collection)
	var collectionID *int64
	cidStr := r.FormValue("collection_id")
	if cidStr != "" {
		cid, err := strconv.ParseInt(cidStr, 10, 64)
		if err == nil {
			collectionID = &cid
		}
	}

	err = h.service.UpdateBookmarkCollection(ctx, id, collectionID)
	if err != nil {
		http.Error(w, "Failed to update bookmark", http.StatusInternalServerError)
		return
	}

	// Get collections for the dropdown
	collections, err := h.service.ListCollections(ctx, false)
	if err != nil {
		log.Printf("Failed to load collections for dropdown: %v", err)
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
