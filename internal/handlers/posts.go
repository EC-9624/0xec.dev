package handlers

import (
	"context"
	"log"
	"net/http"
	"strconv"
	"strings"

	"github.com/EC-9624/0xec.dev/internal/models"
	"github.com/EC-9624/0xec.dev/web/templates/admin"
	"github.com/EC-9624/0xec.dev/web/templates/pages"
)

// PostsIndex handles the posts listing page
func (h *Handlers) PostsIndex(w http.ResponseWriter, r *http.Request) {
	posts, err := h.service.ListPosts(r.Context(), true, 100, 0)
	if err != nil {
		http.Error(w, "Failed to load posts", http.StatusInternalServerError)
		return
	}

	render(w, r, pages.PostsIndex(posts))
}

// PostShow handles a single post page (full page only)
func (h *Handlers) PostShow(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	if slug == "" {
		http.NotFound(w, r)
		return
	}

	post, allPosts, contentHTML, err := h.getPostData(r.Context(), slug)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	render(w, r, pages.PostShow(*post, allPosts, contentHTML))
}

// HTMXPostContent returns the post content partial + OOB sidebar update
func (h *Handlers) HTMXPostContent(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	if slug == "" {
		http.NotFound(w, r)
		return
	}

	post, allPosts, contentHTML, err := h.getPostData(r.Context(), slug)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	render(w, r, pages.PostContentPartial(*post, contentHTML, allPosts))
}

// getPostData fetches all data needed for a post page
func (h *Handlers) getPostData(ctx context.Context, slug string) (*models.Post, []models.Post, string, error) {
	post, err := h.service.GetPostBySlug(ctx, slug)
	if err != nil {
		return nil, nil, "", err
	}

	// Don't show drafts on public site
	if post.IsDraft {
		return nil, nil, "", http.ErrNotSupported
	}

	// Fetch all posts for the sidebar
	allPosts, err := h.service.ListPosts(ctx, true, 100, 0)
	if err != nil {
		allPosts = []models.Post{}
	}

	contentHTML := markdownToHTML(post.Content)

	return post, allPosts, contentHTML, nil
}

// markdownToHTML converts markdown to HTML
// TODO: Use a proper markdown library
func markdownToHTML(content string) string {
	// Simple placeholder - replace with goldmark or similar
	return "<p>" + strings.ReplaceAll(content, "\n\n", "</p><p>") + "</p>"
}

// AdminPostsList handles the admin posts listing
func (h *Handlers) AdminPostsList(w http.ResponseWriter, r *http.Request) {
	posts, err := h.service.ListPosts(r.Context(), false, 100, 0)
	if err != nil {
		http.Error(w, "Failed to load posts", http.StatusInternalServerError)
		return
	}

	render(w, r, admin.PostsList(posts))
}

// AdminPostNew handles the new post form
func (h *Handlers) AdminPostNew(w http.ResponseWriter, r *http.Request) {
	tags, err := h.service.ListTags(r.Context())
	if err != nil {
		log.Printf("Failed to load tags for new post form: %v", err)
	}
	render(w, r, admin.PostForm(nil, nil, tags, true))
}

// AdminPostCreate handles creating a new post
func (h *Handlers) AdminPostCreate(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseForm(); err != nil {
		http.Error(w, "Invalid form data", http.StatusBadRequest)
		return
	}

	input := models.CreatePostInput{
		Title:      r.FormValue("title"),
		Slug:       r.FormValue("slug"),
		Content:    r.FormValue("content"),
		Excerpt:    r.FormValue("excerpt"),
		CoverImage: r.FormValue("cover_image"),
		IsDraft:    r.FormValue("is_draft") == "true",
	}

	if err := input.Validate(); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	_, err := h.service.CreatePost(r.Context(), input)
	if err != nil {
		http.Error(w, "Failed to create post", http.StatusInternalServerError)
		return
	}

	http.Redirect(w, r, "/admin/posts", http.StatusSeeOther)
}

// AdminPostEdit handles the edit post form
func (h *Handlers) AdminPostEdit(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	if slug == "" {
		http.NotFound(w, r)
		return
	}

	post, err := h.service.GetPostBySlug(r.Context(), slug)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	tags, err := h.service.ListTags(r.Context())
	if err != nil {
		log.Printf("Failed to load tags for post edit form: %v", err)
	}
	render(w, r, admin.PostForm(post, post.Tags, tags, false))
}

// AdminPostUpdate handles updating a post
func (h *Handlers) AdminPostUpdate(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	if slug == "" {
		http.NotFound(w, r)
		return
	}

	post, err := h.service.GetPostBySlug(r.Context(), slug)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	if err := r.ParseForm(); err != nil {
		http.Error(w, "Invalid form data", http.StatusBadRequest)
		return
	}

	input := models.UpdatePostInput{
		Title:      r.FormValue("title"),
		Slug:       r.FormValue("slug"),
		Content:    r.FormValue("content"),
		Excerpt:    r.FormValue("excerpt"),
		CoverImage: r.FormValue("cover_image"),
		IsDraft:    r.FormValue("is_draft") == "true",
	}

	if err := input.Validate(); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	_, err = h.service.UpdatePost(r.Context(), post.ID, input)
	if err != nil {
		http.Error(w, "Failed to update post", http.StatusInternalServerError)
		return
	}

	http.Redirect(w, r, "/admin/posts", http.StatusSeeOther)
}

// AdminPostDelete handles deleting a post
func (h *Handlers) AdminPostDelete(w http.ResponseWriter, r *http.Request) {
	slug := r.PathValue("slug")
	if slug == "" {
		http.NotFound(w, r)
		return
	}

	post, err := h.service.GetPostBySlug(r.Context(), slug)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	if err := h.service.DeletePost(r.Context(), post.ID); err != nil {
		http.Error(w, "Failed to delete post", http.StatusInternalServerError)
		return
	}

	// For HTMX requests, redirect via header
	if r.Header.Get("HX-Request") == "true" {
		w.Header().Set("HX-Redirect", "/admin/posts")
		w.WriteHeader(http.StatusOK)
		return
	}

	http.Redirect(w, r, "/admin/posts", http.StatusSeeOther)
}

// ============================================
// INLINE EDITING HANDLERS
// ============================================

// AdminTogglePostDraft toggles the draft/published status of a post
func (h *Handlers) AdminTogglePostDraft(w http.ResponseWriter, r *http.Request) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil {
		http.Error(w, "Invalid post ID", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	post, err := h.service.GetPostByID(ctx, id)
	if err != nil {
		http.Error(w, "Post not found", http.StatusNotFound)
		return
	}

	// Toggle the draft status
	newIsDraft := !post.IsDraft
	err = h.service.UpdatePostDraft(ctx, id, newIsDraft)
	if err != nil {
		http.Error(w, "Failed to update post", http.StatusInternalServerError)
		return
	}

	// Get updated post for the new published_at date
	updatedPost, err := h.service.GetPostByID(ctx, id)
	if err != nil {
		http.Error(w, "Failed to get updated post", http.StatusInternalServerError)
		return
	}

	// Return the updated badge
	render(w, r, admin.PostDraftBadge(updatedPost.ID, updatedPost.IsDraft, updatedPost.PublishedAt, true))
}
