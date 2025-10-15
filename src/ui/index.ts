// Main UI module combining all UI functionality
// WHY: Single entry point for all UI components

// Re-export everything from core module
export * from './core.js';

// Re-export modal functions
export { showChoiceModal, showSimpleModal } from './modal.js';

// Re-export toast functions
export { showToast } from './toast.js';

// Re-export a11y utilities
export { createSkipLink, trapFocus, restoreFocus, announceToScreenReader } from './a11y.js';
