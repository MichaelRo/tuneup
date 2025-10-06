import { describe, expect, it } from 'vitest';

import { loadFromPaste } from '../lib/providers.js';

describe('providers', () => {
  it('parses paste input with labels and artists', async () => {
    const input = 'Artist One\nLabel: Example Records\nartist: another artist';
    const list = await loadFromPaste(input);
    expect(list.items).toHaveLength(3);
    const labels = list.items.filter(item => item.type === 'label');
    expect(labels).toHaveLength(1);
    expect(labels[0]?.name).toBe('Example Records');
  });

  it('deduplicates paste entries', async () => {
    const input = 'Artist One\nartist: Artist One\nARTIST: artist one';
    const list = await loadFromPaste(input);
    expect(list.items.filter(item => item.type === 'artist')).toHaveLength(1);
  });
});
