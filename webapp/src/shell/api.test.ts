/**
 * Tests for the API transform functions.
 * These are pure functions that convert snake_case API responses to camelCase domain types.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need to test the transform functions, but they're not exported.
// We'll test them through the public API functions by mocking fetch.

// Re-create the transform logic inline for direct testing of the transformation contracts
// This ensures our domain types match what we expect from the API

interface RawShow {
  id: number;
  imdb_id: string;
  title: string;
  year_start: number | null;
  year_end: number | null;
}

interface RawWriter {
  id: number;
  imdb_id: string;
  name: string;
  image_url?: string | null;
  bio?: string | null;
  show_count?: number;
}

interface RawLink {
  show_id: number;
  writer_id: number;
  role: string | null;
  episode_count: number | null;
}

interface RawPaginationInfo {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
  search?: string | null;
}

// Import types to verify our transforms produce correct shapes
import type { Show, Writer, ShowWriterLink, PaginationInfo } from '../core/types';

// Transform functions (mirroring api.ts implementation for contract verification)
const transformShow = (raw: RawShow): Show => ({
  id: raw.id,
  imdbId: raw.imdb_id,
  title: raw.title,
  yearStart: raw.year_start,
  yearEnd: raw.year_end,
});

const transformWriter = (raw: RawWriter): Writer => ({
  id: raw.id,
  imdbId: raw.imdb_id,
  name: raw.name,
  imageUrl: raw.image_url,
  bio: raw.bio,
  showCount: raw.show_count,
});

const transformLink = (raw: RawLink): ShowWriterLink => ({
  showId: raw.show_id,
  writerId: raw.writer_id,
  role: raw.role,
  episodeCount: raw.episode_count,
});

const transformPagination = (raw: RawPaginationInfo): PaginationInfo => ({
  page: raw.page,
  perPage: raw.per_page,
  total: raw.total,
  totalPages: raw.total_pages,
  hasNext: raw.has_next,
  hasPrev: raw.has_prev,
  search: raw.search,
});

describe('transformShow', () => {
  it('transforms snake_case to camelCase', () => {
    const raw: RawShow = {
      id: 1,
      imdb_id: 'tt1234567',
      title: 'Breaking Bad',
      year_start: 2008,
      year_end: 2013,
    };

    const result = transformShow(raw);

    expect(result).toEqual({
      id: 1,
      imdbId: 'tt1234567',
      title: 'Breaking Bad',
      yearStart: 2008,
      yearEnd: 2013,
    });
  });

  it('preserves null values for year fields', () => {
    const raw: RawShow = {
      id: 2,
      imdb_id: 'tt9999999',
      title: 'Ongoing Show',
      year_start: 2020,
      year_end: null,
    };

    const result = transformShow(raw);

    expect(result.yearStart).toBe(2020);
    expect(result.yearEnd).toBeNull();
  });

  it('handles both year fields as null', () => {
    const raw: RawShow = {
      id: 3,
      imdb_id: 'tt0000001',
      title: 'Unknown Dates',
      year_start: null,
      year_end: null,
    };

    const result = transformShow(raw);

    expect(result.yearStart).toBeNull();
    expect(result.yearEnd).toBeNull();
  });

  it('preserves special characters in title', () => {
    const raw: RawShow = {
      id: 4,
      imdb_id: 'tt5555555',
      title: "The Writer's Room: Season 1 (2024)",
      year_start: 2024,
      year_end: null,
    };

    const result = transformShow(raw);

    expect(result.title).toBe("The Writer's Room: Season 1 (2024)");
  });
});

describe('transformWriter', () => {
  it('transforms snake_case to camelCase', () => {
    const raw: RawWriter = {
      id: 1,
      imdb_id: 'nm1234567',
      name: 'Vince Gilligan',
      image_url: 'https://example.com/vince.jpg',
      bio: 'Creator of Breaking Bad',
      show_count: 5,
    };

    const result = transformWriter(raw);

    expect(result).toEqual({
      id: 1,
      imdbId: 'nm1234567',
      name: 'Vince Gilligan',
      imageUrl: 'https://example.com/vince.jpg',
      bio: 'Creator of Breaking Bad',
      showCount: 5,
    });
  });

  it('handles optional fields as undefined', () => {
    const raw: RawWriter = {
      id: 2,
      imdb_id: 'nm9999999',
      name: 'Unknown Writer',
    };

    const result = transformWriter(raw);

    expect(result.id).toBe(2);
    expect(result.name).toBe('Unknown Writer');
    expect(result.imageUrl).toBeUndefined();
    expect(result.bio).toBeUndefined();
    expect(result.showCount).toBeUndefined();
  });

  it('handles optional fields as null', () => {
    const raw: RawWriter = {
      id: 3,
      imdb_id: 'nm8888888',
      name: 'Partial Writer',
      image_url: null,
      bio: null,
      show_count: 0,
    };

    const result = transformWriter(raw);

    expect(result.imageUrl).toBeNull();
    expect(result.bio).toBeNull();
    expect(result.showCount).toBe(0);
  });

  it('preserves special characters in name', () => {
    const raw: RawWriter = {
      id: 4,
      imdb_id: 'nm7777777',
      name: "José García O'Brien Jr.",
    };

    const result = transformWriter(raw);

    expect(result.name).toBe("José García O'Brien Jr.");
  });
});

describe('transformLink', () => {
  it('transforms snake_case to camelCase', () => {
    const raw: RawLink = {
      show_id: 1,
      writer_id: 2,
      role: 'creator',
      episode_count: 62,
    };

    const result = transformLink(raw);

    expect(result).toEqual({
      showId: 1,
      writerId: 2,
      role: 'creator',
      episodeCount: 62,
    });
  });

  it('handles null role and episode_count', () => {
    const raw: RawLink = {
      show_id: 5,
      writer_id: 10,
      role: null,
      episode_count: null,
    };

    const result = transformLink(raw);

    expect(result.role).toBeNull();
    expect(result.episodeCount).toBeNull();
  });

  it('handles zero episode count', () => {
    const raw: RawLink = {
      show_id: 1,
      writer_id: 1,
      role: 'consultant',
      episode_count: 0,
    };

    const result = transformLink(raw);

    expect(result.episodeCount).toBe(0);
  });

  it('preserves various role types', () => {
    const roles = ['creator', 'writer', 'head writer', 'staff writer', 'story editor'];

    roles.forEach((role, index) => {
      const raw: RawLink = {
        show_id: index + 1,
        writer_id: index + 1,
        role,
        episode_count: 10,
      };

      expect(transformLink(raw).role).toBe(role);
    });
  });
});

describe('transformPagination', () => {
  it('transforms snake_case to camelCase', () => {
    const raw: RawPaginationInfo = {
      page: 2,
      per_page: 10,
      total: 150,
      total_pages: 15,
      has_next: true,
      has_prev: true,
      search: 'vince',
    };

    const result = transformPagination(raw);

    expect(result).toEqual({
      page: 2,
      perPage: 10,
      total: 150,
      totalPages: 15,
      hasNext: true,
      hasPrev: true,
      search: 'vince',
    });
  });

  it('handles first page state', () => {
    const raw: RawPaginationInfo = {
      page: 1,
      per_page: 10,
      total: 100,
      total_pages: 10,
      has_next: true,
      has_prev: false,
    };

    const result = transformPagination(raw);

    expect(result.hasNext).toBe(true);
    expect(result.hasPrev).toBe(false);
    expect(result.search).toBeUndefined();
  });

  it('handles last page state', () => {
    const raw: RawPaginationInfo = {
      page: 10,
      per_page: 10,
      total: 100,
      total_pages: 10,
      has_next: false,
      has_prev: true,
    };

    const result = transformPagination(raw);

    expect(result.hasNext).toBe(false);
    expect(result.hasPrev).toBe(true);
  });

  it('handles single page state', () => {
    const raw: RawPaginationInfo = {
      page: 1,
      per_page: 10,
      total: 5,
      total_pages: 1,
      has_next: false,
      has_prev: false,
    };

    const result = transformPagination(raw);

    expect(result.hasNext).toBe(false);
    expect(result.hasPrev).toBe(false);
    expect(result.totalPages).toBe(1);
  });

  it('handles empty results', () => {
    const raw: RawPaginationInfo = {
      page: 1,
      per_page: 10,
      total: 0,
      total_pages: 0,
      has_next: false,
      has_prev: false,
      search: 'nonexistent',
    };

    const result = transformPagination(raw);

    expect(result.total).toBe(0);
    expect(result.totalPages).toBe(0);
    expect(result.search).toBe('nonexistent');
  });

  it('handles null search', () => {
    const raw: RawPaginationInfo = {
      page: 1,
      per_page: 10,
      total: 50,
      total_pages: 5,
      has_next: true,
      has_prev: false,
      search: null,
    };

    const result = transformPagination(raw);

    expect(result.search).toBeNull();
  });
});

describe('batch transformations', () => {
  it('transforms array of shows correctly', () => {
    const rawShows: RawShow[] = [
      { id: 1, imdb_id: 'tt001', title: 'Show A', year_start: 2000, year_end: 2005 },
      { id: 2, imdb_id: 'tt002', title: 'Show B', year_start: 2010, year_end: null },
    ];

    const results = rawShows.map(transformShow);

    expect(results).toHaveLength(2);
    expect(results[0].imdbId).toBe('tt001');
    expect(results[1].yearEnd).toBeNull();
  });

  it('transforms array of writers correctly', () => {
    const rawWriters: RawWriter[] = [
      { id: 1, imdb_id: 'nm001', name: 'Writer A' },
      { id: 2, imdb_id: 'nm002', name: 'Writer B', show_count: 10 },
    ];

    const results = rawWriters.map(transformWriter);

    expect(results).toHaveLength(2);
    expect(results[0].showCount).toBeUndefined();
    expect(results[1].showCount).toBe(10);
  });

  it('transforms array of links correctly', () => {
    const rawLinks: RawLink[] = [
      { show_id: 1, writer_id: 1, role: 'creator', episode_count: 50 },
      { show_id: 1, writer_id: 2, role: null, episode_count: null },
    ];

    const results = rawLinks.map(transformLink);

    expect(results).toHaveLength(2);
    expect(results[0].episodeCount).toBe(50);
    expect(results[1].role).toBeNull();
  });

  it('handles empty arrays', () => {
    expect([].map(transformShow)).toEqual([]);
    expect([].map(transformWriter)).toEqual([]);
    expect([].map(transformLink)).toEqual([]);
  });
});

// Integration test with mocked fetch
describe('API integration', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    global.fetch = originalFetch;
  });

  it('fetchAllData transforms complete API response', async () => {
    const mockResponse = {
      shows: [{ id: 1, imdb_id: 'tt001', title: 'Test Show', year_start: 2020, year_end: null }],
      writers: [{ id: 1, imdb_id: 'nm001', name: 'Test Writer', image_url: null, bio: null }],
      links: [{ show_id: 1, writer_id: 1, role: 'creator', episode_count: 10 }],
    };

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response);

    const { fetchAllData } = await import('./api');
    const result = await fetchAllData();

    expect(result.shows[0]).toEqual({
      id: 1,
      imdbId: 'tt001',
      title: 'Test Show',
      yearStart: 2020,
      yearEnd: null,
    });
    expect(result.writers[0].imdbId).toBe('nm001');
    expect(result.links[0].showId).toBe(1);
  });

  it('fetchAllData throws on API error', async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 500,
      statusText: 'Internal Server Error',
    } as Response);

    const { fetchAllData } = await import('./api');

    await expect(fetchAllData()).rejects.toThrow('API error: 500 Internal Server Error');
  });

  it('fetchPaginatedWriters builds correct URL with search', async () => {
    const mockResponse = {
      writers: [],
      pagination: {
        page: 1,
        per_page: 10,
        total: 0,
        total_pages: 0,
        has_next: false,
        has_prev: false,
        search: 'test query',
      },
    };

    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    } as Response);

    const { fetchPaginatedWriters } = await import('./api');
    await fetchPaginatedWriters(1, 10, 'test query');

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('search=test%20query')
    );
  });
});
