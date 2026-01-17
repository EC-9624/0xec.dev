/**
 * Theme Switcher - Color scheme and mode selection with localStorage persistence
 * 
 * Features:
 * - 5 color scheme presets (each with light + dark variants)
 * - Light/Dark/System mode toggle
 * - Persistent preferences via localStorage
 * - Collapsible floating panel
 */
(function() {
  'use strict';

  // Storage keys
  var STORAGE_PRESET = 'theme-preset';
  var STORAGE_MODE = 'theme-mode';
  var STORAGE_PANEL = 'theme-panel-open';

  // Mode constants
  var MODE_LIGHT = 'light';
  var MODE_DARK = 'dark';
  var MODE_SYSTEM = 'system';

  // Theme presets with light and dark variants
  var presets = {
    current: {
      name: "Default",
      accent: "hsl(175 70% 40%)",
      light: {
        background: "hsl(40 20% 98%)",
        foreground: "hsl(40 10% 9%)",
        card: "hsl(40 30% 99%)",
        cardForeground: "hsl(40 10% 9%)",
        popover: "hsl(40 30% 99%)",
        popoverForeground: "hsl(40 10% 9%)",
        primary: "hsl(175 70% 40%)",
        primaryForeground: "hsl(0 0% 100%)",
        secondary: "hsl(40 15% 94%)",
        secondaryForeground: "hsl(40 10% 9%)",
        muted: "hsl(40 15% 94%)",
        mutedForeground: "hsl(40 10% 45%)",
        accent: "hsl(175 70% 40%)",
        accentForeground: "hsl(0 0% 100%)",
        border: "hsl(40 10% 85%)",
        input: "hsl(40 10% 82%)",
        ring: "hsl(175 70% 40%)",
        sidebar: "hsl(40 20% 96%)",
        link: "hsl(175 70% 35%)",
        linkHover: "hsl(175 70% 28%)"
      },
      dark: {
        background: "hsl(220 10% 12%)",
        foreground: "hsl(220 5% 95%)",
        card: "hsl(220 10% 15%)",
        cardForeground: "hsl(220 5% 95%)",
        popover: "hsl(220 10% 17%)",
        popoverForeground: "hsl(220 5% 95%)",
        primary: "hsl(175 70% 45%)",
        primaryForeground: "hsl(220 10% 10%)",
        secondary: "hsl(220 10% 18%)",
        secondaryForeground: "hsl(220 5% 95%)",
        muted: "hsl(220 10% 20%)",
        mutedForeground: "hsl(220 5% 60%)",
        accent: "hsl(175 70% 45%)",
        accentForeground: "hsl(220 10% 10%)",
        border: "hsl(220 10% 25%)",
        input: "hsl(220 10% 28%)",
        ring: "hsl(175 70% 45%)",
        sidebar: "hsl(220 10% 10%)",
        link: "hsl(175 70% 50%)",
        linkHover: "hsl(175 70% 60%)"
      }
    },
    stoneAmber: {
      name: "Stone + Amber",
      accent: "hsl(38 92% 50%)",
      light: {
        background: "hsl(40 15% 96%)",
        foreground: "hsl(40 10% 9%)",
        card: "hsl(40 20% 99%)",
        cardForeground: "hsl(40 10% 9%)",
        popover: "hsl(40 20% 99%)",
        popoverForeground: "hsl(40 10% 9%)",
        primary: "hsl(38 92% 50%)",
        primaryForeground: "hsl(40 10% 9%)",
        secondary: "hsl(40 12% 90%)",
        secondaryForeground: "hsl(40 10% 9%)",
        muted: "hsl(40 12% 90%)",
        mutedForeground: "hsl(40 10% 40%)",
        accent: "hsl(38 92% 50%)",
        accentForeground: "hsl(40 10% 9%)",
        border: "hsl(40 8% 80%)",
        input: "hsl(40 8% 78%)",
        ring: "hsl(38 92% 50%)",
        sidebar: "hsl(40 15% 93%)",
        link: "hsl(38 92% 40%)",
        linkHover: "hsl(38 92% 32%)"
      },
      dark: {
        background: "hsl(40 10% 10%)",
        foreground: "hsl(40 5% 95%)",
        card: "hsl(40 10% 13%)",
        cardForeground: "hsl(40 5% 95%)",
        popover: "hsl(40 10% 15%)",
        popoverForeground: "hsl(40 5% 95%)",
        primary: "hsl(38 92% 55%)",
        primaryForeground: "hsl(40 10% 9%)",
        secondary: "hsl(40 10% 16%)",
        secondaryForeground: "hsl(40 5% 95%)",
        muted: "hsl(40 10% 18%)",
        mutedForeground: "hsl(40 5% 60%)",
        accent: "hsl(38 92% 55%)",
        accentForeground: "hsl(40 10% 9%)",
        border: "hsl(40 10% 22%)",
        input: "hsl(40 10% 25%)",
        ring: "hsl(38 92% 55%)",
        sidebar: "hsl(40 10% 8%)",
        link: "hsl(38 92% 60%)",
        linkHover: "hsl(38 92% 70%)"
      }
    },
    coolBlue: {
      name: "Cool + Blue",
      accent: "hsl(220 70% 50%)",
      light: {
        background: "hsl(220 15% 97%)",
        foreground: "hsl(220 10% 9%)",
        card: "hsl(220 20% 99%)",
        cardForeground: "hsl(220 10% 9%)",
        popover: "hsl(220 20% 99%)",
        popoverForeground: "hsl(220 10% 9%)",
        primary: "hsl(220 70% 50%)",
        primaryForeground: "hsl(0 0% 100%)",
        secondary: "hsl(220 12% 91%)",
        secondaryForeground: "hsl(220 10% 9%)",
        muted: "hsl(220 12% 91%)",
        mutedForeground: "hsl(220 10% 45%)",
        accent: "hsl(220 70% 50%)",
        accentForeground: "hsl(0 0% 100%)",
        border: "hsl(220 10% 82%)",
        input: "hsl(220 10% 80%)",
        ring: "hsl(220 70% 50%)",
        sidebar: "hsl(220 15% 94%)",
        link: "hsl(220 70% 45%)",
        linkHover: "hsl(220 70% 38%)"
      },
      dark: {
        background: "hsl(220 15% 10%)",
        foreground: "hsl(220 5% 95%)",
        card: "hsl(220 15% 13%)",
        cardForeground: "hsl(220 5% 95%)",
        popover: "hsl(220 15% 15%)",
        popoverForeground: "hsl(220 5% 95%)",
        primary: "hsl(220 70% 55%)",
        primaryForeground: "hsl(0 0% 100%)",
        secondary: "hsl(220 15% 16%)",
        secondaryForeground: "hsl(220 5% 95%)",
        muted: "hsl(220 15% 18%)",
        mutedForeground: "hsl(220 5% 60%)",
        accent: "hsl(220 70% 55%)",
        accentForeground: "hsl(0 0% 100%)",
        border: "hsl(220 15% 22%)",
        input: "hsl(220 15% 25%)",
        ring: "hsl(220 70% 55%)",
        sidebar: "hsl(220 15% 8%)",
        link: "hsl(220 70% 60%)",
        linkHover: "hsl(220 70% 70%)"
      }
    },
    neutralOrange: {
      name: "Neutral + Orange",
      accent: "hsl(24 95% 53%)",
      light: {
        background: "hsl(0 0% 96%)",
        foreground: "hsl(0 0% 9%)",
        card: "hsl(0 0% 99%)",
        cardForeground: "hsl(0 0% 9%)",
        popover: "hsl(0 0% 99%)",
        popoverForeground: "hsl(0 0% 9%)",
        primary: "hsl(24 95% 53%)",
        primaryForeground: "hsl(0 0% 100%)",
        secondary: "hsl(0 0% 90%)",
        secondaryForeground: "hsl(0 0% 9%)",
        muted: "hsl(0 0% 90%)",
        mutedForeground: "hsl(0 0% 40%)",
        accent: "hsl(24 95% 53%)",
        accentForeground: "hsl(0 0% 100%)",
        border: "hsl(0 0% 80%)",
        input: "hsl(0 0% 78%)",
        ring: "hsl(24 95% 53%)",
        sidebar: "hsl(0 0% 93%)",
        link: "hsl(24 95% 43%)",
        linkHover: "hsl(24 95% 35%)"
      },
      dark: {
        background: "hsl(0 0% 10%)",
        foreground: "hsl(0 0% 95%)",
        card: "hsl(0 0% 13%)",
        cardForeground: "hsl(0 0% 95%)",
        popover: "hsl(0 0% 15%)",
        popoverForeground: "hsl(0 0% 95%)",
        primary: "hsl(24 95% 58%)",
        primaryForeground: "hsl(0 0% 9%)",
        secondary: "hsl(0 0% 16%)",
        secondaryForeground: "hsl(0 0% 95%)",
        muted: "hsl(0 0% 18%)",
        mutedForeground: "hsl(0 0% 60%)",
        accent: "hsl(24 95% 58%)",
        accentForeground: "hsl(0 0% 9%)",
        border: "hsl(0 0% 22%)",
        input: "hsl(0 0% 25%)",
        ring: "hsl(24 95% 58%)",
        sidebar: "hsl(0 0% 8%)",
        link: "hsl(24 95% 63%)",
        linkHover: "hsl(24 95% 73%)"
      }
    },
    tealDepth: {
      name: "Teal + Depth",
      accent: "hsl(175 65% 35%)",
      light: {
        background: "hsl(180 10% 96%)",
        foreground: "hsl(180 5% 9%)",
        card: "hsl(180 10% 99%)",
        cardForeground: "hsl(180 5% 9%)",
        popover: "hsl(180 10% 99%)",
        popoverForeground: "hsl(180 5% 9%)",
        primary: "hsl(175 65% 35%)",
        primaryForeground: "hsl(0 0% 100%)",
        secondary: "hsl(180 8% 88%)",
        secondaryForeground: "hsl(180 5% 9%)",
        muted: "hsl(180 8% 88%)",
        mutedForeground: "hsl(180 5% 40%)",
        accent: "hsl(175 65% 35%)",
        accentForeground: "hsl(0 0% 100%)",
        border: "hsl(180 6% 78%)",
        input: "hsl(180 6% 75%)",
        ring: "hsl(175 65% 35%)",
        sidebar: "hsl(180 10% 92%)",
        link: "hsl(175 65% 30%)",
        linkHover: "hsl(175 65% 24%)"
      },
      dark: {
        background: "hsl(180 10% 10%)",
        foreground: "hsl(180 5% 95%)",
        card: "hsl(180 10% 13%)",
        cardForeground: "hsl(180 5% 95%)",
        popover: "hsl(180 10% 15%)",
        popoverForeground: "hsl(180 5% 95%)",
        primary: "hsl(175 65% 45%)",
        primaryForeground: "hsl(180 10% 9%)",
        secondary: "hsl(180 10% 16%)",
        secondaryForeground: "hsl(180 5% 95%)",
        muted: "hsl(180 10% 18%)",
        mutedForeground: "hsl(180 5% 60%)",
        accent: "hsl(175 65% 45%)",
        accentForeground: "hsl(180 10% 9%)",
        border: "hsl(180 10% 22%)",
        input: "hsl(180 10% 25%)",
        ring: "hsl(175 65% 45%)",
        sidebar: "hsl(180 10% 8%)",
        link: "hsl(175 65% 50%)",
        linkHover: "hsl(175 65% 60%)"
      }
    }
  };

  // Current state
  var currentPreset = 'current';
  var currentMode = MODE_SYSTEM;

  /**
   * Get the effective mode (resolves 'system' to actual light/dark)
   */
  function getEffectiveMode() {
    if (currentMode === MODE_SYSTEM) {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
        ? MODE_DARK
        : MODE_LIGHT;
    }
    return currentMode;
  }

  /**
   * Apply color variables to the document
   */
  function applyColors(colors) {
    var root = document.documentElement;
    root.style.setProperty('--color-background', colors.background);
    root.style.setProperty('--color-foreground', colors.foreground);
    root.style.setProperty('--color-card', colors.card);
    root.style.setProperty('--color-card-foreground', colors.cardForeground);
    root.style.setProperty('--color-popover', colors.popover);
    root.style.setProperty('--color-popover-foreground', colors.popoverForeground);
    root.style.setProperty('--color-primary', colors.primary);
    root.style.setProperty('--color-primary-foreground', colors.primaryForeground);
    root.style.setProperty('--color-secondary', colors.secondary);
    root.style.setProperty('--color-secondary-foreground', colors.secondaryForeground);
    root.style.setProperty('--color-muted', colors.muted);
    root.style.setProperty('--color-muted-foreground', colors.mutedForeground);
    root.style.setProperty('--color-accent', colors.accent);
    root.style.setProperty('--color-accent-foreground', colors.accentForeground);
    root.style.setProperty('--color-border', colors.border);
    root.style.setProperty('--color-input', colors.input);
    root.style.setProperty('--color-ring', colors.ring);
    root.style.setProperty('--color-sidebar', colors.sidebar);
    root.style.setProperty('--color-link', colors.link);
    root.style.setProperty('--color-link-hover', colors.linkHover);
  }

  /**
   * Apply the dark/light class to html element
   */
  function applyModeClass(isDark) {
    var html = document.documentElement;
    html.classList.add('no-transitions');
    html.classList.remove(MODE_DARK, MODE_LIGHT);
    html.classList.add(isDark ? MODE_DARK : MODE_LIGHT);
    
    // Re-enable transitions after paint
    requestAnimationFrame(function() {
      requestAnimationFrame(function() {
        html.classList.remove('no-transitions');
      });
    });

    // Update meta theme-color based on current preset's background
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      var preset = presets[currentPreset];
      var colors = isDark ? preset.dark : preset.light;
      // Extract approximate hex from hsl for theme-color
      meta.content = isDark ? '#1a1a1a' : '#f5f5f5';
    }
  }

  /**
   * Apply both preset colors and mode
   */
  function applyTheme() {
    var preset = presets[currentPreset];
    if (!preset) {
      preset = presets.current;
      currentPreset = 'current';
    }
    
    var isDark = getEffectiveMode() === MODE_DARK;
    var colors = isDark ? preset.dark : preset.light;
    
    applyModeClass(isDark);
    applyColors(colors);
    updateUI();
  }

  /**
   * Set the color preset
   */
  function setPreset(presetKey) {
    if (!presets[presetKey]) return;
    currentPreset = presetKey;
    localStorage.setItem(STORAGE_PRESET, presetKey);
    applyTheme();
  }

  /**
   * Set the mode (light/dark/system)
   */
  function setMode(mode) {
    if (mode !== MODE_LIGHT && mode !== MODE_DARK && mode !== MODE_SYSTEM) return;
    currentMode = mode;
    localStorage.setItem(STORAGE_MODE, mode);
    applyTheme();
  }

  /**
   * Toggle panel open/closed
   */
  function togglePanel() {
    var panel = document.getElementById('theme-panel-content');
    var btn = document.getElementById('theme-panel-toggle');
    if (!panel || !btn) return;

    var isOpen = !panel.classList.contains('hidden');
    if (isOpen) {
      panel.classList.add('hidden');
      btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>';
      localStorage.setItem(STORAGE_PANEL, 'false');
    } else {
      panel.classList.remove('hidden');
      btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
      localStorage.setItem(STORAGE_PANEL, 'true');
    }
  }

  /**
   * Update UI to reflect current state
   */
  function updateUI() {
    // Update preset buttons
    var presetBtns = document.querySelectorAll('[data-preset]');
    presetBtns.forEach(function(btn) {
      var isActive = btn.dataset.preset === currentPreset;
      btn.classList.toggle('theme-option-active', isActive);
    });

    // Update mode buttons
    var modeBtns = document.querySelectorAll('[data-mode]');
    modeBtns.forEach(function(btn) {
      var isActive = btn.dataset.mode === currentMode;
      btn.classList.toggle('mode-btn-active', isActive);
    });
  }

  /**
   * Initialize from localStorage
   */
  function init() {
    // Load saved preferences
    var savedPreset = localStorage.getItem(STORAGE_PRESET);
    var savedMode = localStorage.getItem(STORAGE_MODE);
    var savedPanel = localStorage.getItem(STORAGE_PANEL);

    if (savedPreset && presets[savedPreset]) {
      currentPreset = savedPreset;
    }
    if (savedMode && (savedMode === MODE_LIGHT || savedMode === MODE_DARK || savedMode === MODE_SYSTEM)) {
      currentMode = savedMode;
    }

    // Apply theme immediately
    applyTheme();

    // Handle panel state after DOM is ready
    function initPanel() {
      var panel = document.getElementById('theme-panel-content');
      var btn = document.getElementById('theme-panel-toggle');
      if (!panel || !btn) return;

      // Default to open if no saved preference
      var shouldBeOpen = savedPanel !== 'false';
      if (shouldBeOpen) {
        panel.classList.remove('hidden');
        btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>';
      } else {
        panel.classList.add('hidden');
        btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m18 15-6-6-6 6"/></svg>';
      }

      updateUI();
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initPanel);
    } else {
      initPanel();
    }
  }

  // Listen for system preference changes
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function() {
      if (currentMode === MODE_SYSTEM) {
        applyTheme();
      }
    });
  }

  // Initialize
  init();

  // Expose API globally
  window.themeSwitcher = {
    setPreset: setPreset,
    setMode: setMode,
    togglePanel: togglePanel,
    presets: presets
  };
})();
