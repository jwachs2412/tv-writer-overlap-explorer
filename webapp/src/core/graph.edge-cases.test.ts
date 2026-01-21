/**
 * Edge case tests for graph functions.
 *
 * These tests cover boundary conditions, unusual inputs, and stress scenarios
 * that might not be covered by the main test suite.
 */

import { describe, it, expect } from 'vitest';
import type { Show, Writer, ShowWriterLink, Graph, GraphNode, GraphEdge } from './types';
import {
  createNodeId,
  parseNodeId,
  buildBipartiteGraph,
  buildShowOverlapGraph,
  filterConnectedNodes,
  filterByWeight,
  buildVennData,
  computeGraphStats,
} from './graph';

describe('createNodeId edge cases', () => {
  it('handles ID of 0', () => {
    expect(createNodeId('show', 0)).toBe('show-0');
    expect(createNodeId('writer', 0)).toBe('writer-0');
  });

  it('handles very large IDs', () => {
    const largeId = Number.MAX_SAFE_INTEGER;
    expect(createNodeId('show', largeId)).toBe(`show-${largeId}`);
  });

  it('handles negative IDs (though not recommended)', () => {
    expect(createNodeId('show', -1)).toBe('show--1');
  });
});

describe('parseNodeId edge cases', () => {
  it('returns null for empty string', () => {
    expect(parseNodeId('')).toBeNull();
  });

  it('returns null for partial matches', () => {
    expect(parseNodeId('show-')).toBeNull();
    expect(parseNodeId('-123')).toBeNull();
    expect(parseNodeId('show')).toBeNull();
    expect(parseNodeId('123')).toBeNull();
  });

  it('returns null for wrong separators', () => {
    expect(parseNodeId('show_123')).toBeNull();
    expect(parseNodeId('show:123')).toBeNull();
    expect(parseNodeId('show.123')).toBeNull();
  });

  it('returns null for mixed case', () => {
    expect(parseNodeId('Show-123')).toBeNull();
    expect(parseNodeId('SHOW-123')).toBeNull();
    expect(parseNodeId('Writer-123')).toBeNull();
  });

  it('returns null for extra content', () => {
    expect(parseNodeId('show-123-extra')).toBeNull();
    expect(parseNodeId('prefix-show-123')).toBeNull();
    expect(parseNodeId('show-123-')).toBeNull();
  });

  it('handles ID of 0', () => {
    const result = parseNodeId('show-0');
    expect(result).toEqual({ type: 'show', id: 0 });
  });

  it('handles very large IDs', () => {
    const largeId = '9007199254740991'; // MAX_SAFE_INTEGER
    const result = parseNodeId(`show-${largeId}`);
    expect(result).toEqual({ type: 'show', id: Number(largeId) });
  });

  it('returns null for floating point numbers', () => {
    expect(parseNodeId('show-1.5')).toBeNull();
    expect(parseNodeId('show-1.0')).toBeNull();
  });

  it('returns null for negative numbers (contains minus)', () => {
    expect(parseNodeId('show--1')).toBeNull();
  });
});

describe('buildBipartiteGraph edge cases', () => {
  it('handles all empty inputs', () => {
    const graph = buildBipartiteGraph([], [], []);
    expect(graph.nodes).toEqual([]);
    expect(graph.edges).toEqual([]);
  });

  it('handles shows only (no writers, no links)', () => {
    const shows: Show[] = [
      { id: 1, imdbId: 'tt001', title: 'Show 1', yearStart: 2000, yearEnd: 2005 },
    ];
    const graph = buildBipartiteGraph(shows, [], []);

    expect(graph.nodes).toHaveLength(1);
    expect(graph.nodes[0].type).toBe('show');
    expect(graph.edges).toEqual([]);
  });

  it('handles writers only (no shows, no links)', () => {
    const writers: Writer[] = [
      { id: 1, imdbId: 'nm001', name: 'Writer 1' },
    ];
    const graph = buildBipartiteGraph([], writers, []);

    expect(graph.nodes).toHaveLength(1);
    expect(graph.nodes[0].type).toBe('writer');
    expect(graph.edges).toEqual([]);
  });

  it('handles links referencing non-existent entities', () => {
    const shows: Show[] = [
      { id: 1, imdbId: 'tt001', title: 'Show 1', yearStart: 2000, yearEnd: 2005 },
    ];
    const writers: Writer[] = [
      { id: 1, imdbId: 'nm001', name: 'Writer 1' },
    ];
    // Link references show 999 and writer 999 which don't exist
    const links: ShowWriterLink[] = [
      { showId: 999, writerId: 999, role: null, episodeCount: null },
      { showId: 1, writerId: 1, role: 'creator', episodeCount: 10 },
    ];

    const graph = buildBipartiteGraph(shows, writers, links);

    // Edges are created regardless - they just won't point to real nodes
    expect(graph.edges).toHaveLength(2);
    expect(graph.nodes).toHaveLength(2);
  });

  it('handles duplicate links (same show-writer pair)', () => {
    const shows: Show[] = [
      { id: 1, imdbId: 'tt001', title: 'Show 1', yearStart: 2000, yearEnd: 2005 },
    ];
    const writers: Writer[] = [
      { id: 1, imdbId: 'nm001', name: 'Writer 1' },
    ];
    const links: ShowWriterLink[] = [
      { showId: 1, writerId: 1, role: 'creator', episodeCount: 10 },
      { showId: 1, writerId: 1, role: 'writer', episodeCount: 20 },
    ];

    const graph = buildBipartiteGraph(shows, writers, links);

    // Both links become separate edges
    expect(graph.edges).toHaveLength(2);
  });

  it('handles shows with all null year fields', () => {
    const shows: Show[] = [
      { id: 1, imdbId: 'tt001', title: 'Unknown Dates', yearStart: null, yearEnd: null },
    ];
    const graph = buildBipartiteGraph(shows, [], []);

    expect(graph.nodes[0].data).toEqual(shows[0]);
  });

  it('handles writers with all optional fields undefined', () => {
    const writers: Writer[] = [
      { id: 1, imdbId: 'nm001', name: 'Minimal Writer' },
    ];
    const graph = buildBipartiteGraph([], writers, []);

    const node = graph.nodes[0];
    expect(node.label).toBe('Minimal Writer');
    expect((node.data as Writer).imageUrl).toBeUndefined();
    expect((node.data as Writer).bio).toBeUndefined();
  });

  it('handles zero episode count', () => {
    const shows: Show[] = [{ id: 1, imdbId: 'tt001', title: 'Show', yearStart: 2020, yearEnd: null }];
    const writers: Writer[] = [{ id: 1, imdbId: 'nm001', name: 'Writer' }];
    const links: ShowWriterLink[] = [
      { showId: 1, writerId: 1, role: 'consultant', episodeCount: 0 },
    ];

    const graph = buildBipartiteGraph(shows, writers, links);
    expect(graph.edges[0].weight).toBe(0);
  });
});

describe('buildShowOverlapGraph edge cases', () => {
  it('returns empty graph for empty inputs', () => {
    const graph = buildShowOverlapGraph([], [], []);
    expect(graph.nodes).toEqual([]);
    expect(graph.edges).toEqual([]);
  });

  it('returns nodes but no edges when no writers overlap', () => {
    const shows: Show[] = [
      { id: 1, imdbId: 'tt001', title: 'Show A', yearStart: 2000, yearEnd: 2005 },
      { id: 2, imdbId: 'tt002', title: 'Show B', yearStart: 2010, yearEnd: 2015 },
    ];
    const writers: Writer[] = [
      { id: 1, imdbId: 'nm001', name: 'Writer A' },
      { id: 2, imdbId: 'nm002', name: 'Writer B' },
    ];
    const links: ShowWriterLink[] = [
      { showId: 1, writerId: 1, role: 'creator', episodeCount: 10 },
      { showId: 2, writerId: 2, role: 'creator', episodeCount: 10 },
    ];

    const graph = buildShowOverlapGraph(shows, writers, links);

    expect(graph.nodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(0);
  });

  it('handles single show', () => {
    const shows: Show[] = [
      { id: 1, imdbId: 'tt001', title: 'Only Show', yearStart: 2000, yearEnd: 2005 },
    ];
    const writers: Writer[] = [
      { id: 1, imdbId: 'nm001', name: 'Writer' },
    ];
    const links: ShowWriterLink[] = [
      { showId: 1, writerId: 1, role: 'creator', episodeCount: 10 },
    ];

    const graph = buildShowOverlapGraph(shows, writers, links);

    expect(graph.nodes).toHaveLength(1);
    expect(graph.edges).toHaveLength(0);
  });

  it('handles all shows sharing all writers (complete graph)', () => {
    const shows: Show[] = [
      { id: 1, imdbId: 'tt001', title: 'Show A', yearStart: 2000, yearEnd: 2005 },
      { id: 2, imdbId: 'tt002', title: 'Show B', yearStart: 2010, yearEnd: 2015 },
      { id: 3, imdbId: 'tt003', title: 'Show C', yearStart: 2020, yearEnd: null },
    ];
    const writers: Writer[] = [
      { id: 1, imdbId: 'nm001', name: 'Shared Writer' },
    ];
    const links: ShowWriterLink[] = [
      { showId: 1, writerId: 1, role: 'creator', episodeCount: 10 },
      { showId: 2, writerId: 1, role: 'creator', episodeCount: 10 },
      { showId: 3, writerId: 1, role: 'creator', episodeCount: 10 },
    ];

    const graph = buildShowOverlapGraph(shows, writers, links);

    // Complete graph of 3 nodes = 3 edges (A-B, A-C, B-C)
    expect(graph.nodes).toHaveLength(3);
    expect(graph.edges).toHaveLength(3);
    expect(graph.edges.every(e => e.weight === 1)).toBe(true);
  });
});

describe('filterConnectedNodes edge cases', () => {
  it('returns empty graph for empty input', () => {
    const filtered = filterConnectedNodes({ nodes: [], edges: [] });
    expect(filtered.nodes).toEqual([]);
    expect(filtered.edges).toEqual([]);
  });

  it('removes all nodes when there are no edges', () => {
    const graph: Graph = {
      nodes: [
        { id: 'show-1', type: 'show', label: 'Show 1', data: { id: 1, imdbId: 'tt001', title: 'Show 1', yearStart: 2000, yearEnd: 2005 } },
        { id: 'show-2', type: 'show', label: 'Show 2', data: { id: 2, imdbId: 'tt002', title: 'Show 2', yearStart: 2010, yearEnd: 2015 } },
      ],
      edges: [],
    };

    const filtered = filterConnectedNodes(graph);
    expect(filtered.nodes).toEqual([]);
  });

  it('keeps all nodes when all are connected', () => {
    const graph: Graph = {
      nodes: [
        { id: 'show-1', type: 'show', label: 'Show 1', data: { id: 1, imdbId: 'tt001', title: 'Show 1', yearStart: 2000, yearEnd: 2005 } },
        { id: 'show-2', type: 'show', label: 'Show 2', data: { id: 2, imdbId: 'tt002', title: 'Show 2', yearStart: 2010, yearEnd: 2015 } },
      ],
      edges: [
        { source: 'show-1', target: 'show-2', weight: 1 },
      ],
    };

    const filtered = filterConnectedNodes(graph);
    expect(filtered.nodes).toHaveLength(2);
  });

  it('handles self-loops', () => {
    const graph: Graph = {
      nodes: [
        { id: 'show-1', type: 'show', label: 'Show 1', data: { id: 1, imdbId: 'tt001', title: 'Show 1', yearStart: 2000, yearEnd: 2005 } },
        { id: 'show-2', type: 'show', label: 'Show 2', data: { id: 2, imdbId: 'tt002', title: 'Show 2', yearStart: 2010, yearEnd: 2015 } },
      ],
      edges: [
        { source: 'show-1', target: 'show-1', weight: 1 }, // self-loop
      ],
    };

    const filtered = filterConnectedNodes(graph);
    // show-1 is connected via self-loop, show-2 is not
    expect(filtered.nodes).toHaveLength(1);
    expect(filtered.nodes[0].id).toBe('show-1');
  });
});

describe('filterByWeight edge cases', () => {
  it('returns empty graph for empty input', () => {
    const filtered = filterByWeight({ nodes: [], edges: [] }, 1);
    expect(filtered.nodes).toEqual([]);
    expect(filtered.edges).toEqual([]);
  });

  it('removes all edges when minWeight is higher than all weights', () => {
    const graph: Graph = {
      nodes: [
        { id: 'show-1', type: 'show', label: 'Show 1', data: { id: 1, imdbId: 'tt001', title: 'Show 1', yearStart: 2000, yearEnd: 2005 } },
        { id: 'show-2', type: 'show', label: 'Show 2', data: { id: 2, imdbId: 'tt002', title: 'Show 2', yearStart: 2010, yearEnd: 2015 } },
      ],
      edges: [
        { source: 'show-1', target: 'show-2', weight: 5 },
      ],
    };

    const filtered = filterByWeight(graph, 10);
    expect(filtered.edges).toEqual([]);
    expect(filtered.nodes).toEqual([]);
  });

  it('keeps all edges when minWeight is 0', () => {
    const graph: Graph = {
      nodes: [
        { id: 'show-1', type: 'show', label: 'Show 1', data: { id: 1, imdbId: 'tt001', title: 'Show 1', yearStart: 2000, yearEnd: 2005 } },
        { id: 'show-2', type: 'show', label: 'Show 2', data: { id: 2, imdbId: 'tt002', title: 'Show 2', yearStart: 2010, yearEnd: 2015 } },
      ],
      edges: [
        { source: 'show-1', target: 'show-2', weight: 1 },
      ],
    };

    const filtered = filterByWeight(graph, 0);
    expect(filtered.edges).toHaveLength(1);
  });

  it('handles negative minWeight (keeps all)', () => {
    const graph: Graph = {
      nodes: [
        { id: 'show-1', type: 'show', label: 'Show 1', data: { id: 1, imdbId: 'tt001', title: 'Show 1', yearStart: 2000, yearEnd: 2005 } },
        { id: 'show-2', type: 'show', label: 'Show 2', data: { id: 2, imdbId: 'tt002', title: 'Show 2', yearStart: 2010, yearEnd: 2015 } },
      ],
      edges: [
        { source: 'show-1', target: 'show-2', weight: 0 },
      ],
    };

    const filtered = filterByWeight(graph, -1);
    expect(filtered.edges).toHaveLength(1);
  });

  it('handles zero-weight edges', () => {
    const graph: Graph = {
      nodes: [
        { id: 'show-1', type: 'show', label: 'Show 1', data: { id: 1, imdbId: 'tt001', title: 'Show 1', yearStart: 2000, yearEnd: 2005 } },
        { id: 'show-2', type: 'show', label: 'Show 2', data: { id: 2, imdbId: 'tt002', title: 'Show 2', yearStart: 2010, yearEnd: 2015 } },
      ],
      edges: [
        { source: 'show-1', target: 'show-2', weight: 0 },
      ],
    };

    // minWeight of 1 should remove weight-0 edge
    const filtered = filterByWeight(graph, 1);
    expect(filtered.edges).toEqual([]);
  });
});

describe('buildVennData edge cases', () => {
  it('handles empty shows', () => {
    const venn = buildVennData([], [], []);
    expect(venn.sets).toEqual([]);
    expect(venn.showLabels).toEqual({});
  });

  it('handles single show', () => {
    const shows: Show[] = [
      { id: 1, imdbId: 'tt001', title: 'Only Show', yearStart: 2000, yearEnd: 2005 },
    ];
    const writers: Writer[] = [
      { id: 1, imdbId: 'nm001', name: 'Writer' },
    ];
    const links: ShowWriterLink[] = [
      { showId: 1, writerId: 1, role: 'creator', episodeCount: 10 },
    ];

    const venn = buildVennData(shows, writers, links);

    expect(venn.sets).toHaveLength(1);
    expect(venn.sets[0].sets).toEqual(['S1']);
    expect(venn.sets[0].size).toBe(1);
  });

  it('handles shows with no writers', () => {
    const shows: Show[] = [
      { id: 1, imdbId: 'tt001', title: 'Empty Show', yearStart: 2000, yearEnd: 2005 },
    ];

    const venn = buildVennData(shows, [], []);

    expect(venn.sets).toHaveLength(1);
    expect(venn.sets[0].size).toBe(0);
  });

  it('handles shows with no overlap (disjoint sets)', () => {
    const shows: Show[] = [
      { id: 1, imdbId: 'tt001', title: 'Show A', yearStart: 2000, yearEnd: 2005 },
      { id: 2, imdbId: 'tt002', title: 'Show B', yearStart: 2010, yearEnd: 2015 },
    ];
    const writers: Writer[] = [
      { id: 1, imdbId: 'nm001', name: 'Writer A' },
      { id: 2, imdbId: 'nm002', name: 'Writer B' },
    ];
    const links: ShowWriterLink[] = [
      { showId: 1, writerId: 1, role: 'creator', episodeCount: 10 },
      { showId: 2, writerId: 2, role: 'creator', episodeCount: 10 },
    ];

    const venn = buildVennData(shows, writers, links);

    // Should have 2 individual sets but no intersection
    expect(venn.sets).toHaveLength(2);
    expect(venn.sets.every(s => s.sets.length === 1)).toBe(true);
  });

  it('handles 2 shows with complete overlap', () => {
    const shows: Show[] = [
      { id: 1, imdbId: 'tt001', title: 'Show A', yearStart: 2000, yearEnd: 2005 },
      { id: 2, imdbId: 'tt002', title: 'Show B', yearStart: 2010, yearEnd: 2015 },
    ];
    const writers: Writer[] = [
      { id: 1, imdbId: 'nm001', name: 'Shared Writer' },
    ];
    const links: ShowWriterLink[] = [
      { showId: 1, writerId: 1, role: 'creator', episodeCount: 10 },
      { showId: 2, writerId: 1, role: 'creator', episodeCount: 10 },
    ];

    const venn = buildVennData(shows, writers, links);

    // 2 individual sets + 1 intersection
    expect(venn.sets).toHaveLength(3);

    const intersection = venn.sets.find(s => s.sets.length === 2);
    expect(intersection?.size).toBe(1);
  });
});

describe('computeGraphStats edge cases', () => {
  it('handles empty graph', () => {
    const stats = computeGraphStats({ nodes: [], edges: [] });

    expect(stats.nodeCount).toBe(0);
    expect(stats.edgeCount).toBe(0);
    expect(stats.showCount).toBe(0);
    expect(stats.writerCount).toBe(0);
    expect(stats.avgDegree).toBe(0);
    expect(stats.maxWeight).toBe(0);
  });

  it('handles graph with only show nodes', () => {
    const graph: Graph = {
      nodes: [
        { id: 'show-1', type: 'show', label: 'Show', data: { id: 1, imdbId: 'tt001', title: 'Show', yearStart: 2000, yearEnd: 2005 } },
      ],
      edges: [],
    };

    const stats = computeGraphStats(graph);

    expect(stats.showCount).toBe(1);
    expect(stats.writerCount).toBe(0);
    expect(stats.avgDegree).toBe(0);
  });

  it('handles graph with only writer nodes', () => {
    const graph: Graph = {
      nodes: [
        { id: 'writer-1', type: 'writer', label: 'Writer', data: { id: 1, imdbId: 'nm001', name: 'Writer' } },
      ],
      edges: [],
    };

    const stats = computeGraphStats(graph);

    expect(stats.showCount).toBe(0);
    expect(stats.writerCount).toBe(1);
  });

  it('calculates avgDegree correctly for simple graph', () => {
    const graph: Graph = {
      nodes: [
        { id: 'show-1', type: 'show', label: 'Show', data: { id: 1, imdbId: 'tt001', title: 'Show', yearStart: 2000, yearEnd: 2005 } },
        { id: 'writer-1', type: 'writer', label: 'Writer', data: { id: 1, imdbId: 'nm001', name: 'Writer' } },
      ],
      edges: [
        { source: 'writer-1', target: 'show-1', weight: 10 },
      ],
    };

    const stats = computeGraphStats(graph);

    // Each node has degree 1, so avg = 2/2 = 1
    expect(stats.avgDegree).toBe(1);
  });

  it('handles negative weights', () => {
    const graph: Graph = {
      nodes: [
        { id: 'show-1', type: 'show', label: 'Show', data: { id: 1, imdbId: 'tt001', title: 'Show', yearStart: 2000, yearEnd: 2005 } },
        { id: 'writer-1', type: 'writer', label: 'Writer', data: { id: 1, imdbId: 'nm001', name: 'Writer' } },
      ],
      edges: [
        { source: 'writer-1', target: 'show-1', weight: -5 },
      ],
    };

    const stats = computeGraphStats(graph);

    // Math.max(0, -5) = 0
    expect(stats.maxWeight).toBe(0);
  });

  it('handles very large weights', () => {
    const graph: Graph = {
      nodes: [
        { id: 'show-1', type: 'show', label: 'Show', data: { id: 1, imdbId: 'tt001', title: 'Show', yearStart: 2000, yearEnd: 2005 } },
        { id: 'writer-1', type: 'writer', label: 'Writer', data: { id: 1, imdbId: 'nm001', name: 'Writer' } },
      ],
      edges: [
        { source: 'writer-1', target: 'show-1', weight: Number.MAX_SAFE_INTEGER },
      ],
    };

    const stats = computeGraphStats(graph);
    expect(stats.maxWeight).toBe(Number.MAX_SAFE_INTEGER);
  });
});

describe('Large dataset performance characteristics', () => {
  it('handles moderately large graph (100 shows, 50 writers)', () => {
    const shows: Show[] = Array.from({ length: 100 }, (_, i) => ({
      id: i + 1,
      imdbId: `tt${String(i + 1).padStart(7, '0')}`,
      title: `Show ${i + 1}`,
      yearStart: 2000 + (i % 20),
      yearEnd: 2005 + (i % 20),
    }));

    const writers: Writer[] = Array.from({ length: 50 }, (_, i) => ({
      id: i + 1,
      imdbId: `nm${String(i + 1).padStart(7, '0')}`,
      name: `Writer ${i + 1}`,
    }));

    // Each writer works on 2-5 random shows
    const links: ShowWriterLink[] = [];
    writers.forEach((writer, wi) => {
      const numShows = 2 + (wi % 4);
      for (let j = 0; j < numShows; j++) {
        links.push({
          showId: ((wi * 3 + j) % 100) + 1,
          writerId: writer.id,
          role: 'writer',
          episodeCount: 10 + j,
        });
      }
    });

    const graph = buildBipartiteGraph(shows, writers, links);
    const stats = computeGraphStats(graph);

    expect(stats.nodeCount).toBe(150);
    expect(stats.showCount).toBe(100);
    expect(stats.writerCount).toBe(50);
    expect(stats.edgeCount).toBeGreaterThan(0);
  });
});
