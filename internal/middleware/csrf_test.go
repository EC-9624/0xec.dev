package middleware

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestCSRF_GeneratesTokenOnFirstRequest(t *testing.T) {
	handler := CSRF(CSRFConfig{Secure: false})(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	// Check that CSRF cookie was set
	cookies := rec.Result().Cookies()
	var csrfCookie *http.Cookie
	for _, c := range cookies {
		if c.Name == "csrf_token" {
			csrfCookie = c
			break
		}
	}

	if csrfCookie == nil {
		t.Fatal("CSRF cookie was not set")
	}

	if csrfCookie.Value == "" {
		t.Error("CSRF token should not be empty")
	}

	// Token should be base64 encoded (32 bytes = 44 chars in base64)
	if len(csrfCookie.Value) < 40 {
		t.Errorf("CSRF token seems too short: %d chars", len(csrfCookie.Value))
	}
}

func TestCSRF_CookieAttributes(t *testing.T) {
	tests := []struct {
		name       string
		secure     bool
		wantSecure bool
	}{
		{"secure mode", true, true},
		{"non-secure mode", false, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler := CSRF(CSRFConfig{Secure: tt.secure})(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.WriteHeader(http.StatusOK)
			}))

			req := httptest.NewRequest(http.MethodGet, "/", nil)
			rec := httptest.NewRecorder()

			handler.ServeHTTP(rec, req)

			cookies := rec.Result().Cookies()
			var csrfCookie *http.Cookie
			for _, c := range cookies {
				if c.Name == "csrf_token" {
					csrfCookie = c
					break
				}
			}

			if csrfCookie == nil {
				t.Fatal("CSRF cookie was not set")
			}

			if csrfCookie.Secure != tt.wantSecure {
				t.Errorf("Cookie Secure = %v, want %v", csrfCookie.Secure, tt.wantSecure)
			}

			if csrfCookie.HttpOnly {
				t.Error("Cookie should NOT be HttpOnly (JS needs to read it)")
			}

			if csrfCookie.SameSite != http.SameSiteStrictMode {
				t.Errorf("Cookie SameSite = %v, want Strict", csrfCookie.SameSite)
			}

			if csrfCookie.Path != "/" {
				t.Errorf("Cookie Path = %q, want %q", csrfCookie.Path, "/")
			}
		})
	}
}

func TestCSRF_ReusesExistingToken(t *testing.T) {
	existingToken := "existing-token-12345"

	handler := CSRF(CSRFConfig{Secure: false})(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.AddCookie(&http.Cookie{Name: "csrf_token", Value: existingToken})
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	// Should NOT set a new cookie when one already exists
	cookies := rec.Result().Cookies()
	for _, c := range cookies {
		if c.Name == "csrf_token" {
			t.Error("Should not set new CSRF cookie when one already exists")
		}
	}
}

func TestCSRF_SafeMethodsAllowed(t *testing.T) {
	safeMethods := []string{
		http.MethodGet,
		http.MethodHead,
		http.MethodOptions,
		http.MethodTrace,
	}

	for _, method := range safeMethods {
		t.Run(method, func(t *testing.T) {
			called := false
			handler := CSRF(CSRFConfig{Secure: false})(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				called = true
				w.WriteHeader(http.StatusOK)
			}))

			req := httptest.NewRequest(method, "/", nil)
			rec := httptest.NewRecorder()

			handler.ServeHTTP(rec, req)

			if !called {
				t.Errorf("%s request should be allowed without CSRF token", method)
			}

			if rec.Code != http.StatusOK {
				t.Errorf("%s returned status %d, want %d", method, rec.Code, http.StatusOK)
			}
		})
	}
}

func TestCSRF_UnsafeMethodsRequireToken(t *testing.T) {
	unsafeMethods := []string{
		http.MethodPost,
		http.MethodPut,
		http.MethodDelete,
		http.MethodPatch,
	}

	for _, method := range unsafeMethods {
		t.Run(method+"_without_token", func(t *testing.T) {
			handler := CSRF(CSRFConfig{Secure: false})(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				t.Error("Handler should not be called without valid CSRF token")
			}))

			req := httptest.NewRequest(method, "/", nil)
			req.AddCookie(&http.Cookie{Name: "csrf_token", Value: "cookie-token"})
			rec := httptest.NewRecorder()

			handler.ServeHTTP(rec, req)

			if rec.Code != http.StatusForbidden {
				t.Errorf("%s without token returned status %d, want %d", method, rec.Code, http.StatusForbidden)
			}
		})
	}
}

func TestCSRF_ValidTokenInHeader(t *testing.T) {
	token := "valid-token-12345"

	called := false
	handler := CSRF(CSRFConfig{Secure: false})(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodPost, "/", nil)
	req.AddCookie(&http.Cookie{Name: "csrf_token", Value: token})
	req.Header.Set("X-CSRF-Token", token)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if !called {
		t.Error("Handler should be called with valid CSRF token in header")
	}

	if rec.Code != http.StatusOK {
		t.Errorf("POST with valid token returned status %d, want %d", rec.Code, http.StatusOK)
	}
}

func TestCSRF_ValidTokenInFormField(t *testing.T) {
	token := "valid-token-12345"

	called := false
	handler := CSRF(CSRFConfig{Secure: false})(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	}))

	// Create form POST request
	form := strings.NewReader("csrf_token=" + token + "&other_field=value")
	req := httptest.NewRequest(http.MethodPost, "/", form)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.AddCookie(&http.Cookie{Name: "csrf_token", Value: token})
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if !called {
		t.Error("Handler should be called with valid CSRF token in form field")
	}

	if rec.Code != http.StatusOK {
		t.Errorf("POST with valid form token returned status %d, want %d", rec.Code, http.StatusOK)
	}
}

func TestCSRF_HeaderTakesPrecedenceOverForm(t *testing.T) {
	cookieToken := "cookie-token"
	headerToken := "cookie-token" // matches cookie
	formToken := "wrong-token"    // doesn't match

	called := false
	handler := CSRF(CSRFConfig{Secure: false})(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	}))

	form := strings.NewReader("csrf_token=" + formToken)
	req := httptest.NewRequest(http.MethodPost, "/", form)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	req.Header.Set("X-CSRF-Token", headerToken)
	req.AddCookie(&http.Cookie{Name: "csrf_token", Value: cookieToken})
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	// Should succeed because header token matches, even though form token doesn't
	if !called {
		t.Error("Handler should be called - header token takes precedence")
	}
}

func TestCSRF_InvalidTokenRejected(t *testing.T) {
	tests := []struct {
		name        string
		cookieToken string
		headerToken string
	}{
		{"mismatched tokens", "cookie-token", "different-token"},
		{"empty header token", "cookie-token", ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			handler := CSRF(CSRFConfig{Secure: false})(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				t.Error("Handler should not be called with invalid CSRF token")
			}))

			req := httptest.NewRequest(http.MethodPost, "/", nil)
			req.AddCookie(&http.Cookie{Name: "csrf_token", Value: tt.cookieToken})
			if tt.headerToken != "" {
				req.Header.Set("X-CSRF-Token", tt.headerToken)
			}
			rec := httptest.NewRecorder()

			handler.ServeHTTP(rec, req)

			if rec.Code != http.StatusForbidden {
				t.Errorf("got status %d, want %d", rec.Code, http.StatusForbidden)
			}

			body := rec.Body.String()
			if !strings.Contains(body, "CSRF") {
				t.Errorf("response body should mention CSRF, got: %s", body)
			}
		})
	}
}

func TestCSRF_TokenAddedToContext(t *testing.T) {
	var contextToken string

	handler := CSRF(CSRFConfig{Secure: false})(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		contextToken = GetCSRFToken(r)
		w.WriteHeader(http.StatusOK)
	}))

	// Test with new token generation
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if contextToken == "" {
		t.Error("CSRF token should be available in context")
	}

	// Token in context should match cookie
	cookies := rec.Result().Cookies()
	var cookieToken string
	for _, c := range cookies {
		if c.Name == "csrf_token" {
			cookieToken = c.Value
			break
		}
	}

	if contextToken != cookieToken {
		t.Errorf("Context token %q doesn't match cookie token %q", contextToken, cookieToken)
	}
}

func TestCSRF_TokenAddedToContext_ExistingCookie(t *testing.T) {
	existingToken := "existing-token-xyz"
	var contextToken string

	handler := CSRF(CSRFConfig{Secure: false})(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		contextToken = GetCSRFToken(r)
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.AddCookie(&http.Cookie{Name: "csrf_token", Value: existingToken})
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	if contextToken != existingToken {
		t.Errorf("Context token = %q, want %q", contextToken, existingToken)
	}
}

func TestGetCSRFToken_NoContext(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	token := GetCSRFToken(req)

	if token != "" {
		t.Errorf("GetCSRFToken without context should return empty, got %q", token)
	}
}

func TestIsSafeMethod(t *testing.T) {
	tests := []struct {
		method string
		want   bool
	}{
		{http.MethodGet, true},
		{http.MethodHead, true},
		{http.MethodOptions, true},
		{http.MethodTrace, true},
		{http.MethodPost, false},
		{http.MethodPut, false},
		{http.MethodDelete, false},
		{http.MethodPatch, false},
		{http.MethodConnect, false},
	}

	for _, tt := range tests {
		t.Run(tt.method, func(t *testing.T) {
			got := isSafeMethod(tt.method)
			if got != tt.want {
				t.Errorf("isSafeMethod(%q) = %v, want %v", tt.method, got, tt.want)
			}
		})
	}
}

func TestGenerateCSRFToken(t *testing.T) {
	// Generate multiple tokens and ensure they're unique
	tokens := make(map[string]bool)

	for i := 0; i < 100; i++ {
		token := generateCSRFToken()

		if token == "" {
			t.Fatal("Generated token should not be empty")
		}

		if tokens[token] {
			t.Fatalf("Generated duplicate token: %s", token)
		}
		tokens[token] = true
	}
}

func TestCSRF_EmptyCookieGeneratesNew(t *testing.T) {
	handler := CSRF(CSRFConfig{Secure: false})(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	// Send request with empty cookie value
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.AddCookie(&http.Cookie{Name: "csrf_token", Value: ""})
	rec := httptest.NewRecorder()

	handler.ServeHTTP(rec, req)

	// Should set a new cookie
	cookies := rec.Result().Cookies()
	var csrfCookie *http.Cookie
	for _, c := range cookies {
		if c.Name == "csrf_token" {
			csrfCookie = c
			break
		}
	}

	if csrfCookie == nil {
		t.Fatal("Should set new CSRF cookie when existing one is empty")
	}

	if csrfCookie.Value == "" {
		t.Error("New CSRF token should not be empty")
	}
}
