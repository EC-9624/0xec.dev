package service

import "testing"

func TestExtractMeta(t *testing.T) {
	tests := []struct {
		name string
		html string
		meta string
		want string
	}{
		// Open Graph tags
		{
			name: "og:title with property first",
			html: `<meta property="og:title" content="Test Title">`,
			meta: "og:title",
			want: "Test Title",
		},
		{
			name: "og:title with content first",
			html: `<meta content="Test Title" property="og:title">`,
			meta: "og:title",
			want: "Test Title",
		},
		{
			name: "og:description",
			html: `<meta property="og:description" content="This is a description">`,
			meta: "og:description",
			want: "This is a description",
		},
		{
			name: "og:image",
			html: `<meta property="og:image" content="https://example.com/image.jpg">`,
			meta: "og:image",
			want: "https://example.com/image.jpg",
		},

		// Twitter cards
		{
			name: "twitter:title",
			html: `<meta name="twitter:title" content="Twitter Title">`,
			meta: "twitter:title",
			want: "Twitter Title",
		},
		{
			name: "twitter:description",
			html: `<meta name="twitter:description" content="Twitter desc">`,
			meta: "twitter:description",
			want: "Twitter desc",
		},

		// Standard meta tags
		{
			name: "description with name",
			html: `<meta name="description" content="Page description">`,
			meta: "description",
			want: "Page description",
		},
		{
			name: "description with content first",
			html: `<meta content="Page description" name="description">`,
			meta: "description",
			want: "Page description",
		},

		// Single quotes
		{
			name: "single quotes property",
			html: `<meta property='og:title' content='Single Quote Title'>`,
			meta: "og:title",
			want: "Single Quote Title",
		},
		{
			name: "single quotes name",
			html: `<meta name='description' content='Single Quote Desc'>`,
			meta: "description",
			want: "Single Quote Desc",
		},

		// Mixed quotes
		{
			name: "mixed quotes - double property single content",
			html: `<meta property="og:title" content='Mixed Title'>`,
			meta: "og:title",
			want: "Mixed Title",
		},

		// Case insensitivity
		{
			name: "case insensitive META tag",
			html: `<META property="og:title" content="Upper Case">`,
			meta: "og:title",
			want: "Upper Case",
		},

		// With other attributes
		{
			name: "with charset attribute",
			html: `<meta charset="utf-8"><meta property="og:title" content="After Charset">`,
			meta: "og:title",
			want: "After Charset",
		},

		// Missing or not found
		{
			name: "missing meta tag",
			html: `<html><head><title>Page</title></head></html>`,
			meta: "og:title",
			want: "",
		},
		{
			name: "empty content",
			html: `<meta property="og:title" content="">`,
			meta: "og:title",
			want: "",
		},
		{
			name: "empty html",
			html: "",
			meta: "og:title",
			want: "",
		},

		// Complex HTML
		{
			name: "nested in head",
			html: `<!DOCTYPE html><html><head><meta property="og:title" content="Nested"></head><body></body></html>`,
			meta: "og:title",
			want: "Nested",
		},
		{
			name: "with extra whitespace",
			html: `<meta   property="og:title"   content="Spaced"  >`,
			meta: "og:title",
			want: "Spaced",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := extractMeta(tt.html, tt.meta)
			if got != tt.want {
				t.Errorf("extractMeta(%q) = %q, want %q", tt.meta, got, tt.want)
			}
		})
	}
}

func TestExtractHTMLTitle(t *testing.T) {
	tests := []struct {
		name string
		html string
		want string
	}{
		{
			name: "simple title",
			html: `<title>Page Title</title>`,
			want: "Page Title",
		},
		{
			name: "title in head",
			html: `<html><head><title>Head Title</title></head></html>`,
			want: "Head Title",
		},
		{
			name: "title with attributes",
			html: `<title lang="en">Attributed Title</title>`,
			want: "Attributed Title",
		},
		{
			name: "uppercase TITLE",
			html: `<TITLE>Upper Title</TITLE>`,
			want: "Upper Title",
		},
		{
			name: "missing title",
			html: `<html><head></head></html>`,
			want: "",
		},
		{
			name: "empty title",
			html: `<title></title>`,
			want: "",
		},
		{
			name: "title with whitespace",
			html: `<title>  Spaced Title  </title>`,
			want: "  Spaced Title  ",
		},
		{
			name: "empty html",
			html: "",
			want: "",
		},
		{
			name: "full HTML document",
			html: `<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<title>Full Doc Title</title>
</head>
<body></body>
</html>`,
			want: "Full Doc Title",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := extractHTMLTitle(tt.html)
			if got != tt.want {
				t.Errorf("extractHTMLTitle() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestCleanText(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		// Individual entities
		{"ampersand", "&amp;", "&"},
		{"less than", "&lt;", "<"},
		{"greater than", "&gt;", ">"},
		{"double quote", "&quot;", `"`},
		{"single quote &#39;", "&#39;", "'"},
		{"single quote &apos;", "&apos;", "'"},
		{"single quote &#x27;", "&#x27;", "'"},
		{"non-breaking space in text", "hello&nbsp;world", "hello world"},

		// Combined entities
		{
			name:  "multiple entities",
			input: "Tom &amp; Jerry &lt;3",
			want:  "Tom & Jerry <3",
		},
		{
			name:  "quoted text",
			input: "&quot;Hello&quot; &amp; &apos;World&apos;",
			want:  `"Hello" & 'World'`,
		},

		// Whitespace trimming
		{"leading whitespace", "  text", "text"},
		{"trailing whitespace", "text  ", "text"},
		{"both whitespace", "  text  ", "text"},
		{"internal whitespace preserved", "hello world", "hello world"},

		// Already clean
		{"no entities", "Hello World", "Hello World"},
		{"empty string", "", ""},

		// Edge cases
		{"partial entity", "&am", "&am"},
		{"double encoded", "&amp;amp;", "&amp;"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := cleanText(tt.input)
			if got != tt.want {
				t.Errorf("cleanText(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestExtractFavicon(t *testing.T) {
	baseURL := "https://example.com"

	tests := []struct {
		name    string
		html    string
		pageURL string
		want    string
	}{
		// Apple touch icon (preferred)
		{
			name:    "apple touch icon with href first",
			html:    `<link href="/apple-icon.png" rel="apple-touch-icon">`,
			pageURL: baseURL,
			want:    "https://example.com/apple-icon.png",
		},
		{
			name:    "apple touch icon with rel first",
			html:    `<link rel="apple-touch-icon" href="/apple-icon.png">`,
			pageURL: baseURL,
			want:    "https://example.com/apple-icon.png",
		},

		// Standard icon
		{
			name:    "rel icon with href first",
			html:    `<link href="/favicon.png" rel="icon">`,
			pageURL: baseURL,
			want:    "https://example.com/favicon.png",
		},
		{
			name:    "rel icon with rel first",
			html:    `<link rel="icon" href="/favicon.png">`,
			pageURL: baseURL,
			want:    "https://example.com/favicon.png",
		},

		// Shortcut icon (legacy)
		{
			name:    "shortcut icon",
			html:    `<link rel="shortcut icon" href="/shortcut.ico">`,
			pageURL: baseURL,
			want:    "https://example.com/shortcut.ico",
		},

		// URL handling
		{
			name:    "absolute URL",
			html:    `<link rel="icon" href="https://cdn.example.com/icon.png">`,
			pageURL: baseURL,
			want:    "https://cdn.example.com/icon.png",
		},
		{
			name:    "protocol relative URL",
			html:    `<link rel="icon" href="//cdn.example.com/icon.png">`,
			pageURL: baseURL,
			want:    "https://cdn.example.com/icon.png",
		},
		{
			name:    "relative URL without leading slash",
			html:    `<link rel="icon" href="images/icon.png">`,
			pageURL: baseURL,
			want:    "https://example.com/images/icon.png",
		},
		{
			name:    "relative URL with leading slash",
			html:    `<link rel="icon" href="/images/icon.png">`,
			pageURL: baseURL,
			want:    "https://example.com/images/icon.png",
		},

		// Fallback
		{
			name:    "no favicon in HTML",
			html:    `<html><head><title>No Favicon</title></head></html>`,
			pageURL: baseURL,
			want:    "https://example.com/favicon.ico",
		},
		{
			name:    "empty HTML",
			html:    "",
			pageURL: baseURL,
			want:    "https://example.com/favicon.ico",
		},

		// Priority: apple-touch-icon > icon > shortcut icon
		{
			name:    "prefers apple touch icon over regular icon",
			html:    `<link rel="icon" href="/regular.ico"><link rel="apple-touch-icon" href="/apple.png">`,
			pageURL: baseURL,
			want:    "https://example.com/apple.png",
		},

		// Single quotes
		{
			name:    "single quotes",
			html:    `<link rel='icon' href='/single.ico'>`,
			pageURL: baseURL,
			want:    "https://example.com/single.ico",
		},

		// With other attributes
		{
			name:    "with type and sizes",
			html:    `<link rel="icon" type="image/png" sizes="32x32" href="/icon-32.png">`,
			pageURL: baseURL,
			want:    "https://example.com/icon-32.png",
		},

		// Different page URL formats
		{
			name:    "page URL with path",
			html:    `<link rel="icon" href="/favicon.ico">`,
			pageURL: "https://example.com/some/page",
			want:    "https://example.com/favicon.ico",
		},
		{
			name:    "page URL with port",
			html:    `<link rel="icon" href="/favicon.ico">`,
			pageURL: "https://example.com:8080/page",
			want:    "https://example.com:8080/favicon.ico",
		},
		{
			name:    "http scheme",
			html:    `<link rel="icon" href="//cdn.example.com/icon.png">`,
			pageURL: "http://example.com",
			want:    "http://cdn.example.com/icon.png",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := extractFavicon(tt.html, tt.pageURL)
			if got != tt.want {
				t.Errorf("extractFavicon() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestExtractFavicon_InvalidURL(t *testing.T) {
	// Test with invalid page URL
	got := extractFavicon(`<link rel="icon" href="/favicon.ico">`, "://invalid")
	if got != "" {
		t.Errorf("extractFavicon with invalid URL should return empty, got %q", got)
	}
}
