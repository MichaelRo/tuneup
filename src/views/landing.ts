import { HAS_SINGLE_LIST, curatedLists, FIRST_STEP_HASH, STEP_ROUTES } from '../app/config';
import { state, isConnected, getArtistCount, getLabelCount, handleLogout } from '../app/state';
import { t, formatNumber } from '../lib/i18n';
import { beginAuthFlow, meFollowingArtists, meLikedTracks, meSavedAlbums } from '../spotify';
import { el } from '../ui';

import { createMetricCard } from './components';
import { buildShell } from './shell';

function buildAuthStatusControls(options: { compact?: boolean } = {}): HTMLElement {
  const wrapper = el('div', {
    className: `auth-status${options.compact ? ' is-compact' : ''}`,
  });
  wrapper.appendChild(el('span', { className: 'auth-chip', text: t('cta_connected') }));
  const actions = el('div', { className: 'auth-status-actions' });
  const reconnectBtn = el('button', {
    className: 'ghost-btn',
    text: t('cta_switch_account'),
    attrs: { 'data-action': 'connect' },
  }) as HTMLButtonElement;
  reconnectBtn.addEventListener('click', event => {
    event.preventDefault();
    void beginAuthFlow();
  });
  const logoutBtn = el('button', {
    className: 'ghost-btn',
    text: t('cta_disconnect'),
    attrs: { 'data-action': 'disconnect' },
  }) as HTMLButtonElement;
  logoutBtn.addEventListener('click', event => {
    event.preventDefault();
    handleLogout();
  });
  actions.appendChild(reconnectBtn);
  actions.appendChild(logoutBtn);
  wrapper.appendChild(actions);
  return wrapper;
}

export function renderLanding(): Node {
  const main = el('div');

  const hero = el('section', { className: 'hero-banner' });
  const heroStack = el('div', { className: 'header-stack' });
  heroStack.appendChild(el('h1', { text: t('hero_title') }));
  heroStack.appendChild(el('p', { text: t('hero_sub') }));
  if (HAS_SINGLE_LIST && curatedLists[0]) {
    heroStack.appendChild(
      el('p', {
        text: `${curatedLists[0].title} · ${curatedLists[0].description ?? 'Live petition roster'}`,
        className: 'muted',
      }),
    );
  }
  const badges = el('div', { className: 'list-badges' });
  [t('pill_transparent'), t('pill_secure'), t('pill_control')].forEach((text: string) => {
    badges.appendChild(el('span', { className: 'badge', text }));
  });
  heroStack.appendChild(badges);
  hero.appendChild(heroStack);

  const heroActions = el('div', { className: 'hero-actions' });
  if (!isConnected()) {
    const connectBtn = el('button', {
      className: 'primary-btn',
      attrs: { 'data-action': 'connect' },
      text: t('cta_connect'),
    });
    heroActions.appendChild(connectBtn);
  } else {
    heroActions.appendChild(buildAuthStatusControls());
    heroActions.appendChild(
      el('a', {
        className: 'primary-btn',
        attrs: { href: FIRST_STEP_HASH },
        text: t('cta_open_tool'),
      }),
    );
  }

  const githubLink = el('a', {
    className: 'secondary-btn',
    attrs: {
      href: 'https://github.com/your-org/tuneup',
      'data-action': 'github',
      target: '_blank',
      rel: 'noopener',
    },
    text: t('cta_github'),
  });
  heroActions.appendChild(githubLink);
  hero.appendChild(heroActions);

  const heroHighlight = el('div', { className: 'hero-highlight' });
  heroHighlight.appendChild(el('p', { text: t('preview_intro') }));
  const metrics = el('div', { className: 'metric-row' });
  metrics.appendChild(createMetricCard(t('metric_steps'), String(STEP_ROUTES.length)));

  if (state.sourceList) {
    metrics.appendChild(
      createMetricCard(t('metric_artists'), formatNumber(getArtistCount(state.sourceList))),
    );
    metrics.appendChild(
      createMetricCard(t('metric_labels'), formatNumber(getLabelCount(state.sourceList))),
    );
  } else {
    metrics.appendChild(createMetricCard(t('metric_artists'), '100+'));
    metrics.appendChild(createMetricCard(t('metric_labels'), '10+'));
  }
  heroHighlight.appendChild(metrics);
  hero.appendChild(heroHighlight);

  main.appendChild(hero);

  const capabilityCard = el('section', { className: 'surface-card' });
  capabilityCard.appendChild(el('h2', { text: t('does_title') }));
  capabilityCard.appendChild(el('p', { text: t('does_list') }));
  main.appendChild(capabilityCard);

  const sourcesCard = el('section', { className: 'surface-card' });
  sourcesCard.appendChild(el('h2', { text: t('list_title') }));
  sourcesCard.appendChild(el('p', { text: t('list_body') }));
  main.appendChild(sourcesCard);

  const faqCard = el('section', { className: 'surface-card' });
  faqCard.appendChild(el('h2', { text: t('faq_title') }));
  const faqList = el('ul');
  [t('faq_why'), t('faq_undo'), t('faq_affil')].forEach((text: string) => {
    faqList.appendChild(el('li', { text }));
  });
  faqCard.appendChild(faqList);
  main.appendChild(faqCard);

  const footer = el('section', { className: 'surface-card' });
  footer.appendChild(el('p', { text: t('footer_legal_1') }));
  footer.appendChild(el('p', { text: t('footer_legal_2') }));
  footer.appendChild(el('p', { text: t('footer_legal_3') }));
  main.appendChild(footer);

  // Smart preloading on the landing page for a faster subsequent experience.
  if (isConnected()) {
    void meFollowingArtists();
    void meLikedTracks();
    void meSavedAlbums();
  }

  return buildShell(main, { activeHash: '#/', title: t('stepper_title'), subtitle: t('banner') });
}
