---
title: NPM Scripts
order: 3
---

# Npm Scripts

> $ npm run %SCRIPT_NAME%

## General

| Script Name | Description |
| --- | --- |
| `dev` | Start Electron as a development environment |
| `dev:debug` | Start Electron as a development environment (with vite debug) |
| `dev:debug:force` | Start Electron as a development environment (with vite debug + clean vite cache) |
| `build:pre` | Commands commonly run at build time. This script does not need to be run separately. |
| `build` | Build the package for the current operating system. |
| `build:all` | Build a specified package for the entire operating system (Requires cross-platform build configuration) |
| `build:dir` | `electron-builder` directory build |
| `build:mac` | Build preconfigured packages for macOS |
| `build:linux` | Build preconfigured packages for Linux |
| `build:win` | Build preconfigured packages for Windows |
| `lint` | ESLint code inspection. It does not modify the code. |
| `lint:fix` | ESLint code inspection. Use auto-fix to fix your code. |
| `format` | Prettier code inspection. It does not modify the code. |
| `format:fix` | Prettier code inspection. Use auto-fix to fix your code. |
| `test` | Build a package for testing and run tests against the test specification file. |
| `test:linux` | Build a package for testing and run tests against the test specification file. (for linux ci only) |

## For Documentation

Used only for contributing to project documentation. Must be run from the `docs` directory location.

| Script Name | Description                                                        |
| ----------- | ------------------------------------------------------------------ |
| `dev`       | Start the local document server. (For development)                 |
| `build`     | Build a local document server. Used only for GitHub page builders. |
| `serve`     | Start the local document server.                                   |
