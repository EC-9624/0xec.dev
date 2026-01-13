package handlers

import (
	"context"
	"database/sql"
	"net/http"

	"github.com/EC-9624/0xec.dev/internal/config"
	"github.com/EC-9624/0xec.dev/internal/middleware"
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

// AuthService returns an interface for authentication middleware.
// This properly abstracts the service dependency.
func (h *Handlers) AuthService() middleware.AuthService {
	return h.service
}

// EnsureAdminExists ensures the admin user exists at startup.
// This is a convenience method for initialization.
func (h *Handlers) EnsureAdminExists(ctx context.Context, username, password string) error {
	return h.service.EnsureAdminExists(ctx, username, password)
}

// render is a helper to render templ components
func render(w http.ResponseWriter, r *http.Request, component templ.Component) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	component.Render(r.Context(), w)
}
