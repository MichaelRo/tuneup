// Core DOM manipulation utilities
// WHY: Centralized DOM primitives for consistent element creation and rendering

const DEFAULT_ROOT_ID = 'app-root';

export function ensureRoot(root?: Element | null): HTMLElement {
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

export type SpinnerSize = 'small' | 'medium' | 'large';

export function spinner(size: SpinnerSize = 'small'): HTMLDivElement {
  return el('div', { className: `spinner spinner-${size}` });
}
