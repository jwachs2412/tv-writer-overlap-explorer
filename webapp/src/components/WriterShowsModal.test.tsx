import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WriterShowsModal } from './WriterShowsModal';
import type { Show, Writer, ShowWriterLink } from '../core/types';

const writer: Writer = {
  id: 1,
  imdbId: 'nm001',
  name: 'Test Writer',
};

const shows: Show[] = [
  { id: 1, imdbId: 'tt001', title: 'Show A', yearStart: 2000, yearEnd: 2005 },
  { id: 2, imdbId: 'tt002', title: 'Show B', yearStart: 2010, yearEnd: 2015 },
  { id: 3, imdbId: 'tt003', title: 'Show C', yearStart: 2020, yearEnd: null },
];

const links: ShowWriterLink[] = [
  { showId: 1, writerId: 1, role: 'creator', episodeCount: 50 },
  { showId: 2, writerId: 1, role: 'writer', episodeCount: 20 },
  { showId: 3, writerId: 1, role: 'writer', episodeCount: 10 },
];

describe('WriterShowsModal', () => {
  const defaultProps = {
    writer,
    shows,
    links,
    selectedVennIds: [] as readonly number[],
    onClose: vi.fn(),
    onAddToVenn: vi.fn(),
  };

  it('renders writer name in header', () => {
    render(<WriterShowsModal {...defaultProps} />);

    expect(screen.getByRole('heading', { name: 'Test Writer' })).toBeInTheDocument();
  });

  it('renders IMDB link for writer', () => {
    render(<WriterShowsModal {...defaultProps} />);

    const imdbLink = screen.getByRole('link', { name: /View on IMDB/i });
    expect(imdbLink).toHaveAttribute('href', 'https://www.imdb.com/name/nm001/');
  });

  it('renders all shows the writer worked on', () => {
    render(<WriterShowsModal {...defaultProps} />);

    expect(screen.getByText('Show A')).toBeInTheDocument();
    expect(screen.getByText('Show B')).toBeInTheDocument();
    expect(screen.getByText('Show C')).toBeInTheDocument();
  });

  it('shows show count in header', () => {
    render(<WriterShowsModal {...defaultProps} />);

    expect(screen.getByText('3 Shows')).toBeInTheDocument();
  });

  it('displays episode count for each show', () => {
    render(<WriterShowsModal {...defaultProps} />);

    expect(screen.getByText('50 episodes')).toBeInTheDocument();
    expect(screen.getByText('20 episodes')).toBeInTheDocument();
    expect(screen.getByText('10 episodes')).toBeInTheDocument();
  });

  it('displays year range for shows', () => {
    render(<WriterShowsModal {...defaultProps} />);

    expect(screen.getByText('2000–2005')).toBeInTheDocument();
    expect(screen.getByText('2010–2015')).toBeInTheDocument();
    expect(screen.getByText('2020–')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<WriterShowsModal {...defaultProps} onClose={onClose} />);

    fireEvent.click(screen.getByLabelText('Close modal'));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    render(<WriterShowsModal {...defaultProps} onClose={onClose} />);

    fireEvent.click(screen.getByTestId?.('modal-backdrop') ?? document.querySelector('.writer-modal-backdrop')!);
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when ESC key is pressed', () => {
    const onClose = vi.fn();
    render(<WriterShowsModal {...defaultProps} onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onAddToVenn when Add to Venn button is clicked', () => {
    const onAddToVenn = vi.fn();
    render(<WriterShowsModal {...defaultProps} onAddToVenn={onAddToVenn} />);

    const addButtons = screen.getAllByRole('button', { name: /Add to Venn/i });
    fireEvent.click(addButtons[0]);
    expect(onAddToVenn).toHaveBeenCalledWith(3); // Show C (sorted by year desc)
  });

  it('shows "In Comparison" for shows already in Venn', () => {
    render(<WriterShowsModal {...defaultProps} selectedVennIds={[1, 2]} />);

    expect(screen.getAllByText('In Comparison')).toHaveLength(2);
    expect(screen.getByText('Add to Venn')).toBeInTheDocument();
  });

  it('disables Add button for shows already in Venn', () => {
    render(<WriterShowsModal {...defaultProps} selectedVennIds={[1]} />);

    const inComparisonButtons = screen.getAllByRole('button', { name: /In Comparison/i });
    expect(inComparisonButtons[0]).toBeDisabled();
  });

  it('disables Add button when Venn is full (5 shows)', () => {
    render(
      <WriterShowsModal
        {...defaultProps}
        selectedVennIds={[10, 20, 30, 40, 50]}
      />
    );

    const addButtons = screen.getAllByRole('button', { name: /Add to Venn/i });
    addButtons.forEach(button => {
      expect(button).toBeDisabled();
    });
  });

  it('sorts shows by year descending', () => {
    render(<WriterShowsModal {...defaultProps} />);

    const showItems = screen.getAllByRole('listitem');
    const titles = showItems.map(item => item.querySelector('.show-title')?.textContent);

    // Show C (2020), Show B (2010), Show A (2000)
    expect(titles).toEqual(['Show C', 'Show B', 'Show A']);
  });

  it('does not call onAddToVenn for already selected show', () => {
    const onAddToVenn = vi.fn();
    render(
      <WriterShowsModal
        {...defaultProps}
        selectedVennIds={[1]}
        onAddToVenn={onAddToVenn}
      />
    );

    const inComparisonButton = screen.getByRole('button', { name: /In Comparison/i });
    fireEvent.click(inComparisonButton);
    expect(onAddToVenn).not.toHaveBeenCalled();
  });
});

describe('WriterShowsModal edge cases', () => {
  const defaultProps = {
    writer,
    shows,
    links,
    selectedVennIds: [] as readonly number[],
    onClose: vi.fn(),
    onAddToVenn: vi.fn(),
  };

  it('handles writer with no shows', () => {
    const writerWithNoShows: Writer = { id: 99, imdbId: 'nm099', name: 'No Shows Writer' };
    render(
      <WriterShowsModal
        {...defaultProps}
        writer={writerWithNoShows}
        links={[]}
      />
    );

    expect(screen.getByText('0 Shows')).toBeInTheDocument();
  });

  it('handles singular episode count', () => {
    const singleEpisodeLinks: ShowWriterLink[] = [
      { showId: 1, writerId: 1, role: 'writer', episodeCount: 1 },
    ];
    render(
      <WriterShowsModal
        {...defaultProps}
        links={singleEpisodeLinks}
      />
    );

    expect(screen.getByText('1 episode')).toBeInTheDocument();
  });

  it('handles null episode count', () => {
    const nullEpisodeLinks: ShowWriterLink[] = [
      { showId: 1, writerId: 1, role: 'writer', episodeCount: null },
    ];
    render(
      <WriterShowsModal
        {...defaultProps}
        links={nullEpisodeLinks}
      />
    );

    // Should not show episode count for null values
    expect(screen.queryByText(/episode/i)).not.toBeInTheDocument();
  });

  it('handles show with same start and end year', () => {
    const sameYearShows: Show[] = [
      { id: 1, imdbId: 'tt001', title: 'Mini Series', yearStart: 2020, yearEnd: 2020 },
    ];
    render(
      <WriterShowsModal
        {...defaultProps}
        shows={sameYearShows}
      />
    );

    expect(screen.getByText('2020')).toBeInTheDocument();
  });

  it('handles show with no year', () => {
    const noYearShows: Show[] = [
      { id: 1, imdbId: 'tt001', title: 'Unknown Year Show', yearStart: null, yearEnd: null },
    ];
    render(
      <WriterShowsModal
        {...defaultProps}
        shows={noYearShows}
      />
    );

    // Should not show year for null values
    const showItem = screen.getByRole('listitem');
    expect(showItem.querySelector('.show-years')?.textContent).toBe('');
  });
});
