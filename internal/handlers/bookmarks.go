package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/EC-9624/0xec.dev/internal/models"
	"github.com/EC-9624/0xec.dev/internal/service"
	"github.com/EC-9624/0xec.dev/web/templates"
	"github.com/EC-9624/0xec.dev/web/templates/admin"
	"github.com/EC-9624/0xec.dev/web/templates/pages"
)

const bookmarksPerPage = 24

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
	slug := strings.TrimPrefix(r.URL.Path, "/htmx/bookmarks/more/")
	if slug == "/htmx/bookmarks/more" || slug == "" {
		slug = ""
	}

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

	limit := bookmarksPerPage
	offset := (page - 1) * bookmarksPerPage

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
	hasMore := (page * bookmarksPerPage) < total

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

	limit := bookmarksPerPage
	offset := (page - 1) * bookmarksPerPage

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

	hasMore := (page * bookmarksPerPage) < total

	return templates.BookmarksData{
		Bookmarks:        bookmarks,
		Collections:      collections,
		ActiveCollection: collection,
		Total:            total,
		Page:             page,
		HasMore:          hasMore,
	}, nil
}

// BookmarksByCollection handles the bookmarks listing for a specific collection (full page only)
func (h *Handlers) BookmarksByCollection(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	slug := strings.TrimPrefix(r.URL.Path, "/bookmarks/")
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
	slug := strings.TrimPrefix(r.URL.Path, "/htmx/bookmarks/")
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
		Limit:  500, // Load more for client-side filtering
		Offset: 0,
	})
	if err != nil {
		http.Error(w, "Failed to load bookmarks", http.StatusInternalServerError)
		return
	}

	collections, _ := h.service.ListCollections(ctx, false)

	render(w, r, admin.BookmarksList(admin.BookmarksListData{
		Bookmarks:   bookmarks,
		Collections: collections,
	}))
}

// AdminBookmarkNew handles the new bookmark form
func (h *Handlers) AdminBookmarkNew(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	collections, _ := h.service.ListCollections(ctx, false)
	tags, _ := h.service.ListTags(ctx)
	render(w, r, admin.BookmarkForm(nil, collections, tags, true))
}

// AdminBookmarkCreate handles creating a new bookmark
func (h *Handlers) AdminBookmarkCreate(w http.ResponseWriter, r *http.Request) {
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

	_, err := h.service.CreateBookmark(r.Context(), input)
	if err != nil {
		http.Error(w, "Failed to create bookmark", http.StatusInternalServerError)
		return
	}

	http.Redirect(w, r, "/admin/bookmarks", http.StatusSeeOther)
}

// AdminBookmarkEdit handles the edit bookmark form
func (h *Handlers) AdminBookmarkEdit(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	idStr := extractSlugFromPath(r.URL.Path, "/admin/bookmarks/", "/edit")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	bookmark, err := h.service.GetBookmarkByID(ctx, id)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	collections, _ := h.service.ListCollections(ctx, false)
	tags, _ := h.service.ListTags(ctx)
	render(w, r, admin.BookmarkForm(bookmark, collections, tags, false))
}

// AdminBookmarkUpdate handles updating a bookmark
func (h *Handlers) AdminBookmarkUpdate(w http.ResponseWriter, r *http.Request) {
	idStr := strings.TrimPrefix(r.URL.Path, "/admin/bookmarks/")
	id, err := strconv.ParseInt(idStr, 10, 64)
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

	_, err = h.service.UpdateBookmark(r.Context(), id, input)
	if err != nil {
		http.Error(w, "Failed to update bookmark", http.StatusInternalServerError)
		return
	}

	http.Redirect(w, r, "/admin/bookmarks", http.StatusSeeOther)
}

// AdminBookmarkDelete handles deleting a bookmark
func (h *Handlers) AdminBookmarkDelete(w http.ResponseWriter, r *http.Request) {
	idStr := strings.TrimPrefix(r.URL.Path, "/admin/bookmarks/")
	id, err := strconv.ParseInt(idStr, 10, 64)
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
	// Extract ID from path: /admin/bookmarks/{id}/refresh
	path := r.URL.Path
	path = strings.TrimPrefix(path, "/admin/bookmarks/")
	path = strings.TrimSuffix(path, "/refresh")

	id, err := strconv.ParseInt(path, 10, 64)
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
