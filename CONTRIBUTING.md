# Contributing to Sonara

Thank you for your interest in contributing to Sonara! Sonara is designed as a Spotify-style, 100% offline, privacy-first local music player.

## Development Setup

1. **Prerequisites**:
   - Node.js 20+
   - npm 10+
   - Windows 10/11 (for native desktop build)

2. **Installation**:
   ```bash
   git clone https://github.com/<your-username>/sonara.git
   cd sonara
   npm install
   ```

3. **Running the Web App locally**:
   ```bash
   npm run dev
   ```

4. **Running the Desktop App (Electron)**:
   ```bash
   npm run build && npm run build:electron && npx electron .
   ```

## Code Quality Standards

- **Zero Remote Dependencies / Telemetry**: Sonara must always run 100% offline. No external fonts, CDNs, or tracking scripts.
- **Type Safety**: Run `npm run typecheck` before opening a pull request.
- **Automated Tests**: Run `npm test` to verify Vitest test suites.

## Packaging Standalone Executable

To build the standalone Windows installer:
```bash
npm run dist
```
The resulting installer is saved to `dist-release/Sonara Setup 1.0.0.exe`.
