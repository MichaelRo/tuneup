import { http, HttpResponse } from 'msw';

import type { Artist } from '../spotify/types';

const API_BASE = 'https://api.spotify.com/v1';

const MOCK_ARTIST_1_ID = '0I6DIrNWgQgdSPC3Hsa3jH'; // Yoel Lerner
const MOCK_ARTIST_2_ID = '4vGrte8FDu062Ntj0RsPiZ'; // Polyphia

const mockArtistsList: Artist[] = [
      {
        "external_urls": {
          "spotify": "https://open.spotify.com/artist/0I6DIrNWgQgdSPC3Hsa3jH"
        },
        "followers": {
          "href": null,
          "total": 986
        },
        "genres": [
          "children's music",
          "mizrahi"
        ],
        "href": "https://api.spotify.com/v1/artists/0I6DIrNWgQgdSPC3Hsa3jH",
        "id": "0I6DIrNWgQgdSPC3Hsa3jH",
        "images": [
          {
            "url": "https://i.scdn.co/image/ab67616d0000b2734426462707dc72ff7846f240",
            "height": 640,
            "width": 640
          },
          {
            "url": "https://i.scdn.co/image/ab67616d00001e02d678a68a2ece41735e5c373b",
            "height": 300,
            "width": 300
          },
          {
            "url": "https://i.scdn.co/image/ab67616d000048514426462707dc72ff7846f240",
            "height": 64,
            "width": 64
          }
        ],
        "name": "Yoel Lerner",
        "popularity": 27,
        "type": "artist",
        "uri": "spotify:artist:0I6DIrNWgQgdSPC3Hsa3jH"
      },
      {
        "external_urls": {
          "spotify": "https://open.spotify.com/artist/4vGrte8FDu062Ntj0RsPiZ"
        },
        "followers": {
          "href": null,
          "total": 1334036
        },
        "genres": [
          "math rock",
          "djent",
          "progressive metal",
          "progressive rock"
        ],
        "href": "https://api.spotify.com/v1/artists/4vGrte8FDu062Ntj0RsPiZ",
        "id": "4vGrte8FDu062Ntj0RsPiZ",
        "images": [
          {
            "url": "https://i.scdn.co/image/ab6761610000e5ebd0d5560f6b2ebe39a6d20704",
            "height": 640,
            "width": 640
          },
          {
            "url": "https://i.scdn.co/image/ab67616100005174d0d5560f6b2ebe39a6d20704",
            "height": 320,
            "width": 320
          },
          {
            "url": "https://i.scdn.co/image/ab6761610000f178d0d5560f6b2ebe39a6d20704",
            "height": 160,
            "width": 160
          }
        ],
        "name": "Polyphia",
        "popularity": 58,
        "type": "artist",
        "uri": "spotify:artist:4vGrte8FDu062Ntj0RsPiZ"
      }
];

const mockArtists: Record<string, Artist> = mockArtistsList.reduce((acc: Record<string, Artist>, artist) => {
    acc[artist.id] = artist;
    return acc;
}, {});


const mockTracks = [
  {
      "added_at": "2025-10-11T12:13:53Z",
      "track": {
        "album": {
          "album_type": "album",
          "artists": [
            {
              "external_urls": {
                "spotify": "https://open.spotify.com/artist/2aaLAng2L2aWD2FClzwiep"
              },
              "href": "https://api.spotify.com/v1/artists/2aaLAng2L2aWD2FClzwiep",
              "id": "2aaLAng2L2aWD2FClzwiep",
              "name": "Dream Theater",
              "type": "artist",
              "uri": "spotify:artist:2aaLAng2L2aWD2FClzwiep"
            }
          ],
          "external_urls": {
            "spotify": "https://open.spotify.com/album/7kTJmAiaDC5IF8iIYJ6cS0"
          },
          "href": "https://api.spotify.com/v1/albums/7kTJmAiaDC5IF8iIYJ6cS0",
          "id": "7kTJmAiaDC5IF8iIYJ6cS0",
          "images": [
            {
              "height": 640,
              "width": 640,
              "url": "https://i.scdn.co/image/ab67616d0000b2739e4ac1cbfc2b03d5eee64e4e"
            }
          ],
          "name": "Octavarium",
          "release_date": "2005",
          "release_date_precision": "year",
          "total_tracks": 8,
          "type": "album",
          "uri": "spotify:album:7kTJmAiaDC5IF8iIYJ6cS0"
        },
        "artists": [
          {
            "external_urls": {
              "spotify": "https://open.spotify.com/artist/2aaLAng2L2aWD2FClzwiep"
            },
            "href": "https://api.spotify.com/v1/artists/2aaLAng2L2aWD2FClzwiep",
            "id": "2aaLAng2L2aWD2FClzwiep",
            "name": "Dream Theater",
            "type": "artist",
            "uri": "spotify:artist:2aaLAng2L2aWD2FClzwiep"
          }
        ],
        "disc_number": 1,
        "duration_ms": 493506,
        "explicit": false,
        "external_ids": {
          "isrc": "USEE10900730"
        },
        "external_urls": {
          "spotify": "https://open.spotify.com/track/1Wjv9DU0smGPmUXrzDEezL"
        },
        "href": "https://api.spotify.com/v1/tracks/1Wjv9DU0smGPmUXrzDEezL",
        "id": "1Wjv9DU0smGPmUXrzDEezL",
        "is_local": false,
        "name": "Panic Attack - 2009 Remaster",
        "popularity": 52,
        "preview_url": null,
        "track_number": 5,
        "type": "track",
        "uri": "spotify:track:1Wjv9DU0smGPmUXrzDEezL"
      }
    }
];

const mockAlbums = [
    {
      "added_at": "2024-10-20T23:05:40Z",
      "album": {
        "album_type": "single",
        "total_tracks": 1,
        "external_urls": {
          "spotify": "https://open.spotify.com/album/4E9AWmsV9POjfg28Mz393X"
        },
        "href": "https://api.spotify.com/v1/albums/4E9AWmsV9POjfg28Mz393X",
        "id": "4E9AWmsV9POjfg28Mz393X",
        "images": [
          {
            "url": "https://i.scdn.co/image/ab67616d0000b27364365df1679063e7cca15bd0",
            "height": 640,
            "width": 640
          }
        ],
        "name": "Breathe Underwater",
        "release_date": "2024-10-21",
        "release_date_precision": "day",
        "type": "album",
        "uri": "spotify:album:4E9AWmsV9POjfg28Mz393X",
        "artists": [
          {
            "external_urls": {
              "spotify": "https://open.spotify.com/artist/6AJiVMljdDi2Z1GF43m60q"
            },
            "href": "https://api.spotify.com/v1/artists/6AJiVMljdDi2Z1GF43m60q",
            "id": "6AJiVMljdDi2Z1GF43m60q",
            "name": "Psy Trance Mafia",
            "type": "artist",
            "uri": "spotify:artist:6AJiVMljdDi2Z1GF43m60q"
          },
          {
            "external_urls": {
              "spotify": "https://open.spotify.com/artist/6S2tas4z6DyIklBajDqJxI"
            },
            "href": "https://api.spotify.com/v1/artists/6S2tas4z6DyIklBajDqJxI",
            "id": "6S2tas4z6DyIklBajDqJxI",
            "name": "Infected Mushroom",
            "type": "artist",
            "uri": "spotify:artist:6S2tas4z6DyIklBajDqJxI"
          }
        ]
      }
    }
];

export const handlers = [
  // Mock: Get Current User's Followed Artists
  http.get(`${API_BASE}/me/following`, ({ request }) => {
    const url = new URL(request.url);
    if (url.searchParams.get('type') !== 'artist') return;

    return HttpResponse.json({
      artists: {
        items: mockArtistsList,
        next: null,
      },
    });
  }),

  // Mock: Check if User Follows Artists
  http.get(`${API_BASE}/me/following/contains`, ({ request }) => {
    const url = new URL(request.url);
    const ids = url.searchParams.get('ids')?.split(',') ?? [];
    const results = ids.map((id: string) => id === MOCK_ARTIST_1_ID || id === MOCK_ARTIST_2_ID);
    return HttpResponse.json(results);
  }),

  // Mock: Get User's Saved Tracks
  http.get(`${API_BASE}/me/tracks`, () => {
    return HttpResponse.json({
      items: mockTracks,
      next: null,
      total: mockTracks.length,
    });
  }),

  // Mock: Get User's Saved Albums
  http.get(`${API_BASE}/me/albums`, () => {
    return HttpResponse.json({
      items: mockAlbums,
      next: null,
      total: mockAlbums.length,
    });
  }),

  // Mock: Get Several Artists
  http.get(`${API_BASE}/artists`, ({ request }) => {
    const url = new URL(request.url);
    const ids = url.searchParams.get('ids')?.split(',') ?? [];
    const artists = ids.map((id: string) => mockArtists[id]).filter(Boolean);
    return HttpResponse.json({ artists });
  }),

  // Mock: Get Several Albums (for enrichment)
  http.get(`${API_BASE}/albums`, ({ request }) => {
    const url = new URL(request.url);
    const ids = url.searchParams.get('ids')?.split(',') ?? [];
    const albums = ids.map((id: string) => mockAlbums.find(a => a.album.id === id)?.album).filter(Boolean);
    return HttpResponse.json({ albums });
  }),

  // Mock: Search for an item
  http.get(`${API_BASE}/search`, ({ request }) => {
    const url = new URL(request.url);
    const query = url.searchParams.get('q');
    const type = url.searchParams.get('type');

    if (type === 'artist') {
      const results = Object.values(mockArtists).filter(artist =>
        artist.name.toLowerCase().includes(query?.toLowerCase() ?? ''),
      );
      return HttpResponse.json({ artists: { items: results } });
    }
    return HttpResponse.json({ artists: { items: [] } });
  }),

  // Mock mutation endpoints to succeed without error
  http.delete(`${API_BASE}/me/following`, () => new Response(null, { status: 204 })),
  http.delete(`${API_BASE}/me/tracks`, () => new Response(null, { status: 204 })),
  http.delete(`${API_BASE}/me/albums`, () => new Response(null, { status: 204 })),
];