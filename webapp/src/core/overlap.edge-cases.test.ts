/**
 * Edge case tests for overlap functions.
 *
 * These tests cover boundary conditions, unusual inputs, and stress scenarios
 * that might not be covered by the main test suite.
 */

import { describe, it, expect } from 'vitest';
import type { Show, Writer, ShowWriterLink, ShowWithWriters, WriterWithShows } from './types';
import {
  groupLinksByWriter,
  groupLinksByShow,
  findOverlappingWriters,
  enrichWritersWithShows,
  enrichShowsWithWriters,
  countSharedWriters,
  getSharedWriters,
  createOverlapMatrix,
} from './overlap';

describe('groupLinksByWriter edge cases', () => {
  it('handles empty links array', () => {
    const grouped = groupLinksByWriter([]);
    expect(grouped.size).toBe(0);
  });

  it('handles single link', () => {
    const links: ShowWriterLink[] = [
      { showId: 1, writerId: 1, role: 'creator', episodeCount: 10 },
    ];

    const grouped = groupLinksByWriter(links);

    expect(grouped.size).toBe(1);
    expect(grouped.get(1)).toHaveLength(1);
  });

  it('handles multiple links for same writer', () => {
    const links: ShowWriterLink[] = [
      { showId: 1, writerId: 1, role: 'creator', episodeCount: 10 },
      { showId: 2, writerId: 1, role: 'writer', episodeCount: 5 },
      { showId: 3, writerId: 1, role: 'writer', episodeCount: 3 },
    ];

    const grouped = groupLinksByWriter(links);

    expect(grouped.size).toBe(1);
    expect(grouped.get(1)).toHaveLength(3);
  });

  it('handles duplicate links (same show-writer pair)', () => {
    const links: ShowWriterLink[] = [
      { showId: 1, writerId: 1, role: 'creator', episodeCount: 10 },
      { showId: 1, writerId: 1, role: 'writer', episodeCount: 5 },
    ];

    const grouped = groupLinksByWriter(links);

    // Both links are preserved
    expect(grouped.get(1)).toHaveLength(2);
  });

  it('handles links with all null optional fields', () => {
    const links: ShowWriterLink[] = [
      { showId: 1, writerId: 1, role: null, episodeCount: null },
    ];

    const grouped = groupLinksByWriter(links);

    expect(grouped.get(1)).toHaveLength(1);
    expect(grouped.get(1)?.[0].role).toBeNull();
    expect(grouped.get(1)?.[0].episodeCount).toBeNull();
  });

  it('handles writer ID of 0', () => {
    const links: ShowWriterLink[] = [
      { showId: 1, writerId: 0, role: 'creator', episodeCount: 10 },
    ];

    const grouped = groupLinksByWriter(links);

    expect(grouped.size).toBe(1);
    expect(grouped.get(0)).toHaveLength(1);
  });

  it('handles very large writer IDs', () => {
    const links: ShowWriterLink[] = [
      { showId: 1, writerId: Number.MAX_SAFE_INTEGER, role: 'creator', episodeCount: 10 },
    ];

    const grouped = groupLinksByWriter(links);

    expect(grouped.get(Number.MAX_SAFE_INTEGER)).toHaveLength(1);
  });
});

describe('groupLinksByShow edge cases', () => {
  it('handles empty links array', () => {
    const grouped = groupLinksByShow([]);
    expect(grouped.size).toBe(0);
  });

  it('handles single link', () => {
    const links: ShowWriterLink[] = [
      { showId: 1, writerId: 1, role: 'creator', episodeCount: 10 },
    ];

    const grouped = groupLinksByShow(links);

    expect(grouped.size).toBe(1);
    expect(grouped.get(1)).toHaveLength(1);
  });

  it('handles multiple writers for same show', () => {
    const links: ShowWriterLink[] = [
      { showId: 1, writerId: 1, role: 'creator', episodeCount: 10 },
      { showId: 1, writerId: 2, role: 'writer', episodeCount: 5 },
      { showId: 1, writerId: 3, role: 'writer', episodeCount: 3 },
    ];

    const grouped = groupLinksByShow(links);

    expect(grouped.size).toBe(1);
    expect(grouped.get(1)).toHaveLength(3);
  });

  it('handles show ID of 0', () => {
    const links: ShowWriterLink[] = [
      { showId: 0, writerId: 1, role: 'creator', episodeCount: 10 },
    ];

    const grouped = groupLinksByShow(links);

    expect(grouped.size).toBe(1);
    expect(grouped.get(0)).toHaveLength(1);
  });
});

describe('findOverlappingWriters edge cases', () => {
  it('returns empty array for empty inputs', () => {
    const overlaps = findOverlappingWriters([], [], []);
    expect(overlaps).toEqual([]);
  });

  it('returns empty array when no links exist', () => {
    const writers: Writer[] = [{ id: 1, imdbId: 'nm001', name: 'Writer 1' }];
    const shows: Show[] = [{ id: 1, imdbId: 'tt001', title: 'Show 1', yearStart: 2000, yearEnd: 2005 }];

    const overlaps = findOverlappingWriters(writers, shows, []);
    expect(overlaps).toEqual([]);
  });

  it('returns empty array when writer only works on one show', () => {
    const writers: Writer[] = [{ id: 1, imdbId: 'nm001', name: 'Single Show Writer' }];
    const shows: Show[] = [
      { id: 1, imdbId: 'tt001', title: 'Show 1', yearStart: 2000, yearEnd: 2005 },
      { id: 2, imdbId: 'tt002', title: 'Show 2', yearStart: 2010, yearEnd: 2015 },
    ];
    const links: ShowWriterLink[] = [
      { showId: 1, writerId: 1, role: 'creator', episodeCount: 10 },
    ];

    const overlaps = findOverlappingWriters(writers, shows, links);
    expect(overlaps).toEqual([]);
  });

  it('handles duplicate links to same show (counts unique shows only)', () => {
    const writers: Writer[] = [{ id: 1, imdbId: 'nm001', name: 'Writer' }];
    const shows: Show[] = [
      { id: 1, imdbId: 'tt001', title: 'Show 1', yearStart: 2000, yearEnd: 2005 },
    ];
    const links: ShowWriterLink[] = [
      { showId: 1, writerId: 1, role: 'creator', episodeCount: 10 },
      { showId: 1, writerId: 1, role: 'writer', episodeCount: 5 },
    ];

    const overlaps = findOverlappingWriters(writers, shows, links);

    // Should NOT count as overlap - it's still just 1 unique show
    expect(overlaps).toEqual([]);
  });

  it('handles links to non-existent shows', () => {
    const writers: Writer[] = [{ id: 1, imdbId: 'nm001', name: 'Writer' }];
    const shows: Show[] = [
      { id: 1, imdbId: 'tt001', title: 'Show 1', yearStart: 2000, yearEnd: 2005 },
    ];
    const links: ShowWriterLink[] = [
      { showId: 1, writerId: 1, role: 'creator', episodeCount: 10 },
      { showId: 999, writerId: 1, role: 'writer', episodeCount: 5 }, // Non-existent show
    ];

    const overlaps = findOverlappingWriters(writers, shows, links);

    // Current behavior: Writer is included because they have 2 unique showIds in links,
    // even though only 1 show actually exists. The showCount reflects actual shows found.
    // Note: This could be considered a quirk - the writer appears in overlaps but with showCount=1
    expect(overlaps).toHaveLength(1);
    expect(overlaps[0].showCount).toBe(1); // Only 1 real show
    expect(overlaps[0].shows).toHaveLength(1);
    expect(overlaps[0].shows[0].id).toBe(1);
  });

  it('handles links to non-existent writers', () => {
    const writers: Writer[] = [{ id: 1, imdbId: 'nm001', name: 'Writer' }];
    const shows: Show[] = [
      { id: 1, imdbId: 'tt001', title: 'Show 1', yearStart: 2000, yearEnd: 2005 },
      { id: 2, imdbId: 'tt002', title: 'Show 2', yearStart: 2010, yearEnd: 2015 },
    ];
    const links: ShowWriterLink[] = [
      { showId: 1, writerId: 999, role: 'creator', episodeCount: 10 }, // Non-existent writer
      { showId: 2, writerId: 999, role: 'writer', episodeCount: 5 },
    ];

    const overlaps = findOverlappingWriters(writers, shows, links);

    // Writer 999 doesn't exist in writers array, so no overlaps
    expect(overlaps).toEqual([]);
  });

  it('returns overlaps sorted by show count descending', () => {
    const writers: Writer[] = [
      { id: 1, imdbId: 'nm001', name: 'Prolific Writer' },
      { id: 2, imdbId: 'nm002', name: 'Less Prolific' },
    ];
    const shows: Show[] = [
      { id: 1, imdbId: 'tt001', title: 'Show 1', yearStart: 2000, yearEnd: 2005 },
      { id: 2, imdbId: 'tt002', title: 'Show 2', yearStart: 2010, yearEnd: 2015 },
      { id: 3, imdbId: 'tt003', title: 'Show 3', yearStart: 2020, yearEnd: null },
    ];
    const links: ShowWriterLink[] = [
      { showId: 1, writerId: 1, role: 'creator', episodeCount: 10 },
      { showId: 2, writerId: 1, role: 'writer', episodeCount: 5 },
      { showId: 3, writerId: 1, role: 'writer', episodeCount: 3 },
      { showId: 1, writerId: 2, role: 'writer', episodeCount: 5 },
      { showId: 2, writerId: 2, role: 'writer', episodeCount: 5 },
    ];

    const overlaps = findOverlappingWriters(writers, shows, links);

    expect(overlaps).toHaveLength(2);
    expect(overlaps[0].writer.name).toBe('Prolific Writer');
    expect(overlaps[0].showCount).toBe(3);
    expect(overlaps[1].writer.name).toBe('Less Prolific');
    expect(overlaps[1].showCount).toBe(2);
  });
});

describe('enrichWritersWithShows edge cases', () => {
  it('handles empty writers array', () => {
    const shows: Show[] = [{ id: 1, imdbId: 'tt001', title: 'Show 1', yearStart: 2000, yearEnd: 2005 }];
    const links: ShowWriterLink[] = [{ showId: 1, writerId: 1, role: 'creator', episodeCount: 10 }];

    const enriched = enrichWritersWithShows([], shows, links);
    expect(enriched).toEqual([]);
  });

  it('handles empty shows array', () => {
    const writers: Writer[] = [{ id: 1, imdbId: 'nm001', name: 'Writer' }];
    const links: ShowWriterLink[] = [{ showId: 1, writerId: 1, role: 'creator', episodeCount: 10 }];

    const enriched = enrichWritersWithShows(writers, [], links);

    expect(enriched).toHaveLength(1);
    expect(enriched[0].shows).toEqual([]);
  });

  it('handles empty links array', () => {
    const writers: Writer[] = [{ id: 1, imdbId: 'nm001', name: 'Writer' }];
    const shows: Show[] = [{ id: 1, imdbId: 'tt001', title: 'Show 1', yearStart: 2000, yearEnd: 2005 }];

    const enriched = enrichWritersWithShows(writers, shows, []);

    expect(enriched).toHaveLength(1);
    expect(enriched[0].shows).toEqual([]);
  });

  it('preserves all writer properties', () => {
    const writers: Writer[] = [
      {
        id: 1,
        imdbId: 'nm001',
        name: 'Complete Writer',
        imageUrl: 'https://example.com/image.jpg',
        bio: 'A great writer',
        showCount: 5,
      },
    ];
    const shows: Show[] = [{ id: 1, imdbId: 'tt001', title: 'Show', yearStart: 2000, yearEnd: 2005 }];
    const links: ShowWriterLink[] = [{ showId: 1, writerId: 1, role: 'creator', episodeCount: 10 }];

    const enriched = enrichWritersWithShows(writers, shows, links);

    expect(enriched[0].id).toBe(1);
    expect(enriched[0].imdbId).toBe('nm001');
    expect(enriched[0].name).toBe('Complete Writer');
    expect(enriched[0].imageUrl).toBe('https://example.com/image.jpg');
    expect(enriched[0].bio).toBe('A great writer');
    expect(enriched[0].showCount).toBe(5);
  });

  it('handles writer with multiple links to same show', () => {
    const writers: Writer[] = [{ id: 1, imdbId: 'nm001', name: 'Writer' }];
    const shows: Show[] = [{ id: 1, imdbId: 'tt001', title: 'Show', yearStart: 2000, yearEnd: 2005 }];
    const links: ShowWriterLink[] = [
      { showId: 1, writerId: 1, role: 'creator', episodeCount: 10 },
      { showId: 1, writerId: 1, role: 'writer', episodeCount: 5 },
    ];

    const enriched = enrichWritersWithShows(writers, shows, links);

    // Show appears twice because there are 2 links
    expect(enriched[0].shows).toHaveLength(2);
    expect(enriched[0].shows[0].id).toBe(1);
    expect(enriched[0].shows[1].id).toBe(1);
  });
});

describe('enrichShowsWithWriters edge cases', () => {
  it('handles empty shows array', () => {
    const writers: Writer[] = [{ id: 1, imdbId: 'nm001', name: 'Writer' }];
    const links: ShowWriterLink[] = [{ showId: 1, writerId: 1, role: 'creator', episodeCount: 10 }];

    const enriched = enrichShowsWithWriters([], writers, links);
    expect(enriched).toEqual([]);
  });

  it('handles empty writers array', () => {
    const shows: Show[] = [{ id: 1, imdbId: 'tt001', title: 'Show', yearStart: 2000, yearEnd: 2005 }];
    const links: ShowWriterLink[] = [{ showId: 1, writerId: 1, role: 'creator', episodeCount: 10 }];

    const enriched = enrichShowsWithWriters(shows, [], links);

    expect(enriched).toHaveLength(1);
    expect(enriched[0].writers).toEqual([]);
  });

  it('handles empty links array', () => {
    const shows: Show[] = [{ id: 1, imdbId: 'tt001', title: 'Show', yearStart: 2000, yearEnd: 2005 }];
    const writers: Writer[] = [{ id: 1, imdbId: 'nm001', name: 'Writer' }];

    const enriched = enrichShowsWithWriters(shows, writers, []);

    expect(enriched).toHaveLength(1);
    expect(enriched[0].writers).toEqual([]);
  });

  it('preserves all show properties', () => {
    const shows: Show[] = [
      {
        id: 1,
        imdbId: 'tt001',
        title: 'Complete Show',
        yearStart: 2000,
        yearEnd: 2005,
      },
    ];
    const writers: Writer[] = [{ id: 1, imdbId: 'nm001', name: 'Writer' }];
    const links: ShowWriterLink[] = [{ showId: 1, writerId: 1, role: 'creator', episodeCount: 10 }];

    const enriched = enrichShowsWithWriters(shows, writers, links);

    expect(enriched[0].id).toBe(1);
    expect(enriched[0].imdbId).toBe('tt001');
    expect(enriched[0].title).toBe('Complete Show');
    expect(enriched[0].yearStart).toBe(2000);
    expect(enriched[0].yearEnd).toBe(2005);
  });

  it('handles show with null year fields', () => {
    const shows: Show[] = [
      { id: 1, imdbId: 'tt001', title: 'Unknown Dates', yearStart: null, yearEnd: null },
    ];
    const writers: Writer[] = [{ id: 1, imdbId: 'nm001', name: 'Writer' }];
    const links: ShowWriterLink[] = [{ showId: 1, writerId: 1, role: 'creator', episodeCount: 10 }];

    const enriched = enrichShowsWithWriters(shows, writers, links);

    expect(enriched[0].yearStart).toBeNull();
    expect(enriched[0].yearEnd).toBeNull();
  });
});

describe('countSharedWriters edge cases', () => {
  it('returns 0 for shows with no writers', () => {
    const showA: ShowWithWriters = {
      id: 1, imdbId: 'tt001', title: 'Show A', yearStart: 2000, yearEnd: 2005,
      writers: [],
    };
    const showB: ShowWithWriters = {
      id: 2, imdbId: 'tt002', title: 'Show B', yearStart: 2010, yearEnd: 2015,
      writers: [],
    };

    expect(countSharedWriters(showA, showB)).toBe(0);
  });

  it('returns 0 when one show has no writers', () => {
    const showA: ShowWithWriters = {
      id: 1, imdbId: 'tt001', title: 'Show A', yearStart: 2000, yearEnd: 2005,
      writers: [{ id: 1, imdbId: 'nm001', name: 'Writer' }],
    };
    const showB: ShowWithWriters = {
      id: 2, imdbId: 'tt002', title: 'Show B', yearStart: 2010, yearEnd: 2015,
      writers: [],
    };

    expect(countSharedWriters(showA, showB)).toBe(0);
    expect(countSharedWriters(showB, showA)).toBe(0);
  });

  it('returns 0 when shows have disjoint writers', () => {
    const showA: ShowWithWriters = {
      id: 1, imdbId: 'tt001', title: 'Show A', yearStart: 2000, yearEnd: 2005,
      writers: [
        { id: 1, imdbId: 'nm001', name: 'Writer 1' },
        { id: 2, imdbId: 'nm002', name: 'Writer 2' },
      ],
    };
    const showB: ShowWithWriters = {
      id: 2, imdbId: 'tt002', title: 'Show B', yearStart: 2010, yearEnd: 2015,
      writers: [
        { id: 3, imdbId: 'nm003', name: 'Writer 3' },
        { id: 4, imdbId: 'nm004', name: 'Writer 4' },
      ],
    };

    expect(countSharedWriters(showA, showB)).toBe(0);
  });

  it('returns full count when all writers are shared', () => {
    const sharedWriters: Writer[] = [
      { id: 1, imdbId: 'nm001', name: 'Writer 1' },
      { id: 2, imdbId: 'nm002', name: 'Writer 2' },
    ];
    const showA: ShowWithWriters = {
      id: 1, imdbId: 'tt001', title: 'Show A', yearStart: 2000, yearEnd: 2005,
      writers: sharedWriters,
    };
    const showB: ShowWithWriters = {
      id: 2, imdbId: 'tt002', title: 'Show B', yearStart: 2010, yearEnd: 2015,
      writers: sharedWriters,
    };

    expect(countSharedWriters(showA, showB)).toBe(2);
  });

  it('is symmetric (A,B) = (B,A)', () => {
    const showA: ShowWithWriters = {
      id: 1, imdbId: 'tt001', title: 'Show A', yearStart: 2000, yearEnd: 2005,
      writers: [
        { id: 1, imdbId: 'nm001', name: 'Shared' },
        { id: 2, imdbId: 'nm002', name: 'Only A' },
      ],
    };
    const showB: ShowWithWriters = {
      id: 2, imdbId: 'tt002', title: 'Show B', yearStart: 2010, yearEnd: 2015,
      writers: [
        { id: 1, imdbId: 'nm001', name: 'Shared' },
        { id: 3, imdbId: 'nm003', name: 'Only B' },
      ],
    };

    expect(countSharedWriters(showA, showB)).toBe(countSharedWriters(showB, showA));
  });

  it('returns correct count for self-comparison', () => {
    const show: ShowWithWriters = {
      id: 1, imdbId: 'tt001', title: 'Show', yearStart: 2000, yearEnd: 2005,
      writers: [
        { id: 1, imdbId: 'nm001', name: 'Writer 1' },
        { id: 2, imdbId: 'nm002', name: 'Writer 2' },
        { id: 3, imdbId: 'nm003', name: 'Writer 3' },
      ],
    };

    // Comparing show to itself should return writer count
    expect(countSharedWriters(show, show)).toBe(3);
  });
});

describe('getSharedWriters edge cases', () => {
  it('returns empty array for shows with no writers', () => {
    const showA: ShowWithWriters = {
      id: 1, imdbId: 'tt001', title: 'Show A', yearStart: 2000, yearEnd: 2005,
      writers: [],
    };
    const showB: ShowWithWriters = {
      id: 2, imdbId: 'tt002', title: 'Show B', yearStart: 2010, yearEnd: 2015,
      writers: [],
    };

    expect(getSharedWriters(showA, showB)).toEqual([]);
  });

  it('returns empty array for disjoint writers', () => {
    const showA: ShowWithWriters = {
      id: 1, imdbId: 'tt001', title: 'Show A', yearStart: 2000, yearEnd: 2005,
      writers: [{ id: 1, imdbId: 'nm001', name: 'Writer A' }],
    };
    const showB: ShowWithWriters = {
      id: 2, imdbId: 'tt002', title: 'Show B', yearStart: 2010, yearEnd: 2015,
      writers: [{ id: 2, imdbId: 'nm002', name: 'Writer B' }],
    };

    expect(getSharedWriters(showA, showB)).toEqual([]);
  });

  it('returns shared writers in order from showB', () => {
    const showA: ShowWithWriters = {
      id: 1, imdbId: 'tt001', title: 'Show A', yearStart: 2000, yearEnd: 2005,
      writers: [
        { id: 1, imdbId: 'nm001', name: 'Writer 1' },
        { id: 2, imdbId: 'nm002', name: 'Writer 2' },
      ],
    };
    const showB: ShowWithWriters = {
      id: 2, imdbId: 'tt002', title: 'Show B', yearStart: 2010, yearEnd: 2015,
      writers: [
        { id: 2, imdbId: 'nm002', name: 'Writer 2' },
        { id: 1, imdbId: 'nm001', name: 'Writer 1' },
      ],
    };

    const shared = getSharedWriters(showA, showB);

    // Order comes from showB's writers array
    expect(shared[0].id).toBe(2);
    expect(shared[1].id).toBe(1);
  });

  it('returns references from showB (not showA)', () => {
    const writerInA = { id: 1, imdbId: 'nm001', name: 'Writer', bio: 'Bio in A' };
    const writerInB = { id: 1, imdbId: 'nm001', name: 'Writer', bio: 'Bio in B' };

    const showA: ShowWithWriters = {
      id: 1, imdbId: 'tt001', title: 'Show A', yearStart: 2000, yearEnd: 2005,
      writers: [writerInA],
    };
    const showB: ShowWithWriters = {
      id: 2, imdbId: 'tt002', title: 'Show B', yearStart: 2010, yearEnd: 2015,
      writers: [writerInB],
    };

    const shared = getSharedWriters(showA, showB);

    // Should return the reference from showB
    expect(shared[0]).toBe(writerInB);
    expect(shared[0].bio).toBe('Bio in B');
  });
});

describe('createOverlapMatrix edge cases', () => {
  it('returns empty matrix for empty shows', () => {
    const matrix = createOverlapMatrix([]);
    expect(matrix).toEqual([]);
  });

  it('returns 1x1 matrix for single show', () => {
    const shows: ShowWithWriters[] = [
      {
        id: 1, imdbId: 'tt001', title: 'Show', yearStart: 2000, yearEnd: 2005,
        writers: [{ id: 1, imdbId: 'nm001', name: 'Writer' }],
      },
    ];

    const matrix = createOverlapMatrix(shows);

    expect(matrix).toEqual([[1]]);
  });

  it('returns 2x2 symmetric matrix', () => {
    const shows: ShowWithWriters[] = [
      {
        id: 1, imdbId: 'tt001', title: 'Show A', yearStart: 2000, yearEnd: 2005,
        writers: [
          { id: 1, imdbId: 'nm001', name: 'Shared' },
          { id: 2, imdbId: 'nm002', name: 'Only A' },
        ],
      },
      {
        id: 2, imdbId: 'tt002', title: 'Show B', yearStart: 2010, yearEnd: 2015,
        writers: [
          { id: 1, imdbId: 'nm001', name: 'Shared' },
          { id: 3, imdbId: 'nm003', name: 'Only B' },
        ],
      },
    ];

    const matrix = createOverlapMatrix(shows);

    expect(matrix).toEqual([
      [2, 1], // Show A has 2 writers, shares 1 with B
      [1, 2], // Shares 1 with A, Show B has 2 writers
    ]);
  });

  it('handles shows with no writers', () => {
    const shows: ShowWithWriters[] = [
      {
        id: 1, imdbId: 'tt001', title: 'Empty Show A', yearStart: 2000, yearEnd: 2005,
        writers: [],
      },
      {
        id: 2, imdbId: 'tt002', title: 'Empty Show B', yearStart: 2010, yearEnd: 2015,
        writers: [],
      },
    ];

    const matrix = createOverlapMatrix(shows);

    expect(matrix).toEqual([
      [0, 0],
      [0, 0],
    ]);
  });

  it('handles large matrix (10x10)', () => {
    const shows: ShowWithWriters[] = Array.from({ length: 10 }, (_, i) => ({
      id: i + 1,
      imdbId: `tt${String(i + 1).padStart(3, '0')}`,
      title: `Show ${i + 1}`,
      yearStart: 2000 + i,
      yearEnd: 2005 + i,
      writers: [
        { id: 1, imdbId: 'nm001', name: 'Universal Writer' }, // Shared by all
        { id: i + 100, imdbId: `nm${i + 100}`, name: `Unique Writer ${i}` }, // Unique to each
      ],
    }));

    const matrix = createOverlapMatrix(shows);

    // 10x10 matrix
    expect(matrix).toHaveLength(10);
    matrix.forEach(row => expect(row).toHaveLength(10));

    // Diagonal should be 2 (each show has 2 writers)
    for (let i = 0; i < 10; i++) {
      expect(matrix[i][i]).toBe(2);
    }

    // Off-diagonal should be 1 (they share only the universal writer)
    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 10; j++) {
        if (i !== j) {
          expect(matrix[i][j]).toBe(1);
        }
      }
    }
  });

  it('matrix is always symmetric', () => {
    const shows: ShowWithWriters[] = [
      {
        id: 1, imdbId: 'tt001', title: 'Show A', yearStart: 2000, yearEnd: 2005,
        writers: [
          { id: 1, imdbId: 'nm001', name: 'Writer 1' },
          { id: 2, imdbId: 'nm002', name: 'Writer 2' },
          { id: 3, imdbId: 'nm003', name: 'Writer 3' },
        ],
      },
      {
        id: 2, imdbId: 'tt002', title: 'Show B', yearStart: 2010, yearEnd: 2015,
        writers: [
          { id: 1, imdbId: 'nm001', name: 'Writer 1' },
          { id: 4, imdbId: 'nm004', name: 'Writer 4' },
        ],
      },
      {
        id: 3, imdbId: 'tt003', title: 'Show C', yearStart: 2020, yearEnd: null,
        writers: [
          { id: 2, imdbId: 'nm002', name: 'Writer 2' },
          { id: 3, imdbId: 'nm003', name: 'Writer 3' },
        ],
      },
    ];

    const matrix = createOverlapMatrix(shows);

    // Verify symmetry: matrix[i][j] === matrix[j][i]
    for (let i = 0; i < matrix.length; i++) {
      for (let j = 0; j < matrix.length; j++) {
        expect(matrix[i][j]).toBe(matrix[j][i]);
      }
    }
  });
});

describe('Immutability guarantees', () => {
  it('groupLinksByWriter does not mutate input', () => {
    const links: ShowWriterLink[] = [
      { showId: 1, writerId: 1, role: 'creator', episodeCount: 10 },
    ];
    const originalLength = links.length;

    groupLinksByWriter(links);

    expect(links).toHaveLength(originalLength);
  });

  it('enrichShowsWithWriters does not mutate input arrays', () => {
    const shows: Show[] = [{ id: 1, imdbId: 'tt001', title: 'Show', yearStart: 2000, yearEnd: 2005 }];
    const writers: Writer[] = [{ id: 1, imdbId: 'nm001', name: 'Writer' }];
    const links: ShowWriterLink[] = [{ showId: 1, writerId: 1, role: 'creator', episodeCount: 10 }];

    const originalShowsLength = shows.length;
    const originalWritersLength = writers.length;
    const originalLinksLength = links.length;

    enrichShowsWithWriters(shows, writers, links);

    expect(shows).toHaveLength(originalShowsLength);
    expect(writers).toHaveLength(originalWritersLength);
    expect(links).toHaveLength(originalLinksLength);
  });

  it('createOverlapMatrix returns new arrays', () => {
    const shows: ShowWithWriters[] = [
      {
        id: 1, imdbId: 'tt001', title: 'Show', yearStart: 2000, yearEnd: 2005,
        writers: [{ id: 1, imdbId: 'nm001', name: 'Writer' }],
      },
    ];

    const matrix1 = createOverlapMatrix(shows);
    const matrix2 = createOverlapMatrix(shows);

    // Should be equal but not the same reference
    expect(matrix1).toEqual(matrix2);
    expect(matrix1).not.toBe(matrix2);
  });
});
