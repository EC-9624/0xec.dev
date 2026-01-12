package handlers

import (
	"database/sql"
	"net/http"

	"github.com/EC-9624/0xec.dev/internal/config"
	"github.com/EC-9624/0xec.dev/internal/service"

	"github.com/a-h/templ"
)

// Handlers contains all HTTP handlers and their dependencies
type Handlers struct {
	config  *config.Config
	service service.ServiceInterface
}

// New creates a new Handlers instance with a service interface.
// Use this constructor when you have a pre-configured service (e.g., for testing).
func New(cfg *config.Config, svc service.ServiceInterface) *Handlers {
	return &Handlers{
		config:  cfg,
		service: svc,
	}
}

// NewWithDB creates a new Handlers instance with a database connection.
// This is the standard constructor for production use.
func NewWithDB(cfg *config.Config, db *sql.DB) *Handlers {
	return New(cfg, service.New(db))
}

// Service returns the service for middleware use.
// Note: Returns the concrete *service.Service for compatibility with middleware.
func (h *Handlers) Service() *service.Service {
	// Type assertion - this will work in production where we use NewWithDB
	if svc, ok := h.service.(*service.Service); ok {
		return svc
	}
	return nil
}

// render is a helper to render templ components
func render(w http.ResponseWriter, r *http.Request, component templ.Component) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	component.Render(r.Context(), w)
}
