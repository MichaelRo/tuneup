// Modal system with focus trap and keyboard navigation
// WHY: Centralized modal management with proper accessibility

import { trapFocus, restoreFocus } from './a11y.js';
import { el } from './core.js';

export type ModalChoice<T> = {
  label: string | Node;
  value: T;
  subtitle?: string;
};

export type ChoiceModalOptions<T> = {
  title: string;
  description?: string;
  choices: ModalChoice<T>[];
};

export function showChoiceModal<T>({
  title,
  description,
  choices,
  cancelLabel = 'Cancel',
  skipLabel,
  onSkip,
}: ChoiceModalOptions<T> & {
  cancelLabel?: string;
  skipLabel?: string;
  onSkip?: () => void;
}): Promise<T | null> {
  return new Promise(resolve => {
    const backdrop = el('div', { className: 'modal-backdrop' });
    const modal = el('div', { className: 'modal' });

    const header = el('div', { className: 'modal-header', text: title });
    modal.appendChild(header);

    const bodyChildren: Array<Node> = [];
    if (description) {
      bodyChildren.push(el('p', { text: description }));
    }
    const choiceList = el('div', { className: 'modal-choice-list' });
    choices.forEach(choice => {
      const button = el('button', { className: 'btn modal-choice' });
      const labelEl =
        typeof choice.label === 'string'
          ? el('span', { className: 'modal-choice-label', text: choice.label })
          : choice.label;
      button.appendChild(labelEl);
      if (choice.subtitle) {
        button.appendChild(el('span', { className: 'modal-choice-sub', text: choice.subtitle }));
      }
      button.addEventListener('click', () => {
        cleanup();
        resolve(choice.value);
      });
      choiceList.appendChild(button);
    });
    bodyChildren.push(choiceList);

    const body = el('div', { className: 'modal-body', children: bodyChildren });
    modal.appendChild(body);

    const footer = el('div', { className: 'modal-footer' });
    if (skipLabel && onSkip) {
      const skip = el('button', { className: 'secondary-btn', text: skipLabel });
      skip.addEventListener('click', () => {
        cleanup();
        onSkip();
        resolve(null);
      });
      footer.appendChild(skip);
    }
    const cancel = el('button', { className: 'secondary-btn', text: cancelLabel });
    cancel.addEventListener('click', () => {
      cleanup();
      resolve(null);
    });
    footer.appendChild(cancel);
    modal.appendChild(footer);

    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);

    // Store previously focused element for restoration
    const previouslyFocused = document.activeElement as HTMLElement;

    // Set up focus trap
    const cleanupFocusTrap = trapFocus(modal);

    const keyHandler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        cleanup();
        resolve(null);
      }
    };

    const cleanup = () => {
      document.removeEventListener('keydown', keyHandler);
      cleanupFocusTrap();
      backdrop.classList.remove('modal-visible');
      window.setTimeout(() => {
        backdrop.remove();
        restoreFocus(previouslyFocused);
      }, 200);
    };

    backdrop.addEventListener('click', event => {
      if (event.target === backdrop) {
        cleanup();
        resolve(null);
      }
    });

    document.addEventListener('keydown', keyHandler);
    requestAnimationFrame(() => backdrop.classList.add('modal-visible'));
  });
}

export function showSimpleModal({
  title,
  body,
  onClose,
}: {
  title: string;
  body: Node;
  onClose?: () => void;
}): void {
  const backdrop = el('div', { className: 'modal-backdrop modal-visible' });
  const modal = el('div', { className: 'modal' });
  modal.appendChild(el('div', { className: 'modal-header', text: title }));
  const content = el('div', { className: 'modal-body' });
  content.appendChild(body);
  modal.appendChild(content);
  const footer = el('div', { className: 'modal-footer' });
  const closeBtn = el('button', { className: 'secondary-btn', text: 'Close' });
  closeBtn.addEventListener('click', () => cleanup());
  footer.appendChild(closeBtn);
  modal.appendChild(footer);
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  // Store previously focused element for restoration
  const previouslyFocused = document.activeElement as HTMLElement;

  // Set up focus trap
  const cleanupFocusTrap = trapFocus(modal);

  const cleanup = () => {
    backdrop.classList.remove('modal-visible');
    window.setTimeout(() => {
      backdrop.remove();
      restoreFocus(previouslyFocused);
      onClose?.();
    }, 200);
    cleanupFocusTrap();
  };

  const handleKey = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      cleanup();
    }
  };

  backdrop.addEventListener('click', event => {
    if (event.target === backdrop) cleanup();
  });
  document.addEventListener('keydown', handleKey);
}
