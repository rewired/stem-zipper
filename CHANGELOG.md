# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]
- Port project to an Electron + Vite (React + TypeScript) application.
- Add Tailwind based UI with folder selection, file table, progress display and action controls.
- Implement IPC between renderer and main processes for folder analysis, packing and developer tooling.
- Replace the Tkinter frontend and remove Python specific assets.
- Introduce shared constants, IPC contracts and validation helpers for reuse across processes.
