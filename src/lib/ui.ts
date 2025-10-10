import type { ToastType } from '../types/ui.ts';

const DEFAULT_ROOT_ID = 'app-root';

let toastContainer: HTMLDivElement | null = null;

function ensureRoot(root?: Element | null): HTMLElement {
  const node = (root || document.getElementById(DEFAULT_ROOT_ID)) as HTMLElement | null;
  if (!node) {
    throw new Error(`Missing root element #${DEFAULT_ROOT_ID}`);
  }
  return node;
}

export function clear(root?: Element | null): void {
  ensureRoot(root).innerHTML = '';
}

export function render(html: string, root?: Element | null): void {
  ensureRoot(root).innerHTML = html;
}

export function renderNode(node: Node, root?: Element | null): void {
  const target = ensureRoot(root);
  target.innerHTML = '';
  target.appendChild(node);
}

export type ElementOptions = {
  className?: string;
  text?: string;
  attrs?: Record<string, string>;
  on?: Record<string, EventListener>;
  children?: Array<Node | string>;
};

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: ElementOptions = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text) node.textContent = options.text;
  if (options.attrs) {
    Object.entries(options.attrs).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        node.setAttribute(key, value);
      }
    });
  }
  if (options.on) {
    Object.entries(options.on).forEach(([eventName, handler]) => {
      if (handler) node.addEventListener(eventName, handler);
    });
  }
  if (options.children) {
    options.children.forEach(child => {
      if (typeof child === 'string') {
        node.appendChild(document.createTextNode(child));
      } else {
        node.appendChild(child);
      }
    });
  }
  return node;
}

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

export function setLoading(target: HTMLButtonElement | null, isLoading: boolean): void {
  if (!target) return;
  if (isLoading) {
    target.classList.add('is-loading');
    target.disabled = true;
  } else {
    target.classList.remove('is-loading');
    target.disabled = false;
  }
}

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
    choices.forEach((choice, index) => {
      const button = el('button', {
        className: 'modal-choice',
      });
      if (typeof choice.label === 'string') {
        button.appendChild(
          el('span', {
            className: 'modal-choice-label',
            text: choice.label || `Option ${index + 1}`,
          }),
        );
      } else {
        button.appendChild(choice.label);
      }
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

    const keyHandler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        cleanup();
        resolve(null);
      }
    };

    const cleanup = () => {
      document.removeEventListener('keydown', keyHandler);
      backdrop.classList.remove('modal-visible');
      window.setTimeout(() => backdrop.remove(), 200);
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

  const cleanup = () => {
    backdrop.classList.remove('modal-visible');
    window.setTimeout(() => backdrop.remove(), 200);
    onClose?.();
    document.removeEventListener('keydown', handleKey);
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

export type SpinnerSize = 'small' | 'medium' | 'large';

export function spinner(size: SpinnerSize = 'small'): HTMLDivElement {
  return el('div', { className: `spinner spinner-${size}` });
}
