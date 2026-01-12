package handlers

import (
	"log"
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
	render(w, r, admin.CollectionForm(nil, true, nil, nil))
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

	// Validate input
	errors := input.Validate()

	// Check slug uniqueness (only if slug is valid so far)
	if errors == nil || !errors.HasField("slug") {
		existing, _ := h.service.GetCollectionBySlug(r.Context(), input.Slug)
		if existing != nil {
			if errors == nil {
				errors = models.NewFormErrors()
			}
			errors.AddField("slug", "This slug is already in use")
		}
	}

	// Re-render form with errors if validation failed
	if errors != nil && errors.HasErrors() {
		w.WriteHeader(http.StatusUnprocessableEntity)
		render(w, r, admin.CollectionForm(nil, true, errors, &input))
		return
	}

	_, err := h.service.CreateCollection(r.Context(), input)
	if err != nil {
		log.Printf("Failed to create collection: %v", err)
		formErrors := models.NewFormErrors()
		formErrors.General = "Failed to create collection. Please try again."
		w.WriteHeader(http.StatusInternalServerError)
		render(w, r, admin.CollectionForm(nil, true, formErrors, &input))
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

	render(w, r, admin.CollectionForm(collection, false, nil, nil))
}

// AdminCollectionUpdate handles updating a collection
func (h *Handlers) AdminCollectionUpdate(w http.ResponseWriter, r *http.Request) {
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

	// Validate input
	errors := input.Validate()

	// Check slug uniqueness (only if slug changed and is valid so far)
	if (errors == nil || !errors.HasField("slug")) && input.Slug != collection.Slug {
		existing, _ := h.service.GetCollectionBySlug(r.Context(), input.Slug)
		if existing != nil {
			if errors == nil {
				errors = models.NewFormErrors()
			}
			errors.AddField("slug", "This slug is already in use")
		}
	}

	// Re-render form with errors if validation failed
	if errors != nil && errors.HasErrors() {
		// Convert UpdateCollectionInput to CreateCollectionInput for re-rendering
		formInput := &models.CreateCollectionInput{
			Name:        input.Name,
			Slug:        input.Slug,
			Description: input.Description,
			Color:       input.Color,
			IsPublic:    input.IsPublic,
		}
		w.WriteHeader(http.StatusUnprocessableEntity)
		render(w, r, admin.CollectionForm(collection, false, errors, formInput))
		return
	}

	_, err = h.service.UpdateCollection(r.Context(), id, input)
	if err != nil {
		log.Printf("Failed to update collection: %v", err)
		formErrors := models.NewFormErrors()
		formErrors.General = "Failed to update collection. Please try again."
		formInput := &models.CreateCollectionInput{
			Name:        input.Name,
			Slug:        input.Slug,
			Description: input.Description,
			Color:       input.Color,
			IsPublic:    input.IsPublic,
		}
		w.WriteHeader(http.StatusInternalServerError)
		render(w, r, admin.CollectionForm(collection, false, formErrors, formInput))
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
