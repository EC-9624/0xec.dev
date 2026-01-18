//go:build !dev

package handlers

import "net/http"

// Stub implementations excluded from production builds
func (h *Handlers) TestErrorPage(w http.ResponseWriter, r *http.Request)     {}
func (h *Handlers) TestError500(w http.ResponseWriter, r *http.Request)      {}
func (h *Handlers) TestSlow(w http.ResponseWriter, r *http.Request)          {}
func (h *Handlers) TestSuccess(w http.ResponseWriter, r *http.Request)       {}
func (h *Handlers) TestRetryWorkflow(w http.ResponseWriter, r *http.Request) {}
func (h *Handlers) TestResetRetry(w http.ResponseWriter, r *http.Request)    {}
