package database

import (
	"database/sql"
	_ "embed"
	"fmt"
	"os"
	"path/filepath"

	_ "github.com/mattn/go-sqlite3"
)

//go:embed migrations/001_initial.sql
var initialMigration string

//go:embed migrations/002_activities.sql
var activitiesMigration string

//go:embed migrations/003_remove_collection_icon_color.sql
var removeCollectionIconColorMigration string

//go:embed migrations/004_add_collection_color.sql
var addCollectionColorMigration string

// DB is the global database connection
var DB *sql.DB

// Init initializes the database connection and runs migrations
func Init(dbPath string) error {
	// Ensure the directory exists
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create database directory: %w", err)
	}

	var err error
	DB, err = sql.Open("sqlite3", dbPath+"?_foreign_keys=on")
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}

	// Test the connection
	if err := DB.Ping(); err != nil {
		return fmt.Errorf("failed to ping database: %w", err)
	}

	// Run migrations
	if err := runMigrations(); err != nil {
		return fmt.Errorf("failed to run migrations: %w", err)
	}

	return nil
}

// runMigrations runs all database migrations
func runMigrations() error {
	_, err := DB.Exec(initialMigration)
	if err != nil {
		return fmt.Errorf("failed to run initial migration: %w", err)
	}

	_, err = DB.Exec(activitiesMigration)
	if err != nil {
		return fmt.Errorf("failed to run activities migration: %w", err)
	}

	// Migration 003: Remove icon and color from collections
	// This uses ALTER TABLE DROP COLUMN which requires SQLite 3.35.0+
	_, err = DB.Exec(removeCollectionIconColorMigration)
	if err != nil {
		// Ignore error if columns don't exist (migration already ran)
		// SQLite will error with "no such column" if already dropped
	}

	// Migration 004: Add color column back to collections
	_, err = DB.Exec(addCollectionColorMigration)
	if err != nil {
		// Ignore error if column already exists
	}

	return nil
}

// Close closes the database connection
func Close() error {
	if DB != nil {
		return DB.Close()
	}
	return nil
}
