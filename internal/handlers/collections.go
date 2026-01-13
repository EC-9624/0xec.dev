package handlers

import (
	"fmt"
	"net/http"
	"strconv"

	"github.com/EC-9624/0xec.dev/internal/logger"
	"github.com/EC-9624/0xec.dev/internal/models"
	"github.com/EC-9624/0xec.dev/web/templates/admin"
	"github.com/EC-9624/0xec.dev/web/templates/components"
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
	ctx := r.Context()

	if err := r.ParseForm(); err != nil {
		http.Error(w, "Invalid form data", http.StatusBadRequest)
		return
	}

	isDrawer := r.FormValue("_drawer") == "true"

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
		existing, _ := h.service.GetCollectionBySlug(ctx, input.Slug)
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
		if isDrawer {
			render(w, r, admin.CollectionFormDrawer(nil, true, errors, &input))
		} else {
			render(w, r, admin.CollectionForm(nil, true, errors, &input))
		}
		return
	}

	collection, err := h.service.CreateCollection(ctx, input)
	if err != nil {
		logger.Error(ctx, "failed to create collection", "error", err, "name", input.Name)
		formErrors := models.NewFormErrors()
		formErrors.General = "Failed to create collection. Please try again."
		w.WriteHeader(http.StatusInternalServerError)
		if isDrawer {
			render(w, r, admin.CollectionFormDrawer(nil, true, formErrors, &input))
		} else {
			render(w, r, admin.CollectionForm(nil, true, formErrors, &input))
		}
		return
	}

	// For drawer requests, return success response with close trigger and OOB row
	if isDrawer {
		w.Header().Set("HX-Trigger", "closeDrawer")
		w.Header().Set("HX-Reswap", "none")
		render(w, r, admin.CollectionRowOOBPrepend(*collection))
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
	ctx := r.Context()

	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	collection, err := h.service.GetCollectionByID(ctx, id)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	if err := r.ParseForm(); err != nil {
		http.Error(w, "Invalid form data", http.StatusBadRequest)
		return
	}

	isDrawer := r.FormValue("_drawer") == "true"

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
		existing, _ := h.service.GetCollectionBySlug(ctx, input.Slug)
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
		if isDrawer {
			render(w, r, admin.CollectionFormDrawer(collection, false, errors, formInput))
		} else {
			render(w, r, admin.CollectionForm(collection, false, errors, formInput))
		}
		return
	}

	updatedCollection, err := h.service.UpdateCollection(ctx, id, input)
	if err != nil {
		logger.Error(ctx, "failed to update collection", "error", err, "id", id)
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
		if isDrawer {
			render(w, r, admin.CollectionFormDrawer(collection, false, formErrors, formInput))
		} else {
			render(w, r, admin.CollectionForm(collection, false, formErrors, formInput))
		}
		return
	}

	// For drawer requests, return success response with close trigger and OOB row update
	if isDrawer {
		w.Header().Set("HX-Trigger", "closeDrawer")
		w.Header().Set("HX-Reswap", "none")
		render(w, r, admin.CollectionRowOOB(*updatedCollection))
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

// AdminCollectionBookmarks returns the bookmarks for a collection as an HTMX partial
func (h *Handlers) AdminCollectionBookmarks(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		w.WriteHeader(http.StatusNotFound)
		render(w, r, components.InlineError("Collection not found"))
		return
	}

	collection, err := h.service.GetCollectionByID(r.Context(), id)
	if err != nil {
		w.WriteHeader(http.StatusNotFound)
		render(w, r, components.InlineError("Collection not found"))
		return
	}

	bookmarks, err := h.service.GetBookmarksByCollectionID(r.Context(), id)
	if err != nil {
		retryURL := fmt.Sprintf("/admin/collections/%d/bookmarks", id)
		w.WriteHeader(http.StatusInternalServerError)
		render(w, r, components.InlineErrorWithRetry("Failed to load bookmarks", retryURL))
		return
	}

	render(w, r, admin.CollectionBookmarksExpanded(id, bookmarks, collection.BookmarkCount))
}

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

// ============================================
// HTMX PARTIAL HANDLERS (DRAWER)
// ============================================

// HTMXAdminCollectionNewDrawer returns the new collection form for the drawer
func (h *Handlers) HTMXAdminCollectionNewDrawer(w http.ResponseWriter, r *http.Request) {
	render(w, r, admin.CollectionFormDrawer(nil, true, nil, nil))
}

// HTMXAdminCollectionEditDrawer returns the edit collection form for the drawer
func (h *Handlers) HTMXAdminCollectionEditDrawer(w http.ResponseWriter, r *http.Request) {
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

	render(w, r, admin.CollectionFormDrawer(collection, false, nil, nil))
}
