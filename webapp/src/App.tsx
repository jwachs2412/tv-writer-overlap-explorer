import { useState, useEffect } from 'react';
import './App.css';
import { VennDiagram } from './components/VennDiagram';
import { MatrixHeatmap } from './components/MatrixHeatmap';
import { ShowBrowser } from './components/ShowBrowser';
import { WriterDirectory } from './components/WriterDirectory';
import { fetchAllData, type AppData } from './shell/api';

type ViewMode = 'both' | 'compare' | 'matrix' | 'browse' | 'writers';

function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('both');

  // Lifted Venn diagram state for cross-component coordination
  const [vennSelectedIds, setVennSelectedIds] = useState<number[]>([]);

  // Handler to add a show to the Venn diagram from other components
  const handleAddToVenn = (showId: number) => {
    setVennSelectedIds(prev => {
      if (prev.includes(showId)) return prev;
      if (prev.length >= 5) {
        // Replace the oldest selection
        return [...prev.slice(1), showId];
      }
      return [...prev, showId];
    });
    // Switch to Compare view to show the result
    setViewMode('compare');
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const result = await fetchAllData();
        setData(result);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Auto-refresh data every 30 seconds to pick up crawler updates
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const result = await fetchAllData();
        setData(result);
      } catch {
        // Silently fail on refresh
      }
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="app loading">
        <div className="loading-content">
          <div className="spinner" />
          <h1>TV Writer Overlap Explorer</h1>
          <p>Loading show data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app error">
        <h1>TV Writer Overlap Explorer</h1>
        <p className="error-message">Error: {error}</p>
        <p>
          Make sure the API server is running:{' '}
          <code>cd scraper && python3 api.py</code>
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="app">
        <h1>TV Writer Overlap Explorer</h1>
        <p>No data available</p>
      </div>
    );
  }

  return (
    <div className="app">
      <header>
        <h1>TV Writer Overlap Explorer</h1>
        <p className="subtitle">
          Discover connections between {data.shows.length} TV shows through their {data.writers.length} writers
        </p>

        <nav className="view-tabs">
          <button
            className={viewMode === 'both' ? 'active' : ''}
            onClick={() => setViewMode('both')}
          >
            Overview
          </button>
          <button
            className={viewMode === 'compare' ? 'active' : ''}
            onClick={() => setViewMode('compare')}
          >
            Compare Shows
          </button>
          <button
            className={viewMode === 'matrix' ? 'active' : ''}
            onClick={() => setViewMode('matrix')}
          >
            Full Matrix
          </button>
          <button
            className={viewMode === 'browse' ? 'active' : ''}
            onClick={() => setViewMode('browse')}
          >
            Browse Shows
          </button>
          <button
            className={viewMode === 'writers' ? 'active' : ''}
            onClick={() => setViewMode('writers')}
          >
            Writers
          </button>
        </nav>
      </header>

      <main>
        {(viewMode === 'both' || viewMode === 'compare') && (
          <section className="visualization">
            <VennDiagram
              shows={data.shows}
              writers={data.writers}
              links={data.links}
              selectedIds={vennSelectedIds}
              onSelectedIdsChange={setVennSelectedIds}
            />
          </section>
        )}

        {(viewMode === 'both' || viewMode === 'matrix') && (
          <section className="visualization">
            <MatrixHeatmap
              shows={data.shows}
              writers={data.writers}
              links={data.links}
            />
          </section>
        )}

        {viewMode === 'browse' && (
          <section className="visualization">
            <ShowBrowser
              shows={data.shows}
              writers={data.writers}
              links={data.links}
              onAddToVenn={handleAddToVenn}
              selectedVennIds={vennSelectedIds}
            />
          </section>
        )}

        {viewMode === 'writers' && (
          <section className="visualization">
            <WriterDirectory />
          </section>
        )}
      </main>

      <footer>
        <p>
          Data from IMDB · Click any show or writer name to view on IMDB
        </p>
      </footer>
    </div>
  );
}

export default App;
