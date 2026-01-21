/**
 * Interactive Venn diagram visualization.
 * Select 2-3 shows to see their writer overlap.
 * Large circles with unique writer lists below, shared writers in cards.
 */

import { useState, useMemo, useRef, useEffect } from 'react';
import type { Show, Writer, ShowWriterLink, ShowWithWriters } from '../core/types';
import { enrichShowsWithWriters } from '../core/overlap';
import { WriterShowsModal } from './WriterShowsModal';
import './VennDiagram.css';

interface VennDiagramProps {
  readonly shows: ReadonlyArray<Show>;
  readonly writers: ReadonlyArray<Writer>;
  readonly links: ReadonlyArray<ShowWriterLink>;
  readonly selectedIds?: ReadonlyArray<number>;
  readonly onSelectedIdsChange?: (ids: number[]) => void;
  readonly onAddToVenn?: (showId: number) => void;
}

interface CircleData {
  show: ShowWithWriters;
  cx: number;
  cy: number;
  r: number;
  color: string;
  uniqueWriters: ReadonlyArray<Writer>;
}

const COLORS = ['#667eea', '#f093fb', '#64d2c8', '#ffa726', '#ab47bc'];
const GRADIENTS = [
  ['#667eea', '#5a6fd6'],
  ['#f093fb', '#d580e8'],
  ['#64d2c8', '#4fc3b8'],
  ['#ffa726', '#fb8c00'],
  ['#ab47bc', '#8e24aa'],
];

const imdbShowUrl = (imdbId: string) => `https://www.imdb.com/title/${imdbId}/`;
const imdbWriterUrl = (imdbId: string) => `https://www.imdb.com/name/${imdbId}/`;

export const VennDiagram = ({
  shows,
  writers,
  links,
  selectedIds: controlledSelectedIds,
  onSelectedIdsChange,
  onAddToVenn,
}: VennDiagramProps) => {
  // Internal state for uncontrolled mode
  const [internalSelectedIds, setInternalSelectedIds] = useState<number[]>([]);
  const [selectedWriter, setSelectedWriter] = useState<Writer | null>(null);

  // Use controlled or internal state
  const isControlled = controlledSelectedIds !== undefined;
  const selectedIds = isControlled ? [...controlledSelectedIds] : internalSelectedIds;

  const setSelectedIds = (updater: number[] | ((prev: number[]) => number[])) => {
    const newIds = typeof updater === 'function' ? updater(selectedIds) : updater;
    if (isControlled && onSelectedIdsChange) {
      onSelectedIdsChange(newIds);
    } else {
      setInternalSelectedIds(newIds);
    }
  };

  const [expandedLists, setExpandedLists] = useState<Set<number>>(new Set());
  const [expandedIntersections, setExpandedIntersections] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  const enrichedShows = useMemo(
    () => enrichShowsWithWriters(shows, writers, links),
    [shows, writers, links]
  );

  const selectedShows = useMemo(
    () => enrichedShows.filter(s => selectedIds.includes(s.id)),
    [enrichedShows, selectedIds]
  );

  const toggleShow = (id: number) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) {
        return prev.filter(x => x !== id);
      }
      if (prev.length >= 5) {
        return [...prev.slice(1), id];
      }
      return [...prev, id];
    });
  };

  const toggleListExpanded = (showId: number) => {
    setExpandedLists(prev => {
      const next = new Set(prev);
      if (next.has(showId)) {
        next.delete(showId);
      } else {
        next.add(showId);
      }
      return next;
    });
  };

  const toggleIntersectionExpanded = (key: string) => {
    setExpandedIntersections(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const getUniqueWriters = (show: ShowWithWriters, otherShows: ShowWithWriters[]): Writer[] => {
    const otherWriterIds = new Set(
      otherShows.flatMap(s => s.writers.map(w => w.id))
    );
    return show.writers.filter(w => !otherWriterIds.has(w.id));
  };

  // Large circles - fill most of the container
  const svgHeight = 700;
  const baseRadius = Math.min(containerWidth * 0.28, 220);

  interface CircleDataWithTextPos extends CircleData {
    textX: number;
    textY: number;
  }

  const getCirclePositions = (): CircleDataWithTextPos[] => {
    if (selectedShows.length === 0) return [];

    const centerX = containerWidth / 2;
    const centerY = svgHeight / 2;

    if (selectedShows.length === 1) {
      const r = baseRadius * 1.3;
      return [{
        show: selectedShows[0],
        cx: centerX,
        cy: centerY,
        r,
        color: COLORS[0],
        uniqueWriters: selectedShows[0].writers,
        textX: centerX,
        textY: centerY,
      }];
    }

    if (selectedShows.length === 2) {
      const r = baseRadius * 1.1;
      const overlap = r * 0.5; // circles overlap by half radius
      const textOffset = r * 0.45; // text positioned in unique area
      return [
        {
          show: selectedShows[0],
          cx: centerX - overlap,
          cy: centerY,
          r,
          color: COLORS[0],
          uniqueWriters: getUniqueWriters(selectedShows[0], [selectedShows[1]]),
          textX: centerX - overlap - textOffset,
          textY: centerY,
        },
        {
          show: selectedShows[1],
          cx: centerX + overlap,
          cy: centerY,
          r,
          color: COLORS[1],
          uniqueWriters: getUniqueWriters(selectedShows[1], [selectedShows[0]]),
          textX: centerX + overlap + textOffset,
          textY: centerY,
        },
      ];
    }

    // 3 circles - triangle arrangement
    if (selectedShows.length === 3) {
      const r = baseRadius;
      const spread = r * 0.7; // how far apart circle centers are
      const textOffset = r * 0.5; // text positioned in unique area
      return [
        {
          show: selectedShows[0],
          cx: centerX,
          cy: centerY - spread * 0.7,
          r,
          color: COLORS[0],
          uniqueWriters: getUniqueWriters(selectedShows[0], [selectedShows[1], selectedShows[2]]),
          textX: centerX,
          textY: centerY - spread * 0.7 - textOffset,
        },
        {
          show: selectedShows[1],
          cx: centerX - spread,
          cy: centerY + spread * 0.6,
          r,
          color: COLORS[1],
          uniqueWriters: getUniqueWriters(selectedShows[1], [selectedShows[0], selectedShows[2]]),
          textX: centerX - spread - textOffset * 0.7,
          textY: centerY + spread * 0.6 + textOffset * 0.7,
        },
        {
          show: selectedShows[2],
          cx: centerX + spread,
          cy: centerY + spread * 0.6,
          r,
          color: COLORS[2],
          uniqueWriters: getUniqueWriters(selectedShows[2], [selectedShows[0], selectedShows[1]]),
          textX: centerX + spread + textOffset * 0.7,
          textY: centerY + spread * 0.6 + textOffset * 0.7,
        },
      ];
    }

    // 4 circles - 2x2 grid arrangement with overlapping centers
    if (selectedShows.length === 4) {
      const r = baseRadius * 0.85;
      const spread = r * 0.6; // distance from center
      const textOffset = r * 0.5;
      const positions = [
        { dx: -spread, dy: -spread * 0.7, tx: -1, ty: -1 },
        { dx: spread, dy: -spread * 0.7, tx: 1, ty: -1 },
        { dx: -spread, dy: spread * 0.7, tx: -1, ty: 1 },
        { dx: spread, dy: spread * 0.7, tx: 1, ty: 1 },
      ];
      return selectedShows.map((show, i) => {
        const others = selectedShows.filter((_, idx) => idx !== i);
        const pos = positions[i];
        return {
          show,
          cx: centerX + pos.dx,
          cy: centerY + pos.dy,
          r,
          color: COLORS[i],
          uniqueWriters: getUniqueWriters(show, others),
          textX: centerX + pos.dx + textOffset * 0.5 * pos.tx,
          textY: centerY + pos.dy + textOffset * 0.5 * pos.ty,
        };
      });
    }

    // 5 circles - pentagon arrangement
    const r = baseRadius * 0.75;
    const spread = r * 0.8; // distance from center
    const textOffset = r * 0.55;
    // Pentagon angles: start from top (-90deg), go clockwise
    const angles = [-90, -90 + 72, -90 + 144, -90 + 216, -90 + 288].map(a => (a * Math.PI) / 180);

    return selectedShows.map((show, i) => {
      const others = selectedShows.filter((_, idx) => idx !== i);
      const angle = angles[i];
      const cx = centerX + spread * Math.cos(angle);
      const cy = centerY + spread * Math.sin(angle);
      return {
        show,
        cx,
        cy,
        r,
        color: COLORS[i],
        uniqueWriters: getUniqueWriters(show, others),
        textX: cx + textOffset * Math.cos(angle) * 0.6,
        textY: cy + textOffset * Math.sin(angle) * 0.6,
      };
    });
  };

  const circles = getCirclePositions();

  // Helper to get writers in ALL of showsIn but NONE of showsOut
  const getExclusiveSharedWriters = (
    showsIn: ShowWithWriters[],
    showsOut: ShowWithWriters[]
  ): Writer[] => {
    if (showsIn.length === 0) return [];

    // Start with writers from the first show
    let shared = [...showsIn[0].writers];

    // Intersect with all other "in" shows
    for (let i = 1; i < showsIn.length; i++) {
      const writerIds = new Set(showsIn[i].writers.map(w => w.id));
      shared = shared.filter(w => writerIds.has(w.id));
    }

    // Exclude writers from all "out" shows
    for (const show of showsOut) {
      const writerIds = new Set(show.writers.map(w => w.id));
      shared = shared.filter(w => !writerIds.has(w.id));
    }

    return shared;
  };

  const getIntersections = () => {
    if (selectedShows.length < 2) return [];

    const result: Array<{
      shows: ShowWithWriters[];
      writers: ReadonlyArray<Writer>;
      key: string;
    }> = [];

    const n = selectedShows.length;

    // Compute pairwise intersections (A∩B excluding all others)
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const showsIn = [selectedShows[i], selectedShows[j]];
        const showsOut = selectedShows.filter((_, idx) => idx !== i && idx !== j);
        const writers = getExclusiveSharedWriters(showsIn, showsOut);

        if (writers.length > 0) {
          result.push({
            shows: showsIn,
            writers,
            key: `${selectedShows[i].id}-${selectedShows[j].id}`,
          });
        }
      }
    }

    // Compute "all shows" intersection (writers in every selected show)
    if (n >= 3) {
      const allSharedWriters = getExclusiveSharedWriters(selectedShows.slice(), []);
      if (allSharedWriters.length > 0) {
        result.push({
          shows: selectedShows.slice(),
          writers: allSharedWriters,
          key: 'all-shows',
        });
      }
    }

    return result;
  };

  const intersections = getIntersections();
  const totalSharedWriters = intersections.reduce((sum, i) => sum + i.writers.length, 0);

  return (
    <div className="venn-diagram" ref={containerRef}>
      <div className="venn-header">
        <div>
          <h2>Show Comparison</h2>
          <p className="description">
            Select 2-5 shows to visualize their writer overlap
          </p>
        </div>
      </div>

      <div className="show-selector">
        {enrichedShows.map(show => {
          const isSelected = selectedIds.includes(show.id);
          const colorIndex = isSelected ? selectedIds.indexOf(show.id) : -1;
          return (
            <button
              key={show.id}
              onClick={() => toggleShow(show.id)}
              className={`show-button ${isSelected ? 'selected' : ''}`}
              style={isSelected ? {
                background: `linear-gradient(135deg, ${GRADIENTS[colorIndex][0]}, ${GRADIENTS[colorIndex][1]})`,
                borderColor: COLORS[colorIndex],
              } : undefined}
            >
              <span className="show-title">{show.title}</span>
              <span className="writer-count">{show.writers.length} writers</span>
            </button>
          );
        })}
      </div>

      {selectedShows.length > 0 ? (
        <>
          {/* Large Venn Diagram SVG */}
          <div className="venn-svg-container">
            <svg
              width="100%"
              height={svgHeight}
              viewBox={`0 0 ${containerWidth} ${svgHeight}`}
              className="venn-svg"
              preserveAspectRatio="xMidYMid meet"
            >
              <defs>
                {COLORS.map((color, i) => (
                  <radialGradient key={i} id={`venn-grad-${i}`} cx="35%" cy="35%">
                    <stop offset="0%" stopColor={color} stopOpacity="0.9" />
                    <stop offset="50%" stopColor={color} stopOpacity="0.5" />
                    <stop offset="100%" stopColor={color} stopOpacity="0.3" />
                  </radialGradient>
                ))}
                <filter id="circle-glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="8" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
                <filter id="circle-shadow">
                  <feDropShadow dx="0" dy="4" stdDeviation="8" floodOpacity="0.5"/>
                </filter>
              </defs>

              {/* Circles - decorative elements first */}
              {circles.map((circle, i) => (
                <g key={`circle-bg-${circle.show.id}`} className="venn-circle-group">
                  {/* Outer glow - no pointer events */}
                  <circle
                    cx={circle.cx}
                    cy={circle.cy}
                    r={circle.r + 20}
                    fill="none"
                    stroke={circle.color}
                    strokeWidth={5}
                    opacity={0.3}
                    filter="url(#circle-glow)"
                    pointerEvents="none"
                  />
                  {/* Main circle - no pointer events so links are clickable */}
                  <circle
                    cx={circle.cx}
                    cy={circle.cy}
                    r={circle.r}
                    fill={`url(#venn-grad-${i})`}
                    stroke={circle.color}
                    strokeWidth={6}
                    className="venn-circle"
                    filter="url(#circle-shadow)"
                    pointerEvents="none"
                  />
                </g>
              ))}

              {/* Clickable labels - rendered on top of circles */}
              {circles.map((circle) => (
                <g key={`circle-label-${circle.show.id}`} className="venn-label-group">
                  <a
                    href={imdbShowUrl(circle.show.imdbId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="show-title-link"
                    style={{ pointerEvents: 'all' }}
                  >
                    <title>
                      {circle.show.title}
                      {'\n'}Total writers: {circle.show.writers.length}
                      {'\n'}Unique writers: {circle.uniqueWriters.length}
                      {'\n'}Click to view on IMDB
                    </title>
                    {/* Invisible hit area for easier clicking */}
                    <rect
                      x={circle.textX - 100}
                      y={circle.textY - 40}
                      width={200}
                      height={100}
                      fill="transparent"
                      pointerEvents="all"
                    />
                    <text
                      x={circle.textX}
                      y={circle.textY - 14}
                      textAnchor="middle"
                      className="circle-title"
                      fill="#fff"
                      fontSize={22}
                      fontWeight="700"
                      pointerEvents="all"
                    >
                      {circle.show.title.length > 20
                        ? circle.show.title.slice(0, 20) + '…'
                        : circle.show.title}
                    </text>
                    <text
                      x={circle.textX}
                      y={circle.textY + 16}
                      textAnchor="middle"
                      className="circle-subtitle"
                      fill="rgba(255,255,255,0.9)"
                      fontSize={17}
                      pointerEvents="all"
                    >
                      {circle.show.writers.length} writers
                    </text>
                    <text
                      x={circle.textX}
                      y={circle.textY + 42}
                      textAnchor="middle"
                      className="circle-unique"
                      fill="rgba(255,255,255,0.75)"
                      fontSize={14}
                      pointerEvents="all"
                    >
                      ({circle.uniqueWriters.length} unique)
                    </text>
                  </a>
                </g>
              ))}

              {/* Intersection count in center */}
              {totalSharedWriters > 0 && (
                <g className="intersection-badge">
                  <title>
                    {totalSharedWriters} writers work on multiple selected shows
                    {'\n'}See shared writers section below
                  </title>
                  <circle
                    cx={containerWidth / 2}
                    cy={svgHeight / 2}
                    r={38}
                    fill="rgba(0,0,0,0.5)"
                  />
                  <text
                    x={containerWidth / 2}
                    y={svgHeight / 2 - 4}
                    textAnchor="middle"
                    fill="#fff"
                    fontSize={24}
                    fontWeight="bold"
                  >
                    {totalSharedWriters}
                  </text>
                  <text
                    x={containerWidth / 2}
                    y={svgHeight / 2 + 16}
                    textAnchor="middle"
                    fill="rgba(255,255,255,0.85)"
                    fontSize={12}
                  >
                    shared
                  </text>
                </g>
              )}
            </svg>
          </div>

          {/* Unique Writers Lists - Below Diagram */}
          <div className="unique-writers-section">
            <h3>Unique Writers by Show</h3>
            <div className="unique-writers-grid">
              {circles.map((circle) => {
                const isListExpanded = expandedLists.has(circle.show.id);
                const hasMany = circle.uniqueWriters.length > 10;
                const writersToShow = isListExpanded
                  ? circle.uniqueWriters
                  : circle.uniqueWriters.slice(0, 10);

                return (
                  <div
                    key={circle.show.id}
                    className="unique-writers-card"
                    style={{ borderColor: circle.color }}
                  >
                    <div className="unique-card-header">
                      <div className="unique-card-title">
                        <span
                          className="color-dot"
                          style={{ background: circle.color }}
                        />
                        <a
                          href={imdbShowUrl(circle.show.imdbId)}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: circle.color }}
                        >
                          {circle.show.title}
                        </a>
                        <span className="unique-count">
                          {circle.uniqueWriters.length} unique
                        </span>
                      </div>
                      {hasMany && (
                        <button
                          className="expand-list-btn"
                          onClick={() => toggleListExpanded(circle.show.id)}
                          style={{ color: circle.color }}
                        >
                          {isListExpanded ? 'Collapse' : 'Expand'}
                        </button>
                      )}
                    </div>
                    <ul className="unique-writers-list">
                      {writersToShow.map(w => (
                        <li key={w.id}>
                          <button
                            onClick={() => setSelectedWriter(w)}
                            className="writer-name-btn"
                          >
                            {w.name}
                          </button>
                          <a
                            href={imdbWriterUrl(w.imdbId)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="imdb-mini-link"
                            title="View on IMDB"
                          >
                            ↗
                          </a>
                        </li>
                      ))}
                    </ul>
                    {!isListExpanded && hasMany && (
                      <div className="more-indicator">
                        +{circle.uniqueWriters.length - 10} more writers
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Shared Writers Cards */}
          {intersections.length > 0 && (
            <div className="intersections-panel">
              <h3>Shared Writers</h3>
              <div className="intersection-cards">
                {intersections.map(int => {
                  const isIntExpanded = expandedIntersections.has(int.key);
                  const hasMany = int.writers.length > 10;
                  const writersToShow = isIntExpanded
                    ? int.writers
                    : int.writers.slice(0, 10);

                  return (
                    <div key={int.key} className="intersection-card">
                      <div className="intersection-header">
                        <span className="intersection-count-badge">{int.writers.length}</span>
                        <div className="intersection-shows">
                          {int.shows.map((s, i) => (
                            <span key={s.id}>
                              {i > 0 && <span className="show-sep"> ∩ </span>}
                              <a
                                href={imdbShowUrl(s.imdbId)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="show-name-link"
                              >
                                {s.title}
                              </a>
                            </span>
                          ))}
                        </div>
                        {hasMany && (
                          <button
                            className="expand-list-btn"
                            onClick={() => toggleIntersectionExpanded(int.key)}
                          >
                            {isIntExpanded ? 'Collapse' : 'Expand'}
                          </button>
                        )}
                      </div>
                      <ul className="shared-writer-list">
                        {writersToShow.map(w => (
                          <li key={w.id}>
                            <button
                              onClick={() => setSelectedWriter(w)}
                              className="writer-name-btn"
                            >
                              {w.name}
                            </button>
                            <a
                              href={imdbWriterUrl(w.imdbId)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="imdb-mini-link"
                              title="View on IMDB"
                            >
                              <span className="link-arrow">↗</span>
                            </a>
                          </li>
                        ))}
                      </ul>
                      {!isIntExpanded && hasMany && (
                        <div className="more-indicator">
                          +{int.writers.length - 10} more writers
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="empty-state">
          <p>Select shows above to compare their writers</p>
        </div>
      )}

      {/* Writer Shows Modal */}
      {selectedWriter && (
        <WriterShowsModal
          writer={selectedWriter}
          shows={shows}
          links={links}
          selectedVennIds={selectedIds}
          onClose={() => setSelectedWriter(null)}
          onAddToVenn={(showId) => {
            if (onAddToVenn) {
              onAddToVenn(showId);
            } else {
              // If no external handler, add directly to this component's selection
              setSelectedIds(prev => {
                if (prev.includes(showId)) return prev;
                if (prev.length >= 5) return [...prev.slice(1), showId];
                return [...prev, showId];
              });
            }
          }}
        />
      )}
    </div>
  );
};
