//go:build dev

package handlers

import (
	"net/http"
	"sync"
	"time"

	"github.com/EC-9624/0xec.dev/web/templates/admin"
	"github.com/EC-9624/0xec.dev/web/templates/components"
)

// retryAttemptCount tracks retry attempts for testing (simple counter)
var (
	retryAttemptCount int
	retryMu           sync.Mutex
)

// TestErrorPage renders the error handling test page
func (h *Handlers) TestErrorPage(w http.ResponseWriter, r *http.Request) {
	render(w, r, admin.ErrorTestPage())
}

// TestError500 returns a 500 error with inline error component
func (h *Handlers) TestError500(w http.ResponseWriter, r *http.Request) {
	// Small delay to show spinner
	time.Sleep(500 * time.Millisecond)
	w.WriteHeader(http.StatusInternalServerError)
	render(w, r, components.InlineErrorWithRetry("Server error (500)", "/admin/test/error-500"))
}

// TestSlow simulates a slow response (15 seconds) to test client-side timeout
func (h *Handlers) TestSlow(w http.ResponseWriter, r *http.Request) {
	// Sleep for 15 seconds - longer than the 10 second client timeout
	time.Sleep(15 * time.Second)
	render(w, r, admin.ErrorTestSuccess())
}

// TestSuccess returns a successful response
func (h *Handlers) TestSuccess(w http.ResponseWriter, r *http.Request) {
	// Small delay to show spinner
	time.Sleep(500 * time.Millisecond)
	render(w, r, admin.ErrorTestSuccess())
}

// TestRetryWorkflow simulates a workflow where first request fails, retry succeeds
func (h *Handlers) TestRetryWorkflow(w http.ResponseWriter, r *http.Request) {
	retryMu.Lock()
	retryAttemptCount++
	count := retryAttemptCount
	retryMu.Unlock()

	// Small delay to show spinner
	time.Sleep(500 * time.Millisecond)

	// First attempt fails, subsequent attempts succeed
	if count == 1 {
		w.WriteHeader(http.StatusInternalServerError)
		render(w, r, components.InlineErrorWithRetry("First attempt failed (as expected)", "/admin/test/retry-workflow"))
		return
	}

	// Reset counter for next test
	retryMu.Lock()
	retryAttemptCount = 0
	retryMu.Unlock()

	render(w, r, admin.ErrorTestRetrySuccess(count))
}

// TestResetRetry resets the retry workflow state
func (h *Handlers) TestResetRetry(w http.ResponseWriter, r *http.Request) {
	retryMu.Lock()
	retryAttemptCount = 0
	retryMu.Unlock()

	w.WriteHeader(http.StatusOK)
	w.Write([]byte("Retry state reset"))
}
