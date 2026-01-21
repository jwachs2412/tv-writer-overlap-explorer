/**
 * Show browser for discovering shows through writer connections.
 * Select a show to see related shows ranked by shared writers.
 */

import { useState, useMemo } from 'react';
import type { Show, Writer, ShowWriterLink, ShowWithWriters } from '../core/types';
import { enrichShowsWithWriters, getSharedWriters } from '../core/overlap';
import { WriterShowsModal } from './WriterShowsModal';
import './ShowBrowser.css';

interface ShowBrowserProps {
  readonly shows: ReadonlyArray<Show>;
  readonly writers: ReadonlyArray<Writer>;
  readonly links: ReadonlyArray<ShowWriterLink>;
  readonly onAddToVenn?: (showId: number) => void;
  readonly selectedVennIds?: ReadonlyArray<number>;
}

interface RelatedShow {
  show: ShowWithWriters;
  sharedWriters: ReadonlyArray<Writer>;
  score: number;
}

const imdbShowUrl = (imdbId: string) => `https://www.imdb.com/title/${imdbId}/`;
const imdbWriterUrl = (imdbId: string) => `https://www.imdb.com/name/${imdbId}/`;

export const ShowBrowser = ({
  shows,
  writers,
  links,
  onAddToVenn,
  selectedVennIds = [],
}: ShowBrowserProps) => {
  const [selectedShowId, setSelectedShowId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedWriters, setExpandedWriters] = useState<number | null>(null);
  const [selectedWriter, setSelectedWriter] = useState<Writer | null>(null);

  const enrichedShows = useMemo(
    () => enrichShowsWithWriters(shows, writers, links),
    [shows, writers, links]
  );

  const filteredShows = useMemo(() => {
    if (!searchQuery.trim()) return enrichedShows;
    const query = searchQuery.toLowerCase();
    return enrichedShows.filter(show =>
      show.title.toLowerCase().includes(query)
    );
  }, [enrichedShows, searchQuery]);

  const selectedShow = useMemo(
    () => enrichedShows.find(s => s.id === selectedShowId) ?? null,
    [enrichedShows, selectedShowId]
  );

  const relatedShows = useMemo((): RelatedShow[] => {
    if (!selectedShow) return [];

    const related: RelatedShow[] = [];

    for (const show of enrichedShows) {
      if (show.id === selectedShow.id) continue;

      const sharedWriters = getSharedWriters(selectedShow, show);
      if (sharedWriters.length > 0) {
        related.push({
          show,
          sharedWriters,
          score: sharedWriters.length,
        });
      }
    }

    return related.sort((a, b) => b.score - a.score);
  }, [enrichedShows, selectedShow]);

  const handleShowSelect = (showId: number) => {
    setSelectedShowId(showId);
    setExpandedWriters(null);
  };

  return (
    <div className="show-browser">
      <h2>Discover Shows</h2>
      <p className="description">
        Select a show to find related shows through shared writers
      </p>

      <div className="browser-layout">
        {/* Show list */}
        <div className="show-list-panel">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search shows..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="clear-search"
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>

          <div className="show-list">
            {filteredShows.map(show => (
              <button
                key={show.id}
                onClick={() => handleShowSelect(show.id)}
                className={`show-item ${selectedShowId === show.id ? 'selected' : ''}`}
              >
                <span className="show-title">{show.title}</span>
                <span className="writer-badge">{show.writers.length}</span>
              </button>
            ))}
            {filteredShows.length === 0 && (
              <div className="no-results">No shows match "{searchQuery}"</div>
            )}
          </div>
        </div>

        {/* Selected show details */}
        <div className="details-panel">
          {selectedShow ? (
            <>
              <div className="selected-show-header">
                <div className="show-info">
                  <h3>{selectedShow.title}</h3>
                  <a
                    href={imdbShowUrl(selectedShow.imdbId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="imdb-link"
                  >
                    View on IMDB ↗
                  </a>
                </div>
                <div className="show-stats">
                  <div className="stat">
                    <span className="stat-value">{selectedShow.writers.length}</span>
                    <span className="stat-label">writers</span>
                  </div>
                  <div className="stat">
                    <span className="stat-value">{relatedShows.length}</span>
                    <span className="stat-label">related shows</span>
                  </div>
                </div>
              </div>

              {relatedShows.length > 0 ? (
                <div className="related-shows">
                  <h4>Related Shows</h4>
                  <div className="related-list">
                    {relatedShows.map(({ show, sharedWriters, score }) => (
                      <div key={show.id} className="related-item">
                        <div className="related-header">
                          <button
                            onClick={() => handleShowSelect(show.id)}
                            className="related-title"
                          >
                            {show.title}
                          </button>
                          <div className="related-actions">
                            <span className="overlap-badge">
                              {score} shared
                            </span>
                            <a
                              href={imdbShowUrl(show.imdbId)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mini-link"
                              title="View on IMDB"
                            >
                              ↗
                            </a>
                          </div>
                        </div>

                        <button
                          onClick={() => setExpandedWriters(
                            expandedWriters === show.id ? null : show.id
                          )}
                          className="expand-writers"
                        >
                          {expandedWriters === show.id ? 'Hide' : 'Show'} writers
                        </button>

                        {expandedWriters === show.id && (
                          <ul className="shared-writers-list">
                            {sharedWriters.map(writer => (
                              <li key={writer.id}>
                                <button
                                  onClick={() => setSelectedWriter(writer)}
                                  className="writer-name-btn"
                                >
                                  {writer.name}
                                </button>
                                <a
                                  href={imdbWriterUrl(writer.imdbId)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="imdb-mini-link"
                                  title="View on IMDB"
                                >
                                  <span className="link-icon">↗</span>
                                </a>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="no-related">
                  <p>No related shows found with shared writers.</p>
                </div>
              )}
            </>
          ) : (
            <div className="empty-state">
              <div className="icon">📺</div>
              <p>Select a show from the list to discover related shows through their writers</p>
            </div>
          )}
        </div>
      </div>

      {/* Writer Shows Modal */}
      {selectedWriter && (
        <WriterShowsModal
          writer={selectedWriter}
          shows={shows}
          links={links}
          selectedVennIds={selectedVennIds}
          onClose={() => setSelectedWriter(null)}
          onAddToVenn={(showId) => {
            if (onAddToVenn) {
              onAddToVenn(showId);
            }
          }}
        />
      )}
    </div>
  );
};
