-- ============================================
-- Remove icon and color columns from collections
-- ============================================
ALTER TABLE collections DROP COLUMN icon;
ALTER TABLE collections DROP COLUMN color;
