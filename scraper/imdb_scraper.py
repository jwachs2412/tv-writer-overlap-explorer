"""IMDB scraper for TV show writer information."""
import json
import re
import time
from typing import Optional
from dataclasses import dataclass

import requests
from bs4 import BeautifulSoup

from database import init_db, insert_show, insert_writer, link_show_writer


@dataclass
class ShowInfo:
    imdb_id: str
    title: str
    year_start: Optional[int] = None
    year_end: Optional[int] = None


@dataclass
class WriterInfo:
    imdb_id: str
    name: str
    role: Optional[str] = None
    episode_count: Optional[int] = None


HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
}


def search_show(title: str) -> Optional[ShowInfo]:
    """Search IMDB for a TV show and return its info."""
    search_url = f"https://www.imdb.com/find/?q={requests.utils.quote(title)}&s=tt&ttype=tv"

    response = requests.get(search_url, headers=HEADERS, timeout=30)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "lxml")

    # Find the first TV series result
    results = soup.select('a[href*="/title/tt"]')

    for result in results:
        href = result.get("href", "")
        match = re.search(r"/title/(tt\d+)", href)
        if match:
            imdb_id = match.group(1)
            # Get title text
            title_text = result.get_text(strip=True)
            if title_text:
                # Extract year if present
                year_match = re.search(r"\((\d{4})\)", title_text)
                year_start = int(year_match.group(1)) if year_match else None
                clean_title = re.sub(r"\s*\(\d{4}.*?\)\s*", "", title_text).strip()

                print(f"  Found: {clean_title} ({imdb_id})")
                return ShowInfo(
                    imdb_id=imdb_id,
                    title=clean_title or title,
                    year_start=year_start
                )

    return None


def get_show_details(imdb_id: str) -> Optional[ShowInfo]:
    """Get detailed show information from its IMDB page."""
    url = f"https://www.imdb.com/title/{imdb_id}/"

    response = requests.get(url, headers=HEADERS, timeout=30)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "lxml")

    # Get title
    title_elem = soup.select_one('h1[data-testid="hero__pageTitle"]')
    title = title_elem.get_text(strip=True) if title_elem else imdb_id

    # Get years
    year_start = None
    year_end = None
    year_elem = soup.select_one('a[href*="releaseinfo"]')
    if year_elem:
        year_text = year_elem.get_text(strip=True)
        year_match = re.search(r"(\d{4})(?:\s*[-–]\s*(\d{4})?)?", year_text)
        if year_match:
            year_start = int(year_match.group(1))
            if year_match.group(2):
                year_end = int(year_match.group(2))

    return ShowInfo(imdb_id=imdb_id, title=title, year_start=year_start, year_end=year_end)


def get_show_writers(imdb_id: str) -> list[WriterInfo]:
    """Get all writers for a TV show from the full credits page."""
    url = f"https://www.imdb.com/title/{imdb_id}/fullcredits/"

    response = requests.get(url, headers=HEADERS, timeout=30)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "lxml")
    writers = []

    # Modern IMDB uses __NEXT_DATA__ JSON
    next_data = soup.find("script", id="__NEXT_DATA__")
    if next_data:
        try:
            data = json.loads(next_data.get_text())
            props = data.get("props", {}).get("pageProps", {})
            content = props.get("contentData", {})
            categories = content.get("categories", [])

            for cat in categories:
                if "writ" in cat.get("name", "").lower():
                    section = cat.get("section", {})
                    items = section.get("items", [])

                    for item in items:
                        writer_imdb_id = item.get("id", "")
                        name = item.get("rowTitle", "")
                        role = item.get("attributes", "")

                        episode_count = None
                        ep_data = item.get("episodicCreditData", {})
                        if ep_data:
                            episode_count = ep_data.get("episodeCount")

                        if writer_imdb_id and name:
                            writers.append(WriterInfo(
                                imdb_id=writer_imdb_id,
                                name=name,
                                role=role,
                                episode_count=episode_count
                            ))
        except (json.JSONDecodeError, KeyError, TypeError):
            pass

    # Deduplicate by imdb_id, keeping the one with the most episodes
    seen = {}
    for w in writers:
        if w.imdb_id not in seen:
            seen[w.imdb_id] = w
        elif w.episode_count and (not seen[w.imdb_id].episode_count or
                                   w.episode_count > seen[w.imdb_id].episode_count):
            seen[w.imdb_id] = w

    return list(seen.values())


def get_writer_other_shows(writer_imdb_id: str) -> list[ShowInfo]:
    """Get other TV shows a writer has worked on."""
    url = f"https://www.imdb.com/name/{writer_imdb_id}/"

    response = requests.get(url, headers=HEADERS, timeout=30)
    response.raise_for_status()

    soup = BeautifulSoup(response.text, "lxml")
    shows = []

    # Find writing credits in filmography
    # Look for the writer section
    sections = soup.find_all("div", {"data-testid": "nm-flmg-cat-writer"})

    if not sections:
        # Try alternate approach - look for any section with writing credits
        all_sections = soup.select('div[id*="writer"], div[class*="writer"]')
        sections = all_sections

    for section in sections:
        links = section.find_all("a", href=re.compile(r"/title/tt\d+"))
        for link in links:
            href = link.get("href", "")
            match = re.search(r"/title/(tt\d+)", href)
            if not match:
                continue

            imdb_id = match.group(1)
            title = link.get_text(strip=True)

            # Skip if no title
            if not title or title == imdb_id:
                continue

            shows.append(ShowInfo(imdb_id=imdb_id, title=title))

    # Also try to find shows in the general filmography
    filmography = soup.select('a[href*="/title/tt"]')
    for link in filmography:
        href = link.get("href", "")
        match = re.search(r"/title/(tt\d+)", href)
        if match:
            imdb_id = match.group(1)
            # Check if this is a TV series by looking at nearby text
            parent = link.find_parent()
            if parent and ("TV Series" in parent.get_text() or "TV Mini" in parent.get_text()):
                title = link.get_text(strip=True)
                if title and title != imdb_id:
                    shows.append(ShowInfo(imdb_id=imdb_id, title=title))

    # Deduplicate
    seen = set()
    unique = []
    for show in shows:
        if show.imdb_id not in seen:
            seen.add(show.imdb_id)
            unique.append(show)

    return unique


def scrape_show(title: str, depth: int = 0, max_depth: int = 1) -> bool:
    """Scrape a show and optionally follow writers to their other shows."""
    print(f"\n{'  ' * depth}Searching for: {title}")

    show_info = search_show(title)
    if not show_info:
        print(f"{'  ' * depth}  Could not find show: {title}")
        return False

    # Get more details
    details = get_show_details(show_info.imdb_id)
    if details:
        show_info = details

    # Insert show into database
    show_id = insert_show(
        show_info.imdb_id,
        show_info.title,
        show_info.year_start,
        show_info.year_end
    )
    print(f"{'  ' * depth}  Added show: {show_info.title} (ID: {show_id})")

    # Get writers
    time.sleep(1)  # Be nice to IMDB
    writers = get_show_writers(show_info.imdb_id)
    print(f"{'  ' * depth}  Found {len(writers)} writers")

    for writer in writers:
        writer_id = insert_writer(writer.imdb_id, writer.name)
        link_show_writer(show_id, writer_id, writer.role, writer.episode_count)
        print(f"{'  ' * depth}    - {writer.name} ({writer.episode_count or '?'} episodes)")

    return True


def main():
    """Main entry point."""
    # Seed shows
    seed_shows = [
        "Gilmore Girls",
        "Scrubs",
        "Better Off Ted",
        "The Rehearsal",
        "Arrested Development",
        "Jury Duty",
        "Brooklyn Nine-Nine",
        "Bob's Burgers",
        "King of the Hill",
        "Santa Clarita Diet",
    ]

    print("Initializing database...")
    init_db()

    print(f"\nScraping {len(seed_shows)} seed shows...")

    for show in seed_shows:
        try:
            scrape_show(show)
            time.sleep(2)  # Be nice to IMDB
        except Exception as e:
            print(f"Error scraping {show}: {e}")
            continue

    print("\n" + "=" * 50)
    print("Scraping complete!")

    # Show summary
    from database import get_all_shows, get_all_writers, get_writer_overlap

    shows = get_all_shows()
    writers = get_all_writers()
    overlaps = get_writer_overlap()

    print(f"\nTotal shows: {len(shows)}")
    print(f"Total writers: {len(writers)}")
    print(f"Writers with overlap: {len(overlaps)}")

    if overlaps:
        print("\nWriters appearing in multiple shows:")
        for overlap in overlaps[:10]:  # Top 10
            print(f"  {overlap['writer_name']}: {', '.join(overlap['shows'])}")


if __name__ == "__main__":
    main()
