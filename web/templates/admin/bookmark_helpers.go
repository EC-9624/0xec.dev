package admin

import (
	"strconv"

	"github.com/EC-9624/0xec.dev/internal/models"
	"github.com/EC-9624/0xec.dev/web/templates/components"
)

// ============================================
// BOOKMARK HELPER FUNCTIONS
// ============================================

// getCollectionID returns the collection ID as a string, or empty if not set
func getCollectionID(bookmark models.Bookmark) string {
	if bookmark.CollectionID.Valid {
		return strconv.FormatInt(bookmark.CollectionID.Int64, 10)
	}
	return ""
}

// getFirstLetter returns the first character of a string
func getFirstLetter(s string) string {
	for _, r := range s {
		return string(r)
	}
	return "?"
}

// truncateURL truncates a URL to the specified length
func truncateURL(url string, maxLen int) string {
	if len(url) <= maxLen {
		return url
	}
	return url[:maxLen-3] + "..."
}

// boolStr returns "true" or "false" as string
func boolStr(b bool) string {
	if b {
		return "true"
	}
	return "false"
}

// preselectedCollectionValue returns the filter value for preselection
func preselectedCollectionValue(id int64) string {
	if id == 0 {
		return ""
	}
	return strconv.FormatInt(id, 10)
}

// preselectedCollectionLabel returns the label for the preselected collection
func preselectedCollectionLabel(collections []models.Collection, id int64) string {
	if id == 0 {
		return "All Collections"
	}
	for _, c := range collections {
		if c.ID == id {
			return c.Name
		}
	}
	return "All Collections"
}

// ============================================
// FORM HELPER FUNCTIONS
// ============================================

// bookmarkFormTitle returns the page title for the bookmark form
func bookmarkFormTitle(bookmark *models.Bookmark, isNew bool) string {
	if isNew {
		return "New Bookmark"
	}
	return "Edit: " + bookmark.Title
}

// bookmarkValue returns a field value from a bookmark
func bookmarkValue(bookmark *models.Bookmark, field string) string {
	if bookmark == nil {
		return ""
	}
	switch field {
	case "url":
		return bookmark.URL
	case "title":
		return bookmark.Title
	case "description":
		return bookmark.GetDescription()
	case "cover_image":
		return bookmark.GetCoverImage()
	}
	return ""
}

// bookmarkFormValue returns the value for a form field, preferring input over bookmark.
// This preserves user input on validation errors.
func bookmarkFormValue(bookmark *models.Bookmark, input *models.CreateBookmarkInput, field string) string {
	// If we have input (from a failed submission), use that
	if input != nil {
		switch field {
		case "url":
			return input.URL
		case "title":
			return input.Title
		case "description":
			return input.Description
		case "cover_image":
			return input.CoverImage
		}
	}
	// Otherwise use the bookmark data
	return bookmarkValue(bookmark, field)
}

// bookmarkFormIsPublic returns whether the public checkbox should be checked
func bookmarkFormIsPublic(bookmark *models.Bookmark, input *models.CreateBookmarkInput) bool {
	if input != nil {
		return input.IsPublic
	}
	if bookmark != nil {
		return bookmark.IsPublic
	}
	return true // Default to public for new bookmarks
}

// bookmarkFormIsFavorite returns whether the favorite checkbox should be checked
func bookmarkFormIsFavorite(bookmark *models.Bookmark, input *models.CreateBookmarkInput) bool {
	if input != nil {
		return input.IsFavorite
	}
	if bookmark != nil {
		return bookmark.IsFavorite
	}
	return false // Default to not favorite for new bookmarks
}

// collectionsToFormOptions converts collections to FormSelect options
func collectionsToFormOptions(collections []models.Collection) []components.FormSelectOption {
	opts := make([]components.FormSelectOption, len(collections))
	for i, c := range collections {
		opts[i] = components.FormSelectOption{
			Value: strconv.FormatInt(c.ID, 10),
			Label: c.Name,
		}
	}
	return opts
}

// getSelectedCollectionValue returns the selected collection ID as string for form select
func getSelectedCollectionValue(bookmark *models.Bookmark, input *models.CreateBookmarkInput) string {
	if input != nil && input.CollectionID != nil {
		return strconv.FormatInt(*input.CollectionID, 10)
	}
	if bookmark != nil && bookmark.CollectionID.Valid {
		return strconv.FormatInt(bookmark.CollectionID.Int64, 10)
	}
	return ""
}

// ============================================
// COLLECTION DROPDOWN HELPERS
// ============================================

// getCurrentCollectionValue returns the current collection value for the dropdown
func getCurrentCollectionValue(collectionID int64, hasCollection bool) string {
	if hasCollection {
		return strconv.FormatInt(collectionID, 10)
	}
	return ""
}

// getCurrentCollectionLabel returns the label for the current collection
func getCurrentCollectionLabel(collectionID int64, hasCollection bool, collections []models.Collection) string {
	if !hasCollection {
		return "—"
	}
	for _, c := range collections {
		if c.ID == collectionID {
			return c.Name
		}
	}
	return "—"
}
