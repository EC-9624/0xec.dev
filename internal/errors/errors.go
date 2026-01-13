package errors

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/EC-9624/0xec.dev/internal/logger"
)

// Common sentinel errors
var (
	ErrNotFound     = errors.New("not found")
	ErrUnauthorized = errors.New("unauthorized")
	ErrForbidden    = errors.New("forbidden")
	ErrBadRequest   = errors.New("bad request")
	ErrInternal     = errors.New("internal error")
)

// AppError represents an application error with context
type AppError struct {
	Code    string // Machine-readable error code (e.g., "BOOKMARK_NOT_FOUND")
	Message string // Human-readable message
	Status  int    // HTTP status code
	Err     error  // Underlying error (for logging)
}

// Error implements the error interface
func (e *AppError) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("%s: %v", e.Message, e.Err)
	}
	return e.Message
}

// Unwrap returns the underlying error for errors.Is/As
func (e *AppError) Unwrap() error {
	return e.Err
}

// ============================================
// ERROR CONSTRUCTORS
// ============================================

// NotFound creates a 404 error
func NotFound(resource string) *AppError {
	return &AppError{
		Code:    resource + "_NOT_FOUND",
		Message: resource + " not found",
		Status:  http.StatusNotFound,
		Err:     ErrNotFound,
	}
}

// BadRequest creates a 400 error
func BadRequest(message string) *AppError {
	return &AppError{
		Code:    "BAD_REQUEST",
		Message: message,
		Status:  http.StatusBadRequest,
		Err:     ErrBadRequest,
	}
}

// Internal creates a 500 error with an underlying cause
func Internal(message string, err error) *AppError {
	return &AppError{
		Code:    "INTERNAL_ERROR",
		Message: message,
		Status:  http.StatusInternalServerError,
		Err:     err,
	}
}

// Unauthorized creates a 401 error
func Unauthorized(message string) *AppError {
	return &AppError{
		Code:    "UNAUTHORIZED",
		Message: message,
		Status:  http.StatusUnauthorized,
		Err:     ErrUnauthorized,
	}
}

// Forbidden creates a 403 error
func Forbidden(message string) *AppError {
	return &AppError{
		Code:    "FORBIDDEN",
		Message: message,
		Status:  http.StatusForbidden,
		Err:     ErrForbidden,
	}
}

// ============================================
// HTTP RESPONSE HELPERS
// ============================================

// WriteError writes an error response to the client.
// For HTMX requests, it returns a partial that can be swapped.
// For regular requests, it returns a plain text error.
func WriteError(w http.ResponseWriter, r *http.Request, appErr *AppError) {
	ctx := r.Context()

	// Log the error with context
	if appErr.Status >= 500 {
		logger.Error(ctx, "server error",
			"code", appErr.Code,
			"message", appErr.Message,
			"error", appErr.Err,
			"path", r.URL.Path,
		)
	} else {
		logger.Debug(ctx, "client error",
			"code", appErr.Code,
			"message", appErr.Message,
			"path", r.URL.Path,
		)
	}

	// Check if this is an HTMX request
	isHTMX := r.Header.Get("HX-Request") == "true"

	if isHTMX {
		// For HTMX, we might want to return a partial with error styling
		// Set header to prevent history update on error
		w.Header().Set("HX-Reswap", "none")
		w.WriteHeader(appErr.Status)
		fmt.Fprintf(w, `<div class="error-message">%s</div>`, appErr.Message)
		return
	}

	// Standard HTTP error response
	http.Error(w, appErr.Message, appErr.Status)
}

// WriteNotFound is a convenience helper for 404 errors
func WriteNotFound(w http.ResponseWriter, r *http.Request, resource string) {
	WriteError(w, r, NotFound(resource))
}

// WriteInternalError is a convenience helper for 500 errors
func WriteInternalError(w http.ResponseWriter, r *http.Request, message string, err error) {
	WriteError(w, r, Internal(message, err))
}

// WriteBadRequest is a convenience helper for 400 errors
func WriteBadRequest(w http.ResponseWriter, r *http.Request, message string) {
	WriteError(w, r, BadRequest(message))
}

// HandleError handles an error based on its type.
// If it's an AppError, it uses the appropriate status.
// Otherwise, it treats it as an internal error.
func HandleError(w http.ResponseWriter, r *http.Request, err error, fallbackMessage string) {
	var appErr *AppError
	if errors.As(err, &appErr) {
		WriteError(w, r, appErr)
		return
	}

	// Wrap unknown errors as internal errors
	WriteError(w, r, Internal(fallbackMessage, err))
}
