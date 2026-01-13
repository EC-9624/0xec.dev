package handlers

import (
	"net/http"
	"strconv"

	"github.com/EC-9624/0xec.dev/internal/errors"
	"github.com/EC-9624/0xec.dev/internal/models"
	"github.com/EC-9624/0xec.dev/internal/service"
	"github.com/EC-9624/0xec.dev/web/templates"
	"github.com/EC-9624/0xec.dev/web/templates/components"
	"github.com/EC-9624/0xec.dev/web/templates/pages"
)

// ============================================
// PUBLIC BOOKMARK HANDLERS
// ============================================
// These handlers serve the public-facing bookmarks pages.

// bookmarksPerPage returns the number of bookmarks per page from config
func (h *Handlers) bookmarksPerPage() int {
	return h.config.BookmarksPerPage
}

// BookmarksIndex handles the bookmarks listing page (full page only)
func (h *Handlers) BookmarksIndex(w http.ResponseWriter, r *http.Request) {
	data, err := h.getBookmarksData(r, nil)
	if err != nil {
		errors.WriteInternalError(w, r, "Failed to load bookmarks", err)
		return
	}
	render(w, r, pages.BookmarksIndex(data))
}

// HTMXBookmarksContent returns the bookmarks content partial + OOB sidebar update
func (h *Handlers) HTMXBookmarksContent(w http.ResponseWriter, r *http.Request) {
	data, err := h.getBookmarksData(r, nil)
	if err != nil {
		errors.WriteInternalError(w, r, "Failed to load bookmarks", err)
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
		w.WriteHeader(http.StatusInternalServerError)
		render(w, r, components.InlineError("Failed to load"))
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
		errors.WriteNotFound(w, r, "Collection")
		return
	}

	if !collection.IsPublic {
		errors.WriteNotFound(w, r, "Collection")
		return
	}

	data, err := h.getBookmarksData(r, collection)
	if err != nil {
		errors.WriteInternalError(w, r, "Failed to load bookmarks", err)
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
		errors.WriteNotFound(w, r, "Collection")
		return
	}

	if !collection.IsPublic {
		errors.WriteNotFound(w, r, "Collection")
		return
	}

	data, err := h.getBookmarksData(r, collection)
	if err != nil {
		errors.WriteInternalError(w, r, "Failed to load bookmarks", err)
		return
	}

	render(w, r, pages.BookmarksContentPartial(data))
}

// getPageParam extracts the page parameter from query string
func getPageParam(r *http.Request) int {
	pageStr := r.URL.Query().Get("page")
	page, err := strconv.Atoi(pageStr)
	if err != nil || page < 1 {
		return 1
	}
	return page
}
