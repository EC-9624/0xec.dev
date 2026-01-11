package service

import (
	"context"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"
)

// PageMetadata contains extracted metadata from a URL
type PageMetadata struct {
	Title       string
	Description string
	Image       string
	Favicon     string
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

	// Set a real browser User-Agent to avoid being blocked
	req.Header.Set("User-Agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8")
	req.Header.Set("Accept-Language", "en-US,en;q=0.5")

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

	// Extract favicon
	metadata.Favicon = extractFavicon(html, url)

	// Clean up
	metadata.Title = cleanText(metadata.Title)
	metadata.Description = cleanText(metadata.Description)

	return metadata, nil
}

// extractMeta extracts content from meta tags
// Handles both property="og:title" and name="description" formats
func extractMeta(html, name string) string {
	quotedName := regexp.QuoteMeta(name)

	// Patterns for different meta tag formats
	// Using [^"]*" and [^']*' to properly match quoted values
	patterns := []string{
		// property="name" content="value" (double quotes)
		`(?i)<meta\s+[^>]*property="` + quotedName + `"[^>]*content="([^"]*)"`,
		`(?i)<meta\s+[^>]*content="([^"]*)"[^>]*property="` + quotedName + `"`,
		// property='name' content='value' (single quotes)
		`(?i)<meta\s+[^>]*property='` + quotedName + `'[^>]*content='([^']*)'`,
		`(?i)<meta\s+[^>]*content='([^']*)'[^>]*property='` + quotedName + `'`,
		// name="name" content="value" (double quotes)
		`(?i)<meta\s+[^>]*name="` + quotedName + `"[^>]*content="([^"]*)"`,
		`(?i)<meta\s+[^>]*content="([^"]*)"[^>]*name="` + quotedName + `"`,
		// name='name' content='value' (single quotes)
		`(?i)<meta\s+[^>]*name='` + quotedName + `'[^>]*content='([^']*)'`,
		`(?i)<meta\s+[^>]*content='([^']*)'[^>]*name='` + quotedName + `'`,
		// Mixed quotes - property="name" content='value' etc
		`(?i)<meta\s+[^>]*property="` + quotedName + `"[^>]*content='([^']*)'`,
		`(?i)<meta\s+[^>]*property='` + quotedName + `'[^>]*content="([^"]*)"`,
		`(?i)<meta\s+[^>]*name="` + quotedName + `"[^>]*content='([^']*)'`,
		`(?i)<meta\s+[^>]*name='` + quotedName + `'[^>]*content="([^"]*)"`,
	}

	for _, pattern := range patterns {
		re := regexp.MustCompile(pattern)
		matches := re.FindStringSubmatch(html)
		if len(matches) > 1 && matches[1] != "" {
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

// extractFavicon extracts the favicon URL from HTML
// Checks: <link rel="icon">, <link rel="shortcut icon">, apple-touch-icon, then falls back to /favicon.ico
func extractFavicon(html, pageURL string) string {
	// Parse the page URL to get the base
	parsedURL, err := url.Parse(pageURL)
	if err != nil {
		return ""
	}
	baseURL := parsedURL.Scheme + "://" + parsedURL.Host

	// Patterns for different favicon declarations (order by preference)
	patterns := []string{
		// Apple touch icon (usually higher quality)
		`(?i)<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["']`,
		`(?i)<link[^>]+href=["']([^"']+)["'][^>]+rel=["']apple-touch-icon["']`,
		// Standard icon
		`(?i)<link[^>]+rel=["']icon["'][^>]+href=["']([^"']+)["']`,
		`(?i)<link[^>]+href=["']([^"']+)["'][^>]+rel=["']icon["']`,
		// Shortcut icon (legacy)
		`(?i)<link[^>]+rel=["']shortcut icon["'][^>]+href=["']([^"']+)["']`,
		`(?i)<link[^>]+href=["']([^"']+)["'][^>]+rel=["']shortcut icon["']`,
	}

	for _, pattern := range patterns {
		re := regexp.MustCompile(pattern)
		matches := re.FindStringSubmatch(html)
		if len(matches) > 1 {
			favicon := matches[1]
			// Make absolute URL if relative
			if strings.HasPrefix(favicon, "//") {
				return parsedURL.Scheme + ":" + favicon
			} else if strings.HasPrefix(favicon, "/") {
				return baseURL + favicon
			} else if !strings.HasPrefix(favicon, "http") {
				return baseURL + "/" + favicon
			}
			return favicon
		}
	}

	// Fall back to default /favicon.ico
	return baseURL + "/favicon.ico"
}
