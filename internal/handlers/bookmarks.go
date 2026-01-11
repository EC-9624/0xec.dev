package handlers

import (
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

// BookmarksIndex handles the bookmarks listing page
func (h *Handlers) BookmarksIndex(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	page := getPageParam(r)
	isHTMX := r.Header.Get("HX-Request") == "true"
	isAppend := r.URL.Query().Get("partial") == "append"

	// Always use standard pagination (no more loading ALL items!)
	limit := bookmarksPerPage
	offset := (page - 1) * bookmarksPerPage

	opts := service.BookmarkListOptions{
		PublicOnly: true,
		Limit:      limit,
		Offset:     offset,
	}

	bookmarks, err := h.service.ListBookmarks(ctx, opts)
	if err != nil {
		http.Error(w, "Failed to load bookmarks", http.StatusInternalServerError)
		return
	}

	// Count total for hasMore calculation
	countOpts := service.BookmarkListOptions{PublicOnly: true}
	total, err := h.service.CountBookmarks(ctx, countOpts)
	if err != nil {
		http.Error(w, "Failed to count bookmarks", http.StatusInternalServerError)
		return
	}

	hasMore := (page * bookmarksPerPage) < total

	// For append requests, only return new items + next button (efficient infinite scroll)
	if isHTMX && isAppend {
		render(w, r, pages.BookmarkGridAppend(bookmarks, nil, page, hasMore))
		return
	}

	// Full data needed for non-append requests
	collections, err := h.service.ListCollections(ctx, true)
	if err != nil {
		http.Error(w, "Failed to load collections", http.StatusInternalServerError)
		return
	}

	data := templates.BookmarksData{
		Bookmarks:        bookmarks,
		Collections:      collections,
		ActiveCollection: nil,
		Total:            total,
		Page:             page,
		HasMore:          hasMore,
	}

	// For HTMX navigation requests, return content partial + OOB middle column update
	if isHTMX {
		render(w, r, pages.BookmarksContentPartial(data))
		return
	}

	// Full page for direct navigation
	render(w, r, pages.BookmarksIndex(data))
}

// BookmarksByCollection handles the bookmarks listing for a specific collection
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

	page := getPageParam(r)
	isHTMX := r.Header.Get("HX-Request") == "true"
	isAppend := r.URL.Query().Get("partial") == "append"

	// Always use standard pagination (no more loading ALL items!)
	limit := bookmarksPerPage
	offset := (page - 1) * bookmarksPerPage

	opts := service.BookmarkListOptions{
		PublicOnly:   true,
		CollectionID: &collection.ID,
		Limit:        limit,
		Offset:       offset,
	}

	bookmarks, err := h.service.ListBookmarks(ctx, opts)
	if err != nil {
		http.Error(w, "Failed to load bookmarks", http.StatusInternalServerError)
		return
	}

	// Count total for hasMore calculation
	countOpts := service.BookmarkListOptions{PublicOnly: true, CollectionID: &collection.ID}
	total, err := h.service.CountBookmarks(ctx, countOpts)
	if err != nil {
		http.Error(w, "Failed to count bookmarks", http.StatusInternalServerError)
		return
	}

	hasMore := (page * bookmarksPerPage) < total

	// For append requests, only return new items + next button (efficient infinite scroll)
	if isHTMX && isAppend {
		render(w, r, pages.BookmarkGridAppend(bookmarks, collection, page, hasMore))
		return
	}

	// Full data needed for non-append requests
	collections, err := h.service.ListCollections(ctx, true)
	if err != nil {
		http.Error(w, "Failed to load collections", http.StatusInternalServerError)
		return
	}

	data := templates.BookmarksData{
		Bookmarks:        bookmarks,
		Collections:      collections,
		ActiveCollection: collection,
		Total:            total,
		Page:             page,
		HasMore:          hasMore,
	}

	// For HTMX navigation requests, return content partial + OOB middle column update
	if isHTMX {
		render(w, r, pages.BookmarksContentPartial(data))
		return
	}

	// Full page for direct navigation
	render(w, r, pages.BookmarksIndex(data))
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
