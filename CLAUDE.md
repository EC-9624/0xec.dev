# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal website/blog built with Go, HTMX, Templ templates, Tailwind CSS, and SQLite. Features a three-column responsive layout with posts and bookmarks management.

## Build/Development Commands

```bash
# Development (hot reload with air + tailwind watch)
make dev

# Run without hot reload
make run

# Generate templates after editing .templ files
make templ

# Generate SQLC code after editing .sql files
make sqlc

# Build Tailwind CSS
make css

# Production build (don't run unless explicitly asked)
make build

# Testing
make test                                      # Run all tests
go test ./internal/handlers/...                # Test single package
go test -run TestBookmarksIndex ./...          # Run single test
go test -run TestBookmarks ./...               # Run tests matching pattern

# Linting and formatting
make lint    # Run go vet + staticcheck
make fmt     # Format Go + templ files

# Database
make db         # Open SQLite CLI with pretty formatting
make db-backup  # Backup database with timestamp
make db-reset   # Delete database (recreated on next run)
```

## Architecture

**3-layer architecture**: Handlers → Service → Repository (SQLC)

```
cmd/server/        # Main entry point
cmd/seed/          # Database seeding tool
cmd/hashstatic/    # Static asset hashing for cache busting
internal/
  handlers/        # HTTP handlers
  service/         # Business logic layer
  database/sqlc/   # SQLC generated code (edit .sql files, run make sqlc)
  middleware/      # Auth, CSRF, rate limiting, compression
  models/          # Domain models with Validate() methods
  assets/          # Asset path helper (for hashed filenames)
web/
  templates/       # Templ templates (layouts/, pages/, components/, admin/)
  static/
    css/           # input.css (Tailwind) → output.css
    js/            # HTMX, custom scripts
    js/components/ # Web Components (ec-drawer, ec-dropdown, ec-mobile-nav, etc.)
```

## Frontend Architecture

- **HTMX** with `hx-boost="true"` for SPA-like navigation
- **View Transitions API** for mobile animations (CSS in `input.css:2314-2372`)
- **Tailwind CSS** standalone CLI (no Node.js required)
- **Web Components** prefixed with `ec-` for interactive elements
- HTMX config: `globalViewTransitions:true` in base template

## Code Style

### Imports
Group in order: stdlib → internal → external (separated by blank lines)

### Error Handling
Return errors, don't panic. Use `sql.ErrNoRows` for not found cases.

### Validation
Models have `Validate()` methods returning `*FormErrors`

### HTTP Handlers
- Use `r.PathValue("param")` for path parameters (Go 1.22+)
- Use `r.FormValue("field")` for form data
- Status codes: 303 for redirects, 422 for validation errors

### Testing
- Standard library only (no testify, gomock)
- Table-driven tests with `t.Run()`
- Function-field mocks (see `internal/handlers/handlers_test.go`)
- Handler tests verify actual HTML output from templ rendering

### Database
- Edit `.sql` files in `internal/database/sqlc/`, run `make sqlc` to regenerate
- Use `*int64`, `*string` for nullable params
- Use `sql.NullString`, `sql.NullInt64` for nullable results

### Templates
- Run `make templ` after editing `.templ` files (automatic in `make dev`)
- Layouts: `TwoColumn` (home), `ThreeColumn` (posts, bookmarks)

## Environment Variables

Copy `.env.example` to `.env`:
- `PORT` - Server port (default: 8080)
- `ENVIRONMENT` - `development` or `production`
- `DATABASE_URL` - SQLite path (default: ./data/site.db)
- `SESSION_KEY` - 32+ char secret for session encryption
- `ADMIN_USER` / `ADMIN_PASS` - Admin credentials
- `BASE_URL` - Site URL for RSS feeds
