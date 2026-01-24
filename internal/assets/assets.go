// Package assets provides utilities for resolving hashed static asset paths.
// This enables aggressive browser caching while ensuring cache busting when files change.
package assets

// Path returns the hashed path for a static asset.
// Input: "css/output.css" → Output: "/static/css/output.a1b2c3d4.css"
// If no hash is found in the manifest, returns the original path with /static prefix.
func Path(name string) string {
	if path, ok := manifest[name]; ok {
		return path
	}
	// Fallback to unhashed path if not in manifest
	return "/static/" + name
}
