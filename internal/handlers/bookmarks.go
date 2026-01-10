package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/EC-9624/0xec.dev/internal/models"
	"github.com/EC-9624/0xec.dev/internal/repository"
	"github.com/EC-9624/0xec.dev/web/templates/admin"
	"github.com/EC-9624/0xec.dev/web/templates/pages"
)

const bookmarksPerPage = 24

// BookmarksIndex handles the bookmarks listing page
func (h *Handlers) BookmarksIndex(w http.ResponseWriter, r *http.Request) {
	page := getPageParam(r)
	offset := (page - 1) * bookmarksPerPage

	opts := repository.BookmarkListOptions{
		PublicOnly: true,
		Limit:      bookmarksPerPage,
		Offset:     offset,
	}

	bookmarks, err := h.bookmarkRepo.List(opts)
	if err != nil {
		http.Error(w, "Failed to load bookmarks", http.StatusInternalServerError)
		return
	}

	collections, err := h.collectionRepo.List(true)
	if err != nil {
		http.Error(w, "Failed to load collections", http.StatusInternalServerError)
		return
	}

	total, err := h.bookmarkRepo.Count(opts)
	if err != nil {
		http.Error(w, "Failed to count bookmarks", http.StatusInternalServerError)
		return
	}

	hasMore := offset+len(bookmarks) < total

	render(w, r, pages.BookmarksIndex(bookmarks, collections, nil, total, page, hasMore))
}

// BookmarksByCollection handles the bookmarks listing for a specific collection
func (h *Handlers) BookmarksByCollection(w http.ResponseWriter, r *http.Request) {
	slug := strings.TrimPrefix(r.URL.Path, "/bookmarks/")
	if slug == "" {
		h.BookmarksIndex(w, r)
		return
	}

	collection, err := h.collectionRepo.GetBySlug(slug)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	if !collection.IsPublic {
		http.NotFound(w, r)
		return
	}

	page := getPageParam(r)
	offset := (page - 1) * bookmarksPerPage

	opts := repository.BookmarkListOptions{
		PublicOnly:   true,
		CollectionID: &collection.ID,
		Limit:        bookmarksPerPage,
		Offset:       offset,
	}

	bookmarks, err := h.bookmarkRepo.List(opts)
	if err != nil {
		http.Error(w, "Failed to load bookmarks", http.StatusInternalServerError)
		return
	}

	collections, err := h.collectionRepo.List(true)
	if err != nil {
		http.Error(w, "Failed to load collections", http.StatusInternalServerError)
		return
	}

	total, err := h.bookmarkRepo.Count(opts)
	if err != nil {
		http.Error(w, "Failed to count bookmarks", http.StatusInternalServerError)
		return
	}

	hasMore := offset+len(bookmarks) < total

	render(w, r, pages.BookmarksIndex(bookmarks, collections, collection, total, page, hasMore))
}

// AdminBookmarksList handles the admin bookmarks listing
func (h *Handlers) AdminBookmarksList(w http.ResponseWriter, r *http.Request) {
	bookmarks, err := h.bookmarkRepo.List(repository.BookmarkListOptions{
		Limit:  100,
		Offset: 0,
	})
	if err != nil {
		http.Error(w, "Failed to load bookmarks", http.StatusInternalServerError)
		return
	}

	render(w, r, admin.BookmarksList(bookmarks))
}

// AdminBookmarkNew handles the new bookmark form
func (h *Handlers) AdminBookmarkNew(w http.ResponseWriter, r *http.Request) {
	collections, _ := h.collectionRepo.List(false)
	tags, _ := h.tagRepo.List()
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

	_, err := h.bookmarkRepo.Create(input)
	if err != nil {
		http.Error(w, "Failed to create bookmark", http.StatusInternalServerError)
		return
	}

	http.Redirect(w, r, "/admin/bookmarks", http.StatusSeeOther)
}

// AdminBookmarkEdit handles the edit bookmark form
func (h *Handlers) AdminBookmarkEdit(w http.ResponseWriter, r *http.Request) {
	idStr := extractSlugFromPath(r.URL.Path, "/admin/bookmarks/", "/edit")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	bookmark, err := h.bookmarkRepo.GetByID(id)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	collections, _ := h.collectionRepo.List(false)
	tags, _ := h.tagRepo.List()
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

	_, err = h.bookmarkRepo.Update(id, input)
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

	if err := h.bookmarkRepo.Delete(id); err != nil {
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
