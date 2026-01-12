package models

import "testing"

func TestNewFormErrors(t *testing.T) {
	errors := NewFormErrors()

	if errors == nil {
		t.Fatal("NewFormErrors() returned nil")
	}
	if errors.Fields == nil {
		t.Error("Fields map should be initialized")
	}
	if errors.General != "" {
		t.Error("General should be empty string")
	}
}

func TestFormErrors_AddField(t *testing.T) {
	tests := []struct {
		name    string
		field   string
		message string
	}{
		{"simple field", "email", "Email is required"},
		{"field with spaces", "first_name", "First name is required"},
		{"empty message", "field", ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			errors := NewFormErrors()
			errors.AddField(tt.field, tt.message)

			got := errors.Fields[tt.field]
			if got != tt.message {
				t.Errorf("AddField(%q, %q): got %q, want %q", tt.field, tt.message, got, tt.message)
			}
		})
	}
}

func TestFormErrors_AddField_NilFields(t *testing.T) {
	// Test that AddField initializes Fields map if nil
	errors := &FormErrors{}
	errors.AddField("test", "message")

	if errors.Fields == nil {
		t.Error("Fields should be initialized after AddField")
	}
	if errors.Fields["test"] != "message" {
		t.Error("Field should be added")
	}
}

func TestFormErrors_GetField(t *testing.T) {
	errors := NewFormErrors()
	errors.AddField("email", "Email is required")

	tests := []struct {
		name  string
		field string
		want  string
	}{
		{"existing field", "email", "Email is required"},
		{"non-existing field", "password", ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := errors.GetField(tt.field)
			if got != tt.want {
				t.Errorf("GetField(%q) = %q, want %q", tt.field, got, tt.want)
			}
		})
	}
}

func TestFormErrors_GetField_NilFields(t *testing.T) {
	errors := &FormErrors{}
	got := errors.GetField("any")
	if got != "" {
		t.Errorf("GetField on nil Fields should return empty string, got %q", got)
	}
}

func TestFormErrors_HasField(t *testing.T) {
	errors := NewFormErrors()
	errors.AddField("email", "Email is required")

	tests := []struct {
		name  string
		field string
		want  bool
	}{
		{"existing field", "email", true},
		{"non-existing field", "password", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := errors.HasField(tt.field)
			if got != tt.want {
				t.Errorf("HasField(%q) = %v, want %v", tt.field, got, tt.want)
			}
		})
	}
}

func TestFormErrors_HasField_NilFields(t *testing.T) {
	errors := &FormErrors{}
	if errors.HasField("any") {
		t.Error("HasField on nil Fields should return false")
	}
}

func TestFormErrors_HasErrors(t *testing.T) {
	tests := []struct {
		name  string
		setup func() *FormErrors
		want  bool
	}{
		{
			name: "no errors",
			setup: func() *FormErrors {
				return NewFormErrors()
			},
			want: false,
		},
		{
			name: "general error only",
			setup: func() *FormErrors {
				e := NewFormErrors()
				e.General = "Something went wrong"
				return e
			},
			want: true,
		},
		{
			name: "field error only",
			setup: func() *FormErrors {
				e := NewFormErrors()
				e.AddField("email", "Email is required")
				return e
			},
			want: true,
		},
		{
			name: "both general and field errors",
			setup: func() *FormErrors {
				e := NewFormErrors()
				e.General = "Form has errors"
				e.AddField("email", "Email is required")
				return e
			},
			want: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			errors := tt.setup()
			got := errors.HasErrors()
			if got != tt.want {
				t.Errorf("HasErrors() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestIsValidURL(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  bool
	}{
		// Valid URLs
		{"http URL", "http://example.com", true},
		{"https URL", "https://example.com", true},
		{"URL with path", "https://example.com/path/to/page", true},
		{"URL with query", "https://example.com?foo=bar", true},
		{"URL with port", "https://example.com:8080/path", true},
		{"URL with subdomain", "https://sub.example.com", true},

		// Invalid URLs
		{"empty string", "", false},
		{"no scheme", "example.com", false},
		{"ftp scheme", "ftp://example.com", false},
		{"mailto scheme", "mailto:test@example.com", false},
		{"file scheme", "file:///path/to/file", false},
		{"javascript", "javascript:alert(1)", false},
		{"just text", "not a url", false},
		{"relative path", "/path/to/page", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := IsValidURL(tt.input)
			if got != tt.want {
				t.Errorf("IsValidURL(%q) = %v, want %v", tt.input, got, tt.want)
			}
		})
	}
}

func TestIsValidSlug(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  bool
	}{
		// Valid slugs
		{"lowercase letters", "hello", true},
		{"with numbers", "hello123", true},
		{"with hyphens", "hello-world", true},
		{"numbers only", "123", true},
		{"complex slug", "my-post-2024", true},

		// Invalid slugs
		{"empty string", "", false},
		{"uppercase letters", "Hello", false},
		{"with spaces", "hello world", false},
		{"with underscores", "hello_world", false},
		{"with special chars", "hello@world", false},
		{"starts with hyphen", "-hello", true}, // Note: regex allows this
		{"ends with hyphen", "hello-", true},   // Note: regex allows this
		{"unicode", "helloworld", true},
		{"unicode chars", "helloworldé", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := IsValidSlug(tt.input)
			if got != tt.want {
				t.Errorf("IsValidSlug(%q) = %v, want %v", tt.input, got, tt.want)
			}
		})
	}
}

func TestIsValidHexColor(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  bool
	}{
		// Valid colors
		{"empty string (optional)", "", true},
		{"lowercase hex", "#3b82f6", true},
		{"uppercase hex", "#3B82F6", true},
		{"mixed case hex", "#3b82F6", true},
		{"black", "#000000", true},
		{"white", "#ffffff", true},
		{"red", "#ff0000", true},

		// Invalid colors
		{"no hash", "3b82f6", false},
		{"short hex", "#3b8", false},
		{"too long", "#3b82f6ff", false},
		{"invalid chars", "#gggggg", false},
		{"double hash", "##3b82f6", false},
		{"spaces", "# 3b82f6", false},
		{"rgb format", "rgb(255,0,0)", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := IsValidHexColor(tt.input)
			if got != tt.want {
				t.Errorf("IsValidHexColor(%q) = %v, want %v", tt.input, got, tt.want)
			}
		})
	}
}

func TestValidateRequired(t *testing.T) {
	tests := []struct {
		name      string
		value     string
		fieldName string
		wantValid bool
	}{
		{"non-empty value", "hello", "title", true},
		{"empty value", "", "title", false},
		{"whitespace only", "   ", "title", false},
		{"value with spaces", "  hello  ", "title", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			errors := NewFormErrors()
			got := ValidateRequired(tt.value, tt.fieldName, errors)

			if got != tt.wantValid {
				t.Errorf("ValidateRequired(%q, %q) = %v, want %v", tt.value, tt.fieldName, got, tt.wantValid)
			}

			if !tt.wantValid && !errors.HasField(tt.fieldName) {
				t.Error("Expected error to be added for invalid value")
			}
		})
	}
}

func TestValidateMaxLength(t *testing.T) {
	tests := []struct {
		name      string
		value     string
		fieldName string
		maxLen    int
		wantValid bool
	}{
		{"under max length", "hello", "title", 10, true},
		{"at max length", "hello", "title", 5, true},
		{"over max length", "hello world", "title", 5, false},
		{"empty value", "", "title", 5, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			errors := NewFormErrors()
			got := ValidateMaxLength(tt.value, tt.fieldName, tt.maxLen, errors)

			if got != tt.wantValid {
				t.Errorf("ValidateMaxLength(%q, %q, %d) = %v, want %v", tt.value, tt.fieldName, tt.maxLen, got, tt.wantValid)
			}

			if !tt.wantValid && !errors.HasField(tt.fieldName) {
				t.Error("Expected error to be added for invalid value")
			}
		})
	}
}
