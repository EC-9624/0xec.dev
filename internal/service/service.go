package service

import (
	"database/sql"

	"github.com/EC-9624/0xec.dev/internal/database/sqlc/db"
)

// Service wraps sqlc Queries and provides business logic
type Service struct {
	queries *db.Queries
	db      *sql.DB
}

// New creates a new Service instance
func New(database *sql.DB) *Service {
	return &Service{
		queries: db.New(database),
		db:      database,
	}
}
