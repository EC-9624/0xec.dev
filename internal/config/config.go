package config

import (
	"os"
	"strconv"
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
		SessionKey:  getEnv("SESSION_KEY", "change-me-in-production-32chars"),
		AdminUser:   getEnv("ADMIN_USER", "admin"),
		AdminPass:   getEnv("ADMIN_PASS", "admin"),
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
