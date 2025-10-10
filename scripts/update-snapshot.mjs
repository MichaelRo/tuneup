import fs from 'fs/promises';
import path from 'path';

const NMG_PROXY_URL = 'https://r.jina.ai/https://nomusicforgenocide.org/page-3-full-list';
const SNAPSHOT_PATH = path.resolve(process.cwd(), 'src/data/nmg-snapshot.json');

// --- Helper functions replicated from providers.ts for a Node.js environment ---

function cleanDisplayName(name) {
  return name.replace(/\s+/g, ' ').trim();
}

function splitMarkdownList(section) {
  return section
    .split(/\r?\n/)
    .map(line => line.replace(/[-`*]+/g, ' ').trim())
    .flatMap(line => line.split('·'))
    .map(name => cleanDisplayName(name))
    .filter(Boolean);
}

function parseNmgMarkdown(raw) {
  let content = raw;
  const marker = 'Markdown Content:';
  const markerIdx = raw.indexOf(marker);
  if (markerIdx >= 0) {
    content = raw.slice(markerIdx + marker.length).trim();
  }
  content = content.replace(/^`+|`+$/g, '').trim();

  const artistMatch = content.match(/ARTIST BOYCOTTERS[\s-]*([\s\S]*?)\n\nLABEL BOYCOTTERS/i);
  const labelMatch = content.match(/LABEL BOYCOTTERS[\s-]*([\s\S]*)$/i);

  const artists = artistMatch ? splitMarkdownList(artistMatch[1] ?? '') : [];
  const labels = labelMatch ? splitMarkdownList(labelMatch[1] ?? '') : [];

  const items = [
    ...artists.map(name => ({ type: 'artist', name })),
    ...labels.map(name => ({ type: 'label', name })),
  ];

  return {
    provider: 'curated',
    title: 'No Music For Genocide (Snapshot)',
    version: new Date().toISOString().slice(0, 10),
    sourceUrl: 'https://nomusicforgenocide.org/page-3-full-list',
    items,
  };
}

async function updateSnapshot() {
  console.log('Attempting to update NMG artist list snapshot...');
  try {
    const response = await fetch(NMG_PROXY_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch from proxy: ${response.status}`);
    }
    const text = await response.text();
    const artistList = parseNmgMarkdown(text);

    if (artistList.items.length < 10) {
      throw new Error(
        `Parsed list has too few items (${artistList.items.length}), skipping update.`,
      );
    }

    const jsonContent = JSON.stringify(artistList, null, 2);
    await fs.writeFile(SNAPSHOT_PATH, jsonContent, 'utf-8');
    console.log(
      `Successfully updated snapshot with ${artistList.items.length} items. Version: ${artistList.version}`,
    );
  } catch (err) {
    console.error('Failed to update snapshot. Using existing version.', err);
    // We intentionally don't re-throw the error, so the build can proceed with the old snapshot.
  }
}

updateSnapshot();
