package database

import (
	"database/sql"
	_ "embed"
	"fmt"
	"log"
	"os"
	"path/filepath"

	_ "github.com/mattn/go-sqlite3"
)

//go:embed migrations/001_initial.sql
var initialMigration string

//go:embed migrations/002_activities.sql
var activitiesMigration string

//go:embed migrations/003_remove_collection_icon.sql
var removeCollectionIconMigration string

// migration represents a database migration
type migration struct {
	name string
	sql  string
}

// migrations list in order of execution
var migrations = []migration{
	{"001_initial", initialMigration},
	{"002_activities", activitiesMigration},
	{"003_remove_collection_icon", removeCollectionIconMigration},
}

// Init initializes the database connection and runs migrations.
// Returns the database connection which the caller is responsible for closing.
func Init(dbPath string) (*sql.DB, error) {
	// Ensure the directory exists
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create database directory: %w", err)
	}

	db, err := sql.Open("sqlite3", dbPath+"?_foreign_keys=on")
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// Test the connection
	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	// Run migrations
	if err := runMigrations(db); err != nil {
		return nil, fmt.Errorf("failed to run migrations: %w", err)
	}

	return db, nil
}

// ensureMigrationsTable creates the migrations tracking table if it doesn't exist
func ensureMigrationsTable(db *sql.DB) error {
	_, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			name TEXT PRIMARY KEY,
			applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)
	`)
	return err
}

// isMigrationApplied checks if a migration has already been applied
func isMigrationApplied(db *sql.DB, name string) (bool, error) {
	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM schema_migrations WHERE name = ?", name).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

// recordMigration records that a migration has been applied
func recordMigration(db *sql.DB, name string) error {
	_, err := db.Exec("INSERT INTO schema_migrations (name) VALUES (?)", name)
	return err
}

// runMigrations runs all database migrations that haven't been applied yet
func runMigrations(db *sql.DB) error {
	// Ensure migrations table exists
	if err := ensureMigrationsTable(db); err != nil {
		return fmt.Errorf("failed to create migrations table: %w", err)
	}

	for _, m := range migrations {
		applied, err := isMigrationApplied(db, m.name)
		if err != nil {
			return fmt.Errorf("failed to check migration %s: %w", m.name, err)
		}

		if applied {
			continue
		}

		log.Printf("Running migration: %s", m.name)

		_, err = db.Exec(m.sql)
		if err != nil {
			return fmt.Errorf("failed to run migration %s: %w", m.name, err)
		}

		if err := recordMigration(db, m.name); err != nil {
			return fmt.Errorf("failed to record migration %s: %w", m.name, err)
		}

		log.Printf("Migration %s applied successfully", m.name)
	}

	return nil
}
