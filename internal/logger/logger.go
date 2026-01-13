package logger

import (
	"context"
	"log/slog"
	"os"
)

// contextKey is a custom type for context keys to avoid collisions
type contextKey string

const (
	// RequestIDKey is the context key for request ID
	RequestIDKey contextKey = "request_id"
)

// Setup initializes the global logger based on environment.
// - development: text format, debug level
// - production: JSON format, info level
func Setup(environment string) {
	var handler slog.Handler

	if environment == "development" {
		handler = slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
			Level:     slog.LevelDebug,
			AddSource: false,
		})
	} else {
		handler = slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{
			Level:     slog.LevelInfo,
			AddSource: true,
		})
	}

	slog.SetDefault(slog.New(handler))
}

// WithRequestID returns a new context with the request ID attached
func WithRequestID(ctx context.Context, requestID string) context.Context {
	return context.WithValue(ctx, RequestIDKey, requestID)
}

// GetRequestID extracts the request ID from context
func GetRequestID(ctx context.Context) string {
	if id, ok := ctx.Value(RequestIDKey).(string); ok {
		return id
	}
	return ""
}

// FromContext returns a logger with request ID if present in context
func FromContext(ctx context.Context) *slog.Logger {
	logger := slog.Default()
	if requestID := GetRequestID(ctx); requestID != "" {
		logger = logger.With("request_id", requestID)
	}
	return logger
}

// Info logs at info level with context
func Info(ctx context.Context, msg string, args ...any) {
	FromContext(ctx).Info(msg, args...)
}

// Error logs at error level with context
func Error(ctx context.Context, msg string, args ...any) {
	FromContext(ctx).Error(msg, args...)
}

// Warn logs at warn level with context
func Warn(ctx context.Context, msg string, args ...any) {
	FromContext(ctx).Warn(msg, args...)
}

// Debug logs at debug level with context
func Debug(ctx context.Context, msg string, args ...any) {
	FromContext(ctx).Debug(msg, args...)
}
