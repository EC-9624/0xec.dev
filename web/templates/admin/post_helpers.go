package admin

import (
	"github.com/EC-9624/0xec.dev/internal/models"
)

// ============================================
// POST HELPER FUNCTIONS
// ============================================

// truncateText truncates text to the specified length
func truncateText(text string, maxLen int) string {
	if len(text) <= maxLen {
		return text
	}
	return text[:maxLen-3] + "..."
}

// ============================================
// FORM HELPER FUNCTIONS
// ============================================

// postFormTitle returns the page title for the post form
func postFormTitle(post *models.Post, isNew bool) string {
	if isNew {
		return "New Post"
	}
	return "Edit: " + post.Title
}

// postFormValue returns the value for a form field, preferring input over post.
// This preserves user input on validation errors.
func postFormValue(post *models.Post, input *models.CreatePostInput, field string) string {
	// If we have input (from a failed submission), use that
	if input != nil {
		switch field {
		case "title":
			return input.Title
		case "slug":
			return input.Slug
		case "content":
			return input.Content
		case "excerpt":
			return input.Excerpt
		case "cover_image":
			return input.CoverImage
		}
	}
	// Otherwise use the post data
	if post != nil {
		switch field {
		case "title":
			return post.Title
		case "slug":
			return post.Slug
		case "content":
			return post.Content
		case "excerpt":
			return post.GetExcerpt()
		case "cover_image":
			return post.GetCoverImage()
		}
	}
	return ""
}

// postFormIsDraft returns whether the draft checkbox should be checked
func postFormIsDraft(post *models.Post, input *models.CreatePostInput) bool {
	if input != nil {
		return input.IsDraft
	}
	if post != nil {
		return post.IsDraft
	}
	return true // Default to draft for new posts
}

// postFormTagIDs returns the tag IDs for the form, preferring input over post's tags
func postFormTagIDs(post *models.Post, tags []models.Tag, input *models.CreatePostInput) []int64 {
	// If we have input (from a failed submission), use that
	if input != nil && len(input.TagIDs) > 0 {
		return input.TagIDs
	}
	// Otherwise extract IDs from the post's tags
	if len(tags) > 0 {
		ids := make([]int64, len(tags))
		for i, tag := range tags {
			ids[i] = tag.ID
		}
		return ids
	}
	return nil
}
