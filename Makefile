.PHONY: dev build run clean templ css install setup sqlc seed db db-backup db-reset

# Tailwind standalone CLI
TAILWIND := ./bin/tailwindcss
TAILWIND_URL := https://github.com/tailwindlabs/tailwindcss/releases/latest/download/tailwindcss-macos-arm64

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

# Initial setup
setup: install
	@echo "Creating data directory..."
	mkdir -p data
	@echo "Building CSS..."
	$(TAILWIND) -i ./web/static/css/input.css -o ./web/static/css/output.css --minify
	@echo "Generating templates..."
	templ generate
	@echo "Setup complete! Run 'make dev' to start development server."

# Development mode with hot reload (runs air + tailwind watch in parallel)
dev:
	@echo "Starting development server with hot reload..."
	@echo "Building initial CSS..."
	@$(TAILWIND) -i ./web/static/css/input.css -o ./web/static/css/output.css
	@echo "Generating templates..."
	@templ generate
	@echo "Starting watchers..."
	@$(TAILWIND) -i ./web/static/css/input.css -o ./web/static/css/output.css --watch &
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

# Build for production
build: templ css sqlc
	CGO_ENABLED=1 go build -o bin/server ./cmd/server

# Run without hot reload
run: templ css
	go run ./cmd/server

# Clean build artifacts
clean:
	rm -rf tmp data/*.db
	rm -f web/templates/**/*_templ.go
	rm -f web/static/css/output.css

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

# Generate and verify everything compiles
check: templ
	go build ./...

# Help
help:
	@echo "Available commands:"
	@echo "  make setup      - Install dependencies and initial setup"
	@echo "  make dev        - Start development server with hot reload (air + tailwind)"
	@echo "  make build      - Build for production"
	@echo "  make run        - Run without hot reload"
	@echo "  make templ      - Generate templ templates"
	@echo "  make sqlc       - Generate sqlc database code"
	@echo "  make css        - Build CSS"
	@echo "  make css-watch  - Watch CSS for changes"
	@echo "  make seed       - Seed database with sample data"
	@echo "  make db         - Open SQLite CLI with pretty formatting"
	@echo "  make db-backup  - Backup database with timestamp"
	@echo "  make db-reset   - Delete database (recreated on next run)"
	@echo "  make clean      - Clean build artifacts"
	@echo "  make fmt        - Format code"
	@echo "  make test       - Run tests"
	@echo "  make check      - Verify everything compiles"
