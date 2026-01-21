/**
 * Modal component showing all shows a writer has worked on.
 * Allows adding shows directly to the Venn diagram comparison.
 */

import { useEffect, useCallback } from 'react';
import type { Writer, Show, ShowWriterLink } from '../core/types';
import './WriterShowsModal.css';

interface WriterShow {
  show: Show;
  episodeCount: number | null;
  role: string | null;
}

interface WriterShowsModalProps {
  readonly writer: Writer;
  readonly shows: ReadonlyArray<Show>;
  readonly links: ReadonlyArray<ShowWriterLink>;
  readonly selectedVennIds: ReadonlyArray<number>;
  readonly onClose: () => void;
  readonly onAddToVenn: (showId: number) => void;
}

const imdbShowUrl = (imdbId: string) => `https://www.imdb.com/title/${imdbId}/`;
const imdbWriterUrl = (imdbId: string) => `https://www.imdb.com/name/${imdbId}/`;

export const WriterShowsModal = ({
  writer,
  shows,
  links,
  selectedVennIds,
  onClose,
  onAddToVenn,
}: WriterShowsModalProps) => {
  // Get all shows this writer has worked on
  const writerShows: WriterShow[] = links
    .filter(link => link.writerId === writer.id)
    .map(link => {
      const show = shows.find(s => s.id === link.showId);
      return show ? {
        show,
        episodeCount: link.episodeCount,
        role: link.role,
      } : null;
    })
    .filter((item): item is WriterShow => item !== null)
    .sort((a, b) => {
      // Sort by year descending, then by title
      const yearA = a.show.yearStart ?? 0;
      const yearB = b.show.yearStart ?? 0;
      if (yearB !== yearA) return yearB - yearA;
      return a.show.title.localeCompare(b.show.title);
    });

  // Handle ESC key to close
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const formatYears = (show: Show) => {
    if (!show.yearStart) return '';
    if (show.yearEnd && show.yearEnd !== show.yearStart) {
      return `${show.yearStart}–${show.yearEnd}`;
    }
    if (show.yearEnd === show.yearStart) {
      return `${show.yearStart}`;
    }
    return `${show.yearStart}–`;
  };

  return (
    <div className="writer-modal-backdrop" onClick={handleBackdropClick}>
      <div className="writer-modal">
        <header className="writer-modal-header">
          <div className="writer-info">
            <h2>{writer.name}</h2>
            <a
              href={imdbWriterUrl(writer.imdbId)}
              target="_blank"
              rel="noopener noreferrer"
              className="imdb-link"
            >
              View on IMDB
            </a>
          </div>
          <button className="close-btn" onClick={onClose} aria-label="Close modal">
            &times;
          </button>
        </header>

        <div className="writer-modal-content">
          <h3>{writerShows.length} Shows</h3>
          <ul className="show-list">
            {writerShows.map(({ show, episodeCount, role }) => {
              const isInVenn = selectedVennIds.includes(show.id);
              const vennFull = selectedVennIds.length >= 5;

              return (
                <li key={show.id} className="show-item">
                  <div className="show-details">
                    <div className="show-title-row">
                      <a
                        href={imdbShowUrl(show.imdbId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="show-title"
                      >
                        {show.title}
                      </a>
                      <span className="show-years">{formatYears(show)}</span>
                    </div>
                    <div className="show-meta">
                      {episodeCount && (
                        <span className="episode-count">
                          {episodeCount} episode{episodeCount !== 1 ? 's' : ''}
                        </span>
                      )}
                      {role && <span className="role">{role}</span>}
                    </div>
                  </div>
                  <button
                    className={`add-to-venn-btn ${isInVenn ? 'in-venn' : ''}`}
                    onClick={() => !isInVenn && onAddToVenn(show.id)}
                    disabled={isInVenn || vennFull}
                    title={
                      isInVenn
                        ? 'Already in comparison'
                        : vennFull
                          ? 'Comparison is full (5 shows max)'
                          : 'Add to comparison'
                    }
                  >
                    {isInVenn ? 'In Comparison' : 'Add to Venn'}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
};
