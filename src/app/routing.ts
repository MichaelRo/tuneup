import { beginAuthFlow } from '../auth';
import { bindLanguageToggles } from '../lib/i18n';
import { render, renderNode } from '../ui';
import { renderApplyStep } from '../views/apply.js';
import { renderLanding } from '../views/landing.js';
import { renderPreviewStep } from '../views/preview.js';
import { renderReportStep } from '../views/report.js';
import { renderResolveStep } from '../views/resolve.js';
import { renderSettings } from '../views/settings.js';
import { renderSourceStep } from '../views/source.js';

import { ALL_ROUTES, type AppRoute, ROUTE_DEFAULT } from './config.js';
import { handleLogout, isConnected } from './state.js';

const rootElement = document.getElementById('app-root');
if (!(rootElement instanceof HTMLElement)) {
  throw new Error('Missing #app-root container');
}
const root: HTMLElement = rootElement;

const routeHandlers = new Map<AppRoute, () => string | Node | Promise<Node>>();

export function initRouting(): void {
  routeHandlers.set(ROUTE_DEFAULT, renderLanding);
  routeHandlers.set('#/app', renderSourceStep);
  routeHandlers.set('#/resolve', renderResolveStep);
  routeHandlers.set('#/preview', renderPreviewStep);
  routeHandlers.set('#/apply', renderApplyStep);
  routeHandlers.set('#/report', renderReportStep);
  routeHandlers.set('#/settings', renderSettings);
}

function normalizeHash(raw: string): AppRoute {
  if (!raw || raw === '#') return ROUTE_DEFAULT;
  const candidate = raw as AppRoute;
  return ALL_ROUTES.includes(candidate) ? candidate : ROUTE_DEFAULT;
}

export function navigate(hash: AppRoute): void {
  if (location.hash === hash) {
    renderRoute();
  } else {
    location.hash = hash;
  }
}

export async function renderRoute(): Promise<void> {
  const hash = normalizeHash(location.hash);

  const renderer = routeHandlers.get(hash) ?? routeHandlers.get(ROUTE_DEFAULT);
  if (!renderer) return;

  const output = await renderer();
  if (output instanceof Node) {
    renderNode(output, root);
  } else {
    render(output, root);
  }
  bindLanguageToggles(root);

  const connectBtn = root.querySelector<HTMLButtonElement>('[data-action="connect"]');
  if (connectBtn && !isConnected()) {
    connectBtn.addEventListener('click', event => {
      event.preventDefault();
      void beginAuthFlow();
    });
  }
}

export function handleRouteActions(event: MouseEvent): void {
  const target = event.target as HTMLElement;

  const anchor = target.closest('a');
  if (anchor && anchor.getAttribute('href')?.startsWith('#')) {
    event.preventDefault();
    navigate(anchor.getAttribute('href') as `#${string}`);
    return;
  }

  const actionButton = target.closest<HTMLButtonElement>('[data-action]');
  if (actionButton?.dataset.action === 'connect') {
    void beginAuthFlow();
  } else if (actionButton?.dataset.action === 'disconnect') {
    handleLogout();
  }
}
