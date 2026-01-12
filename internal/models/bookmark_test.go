package models

import (
	"strings"
	"testing"
)

func TestCreateBookmarkInput_Validate(t *testing.T) {
	tests := []struct {
		name       string
		input      CreateBookmarkInput
		wantErrors []string // field names that should have errors
	}{
		{
			name: "valid input",
			input: CreateBookmarkInput{
				URL:   "https://example.com",
				Title: "Example Site",
			},
			wantErrors: nil,
		},
		{
			name: "valid input with all fields",
			input: CreateBookmarkInput{
				URL:         "https://example.com/page",
				Title:       "Example Site",
				Description: "A great website",
				CoverImage:  "https://example.com/image.png",
				IsPublic:    true,
				IsFavorite:  true,
			},
			wantErrors: nil,
		},
		{
			name: "empty URL",
			input: CreateBookmarkInput{
				URL:   "",
				Title: "Example Site",
			},
			wantErrors: []string{"url"},
		},
		{
			name: "whitespace URL",
			input: CreateBookmarkInput{
				URL:   "   ",
				Title: "Example Site",
			},
			wantErrors: []string{"url"},
		},
		{
			name: "invalid URL - no scheme",
			input: CreateBookmarkInput{
				URL:   "example.com",
				Title: "Example Site",
			},
			wantErrors: []string{"url"},
		},
		{
			name: "invalid URL - ftp scheme",
			input: CreateBookmarkInput{
				URL:   "ftp://example.com",
				Title: "Example Site",
			},
			wantErrors: []string{"url"},
		},
		{
			name: "empty title",
			input: CreateBookmarkInput{
				URL:   "https://example.com",
				Title: "",
			},
			wantErrors: []string{"title"},
		},
		{
			name: "whitespace title",
			input: CreateBookmarkInput{
				URL:   "https://example.com",
				Title: "   ",
			},
			wantErrors: []string{"title"},
		},
		{
			name: "title too long",
			input: CreateBookmarkInput{
				URL:   "https://example.com",
				Title: strings.Repeat("a", 201),
			},
			wantErrors: []string{"title"},
		},
		{
			name: "title at max length",
			input: CreateBookmarkInput{
				URL:   "https://example.com",
				Title: strings.Repeat("a", 200),
			},
			wantErrors: nil,
		},
		{
			name: "description too long",
			input: CreateBookmarkInput{
				URL:         "https://example.com",
				Title:       "Example Site",
				Description: strings.Repeat("a", 501),
			},
			wantErrors: []string{"description"},
		},
		{
			name: "description at max length",
			input: CreateBookmarkInput{
				URL:         "https://example.com",
				Title:       "Example Site",
				Description: strings.Repeat("a", 500),
			},
			wantErrors: nil,
		},
		{
			name: "invalid cover image URL",
			input: CreateBookmarkInput{
				URL:        "https://example.com",
				Title:      "Example Site",
				CoverImage: "not-a-url",
			},
			wantErrors: []string{"cover_image"},
		},
		{
			name: "empty cover image is valid",
			input: CreateBookmarkInput{
				URL:        "https://example.com",
				Title:      "Example Site",
				CoverImage: "",
			},
			wantErrors: nil,
		},
		{
			name: "multiple errors",
			input: CreateBookmarkInput{
				URL:         "",
				Title:       "",
				Description: strings.Repeat("a", 501),
				CoverImage:  "invalid",
			},
			wantErrors: []string{"url", "title", "description", "cover_image"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			errors := tt.input.Validate()

			if tt.wantErrors == nil {
				if errors != nil {
					t.Errorf("Validate() returned errors, want nil: %+v", errors.Fields)
				}
				return
			}

			if errors == nil {
				t.Fatalf("Validate() returned nil, want errors for fields: %v", tt.wantErrors)
			}

			for _, field := range tt.wantErrors {
				if !errors.HasField(field) {
					t.Errorf("Validate() missing error for field %q", field)
				}
			}

			// Check no unexpected errors
			for field := range errors.Fields {
				found := false
				for _, wantField := range tt.wantErrors {
					if field == wantField {
						found = true
						break
					}
				}
				if !found {
					t.Errorf("Validate() has unexpected error for field %q: %s", field, errors.Fields[field])
				}
			}
		})
	}
}

func TestUpdateBookmarkInput_Validate(t *testing.T) {
	tests := []struct {
		name       string
		input      UpdateBookmarkInput
		wantErrors []string
	}{
		{
			name: "valid input",
			input: UpdateBookmarkInput{
				URL:   "https://example.com",
				Title: "Example Site",
			},
			wantErrors: nil,
		},
		{
			name: "valid input with all fields",
			input: UpdateBookmarkInput{
				URL:         "https://example.com/page",
				Title:       "Example Site",
				Description: "A great website",
				CoverImage:  "https://example.com/image.png",
				IsPublic:    true,
				IsFavorite:  true,
			},
			wantErrors: nil,
		},
		{
			name: "empty URL",
			input: UpdateBookmarkInput{
				URL:   "",
				Title: "Example Site",
			},
			wantErrors: []string{"url"},
		},
		{
			name: "invalid URL",
			input: UpdateBookmarkInput{
				URL:   "not-a-url",
				Title: "Example Site",
			},
			wantErrors: []string{"url"},
		},
		{
			name: "empty title",
			input: UpdateBookmarkInput{
				URL:   "https://example.com",
				Title: "",
			},
			wantErrors: []string{"title"},
		},
		{
			name: "title too long",
			input: UpdateBookmarkInput{
				URL:   "https://example.com",
				Title: strings.Repeat("a", 201),
			},
			wantErrors: []string{"title"},
		},
		{
			name: "description too long",
			input: UpdateBookmarkInput{
				URL:         "https://example.com",
				Title:       "Example Site",
				Description: strings.Repeat("a", 501),
			},
			wantErrors: []string{"description"},
		},
		{
			name: "invalid cover image URL",
			input: UpdateBookmarkInput{
				URL:        "https://example.com",
				Title:      "Example Site",
				CoverImage: "invalid-url",
			},
			wantErrors: []string{"cover_image"},
		},
		{
			name: "multiple errors",
			input: UpdateBookmarkInput{
				URL:        "",
				Title:      "",
				CoverImage: "bad-url",
			},
			wantErrors: []string{"url", "title", "cover_image"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			errors := tt.input.Validate()

			if tt.wantErrors == nil {
				if errors != nil {
					t.Errorf("Validate() returned errors, want nil: %+v", errors.Fields)
				}
				return
			}

			if errors == nil {
				t.Fatalf("Validate() returned nil, want errors for fields: %v", tt.wantErrors)
			}

			for _, field := range tt.wantErrors {
				if !errors.HasField(field) {
					t.Errorf("Validate() missing error for field %q", field)
				}
			}

			for field := range errors.Fields {
				found := false
				for _, wantField := range tt.wantErrors {
					if field == wantField {
						found = true
						break
					}
				}
				if !found {
					t.Errorf("Validate() has unexpected error for field %q: %s", field, errors.Fields[field])
				}
			}
		})
	}
}
