/**
 * ec-mobile-nav - Mobile navigation Web Component
 *
 * Features:
 * - Bottom sheet drawer with scale effect on content
 * - Auto-hide bottom bar on scroll down
 * - Close on backdrop click, Escape key, scroll attempt
 * - Loading indicator during page transitions
 * - HTMX integration
 *
 * Usage:
 * <ec-mobile-nav>
 *   <div class="nav-drawer-backdrop"></div>
 *   <nav class="nav-drawer">...</nav>
 *   <div class="mobile-bottom-bar">
 *     <button data-toggle>...</button>
 *   </div>
 *   <div class="nav-loading-indicator">...</div>
 * </ec-mobile-nav>
 *
 * API:
 * window.navDrawer.open()
 * window.navDrawer.close()
 * window.navDrawer.toggle()
 * window.navDrawer.isOpen()
 */

class EcMobileNav extends HTMLElement {
  // ============================================
  // CONFIGURATION
  // ============================================

  static SCROLL_THRESHOLD = 10;
  static SCROLL_TOP_ZONE = 50;

  // ============================================
  // PRIVATE STATE
  // ============================================

  #isOpen = false;
  #isBarHidden = false;
  #lastScrollY = 0;
  #ticking = false;
  #abortController = null;

  // Element references
  #drawer = null;
  #backdrop = null;
  #bar = null;
  #loadingIndicator = null;
  #scrollContainer = null;

  // ============================================
  // LIFECYCLE
  // ============================================

  connectedCallback() {
    // Find server-rendered elements
    this.#drawer = this.querySelector(".nav-drawer");
    this.#backdrop = this.querySelector(".nav-drawer-backdrop");
    this.#bar = this.querySelector(".mobile-bottom-bar");
    this.#loadingIndicator = this.querySelector(".nav-loading-indicator");

    if (!this.#drawer) {
      console.warn("ec-mobile-nav: Missing .nav-drawer", this);
      return;
    }

    // Find scroll container
    this.#scrollContainer = this.#findScrollContainer();

    // Setup event listeners
    this.#abortController = new AbortController();
    this.#setupListeners(this.#abortController.signal);

    // Register global API
    window.navDrawer = {
      open: this.open.bind(this),
      close: this.close.bind(this),
      toggle: this.toggle.bind(this),
      isOpen: () => this.#isOpen,
    };
  }

  disconnectedCallback() {
    this.#abortController?.abort();

    // Clean up body state if open
    if (this.#isOpen) {
      document.body.classList.remove("nav-drawer-open");
      document.body.style.overflow = "";
    }

    // Clear global reference
    if (window.navDrawer?.open === this.open.bind(this)) {
      window.navDrawer = null;
    }
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  #findScrollContainer() {
    const mainScroll = document.querySelector(".main-content-scroll");
    if (mainScroll && mainScroll.scrollHeight > mainScroll.clientHeight) {
      return mainScroll;
    }
    return window;
  }

  #setupListeners(signal) {
    // Toggle button in bottom bar
    const toggleBtn = this.#bar?.querySelector("[data-toggle]");
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => this.toggle(), { signal });
    }

    // Close on backdrop click
    if (this.#backdrop) {
      this.#backdrop.addEventListener("click", () => this.close(), { signal });
    }

    // Close on escape key
    document.addEventListener("keydown", (e) => this.#handleEscape(e), {
      signal,
    });

    // Handle nav link clicks (internal links only)
    const navLinks = this.#drawer.querySelectorAll('a[href^="/"]');
    navLinks.forEach((link) => {
      link.addEventListener("click", (e) => this.#handleNavClick(e), {
        signal,
      });
    });

    // Scroll hide for bottom bar
    if (this.#scrollContainer === window) {
      window.addEventListener("scroll", (e) => this.#onScroll(e), {
        passive: true,
        signal,
      });
    } else if (this.#scrollContainer) {
      this.#scrollContainer.addEventListener(
        "scroll",
        (e) => this.#onScroll(e),
        { passive: true, signal }
      );
    }

    // HTMX integration - hide loading and reset after page swap
    document.addEventListener(
      "htmx:afterSettle",
      () => {
        this.#hideLoading();

        if (this.#isOpen) {
          this.close();
        }

        // Reset scroll tracking
        this.#lastScrollY = 0;
        this.#showBar();

        // Re-find scroll container (DOM may have changed)
        this.#scrollContainer = this.#findScrollContainer();
      },
      { signal }
    );
  }

  #handleEscape(e) {
    if (e.key === "Escape" && this.#isOpen) {
      this.close();
    }
  }

  #handleNavClick(e) {
    // Show loading indicator
    this.#showLoading();

    // Close drawer immediately
    this.close();

    // Navigation happens via htmx-boost, view transition handles the animation
  }

  #closeOnScroll = () => {
    if (this.#isOpen) {
      this.close();
    }
  };

  #onScroll(e) {
    // Don't process scroll if drawer is open
    if (this.#isOpen) return;

    if (!this.#ticking) {
      requestAnimationFrame(() => {
        this.#updateBarVisibility(e);
        this.#ticking = false;
      });
      this.#ticking = true;
    }
  }

  #updateBarVisibility(e) {
    let currentScrollY;

    if (e.target === document || e.target === window || !e.target.scrollTop) {
      currentScrollY = window.scrollY || window.pageYOffset;
    } else {
      currentScrollY = e.target.scrollTop;
    }

    const scrollDelta = currentScrollY - this.#lastScrollY;

    // Only act if scroll exceeds threshold
    if (Math.abs(scrollDelta) < EcMobileNav.SCROLL_THRESHOLD) {
      return;
    }

    // At top of page - always show
    if (currentScrollY < EcMobileNav.SCROLL_TOP_ZONE) {
      this.#showBar();
    }
    // Scrolling down - hide
    else if (scrollDelta > 0) {
      this.#hideBar();
    }
    // Scrolling up - show
    else {
      this.#showBar();
    }

    this.#lastScrollY = currentScrollY;
  }

  #showBar() {
    if (this.#isBarHidden && this.#bar) {
      this.#bar.classList.remove("scroll-hidden");
      this.#isBarHidden = false;
    }
  }

  #hideBar() {
    if (!this.#isBarHidden && this.#bar) {
      this.#bar.classList.add("scroll-hidden");
      this.#isBarHidden = true;
    }
  }

  #showLoading() {
    if (this.#loadingIndicator) {
      this.#loadingIndicator.classList.add("active");
    }
  }

  #hideLoading() {
    if (this.#loadingIndicator) {
      this.#loadingIndicator.classList.remove("active");
    }
  }

  // ============================================
  // PUBLIC API
  // ============================================

  open() {
    if (this.#isOpen || !this.#drawer) return;

    this.#isOpen = true;
    document.body.classList.add("nav-drawer-open");
    this.#drawer.classList.add("open");
    document.body.style.overflow = "hidden";

    // Show bottom bar when drawer opens (if it was hidden)
    this.#showBar();

    // Add scroll listeners to close drawer on scroll attempt
    document.addEventListener("wheel", this.#closeOnScroll, { passive: true });
    document.addEventListener("touchmove", this.#closeOnScroll, {
      passive: true,
    });

    // Focus first nav item for accessibility
    setTimeout(() => {
      const firstLink = this.#drawer.querySelector("a[href]");
      if (firstLink) firstLink.focus();
    }, 200);
  }

  close() {
    if (!this.#isOpen || !this.#drawer) return;

    this.#isOpen = false;
    document.body.classList.remove("nav-drawer-open");
    this.#drawer.classList.remove("open");
    document.body.style.overflow = "";

    // Remove scroll listeners
    document.removeEventListener("wheel", this.#closeOnScroll);
    document.removeEventListener("touchmove", this.#closeOnScroll);
  }

  toggle() {
    if (this.#isOpen) {
      this.close();
    } else {
      this.open();
    }
  }
}

// Register custom element
customElements.define("ec-mobile-nav", EcMobileNav);
