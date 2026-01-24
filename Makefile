.PHONY: dev build run clean templ css js install setup sqlc seed db db-backup db-reset test lint fmt check help hash-assets hash-assets-dev clean-hashed

# Tailwind standalone CLI
TAILWIND := ./bin/tailwindcss
TAILWIND_URL := https://github.com/tailwindlabs/tailwindcss/releases/latest/download/tailwindcss-macos-arm64

# esbuild standalone CLI
ESBUILD := ./bin/esbuild
ESBUILD_VERSION := 0.24.0
ESBUILD_URL := https://registry.npmjs.org/@esbuild/darwin-arm64/-/darwin-arm64-$(ESBUILD_VERSION).tgz

# Install dependencies
install:
	go mod download
	go install github.com/a-h/templ/cmd/templ@latest
	@if [ ! -f $(TAILWIND) ]; then \
		echo "Downloading Tailwind CSS standalone CLI..."; \
		mkdir -p bin; \
		curl -sLO $(TAILWIND_URL); \
		chmod +x tailwindcss-macos-arm64; \
		mv tailwindcss-macos-arm64 $(TAILWIND); \
	fi
	@if [ ! -f $(ESBUILD) ]; then \
		echo "Downloading esbuild standalone CLI..."; \
		mkdir -p bin; \
		curl -sL $(ESBUILD_URL) | tar -xz -C bin --strip-components=2 package/bin/esbuild; \
		chmod +x $(ESBUILD); \
	fi

# Initial setup
setup: install
	@echo "Creating data directory..."
	mkdir -p data
	@echo "Building CSS..."
	$(TAILWIND) -i ./web/static/css/input.css -o ./web/static/css/output.css --minify
	@echo "Building JavaScript..."
	$(ESBUILD) web/static/js/src/main.js --bundle --minify --outfile=web/static/js/dist/bundle.js
	@echo "Generating templates..."
	templ generate
	@echo "Setup complete! Run 'make dev' to start development server."

# Development mode with hot reload (runs air + tailwind watch + esbuild watch in parallel)
dev:
	@echo "Starting development server with hot reload..."
	@echo "Building initial CSS..."
	@$(TAILWIND) -i ./web/static/css/input.css -o ./web/static/css/output.css
	@echo "Building initial JavaScript..."
	@$(ESBUILD) web/static/js/src/main.js --bundle --sourcemap --outfile=web/static/js/dist/bundle.js
	@echo "Generating dev asset manifest..."
	@go run ./cmd/hashstatic -dev
	@echo "Generating templates..."
	@templ generate
	@echo "Starting watchers..."
	@$(TAILWIND) -i ./web/static/css/input.css -o ./web/static/css/output.css --watch &
	@$(ESBUILD) web/static/js/src/main.js --bundle --sourcemap --outfile=web/static/js/dist/bundle.js --watch &
	@air

# Generate templ templates
templ:
	templ generate

# Generate sqlc code
sqlc:
	cd internal/database/sqlc && sqlc generate

# Seed database with sample data
seed:
	go run ./cmd/seed

# Open database with sqlite3 CLI (pretty formatting)
db:
	@sqlite3 -header -box ./data/site.db

# Backup database with timestamp
db-backup:
	@mkdir -p ./data/backups
	@cp ./data/site.db "./data/backups/site.db.$(shell date +%Y%m%d_%H%M%S)"
	@echo "Database backed up to ./data/backups/"

# Reset database (delete and recreate)
db-reset:
	@echo "This will DELETE all data. Press Ctrl+C to cancel, Enter to continue..."
	@read _
	@rm -f ./data/site.db
	@echo "Database deleted. Run 'make dev' or 'make run' to recreate."

# Build CSS
css:
	$(TAILWIND) -i ./web/static/css/input.css -o ./web/static/css/output.css --minify

# Watch CSS
css-watch:
	$(TAILWIND) -i ./web/static/css/input.css -o ./web/static/css/output.css --watch

# Build JavaScript
js:
	$(ESBUILD) web/static/js/src/main.js --bundle --minify --outfile=web/static/js/dist/bundle.js

# Watch JavaScript
js-watch:
	$(ESBUILD) web/static/js/src/main.js --bundle --sourcemap --outfile=web/static/js/dist/bundle.js --watch

# Hash static assets for production (content-based cache busting)
hash-assets:
	go run ./cmd/hashstatic

# Dev mode manifest (identity mapping, no hashing)
hash-assets-dev:
	go run ./cmd/hashstatic -dev

# Clean hashed files
clean-hashed:
	find ./web/static -regex ".*\.[0-9a-f]\{8\}\..*" -delete 2>/dev/null || true
	rm -f internal/assets/manifest_gen.go

# Build for production
build: templ css js hash-assets sqlc
	CGO_ENABLED=1 go build -o bin/server ./cmd/server

# Run without hot reload
run: templ css
	go run ./cmd/server

# Clean build artifacts
clean: clean-hashed
	rm -rf tmp data/*.db
	rm -f web/templates/**/*_templ.go
	rm -f web/static/css/output.css
	rm -f web/static/js/dist/bundle.js web/static/js/dist/bundle.js.map

# Format code
fmt:
	go fmt ./...
	templ fmt .

# Run tests
test:
	go test ./...

# Lint
lint:
	go vet ./...
	staticcheck ./...

# Generate and verify everything compiles
check: templ
	go build ./...

# Help
help:
	@echo "Available commands:"
	@echo "  make setup      - Install dependencies and initial setup"
	@echo "  make dev        - Start development server with hot reload (air + tailwind + esbuild)"
	@echo "  make build      - Build for production"
	@echo "  make run        - Run without hot reload"
	@echo "  make templ      - Generate templ templates"
	@echo "  make sqlc       - Generate sqlc database code"
	@echo "  make css        - Build CSS"
	@echo "  make css-watch  - Watch CSS for changes"
	@echo "  make js         - Build JavaScript bundle"
	@echo "  make js-watch   - Watch JavaScript for changes"
	@echo "  make hash-assets      - Hash static assets for cache busting"
	@echo "  make hash-assets-dev  - Generate dev manifest (no hashing)"
	@echo "  make clean-hashed     - Remove hashed files and manifest"
	@echo "  make seed       - Seed database with sample data"
	@echo "  make db         - Open SQLite CLI with pretty formatting"
	@echo "  make db-backup  - Backup database with timestamp"
	@echo "  make db-reset   - Delete database (recreated on next run)"
	@echo "  make clean      - Clean build artifacts"
	@echo "  make fmt        - Format code"
	@echo "  make test       - Run tests"
	@echo "  make check      - Verify everything compiles"
