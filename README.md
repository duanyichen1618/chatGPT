# Inventory Sync Web Listener

This project is a minimal Electron + Node.js + SQLite (via `sql.js`) desktop app that monitors configured web pages, listens to network request headers, and stores those values locally for inventory synchronization workflows.

## Features
- Configure multiple pages and multiple listeners per page.
- Listen for specific request headers and upsert values into SQLite by a configured primary key.
- Per-page auto refresh (seconds) with automatic re-listening.
- Manual or automatic login workflows driven by selectors and credentials.
- Configuration stored in a local JSON file and loaded at startup.

## Quick Start
1. Install dependencies:
   ```bash
   npm install
   ```
2. Copy `config.sample.json` to `config.json` and update it:
   ```bash
   cp config.sample.json config.json
   ```
3. Start the app:
   ```bash
   npm start
   ```

The app uses `config.json` in the repository root by default. The SQLite database defaults to `./data.sqlite` unless overridden.

## Configuration
See `config.sample.json` for a full example. Important fields:
- `pages[]`
  - `url`: target page URL
  - `refreshSeconds`: auto-refresh interval
  - `listeners[]`: header listeners with `headerName` and `primaryKey`
  - `autoLogin`: workflow configuration (selectors and credentials)

## Notes
- Auto-login runs when the current URL differs from the configured page URL.
- After clicking the login button, the app waits 10 seconds and navigates to `postLoginUrl`.

