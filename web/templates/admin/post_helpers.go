package admin

import (
	"strconv"
	"time"

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

// postFormAutosaveURL returns the autosave URL (empty for new posts)
func postFormAutosaveURL(post *models.Post, isNew bool) string {
	if isNew || post == nil {
		return ""
	}
	return "/admin/posts/" + post.Slug + "/autosave"
}

// postFormIsDraftValue returns "true" or "false" string for hidden input
func postFormIsDraftValue(post *models.Post, input *models.CreatePostInput) string {
	if postFormIsDraft(post, input) {
		return "true"
	}
	return "false"
}

// tagIDToString converts a tag ID to string
func tagIDToString(id int64) string {
	return strconv.FormatInt(id, 10)
}

// boolToString converts a bool to "true" or "false" string
func boolToString(b bool) string {
	if b {
		return "true"
	}
	return "false"
}

// postUpdatedAtISO returns the ISO 8601 timestamp for JavaScript
func postUpdatedAtISO(post *models.Post) string {
	if post == nil {
		return ""
	}
	return post.UpdatedAt.Format(time.RFC3339)
}

// postUpdatedAtRelative returns a human-readable relative time
func postUpdatedAtRelative(post *models.Post) string {
	if post == nil {
		return ""
	}
	return formatRelativeTime(post.UpdatedAt)
}

// formatRelativeTime formats a time as relative to now
func formatRelativeTime(t time.Time) string {
	now := time.Now()
	diff := now.Sub(t)

	switch {
	case diff < time.Minute:
		return "just now"
	case diff < time.Hour:
		mins := int(diff.Minutes())
		if mins == 1 {
			return "1 minute ago"
		}
		return strconv.Itoa(mins) + " minutes ago"
	case diff < 24*time.Hour:
		hours := int(diff.Hours())
		if hours == 1 {
			return "1 hour ago"
		}
		return strconv.Itoa(hours) + " hours ago"
	case diff < 48*time.Hour:
		return "yesterday"
	default:
		return t.Format("Jan 2, 2006")
	}
}
