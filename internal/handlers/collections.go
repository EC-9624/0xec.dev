package handlers

import (
	"net/http"
	"strconv"

	"github.com/EC-9624/0xec.dev/internal/models"
	"github.com/EC-9624/0xec.dev/web/templates/admin"
)

// AdminCollectionsList handles the admin collections listing
func (h *Handlers) AdminCollectionsList(w http.ResponseWriter, r *http.Request) {
	collections, err := h.service.ListCollections(r.Context(), false)
	if err != nil {
		http.Error(w, "Failed to load collections", http.StatusInternalServerError)
		return
	}

	render(w, r, admin.CollectionsList(collections))
}

// AdminCollectionNew handles the new collection form
func (h *Handlers) AdminCollectionNew(w http.ResponseWriter, r *http.Request) {
	render(w, r, admin.CollectionForm(nil, true))
}

// AdminCollectionCreate handles creating a new collection
func (h *Handlers) AdminCollectionCreate(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Error(w, "Invalid form data", http.StatusBadRequest)
		return
	}

	input := models.CreateCollectionInput{
		Name:        r.FormValue("name"),
		Slug:        r.FormValue("slug"),
		Description: r.FormValue("description"),
		Color:       r.FormValue("color"),
		IsPublic:    r.FormValue("is_public") == "true",
	}

	if err := input.Validate(); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	_, err := h.service.CreateCollection(r.Context(), input)
	if err != nil {
		http.Error(w, "Failed to create collection", http.StatusInternalServerError)
		return
	}

	http.Redirect(w, r, "/admin/collections", http.StatusSeeOther)
}

// AdminCollectionEdit handles the edit collection form
func (h *Handlers) AdminCollectionEdit(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	collection, err := h.service.GetCollectionByID(r.Context(), id)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	render(w, r, admin.CollectionForm(collection, false))
}

// AdminCollectionUpdate handles updating a collection
func (h *Handlers) AdminCollectionUpdate(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	if err := r.ParseForm(); err != nil {
		http.Error(w, "Invalid form data", http.StatusBadRequest)
		return
	}

	input := models.UpdateCollectionInput{
		Name:        r.FormValue("name"),
		Slug:        r.FormValue("slug"),
		Description: r.FormValue("description"),
		Color:       r.FormValue("color"),
		IsPublic:    r.FormValue("is_public") == "true",
	}

	if err := input.Validate(); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	_, err = h.service.UpdateCollection(r.Context(), id, input)
	if err != nil {
		http.Error(w, "Failed to update collection", http.StatusInternalServerError)
		return
	}

	http.Redirect(w, r, "/admin/collections", http.StatusSeeOther)
}

// AdminCollectionDelete handles deleting a collection
func (h *Handlers) AdminCollectionDelete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	if err := h.service.DeleteCollection(r.Context(), id); err != nil {
		http.Error(w, "Failed to delete collection", http.StatusInternalServerError)
		return
	}

	if r.Header.Get("HX-Request") == "true" {
		w.Header().Set("HX-Redirect", "/admin/collections")
		w.WriteHeader(http.StatusOK)
		return
	}

	http.Redirect(w, r, "/admin/collections", http.StatusSeeOther)
}

// ============================================
// INLINE EDITING HANDLERS
// ============================================

// AdminToggleCollectionPublic toggles the public/private status of a collection
func (h *Handlers) AdminToggleCollectionPublic(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		http.Error(w, "Invalid collection ID", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	collection, err := h.service.GetCollectionByID(ctx, id)
	if err != nil {
		http.Error(w, "Collection not found", http.StatusNotFound)
		return
	}

	// Toggle the public status
	newIsPublic := !collection.IsPublic
	err = h.service.UpdateCollectionPublic(ctx, id, newIsPublic)
	if err != nil {
		http.Error(w, "Failed to update collection", http.StatusInternalServerError)
		return
	}

	// Return the updated badge
	render(w, r, admin.CollectionPublicBadge(id, newIsPublic, true))
}
