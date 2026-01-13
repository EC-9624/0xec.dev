package models

import "strings"

// ============================================
// SHARED VALIDATION FUNCTIONS
// ============================================
// These functions encapsulate common validation patterns
// to avoid duplication across Create/Update input types.

// validateBookmarkFields validates common bookmark fields.
// Call this from both CreateBookmarkInput.Validate() and UpdateBookmarkInput.Validate().
func validateBookmarkFields(url, title, description, coverImage string, errors *FormErrors) {
	// URL validation
	urlTrimmed := strings.TrimSpace(url)
	if urlTrimmed == "" {
		errors.AddField("url", "URL is required")
	} else if !IsValidURL(urlTrimmed) {
		errors.AddField("url", "URL must be a valid HTTP or HTTPS URL")
	}

	// Title validation
	titleTrimmed := strings.TrimSpace(title)
	if titleTrimmed == "" {
		errors.AddField("title", "Title is required")
	} else if len(titleTrimmed) > 200 {
		errors.AddField("title", "Title cannot exceed 200 characters")
	}

	// Description validation (optional, max 500)
	if len(description) > 500 {
		errors.AddField("description", "Description cannot exceed 500 characters")
	}

	// Cover image URL validation (optional, must be valid URL if provided)
	if coverImage != "" && !IsValidURL(coverImage) {
		errors.AddField("cover_image", "Cover image must be a valid URL")
	}
}

// validatePostFields validates common post fields.
// Call this from both CreatePostInput.Validate() and UpdatePostInput.Validate().
func validatePostFields(title, slug, content, coverImage string, isDraft bool, errors *FormErrors) {
	// Title validation
	titleTrimmed := strings.TrimSpace(title)
	if titleTrimmed == "" {
		errors.AddField("title", "Title is required")
	} else if len(titleTrimmed) > 200 {
		errors.AddField("title", "Title cannot exceed 200 characters")
	}

	// Slug validation
	slugTrimmed := strings.TrimSpace(slug)
	if slugTrimmed == "" {
		errors.AddField("slug", "Slug is required")
	} else if len(slugTrimmed) > 100 {
		errors.AddField("slug", "Slug cannot exceed 100 characters")
	} else if !IsValidSlug(slugTrimmed) {
		errors.AddField("slug", "Slug can only contain lowercase letters, numbers, and hyphens")
	}

	// Content validation - required only if publishing
	if !isDraft && strings.TrimSpace(content) == "" {
		errors.AddField("content", "Content is required when publishing")
	}

	// Cover image URL validation
	if coverImage != "" && !IsValidURL(coverImage) {
		errors.AddField("cover_image", "Cover image must be a valid URL")
	}
}

// validateCollectionFields validates common collection fields.
// Call this from both CreateCollectionInput.Validate() and UpdateCollectionInput.Validate().
func validateCollectionFields(name, slug, description, color string, errors *FormErrors) {
	// Name validation
	nameTrimmed := strings.TrimSpace(name)
	if nameTrimmed == "" {
		errors.AddField("name", "Name is required")
	} else if len(nameTrimmed) > 100 {
		errors.AddField("name", "Name cannot exceed 100 characters")
	}

	// Slug validation
	slugTrimmed := strings.TrimSpace(slug)
	if slugTrimmed == "" {
		errors.AddField("slug", "Slug is required")
	} else if len(slugTrimmed) > 100 {
		errors.AddField("slug", "Slug cannot exceed 100 characters")
	} else if !IsValidSlug(slugTrimmed) {
		errors.AddField("slug", "Slug can only contain lowercase letters, numbers, and hyphens")
	}

	// Description validation (optional, max 500)
	if len(description) > 500 {
		errors.AddField("description", "Description cannot exceed 500 characters")
	}

	// Color validation (optional, must be valid hex if provided)
	if color != "" && !IsValidHexColor(color) {
		errors.AddField("color", "Color must be a valid hex color (e.g., #3b82f6)")
	}
}
