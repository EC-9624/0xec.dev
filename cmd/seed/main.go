package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"math/rand"
	"strings"
	"time"

	"github.com/EC-9624/0xec.dev/internal/config"
	"github.com/EC-9624/0xec.dev/internal/database"
	"github.com/EC-9624/0xec.dev/internal/database/sqlc/db"
)

// Helper functions for pointers
func int64Ptr(i int64) *int64        { return &i }
func strPtr(s string) *string        { return &s }
func timePtr(t time.Time) *time.Time { return &t }

func main() {
	log.Println("Starting database seeder...")

	// Load configuration
	cfg := config.Load()

	// Initialize database
	if err := database.Init(cfg.DatabaseURL); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer database.Close()

	// Seed the database
	if err := seed(database.DB); err != nil {
		log.Fatalf("Failed to seed database: %v", err)
	}

	log.Println("Database seeded successfully!")
}

func seed(sqlDB *sql.DB) error {
	ctx := context.Background()
	queries := db.New(sqlDB)

	// Clear existing data (respect FK constraints - delete in reverse order)
	// Note: We don't clear users, bookmarks, bookmark_tags, or sessions
	log.Println("Clearing existing data (posts, tags, collections, activities)...")
	if err := clearData(sqlDB); err != nil {
		return fmt.Errorf("failed to clear data: %w", err)
	}

	// Seed tags
	log.Println("Seeding tags...")
	tags, err := seedTags(ctx, queries)
	if err != nil {
		return fmt.Errorf("failed to seed tags: %w", err)
	}

	// Seed collections
	log.Println("Seeding collections...")
	_, err = seedCollections(ctx, queries)
	if err != nil {
		return fmt.Errorf("failed to seed collections: %w", err)
	}

	// Seed posts
	log.Println("Seeding posts...")
	posts, err := seedPosts(ctx, queries)
	if err != nil {
		return fmt.Errorf("failed to seed posts: %w", err)
	}

	// Seed post_tags
	log.Println("Seeding post tags...")
	if err := seedPostTags(ctx, sqlDB, posts, tags); err != nil {
		return fmt.Errorf("failed to seed post tags: %w", err)
	}

	// Seed activities (post-related only)
	log.Println("Seeding activities...")
	if err := seedActivities(ctx, queries, posts); err != nil {
		return fmt.Errorf("failed to seed activities: %w", err)
	}

	return nil
}

func clearData(sqlDB *sql.DB) error {
	// Only clear tables we're seeding - preserve users, bookmarks, bookmark_tags, sessions
	tables := []string{
		"post_tags",
		"activities",
		"posts",
		"collections",
		"tags",
	}

	for _, table := range tables {
		if _, err := sqlDB.Exec(fmt.Sprintf("DELETE FROM %s", table)); err != nil {
			return fmt.Errorf("failed to clear %s: %w", table, err)
		}
	}

	return nil
}

func seedTags(ctx context.Context, queries *db.Queries) ([]db.Tag, error) {
	tagData := []struct {
		name  string
		slug  string
		color string
	}{
		{"Go", "go", "#00ADD8"},
		{"JavaScript", "javascript", "#F7DF1E"},
		{"TypeScript", "typescript", "#3178C6"},
		{"SQL", "sql", "#336791"},
		{"PostgreSQL", "postgresql", "#4169E1"},
		{"CSS", "css", "#1572B6"},
		{"HTML", "html", "#E34F26"},
		{"React", "react", "#61DAFB"},
		{"Linux", "linux", "#FCC624"},
		{"Tutorial", "tutorial", "#10B981"},
		{"Reference", "reference", "#6366F1"},
		{"Tool", "tool", "#8B5CF6"},
		{"Design", "design", "#EC4899"},
		{"Database", "database", "#059669"},
		{"DevOps", "devops", "#F97316"},
	}

	var tags []db.Tag
	for _, t := range tagData {
		tag, err := queries.CreateTag(ctx, db.CreateTagParams{
			Name:  t.name,
			Slug:  t.slug,
			Color: strPtr(t.color),
		})
		if err != nil {
			return nil, err
		}
		tags = append(tags, tag)
	}

	return tags, nil
}

func seedCollections(ctx context.Context, queries *db.Queries) ([]db.Collection, error) {
	collectionData := []struct {
		name        string
		slug        string
		description string
	}{
		{"Development", "development", "Programming tutorials, guides, and resources"},
		{"Design", "design", "UI/UX design resources and inspiration"},
		{"Databases", "databases", "SQL, PostgreSQL, and data systems"},
		{"DevOps", "devops", "Infrastructure, deployment, and operations"},
		{"Learning", "learning", "Educational resources and courses"},
		{"Tools", "tools", "Useful utilities and applications"},
		{"Reading", "reading", "Articles, blogs, and interesting reads"},
		{"Music", "music", "Audio, music production, and related"},
	}

	var collections []db.Collection
	for i, c := range collectionData {
		collection, err := queries.CreateCollection(ctx, db.CreateCollectionParams{
			Name:        c.name,
			Slug:        c.slug,
			Description: strPtr(c.description),
			SortOrder:   int64Ptr(int64(i)),
			IsPublic:    int64Ptr(1),
		})
		if err != nil {
			return nil, err
		}
		collections = append(collections, collection)
	}

	return collections, nil
}

func seedPosts(ctx context.Context, queries *db.Queries) ([]db.Post, error) {
	postData := []struct {
		title       string
		slug        string
		content     string
		excerpt     string
		isDraft     int64
		publishedAt *time.Time
	}{
		{
			title: "Getting Started with Go Modules",
			slug:  "getting-started-with-go-modules",
			content: `# Getting Started with Go Modules

Go modules are the standard way to manage dependencies in Go. Introduced in Go 1.11 and becoming the default in Go 1.16, modules solve many of the pain points developers faced with GOPATH.

## Why Modules?

Before modules, Go required all code to live in a single workspace (GOPATH). This made it difficult to:
- Work on multiple projects with different dependency versions
- Share code without publishing to a remote repository
- Reproduce builds reliably

## Creating a New Module

To create a new module, run:

` + "```bash\ngo mod init github.com/yourname/project\n```" + `

This creates a ` + "`go.mod`" + ` file that tracks your dependencies.

## Adding Dependencies

Simply import a package and run:

` + "```bash\ngo mod tidy\n```" + `

Go will automatically download the dependency and update your ` + "`go.mod`" + ` and ` + "`go.sum`" + ` files.

## Conclusion

Go modules make dependency management simple and reproducible. If you're starting a new Go project, modules are the way to go.`,
			excerpt:     "Learn how to use Go modules for dependency management in your Go projects.",
			isDraft:     0,
			publishedAt: timePtr(time.Now().AddDate(0, -2, -5)),
		},
		{
			title: "Building REST APIs with net/http",
			slug:  "building-rest-apis-with-net-http",
			content: `# Building REST APIs with net/http

Go's standard library includes everything you need to build production-ready REST APIs. Let's explore how to do it without any external frameworks.

## Setting Up the Server

` + "```go\npackage main\n\nimport (\n\t\"encoding/json\"\n\t\"net/http\"\n)\n\nfunc main() {\n\tmux := http.NewServeMux()\n\tmux.HandleFunc(\"/api/users\", handleUsers)\n\thttp.ListenAndServe(\":8080\", mux)\n}\n```" + `

## Handling JSON

Go makes JSON encoding/decoding straightforward:

` + "```go\ntype User struct {\n\tID   int    `json:\"id\"`\n\tName string `json:\"name\"`\n}\n\nfunc handleUsers(w http.ResponseWriter, r *http.Request) {\n\tusers := []User{{ID: 1, Name: \"Alice\"}}\n\tw.Header().Set(\"Content-Type\", \"application/json\")\n\tjson.NewEncoder(w).Encode(users)\n}\n```" + `

## Middleware

Create reusable middleware for logging, auth, etc:

` + "```go\nfunc loggingMiddleware(next http.Handler) http.Handler {\n\treturn http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {\n\t\tlog.Printf(\"%s %s\", r.Method, r.URL.Path)\n\t\tnext.ServeHTTP(w, r)\n\t})\n}\n```" + `

The standard library is powerful enough for most use cases!`,
			excerpt:     "Build production-ready REST APIs using only Go's standard library.",
			isDraft:     0,
			publishedAt: timePtr(time.Now().AddDate(0, -1, -15)),
		},
		{
			title: "Understanding Go Interfaces",
			slug:  "understanding-go-interfaces",
			content: `# Understanding Go Interfaces

Interfaces in Go are one of its most powerful features. They enable polymorphism and loose coupling without inheritance.

## Implicit Implementation

Unlike other languages, Go interfaces are implemented implicitly:

` + "```go\ntype Writer interface {\n\tWrite(p []byte) (n int, err error)\n}\n\n// Any type with a Write method implements Writer\ntype MyWriter struct{}\n\nfunc (m MyWriter) Write(p []byte) (int, error) {\n\treturn len(p), nil\n}\n```" + `

## The Empty Interface

The empty interface ` + "`interface{}`" + ` (or ` + "`any`" + ` in Go 1.18+) can hold any value:

` + "```go\nvar x any = \"hello\"\nx = 42\nx = true\n```" + `

## Interface Composition

Interfaces can be composed of other interfaces:

` + "```go\ntype ReadWriter interface {\n\tReader\n\tWriter\n}\n```" + `

## Best Practices

1. Keep interfaces small (1-3 methods)
2. Define interfaces where they're used, not where they're implemented
3. Accept interfaces, return concrete types

Interfaces are the key to writing flexible, testable Go code.`,
			excerpt:     "Deep dive into Go interfaces and how to use them effectively.",
			isDraft:     0,
			publishedAt: timePtr(time.Now().AddDate(0, -1, -3)),
		},
		{
			title: "SQL Query Optimization Tips",
			slug:  "sql-query-optimization-tips",
			content: `# SQL Query Optimization Tips

Slow queries can bring your application to its knees. Here are practical tips to speed them up.

## Use EXPLAIN ANALYZE

Always start by understanding what your query is doing:

` + "```sql\nEXPLAIN ANALYZE SELECT * FROM users WHERE email = 'test@example.com';\n```" + `

## Index Strategically

Create indexes on columns used in:
- WHERE clauses
- JOIN conditions
- ORDER BY clauses

` + "```sql\nCREATE INDEX idx_users_email ON users(email);\n```" + `

## Avoid SELECT *

Only select the columns you need:

` + "```sql\n-- Bad\nSELECT * FROM users;\n\n-- Good\nSELECT id, name, email FROM users;\n```" + `

## Use LIMIT

When you only need a subset of results:

` + "```sql\nSELECT * FROM logs ORDER BY created_at DESC LIMIT 100;\n```" + `

## Batch Operations

Instead of many single inserts, use batch inserts:

` + "```sql\nINSERT INTO users (name, email) VALUES\n\t('Alice', 'alice@example.com'),\n\t('Bob', 'bob@example.com'),\n\t('Charlie', 'charlie@example.com');\n```" + `

Profile first, optimize second!`,
			excerpt:     "Practical tips to make your SQL queries faster and more efficient.",
			isDraft:     0,
			publishedAt: timePtr(time.Now().AddDate(0, 0, -20)),
		},
		{
			title: "CSS Grid Layout Guide",
			slug:  "css-grid-layout-guide",
			content: `# CSS Grid Layout Guide

CSS Grid is a powerful layout system that makes complex layouts simple. Let's explore its core concepts.

## Basic Grid

` + "```css\n.container {\n\tdisplay: grid;\n\tgrid-template-columns: repeat(3, 1fr);\n\tgap: 1rem;\n}\n```" + `

## Defining Tracks

Control column and row sizes:

` + "```css\n.container {\n\tgrid-template-columns: 200px 1fr 2fr;\n\tgrid-template-rows: auto 1fr auto;\n}\n```" + `

## Placing Items

Position items explicitly:

` + "```css\n.item {\n\tgrid-column: 1 / 3; /* span 2 columns */\n\tgrid-row: 2 / 4;    /* span 2 rows */\n}\n```" + `

## Named Areas

Create semantic layouts:

` + "```css\n.container {\n\tgrid-template-areas:\n\t\t\"header header header\"\n\t\t\"sidebar main main\"\n\t\t\"footer footer footer\";\n}\n\n.header { grid-area: header; }\n.sidebar { grid-area: sidebar; }\n.main { grid-area: main; }\n.footer { grid-area: footer; }\n```" + `

## Auto-fill and Auto-fit

Create responsive grids without media queries:

` + "```css\n.container {\n\tgrid-template-columns: repeat(auto-fill, minmax(250px, 1fr));\n}\n```" + `

Grid makes previously impossible layouts trivial!`,
			excerpt:     "Master CSS Grid layout with this comprehensive guide.",
			isDraft:     0,
			publishedAt: timePtr(time.Now().AddDate(0, 0, -12)),
		},
		{
			title: "Introduction to HTMX",
			slug:  "introduction-to-htmx",
			content: `# Introduction to HTMX

HTMX lets you access modern browser features directly from HTML, without writing JavaScript.

## What is HTMX?

HTMX extends HTML with attributes that let you:
- Make AJAX requests
- Handle WebSocket connections
- Trigger CSS transitions
- And more...

## Basic Example

` + "```html\n<button hx-post=\"/api/like\" hx-swap=\"innerHTML\">\n\tLike (0)\n</button>\n```" + `

Clicking this button makes a POST request and replaces its content with the response.

## Common Attributes

| Attribute | Description |
|-----------|-------------|
| hx-get | Make a GET request |
| hx-post | Make a POST request |
| hx-trigger | What triggers the request |
| hx-target | Where to put the response |
| hx-swap | How to swap the content |

## Triggers

Control when requests are made:

` + "```html\n<!-- On input change, debounced -->\n<input hx-get=\"/search\" hx-trigger=\"keyup changed delay:500ms\">\n\n<!-- On viewport enter -->\n<div hx-get=\"/lazy-content\" hx-trigger=\"revealed\">\n```" + `

## Why HTMX?

- Simpler than SPA frameworks
- Server-side rendering friendly
- Progressive enhancement
- Smaller bundle size

HTMX brings the simplicity back to web development!`,
			excerpt:     "Discover HTMX and build interactive web apps without JavaScript frameworks.",
			isDraft:     0,
			publishedAt: timePtr(time.Now().AddDate(0, 0, -8)),
		},
		{
			title: "Docker for Development",
			slug:  "docker-for-development",
			content: `# Docker for Development

Docker creates consistent development environments that work the same everywhere.

## Basic Dockerfile

` + "```dockerfile\nFROM golang:1.21-alpine\n\nWORKDIR /app\n\nCOPY go.mod go.sum ./\nRUN go mod download\n\nCOPY . .\n\nRUN go build -o main .\n\nEXPOSE 8080\nCMD [\"./main\"]\n```" + `

## Docker Compose

Define multi-container applications:

` + "```yaml\nversion: '3.8'\nservices:\n  app:\n    build: .\n    ports:\n      - \"8080:8080\"\n    volumes:\n      - .:/app\n    depends_on:\n      - db\n\n  db:\n    image: postgres:15\n    environment:\n      POSTGRES_PASSWORD: secret\n    volumes:\n      - pgdata:/var/lib/postgresql/data\n\nvolumes:\n  pgdata:\n```" + `

## Development Workflow

1. Start services: ` + "`docker compose up -d`" + `
2. View logs: ` + "`docker compose logs -f`" + `
3. Run commands: ` + "`docker compose exec app go test ./...`" + `
4. Stop services: ` + "`docker compose down`" + `

## Hot Reload

Use volumes and tools like Air for hot reload:

` + "```yaml\nvolumes:\n  - .:/app\ncommand: air\n```" + `

Docker ensures "it works on my machine" actually means something!`,
			excerpt:     "Set up Docker for a smooth development experience.",
			isDraft:     0,
			publishedAt: timePtr(time.Now().AddDate(0, 0, -5)),
		},
		{
			title: "Git Workflow Best Practices",
			slug:  "git-workflow-best-practices",
			content: `# Git Workflow Best Practices

A good Git workflow keeps your project history clean and collaboration smooth.

## Commit Messages

Follow conventional commits:

` + "```\nfeat: add user authentication\nfix: resolve login redirect bug\ndocs: update API documentation\nrefactor: simplify database queries\n```" + `

## Branching Strategy

Keep it simple with trunk-based development:

` + "```\nmain (production)\n  |\n  +-- feature/user-auth\n  +-- fix/login-bug\n  +-- chore/update-deps\n```" + `

## Useful Commands

` + "```bash\n# Interactive rebase to clean up commits\ngit rebase -i HEAD~5\n\n# Stash changes temporarily\ngit stash\ngit stash pop\n\n# Cherry-pick specific commits\ngit cherry-pick abc123\n\n# Find who changed a line\ngit blame file.go\n```" + `

## Pull Request Tips

1. Keep PRs small and focused
2. Write descriptive PR descriptions
3. Request reviews from relevant people
4. Address feedback promptly

## .gitignore

Always ignore:
- Build artifacts
- Dependencies (node_modules, vendor)
- Environment files (.env)
- IDE settings (.idea, .vscode)

Good Git hygiene makes everyone's life easier!`,
			excerpt:     "Learn Git best practices for cleaner history and better collaboration.",
			isDraft:     0,
			publishedAt: timePtr(time.Now().AddDate(0, 0, -3)),
		},
		{
			title: "PostgreSQL Full-Text Search",
			slug:  "postgresql-full-text-search",
			content: `# PostgreSQL Full-Text Search

PostgreSQL has powerful built-in full-text search capabilities. No Elasticsearch needed for many use cases!

## Basic Search

` + "```sql\nSELECT * FROM posts\nWHERE to_tsvector('english', title || ' ' || content)\n      @@ to_tsquery('english', 'docker & kubernetes');\n```" + `

## Creating a Search Index

` + "```sql\n-- Add a tsvector column\nALTER TABLE posts ADD COLUMN search_vector tsvector;\n\n-- Populate it\nUPDATE posts SET search_vector =\n\tto_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, ''));\n\n-- Create a GIN index\nCREATE INDEX idx_posts_search ON posts USING GIN(search_vector);\n```" + `

## Keep It Updated

Use a trigger to automatically update the search vector:

` + "```sql\nCREATE FUNCTION posts_search_trigger() RETURNS trigger AS $$\nBEGIN\n\tNEW.search_vector :=\n\t\tto_tsvector('english', coalesce(NEW.title, '') || ' ' || coalesce(NEW.content, ''));\n\tRETURN NEW;\nEND\n$$ LANGUAGE plpgsql;\n\nCREATE TRIGGER posts_search_update\n\tBEFORE INSERT OR UPDATE ON posts\n\tFOR EACH ROW EXECUTE FUNCTION posts_search_trigger();\n```" + `

## Ranking Results

` + "```sql\nSELECT title, ts_rank(search_vector, query) AS rank\nFROM posts, to_tsquery('english', 'docker') query\nWHERE search_vector @@ query\nORDER BY rank DESC;\n```" + `

PostgreSQL's full-text search is surprisingly capable!`,
			excerpt:     "Implement powerful search in PostgreSQL without external services.",
			isDraft:     0,
			publishedAt: timePtr(time.Now().AddDate(0, 0, -1)),
		},
		{
			title: "Building CLI Tools in Go",
			slug:  "building-cli-tools-in-go",
			content: `# Building CLI Tools in Go

Go is excellent for building command-line tools. They compile to single binaries and run fast.

## Basic Structure

` + "```go\npackage main\n\nimport (\n\t\"flag\"\n\t\"fmt\"\n\t\"os\"\n)\n\nfunc main() {\n\tname := flag.String(\"name\", \"World\", \"name to greet\")\n\tflag.Parse()\n\n\tfmt.Printf(\"Hello, %s!\\n\", *name)\n}\n```" + `

## Using Cobra

For complex CLIs, use Cobra:

` + "```go\nvar rootCmd = &cobra.Command{\n\tUse:   \"myapp\",\n\tShort: \"A brief description\",\n\tRun: func(cmd *cobra.Command, args []string) {\n\t\t// main logic\n\t},\n}\n\nfunc main() {\n\tif err := rootCmd.Execute(); err != nil {\n\t\tos.Exit(1)\n\t}\n}\n```" + `

## Reading Input

` + "```go\nreader := bufio.NewReader(os.Stdin)\nfmt.Print(\"Enter text: \")\ntext, _ := reader.ReadString('\\n')\n```" + `

## Colored Output

` + "```go\nimport \"github.com/fatih/color\"\n\ncolor.Green(\"Success!\")\ncolor.Red(\"Error!\")\ncolor.Yellow(\"Warning!\")\n```" + `

## Progress Bars

` + "```go\nimport \"github.com/schollz/progressbar/v3\"\n\nbar := progressbar.Default(100)\nfor i := 0; i < 100; i++ {\n\tbar.Add(1)\n\ttime.Sleep(40 * time.Millisecond)\n}\n```" + `

Go CLI tools are a joy to build and distribute!`,
			excerpt:     "Create powerful command-line tools using Go.",
			isDraft:     0,
			publishedAt: timePtr(time.Now()),
		},
		// Draft posts
		{
			title:       "Kubernetes Basics",
			slug:        "kubernetes-basics",
			content:     "# Kubernetes Basics\n\nThis is a work in progress guide to Kubernetes fundamentals.\n\n## What is Kubernetes?\n\nKubernetes (K8s) is a container orchestration platform...\n\n## Core Concepts\n\n### Pods\n### Services\n### Deployments\n### ConfigMaps and Secrets\n\nMore coming soon...",
			excerpt:     "A beginner's guide to Kubernetes.",
			isDraft:     1,
			publishedAt: nil,
		},
		{
			title:       "Advanced Go Concurrency Patterns",
			slug:        "advanced-go-concurrency-patterns",
			content:     "# Advanced Go Concurrency Patterns\n\nDraft - exploring advanced patterns beyond basic goroutines and channels.\n\n## Worker Pools\n## Fan-out, Fan-in\n## Context Cancellation\n## errgroup\n\nTo be continued...",
			excerpt:     "Deep dive into Go concurrency patterns.",
			isDraft:     1,
			publishedAt: nil,
		},
		{
			title:       "Designing Database Schemas",
			slug:        "designing-database-schemas",
			content:     "# Designing Database Schemas\n\nNotes on database design best practices.\n\n## Normalization\n## Denormalization\n## Indexing Strategies\n## When to use NoSQL\n\nWork in progress...",
			excerpt:     "Best practices for database schema design.",
			isDraft:     1,
			publishedAt: nil,
		},
		{
			title:       "Tailwind CSS Tips and Tricks",
			slug:        "tailwind-css-tips-and-tricks",
			content:     "# Tailwind CSS Tips and Tricks\n\nCollection of useful Tailwind patterns I've discovered.\n\n## Custom Utilities\n## Responsive Design\n## Dark Mode\n## Animation\n\nStill collecting examples...",
			excerpt:     "Useful patterns and tricks for Tailwind CSS.",
			isDraft:     1,
			publishedAt: nil,
		},
		{
			title:       "Testing Strategies in Go",
			slug:        "testing-strategies-in-go",
			content:     "# Testing Strategies in Go\n\nComprehensive guide to testing Go applications.\n\n## Unit Testing\n## Table-Driven Tests\n## Mocking\n## Integration Tests\n## Benchmarks\n\nDraft - needs more examples...",
			excerpt:     "A complete guide to testing in Go.",
			isDraft:     1,
			publishedAt: nil,
		},
		{
			title:       "WebSocket Real-time Apps",
			slug:        "websocket-real-time-apps",
			content:     "# WebSocket Real-time Apps\n\nBuilding real-time applications with WebSockets.\n\n## WebSocket Basics\n## Go Implementation\n## Client-side JavaScript\n## Scaling WebSockets\n\nOutline only for now...",
			excerpt:     "Build real-time applications with WebSockets.",
			isDraft:     1,
			publishedAt: nil,
		},
		{
			title:       "Secure Authentication Patterns",
			slug:        "secure-authentication-patterns",
			content:     "# Secure Authentication Patterns\n\nSecurity best practices for web authentication.\n\n## Password Hashing\n## Session Management\n## JWT Tokens\n## OAuth 2.0\n## Two-Factor Authentication\n\nResearch in progress...",
			excerpt:     "Implement secure authentication in your applications.",
			isDraft:     1,
			publishedAt: nil,
		},
		{
			title:       "Monitoring and Observability",
			slug:        "monitoring-and-observability",
			content:     "# Monitoring and Observability\n\nThe three pillars of observability explained.\n\n## Logs\n## Metrics\n## Traces\n## Tools (Prometheus, Grafana, Jaeger)\n\nDraft...",
			excerpt:     "Understanding monitoring and observability.",
			isDraft:     1,
			publishedAt: nil,
		},
	}

	var posts []db.Post
	for _, p := range postData {
		post, err := queries.CreatePost(ctx, db.CreatePostParams{
			Title:       p.title,
			Slug:        p.slug,
			Content:     p.content,
			Excerpt:     strPtr(p.excerpt),
			IsDraft:     int64Ptr(p.isDraft),
			PublishedAt: p.publishedAt,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to create post %s: %w", p.slug, err)
		}
		posts = append(posts, post)
	}

	return posts, nil
}

func seedPostTags(ctx context.Context, sqlDB *sql.DB, posts []db.Post, tags []db.Tag) error {
	// Create tag map by name for easy lookup
	tagMap := make(map[string]int64)
	for _, t := range tags {
		tagMap[strings.ToLower(t.Name)] = t.ID
	}

	// Assign tags based on post content
	for _, post := range posts {
		var tagIDs []int64
		title := strings.ToLower(post.Title)
		content := strings.ToLower(post.Content)

		// Match tags based on content
		if strings.Contains(title, "go") || strings.Contains(content, "go mod") || strings.Contains(content, "golang") {
			if id, ok := tagMap["go"]; ok {
				tagIDs = append(tagIDs, id)
			}
		}
		if strings.Contains(title, "sql") || strings.Contains(title, "postgres") {
			if id, ok := tagMap["sql"]; ok {
				tagIDs = append(tagIDs, id)
			}
			if id, ok := tagMap["postgresql"]; ok {
				tagIDs = append(tagIDs, id)
			}
		}
		if strings.Contains(title, "css") || strings.Contains(title, "tailwind") {
			if id, ok := tagMap["css"]; ok {
				tagIDs = append(tagIDs, id)
			}
		}
		if strings.Contains(title, "docker") || strings.Contains(title, "kubernetes") || strings.Contains(title, "devops") {
			if id, ok := tagMap["devops"]; ok {
				tagIDs = append(tagIDs, id)
			}
		}
		if strings.Contains(title, "htmx") || strings.Contains(content, "htmx") {
			if id, ok := tagMap["html"]; ok {
				tagIDs = append(tagIDs, id)
			}
		}
		if strings.Contains(title, "git") {
			if id, ok := tagMap["tool"]; ok {
				tagIDs = append(tagIDs, id)
			}
		}
		if strings.Contains(title, "cli") || strings.Contains(title, "command-line") {
			if id, ok := tagMap["tool"]; ok {
				tagIDs = append(tagIDs, id)
			}
			if id, ok := tagMap["go"]; ok {
				tagIDs = append(tagIDs, id)
			}
		}
		if strings.Contains(title, "api") || strings.Contains(title, "rest") {
			if id, ok := tagMap["go"]; ok {
				tagIDs = append(tagIDs, id)
			}
		}
		if strings.Contains(title, "database") || strings.Contains(title, "schema") {
			if id, ok := tagMap["database"]; ok {
				tagIDs = append(tagIDs, id)
			}
		}
		if strings.Contains(title, "test") {
			if id, ok := tagMap["go"]; ok {
				tagIDs = append(tagIDs, id)
			}
		}
		if strings.Contains(title, "websocket") || strings.Contains(title, "real-time") {
			if id, ok := tagMap["javascript"]; ok {
				tagIDs = append(tagIDs, id)
			}
		}
		if strings.Contains(title, "authentication") || strings.Contains(title, "security") {
			if id, ok := tagMap["tutorial"]; ok {
				tagIDs = append(tagIDs, id)
			}
		}
		if strings.Contains(title, "monitoring") || strings.Contains(title, "observability") {
			if id, ok := tagMap["devops"]; ok {
				tagIDs = append(tagIDs, id)
			}
		}

		// Always add tutorial tag for educational posts
		if strings.Contains(title, "getting started") || strings.Contains(title, "introduction") || strings.Contains(title, "guide") || strings.Contains(title, "basics") {
			if id, ok := tagMap["tutorial"]; ok {
				tagIDs = append(tagIDs, id)
			}
		}

		// Add at least one tag
		if len(tagIDs) == 0 {
			randomTag := tags[rand.Intn(len(tags))]
			tagIDs = append(tagIDs, randomTag.ID)
		}

		// Insert post_tags
		for _, tagID := range tagIDs {
			_, err := sqlDB.ExecContext(ctx, `
				INSERT OR IGNORE INTO post_tags (post_id, tag_id) VALUES (?, ?)
			`, post.ID, tagID)
			if err != nil {
				return err
			}
		}
	}

	return nil
}

func seedActivities(ctx context.Context, queries *db.Queries, posts []db.Post) error {
	// Post-related activities only (no bookmark activities)
	activities := []struct {
		action     string
		entityType string
		title      string
	}{
		{"create", "post", ""},
		{"publish", "post", ""},
		{"create", "collection", "Created collection: Development"},
		{"create", "collection", "Created collection: Design"},
		{"create", "collection", "Created collection: Databases"},
		{"update", "post", ""},
		{"create", "post", ""},
		{"publish", "post", ""},
		{"create", "collection", "Created collection: Tools"},
		{"update", "post", ""},
		{"create", "post", ""},
		{"publish", "post", ""},
		{"create", "collection", "Created collection: Learning"},
		{"create", "collection", "Created collection: Reading"},
		{"update", "post", ""},
	}

	postIdx := 0

	for _, a := range activities {
		var entityID *int64
		title := a.title

		// Assign actual entity IDs and titles for posts
		if a.entityType == "post" && (a.action == "create" || a.action == "publish") && postIdx < len(posts) {
			id := posts[postIdx].ID
			entityID = &id
			if a.action == "publish" {
				title = "Published: " + posts[postIdx].Title
			} else {
				title = posts[postIdx].Title
			}
			postIdx++
		} else if a.entityType == "post" && a.action == "update" && postIdx > 0 {
			id := posts[postIdx-1].ID
			entityID = &id
			title = "Updated: " + posts[postIdx-1].Title
		}

		_, err := queries.CreateActivity(ctx, db.CreateActivityParams{
			Action:      a.action,
			EntityType:  a.entityType,
			EntityID:    entityID,
			EntityTitle: strPtr(title),
		})
		if err != nil {
			return err
		}
	}

	return nil
}
