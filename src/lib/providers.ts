import curatedManifest from '../data/curated-lists.json' with { type: 'json' };
import nmgSnapshot from '../data/nmg-snapshot.json' with { type: 'json' };
import type { ArtistList, CuratedListConfig, Item, ProviderId } from '../types/index.js';

import { formatNumber } from './i18n.js';

const NMG_LIVE_URL = 'https://nomusicforgenocide.org/page-3-full-list';
const NMG_PROXY_URL = 'https://r.jina.ai/https://nomusicforgenocide.org/page-3-full-list';

const curatedListConfigs: CuratedListConfig[] = curatedManifest as CuratedListConfig[];

function coerceProviderId(value: unknown, fallback: ProviderId = 'curated'): ProviderId {
  if (value === 'nmg') return 'nmg';
  return fallback;
}

function metaProviderOverride(source: string): ProviderId {
  if (source === 'nmg') return 'nmg';
  return 'curated';
}

export function getCuratedLists(): CuratedListConfig[] {
  return curatedListConfigs;
}

function cleanDisplayName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}

function normalizeName(name: string): string {
  return cleanDisplayName(name).toLowerCase();
}

function dedupeItems(items: Item[]): Item[] {
  const seen = new Set<string>();
  const result: Item[] = [];
  items.forEach(item => {
    if (!item?.name) return;
    const key = `${item.type}:${normalizeName(item.name)}`;
    if (seen.has(key)) return;
    seen.add(key);
    result.push({
      type: item.type,
      name: cleanDisplayName(item.name),
      spotifyId: item.spotifyId,
    });
  });
  return result;
}

function createList(meta: Partial<ArtistList>, items: Item[]): ArtistList {
  const snapshot: ArtistList = {
    provider: meta.provider ?? 'curated',
    title: meta.title ?? 'Custom List',
    version: meta.version ?? new Date().toISOString().slice(0, 10),
    updatedAt: meta.updatedAt,
    sourceUrl: meta.sourceUrl,
    items: dedupeItems(items),
  };
  return snapshot;
}

function normalizeItemFromValue(value: unknown): Item | null {
  if (!value) return null;
  if (typeof value === 'string') {
    return { type: 'artist', name: value };
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const type = record.type === 'label' ? 'label' : 'artist';
    const name = (record.name ?? record.title) as string | undefined;
    if (!name) return null;
    const spotifyId = (record.spotifyId ?? record.id) as string | undefined;
    return { type, name, spotifyId };
  }
  return null;
}

function parseCsvToRows(text: string): string[][] {
  const rows: string[][] = [];
  let current = '';
  const cells: string[] = [];
  let inQuotes = false;

  const pushCell = () => {
    cells.push(current.trim());
    current = '';
  };

  const pushRow = () => {
    pushCell();
    rows.push([...cells]);
    cells.length = 0;
  };

  const input = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (char === '"') {
      if (inQuotes && input[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === ',' && !inQuotes) {
      pushCell();
      continue;
    }
    if ((char === '\n' || char === '\r') && !inQuotes) {
      if (cells.length || current.trim()) {
        pushRow();
      } else {
        current = '';
      }
      if (char === '\r' && input[i + 1] === '\n') {
        i += 1;
      }
      continue;
    }
    current += char;
  }
  if (cells.length || current.trim()) {
    pushCell();
    rows.push([...cells]);
  }

  return rows.map(row => row.map(cell => cell.trim())).filter(row => row.some(cell => cell.length));
}

function mapRowToItem(cells: string[], columns: string[] | null): Item | null {
  if (!cells.length) return null;
  if (columns) {
    const record: Record<string, string> = {};
    columns.forEach((column, index) => {
      record[column.toLowerCase()] = cells[index] ?? '';
    });
    const type = record.type === 'label' ? 'label' : 'artist';
    const name = record.name ?? record.title ?? record.artist;
    if (!name) return null;
    const spotifyId = record.spotifyid ?? record.spotify_id ?? record.id;
    return { type, name, spotifyId: spotifyId ?? '' };
  }
  if (cells.length === 1) {
    return { type: 'artist', name: cells[0] ?? '' };
  }
  if (cells.length >= 2) {
    const type = cells[0]?.toLowerCase?.() === 'label' ? 'label' : 'artist';
    const name = cells[1] ?? '';
    const spotifyId = cells[2] ?? '';
    return { type, name, spotifyId };
  }
  return null;
}

function parseCsv(text: string, meta: Partial<ArtistList> = {}): ArtistList {
  const rows = parseCsvToRows(text);
  if (!rows.length) return createList(meta, []);
  const header = rows[0] ?? [];
  const hasHeader = header.some(cell =>
    ['type', 'name', 'spotifyid', 'spotify_id'].includes(cell?.toLowerCase?.() ?? ''),
  );
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const items = dataRows
    .map(row => mapRowToItem(row, hasHeader ? header : null))
    .filter((item): item is Item => Boolean(item));
  return createList(meta, items);
}

function parseListFromJson(text: string, meta: Partial<ArtistList> = {}): ArtistList {
  const payload = JSON.parse(text);
  if (Array.isArray(payload)) {
    const items = payload
      .map(value => normalizeItemFromValue(value))
      .filter((item: Item | null): item is Item => Boolean(item));
    return createList(meta, items);
  }
  if (payload && typeof payload === 'object') {
    if (Array.isArray(payload.items)) {
      const items = payload.items
        .map((value: unknown) => normalizeItemFromValue(value))
        .filter((item: Item | null): item is Item => Boolean(item));
      return createList(
        {
          provider: coerceProviderId(payload.provider, meta.provider ?? 'curated'),
          title: (payload.title as string) ?? meta.title ?? 'Custom List',
          version: (payload.version as string) ?? meta.version,
          updatedAt: (payload.updatedAt as string) ?? meta.updatedAt,
          sourceUrl: (payload.sourceUrl as string) ?? meta.sourceUrl,
        },
        items,
      );
    }
    const inferred = Object.entries(payload as Record<string, unknown>).flatMap(
      ([type, values]) => {
        if (!Array.isArray(values)) return [] as Item[];
        return values
          .map(value => normalizeItemFromValue({ type, name: value }))
          .filter((item: Item | null): item is Item => Boolean(item));
      },
    );
    return createList(meta, inferred);
  }
  throw new Error('Unsupported JSON list format');
}

function parsePlainText(text: string, meta: Partial<ArtistList> = {}): ArtistList {
  const items: Item[] = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const parts = line.split(':');
      if (parts.length >= 2) {
        const prefix = parts.shift()?.trim().toLowerCase();
        const name = parts.join(':').trim();
        if (prefix === 'label' || prefix === 'l') {
          return { type: 'label', name } as Item;
        }
        if (prefix === 'artist' || prefix === 'a') {
          return { type: 'artist', name } as Item;
        }
      }
      return { type: 'artist', name: line } as Item;
    });
  return createList(meta, items);
}

function parseNmgHtml(html: string, meta: Partial<ArtistList>): ArtistList {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const artistNames = new Set<string>();
  const labelNames = new Set<string>();

  const bodyText = doc.querySelector('body')?.textContent ?? '';
  if (!doc.querySelector('h1, h2, h3') && /ARTIST BOYCOTTERS/i.test(bodyText)) {
    return parseNmgMarkdown(html, meta);
  }

  const headings = Array.from(doc.querySelectorAll('h1, h2, h3'));
  headings.forEach(heading => {
    const textContent = heading.textContent?.toLowerCase() ?? '';
    let collector: Set<string> | null = null;
    if (textContent.includes('label')) {
      collector = labelNames;
    } else if (
      textContent.includes('artist') ||
      textContent.includes('band') ||
      textContent.includes('musician')
    ) {
      collector = artistNames;
    }
    if (!collector) return;

    let node: Element | null = heading.nextElementSibling;
    while (node && !['H1', 'H2', 'H3'].includes(node.tagName)) {
      collectNamesFromNode(node, collector);
      node = node.nextElementSibling;
    }
  });

  if (!artistNames.size && !labelNames.size) {
    doc.querySelectorAll('[data-target-name]').forEach(el => {
      const type = el.closest('[data-target-type]')?.getAttribute('data-target-type');
      const name = cleanDisplayName(el.textContent ?? '');
      if (!name) return;
      if (type === 'label') labelNames.add(name);
      else artistNames.add(name);
    });
  }

  const version =
    doc.querySelector('[data-version]')?.getAttribute('data-version') ??
    doc.querySelector('time')?.getAttribute('datetime') ??
    new Date().toISOString().slice(0, 10);

  const items: Item[] = [
    ...Array.from(artistNames).map(name => ({ type: 'artist', name }) as Item),
    ...Array.from(labelNames).map(name => ({ type: 'label', name }) as Item),
  ];

  return createList({ ...meta, version }, items);
}

function collectNamesFromNode(node: Element, collector: Set<string>): void {
  if (node.matches('ul,ol')) {
    node.querySelectorAll('li').forEach(li => {
      const name = cleanDisplayName(li.textContent ?? '');
      if (name) collector.add(name);
    });
    return;
  }

  if (node.matches('table')) {
    node.querySelectorAll('tr').forEach(row => {
      const cells = Array.from(row.cells)
        .map(cell => cleanDisplayName(cell.textContent ?? ''))
        .filter(Boolean);
      if (cells.length) collector.add(cells[0] ?? '');
    });
    return;
  }

  if (node.matches('p, div, section, article')) {
    const text = node.textContent ?? '';
    text
      .split(/[,\n]/)
      .map(part => cleanDisplayName(part))
      .filter(Boolean)
      .forEach(name => collector.add(name));
    node.querySelectorAll('a, strong, em, span').forEach(el => {
      const name = cleanDisplayName(el.textContent ?? '');
      if (name) collector.add(name);
    });
  }
}

function parseNmgMarkdown(raw: string, meta: Partial<ArtistList>): ArtistList {
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

  return createList(
    {
      provider: 'nmg',
      title: meta.title ?? 'No Music For Genocide',
      version: meta.version ?? new Date().toISOString().slice(0, 10),
      sourceUrl: meta.sourceUrl ?? NMG_LIVE_URL,
    },
    [
      ...artists.map(name => ({ type: 'artist', name }) as Item),
      ...labels.map(name => ({ type: 'label', name }) as Item),
    ],
  );
}

function splitMarkdownList(section: string): string[] {
  return section
    .split(/\r?\n/)
    .map(line => line.replace(/[-`]+/g, ' ').trim())
    .flatMap(line => line.split('·'))
    .map(name => cleanDisplayName(name))
    .filter(Boolean);
}

async function fetchNmgFromProxy(): Promise<ArtistList> {
  const response = await fetch(NMG_PROXY_URL, { mode: 'cors' });
  if (!response.ok) {
    throw new Error(`NMG proxy fetch failed: ${response.status}`);
  }
  const html = await response.text();
  return parseNmgHtml(html, {
    provider: 'nmg',
    title: 'No Music For Genocide',
    sourceUrl: NMG_LIVE_URL,
  });
}

async function loadCuratedJson(config: CuratedListConfig): Promise<ArtistList> {
  const response = await fetch(config.url!, { mode: 'cors' });
  if (!response.ok) {
    throw new Error(`Curated JSON fetch failed (${config.id}): ${response.status}`);
  }
  const text = await response.text();
  return parseListFromJson(text, {
    provider: 'curated',
    title: config.title,
    version: config.version,
    sourceUrl: config.url,
  });
}

async function fetchNmgLive(): Promise<ArtistList> {
  const response = await fetch(NMG_LIVE_URL, { mode: 'cors' });
  if (!response.ok) {
    throw new Error(`NMG live fetch failed: ${response.status}`);
  }
  const html = await response.text();
  return parseNmgHtml(html, {
    provider: 'nmg',
    title: 'No Music For Genocide',
    sourceUrl: NMG_LIVE_URL,
  });
}

export async function loadNmgList(): Promise<ArtistList> {
  try {
    const proxyHtml = await fetchNmgFromProxy();
    if (proxyHtml.items.length > 1) return proxyHtml;
  } catch (err) {
    console.warn('Unable to load NMG proxy list', err);
  }
  try {
    const liveHtml = await fetchNmgLive();
    if (liveHtml.items.length > 1) return liveHtml;
  } catch (err) {
    console.warn('Unable to load live NMG list', err);
  }
  return nmgSnapshot as ArtistList; // Fallback to the bundled snapshot
}

export async function loadCuratedList(listId: string): Promise<ArtistList> {
  const config = curatedListConfigs.find(list => list.id === listId);
  if (!config) {
    throw new Error(`Unknown curated list: ${listId}`);
  }
  switch (config.kind) {
    case 'nmg':
      return loadNmgList();
    case 'json':
      if (!config.url) {
        throw new Error(`Curated list ${config.id} missing url`);
      }
      return loadCuratedJson(config);
    default:
      throw new Error(`Unsupported curated list kind: ${config.kind}`);
  }
}

export async function loadFromUrl(url: string): Promise<ArtistList> {
  const response = await fetch(url, { mode: 'cors' });
  if (!response.ok) {
    throw new Error(`Unable to fetch ${url}: ${response.status}`);
  }
  const text = await response.text();
  const contentType = response.headers.get('content-type') ?? '';
  const meta: Partial<ArtistList> = {
    provider: metaProviderOverride('url'),
    title: url,
    sourceUrl: url,
  };
  if (
    contentType.includes('application/json') ||
    text.trim().startsWith('{') ||
    text.trim().startsWith('[')
  ) {
    return parseListFromJson(text, meta);
  }
  if (contentType.includes('text/csv') || url.endsWith('.csv')) {
    return parseCsv(text, meta);
  }
  return parsePlainText(text, meta);
}

export async function loadFromFile(file: File): Promise<ArtistList> {
  const text = await file.text();
  const meta: Partial<ArtistList> = {
    provider: metaProviderOverride('file'),
    title: file.name,
    sourceUrl: file.name,
  };
  if (
    file.type === 'application/json' ||
    file.name.endsWith('.json') ||
    text.trim().startsWith('{')
  ) {
    return parseListFromJson(text, meta);
  }
  if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
    return parseCsv(text, meta);
  }
  return parsePlainText(text, meta);
}

export async function loadFromPaste(text: string): Promise<ArtistList> {
  const trimmed = text.trim();
  const meta: Partial<ArtistList> = {
    provider: metaProviderOverride('paste'),
    title: `Paste (${formatNumber(trimmed.length)} chars)`,
  };
  if (!trimmed) return createList(meta, []);
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return parseListFromJson(trimmed, meta);
    } catch (err) {
      console.warn('Paste JSON parse failed, falling back to text', err);
    }
  }
  if (trimmed.includes(',') && trimmed.includes('\n')) {
    try {
      return parseCsv(trimmed, meta);
    } catch (err) {
      console.warn('Paste CSV parse failed, falling back to text', err);
    }
  }
  return parsePlainText(trimmed, meta);
}
