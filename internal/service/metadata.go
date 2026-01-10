package service

import (
	"context"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"
)

// PageMetadata contains extracted metadata from a URL
type PageMetadata struct {
	Title       string
	Description string
	Image       string
}

// FetchPageMetadata fetches and parses Open Graph and HTML metadata from a URL
func (s *Service) FetchPageMetadata(ctx context.Context, url string) (*PageMetadata, error) {
	client := &http.Client{
		Timeout: 10 * time.Second,
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}

	// Set a browser-like User-Agent to avoid being blocked
	req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; BookmarkBot/1.0)")
	req.Header.Set("Accept", "text/html")

	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	// Limit reading to 1MB to avoid huge pages
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1024*1024))
	if err != nil {
		return nil, err
	}

	html := string(body)
	metadata := &PageMetadata{}

	// Extract Open Graph metadata (preferred)
	metadata.Title = extractMeta(html, `og:title`)
	metadata.Description = extractMeta(html, `og:description`)
	metadata.Image = extractMeta(html, `og:image`)

	// Fall back to Twitter card metadata
	if metadata.Title == "" {
		metadata.Title = extractMeta(html, `twitter:title`)
	}
	if metadata.Description == "" {
		metadata.Description = extractMeta(html, `twitter:description`)
	}
	if metadata.Image == "" {
		metadata.Image = extractMeta(html, `twitter:image`)
	}

	// Fall back to standard HTML metadata
	if metadata.Title == "" {
		metadata.Title = extractHTMLTitle(html)
	}
	if metadata.Description == "" {
		metadata.Description = extractMeta(html, `description`)
	}

	// Clean up
	metadata.Title = cleanText(metadata.Title)
	metadata.Description = cleanText(metadata.Description)

	return metadata, nil
}

// extractMeta extracts content from meta tags
// Handles both property="og:title" and name="description" formats
func extractMeta(html, name string) string {
	// Pattern for property="name" content="value"
	patterns := []string{
		`(?i)<meta[^>]+property=["']` + regexp.QuoteMeta(name) + `["'][^>]+content=["']([^"']+)["']`,
		`(?i)<meta[^>]+content=["']([^"']+)["'][^>]+property=["']` + regexp.QuoteMeta(name) + `["']`,
		`(?i)<meta[^>]+name=["']` + regexp.QuoteMeta(name) + `["'][^>]+content=["']([^"']+)["']`,
		`(?i)<meta[^>]+content=["']([^"']+)["'][^>]+name=["']` + regexp.QuoteMeta(name) + `["']`,
	}

	for _, pattern := range patterns {
		re := regexp.MustCompile(pattern)
		matches := re.FindStringSubmatch(html)
		if len(matches) > 1 {
			return matches[1]
		}
	}

	return ""
}

// extractHTMLTitle extracts the <title> tag content
func extractHTMLTitle(html string) string {
	re := regexp.MustCompile(`(?i)<title[^>]*>([^<]+)</title>`)
	matches := re.FindStringSubmatch(html)
	if len(matches) > 1 {
		return matches[1]
	}
	return ""
}

// cleanText cleans up extracted text
func cleanText(s string) string {
	// Decode common HTML entities
	s = strings.ReplaceAll(s, "&amp;", "&")
	s = strings.ReplaceAll(s, "&lt;", "<")
	s = strings.ReplaceAll(s, "&gt;", ">")
	s = strings.ReplaceAll(s, "&quot;", `"`)
	s = strings.ReplaceAll(s, "&#39;", "'")
	s = strings.ReplaceAll(s, "&apos;", "'")
	s = strings.ReplaceAll(s, "&#x27;", "'")
	s = strings.ReplaceAll(s, "&nbsp;", " ")

	// Trim whitespace
	s = strings.TrimSpace(s)

	return s
}
