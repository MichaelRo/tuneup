// Toast notification system with ARIA live region support
// WHY: Centralized toast management with proper accessibility

import type { ToastType } from '../types/ui.js';

import { announceToScreenReader } from './a11y.js';

let toastContainer: HTMLDivElement | null = null;

function ensureToastContainer(): HTMLDivElement {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

export function showToast(message: string, type: ToastType = 'info'): void {
  const container = ensureToastContainer();
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  // Announce to screen readers
  announceToScreenReader(message, type === 'error' ? 'assertive' : 'polite');

  requestAnimationFrame(() => {
    toast.classList.add('toast-visible');
  });

  setTimeout(() => {
    toast.classList.remove('toast-visible');
    window.setTimeout(() => {
      toast.remove();
      if (!container.children.length) {
        container.remove();
        toastContainer = null;
      }
    }, 200);
  }, 3500);
}
