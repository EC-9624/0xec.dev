package handlers

import (
	"net/http"
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

// PostShow handles a single post page
func (h *Handlers) PostShow(w http.ResponseWriter, r *http.Request) {
	slug := strings.TrimPrefix(r.URL.Path, "/posts/")
	if slug == "" {
		http.NotFound(w, r)
		return
	}

	post, err := h.service.GetPostBySlug(r.Context(), slug)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	// Don't show drafts on public site
	if post.IsDraft {
		http.NotFound(w, r)
		return
	}

	// Fetch all posts for the sidebar
	allPosts, err := h.service.ListPosts(r.Context(), true, 100, 0)
	if err != nil {
		allPosts = []models.Post{}
	}

	// TODO: Convert markdown to HTML
	contentHTML := markdownToHTML(post.Content)

	// For HTMX requests, return partial content + OOB swap for middle column
	if r.Header.Get("HX-Request") == "true" {
		render(w, r, pages.PostContentPartial(*post, contentHTML, allPosts))
		return
	}

	// Full page for direct navigation
	render(w, r, pages.PostShow(*post, allPosts, contentHTML))
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
	tags, _ := h.service.ListTags(r.Context())
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

	_, err := h.service.CreatePost(r.Context(), input)
	if err != nil {
		http.Error(w, "Failed to create post", http.StatusInternalServerError)
		return
	}

	http.Redirect(w, r, "/admin/posts", http.StatusSeeOther)
}

// AdminPostEdit handles the edit post form
func (h *Handlers) AdminPostEdit(w http.ResponseWriter, r *http.Request) {
	slug := extractSlugFromPath(r.URL.Path, "/admin/posts/", "/edit")
	if slug == "" {
		http.NotFound(w, r)
		return
	}

	post, err := h.service.GetPostBySlug(r.Context(), slug)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	tags, _ := h.service.ListTags(r.Context())
	render(w, r, admin.PostForm(post, post.Tags, tags, false))
}

// AdminPostUpdate handles updating a post
func (h *Handlers) AdminPostUpdate(w http.ResponseWriter, r *http.Request) {
	slug := strings.TrimPrefix(r.URL.Path, "/admin/posts/")
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

	_, err = h.service.UpdatePost(r.Context(), post.ID, input)
	if err != nil {
		http.Error(w, "Failed to update post", http.StatusInternalServerError)
		return
	}

	http.Redirect(w, r, "/admin/posts", http.StatusSeeOther)
}

// AdminPostDelete handles deleting a post
func (h *Handlers) AdminPostDelete(w http.ResponseWriter, r *http.Request) {
	slug := strings.TrimPrefix(r.URL.Path, "/admin/posts/")
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

func extractSlugFromPath(path, prefix, suffix string) string {
	path = strings.TrimPrefix(path, prefix)
	path = strings.TrimSuffix(path, suffix)
	return path
}
