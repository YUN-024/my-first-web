# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is a single-page static HTML personal intro/portfolio site. There is no build tool, package manager, linter, or test framework — the repository is just `index.html`, `styles.css`, and `script.js`.

## Running

There is nothing to build or serve. Open `index.html` directly in a browser to view/test changes (e.g. double-click it in File Explorer, or `start index.html` from a shell).

## Structure

Markup, styles, and script are split by concern: `index.html` holds only the markup and links `styles.css` (`<head>`) and `script.js` (end of `<body>`). `script.js` is currently empty — all visual behavior is done in CSS. The `<body>` is divided into three sections:

- `.smoke` — a background layer of blurred, semi-transparent white blobs animated upward (`@keyframes rise1` / `rise2`) to simulate rising smoke. It sits behind `.content` via `z-index`.
- `.content` — the main centered column, containing:
  - `.brush` — an inline `<svg>` brush-stroke graphic. The jagged, hand-painted edge look comes from SVG filters (`feTurbulence` + `feDisplacementMap`) applied to plain `<rect>` shapes; this filter structure is what gives the strokes their irregular, organic outline and should be preserved when adjusting the artwork.
  - the `<h1>` title and the `.tags` hashtag-style list.
- `.credit` — small fixed-position text in the bottom-right corner.
