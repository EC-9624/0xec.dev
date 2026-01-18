package models

import (
	"net/url"
	"regexp"
)

// FormErrors holds validation errors for forms
type FormErrors struct {
	General string            // General form error message
	Fields  map[string]string // Field-specific errors: field name → error message
}

// NewFormErrors creates a new FormErrors instance
func NewFormErrors() *FormErrors {
	return &FormErrors{
		Fields: make(map[string]string),
	}
}

// HasErrors returns true if there are any errors
func (e *FormErrors) HasErrors() bool {
	return e.General != "" || len(e.Fields) > 0
}

// AddField adds a field-specific error
func (e *FormErrors) AddField(field, message string) {
	if e.Fields == nil {
		e.Fields = make(map[string]string)
	}
	e.Fields[field] = message
}

// GetField returns the error message for a specific field
func (e *FormErrors) GetField(field string) string {
	if e.Fields == nil {
		return ""
	}
	return e.Fields[field]
}

// HasField returns true if a specific field has an error
func (e *FormErrors) HasField(field string) bool {
	if e.Fields == nil {
		return false
	}
	_, ok := e.Fields[field]
	return ok
}

// ============================================
// VALIDATION HELPERS
// ============================================

// Slug pattern: lowercase letters, numbers, and hyphens only
var slugPattern = regexp.MustCompile(`^[a-z0-9-]+$`)

// Hex color pattern: # followed by 6 hex characters
var hexColorPattern = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)

// IsValidSlug checks if a string is a valid slug
func IsValidSlug(s string) bool {
	return slugPattern.MatchString(s)
}

// IsValidURL checks if a string is a valid HTTP/HTTPS URL
func IsValidURL(s string) bool {
	if s == "" {
		return false
	}
	u, err := url.Parse(s)
	if err != nil {
		return false
	}
	return u.Scheme == "http" || u.Scheme == "https"
}

// IsValidHexColor checks if a string is a valid hex color
func IsValidHexColor(s string) bool {
	if s == "" {
		return true // Empty is valid (optional field)
	}
	return hexColorPattern.MatchString(s)
}
