package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"html/template"
	"net/http"
	"strconv"

	"github.com/EC-9624/0xec.dev/internal/logger"
	"github.com/EC-9624/0xec.dev/internal/models"
	"github.com/EC-9624/0xec.dev/internal/renderer"
	"github.com/EC-9624/0xec.dev/web/templates/admin"
	"github.com/EC-9624/0xec.dev/web/templates/pages"

	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/renderer/html"
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

	// Convert content to HTML (auto-detects Editor.js JSON vs Markdown)
	contentHTML := contentToHTML(post.Content)

	return post, allPosts, contentHTML, nil
}

// contentToHTML converts post content to HTML, auto-detecting the format.
// Supports both Editor.js JSON and Markdown content.
func contentToHTML(content string) string {
	// Check if content is Editor.js JSON
	if renderer.IsEditorJSContent(content) {
		html, err := renderer.RenderEditorJS(content)
		if err != nil {
			// Fallback to escaped content on error
			return "<p>" + template.HTMLEscapeString(content) + "</p>"
		}
		return html
	}

	// Otherwise, treat as Markdown
	return markdownToHTML(content)
}

// markdownToHTML converts markdown to HTML safely using goldmark.
// By default, goldmark does NOT render raw HTML in markdown (safe mode),
// preventing XSS attacks from malicious content.
func markdownToHTML(content string) string {
	var buf bytes.Buffer
	md := goldmark.New(
		goldmark.WithRendererOptions(
			html.WithHardWraps(),
			// Note: html.WithUnsafe() is intentionally NOT enabled
			// This keeps raw HTML disabled for security
		),
	)
	if err := md.Convert([]byte(content), &buf); err != nil {
		// Fallback to escaped content on error
		return "<p>" + template.HTMLEscapeString(content) + "</p>"
	}
	return buf.String()
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
	ctx := r.Context()
	tags, err := h.service.ListTags(ctx)
	if err != nil {
		logger.Error(ctx, "failed to load tags for new post form", "error", err)
	}
	render(w, r, admin.PostForm(nil, nil, tags, true, nil, nil))
}

// parseTagIDs extracts and parses tag_ids from form values
func parseTagIDs(r *http.Request) []int64 {
	tagStrs := r.Form["tag_ids"]
	if len(tagStrs) == 0 {
		return nil
	}

	tagIDs := make([]int64, 0, len(tagStrs))
	for _, s := range tagStrs {
		if id, err := strconv.ParseInt(s, 10, 64); err == nil {
			tagIDs = append(tagIDs, id)
		}
	}
	return tagIDs
}

// AdminPostCreate handles creating a new post
func (h *Handlers) AdminPostCreate(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

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
		TagIDs:     parseTagIDs(r),
	}

	// Validate input
	errors := input.Validate()

	// Check slug uniqueness (only if slug is valid so far)
	if errors == nil || !errors.HasField("slug") {
		existing, _ := h.service.GetPostBySlug(ctx, input.Slug)
		if existing != nil {
			if errors == nil {
				errors = models.NewFormErrors()
			}
			errors.AddField("slug", "This slug is already in use")
		}
	}

	// Re-render form with errors if validation failed
	if errors != nil && errors.HasErrors() {
		tags, _ := h.service.ListTags(ctx)
		w.WriteHeader(http.StatusUnprocessableEntity)
		render(w, r, admin.PostForm(nil, nil, tags, true, errors, &input))
		return
	}

	_, err := h.service.CreatePost(ctx, input)
	if err != nil {
		logger.Error(ctx, "failed to create post", "error", err, "title", input.Title)
		formErrors := models.NewFormErrors()
		formErrors.General = "Failed to create post. Please try again."
		tags, _ := h.service.ListTags(ctx)
		w.WriteHeader(http.StatusInternalServerError)
		render(w, r, admin.PostForm(nil, nil, tags, true, formErrors, &input))
		return
	}

	http.Redirect(w, r, "/admin/posts", http.StatusSeeOther)
}

// AdminPostEdit handles the edit post form
func (h *Handlers) AdminPostEdit(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	slug := r.PathValue("slug")
	if slug == "" {
		http.NotFound(w, r)
		return
	}

	post, err := h.service.GetPostBySlug(ctx, slug)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	tags, err := h.service.ListTags(ctx)
	if err != nil {
		logger.Error(ctx, "failed to load tags for post edit form", "error", err)
	}
	render(w, r, admin.PostForm(post, post.Tags, tags, false, nil, nil))
}

// AdminPostUpdate handles updating a post
func (h *Handlers) AdminPostUpdate(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	slug := r.PathValue("slug")
	if slug == "" {
		http.NotFound(w, r)
		return
	}

	post, err := h.service.GetPostBySlug(ctx, slug)
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
		TagIDs:     parseTagIDs(r),
	}

	// Validate input
	errors := input.Validate()

	// Check slug uniqueness (only if slug changed and is valid so far)
	if (errors == nil || !errors.HasField("slug")) && input.Slug != post.Slug {
		existing, _ := h.service.GetPostBySlug(ctx, input.Slug)
		if existing != nil {
			if errors == nil {
				errors = models.NewFormErrors()
			}
			errors.AddField("slug", "This slug is already in use")
		}
	}

	// Re-render form with errors if validation failed
	if errors != nil && errors.HasErrors() {
		tags, _ := h.service.ListTags(ctx)
		// Convert UpdatePostInput to CreatePostInput for re-rendering
		formInput := &models.CreatePostInput{
			Title:      input.Title,
			Slug:       input.Slug,
			Content:    input.Content,
			Excerpt:    input.Excerpt,
			CoverImage: input.CoverImage,
			IsDraft:    input.IsDraft,
			TagIDs:     input.TagIDs,
		}
		w.WriteHeader(http.StatusUnprocessableEntity)
		render(w, r, admin.PostForm(post, post.Tags, tags, false, errors, formInput))
		return
	}

	_, err = h.service.UpdatePost(ctx, post.ID, input)
	if err != nil {
		logger.Error(ctx, "failed to update post", "error", err, "id", post.ID)
		formErrors := models.NewFormErrors()
		formErrors.General = "Failed to update post. Please try again."
		tags, _ := h.service.ListTags(ctx)
		formInput := &models.CreatePostInput{
			Title:      input.Title,
			Slug:       input.Slug,
			Content:    input.Content,
			Excerpt:    input.Excerpt,
			CoverImage: input.CoverImage,
			IsDraft:    input.IsDraft,
			TagIDs:     input.TagIDs,
		}
		w.WriteHeader(http.StatusInternalServerError)
		render(w, r, admin.PostForm(post, post.Tags, tags, false, formErrors, formInput))
		return
	}

	http.Redirect(w, r, "/admin/posts", http.StatusSeeOther)
}

// AutosaveResponse is the JSON response for autosave requests
type AutosaveResponse struct {
	UpdatedAt string `json:"updated_at"`
	IsDraft   bool   `json:"is_draft"`
	Message   string `json:"message"`
}

// AdminPostAutosave handles auto-saving a post (PATCH request, returns JSON)
// Supports action parameter: "save" (default), "publish", "unpublish"
func (h *Handlers) AdminPostAutosave(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	slug := r.PathValue("slug")
	if slug == "" {
		http.Error(w, "Missing slug", http.StatusBadRequest)
		return
	}

	post, err := h.service.GetPostBySlug(ctx, slug)
	if err != nil {
		http.Error(w, "Post not found", http.StatusNotFound)
		return
	}

	// Parse multipart form data (FormData from JavaScript sends multipart/form-data)
	if err := r.ParseMultipartForm(32 << 20); err != nil { // 32MB max
		http.Error(w, "Invalid form data", http.StatusBadRequest)
		return
	}

	// Determine action
	action := r.FormValue("action")
	if action == "" {
		action = "save"
	}

	// Determine draft state based on action
	var isDraft bool
	switch action {
	case "publish":
		isDraft = false
	case "unpublish":
		isDraft = true
	default: // "save"
		isDraft = r.FormValue("is_draft") == "true"
	}

	input := models.UpdatePostInput{
		Title:      r.FormValue("title"),
		Slug:       r.FormValue("slug"),
		Content:    r.FormValue("content"),
		Excerpt:    r.FormValue("excerpt"),
		CoverImage: r.FormValue("cover_image"),
		IsDraft:    isDraft,
		TagIDs:     parseTagIDs(r),
	}

	// Basic validation - we're more lenient for autosave
	if input.Title == "" {
		http.Error(w, "Title is required", http.StatusUnprocessableEntity)
		return
	}

	// For publish action, require content
	if action == "publish" && input.Content == "" {
		http.Error(w, "Content is required to publish", http.StatusUnprocessableEntity)
		return
	}

	// Check slug uniqueness only if changed
	if input.Slug != post.Slug && input.Slug != "" {
		existing, _ := h.service.GetPostBySlug(ctx, input.Slug)
		if existing != nil {
			http.Error(w, "Slug already in use", http.StatusConflict)
			return
		}
	}

	// Keep existing slug if new one is empty
	if input.Slug == "" {
		input.Slug = post.Slug
	}

	updatedPost, err := h.service.UpdatePost(ctx, post.ID, input)
	if err != nil {
		logger.Error(ctx, "failed to autosave post", "error", err, "id", post.ID)
		http.Error(w, "Failed to save", http.StatusInternalServerError)
		return
	}

	// Build response message
	var message string
	switch action {
	case "publish":
		message = "Published"
	case "unpublish":
		message = "Unpublished"
	default:
		message = "Saved"
	}

	// Return JSON response
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(AutosaveResponse{
		UpdatedAt: updatedPost.UpdatedAt.Format("2006-01-02T15:04:05Z07:00"),
		IsDraft:   updatedPost.IsDraft,
		Message:   message,
	})
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

	// Get updated post to get the new published_at date
	updatedPost, err := h.service.GetPostByID(ctx, id)
	if err != nil {
		http.Error(w, "Failed to get updated post", http.StatusInternalServerError)
		return
	}

	// Return the updated badge + OOB published date update
	render(w, r, admin.PostDraftToggleResponse(id, newIsDraft, updatedPost.PublishedAt))
}
