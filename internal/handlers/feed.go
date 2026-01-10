package handlers

import (
	"encoding/xml"
	"net/http"
	"time"

	"github.com/EC-9624/0xec.dev/internal/repository"
)

// RSS feed structures
type RSS struct {
	XMLName xml.Name   `xml:"rss"`
	Version string     `xml:"version,attr"`
	Channel RSSChannel `xml:"channel"`
}

type RSSChannel struct {
	Title         string    `xml:"title"`
	Link          string    `xml:"link"`
	Description   string    `xml:"description"`
	LastBuildDate string    `xml:"lastBuildDate"`
	Items         []RSSItem `xml:"item"`
}

type RSSItem struct {
	Title       string `xml:"title"`
	Link        string `xml:"link"`
	Description string `xml:"description"`
	PubDate     string `xml:"pubDate"`
	GUID        string `xml:"guid"`
}

// PostsFeed generates RSS feed for posts
func (h *Handlers) PostsFeed(w http.ResponseWriter, r *http.Request) {
	posts, err := h.postRepo.List(true, 20, 0)
	if err != nil {
		http.Error(w, "Failed to load posts", http.StatusInternalServerError)
		return
	}

	var items []RSSItem
	for _, post := range posts {
		pubDate := post.CreatedAt
		if post.PublishedAt.Valid {
			pubDate = post.PublishedAt.Time
		}

		items = append(items, RSSItem{
			Title:       post.Title,
			Link:        h.config.BaseURL + "/posts/" + post.Slug,
			Description: post.GetExcerpt(),
			PubDate:     pubDate.Format(time.RFC1123Z),
			GUID:        h.config.BaseURL + "/posts/" + post.Slug,
		})
	}

	rss := RSS{
		Version: "2.0",
		Channel: RSSChannel{
			Title:         "Posts",
			Link:          h.config.BaseURL + "/posts",
			Description:   "Latest posts",
			LastBuildDate: time.Now().Format(time.RFC1123Z),
			Items:         items,
		},
	}

	w.Header().Set("Content-Type", "application/rss+xml; charset=utf-8")
	w.Write([]byte(xml.Header))
	xml.NewEncoder(w).Encode(rss)
}

// BookmarksFeed generates RSS feed for bookmarks
func (h *Handlers) BookmarksFeed(w http.ResponseWriter, r *http.Request) {
	bookmarks, err := h.bookmarkRepo.List(repository.BookmarkListOptions{
		PublicOnly: true,
		Limit:      50,
		Offset:     0,
	})
	if err != nil {
		http.Error(w, "Failed to load bookmarks", http.StatusInternalServerError)
		return
	}

	var items []RSSItem
	for _, bookmark := range bookmarks {
		items = append(items, RSSItem{
			Title:       bookmark.Title,
			Link:        bookmark.URL,
			Description: bookmark.GetDescription(),
			PubDate:     bookmark.CreatedAt.Format(time.RFC1123Z),
			GUID:        bookmark.URL,
		})
	}

	rss := RSS{
		Version: "2.0",
		Channel: RSSChannel{
			Title:         "Bookmarks",
			Link:          h.config.BaseURL + "/bookmarks",
			Description:   "Latest bookmarks",
			LastBuildDate: time.Now().Format(time.RFC1123Z),
			Items:         items,
		},
	}

	w.Header().Set("Content-Type", "application/rss+xml; charset=utf-8")
	w.Write([]byte(xml.Header))
	xml.NewEncoder(w).Encode(rss)
}
