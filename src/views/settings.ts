import { el } from '../ui';

import { buildToggle } from './components.js';
import { buildShell } from './shell.js';

export function renderSettings(): Node {
  const container = el('div', { className: 'glass-card step step-settings' });
  container.appendChild(el('h2', { text: 'Settings' }));

  const settingsGrid = el('div', { className: 'settings-grid' });

  // Strict Primary Artist Matching
  const strictPrimaryToggle = buildToggle('strictPrimary', 'Strict primary artist matching');
  settingsGrid.appendChild(strictPrimaryToggle);

  // Include Albums from Other Artists
  const includeAlbumsToggle = buildToggle('includeAlbums', 'Include albums from other artists');
  settingsGrid.appendChild(includeAlbumsToggle);

  // Include Full Label Cleanup
  const includeLabelCleanupToggle = buildToggle('includeLabelCleanup', 'Include full label cleanup');
  settingsGrid.appendChild(includeLabelCleanupToggle);

  // Show Persistent Rate-Limit Banner (Dev Only)
  const rateLimitToggle = buildToggle('showRateLimitBanner', 'Show persistent rate-limit banner');
  if (import.meta.env.PROD) {
    const input = rateLimitToggle.querySelector('input');
    if (input) {
        input.disabled = true;
    }
    const badge = el('span', { className: 'dev-only-badge', text: 'DEV' });
    badge.style.marginLeft = '8px';
    badge.style.padding = '2px 6px';
    badge.style.borderRadius = '4px';
    badge.style.backgroundColor = '#888';
    badge.style.color = '#fff';
    badge.style.fontSize = '10px';
    badge.style.fontWeight = 'bold';
    rateLimitToggle.querySelector('span')?.appendChild(badge);
  }
  settingsGrid.appendChild(rateLimitToggle);

  container.appendChild(settingsGrid);

  const actions = el('div', { className: 'settings-actions' });
  const backBtn = el('button', { className: 'secondary-btn', text: 'Back' });
  backBtn.addEventListener('click', () => {
      history.back();
  });
  actions.appendChild(backBtn);
  container.appendChild(actions);

  const style = el('style', {
      text: `
        .settings-grid {
            display: grid;
            gap: var(--space-3);
        }
        .settings-actions {
            margin-top: var(--space-4);
        }
      `
  });
  container.appendChild(style);

  return buildShell(container, { activeHash: '#/settings', title: 'Settings' });
}
