package models

import (
	"strings"
	"testing"
)

func TestCreatePostInput_Validate(t *testing.T) {
	tests := []struct {
		name       string
		input      CreatePostInput
		wantErrors []string
	}{
		{
			name: "valid draft post",
			input: CreatePostInput{
				Title:   "My Post",
				Slug:    "my-post",
				Content: "",
				IsDraft: true,
			},
			wantErrors: nil,
		},
		{
			name: "valid published post",
			input: CreatePostInput{
				Title:   "My Post",
				Slug:    "my-post",
				Content: "This is the content",
				IsDraft: false,
			},
			wantErrors: nil,
		},
		{
			name: "valid post with all fields",
			input: CreatePostInput{
				Title:      "My Post",
				Slug:       "my-post-2024",
				Content:    "Content here",
				Excerpt:    "Short excerpt",
				CoverImage: "https://example.com/image.png",
				IsDraft:    false,
				TagIDs:     []int64{1, 2, 3},
			},
			wantErrors: nil,
		},
		{
			name: "empty title",
			input: CreatePostInput{
				Title:   "",
				Slug:    "my-post",
				IsDraft: true,
			},
			wantErrors: []string{"title"},
		},
		{
			name: "whitespace title",
			input: CreatePostInput{
				Title:   "   ",
				Slug:    "my-post",
				IsDraft: true,
			},
			wantErrors: []string{"title"},
		},
		{
			name: "title too long",
			input: CreatePostInput{
				Title:   strings.Repeat("a", 201),
				Slug:    "my-post",
				IsDraft: true,
			},
			wantErrors: []string{"title"},
		},
		{
			name: "title at max length",
			input: CreatePostInput{
				Title:   strings.Repeat("a", 200),
				Slug:    "my-post",
				IsDraft: true,
			},
			wantErrors: nil,
		},
		{
			name: "empty slug",
			input: CreatePostInput{
				Title:   "My Post",
				Slug:    "",
				IsDraft: true,
			},
			wantErrors: []string{"slug"},
		},
		{
			name: "whitespace slug",
			input: CreatePostInput{
				Title:   "My Post",
				Slug:    "   ",
				IsDraft: true,
			},
			wantErrors: []string{"slug"},
		},
		{
			name: "slug too long",
			input: CreatePostInput{
				Title:   "My Post",
				Slug:    strings.Repeat("a", 101),
				IsDraft: true,
			},
			wantErrors: []string{"slug"},
		},
		{
			name: "slug at max length",
			input: CreatePostInput{
				Title:   "My Post",
				Slug:    strings.Repeat("a", 100),
				IsDraft: true,
			},
			wantErrors: nil,
		},
		{
			name: "invalid slug - uppercase",
			input: CreatePostInput{
				Title:   "My Post",
				Slug:    "My-Post",
				IsDraft: true,
			},
			wantErrors: []string{"slug"},
		},
		{
			name: "invalid slug - spaces",
			input: CreatePostInput{
				Title:   "My Post",
				Slug:    "my post",
				IsDraft: true,
			},
			wantErrors: []string{"slug"},
		},
		{
			name: "invalid slug - underscores",
			input: CreatePostInput{
				Title:   "My Post",
				Slug:    "my_post",
				IsDraft: true,
			},
			wantErrors: []string{"slug"},
		},
		{
			name: "invalid slug - special chars",
			input: CreatePostInput{
				Title:   "My Post",
				Slug:    "my@post",
				IsDraft: true,
			},
			wantErrors: []string{"slug"},
		},
		{
			name: "content required when publishing",
			input: CreatePostInput{
				Title:   "My Post",
				Slug:    "my-post",
				Content: "",
				IsDraft: false,
			},
			wantErrors: []string{"content"},
		},
		{
			name: "whitespace content when publishing",
			input: CreatePostInput{
				Title:   "My Post",
				Slug:    "my-post",
				Content: "   ",
				IsDraft: false,
			},
			wantErrors: []string{"content"},
		},
		{
			name: "content not required for draft",
			input: CreatePostInput{
				Title:   "My Post",
				Slug:    "my-post",
				Content: "",
				IsDraft: true,
			},
			wantErrors: nil,
		},
		{
			name: "invalid cover image URL",
			input: CreatePostInput{
				Title:      "My Post",
				Slug:       "my-post",
				Content:    "Content",
				CoverImage: "not-a-url",
				IsDraft:    false,
			},
			wantErrors: []string{"cover_image"},
		},
		{
			name: "empty cover image is valid",
			input: CreatePostInput{
				Title:      "My Post",
				Slug:       "my-post",
				Content:    "Content",
				CoverImage: "",
				IsDraft:    false,
			},
			wantErrors: nil,
		},
		{
			name: "multiple errors",
			input: CreatePostInput{
				Title:      "",
				Slug:       "INVALID",
				Content:    "",
				CoverImage: "bad-url",
				IsDraft:    false,
			},
			wantErrors: []string{"title", "slug", "content", "cover_image"},
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

func TestUpdatePostInput_Validate(t *testing.T) {
	tests := []struct {
		name       string
		input      UpdatePostInput
		wantErrors []string
	}{
		{
			name: "valid draft post",
			input: UpdatePostInput{
				Title:   "My Post",
				Slug:    "my-post",
				Content: "",
				IsDraft: true,
			},
			wantErrors: nil,
		},
		{
			name: "valid published post",
			input: UpdatePostInput{
				Title:   "My Post",
				Slug:    "my-post",
				Content: "This is the content",
				IsDraft: false,
			},
			wantErrors: nil,
		},
		{
			name: "empty title",
			input: UpdatePostInput{
				Title:   "",
				Slug:    "my-post",
				IsDraft: true,
			},
			wantErrors: []string{"title"},
		},
		{
			name: "title too long",
			input: UpdatePostInput{
				Title:   strings.Repeat("a", 201),
				Slug:    "my-post",
				IsDraft: true,
			},
			wantErrors: []string{"title"},
		},
		{
			name: "empty slug",
			input: UpdatePostInput{
				Title:   "My Post",
				Slug:    "",
				IsDraft: true,
			},
			wantErrors: []string{"slug"},
		},
		{
			name: "slug too long",
			input: UpdatePostInput{
				Title:   "My Post",
				Slug:    strings.Repeat("a", 101),
				IsDraft: true,
			},
			wantErrors: []string{"slug"},
		},
		{
			name: "invalid slug format",
			input: UpdatePostInput{
				Title:   "My Post",
				Slug:    "Invalid_Slug",
				IsDraft: true,
			},
			wantErrors: []string{"slug"},
		},
		{
			name: "content required when publishing",
			input: UpdatePostInput{
				Title:   "My Post",
				Slug:    "my-post",
				Content: "",
				IsDraft: false,
			},
			wantErrors: []string{"content"},
		},
		{
			name: "content not required for draft",
			input: UpdatePostInput{
				Title:   "My Post",
				Slug:    "my-post",
				Content: "",
				IsDraft: true,
			},
			wantErrors: nil,
		},
		{
			name: "invalid cover image URL",
			input: UpdatePostInput{
				Title:      "My Post",
				Slug:       "my-post",
				Content:    "Content",
				CoverImage: "invalid",
				IsDraft:    false,
			},
			wantErrors: []string{"cover_image"},
		},
		{
			name: "multiple errors",
			input: UpdatePostInput{
				Title:      "",
				Slug:       "",
				Content:    "",
				CoverImage: "bad",
				IsDraft:    false,
			},
			wantErrors: []string{"title", "slug", "content", "cover_image"},
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
