package handlers

import (
	"context"
	"database/sql"
	"io"
	"net/http"

	"github.com/EC-9624/0xec.dev/internal/config"
	"github.com/EC-9624/0xec.dev/internal/repository"

	"github.com/a-h/templ"
)

// Handlers contains all HTTP handlers and their dependencies
type Handlers struct {
	config         *config.Config
	userRepo       *repository.UserRepository
	postRepo       *repository.PostRepository
	bookmarkRepo   *repository.BookmarkRepository
	collectionRepo *repository.CollectionRepository
	tagRepo        *repository.TagRepository
}

// New creates a new Handlers instance with all dependencies
func New(cfg *config.Config, db *sql.DB) *Handlers {
	return &Handlers{
		config:         cfg,
		userRepo:       repository.NewUserRepository(db),
		postRepo:       repository.NewPostRepository(db),
		bookmarkRepo:   repository.NewBookmarkRepository(db),
		collectionRepo: repository.NewCollectionRepository(db),
		tagRepo:        repository.NewTagRepository(db),
	}
}

// UserRepo returns the user repository for middleware use
func (h *Handlers) UserRepo() *repository.UserRepository {
	return h.userRepo
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
