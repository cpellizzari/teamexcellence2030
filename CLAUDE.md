# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Static website for Team Excellence 2030, a youth basketball program with two teams (White and Blue). Tracks rosters and game statistics with password-protected stat entry. No build tools or frameworks — plain HTML/CSS/vanilla JS with Firebase Firestore for persistence.

## Running Locally

The site must be served over HTTP (not `file://`) for Firebase to work:

```bash
python3 -m http.server 8080
# Visit http://localhost:8080
```

## Tech Stack

- **Frontend:** HTML5, CSS3 (custom properties), vanilla JavaScript (ES2017+, async/await)
- **Database:** Firebase Firestore (compat SDK v9.23.0, loaded via CDN)
- **Fonts:** Google Fonts — Inter (body), Montserrat (headings)
- **Hosting target:** GitHub Pages

## Architecture

All pages share the same nav, CSS file, and `main.js`. Firebase is only loaded on pages that need it (`stats.html`, `enter-stats.html`).

**Script load order matters.** Pages that use Firebase load scripts in this order:
1. Firebase SDK (CDN) — `firebase-app-compat.js`, `firebase-firestore-compat.js`
2. `firebase-config.js` — initializes Firebase, exposes global `db`
3. `roster-data.js` — exposes global `TEAMS` and `STAT_FIELDS`
4. `main.js` — nav toggle, `formatDate()` utility
5. Page-specific JS (`stats-viewer.js` or `stats-entry.js`)

**Data flow:** `roster-data.js` is the source of truth for player names/numbers. Firestore `games` collection stores game documents with embedded player stat arrays. `stats-viewer.js` aggregates across games at query time (no pre-computed rollups).

## Firestore Data Model

Single collection `games`. Each document:
- `team`: "White" | "Blue"
- `game_info`: { date, opponent, league, score_te, score_opponent }
- `players`: array of { number, name, played, is_guest, home_team?, stats? }

Guest players have `is_guest: true` and `home_team` set to their real team. DNP players have `played: false` and no `stats` object.

## Stats Calculations

All derived stats are computed client-side in `stats-viewer.js`:
- **PTS** = FGM×2 + 3PM×3 + FTM
- **EFF** = PTS + REB + AST + STL + BLK − missed FG − missed FT − TO
- **Averages** divide by games played per player (DNP excluded from denominator)
- **JB** = Jump Balls (tracked stat from the stat sheet)

## Password Protection

Stat entry is gated by SHA-256 hash comparison (client-side only). The hash in `stats-entry.js` corresponds to password `TE2030`. To change: compute new hash with `echo -n "NEWPASS" | shasum -a 256` and update `PASSWORD_HASH`.

## Color Scheme

Derived from team logo (carolina blue background, navy basketball):
- `--carolina-blue: #6CACE4` — primary accent
- `--navy: #1B2A4A` — headers, nav, dark sections
- `--light-blue: #E1F0FB` — alternating table rows
- `--off-white: #F0F5FA` — page background

## Key Conventions

- No build step — edit files directly, refresh browser
- Single `styles.css` for all pages; page-specific styles use `<style>` blocks in HTML (e.g., `enter-stats.html` entry table styles)
- All JS uses `DOMContentLoaded` listeners and functional style (no classes)
- Roster changes go in `roster-data.js` only — team pages and entry form read from it dynamically

## Integration with read-stats Skill

The `read-stats` Claude Code skill outputs JSON from handwritten stat sheets. The stat entry page has a JSON import section at the bottom that accepts this output to pre-fill the form.
