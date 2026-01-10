package handlers

import (
	"context"
	"database/sql"
	"io"
	"net/http"

	"github.com/EC-9624/0xec.dev/internal/config"
	"github.com/EC-9624/0xec.dev/internal/service"

	"github.com/a-h/templ"
)

// Handlers contains all HTTP handlers and their dependencies
type Handlers struct {
	config  *config.Config
	service *service.Service
}

// New creates a new Handlers instance with all dependencies
func New(cfg *config.Config, db *sql.DB) *Handlers {
	return &Handlers{
		config:  cfg,
		service: service.New(db),
	}
}

// Service returns the service for middleware use
func (h *Handlers) Service() *service.Service {
	return h.service
}

// templComponent is an interface that matches templ.Component
type templComponent interface {
	Render(ctx context.Context, w io.Writer) error
}

// render is a helper to render templ components
func render(w http.ResponseWriter, r *http.Request, component templ.Component) {
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	component.Render(r.Context(), w)
}
