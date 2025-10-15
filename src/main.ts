import { HAS_SINGLE_LIST, FIRST_STEP_HASH } from './app/config';
import { initRouting, navigate, renderRoute, handleRouteActions } from './app/routing';
import { isConnected, setConnected } from './app/state';
import { handleAuthCallback, hasToken } from './auth/index.js';
import { initI18n, onLangChange, t } from './lib/i18n.js';
import './styles/global.css';
import type { ToastType } from './types/ui';
import { showToast } from './ui';

const ensureToastLiveRegion = () => {
  if (document.getElementById('toast-live-region')) return;
  const region = document.createElement('div');
  region.id = 'toast-live-region';
  region.setAttribute('aria-live', 'assertive');
  region.setAttribute('aria-atomic', 'true');
  region.style.cssText =
    'position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0, 0, 0, 0); border: 0;';
  document.body.appendChild(region);
};

const originalShowToast = showToast;
function showToastWithAria(message: string, tone: ToastType = 'info') {
  ensureToastLiveRegion();
  const toastRegion = document.getElementById('toast-live-region');
  if (toastRegion) toastRegion.textContent = message;
  return originalShowToast(message, tone);
}
window.showToast = showToastWithAria;

// Global error boundary
function showErrorUI(error: Error, isUnhandledRejection = false) {
  const root = document.getElementById('app-root');
  if (!root) return;

  root.innerHTML = `
    <div style="padding: 2rem; text-align: center; font-family: system-ui, sans-serif;">
      <h1 style="color: #dc2626; margin-bottom: 1rem;">Something went wrong</h1>
      <p style="margin-bottom: 1.5rem; color: #6b7280;">
        ${isUnhandledRejection ? 'An unexpected error occurred.' : 'The application encountered an error.'}
      </p>
      ${
        import.meta.env.DEV
          ? `
            <details style="margin-bottom: 1.5rem; text-align: left; max-width: 600px; margin-left: auto; margin-right: auto;">
              <summary style="cursor: pointer; color: #374151;">Technical details</summary>
              <pre style="background: #f3f4f6; padding: 1rem; border-radius: 0.5rem; overflow: auto; font-size: 0.875rem; margin-top: 0.5rem;">${
                error.stack || error.message
              }</pre>
            </details>`
          : ''
      }
      <button onclick="location.reload()" style="background: #3b82f6; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 0.5rem; cursor: pointer; font-size: 1rem;">
        Reload Page
      </button>
    </div>
  `;
}

window.addEventListener('error', event => {
  console.error('Global error:', event.error);
  showErrorUI(event.error || new Error(event.message));
});

window.addEventListener('unhandledrejection', event => {
  console.error('Unhandled promise rejection:', event.reason);
  showErrorUI(event.reason instanceof Error ? event.reason : new Error(String(event.reason)), true);
});

function enableMocking() {
  // The environment variable is a string, so we need to compare it to 'true'
  if (import.meta.env.DEV && import.meta.env.VITE_MSW_ENABLED === 'true') {
    // The `worker.start()` call is not awaited to avoid blocking the app's startup.
    // The service worker will be ready to intercept requests in the background.
    import('./mocks/browser').then(({ worker }) => worker.start({ onUnhandledRequest: 'bypass' }));
  }
}

async function init(): Promise<void> {
  await initI18n();

  // Set HTML lang attribute based on current locale
  const { getLang } = await import('./lib/i18n');
  document.documentElement.lang = getLang();

  initRouting();

  if (hasToken() && !isConnected()) {
    setConnected(true);
  }

  try {
    const result = await handleAuthCallback();
    if (result?.ok) {
      setConnected(true);
      if (!HAS_SINGLE_LIST) {
        if (location.hash === '#/' || location.hash === '') {
          navigate(FIRST_STEP_HASH);
        }
      }
    }
  } catch (err) {
    console.error('Auth callback failed', err);
    showToastWithAria(t('error_auth_connect'), 'error');
  }
  void renderRoute();
  window.addEventListener('hashchange', () => renderRoute());
  window.addEventListener('click', handleRouteActions);
  onLangChange(() => renderRoute());
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', async () => {
    enableMocking();
    await init();
  });
} else {
  enableMocking();
  void init();
}
