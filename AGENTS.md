# 0xec.dev - Agent Guidelines

Personal website/blog built with Go, HTMX, Templ templates, and SQLite.

## Project Structure

```
cmd/server/        # Main entry point
cmd/seed/          # Database seeding tool
internal/
  config/          # Configuration
  database/        # SQLC generated code
  handlers/        # HTTP handlers
  middleware/      # Auth, CSRF, logging
  models/          # Domain models + validation
  service/         # Business logic
web/
  static/          # CSS, JS assets
  templates/       # Templ templates
```

## Architecture

3-layer: **Handlers -> Service -> Repository (SQLC)**

## Build/Test/Lint Commands

```bash
# Development
make dev              # Hot reload with air + tailwind watch
make run              # Run without hot reload

# Build
make build            # Production build
make templ            # Generate templ templates
make sqlc             # Generate SQLC code
make css              # Build Tailwind CSS

# Testing
make test             # Run all tests
go test ./internal/handlers/...           # Test single package
go test -run TestBookmarksIndex ./...     # Run single test
go test -run TestBookmarks ./...          # Run tests matching pattern

# Linting
make lint             # Run go vet + staticcheck

# Formatting
make fmt              # Format Go + templ files
```

## Code Style Guidelines

### Imports

Group in order: 1) stdlib, 2) internal, 3) external (separated by blank lines)

```go
import (
    "context"
    "net/http"

    "github.com/EC-9624/0xec.dev/internal/models"

    "github.com/a-h/templ"
)
```

### Naming Conventions

- **Files**: `bookmark_test.go` (lowercase + underscores)
- **Packages**: `handlers`, `models` (lowercase, single word)
- **Interfaces**: `ServiceInterface`, `AuthService`
- **Structs**: `Bookmark`, `CreateBookmarkInput`

### Error Handling

Return errors, don't panic. Use `sql.ErrNoRows` for not found:

```go
bookmark, err := s.GetBookmarkByID(ctx, id)
if err != nil {
    if err == sql.ErrNoRows {
        http.NotFound(w, r)
        return
    }
    http.Error(w, "Internal error", http.StatusInternalServerError)
    return
}
```

### Validation

Models have `Validate()` methods returning `*FormErrors`:

```go
input := models.CreateBookmarkInput{...}
if errors := input.Validate(); errors != nil && errors.HasErrors() {
    w.WriteHeader(http.StatusUnprocessableEntity)
    render(w, r, admin.BookmarkForm(nil, collections, errors, &input))
    return
}
```

### Interface Pattern

Define interfaces where they're consumed (consumer-side interfaces):

```go
// In middleware/auth.go - only needs 2 methods
type AuthService interface {
    GetSession(ctx context.Context, sessionID string) (*models.Session, error)
    GetUserByID(ctx context.Context, id int64) (*models.User, error)
}
```

### Testing

Use Go standard library only - no testify, gomock, or external frameworks.

**Table-driven tests**:
```go
tests := []struct {
    name    string
    input   CreateBookmarkInput
    wantErr bool
}{
    {name: "valid", input: CreateBookmarkInput{...}, wantErr: false},
    {name: "empty url", input: CreateBookmarkInput{}, wantErr: true},
}
for _, tt := range tests {
    t.Run(tt.name, func(t *testing.T) {
        err := tt.input.Validate()
        if (err != nil) != tt.wantErr {
            t.Errorf("got error %v, wantErr %v", err, tt.wantErr)
        }
    })
}
```

**Function-field mocks** (see `internal/handlers/handlers_test.go`):
```go
mock := &mockService{
    getBookmarkByIDFunc: func(ctx context.Context, id int64) (*models.Bookmark, error) {
        return &models.Bookmark{ID: id, Title: "Test"}, nil
    },
}
h := newTestHandlers(mock)
```

**Handler tests use real templ rendering** - verify actual HTML output:
```go
req := httptest.NewRequest(http.MethodGet, "/bookmarks", nil)
rec := httptest.NewRecorder()
h.BookmarksIndex(rec, req)
assertStatus(t, rec, http.StatusOK)
assertBodyContains(t, rec, "Test Bookmark")
```

### HTTP Handlers

- Use `r.PathValue("param")` for path parameters (Go 1.22+)
- Use `r.FormValue("field")` for form data
- Render with `render(w, r, component)` helper
- Status codes: 303 for redirects, 422 for validation errors

### Database

- SQLC for type-safe queries (`internal/database/sqlc/`)
- Edit `.sql` files, run `make sqlc` to regenerate
- Use `*int64`, `*string` for nullable params
- Use `sql.NullString`, `sql.NullInt64` for nullable results

### Templates

- Templ files in `web/templates/`
- Run `make templ` after editing `.templ` files
- Components in `components/`, pages in `pages/`, layouts in `layouts/`
