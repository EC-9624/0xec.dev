// Package renderer provides content rendering utilities for converting
// different content formats (Editor.js JSON, Markdown) to HTML.
package renderer

import (
	"encoding/json"
	"fmt"
	"html"
	"regexp"
	"strings"
)

// EditorJSData represents the top-level Editor.js JSON structure
type EditorJSData struct {
	Time    int64           `json:"time"`
	Blocks  []EditorJSBlock `json:"blocks"`
	Version string          `json:"version"`
}

// EditorJSBlock represents a single block in Editor.js
type EditorJSBlock struct {
	ID   string          `json:"id"`
	Type string          `json:"type"`
	Data json.RawMessage `json:"data"`
}

// Block data types for each supported block type

// ParagraphData represents paragraph block data
type ParagraphData struct {
	Text string `json:"text"`
}

// HeaderData represents header block data
type HeaderData struct {
	Text  string `json:"text"`
	Level int    `json:"level"`
}

// ListData represents list block data
type ListData struct {
	Style string   `json:"style"` // "ordered" or "unordered"
	Items []string `json:"items"`
}

// QuoteData represents quote block data
type QuoteData struct {
	Text    string `json:"text"`
	Caption string `json:"caption"`
	// Alignment can be "left" or "center" but we ignore it for now
}

// CodeData represents code block data
type CodeData struct {
	Code string `json:"code"`
}

// DelimiterData represents delimiter block data (usually empty)
type DelimiterData struct{}

// RenderEditorJS converts Editor.js JSON content to HTML
func RenderEditorJS(content string) (string, error) {
	// Handle empty content
	content = strings.TrimSpace(content)
	if content == "" {
		return "", nil
	}

	// Parse the JSON
	var data EditorJSData
	if err := json.Unmarshal([]byte(content), &data); err != nil {
		return "", fmt.Errorf("failed to parse Editor.js JSON: %w", err)
	}

	// Build HTML from blocks
	var sb strings.Builder
	for _, block := range data.Blocks {
		html, err := renderBlock(block)
		if err != nil {
			// Log error but continue with other blocks
			continue
		}
		sb.WriteString(html)
		sb.WriteString("\n")
	}

	return sb.String(), nil
}

// renderBlock renders a single Editor.js block to HTML
func renderBlock(block EditorJSBlock) (string, error) {
	switch block.Type {
	case "paragraph":
		return renderParagraph(block.Data)
	case "header":
		return renderHeader(block.Data)
	case "list":
		return renderList(block.Data)
	case "quote":
		return renderQuote(block.Data)
	case "code":
		return renderCode(block.Data)
	case "delimiter":
		return renderDelimiter()
	default:
		// Unknown block type - render as paragraph with escaped content
		return renderUnknownBlock(block)
	}
}

// renderParagraph renders a paragraph block
func renderParagraph(data json.RawMessage) (string, error) {
	var p ParagraphData
	if err := json.Unmarshal(data, &p); err != nil {
		return "", err
	}

	// Editor.js text can contain inline HTML tags like <b>, <i>, <a>, <code>
	// We sanitize to allow only safe inline tags
	text := sanitizeInlineHTML(p.Text)

	if text == "" {
		return "", nil // Skip empty paragraphs
	}

	return fmt.Sprintf("<p>%s</p>", text), nil
}

// renderHeader renders a header block
func renderHeader(data json.RawMessage) (string, error) {
	var h HeaderData
	if err := json.Unmarshal(data, &h); err != nil {
		return "", err
	}

	// Clamp header level to 2-6 (h1 reserved for page title)
	level := h.Level
	if level < 2 {
		level = 2
	}
	if level > 6 {
		level = 6
	}

	text := sanitizeInlineHTML(h.Text)
	return fmt.Sprintf("<h%d>%s</h%d>", level, text, level), nil
}

// renderList renders a list block
func renderList(data json.RawMessage) (string, error) {
	var l ListData
	if err := json.Unmarshal(data, &l); err != nil {
		return "", err
	}

	if len(l.Items) == 0 {
		return "", nil
	}

	tag := "ul"
	if l.Style == "ordered" {
		tag = "ol"
	}

	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("<%s>\n", tag))
	for _, item := range l.Items {
		text := sanitizeInlineHTML(item)
		sb.WriteString(fmt.Sprintf("  <li>%s</li>\n", text))
	}
	sb.WriteString(fmt.Sprintf("</%s>", tag))

	return sb.String(), nil
}

// renderQuote renders a quote block
func renderQuote(data json.RawMessage) (string, error) {
	var q QuoteData
	if err := json.Unmarshal(data, &q); err != nil {
		return "", err
	}

	text := sanitizeInlineHTML(q.Text)
	if text == "" {
		return "", nil
	}

	var sb strings.Builder
	sb.WriteString("<blockquote>\n")
	sb.WriteString(fmt.Sprintf("  <p>%s</p>\n", text))
	if q.Caption != "" {
		caption := sanitizeInlineHTML(q.Caption)
		sb.WriteString(fmt.Sprintf("  <cite>%s</cite>\n", caption))
	}
	sb.WriteString("</blockquote>")

	return sb.String(), nil
}

// renderCode renders a code block
func renderCode(data json.RawMessage) (string, error) {
	var c CodeData
	if err := json.Unmarshal(data, &c); err != nil {
		return "", err
	}

	// Code content should be fully escaped
	code := html.EscapeString(c.Code)
	return fmt.Sprintf("<pre><code>%s</code></pre>", code), nil
}

// renderDelimiter renders a delimiter (horizontal rule)
func renderDelimiter() (string, error) {
	return "<hr>", nil
}

// renderUnknownBlock renders an unknown block type as a paragraph
func renderUnknownBlock(block EditorJSBlock) (string, error) {
	// Try to extract text from the data
	var generic map[string]interface{}
	if err := json.Unmarshal(block.Data, &generic); err != nil {
		return "", err
	}

	// Look for common text fields
	for _, key := range []string{"text", "content", "html"} {
		if text, ok := generic[key].(string); ok && text != "" {
			return fmt.Sprintf("<p>%s</p>", html.EscapeString(text)), nil
		}
	}

	return "", nil
}

// sanitizeInlineHTML allows only safe inline HTML tags from Editor.js
// Editor.js inline tools produce: <b>, <i>, <a>, <code>, <mark>
// We also preserve line breaks as <br>
func sanitizeInlineHTML(input string) string {
	if input == "" {
		return ""
	}

	// Define allowed tags and their attributes
	// We'll use a whitelist approach with regex

	// First, escape everything
	escaped := html.EscapeString(input)

	// Then, unescape allowed tags
	// Editor.js produces these inline tags:
	// <b>text</b>, <i>text</i>, <code>text</code>
	// <a href="url">text</a>
	// <mark class="...">text</mark>
	// <br>

	// Restore <b> and </b>
	escaped = strings.ReplaceAll(escaped, "&lt;b&gt;", "<b>")
	escaped = strings.ReplaceAll(escaped, "&lt;/b&gt;", "</b>")

	// Restore <i> and </i>
	escaped = strings.ReplaceAll(escaped, "&lt;i&gt;", "<i>")
	escaped = strings.ReplaceAll(escaped, "&lt;/i&gt;", "</i>")

	// Restore <code> and </code>
	escaped = strings.ReplaceAll(escaped, "&lt;code&gt;", "<code>")
	escaped = strings.ReplaceAll(escaped, "&lt;/code&gt;", "</code>")

	// Restore <mark> and </mark> (with optional class attribute)
	markOpenRegex := regexp.MustCompile(`&lt;mark(?:\s+class=&#34;([^&]*)&#34;)?&gt;`)
	escaped = markOpenRegex.ReplaceAllStringFunc(escaped, func(match string) string {
		// Extract class if present
		classMatch := markOpenRegex.FindStringSubmatch(match)
		if len(classMatch) > 1 && classMatch[1] != "" {
			// Sanitize class name (alphanumeric, hyphens, underscores only)
			className := sanitizeClassName(classMatch[1])
			if className != "" {
				return fmt.Sprintf(`<mark class="%s">`, className)
			}
		}
		return "<mark>"
	})
	escaped = strings.ReplaceAll(escaped, "&lt;/mark&gt;", "</mark>")

	// Restore <a href="..."> and </a>
	// Pattern: &lt;a href=&#34;URL&#34;&gt;
	aOpenRegex := regexp.MustCompile(`&lt;a\s+href=&#34;([^&]*)&#34;&gt;`)
	escaped = aOpenRegex.ReplaceAllStringFunc(escaped, func(match string) string {
		urlMatch := aOpenRegex.FindStringSubmatch(match)
		if len(urlMatch) > 1 {
			url := sanitizeURL(urlMatch[1])
			if url != "" {
				return fmt.Sprintf(`<a href="%s" rel="noopener noreferrer">`, url)
			}
		}
		return "" // Remove invalid links
	})
	escaped = strings.ReplaceAll(escaped, "&lt;/a&gt;", "</a>")

	// Restore <br> and <br/>
	escaped = strings.ReplaceAll(escaped, "&lt;br&gt;", "<br>")
	escaped = strings.ReplaceAll(escaped, "&lt;br/&gt;", "<br>")
	escaped = strings.ReplaceAll(escaped, "&lt;br /&gt;", "<br>")

	return escaped
}

// sanitizeURL validates and sanitizes a URL for use in href attributes
func sanitizeURL(url string) string {
	url = strings.TrimSpace(url)
	if url == "" {
		return ""
	}

	// Allow http, https, mailto, and relative URLs
	lowerURL := strings.ToLower(url)
	if strings.HasPrefix(lowerURL, "http://") ||
		strings.HasPrefix(lowerURL, "https://") ||
		strings.HasPrefix(lowerURL, "mailto:") ||
		strings.HasPrefix(url, "/") ||
		strings.HasPrefix(url, "#") {
		// Escape special HTML characters in the URL
		return html.EscapeString(url)
	}

	// Reject javascript: and other potentially dangerous protocols
	return ""
}

// sanitizeClassName validates a CSS class name
func sanitizeClassName(class string) string {
	// Only allow alphanumeric, hyphens, underscores, and spaces
	validClass := regexp.MustCompile(`^[a-zA-Z0-9\s_-]+$`)
	if validClass.MatchString(class) {
		return html.EscapeString(class)
	}
	return ""
}

// IsEditorJSContent checks if content appears to be Editor.js JSON
// by looking for the characteristic structure
func IsEditorJSContent(content string) bool {
	content = strings.TrimSpace(content)
	if content == "" {
		return false
	}

	// Quick check: must start with { and contain "blocks"
	if !strings.HasPrefix(content, "{") {
		return false
	}

	// Try to parse just enough to verify structure
	var data struct {
		Blocks []json.RawMessage `json:"blocks"`
	}

	if err := json.Unmarshal([]byte(content), &data); err != nil {
		return false
	}

	// Must have blocks array (can be empty for new posts)
	return data.Blocks != nil
}
