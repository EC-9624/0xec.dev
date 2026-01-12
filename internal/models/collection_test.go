package models

import (
	"strings"
	"testing"
)

func TestCreateCollectionInput_Validate(t *testing.T) {
	tests := []struct {
		name       string
		input      CreateCollectionInput
		wantErrors []string
	}{
		{
			name: "valid input",
			input: CreateCollectionInput{
				Name: "My Collection",
				Slug: "my-collection",
			},
			wantErrors: nil,
		},
		{
			name: "valid input with all fields",
			input: CreateCollectionInput{
				Name:        "My Collection",
				Slug:        "my-collection",
				Description: "A great collection",
				Color:       "#3b82f6",
				IsPublic:    true,
			},
			wantErrors: nil,
		},
		{
			name: "valid input with parent",
			input: CreateCollectionInput{
				Name:     "Sub Collection",
				Slug:     "sub-collection",
				ParentID: func() *int64 { id := int64(1); return &id }(),
			},
			wantErrors: nil,
		},
		{
			name: "empty name",
			input: CreateCollectionInput{
				Name: "",
				Slug: "my-collection",
			},
			wantErrors: []string{"name"},
		},
		{
			name: "whitespace name",
			input: CreateCollectionInput{
				Name: "   ",
				Slug: "my-collection",
			},
			wantErrors: []string{"name"},
		},
		{
			name: "name too long",
			input: CreateCollectionInput{
				Name: strings.Repeat("a", 101),
				Slug: "my-collection",
			},
			wantErrors: []string{"name"},
		},
		{
			name: "name at max length",
			input: CreateCollectionInput{
				Name: strings.Repeat("a", 100),
				Slug: "my-collection",
			},
			wantErrors: nil,
		},
		{
			name: "empty slug",
			input: CreateCollectionInput{
				Name: "My Collection",
				Slug: "",
			},
			wantErrors: []string{"slug"},
		},
		{
			name: "whitespace slug",
			input: CreateCollectionInput{
				Name: "My Collection",
				Slug: "   ",
			},
			wantErrors: []string{"slug"},
		},
		{
			name: "slug too long",
			input: CreateCollectionInput{
				Name: "My Collection",
				Slug: strings.Repeat("a", 101),
			},
			wantErrors: []string{"slug"},
		},
		{
			name: "slug at max length",
			input: CreateCollectionInput{
				Name: "My Collection",
				Slug: strings.Repeat("a", 100),
			},
			wantErrors: nil,
		},
		{
			name: "invalid slug - uppercase",
			input: CreateCollectionInput{
				Name: "My Collection",
				Slug: "My-Collection",
			},
			wantErrors: []string{"slug"},
		},
		{
			name: "invalid slug - spaces",
			input: CreateCollectionInput{
				Name: "My Collection",
				Slug: "my collection",
			},
			wantErrors: []string{"slug"},
		},
		{
			name: "invalid slug - underscores",
			input: CreateCollectionInput{
				Name: "My Collection",
				Slug: "my_collection",
			},
			wantErrors: []string{"slug"},
		},
		{
			name: "description too long",
			input: CreateCollectionInput{
				Name:        "My Collection",
				Slug:        "my-collection",
				Description: strings.Repeat("a", 501),
			},
			wantErrors: []string{"description"},
		},
		{
			name: "description at max length",
			input: CreateCollectionInput{
				Name:        "My Collection",
				Slug:        "my-collection",
				Description: strings.Repeat("a", 500),
			},
			wantErrors: nil,
		},
		{
			name: "invalid color - no hash",
			input: CreateCollectionInput{
				Name:  "My Collection",
				Slug:  "my-collection",
				Color: "3b82f6",
			},
			wantErrors: []string{"color"},
		},
		{
			name: "invalid color - short",
			input: CreateCollectionInput{
				Name:  "My Collection",
				Slug:  "my-collection",
				Color: "#3b8",
			},
			wantErrors: []string{"color"},
		},
		{
			name: "invalid color - invalid chars",
			input: CreateCollectionInput{
				Name:  "My Collection",
				Slug:  "my-collection",
				Color: "#gggggg",
			},
			wantErrors: []string{"color"},
		},
		{
			name: "empty color is valid",
			input: CreateCollectionInput{
				Name:  "My Collection",
				Slug:  "my-collection",
				Color: "",
			},
			wantErrors: nil,
		},
		{
			name: "multiple errors",
			input: CreateCollectionInput{
				Name:        "",
				Slug:        "INVALID",
				Description: strings.Repeat("a", 501),
				Color:       "bad",
			},
			wantErrors: []string{"name", "slug", "description", "color"},
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

func TestUpdateCollectionInput_Validate(t *testing.T) {
	tests := []struct {
		name       string
		input      UpdateCollectionInput
		wantErrors []string
	}{
		{
			name: "valid input",
			input: UpdateCollectionInput{
				Name: "My Collection",
				Slug: "my-collection",
			},
			wantErrors: nil,
		},
		{
			name: "valid input with all fields",
			input: UpdateCollectionInput{
				Name:        "My Collection",
				Slug:        "my-collection",
				Description: "A great collection",
				Color:       "#ff0000",
				IsPublic:    true,
				SortOrder:   5,
			},
			wantErrors: nil,
		},
		{
			name: "empty name",
			input: UpdateCollectionInput{
				Name: "",
				Slug: "my-collection",
			},
			wantErrors: []string{"name"},
		},
		{
			name: "name too long",
			input: UpdateCollectionInput{
				Name: strings.Repeat("a", 101),
				Slug: "my-collection",
			},
			wantErrors: []string{"name"},
		},
		{
			name: "empty slug",
			input: UpdateCollectionInput{
				Name: "My Collection",
				Slug: "",
			},
			wantErrors: []string{"slug"},
		},
		{
			name: "slug too long",
			input: UpdateCollectionInput{
				Name: "My Collection",
				Slug: strings.Repeat("a", 101),
			},
			wantErrors: []string{"slug"},
		},
		{
			name: "invalid slug format",
			input: UpdateCollectionInput{
				Name: "My Collection",
				Slug: "Invalid_Slug!",
			},
			wantErrors: []string{"slug"},
		},
		{
			name: "description too long",
			input: UpdateCollectionInput{
				Name:        "My Collection",
				Slug:        "my-collection",
				Description: strings.Repeat("a", 501),
			},
			wantErrors: []string{"description"},
		},
		{
			name: "invalid color",
			input: UpdateCollectionInput{
				Name:  "My Collection",
				Slug:  "my-collection",
				Color: "red",
			},
			wantErrors: []string{"color"},
		},
		{
			name: "multiple errors",
			input: UpdateCollectionInput{
				Name:        "",
				Slug:        "",
				Description: strings.Repeat("a", 501),
				Color:       "invalid",
			},
			wantErrors: []string{"name", "slug", "description", "color"},
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
