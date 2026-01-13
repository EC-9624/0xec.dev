package admin

import (
	"github.com/EC-9624/0xec.dev/internal/models"
)

// ============================================
// COLLECTION HELPER FUNCTIONS
// ============================================

// truncateCollectionText truncates text to the specified length
func truncateCollectionText(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}

// ============================================
// FORM HELPER FUNCTIONS
// ============================================

// collectionFormTitle returns the page title for the collection form
func collectionFormTitle(collection *models.Collection, isNew bool) string {
	if isNew {
		return "New Collection"
	}
	return "Edit: " + collection.Name
}

// collectionValue returns a field value from a collection
func collectionValue(collection *models.Collection, field string) string {
	if collection == nil {
		return ""
	}
	switch field {
	case "name":
		return collection.Name
	case "slug":
		return collection.Slug
	case "description":
		return collection.GetDescription()
	}
	return ""
}

// collectionColorValue returns the color value from a collection
func collectionColorValue(collection *models.Collection) string {
	if collection == nil {
		return "#3b82f6" // Default blue
	}
	color := collection.GetColor()
	if color == "" {
		return "#3b82f6"
	}
	return color
}

// collectionFormValue returns the value for a form field, preferring input over collection.
// This preserves user input on validation errors.
func collectionFormValue(collection *models.Collection, input *models.CreateCollectionInput, field string) string {
	// If we have input (from a failed submission), use that
	if input != nil {
		switch field {
		case "name":
			return input.Name
		case "slug":
			return input.Slug
		case "description":
			return input.Description
		case "color":
			return input.Color
		}
	}
	// Otherwise use the collection data
	if collection != nil {
		switch field {
		case "name":
			return collection.Name
		case "slug":
			return collection.Slug
		case "description":
			return collection.GetDescription()
		case "color":
			return collection.GetColor()
		}
	}
	return ""
}

// collectionFormColorValue returns the color value for the form
func collectionFormColorValue(collection *models.Collection, input *models.CreateCollectionInput) string {
	if input != nil && input.Color != "" {
		return input.Color
	}
	if collection != nil {
		color := collection.GetColor()
		if color != "" {
			return color
		}
	}
	return "#3b82f6" // Default blue
}

// collectionFormIsPublic returns whether the public checkbox should be checked
func collectionFormIsPublic(collection *models.Collection, input *models.CreateCollectionInput) bool {
	if input != nil {
		return input.IsPublic
	}
	if collection != nil {
		return collection.IsPublic
	}
	return true // Default to public for new collections
}
