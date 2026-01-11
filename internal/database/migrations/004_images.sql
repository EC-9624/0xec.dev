-- Migration: Add images table for self-hosted images (CSP compliance)
-- This stores downloaded cover images and favicons for bookmarks

-- ============================================
-- IMAGES (stored binary image data)
-- ============================================
CREATE TABLE IF NOT EXISTS images (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    hash            TEXT NOT NULL UNIQUE,     -- SHA256 hash for deduplication
    content_type    TEXT NOT NULL,            -- MIME type (image/png, image/jpeg, etc.)
    data            BLOB NOT NULL,            -- Binary image data
    size            INTEGER NOT NULL,         -- Size in bytes
    source_url      TEXT,                     -- Original URL (for reference)
    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_images_hash ON images(hash);

-- Add columns to bookmarks for local image references
-- These are nullable and coexist with the existing cover_image/favicon URL columns
-- for backward compatibility during migration
ALTER TABLE bookmarks ADD COLUMN cover_image_id INTEGER REFERENCES images(id) ON DELETE SET NULL;
ALTER TABLE bookmarks ADD COLUMN favicon_id INTEGER REFERENCES images(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bookmarks_cover_image ON bookmarks(cover_image_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_favicon ON bookmarks(favicon_id);
