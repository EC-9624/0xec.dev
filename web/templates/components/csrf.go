package components

import (
	"context"

	"github.com/EC-9624/0xec.dev/internal/middleware"
)

// GetCSRFToken retrieves the CSRF token from context.
// This is a shared helper used by all admin forms to avoid duplication.
func GetCSRFToken(ctx context.Context) string {
	token, ok := ctx.Value(middleware.CSRFTokenContextKey).(string)
	if !ok {
		return ""
	}
	return token
}
