/**
 * Client-side form validation for admin forms.
 * Works with data-validate attribute on forms.
 * Uses data-error-* attributes on inputs for custom error messages.
 * 
 * Supported validations:
 * - required: data-error-required="Custom message"
 * - maxlength: data-error-maxlength="Custom message"
 * - pattern: data-error-pattern="Custom message"
 * - url: data-error-url="Custom message" (for type="url" inputs)
 */

(function() {
  'use strict';

  // URL pattern for validation
  const URL_PATTERN = /^https?:\/\/.+/i;
  
  // Slug pattern for validation
  const SLUG_PATTERN = /^[a-z0-9-]+$/;
  
  // Hex color pattern for validation  
  const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

  /**
   * Validate a single input field
   * @param {HTMLInputElement|HTMLTextAreaElement} input 
   * @returns {string|null} Error message or null if valid
   */
  function validateField(input) {
    const value = input.value.trim();
    const type = input.type;
    
    // Required validation
    if (input.hasAttribute('required') && value === '') {
      return input.dataset.errorRequired || 'This field is required';
    }
    
    // Skip other validations if empty and not required
    if (value === '') {
      return null;
    }
    
    // Maxlength validation
    if (input.hasAttribute('maxlength')) {
      const maxLen = parseInt(input.getAttribute('maxlength'), 10);
      if (value.length > maxLen) {
        return input.dataset.errorMaxlength || `Cannot exceed ${maxLen} characters`;
      }
    }
    
    // Pattern validation
    if (input.hasAttribute('pattern')) {
      const pattern = new RegExp('^' + input.getAttribute('pattern') + '$');
      if (!pattern.test(value)) {
        return input.dataset.errorPattern || 'Invalid format';
      }
    }
    
    // URL validation (for type="url" inputs)
    if (type === 'url' && value !== '') {
      if (!URL_PATTERN.test(value)) {
        return input.dataset.errorUrl || 'Must be a valid URL';
      }
    }
    
    return null;
  }

  /**
   * Show error for a field
   * @param {HTMLInputElement|HTMLTextAreaElement} input 
   * @param {string} message 
   */
  function showError(input, message) {
    // Add error class to input
    input.classList.add('input-error');
    input.classList.remove('input-valid');
    
    // Find or create error element
    let errorEl = input.parentElement.querySelector('.field-error');
    if (!errorEl) {
      errorEl = document.createElement('p');
      errorEl.className = 'field-error';
      // Insert after the input (or after any existing elements in the space-y-2 container)
      input.parentElement.appendChild(errorEl);
    }
    
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }

  /**
   * Clear error for a field
   * @param {HTMLInputElement|HTMLTextAreaElement} input 
   * @param {boolean} showValid - Whether to show valid state
   */
  function clearError(input, showValid = false) {
    input.classList.remove('input-error');
    
    if (showValid && input.value.trim() !== '') {
      input.classList.add('input-valid');
    } else {
      input.classList.remove('input-valid');
    }
    
    // Hide error element (but don't remove - it might be server-rendered)
    const errorEl = input.parentElement.querySelector('.field-error');
    if (errorEl) {
      errorEl.style.display = 'none';
    }
  }

  /**
   * Validate all fields in a form
   * @param {HTMLFormElement} form 
   * @returns {boolean} True if all fields are valid
   */
  function validateForm(form) {
    let isValid = true;
    const inputs = form.querySelectorAll('input, textarea, select');
    
    inputs.forEach(input => {
      // Skip hidden inputs and buttons
      if (input.type === 'hidden' || input.type === 'submit' || input.type === 'button') {
        return;
      }
      
      const error = validateField(input);
      if (error) {
        showError(input, error);
        isValid = false;
      } else {
        clearError(input);
      }
    });
    
    // If invalid, scroll to first error
    if (!isValid) {
      const firstError = form.querySelector('.input-error');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstError.focus();
      }
    }
    
    return isValid;
  }

  /**
   * Initialize validation for a form
   * @param {HTMLFormElement} form 
   */
  function initForm(form) {
    // Validate on blur
    form.addEventListener('blur', function(e) {
      const input = e.target;
      if (input.tagName === 'INPUT' || input.tagName === 'TEXTAREA') {
        const error = validateField(input);
        if (error) {
          showError(input, error);
        } else {
          clearError(input, true);
        }
      }
    }, true);
    
    // Clear error on input (gives immediate feedback as user types)
    form.addEventListener('input', function(e) {
      const input = e.target;
      if (input.classList.contains('input-error')) {
        const error = validateField(input);
        if (!error) {
          clearError(input, true);
        }
      }
    }, true);
    
    // Validate on submit
    form.addEventListener('submit', function(e) {
      if (!validateForm(form)) {
        e.preventDefault();
        e.stopPropagation();
      }
    });
  }

  /**
   * Initialize all forms with data-validate attribute
   */
  function init() {
    const forms = document.querySelectorAll('form[data-validate]');
    forms.forEach(initForm);
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Re-initialize after HTMX swaps (for dynamic content)
  document.addEventListener('htmx:afterSwap', function(e) {
    if (e.detail && e.detail.target) {
      const forms = e.detail.target.querySelectorAll('form[data-validate]');
      forms.forEach(initForm);
    }
  });

  // Export for manual initialization
  window.FormValidation = {
    init: init,
    initForm: initForm,
    validateForm: validateForm,
    validateField: validateField
  };
})();
