package handlers

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/EC-9624/0xec.dev/internal/logger"
	"github.com/google/uuid"
)

// UploadResponse is the JSON response for successful uploads
type UploadResponse struct {
	URL string `json:"url"`
}

// UploadErrorResponse is the JSON response for upload errors
type UploadErrorResponse struct {
	Error string `json:"error"`
}

const (
	maxUploadSize = 10 << 20 // 10 MB
	uploadDir     = "./web/static/uploads"
)

var allowedMimeTypes = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/gif":  ".gif",
	"image/webp": ".webp",
}

// AdminUploadImage handles image uploads for the post editor
// POST /admin/uploads/image
func (h *Handlers) AdminUploadImage(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Limit request body size
	r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize)

	// Parse multipart form
	if err := r.ParseMultipartForm(maxUploadSize); err != nil {
		logger.Error(ctx, "failed to parse multipart form", "error", err)
		writeUploadError(w, "File too large. Maximum size is 10MB.", http.StatusBadRequest)
		return
	}

	// Get the file from form
	file, header, err := r.FormFile("image")
	if err != nil {
		logger.Error(ctx, "failed to get file from form", "error", err)
		writeUploadError(w, "No image file provided.", http.StatusBadRequest)
		return
	}
	defer file.Close()

	// Read first 512 bytes to detect content type
	buff := make([]byte, 512)
	_, err = file.Read(buff)
	if err != nil {
		logger.Error(ctx, "failed to read file header", "error", err)
		writeUploadError(w, "Failed to read file.", http.StatusInternalServerError)
		return
	}

	// Detect content type
	contentType := http.DetectContentType(buff)

	// Validate mime type
	ext, ok := allowedMimeTypes[contentType]
	if !ok {
		writeUploadError(w, fmt.Sprintf("Invalid file type: %s. Allowed: JPEG, PNG, GIF, WebP.", contentType), http.StatusBadRequest)
		return
	}

	// Reset file reader to beginning
	if _, err := file.Seek(0, io.SeekStart); err != nil {
		logger.Error(ctx, "failed to seek file", "error", err)
		writeUploadError(w, "Failed to process file.", http.StatusInternalServerError)
		return
	}

	// Ensure upload directory exists
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		logger.Error(ctx, "failed to create upload directory", "error", err)
		writeUploadError(w, "Failed to save file.", http.StatusInternalServerError)
		return
	}

	// Generate unique filename
	filename := uuid.New().String() + ext

	// Create destination file
	dstPath := filepath.Join(uploadDir, filename)
	dst, err := os.Create(dstPath)
	if err != nil {
		logger.Error(ctx, "failed to create destination file", "error", err, "path", dstPath)
		writeUploadError(w, "Failed to save file.", http.StatusInternalServerError)
		return
	}
	defer dst.Close()

	// Copy file contents
	if _, err := io.Copy(dst, file); err != nil {
		logger.Error(ctx, "failed to copy file contents", "error", err)
		// Clean up partial file
		os.Remove(dstPath)
		writeUploadError(w, "Failed to save file.", http.StatusInternalServerError)
		return
	}

	// Build URL
	url := "/static/uploads/" + filename

	logger.Info(ctx, "image uploaded successfully",
		"filename", filename,
		"original", header.Filename,
		"size", header.Size,
		"type", contentType,
	)

	// Return success response
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(UploadResponse{URL: url})
}

// AdminDeleteImage handles image deletion
// DELETE /admin/uploads/image?url=/static/uploads/xxx.jpg
func (h *Handlers) AdminDeleteImage(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	url := r.URL.Query().Get("url")
	if url == "" {
		writeUploadError(w, "Missing url parameter.", http.StatusBadRequest)
		return
	}

	// Validate URL format and extract filename
	if !strings.HasPrefix(url, "/static/uploads/") {
		writeUploadError(w, "Invalid URL.", http.StatusBadRequest)
		return
	}

	filename := strings.TrimPrefix(url, "/static/uploads/")

	// Validate filename (prevent path traversal)
	if strings.Contains(filename, "/") || strings.Contains(filename, "..") {
		writeUploadError(w, "Invalid filename.", http.StatusBadRequest)
		return
	}

	// Delete file
	filePath := filepath.Join(uploadDir, filename)
	if err := os.Remove(filePath); err != nil {
		if os.IsNotExist(err) {
			// File doesn't exist, that's fine
			w.WriteHeader(http.StatusNoContent)
			return
		}
		logger.Error(ctx, "failed to delete file", "error", err, "path", filePath)
		writeUploadError(w, "Failed to delete file.", http.StatusInternalServerError)
		return
	}

	logger.Info(ctx, "image deleted successfully", "filename", filename)
	w.WriteHeader(http.StatusNoContent)
}

func writeUploadError(w http.ResponseWriter, message string, status int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(UploadErrorResponse{Error: message})
}
