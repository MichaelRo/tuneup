import { bindLanguageToggles } from '../lib/i18n';
import { beginAuthFlow } from '../lib/spotify';
import { render, renderNode } from '../lib/ui';
import { renderApplyStep } from '../views/apply';
import { renderLanding } from '../views/landing';
import { renderPreviewStep } from '../views/preview';
import { renderReportStep } from '../views/report';
import { renderResolveStep } from '../views/resolve';
import { renderSourceStep } from '../views/source';

import { ALL_ROUTES, type AppRoute, ROUTE_DEFAULT } from './config';
import { handleLogout, isConnected } from './state';

const rootElement = document.getElementById('app-root');
if (!(rootElement instanceof HTMLElement)) {
  throw new Error('Missing #app-root container');
}
const root: HTMLElement = rootElement;

const routeHandlers = new Map<AppRoute, () => string | Node>();

export function initRouting(): void {
  routeHandlers.set(ROUTE_DEFAULT, renderLanding);
  routeHandlers.set('#/app', renderSourceStep);
  routeHandlers.set('#/resolve', renderResolveStep);
  routeHandlers.set('#/preview', renderPreviewStep);
  routeHandlers.set('#/apply', renderApplyStep);
  routeHandlers.set('#/report', renderReportStep);
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

export function renderRoute(): void {
  const hash = normalizeHash(location.hash);
  const renderer = routeHandlers.get(hash) ?? routeHandlers.get(ROUTE_DEFAULT);
  if (!renderer) return;

  const output = renderer();
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
