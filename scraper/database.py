"""SQLite database operations for TV show writer data."""
import sqlite3
from pathlib import Path
from typing import Optional

DB_PATH = Path(__file__).parent.parent / "data" / "writers.db"


def get_connection() -> sqlite3.Connection:
    """Get a database connection, creating the database if needed."""
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Initialize the database schema."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.executescript("""
        CREATE TABLE IF NOT EXISTS shows (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            imdb_id TEXT UNIQUE NOT NULL,
            title TEXT NOT NULL,
            year_start INTEGER,
            year_end INTEGER,
            scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS writers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            imdb_id TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS show_writers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            show_id INTEGER NOT NULL,
            writer_id INTEGER NOT NULL,
            role TEXT,  -- e.g., "creator", "written by", "teleplay by"
            episode_count INTEGER,
            FOREIGN KEY (show_id) REFERENCES shows(id),
            FOREIGN KEY (writer_id) REFERENCES writers(id),
            UNIQUE(show_id, writer_id, role)
        );

        CREATE INDEX IF NOT EXISTS idx_show_writers_show ON show_writers(show_id);
        CREATE INDEX IF NOT EXISTS idx_show_writers_writer ON show_writers(writer_id);
    """)

    conn.commit()
    conn.close()


def insert_show(imdb_id: str, title: str, year_start: Optional[int] = None,
                year_end: Optional[int] = None) -> int:
    """Insert a show and return its ID. If exists, return existing ID."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT id FROM shows WHERE imdb_id = ?", (imdb_id,)
    )
    row = cursor.fetchone()
    if row:
        conn.close()
        return row["id"]

    cursor.execute(
        """INSERT INTO shows (imdb_id, title, year_start, year_end)
           VALUES (?, ?, ?, ?)""",
        (imdb_id, title, year_start, year_end)
    )
    show_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return show_id


def insert_writer(imdb_id: str, name: str) -> int:
    """Insert a writer and return their ID. If exists, return existing ID."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT id FROM writers WHERE imdb_id = ?", (imdb_id,)
    )
    row = cursor.fetchone()
    if row:
        conn.close()
        return row["id"]

    cursor.execute(
        "INSERT INTO writers (imdb_id, name) VALUES (?, ?)",
        (imdb_id, name)
    )
    writer_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return writer_id


def link_show_writer(show_id: int, writer_id: int, role: Optional[str] = None,
                     episode_count: Optional[int] = None) -> None:
    """Link a writer to a show with optional role and episode count."""
    conn = get_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """INSERT INTO show_writers (show_id, writer_id, role, episode_count)
               VALUES (?, ?, ?, ?)""",
            (show_id, writer_id, role, episode_count)
        )
        conn.commit()
    except sqlite3.IntegrityError:
        pass  # Already linked
    finally:
        conn.close()


def get_all_shows():
    """Get all shows from the database."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM shows ORDER BY title")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_all_writers():
    """Get all writers from the database."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM writers ORDER BY name")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_writer_shows(writer_id: int):
    """Get all shows a writer has worked on."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT s.*, sw.role, sw.episode_count
        FROM shows s
        JOIN show_writers sw ON s.id = sw.show_id
        WHERE sw.writer_id = ?
        ORDER BY s.title
    """, (writer_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_show_writers(show_id: int):
    """Get all writers for a show."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT w.*, sw.role, sw.episode_count
        FROM writers w
        JOIN show_writers sw ON w.id = sw.writer_id
        WHERE sw.show_id = ?
        ORDER BY w.name
    """, (show_id,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]


def get_writer_overlap():
    """Get writers who have worked on multiple shows with their shows."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT
            w.id as writer_id,
            w.name as writer_name,
            w.imdb_id as writer_imdb_id,
            GROUP_CONCAT(s.title, '|||') as shows,
            GROUP_CONCAT(s.id, '|||') as show_ids,
            COUNT(DISTINCT s.id) as show_count
        FROM writers w
        JOIN show_writers sw ON w.id = sw.writer_id
        JOIN shows s ON sw.show_id = s.id
        GROUP BY w.id
        HAVING COUNT(DISTINCT s.id) > 1
        ORDER BY show_count DESC, w.name
    """)
    rows = cursor.fetchall()
    conn.close()

    result = []
    for row in rows:
        d = dict(row)
        d['shows'] = d['shows'].split('|||') if d['shows'] else []
        d['show_ids'] = [int(x) for x in d['show_ids'].split('|||')] if d['show_ids'] else []
        result.append(d)
    return result
