package renderer

import (
	"strings"
	"testing"
)

func TestIsEditorJSContent(t *testing.T) {
	tests := []struct {
		name    string
		content string
		want    bool
	}{
		{
			name:    "empty string",
			content: "",
			want:    false,
		},
		{
			name:    "plain text",
			content: "Hello world",
			want:    false,
		},
		{
			name:    "markdown",
			content: "# Hello\n\nThis is **markdown**",
			want:    false,
		},
		{
			name:    "valid editor.js with empty blocks",
			content: `{"time":1234567890,"blocks":[],"version":"2.29.1"}`,
			want:    true,
		},
		{
			name:    "valid editor.js with blocks",
			content: `{"time":1234567890,"blocks":[{"id":"abc","type":"paragraph","data":{"text":"Hello"}}],"version":"2.29.1"}`,
			want:    true,
		},
		{
			name:    "invalid JSON",
			content: `{"time":1234567890,"blocks":`,
			want:    false,
		},
		{
			name:    "JSON without blocks",
			content: `{"time":1234567890,"version":"2.29.1"}`,
			want:    false,
		},
		{
			name:    "JSON with null blocks",
			content: `{"time":1234567890,"blocks":null,"version":"2.29.1"}`,
			want:    false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := IsEditorJSContent(tt.content)
			if got != tt.want {
				t.Errorf("IsEditorJSContent() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestRenderEditorJS(t *testing.T) {
	tests := []struct {
		name        string
		content     string
		wantContain []string
		wantErr     bool
	}{
		{
			name:        "empty content",
			content:     "",
			wantContain: []string{},
			wantErr:     false,
		},
		{
			name:    "paragraph block",
			content: `{"blocks":[{"type":"paragraph","data":{"text":"Hello world"}}]}`,
			wantContain: []string{
				"<p>Hello world</p>",
			},
			wantErr: false,
		},
		{
			name:    "paragraph with inline formatting",
			content: `{"blocks":[{"type":"paragraph","data":{"text":"Hello <b>bold</b> and <i>italic</i>"}}]}`,
			wantContain: []string{
				"<p>Hello <b>bold</b> and <i>italic</i></p>",
			},
			wantErr: false,
		},
		{
			name:    "paragraph with link",
			content: `{"blocks":[{"type":"paragraph","data":{"text":"Visit <a href=\"https://example.com\">example</a>"}}]}`,
			wantContain: []string{
				`<a href="https://example.com" rel="noopener noreferrer">example</a>`,
			},
			wantErr: false,
		},
		{
			name:    "header block",
			content: `{"blocks":[{"type":"header","data":{"text":"My Title","level":2}}]}`,
			wantContain: []string{
				"<h2>My Title</h2>",
			},
			wantErr: false,
		},
		{
			name:    "header level clamped to 2",
			content: `{"blocks":[{"type":"header","data":{"text":"Title","level":1}}]}`,
			wantContain: []string{
				"<h2>Title</h2>",
			},
			wantErr: false,
		},
		{
			name:    "unordered list",
			content: `{"blocks":[{"type":"list","data":{"style":"unordered","items":["Item 1","Item 2"]}}]}`,
			wantContain: []string{
				"<ul>",
				"<li>Item 1</li>",
				"<li>Item 2</li>",
				"</ul>",
			},
			wantErr: false,
		},
		{
			name:    "ordered list",
			content: `{"blocks":[{"type":"list","data":{"style":"ordered","items":["First","Second"]}}]}`,
			wantContain: []string{
				"<ol>",
				"<li>First</li>",
				"<li>Second</li>",
				"</ol>",
			},
			wantErr: false,
		},
		{
			name:    "quote block",
			content: `{"blocks":[{"type":"quote","data":{"text":"To be or not to be","caption":"Shakespeare"}}]}`,
			wantContain: []string{
				"<blockquote>",
				"<p>To be or not to be</p>",
				"<cite>Shakespeare</cite>",
				"</blockquote>",
			},
			wantErr: false,
		},
		{
			name:    "quote without caption",
			content: `{"blocks":[{"type":"quote","data":{"text":"Just a quote"}}]}`,
			wantContain: []string{
				"<blockquote>",
				"<p>Just a quote</p>",
			},
			wantErr: false,
		},
		{
			name:    "code block",
			content: `{"blocks":[{"type":"code","data":{"code":"func main() {\n\tfmt.Println(\"Hello\")\n}"}}]}`,
			wantContain: []string{
				"<pre><code>func main()",
				"fmt.Println",
				"</code></pre>",
			},
			wantErr: false,
		},
		{
			name:    "code block escapes HTML",
			content: `{"blocks":[{"type":"code","data":{"code":"<script>alert('xss')</script>"}}]}`,
			wantContain: []string{
				"&lt;script&gt;",
				"&lt;/script&gt;",
			},
			wantErr: false,
		},
		{
			name:    "delimiter",
			content: `{"blocks":[{"type":"delimiter","data":{}}]}`,
			wantContain: []string{
				"<hr>",
			},
			wantErr: false,
		},
		{
			name: "multiple blocks",
			content: `{"blocks":[
				{"type":"header","data":{"text":"Title","level":2}},
				{"type":"paragraph","data":{"text":"Some text"}},
				{"type":"list","data":{"style":"unordered","items":["One","Two"]}}
			]}`,
			wantContain: []string{
				"<h2>Title</h2>",
				"<p>Some text</p>",
				"<ul>",
				"<li>One</li>",
			},
			wantErr: false,
		},
		{
			name:        "invalid JSON",
			content:     `{"blocks":[`,
			wantContain: []string{},
			wantErr:     true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := RenderEditorJS(tt.content)
			if (err != nil) != tt.wantErr {
				t.Errorf("RenderEditorJS() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			for _, want := range tt.wantContain {
				if !strings.Contains(got, want) {
					t.Errorf("RenderEditorJS() output does not contain %q\ngot: %s", want, got)
				}
			}
		})
	}
}

func TestSanitizeInlineHTML(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  string
	}{
		{
			name:  "plain text",
			input: "Hello world",
			want:  "Hello world",
		},
		{
			name:  "bold tag",
			input: "Hello <b>bold</b> world",
			want:  "Hello <b>bold</b> world",
		},
		{
			name:  "italic tag",
			input: "Hello <i>italic</i> world",
			want:  "Hello <i>italic</i> world",
		},
		{
			name:  "code tag",
			input: "Use <code>fmt.Println</code>",
			want:  "Use <code>fmt.Println</code>",
		},
		{
			name:  "link tag",
			input: `Visit <a href="https://example.com">example</a>`,
			want:  `Visit <a href="https://example.com" rel="noopener noreferrer">example</a>`,
		},
		{
			name:  "relative link",
			input: `See <a href="/about">about page</a>`,
			want:  `See <a href="/about" rel="noopener noreferrer">about page</a>`,
		},
		{
			name:  "mailto link",
			input: `Email <a href="mailto:test@example.com">me</a>`,
			want:  `Email <a href="mailto:test@example.com" rel="noopener noreferrer">me</a>`,
		},
		{
			name:  "script tag blocked",
			input: "<script>alert('xss')</script>",
			want:  "&lt;script&gt;alert(&#39;xss&#39;)&lt;/script&gt;",
		},
		{
			name:  "javascript link blocked",
			input: `<a href="javascript:alert('xss')">click</a>`,
			want:  `&lt;a href=&#34;javascript:alert(&#39;xss&#39;)&#34;&gt;click</a>`, // Link escaped, closing tag restored
		},
		{
			name:  "br tag",
			input: "Line 1<br>Line 2",
			want:  "Line 1<br>Line 2",
		},
		{
			name:  "nested tags",
			input: "<b><i>bold italic</i></b>",
			want:  "<b><i>bold italic</i></b>",
		},
		{
			name:  "mark tag",
			input: `Highlight <mark>this</mark> text`,
			want:  `Highlight <mark>this</mark> text`,
		},
		{
			name:  "img tag blocked",
			input: `<img src="evil.jpg" onerror="alert('xss')">`,
			want:  `&lt;img src=&#34;evil.jpg&#34; onerror=&#34;alert(&#39;xss&#39;)&#34;&gt;`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := sanitizeInlineHTML(tt.input)
			if got != tt.want {
				t.Errorf("sanitizeInlineHTML() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestSanitizeURL(t *testing.T) {
	tests := []struct {
		name string
		url  string
		want string
	}{
		{
			name: "https URL",
			url:  "https://example.com",
			want: "https://example.com",
		},
		{
			name: "http URL",
			url:  "http://example.com",
			want: "http://example.com",
		},
		{
			name: "mailto URL",
			url:  "mailto:test@example.com",
			want: "mailto:test@example.com",
		},
		{
			name: "relative URL",
			url:  "/about",
			want: "/about",
		},
		{
			name: "anchor URL",
			url:  "#section",
			want: "#section",
		},
		{
			name: "javascript blocked",
			url:  "javascript:alert('xss')",
			want: "",
		},
		{
			name: "data blocked",
			url:  "data:text/html,<script>alert('xss')</script>",
			want: "",
		},
		{
			name: "empty URL",
			url:  "",
			want: "",
		},
		{
			name: "URL with special chars",
			url:  "https://example.com/path?foo=bar&baz=qux",
			want: "https://example.com/path?foo=bar&amp;baz=qux",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := sanitizeURL(tt.url)
			if got != tt.want {
				t.Errorf("sanitizeURL() = %q, want %q", got, tt.want)
			}
		})
	}
}
