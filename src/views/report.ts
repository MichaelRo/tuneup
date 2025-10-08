import { navigate } from '../app/routing.js';
import { state } from '../app/state.js';
import { t, getLang } from '../lib/i18n.js';
import { exportJson, exportCsv } from '../lib/report.js';
import { el } from '../lib/ui.js';
import type { Plan } from '../types/index.js';

import { buildShell } from './shell.js';

function buildCsvRows(): Array<Record<string, string>> {
  if (!state.plan) return [];
  const rows: Array<Record<string, string>> = [];

  // #TODO: Decide which is better
  state.plan.evidence?.forEach(item => {
    rows.push({
      kind: item.kind,
      id: item.id,
      title: item.title,
      label: item.label ?? '',
      year: item.year ? String(item.year) : '',
      generatedAt: state.planGeneratedAt ?? '',
    });
  });
  if (!rows.length) {
    rows.push({
      kind: 'summary',
      id: '-',
      title: 'No evidence recorded',
      label: '',
      year: '',
      generatedAt: state.planGeneratedAt ?? '',
    });
  }

  // const artistLookup = new Map(state.resolvedArtists.map(a => [a.id, a]));

  // state.plan.artistsToUnfollow.forEach(artistId => {
  //   const artist = artistLookup.get(artistId);
  //   rows.push({
  //     type: 'unfollowed_artist',
  //     id: artistId,
  //     name: artist?.name ?? artistId,
  //     source_name: artist?.input ?? artist?.name ?? artistId,
  //   });
  // });

  // state.plan.tracksToRemove.forEach(track => {
  //   rows.push({
  //     type: 'removed_track',
  //     id: track.id,
  //     name: track.name ?? track.id,
  //     artists: track.artistNames.join('; '),
  //   });
  // });

  // state.plan.albumsToRemove.forEach(album => {
  //   rows.push({
  //     type: 'removed_album',
  //     id: album.id,
  //     name: album.name ?? album.id,
  //     artists: album.artistNames.join('; '),
  //   });
  // });

  return rows;
}

function createReportContent(): HTMLElement {
  if (!state.plan) {
    throw new Error('Plan is required before rendering report content');
  }
  const container = el('div', { className: 'glass-card step step-report' });
  container.appendChild(el('h2', { text: t('step_report_title') }));
  container.appendChild(el('p', { text: t('report_intro') }));

  const metaList = el('ul', { className: 'report-meta' });
  if (state.sourceList?.title) {
    metaList.appendChild(el('li', { text: `Source: ${state.sourceList.title}` }));
  }
  // TODO: Do I need it back?
  metaList.appendChild(el('li', { text: `Provider: ${state.sourceList?.provider ?? 'custom'}` }));
  if (state.sourceList?.version) {
    metaList.appendChild(el('li', { text: `Version: ${state.sourceList.version}` }));
  }
  if (state.planGeneratedAt) {
    metaList.appendChild(
      el('li', { text: `Generated: ${new Date(state.planGeneratedAt).toLocaleString()}` }),
    );
  }
  container.appendChild(metaList);

  const actions = el('div', { className: 'report-actions' });
  const jsonBtn = el('button', { className: 'primary-btn', text: t('report_json_btn') });
  jsonBtn.addEventListener('click', () => {
    exportJson(state.plan as Plan, state.planMeta.before, state.planMeta.after, {
      provider: state.sourceList?.provider ?? 'custom',
      version: state.sourceList?.version ?? 'n/a',
      lang: getLang(),
    });
  });
  actions.appendChild(jsonBtn);

  const csvBtn = el('button', { className: 'secondary-btn', text: t('report_csv_btn') });
  csvBtn.addEventListener('click', () => exportCsv(buildCsvRows()));
  actions.appendChild(csvBtn);

  const restartBtn = el('button', { className: 'secondary-btn', text: t('report_restart_btn') });
  restartBtn.addEventListener('click', () => navigate('#/'));
  actions.appendChild(restartBtn);

  container.appendChild(actions);
  return container;
}

export function renderReportStep(): Node {
  if (!state.plan) {
    navigate('#/dryrun');
    return document.createDocumentFragment();
  }
  const content = createReportContent();
  return buildShell(content, { activeHash: '#/report', title: t('wizard_title') });
}
