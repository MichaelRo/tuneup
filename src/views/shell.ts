import { ROUTE_DEFAULT, STEP_ROUTES, type WizardRoute } from '../app/config.js';
import { navigate, renderRoute } from '../app/routing.js';
import { isConnected } from '../app/state.js';
import { getLang, bindLanguageToggles, t } from '../lib/i18n.js';
import { beginAuthFlow, clearToken, invalidateSpotifyCaches } from '../lib/spotify.js';
import { el } from '../lib/ui.js';

function languageToggleNode(): HTMLElement {
  const current = getLang();
  const container = el('div', {
    className: 'language-toggle',
    attrs: { 'data-component': 'lang-switch' },
  });
  const enBtn = el('button', {
    attrs: { type: 'button', 'data-lang': 'en' },
    text: 'EN',
  });
  if (current === 'en') enBtn.classList.add('is-active');
  const heBtn = el('button', {
    attrs: { type: 'button', 'data-lang': 'he' },
    text: 'HE',
  });
  if (current === 'he') heBtn.classList.add('is-active');
  container.appendChild(enBtn);
  container.appendChild(heBtn);
  return container;
}

function buildAuthStatusControls(options: { compact?: boolean } = {}): HTMLElement {
  const wrapper = el('div', {
    className: `auth-status${options.compact ? ' is-compact' : ''}`,
  });
  wrapper.appendChild(el('span', { className: 'auth-chip', text: 'Connected to Spotify' }));
  const actions = el('div', { className: 'auth-status-actions' });
  const reconnectBtn = el('button', {
    className: 'ghost-btn',
    text: 'Switch account',
  }) as HTMLButtonElement;
  reconnectBtn.addEventListener('click', event => {
    event.preventDefault();
    void beginAuthFlow();
  });
  const logoutBtn = el('button', {
    className: 'ghost-btn',
    text: 'Disconnect',
  }) as HTMLButtonElement;
  logoutBtn.addEventListener('click', event => {
    event.preventDefault();
    clearToken();
    invalidateSpotifyCaches();
    renderRoute();
  });
  actions.appendChild(reconnectBtn);
  actions.appendChild(logoutBtn);
  wrapper.appendChild(actions);
  return wrapper;
}

function buildShellHeader(title: string, subtitle?: string): HTMLElement {
  const header = el('header', { className: 'shell-header' });
  const stack = el('div', { className: 'header-stack' });
  stack.appendChild(el('h1', { text: title }));
  if (subtitle) {
    stack.appendChild(el('p', { text: subtitle }));
  }
  header.appendChild(stack);

  const actions = el('div', { className: 'header-actions' });
  if (isConnected()) {
    actions.appendChild(buildAuthStatusControls({ compact: true }));
  }
  actions.appendChild(languageToggleNode());
  bindLanguageToggles(actions);
  header.appendChild(actions);
  return header;
}

function buildSidebar(activeHash: WizardRoute): HTMLElement {
  const sidebar = el('aside', { className: 'shell-sidebar' });
  const logoStack = el('div', { className: 'header-stack' });
  logoStack.appendChild(el('h2', { text: t('wizard_title') }));
  logoStack.appendChild(el('p', { text: t('wizard_intro') }));
  sidebar.appendChild(logoStack);

  const stepper = el('nav', { className: 'stepper' });
  STEP_ROUTES.forEach(({ hash, key }, index) => {
    const item = el('a', {
      className: `stepper-item${hash === activeHash ? ' is-active' : ''}`,
      attrs: { href: hash },
    });
    item.appendChild(el('span', { className: 'stepper-index', text: String(index + 1) }));
    const textBlock = el('div', { className: 'header-stack' });
    textBlock.appendChild(el('strong', { text: t(key) }));
    item.appendChild(textBlock);
    stepper.appendChild(item);
  });
  sidebar.appendChild(stepper);
  return sidebar;
}

function buildBottomNav(activeHash: WizardRoute): HTMLElement {
  const nav = el('nav', { className: 'bottom-nav' });
  STEP_ROUTES.forEach(({ hash }) => {
    const button = el('button', { attrs: { type: 'button', 'data-nav': hash } });
    if (hash === activeHash) button.classList.add('is-active');
    button.addEventListener('click', () => navigate(hash));
    nav.appendChild(button);
  });
  return nav;
}

export function buildShell(
  mainContent: HTMLElement,
  options: { activeHash?: WizardRoute; title: string; subtitle?: string },
): HTMLElement {
  const shell = el('div', { className: 'app-shell' });
  if (options.activeHash && options.activeHash !== ROUTE_DEFAULT) {
    shell.appendChild(buildSidebar(options.activeHash));
  }
  const contentWrap = el('main', { className: 'shell-content' });
  contentWrap.appendChild(buildShellHeader(options.title, options.subtitle));
  contentWrap.appendChild(mainContent);
  shell.appendChild(contentWrap);
  if (options.activeHash && options.activeHash !== ROUTE_DEFAULT) {
    shell.appendChild(buildBottomNav(options.activeHash));
  }
  return shell;
}
