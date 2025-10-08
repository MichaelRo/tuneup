import { HAS_SINGLE_LIST, FIRST_STEP_HASH } from './app/config';
import { initRouting, navigate, renderRoute, handleRouteActions } from './app/routing';
import { setConnected } from './app/state';
import { initI18n, onLangChange } from './lib/i18n';
import { handleAuthCallback } from './lib/spotify';
import { showToast } from './lib/ui';
import './styles/global.css';
import type { ToastType } from './types/ui';

// Accessibility: Add ARIA live region for toasts if not present
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

// Patch showToast to update ARIA live region
const originalShowToast = showToast;
function showToastWithAria(message: string, tone: ToastType = 'info') {
  ensureToastLiveRegion();
  const toastRegion = document.getElementById('toast-live-region');
  if (toastRegion) toastRegion.textContent = message;
  return originalShowToast(message, tone);
}
// Replace showToast globally
window.showToast = showToastWithAria;

async function init(): Promise<void> {
  initI18n();
  initRouting();

  try {
    const result = await handleAuthCallback();
    if (result?.ok) {
      setConnected(true);
      if (!HAS_SINGLE_LIST) {
        if (location.hash !== FIRST_STEP_HASH) navigate(FIRST_STEP_HASH);
      }
    }
  } catch (err) {
    console.error('Auth callback failed', err);
    showToastWithAria('Could not complete Spotify connection.', 'error');
  }
  renderRoute();
  window.addEventListener('hashchange', renderRoute);
  window.addEventListener('click', handleRouteActions);
  onLangChange(() => renderRoute());
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    void init();
  });
} else {
  void init();
}
