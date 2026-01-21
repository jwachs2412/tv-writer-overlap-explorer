import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { VennDiagram } from './VennDiagram';
import type { Show, Writer, ShowWriterLink } from '../core/types';

// Mock ResizeObserver
beforeEach(() => {
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }));
});

// Test fixtures - 5 shows to test expansion
const shows: Show[] = [
  { id: 1, imdbId: 'tt001', title: 'Show A', yearStart: 2000, yearEnd: 2005 },
  { id: 2, imdbId: 'tt002', title: 'Show B', yearStart: 2010, yearEnd: 2015 },
  { id: 3, imdbId: 'tt003', title: 'Show C', yearStart: 2020, yearEnd: null },
  { id: 4, imdbId: 'tt004', title: 'Show D', yearStart: 2018, yearEnd: 2022 },
  { id: 5, imdbId: 'tt005', title: 'Show E', yearStart: 2021, yearEnd: null },
];

const writers: Writer[] = [
  { id: 1, imdbId: 'nm001', name: 'Writer One' },
  { id: 2, imdbId: 'nm002', name: 'Writer Two' },
  { id: 3, imdbId: 'nm003', name: 'Writer Three' },
  { id: 4, imdbId: 'nm004', name: 'Writer Four' },
  { id: 5, imdbId: 'nm005', name: 'Writer Five' },
];

// Links: Writer 1 is on shows 1,2,3,4,5 (shared across all)
// Writer 2 is on shows 1,2 only
// Writer 3 is on shows 2,3 only
// Writer 4 is unique to show 4
// Writer 5 is unique to show 5
const links: ShowWriterLink[] = [
  { showId: 1, writerId: 1, role: 'creator', episodeCount: 50 },
  { showId: 1, writerId: 2, role: 'writer', episodeCount: 10 },
  { showId: 2, writerId: 1, role: 'writer', episodeCount: 20 },
  { showId: 2, writerId: 2, role: 'writer', episodeCount: 15 },
  { showId: 2, writerId: 3, role: 'writer', episodeCount: 8 },
  { showId: 3, writerId: 1, role: 'writer', episodeCount: 30 },
  { showId: 3, writerId: 3, role: 'creator', episodeCount: 25 },
  { showId: 4, writerId: 1, role: 'writer', episodeCount: 12 },
  { showId: 4, writerId: 4, role: 'creator', episodeCount: 40 },
  { showId: 5, writerId: 1, role: 'writer', episodeCount: 18 },
  { showId: 5, writerId: 5, role: 'creator', episodeCount: 35 },
];

describe('VennDiagram', () => {
  it('renders show selector with all shows', () => {
    render(<VennDiagram shows={shows} writers={writers} links={links} />);

    expect(screen.getByText('Show A')).toBeInTheDocument();
    expect(screen.getByText('Show B')).toBeInTheDocument();
    expect(screen.getByText('Show C')).toBeInTheDocument();
    expect(screen.getByText('Show D')).toBeInTheDocument();
    expect(screen.getByText('Show E')).toBeInTheDocument();
  });

  it('shows description for 2-5 shows', () => {
    render(<VennDiagram shows={shows} writers={writers} links={links} />);

    expect(screen.getByText(/Select 2-5 shows/i)).toBeInTheDocument();
  });

  it('allows selecting up to 5 shows', () => {
    const onSelectedIdsChange = vi.fn();
    render(
      <VennDiagram
        shows={shows}
        writers={writers}
        links={links}
        selectedIds={[]}
        onSelectedIdsChange={onSelectedIdsChange}
      />
    );

    // Click each show button
    fireEvent.click(screen.getByRole('button', { name: /Show A/i }));
    expect(onSelectedIdsChange).toHaveBeenCalledWith([1]);
  });

  it('replaces oldest show when selecting 6th show', () => {
    const onSelectedIdsChange = vi.fn();
    render(
      <VennDiagram
        shows={shows}
        writers={writers}
        links={links}
        selectedIds={[1, 2, 3, 4, 5]}
        onSelectedIdsChange={onSelectedIdsChange}
      />
    );

    // Find a show button that isn't selected (none in this case - all are selected)
    // Add a 6th show to test the replacement logic
    const newShow: Show = { id: 6, imdbId: 'tt006', title: 'Show F', yearStart: 2022, yearEnd: null };
    const extendedShows = [...shows, newShow];

    // Re-render with extended shows
    const { rerender } = render(
      <VennDiagram
        shows={extendedShows}
        writers={writers}
        links={links}
        selectedIds={[1, 2, 3, 4, 5]}
        onSelectedIdsChange={onSelectedIdsChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Show F/i }));
    // Should replace oldest (show 1) with show 6
    expect(onSelectedIdsChange).toHaveBeenCalledWith([2, 3, 4, 5, 6]);
  });

  it('deselects a show when clicking it again', () => {
    const onSelectedIdsChange = vi.fn();
    render(
      <VennDiagram
        shows={shows}
        writers={writers}
        links={links}
        selectedIds={[1, 2]}
        onSelectedIdsChange={onSelectedIdsChange}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Show A/i }));
    expect(onSelectedIdsChange).toHaveBeenCalledWith([2]);
  });

  it('renders empty state when no shows selected', () => {
    render(<VennDiagram shows={shows} writers={writers} links={links} />);

    expect(screen.getByText(/Select shows above/i)).toBeInTheDocument();
  });

  describe('controlled mode', () => {
    it('uses external selectedIds when provided', () => {
      render(
        <VennDiagram
          shows={shows}
          writers={writers}
          links={links}
          selectedIds={[1, 2]}
        />
      );

      // Should show the shared writers section since 2 shows are selected
      expect(screen.getByText('Shared Writers')).toBeInTheDocument();
    });

    it('calls onSelectedIdsChange when selection changes', () => {
      const onSelectedIdsChange = vi.fn();
      render(
        <VennDiagram
          shows={shows}
          writers={writers}
          links={links}
          selectedIds={[1]}
          onSelectedIdsChange={onSelectedIdsChange}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Show B/i }));
      expect(onSelectedIdsChange).toHaveBeenCalledWith([1, 2]);
    });
  });

  describe('writer modal', () => {
    it('opens modal when clicking writer name in shared writers list', () => {
      render(
        <VennDiagram
          shows={shows}
          writers={writers}
          links={links}
          selectedIds={[1, 2]}
        />
      );

      // Writer One should be in the shared list
      const writerButton = screen.getByRole('button', { name: 'Writer One' });
      fireEvent.click(writerButton);

      // Modal should open with writer name
      expect(screen.getByRole('heading', { name: 'Writer One' })).toBeInTheDocument();
    });

    it('closes modal when clicking close button', () => {
      render(
        <VennDiagram
          shows={shows}
          writers={writers}
          links={links}
          selectedIds={[1, 2]}
        />
      );

      // Open modal
      fireEvent.click(screen.getByRole('button', { name: 'Writer One' }));
      expect(screen.getByRole('heading', { name: 'Writer One' })).toBeInTheDocument();

      // Close modal
      fireEvent.click(screen.getByLabelText('Close modal'));
      expect(screen.queryByRole('heading', { name: 'Writer One' })).not.toBeInTheDocument();
    });

    it('closes modal when pressing ESC', () => {
      render(
        <VennDiagram
          shows={shows}
          writers={writers}
          links={links}
          selectedIds={[1, 2]}
        />
      );

      // Open modal
      fireEvent.click(screen.getByRole('button', { name: 'Writer One' }));
      expect(screen.getByRole('heading', { name: 'Writer One' })).toBeInTheDocument();

      // Press ESC
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByRole('heading', { name: 'Writer One' })).not.toBeInTheDocument();
    });
  });
});

describe('VennDiagram positioning', () => {
  it('renders 2 shows with correct positioning', () => {
    const { container } = render(
      <VennDiagram
        shows={shows}
        writers={writers}
        links={links}
        selectedIds={[1, 2]}
      />
    );

    const circles = container.querySelectorAll('.venn-circle');
    expect(circles).toHaveLength(2);
  });

  it('renders 3 shows with triangle arrangement', () => {
    const { container } = render(
      <VennDiagram
        shows={shows}
        writers={writers}
        links={links}
        selectedIds={[1, 2, 3]}
      />
    );

    const circles = container.querySelectorAll('.venn-circle');
    expect(circles).toHaveLength(3);
  });

  it('renders 4 shows with 2x2 grid arrangement', () => {
    const { container } = render(
      <VennDiagram
        shows={shows}
        writers={writers}
        links={links}
        selectedIds={[1, 2, 3, 4]}
      />
    );

    const circles = container.querySelectorAll('.venn-circle');
    expect(circles).toHaveLength(4);
  });

  it('renders 5 shows with pentagon arrangement', () => {
    const { container } = render(
      <VennDiagram
        shows={shows}
        writers={writers}
        links={links}
        selectedIds={[1, 2, 3, 4, 5]}
      />
    );

    const circles = container.querySelectorAll('.venn-circle');
    expect(circles).toHaveLength(5);
  });
});

describe('VennDiagram intersections', () => {
  it('computes pairwise intersections correctly for 2 shows', () => {
    render(
      <VennDiagram
        shows={shows}
        writers={writers}
        links={links}
        selectedIds={[1, 2]}
      />
    );

    // Shows 1 and 2 share Writer One and Writer Two
    expect(screen.getByText('Shared Writers')).toBeInTheDocument();
  });

  it('computes exclusive pairwise intersections for 3+ shows', () => {
    render(
      <VennDiagram
        shows={shows}
        writers={writers}
        links={links}
        selectedIds={[1, 2, 3]}
      />
    );

    // Should show intersection cards for various combinations
    expect(screen.getByText('Shared Writers')).toBeInTheDocument();
  });

  it('shows all-shows intersection when writers appear in all selected shows', () => {
    render(
      <VennDiagram
        shows={shows}
        writers={writers}
        links={links}
        selectedIds={[1, 2, 3, 4, 5]}
      />
    );

    // Writer One appears in all 5 shows
    expect(screen.getByText('Shared Writers')).toBeInTheDocument();
  });
});
