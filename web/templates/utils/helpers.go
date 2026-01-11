package utils

import (
	"strconv"
	"time"
)

// TruncateText truncates a string to maxLen characters with ellipsis
func TruncateText(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}

// FormatTimeAgo formats a time as a short relative string
// Examples: "now", "5m ago", "2h ago", "3d ago", "Jan 2"
func FormatTimeAgo(t time.Time) string {
	now := time.Now()
	diff := now.Sub(t)

	switch {
	case diff < time.Minute:
		return "now"
	case diff < time.Hour:
		mins := int(diff.Minutes())
		if mins == 1 {
			return "1m ago"
		}
		return strconv.Itoa(mins) + "m ago"
	case diff < 24*time.Hour:
		hours := int(diff.Hours())
		if hours == 1 {
			return "1h ago"
		}
		return strconv.Itoa(hours) + "h ago"
	case diff < 7*24*time.Hour:
		days := int(diff.Hours() / 24)
		if days == 1 {
			return "1d ago"
		}
		return strconv.Itoa(days) + "d ago"
	default:
		return t.Format("Jan 2")
	}
}

// FormatTimeAgoLong formats a time as a longer relative string
// Examples: "just now", "5 minutes ago", "2 hours ago", "yesterday", "3 days ago"
func FormatTimeAgoLong(t time.Time) string {
	now := time.Now()
	diff := now.Sub(t)

	switch {
	case diff < time.Minute:
		return "just now"
	case diff < time.Hour:
		mins := int(diff.Minutes())
		if mins == 1 {
			return "1 minute ago"
		}
		return strconv.Itoa(mins) + " minutes ago"
	case diff < 24*time.Hour:
		hours := int(diff.Hours())
		if hours == 1 {
			return "1 hour ago"
		}
		return strconv.Itoa(hours) + " hours ago"
	case diff < 7*24*time.Hour:
		days := int(diff.Hours() / 24)
		if days == 1 {
			return "yesterday"
		}
		return strconv.Itoa(days) + " days ago"
	default:
		return t.Format("Jan 2, 2006")
	}
}

// FormatCount returns a count with singular/plural label
// Examples: "1 bookmark", "5 bookmarks", "0 items"
func FormatCount(count int, singular, plural string) string {
	if count == 1 {
		return "1 " + singular
	}
	return strconv.Itoa(count) + " " + plural
}

// Percentage calculates the percentage of value relative to max
// Returns 0 if max is 0 to avoid division by zero
func Percentage(value, max int) int {
	if max == 0 {
		return 0
	}
	return (value * 100) / max
}

// MaxInt returns the maximum value from a slice of integers
func MaxInt(values ...int) int {
	if len(values) == 0 {
		return 0
	}
	max := values[0]
	for _, v := range values[1:] {
		if v > max {
			max = v
		}
	}
	return max
}
