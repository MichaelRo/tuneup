// Accessibility utilities including focus management
// WHY: Centralized a11y helpers for consistent keyboard navigation and screen reader support

export function createSkipLink(
  target: string,
  text: string = 'Skip to main content',
): HTMLAnchorElement {
  const link = document.createElement('a');
  link.href = target;
  link.textContent = text;
  link.className = 'skip-link';
  link.style.cssText = `
    position: absolute;
    top: -40px;
    left: 6px;
    background: #000;
    color: #fff;
    padding: 8px;
    text-decoration: none;
    border-radius: 4px;
    z-index: 1000;
    transition: top 0.3s;
  `;

  link.addEventListener('focus', () => {
    link.style.top = '6px';
  });

  link.addEventListener('blur', () => {
    link.style.top = '-40px';
  });

  return link;
}

export function trapFocus(container: HTMLElement): () => void {
  const focusableElements = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
  ) as NodeListOf<HTMLElement>;

  const firstElement = focusableElements[0];
  const lastElement = focusableElements[focusableElements.length - 1];

  const handleTabKey = (e: KeyboardEvent) => {
    if (e.key !== 'Tab') return;

    if (e.shiftKey) {
      // Shift + Tab
      if (document.activeElement === firstElement && lastElement) {
        e.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab
      if (document.activeElement === lastElement && firstElement) {
        e.preventDefault();
        firstElement.focus();
      }
    }
  };

  container.addEventListener('keydown', handleTabKey);

  // Focus first element
  if (firstElement) {
    firstElement.focus();
  }

  // Return cleanup function
  return () => {
    container.removeEventListener('keydown', handleTabKey);
  };
}

export function restoreFocus(element: HTMLElement | null): void {
  if (element && typeof element.focus === 'function') {
    element.focus();
  }
}

export function announceToScreenReader(
  message: string,
  priority: 'polite' | 'assertive' = 'polite',
): void {
  const region = document.getElementById('toast-live-region') || createLiveRegion();
  region.setAttribute('aria-live', priority);
  region.textContent = message;

  // Clear after announcement
  setTimeout(() => {
    region.textContent = '';
  }, 1000);
}

function createLiveRegion(): HTMLElement {
  const region = document.createElement('div');
  region.id = 'toast-live-region';
  region.setAttribute('aria-live', 'assertive');
  region.setAttribute('aria-atomic', 'true');
  region.style.cssText = `
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    border: 0;
  `;
  document.body.appendChild(region);
  return region;
}
