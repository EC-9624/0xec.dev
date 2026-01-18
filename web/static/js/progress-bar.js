/**
 * Progress Bar - NProgress-style loading indicator
 * 
 * Shows a subtle animated bar at the top of the page during navigation.
 * Integrates with HTMX events and regular page loads.
 */
(function() {
  'use strict';

  var bar = null;
  var timeout = null;
  var isRunning = false;
  var currentProgress = 0;

  // Configuration
  var CONFIG = {
    minimum: 0.1,        // Start at 10%
    trickleSpeed: 200,   // Trickle every 200ms
    trickleAmount: 0.02, // Increase by 2% each trickle
    speed: 200,          // Animation speed
    easing: 'ease-out'
  };

  /**
   * Create the progress bar element
   */
  function createBar() {
    if (bar) return bar;
    
    bar = document.createElement('div');
    bar.className = 'progress-bar';
    bar.innerHTML = '<div class="progress-bar-inner"></div>';
    document.body.appendChild(bar);
    
    return bar;
  }

  /**
   * Set the progress (0 to 1)
   */
  function setProgress(n) {
    n = Math.max(0, Math.min(1, n));
    currentProgress = n;
    
    var inner = bar.querySelector('.progress-bar-inner');
    if (inner) {
      inner.style.transform = 'translateX(' + (-100 + n * 100) + '%)';
    }
  }

  /**
   * Increment progress by a random small amount
   */
  function trickle() {
    if (currentProgress >= 1) return;
    
    // Slow down as we get closer to complete
    var amount = CONFIG.trickleAmount;
    if (currentProgress > 0.5) amount = 0.01;
    if (currentProgress > 0.8) amount = 0.005;
    
    setProgress(currentProgress + Math.random() * amount);
  }

  /**
   * Start the progress bar
   */
  function start() {
    if (isRunning) return;
    isRunning = true;
    
    createBar();
    setProgress(CONFIG.minimum);
    bar.classList.add('active');
    
    // Start trickling
    timeout = setInterval(trickle, CONFIG.trickleSpeed);
  }

  /**
   * Complete the progress bar
   */
  function done() {
    if (!isRunning) return;
    
    clearInterval(timeout);
    setProgress(1);
    
    // Fade out after completing
    setTimeout(function() {
      bar.classList.remove('active');
      isRunning = false;
      
      // Reset for next use
      setTimeout(function() {
        setProgress(0);
      }, CONFIG.speed);
    }, CONFIG.speed);
  }

  // HTMX Integration
  function initHTMXListeners() {
    document.body.addEventListener('htmx:beforeRequest', function(e) {
      // Show for boosted navigation or elements with hx-indicator
      if (e.detail.boosted || e.detail.elt.hasAttribute('hx-indicator')) {
        start();
      }
    });

    document.body.addEventListener('htmx:afterSettle', function() {
      done();
    });

    document.body.addEventListener('htmx:responseError', function() {
      done();
    });

    document.body.addEventListener('htmx:sendError', function() {
      done();
    });
  }

  // Regular page load integration
  window.addEventListener('beforeunload', function() {
    start();
  });

  // Initialize HTMX listeners when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHTMXListeners);
  } else {
    initHTMXListeners();
  }

  // Expose globally for manual control if needed
  window.progressBar = {
    start: start,
    done: done,
    set: setProgress
  };
})();
