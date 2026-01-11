// Command migrate-images downloads external images for existing bookmarks
// and stores them locally in the database for CSP compliance.
package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"os"
	"time"

	"github.com/EC-9624/0xec.dev/internal/config"
	"github.com/EC-9624/0xec.dev/internal/database"
	"github.com/EC-9624/0xec.dev/internal/models"
	"github.com/EC-9624/0xec.dev/internal/service"
)

func main() {
	// Flags
	dryRun := flag.Bool("dry-run", false, "Show what would be migrated without making changes")
	limit := flag.Int("limit", 0, "Limit number of bookmarks to process (0 = all)")
	flag.Parse()

	// Load configuration
	cfg := config.Load()

	// Initialize database
	if err := database.Init(cfg.DatabaseURL); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer database.Close()

	// Create service
	svc := service.New(database.DB)
	ctx := context.Background()

	// Get count of bookmarks with external images
	count, err := svc.CountBookmarksWithExternalImages(ctx)
	if err != nil {
		log.Fatalf("Failed to count bookmarks: %v", err)
	}

	fmt.Printf("Found %d bookmarks with external images to migrate\n", count)

	if count == 0 {
		fmt.Println("Nothing to migrate!")
		os.Exit(0)
	}

	if *dryRun {
		fmt.Println("\n[DRY RUN] Would migrate the following bookmarks:")
		bookmarks, err := svc.ListBookmarksWithExternalImages(ctx)
		if err != nil {
			log.Fatalf("Failed to list bookmarks: %v", err)
		}

		displayLimit := len(bookmarks)
		if *limit > 0 && *limit < displayLimit {
			displayLimit = *limit
		}

		for i, b := range bookmarks[:displayLimit] {
			fmt.Printf("  %d. [ID:%d] %s\n", i+1, b.ID, b.Title)
			if b.GetCoverImage() != "" {
				fmt.Printf("      Cover: %s\n", truncate(b.GetCoverImage(), 60))
			}
			if b.GetFavicon() != "" {
				fmt.Printf("      Favicon: %s\n", truncate(b.GetFavicon(), 60))
			}
		}

		if displayLimit < len(bookmarks) {
			fmt.Printf("  ... and %d more\n", len(bookmarks)-displayLimit)
		}

		fmt.Println("\nRun without --dry-run to perform migration")
		os.Exit(0)
	}

	// Get bookmarks to migrate
	bookmarks, err := svc.ListBookmarksWithExternalImages(ctx)
	if err != nil {
		log.Fatalf("Failed to list bookmarks: %v", err)
	}

	// Apply limit if specified
	if *limit > 0 && *limit < len(bookmarks) {
		bookmarks = bookmarks[:*limit]
	}

	fmt.Printf("\nMigrating %d bookmarks...\n\n", len(bookmarks))

	var (
		success  int
		failed   int
		skipped  int
		imgCount int
	)

	for i, bookmark := range bookmarks {
		fmt.Printf("[%d/%d] %s\n", i+1, len(bookmarks), bookmark.Title)

		// Get external URLs
		coverURL := getExternalCoverURL(bookmark)
		faviconURL := getExternalFaviconURL(bookmark)

		if coverURL == "" && faviconURL == "" {
			fmt.Println("  → Skipped (no external URLs)")
			skipped++
			continue
		}

		// Download and store images
		var coverID, faviconID *int64

		if coverURL != "" {
			fmt.Printf("  → Downloading cover image... ")
			id, err := svc.DownloadAndStoreImage(ctx, coverURL, models.MaxCoverImageSize)
			if err != nil {
				fmt.Printf("FAILED: %v\n", err)
			} else {
				fmt.Printf("OK (ID: %d)\n", id)
				coverID = &id
				imgCount++
			}
		}

		if faviconURL != "" {
			fmt.Printf("  → Downloading favicon... ")
			id, err := svc.DownloadAndStoreImage(ctx, faviconURL, models.MaxFaviconSize)
			if err != nil {
				fmt.Printf("FAILED: %v\n", err)
			} else {
				fmt.Printf("OK (ID: %d)\n", id)
				faviconID = &id
				imgCount++
			}
		}

		// Update bookmark with image IDs
		if coverID != nil || faviconID != nil {
			if err := svc.UpdateBookmarkImageIDs(ctx, bookmark.ID, coverID, faviconID); err != nil {
				fmt.Printf("  → FAILED to update bookmark: %v\n", err)
				failed++
			} else {
				fmt.Println("  → Updated bookmark")
				success++
			}
		} else {
			fmt.Println("  → No images downloaded")
			failed++
		}

		// Rate limit to be nice to external servers
		time.Sleep(500 * time.Millisecond)
	}

	fmt.Printf("\n=== Migration Complete ===\n")
	fmt.Printf("Success: %d bookmarks\n", success)
	fmt.Printf("Failed:  %d bookmarks\n", failed)
	fmt.Printf("Skipped: %d bookmarks\n", skipped)
	fmt.Printf("Images:  %d downloaded\n", imgCount)
}

// getExternalCoverURL returns the cover image URL only if it's external
func getExternalCoverURL(b models.Bookmark) string {
	// If already has local image ID, skip
	if b.CoverImageID.Valid {
		return ""
	}
	url := b.CoverImage.String
	if url == "" || isLocalURL(url) {
		return ""
	}
	return url
}

// getExternalFaviconURL returns the favicon URL only if it's external
func getExternalFaviconURL(b models.Bookmark) string {
	// If already has local image ID, skip
	if b.FaviconID.Valid {
		return ""
	}
	url := b.Favicon.String
	if url == "" || isLocalURL(url) {
		return ""
	}
	return url
}

// isLocalURL checks if a URL points to local storage
func isLocalURL(url string) bool {
	return len(url) > 0 && url[0] == '/'
}

// truncate shortens a string to maxLen with ellipsis
func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}
