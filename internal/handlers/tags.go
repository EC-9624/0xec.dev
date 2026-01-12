package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/EC-9624/0xec.dev/internal/models"
	"github.com/EC-9624/0xec.dev/web/templates/admin"
)

// AdminTagsList handles the admin tags listing
func (h *Handlers) AdminTagsList(w http.ResponseWriter, r *http.Request) {
	tags, err := h.service.GetTagsWithCounts(r.Context())
	if err != nil {
		http.Error(w, "Failed to load tags", http.StatusInternalServerError)
		return
	}

	render(w, r, admin.TagsList(tags))
}

// AdminTagDelete handles deleting a tag
func (h *Handlers) AdminTagDelete(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	if err := h.service.DeleteTag(r.Context(), id); err != nil {
		http.Error(w, "Failed to delete tag", http.StatusInternalServerError)
		return
	}

	if r.Header.Get("HX-Request") == "true" {
		w.Header().Set("HX-Redirect", "/admin/tags")
		w.WriteHeader(http.StatusOK)
		return
	}

	http.Redirect(w, r, "/admin/tags", http.StatusSeeOther)
}

// AdminTagCreateInline handles creating a tag via AJAX and returns JSON
func (h *Handlers) AdminTagCreateInline(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Error(w, "Invalid form data", http.StatusBadRequest)
		return
	}

	name := r.FormValue("name")
	slug := r.FormValue("slug")

	if name == "" {
		http.Error(w, "Name is required", http.StatusBadRequest)
		return
	}

	// Create the tag
	tag, err := h.service.CreateTag(r.Context(), models.CreateTagInput{
		Name: name,
		Slug: slug,
	})
	if err != nil {
		http.Error(w, "Failed to create tag", http.StatusInternalServerError)
		return
	}

	// Return JSON response
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"id":   tag.ID,
		"name": tag.Name,
		"slug": tag.Slug,
	})
}

// AdminTagPosts returns the posts for a tag as an HTMX partial (expandable rows)
func (h *Handlers) AdminTagPosts(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	posts, err := h.service.GetPostsByTagID(r.Context(), id)
	if err != nil {
		http.Error(w, "Failed to load posts", http.StatusInternalServerError)
		return
	}

	render(w, r, admin.TagPostsExpanded(id, posts))
}
