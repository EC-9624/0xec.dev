package service

import (
	"context"
	"encoding/json"
	"time"

	"github.com/EC-9624/0xec.dev/internal/database/sqlc/db"
)

// Activity action types
const (
	ActionBookmarkCreated   = "bookmark.created"
	ActionBookmarkUpdated   = "bookmark.updated"
	ActionBookmarkDeleted   = "bookmark.deleted"
	ActionPostCreated       = "post.created"
	ActionPostUpdated       = "post.updated"
	ActionPostDeleted       = "post.deleted"
	ActionPostPublished     = "post.published"
	ActionCollectionCreated = "collection.created"
	ActionCollectionUpdated = "collection.updated"
	ActionCollectionDeleted = "collection.deleted"
	ActionTagCreated        = "tag.created"
	ActionTagDeleted        = "tag.deleted"
	ActionImportStarted     = "import.started"
	ActionImportCompleted   = "import.completed"
	ActionMetadataFetched   = "metadata.fetched"
)

// Entity types
const (
	EntityBookmark   = "bookmark"
	EntityPost       = "post"
	EntityCollection = "collection"
	EntityTag        = "tag"
	EntityImport     = "import"
)

// Activity represents an activity log entry
type Activity struct {
	ID         int64                  `json:"id"`
	Action     string                 `json:"action"`
	EntityType string                 `json:"entity_type"`
	EntityID   int64                  `json:"entity_id"`
	Title      string                 `json:"title"`
	Metadata   map[string]interface{} `json:"metadata"`
	CreatedAt  time.Time              `json:"created_at"`
}

// LogActivity logs a new activity
func (s *Service) LogActivity(ctx context.Context, action, entityType string, entityID int64, title string, metadata map[string]interface{}) (*Activity, error) {
	var metadataJSON *string
	if metadata != nil {
		bytes, err := json.Marshal(metadata)
		if err == nil {
			str := string(bytes)
			metadataJSON = &str
		}
	}

	var entityIDPtr *int64
	if entityID > 0 {
		entityIDPtr = &entityID
	}

	var titlePtr *string
	if title != "" {
		titlePtr = &title
	}

	activity, err := s.queries.CreateActivity(ctx, db.CreateActivityParams{
		Action:      action,
		EntityType:  entityType,
		EntityID:    entityIDPtr,
		EntityTitle: titlePtr,
		Metadata:    metadataJSON,
	})
	if err != nil {
		return nil, err
	}

	return dbActivityToModel(activity), nil
}

// ListRecentActivities returns recent activity logs
func (s *Service) ListRecentActivities(ctx context.Context, limit, offset int) ([]Activity, error) {
	activities, err := s.queries.ListRecentActivities(ctx, db.ListRecentActivitiesParams{
		Limit:  int64(limit),
		Offset: int64(offset),
	})
	if err != nil {
		return nil, err
	}

	result := make([]Activity, 0, len(activities))
	for _, a := range activities {
		result = append(result, *dbActivityToModel(a))
	}

	return result, nil
}

// CountActivities returns total number of activities
func (s *Service) CountActivities(ctx context.Context) (int, error) {
	count, err := s.queries.CountActivities(ctx)
	return int(count), err
}

// DeleteActivitiesForEntity deletes all activities for a specific entity
func (s *Service) DeleteActivitiesForEntity(ctx context.Context, entityType string, entityID int64) error {
	return s.queries.DeleteActivitiesByEntity(ctx, db.DeleteActivitiesByEntityParams{
		EntityType: entityType,
		EntityID:   &entityID,
	})
}

// Helper to convert db.Activity to Activity model
func dbActivityToModel(a db.Activity) *Activity {
	activity := &Activity{
		ID:         a.ID,
		Action:     a.Action,
		EntityType: a.EntityType,
		CreatedAt:  derefTime(a.CreatedAt),
	}

	if a.EntityID != nil {
		activity.EntityID = *a.EntityID
	}
	if a.EntityTitle != nil {
		activity.Title = *a.EntityTitle
	}
	if a.Metadata != nil {
		var metadata map[string]interface{}
		if err := json.Unmarshal([]byte(*a.Metadata), &metadata); err == nil {
			activity.Metadata = metadata
		}
	}

	return activity
}

// GetActivityIcon returns an icon for the activity action
func GetActivityIcon(action string) string {
	switch action {
	case ActionBookmarkCreated:
		return "+"
	case ActionBookmarkUpdated:
		return "~"
	case ActionBookmarkDeleted:
		return "-"
	case ActionPostCreated:
		return "+"
	case ActionPostUpdated:
		return "~"
	case ActionPostDeleted:
		return "-"
	case ActionPostPublished:
		return "!"
	case ActionCollectionCreated:
		return "+"
	case ActionCollectionUpdated:
		return "~"
	case ActionCollectionDeleted:
		return "-"
	case ActionImportStarted:
		return ">"
	case ActionImportCompleted:
		return "v"
	case ActionMetadataFetched:
		return "i"
	default:
		return "●"
	}
}

// GetActivityVerb returns a human-readable verb for the action
func GetActivityVerb(action string) string {
	switch action {
	case ActionBookmarkCreated:
		return "Added bookmark"
	case ActionBookmarkUpdated:
		return "Updated bookmark"
	case ActionBookmarkDeleted:
		return "Deleted bookmark"
	case ActionPostCreated:
		return "Created post"
	case ActionPostUpdated:
		return "Updated post"
	case ActionPostDeleted:
		return "Deleted post"
	case ActionPostPublished:
		return "Published post"
	case ActionCollectionCreated:
		return "Created collection"
	case ActionCollectionUpdated:
		return "Updated collection"
	case ActionCollectionDeleted:
		return "Deleted collection"
	case ActionTagCreated:
		return "Created tag"
	case ActionTagDeleted:
		return "Deleted tag"
	case ActionImportStarted:
		return "Started import"
	case ActionImportCompleted:
		return "Completed import"
	case ActionMetadataFetched:
		return "Fetched metadata"
	default:
		return action
	}
}
