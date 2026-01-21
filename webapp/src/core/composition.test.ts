/**
 * Compositional tests for the functional core.
 *
 * These tests verify that functions compose correctly and produce expected
 * results when chained together, resembling real application usage patterns.
 *
 * The tests follow the data flow:
 * Raw API data → Domain types → Enriched types → Graph/Visualization structures
 */

import { describe, it, expect } from 'vitest';
import type { Show, Writer, ShowWriterLink, ShowWithWriters, WriterWithShows } from './types';
import {
  groupLinksByWriter,
  groupLinksByShow,
  enrichShowsWithWriters,
  enrichWritersWithShows,
  findOverlappingWriters,
  getSharedWriters,
  countSharedWriters,
  createOverlapMatrix,
} from './overlap';
import {
  buildBipartiteGraph,
  buildShowOverlapGraph,
  buildVennData,
  filterConnectedNodes,
  filterByWeight,
  computeGraphStats,
  createNodeId,
  parseNodeId,
} from './graph';

/**
 * Realistic test fixtures representing a TV writer network.
 *
 * Network structure:
 * - Breaking Bad: Vince Gilligan, Peter Gould
 * - Better Call Saul: Vince Gilligan, Peter Gould, Thomas Schnauz
 * - The X-Files: Vince Gilligan, Howard Gordon
 * - 24: Howard Gordon
 * - Homeland: Howard Gordon
 * - Isolated Show: New Writer (no connections)
 */

const shows: ReadonlyArray<Show> = [
  { id: 1, imdbId: 'tt0903747', title: 'Breaking Bad', yearStart: 2008, yearEnd: 2013 },
  { id: 2, imdbId: 'tt3032476', title: 'Better Call Saul', yearStart: 2015, yearEnd: 2022 },
  { id: 3, imdbId: 'tt0106179', title: 'The X-Files', yearStart: 1993, yearEnd: 2018 },
  { id: 4, imdbId: 'tt0285331', title: '24', yearStart: 2001, yearEnd: 2014 },
  { id: 5, imdbId: 'tt1796960', title: 'Homeland', yearStart: 2011, yearEnd: 2020 },
  { id: 6, imdbId: 'tt9999999', title: 'Isolated Show', yearStart: 2023, yearEnd: null },
];

const writers: ReadonlyArray<Writer> = [
  { id: 1, imdbId: 'nm0319213', name: 'Vince Gilligan', showCount: 3 },
  { id: 2, imdbId: 'nm0342029', name: 'Peter Gould', showCount: 2 },
  { id: 3, imdbId: 'nm0774223', name: 'Thomas Schnauz', showCount: 1 },
  { id: 4, imdbId: 'nm0337407', name: 'Howard Gordon', showCount: 3 },
  { id: 5, imdbId: 'nm9999999', name: 'New Writer', showCount: 1 },
];

const links: ReadonlyArray<ShowWriterLink> = [
  // Breaking Bad
  { showId: 1, writerId: 1, role: 'creator', episodeCount: 62 },
  { showId: 1, writerId: 2, role: 'writer', episodeCount: 35 },
  // Better Call Saul
  { showId: 2, writerId: 1, role: 'creator', episodeCount: 63 },
  { showId: 2, writerId: 2, role: 'creator', episodeCount: 63 },
  { showId: 2, writerId: 3, role: 'writer', episodeCount: 30 },
  // The X-Files
  { showId: 3, writerId: 1, role: 'writer', episodeCount: 30 },
  { showId: 3, writerId: 4, role: 'writer', episodeCount: 15 },
  // 24
  { showId: 4, writerId: 4, role: 'showrunner', episodeCount: 192 },
  // Homeland
  { showId: 5, writerId: 4, role: 'creator', episodeCount: 96 },
  // Isolated Show
  { showId: 6, writerId: 5, role: 'creator', episodeCount: 10 },
];

describe('Full Pipeline: API Data → Enriched Domain Types', () => {
  it('enriches shows with their writers correctly', () => {
    const enrichedShows = enrichShowsWithWriters(shows, writers, links);

    // Breaking Bad should have Vince and Peter
    const breakingBad = enrichedShows.find(s => s.id === 1);
    expect(breakingBad?.writers).toHaveLength(2);
    expect(breakingBad?.writers.map(w => w.name).sort()).toEqual(['Peter Gould', 'Vince Gilligan']);

    // Better Call Saul should have Vince, Peter, and Thomas
    const bcs = enrichedShows.find(s => s.id === 2);
    expect(bcs?.writers).toHaveLength(3);
    expect(bcs?.writers.map(w => w.name).sort()).toEqual(['Peter Gould', 'Thomas Schnauz', 'Vince Gilligan']);

    // Isolated Show should have only New Writer
    const isolated = enrichedShows.find(s => s.id === 6);
    expect(isolated?.writers).toHaveLength(1);
    expect(isolated?.writers[0].name).toBe('New Writer');
  });

  it('enriches writers with their shows correctly', () => {
    const enrichedWriters = enrichWritersWithShows(writers, shows, links);

    // Vince Gilligan should have Breaking Bad, Better Call Saul, X-Files
    const vince = enrichedWriters.find(w => w.id === 1);
    expect(vince?.shows).toHaveLength(3);
    expect(vince?.shows.map(s => s.title).sort()).toEqual(['Better Call Saul', 'Breaking Bad', 'The X-Files']);

    // Howard Gordon should have X-Files, 24, Homeland
    const howard = enrichedWriters.find(w => w.id === 4);
    expect(howard?.shows).toHaveLength(3);
    expect(howard?.shows.map(s => s.title).sort()).toEqual(['24', 'Homeland', 'The X-Files']);
  });
});

describe('Full Pipeline: Enriched Types → Overlap Calculations', () => {
  it('finds all overlapping writers sorted by show count', () => {
    const overlaps = findOverlappingWriters(writers, shows, links);

    // Expected overlaps: Vince (3 shows), Peter (2 shows), Howard (3 shows)
    expect(overlaps).toHaveLength(3);

    // Should be sorted by showCount descending
    expect(overlaps[0].showCount).toBeGreaterThanOrEqual(overlaps[1].showCount);
    expect(overlaps[1].showCount).toBeGreaterThanOrEqual(overlaps[2].showCount);

    // Vince and Howard both have 3 shows
    const topWriters = overlaps.filter(o => o.showCount === 3);
    expect(topWriters).toHaveLength(2);
    expect(topWriters.map(o => o.writer.name).sort()).toEqual(['Howard Gordon', 'Vince Gilligan']);
  });

  it('calculates shared writers between show pairs correctly', () => {
    const enrichedShows = enrichShowsWithWriters(shows, writers, links);

    const breakingBad = enrichedShows.find(s => s.id === 1) as ShowWithWriters;
    const betterCallSaul = enrichedShows.find(s => s.id === 2) as ShowWithWriters;
    const xFiles = enrichedShows.find(s => s.id === 3) as ShowWithWriters;
    const twentyFour = enrichedShows.find(s => s.id === 4) as ShowWithWriters;
    const homeland = enrichedShows.find(s => s.id === 5) as ShowWithWriters;
    const isolated = enrichedShows.find(s => s.id === 6) as ShowWithWriters;

    // Breaking Bad & Better Call Saul share Vince and Peter
    expect(countSharedWriters(breakingBad, betterCallSaul)).toBe(2);
    const bbBcsShared = getSharedWriters(breakingBad, betterCallSaul);
    expect(bbBcsShared.map(w => w.name).sort()).toEqual(['Peter Gould', 'Vince Gilligan']);

    // Breaking Bad & X-Files share only Vince
    expect(countSharedWriters(breakingBad, xFiles)).toBe(1);
    expect(getSharedWriters(breakingBad, xFiles)[0].name).toBe('Vince Gilligan');

    // X-Files & 24 share Howard
    expect(countSharedWriters(xFiles, twentyFour)).toBe(1);
    expect(getSharedWriters(xFiles, twentyFour)[0].name).toBe('Howard Gordon');

    // 24 & Homeland share Howard
    expect(countSharedWriters(twentyFour, homeland)).toBe(1);

    // Breaking Bad & Homeland share no one
    expect(countSharedWriters(breakingBad, homeland)).toBe(0);
    expect(getSharedWriters(breakingBad, homeland)).toEqual([]);

    // Isolated show shares no one with any other show
    expect(countSharedWriters(isolated, breakingBad)).toBe(0);
    expect(countSharedWriters(isolated, betterCallSaul)).toBe(0);
    expect(countSharedWriters(isolated, xFiles)).toBe(0);
  });

  it('creates a complete overlap matrix with correct symmetry', () => {
    const enrichedShows = enrichShowsWithWriters(shows, writers, links);
    const matrix = createOverlapMatrix(enrichedShows);

    // Matrix should be N x N
    expect(matrix).toHaveLength(6);
    matrix.forEach(row => expect(row).toHaveLength(6));

    // Diagonal = self overlap = writer count for each show
    expect(matrix[0][0]).toBe(2); // Breaking Bad: 2 writers
    expect(matrix[1][1]).toBe(3); // Better Call Saul: 3 writers
    expect(matrix[2][2]).toBe(2); // X-Files: 2 writers
    expect(matrix[3][3]).toBe(1); // 24: 1 writer
    expect(matrix[4][4]).toBe(1); // Homeland: 1 writer
    expect(matrix[5][5]).toBe(1); // Isolated: 1 writer

    // Matrix should be symmetric
    for (let i = 0; i < matrix.length; i++) {
      for (let j = 0; j < matrix.length; j++) {
        expect(matrix[i][j]).toBe(matrix[j][i]);
      }
    }

    // Specific overlaps
    expect(matrix[0][1]).toBe(2); // BB & BCS
    expect(matrix[0][2]).toBe(1); // BB & X-Files
    expect(matrix[2][3]).toBe(1); // X-Files & 24
    expect(matrix[3][4]).toBe(1); // 24 & Homeland
    expect(matrix[0][4]).toBe(0); // BB & Homeland
  });
});

describe('Full Pipeline: Domain Types → Bipartite Graph', () => {
  it('builds a complete bipartite graph with correct structure', () => {
    const graph = buildBipartiteGraph(shows, writers, links);

    // Should have all shows and writers as nodes
    expect(graph.nodes).toHaveLength(shows.length + writers.length);
    expect(graph.nodes.filter(n => n.type === 'show')).toHaveLength(6);
    expect(graph.nodes.filter(n => n.type === 'writer')).toHaveLength(5);

    // Should have all links as edges
    expect(graph.edges).toHaveLength(links.length);

    // All edges should connect writers to shows
    graph.edges.forEach(edge => {
      expect(edge.source.startsWith('writer-')).toBe(true);
      expect(edge.target.startsWith('show-')).toBe(true);
    });
  });

  it('preserves episode counts as edge weights', () => {
    const graph = buildBipartiteGraph(shows, writers, links);

    // Find Vince → Breaking Bad edge (62 episodes)
    const vinceBreakingBad = graph.edges.find(
      e => e.source === 'writer-1' && e.target === 'show-1'
    );
    expect(vinceBreakingBad?.weight).toBe(62);

    // Find Howard → 24 edge (192 episodes)
    const howard24 = graph.edges.find(
      e => e.source === 'writer-4' && e.target === 'show-4'
    );
    expect(howard24?.weight).toBe(192);
  });

  it('computes accurate graph statistics', () => {
    const graph = buildBipartiteGraph(shows, writers, links);
    const stats = computeGraphStats(graph);

    expect(stats.nodeCount).toBe(11);
    expect(stats.edgeCount).toBe(10);
    expect(stats.showCount).toBe(6);
    expect(stats.writerCount).toBe(5);
    expect(stats.maxWeight).toBe(192); // Howard → 24
    expect(stats.avgDegree).toBeGreaterThan(0);
  });
});

describe('Full Pipeline: Domain Types → Show Overlap Graph', () => {
  it('builds a show-only graph with shared writer edges', () => {
    const graph = buildShowOverlapGraph(shows, writers, links);

    // Should only have show nodes
    expect(graph.nodes).toHaveLength(6);
    expect(graph.nodes.every(n => n.type === 'show')).toBe(true);

    // Count expected edges:
    // BB-BCS: 2 shared, BB-XFiles: 1, BCS-XFiles: 1, XFiles-24: 1, 24-Homeland: 1
    // Isolated has no connections
    const expectedEdges = [
      ['show-1', 'show-2'], // BB-BCS
      ['show-1', 'show-3'], // BB-XFiles
      ['show-2', 'show-3'], // BCS-XFiles
      ['show-3', 'show-4'], // XFiles-24
      ['show-3', 'show-5'], // XFiles-Homeland
      ['show-4', 'show-5'], // 24-Homeland
    ];

    expect(graph.edges).toHaveLength(6);
  });

  it('sets edge weights to number of shared writers', () => {
    const graph = buildShowOverlapGraph(shows, writers, links);

    // BB-BCS should have weight 2 (Vince and Peter)
    const bbBcs = graph.edges.find(
      e => (e.source === 'show-1' && e.target === 'show-2') ||
           (e.source === 'show-2' && e.target === 'show-1')
    );
    expect(bbBcs?.weight).toBe(2);

    // BB-XFiles should have weight 1 (Vince only)
    const bbXfiles = graph.edges.find(
      e => (e.source === 'show-1' && e.target === 'show-3') ||
           (e.source === 'show-3' && e.target === 'show-1')
    );
    expect(bbXfiles?.weight).toBe(1);
  });
});

describe('Full Pipeline: Graph → Filtered Graph', () => {
  it('filterConnectedNodes removes isolated shows', () => {
    const graph = buildShowOverlapGraph(shows, writers, links);
    const filtered = filterConnectedNodes(graph);

    // Isolated Show should be removed
    expect(filtered.nodes.find(n => n.label === 'Isolated Show')).toBeUndefined();
    expect(filtered.nodes).toHaveLength(5);

    // All other shows should remain
    expect(filtered.nodes.map(n => n.label).sort()).toEqual([
      '24',
      'Better Call Saul',
      'Breaking Bad',
      'Homeland',
      'The X-Files',
    ]);
  });

  it('filterByWeight removes weak connections', () => {
    const graph = buildShowOverlapGraph(shows, writers, links);

    // Filter to only show connections with 2+ shared writers
    const strongOnly = filterByWeight(graph, 2);

    // Only BB-BCS edge has weight >= 2
    expect(strongOnly.edges).toHaveLength(1);
    expect(strongOnly.edges[0].weight).toBe(2);

    // Only BB and BCS should remain as connected nodes
    expect(strongOnly.nodes).toHaveLength(2);
    expect(strongOnly.nodes.map(n => n.label).sort()).toEqual(['Better Call Saul', 'Breaking Bad']);
  });

  it('chained filters work correctly', () => {
    const graph = buildShowOverlapGraph(shows, writers, links);

    // First filter by weight, then ensure connected
    const step1 = filterByWeight(graph, 1);
    const step2 = filterConnectedNodes(step1);

    // Should be equivalent to just filterByWeight (which already calls filterConnectedNodes)
    expect(step2.nodes).toHaveLength(step1.nodes.length);
    expect(step2.edges).toHaveLength(step1.edges.length);
  });
});

describe('Full Pipeline: Domain Types → Venn Diagram Data', () => {
  it('builds correct Venn data for a subset of shows', () => {
    const selectedShows = shows.filter(s => [1, 2, 3].includes(s.id));
    const venn = buildVennData(selectedShows, writers, links);

    // Should have 3 individual sets
    const singleSets = venn.sets.filter(s => s.sets.length === 1);
    expect(singleSets).toHaveLength(3);

    // Should have 3 pairwise intersections (all pairs overlap via Vince)
    const pairSets = venn.sets.filter(s => s.sets.length === 2);
    expect(pairSets).toHaveLength(3);

    // Verify show labels
    expect(Object.keys(venn.showLabels)).toHaveLength(3);
    expect(venn.showLabels['S1']).toBe('Breaking Bad');
    expect(venn.showLabels['S2']).toBe('Better Call Saul');
    expect(venn.showLabels['S3']).toBe('The X-Files');
  });

  it('set sizes reflect writer counts', () => {
    const selectedShows = shows.filter(s => [1, 2].includes(s.id));
    const venn = buildVennData(selectedShows, writers, links);

    const bbSet = venn.sets.find(s => s.sets.length === 1 && s.sets[0] === 'S1');
    const bcsSet = venn.sets.find(s => s.sets.length === 1 && s.sets[0] === 'S2');
    const intersection = venn.sets.find(s => s.sets.length === 2);

    expect(bbSet?.size).toBe(2);  // BB has 2 writers
    expect(bcsSet?.size).toBe(3); // BCS has 3 writers
    expect(intersection?.size).toBe(2); // They share 2 writers
  });
});

describe('Node ID Roundtrip', () => {
  it('createNodeId and parseNodeId are inverse operations', () => {
    const testCases: Array<{ type: 'show' | 'writer'; id: number }> = [
      { type: 'show', id: 1 },
      { type: 'show', id: 999999 },
      { type: 'writer', id: 1 },
      { type: 'writer', id: 0 },
    ];

    testCases.forEach(({ type, id }) => {
      const nodeId = createNodeId(type, id);
      const parsed = parseNodeId(nodeId);
      expect(parsed).toEqual({ type, id });
    });
  });
});

describe('Invariants: Compositional Properties', () => {
  it('enrichment preserves entity identity', () => {
    const enrichedShows = enrichShowsWithWriters(shows, writers, links);

    // All original show properties should be preserved
    enrichedShows.forEach((enriched, index) => {
      const original = shows[index];
      expect(enriched.id).toBe(original.id);
      expect(enriched.imdbId).toBe(original.imdbId);
      expect(enriched.title).toBe(original.title);
      expect(enriched.yearStart).toBe(original.yearStart);
      expect(enriched.yearEnd).toBe(original.yearEnd);
    });
  });

  it('enrichment preserves entity count', () => {
    const enrichedShows = enrichShowsWithWriters(shows, writers, links);
    const enrichedWriters = enrichWritersWithShows(writers, shows, links);

    expect(enrichedShows.length).toBe(shows.length);
    expect(enrichedWriters.length).toBe(writers.length);
  });

  it('shared writer count is symmetric', () => {
    const enrichedShows = enrichShowsWithWriters(shows, writers, links);

    for (let i = 0; i < enrichedShows.length; i++) {
      for (let j = i + 1; j < enrichedShows.length; j++) {
        const countAB = countSharedWriters(enrichedShows[i], enrichedShows[j]);
        const countBA = countSharedWriters(enrichedShows[j], enrichedShows[i]);
        expect(countAB).toBe(countBA);
      }
    }
  });

  it('overlap matrix diagonal equals writer count', () => {
    const enrichedShows = enrichShowsWithWriters(shows, writers, links);
    const matrix = createOverlapMatrix(enrichedShows);

    enrichedShows.forEach((show, index) => {
      expect(matrix[index][index]).toBe(show.writers.length);
    });
  });

  it('bipartite graph edge count equals link count', () => {
    const graph = buildBipartiteGraph(shows, writers, links);
    expect(graph.edges.length).toBe(links.length);
  });

  it('filtering never increases node or edge count', () => {
    const graph = buildShowOverlapGraph(shows, writers, links);
    const filtered1 = filterConnectedNodes(graph);
    const filtered2 = filterByWeight(graph, 1);
    const filtered3 = filterByWeight(graph, 2);

    expect(filtered1.nodes.length).toBeLessThanOrEqual(graph.nodes.length);
    expect(filtered1.edges.length).toBeLessThanOrEqual(graph.edges.length);
    expect(filtered2.nodes.length).toBeLessThanOrEqual(graph.nodes.length);
    expect(filtered3.nodes.length).toBeLessThanOrEqual(filtered2.nodes.length);
  });
});

describe('Edge Cases: Empty and Minimal Inputs', () => {
  it('handles empty shows array', () => {
    const enriched = enrichShowsWithWriters([], writers, links);
    expect(enriched).toEqual([]);

    const graph = buildBipartiteGraph([], writers, links);
    expect(graph.nodes.filter(n => n.type === 'show')).toHaveLength(0);
    expect(graph.nodes.filter(n => n.type === 'writer')).toHaveLength(5);
  });

  it('handles empty writers array', () => {
    const enriched = enrichShowsWithWriters(shows, [], links);
    enriched.forEach(show => {
      expect(show.writers).toEqual([]);
    });

    const overlaps = findOverlappingWriters([], shows, links);
    expect(overlaps).toEqual([]);
  });

  it('handles empty links array', () => {
    const enrichedShows = enrichShowsWithWriters(shows, writers, []);
    enrichedShows.forEach(show => {
      expect(show.writers).toEqual([]);
    });

    const enrichedWriters = enrichWritersWithShows(writers, shows, []);
    enrichedWriters.forEach(writer => {
      expect(writer.shows).toEqual([]);
    });

    const graph = buildShowOverlapGraph(shows, writers, []);
    expect(graph.edges).toEqual([]);
  });

  it('handles single show', () => {
    const singleShow = [shows[0]];
    const relevantLinks = links.filter(l => l.showId === 1);

    const enriched = enrichShowsWithWriters(singleShow, writers, relevantLinks);
    expect(enriched).toHaveLength(1);
    expect(enriched[0].writers).toHaveLength(2);

    const matrix = createOverlapMatrix(enriched);
    expect(matrix).toEqual([[2]]);
  });

  it('handles single writer', () => {
    const singleWriter = [writers[0]];
    const relevantLinks = links.filter(l => l.writerId === 1);

    const enriched = enrichWritersWithShows(singleWriter, shows, relevantLinks);
    expect(enriched).toHaveLength(1);
    expect(enriched[0].shows).toHaveLength(3);
  });
});

describe('Edge Cases: Orphan References', () => {
  it('ignores links to non-existent shows', () => {
    const linksWithOrphan: ReadonlyArray<ShowWriterLink> = [
      ...links,
      { showId: 999, writerId: 1, role: 'writer', episodeCount: 10 },
    ];

    const enriched = enrichWritersWithShows(writers, shows, linksWithOrphan);
    const vince = enriched.find(w => w.id === 1);

    // Should not include the orphan show
    expect(vince?.shows).toHaveLength(3);
    expect(vince?.shows.every(s => s.id !== 999)).toBe(true);
  });

  it('ignores links to non-existent writers', () => {
    const linksWithOrphan: ReadonlyArray<ShowWriterLink> = [
      ...links,
      { showId: 1, writerId: 999, role: 'writer', episodeCount: 10 },
    ];

    const enriched = enrichShowsWithWriters(shows, writers, linksWithOrphan);
    const breakingBad = enriched.find(s => s.id === 1);

    // Should not include the orphan writer
    expect(breakingBad?.writers).toHaveLength(2);
    expect(breakingBad?.writers.every(w => w.id !== 999)).toBe(true);
  });
});

describe('Real-World Scenario: Finding Related Shows', () => {
  /**
   * Simulates the user workflow:
   * 1. User selects a show
   * 2. System finds all shows that share writers with selection
   * 3. System ranks them by number of shared writers
   */
  it('finds and ranks related shows for Breaking Bad', () => {
    const enrichedShows = enrichShowsWithWriters(shows, writers, links);
    const breakingBad = enrichedShows.find(s => s.id === 1) as ShowWithWriters;

    // Find all shows that share writers with Breaking Bad
    const relatedShows = enrichedShows
      .filter(s => s.id !== breakingBad.id)
      .map(show => ({
        show,
        sharedCount: countSharedWriters(breakingBad, show),
        sharedWriters: getSharedWriters(breakingBad, show),
      }))
      .filter(r => r.sharedCount > 0)
      .sort((a, b) => b.sharedCount - a.sharedCount);

    // Better Call Saul should be #1 (shares 2 writers)
    expect(relatedShows[0].show.title).toBe('Better Call Saul');
    expect(relatedShows[0].sharedCount).toBe(2);

    // X-Files should be next (shares 1 writer - Vince)
    expect(relatedShows[1].show.title).toBe('The X-Files');
    expect(relatedShows[1].sharedCount).toBe(1);

    // 24 and Homeland should not be related
    expect(relatedShows.find(r => r.show.title === '24')).toBeUndefined();
    expect(relatedShows.find(r => r.show.title === 'Homeland')).toBeUndefined();
  });
});

describe('Real-World Scenario: Building a Force-Directed Graph', () => {
  /**
   * Simulates the workflow for creating a force-directed visualization:
   * 1. Build bipartite graph
   * 2. Compute statistics for UI display
   * 3. Filter to show only significant connections
   */
  it('creates visualization-ready graph data', () => {
    const fullGraph = buildBipartiteGraph(shows, writers, links);
    const stats = computeGraphStats(fullGraph);

    expect(stats.nodeCount).toBe(11);
    expect(stats.edgeCount).toBe(10);

    // Filter to only keep edges with significant episode counts
    const filteredGraph = filterByWeight(fullGraph, 30);
    const filteredStats = computeGraphStats(filteredGraph);

    // Should have fewer nodes (only writers with 30+ episodes on a single show)
    expect(filteredStats.nodeCount).toBeLessThan(stats.nodeCount);
    expect(filteredStats.edgeCount).toBeLessThan(stats.edgeCount);

    // All remaining edges should have weight >= 30
    filteredGraph.edges.forEach(edge => {
      expect(edge.weight).toBeGreaterThanOrEqual(30);
    });
  });
});

describe('Real-World Scenario: Venn Diagram for Show Comparison', () => {
  /**
   * Simulates comparing 3 shows in a Venn diagram
   */
  it('generates correct Venn data for Breaking Bad universe', () => {
    // User selects BB, BCS, and X-Files (all connected via Vince)
    const selectedShows = shows.filter(s => [1, 2, 3].includes(s.id));
    const venn = buildVennData(selectedShows, writers, links);

    // Individual sets
    const bbSet = venn.sets.find(s => s.sets.length === 1 && s.label === 'Breaking Bad');
    const bcsSet = venn.sets.find(s => s.sets.length === 1 && s.label === 'Better Call Saul');
    const xfSet = venn.sets.find(s => s.sets.length === 1 && s.label === 'The X-Files');

    expect(bbSet?.size).toBe(2);  // Vince, Peter
    expect(bcsSet?.size).toBe(3); // Vince, Peter, Thomas
    expect(xfSet?.size).toBe(2);  // Vince, Howard

    // Pairwise intersections
    const intersections = venn.sets.filter(s => s.sets.length === 2);
    expect(intersections).toHaveLength(3);

    // BB ∩ BCS = 2 (Vince, Peter)
    const bbBcs = intersections.find(s => s.sets.includes('S1') && s.sets.includes('S2'));
    expect(bbBcs?.size).toBe(2);

    // BB ∩ XF = 1 (Vince)
    const bbXf = intersections.find(s => s.sets.includes('S1') && s.sets.includes('S3'));
    expect(bbXf?.size).toBe(1);

    // BCS ∩ XF = 1 (Vince)
    const bcsXf = intersections.find(s => s.sets.includes('S2') && s.sets.includes('S3'));
    expect(bcsXf?.size).toBe(1);
  });
});
