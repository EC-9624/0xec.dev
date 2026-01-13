package config

import (
	"fmt"
	"log/slog"
	"os"
	"strconv"
)

// Default insecure values that must be changed in production
const (
	defaultSessionKey = "change-me-in-production-32chars"
	defaultAdminPass  = "admin"
)

// Config holds all configuration for the application
type Config struct {
	Port        string
	DatabaseURL string
	SessionKey  string
	AdminUser   string
	AdminPass   string
	BaseURL     string
	Environment string

	// Pagination settings
	BookmarksPerPage    int
	AdminBookmarksLimit int
	PostsPerPage        int
}

// Load loads configuration from environment variables with sensible defaults
func Load() *Config {
	return &Config{
		Port:        getEnv("PORT", "8080"),
		DatabaseURL: getEnv("DATABASE_URL", "./data/site.db"),
		SessionKey:  getEnv("SESSION_KEY", defaultSessionKey),
		AdminUser:   getEnv("ADMIN_USER", "admin"),
		AdminPass:   getEnv("ADMIN_PASS", defaultAdminPass),
		BaseURL:     getEnv("BASE_URL", "http://localhost:8080"),
		Environment: getEnv("ENVIRONMENT", "development"),

		// Pagination defaults
		BookmarksPerPage:    getEnvInt("BOOKMARKS_PER_PAGE", 24),
		AdminBookmarksLimit: getEnvInt("ADMIN_BOOKMARKS_LIMIT", 500),
		PostsPerPage:        getEnvInt("POSTS_PER_PAGE", 100),
	}
}

// IsDevelopment returns true if running in development mode
func (c *Config) IsDevelopment() bool {
	return c.Environment == "development"
}

// IsProduction returns true if running in production mode
func (c *Config) IsProduction() bool {
	return c.Environment == "production"
}

// Validate checks if the configuration is valid for the current environment.
// Returns an error if critical security settings are misconfigured in production.
func (c *Config) Validate() error {
	if c.IsProduction() {
		// Check session key
		if c.SessionKey == defaultSessionKey {
			return fmt.Errorf("SESSION_KEY must be changed from default value in production")
		}
		if len(c.SessionKey) < 32 {
			return fmt.Errorf("SESSION_KEY must be at least 32 characters in production")
		}

		// Check admin password
		if c.AdminPass == defaultAdminPass {
			return fmt.Errorf("ADMIN_PASS must be changed from default value in production")
		}
		if len(c.AdminPass) < 8 {
			return fmt.Errorf("ADMIN_PASS must be at least 8 characters in production")
		}
	}

	// Warn about insecure settings in non-production environments
	if !c.IsProduction() && !c.IsDevelopment() {
		if c.SessionKey == defaultSessionKey {
			slog.Warn("using default SESSION_KEY - change this before deploying")
		}
		if c.AdminPass == defaultAdminPass {
			slog.Warn("using default ADMIN_PASS - change this before deploying")
		}
	}

	return nil
}

// MustValidate validates the configuration and panics if invalid.
// Use this at startup to fail fast on misconfiguration.
func (c *Config) MustValidate() {
	if err := c.Validate(); err != nil {
		slog.Error("invalid configuration", "error", err)
		os.Exit(1)
	}
}

func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if value, exists := os.LookupEnv(key); exists {
		if intVal, err := strconv.Atoi(value); err == nil {
			return intVal
		}
	}
	return fallback
}
