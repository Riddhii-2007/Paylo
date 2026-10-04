# Contributing

Thank you for your interest in contributing to Expense Tracker! 

This is a local-first PWA. All data stays on the user's device. Please keep this principle in mind.

## Setup

1. Fork the repo and clone it locally.
2. Run `npm install` to install dependencies.
3. Run `npm run dev` to start the dev server.

## Making Changes

- **No external requests**: Do not add CDN links, analytics, or external API calls. Fonts and icons must be bundled.
- **Translations**: Keep all UI text in `src/lib/i18n.js` to support future localization.
- **Styling**: We use Tailwind CSS v4. Please stick to the custom theme tokens defined in `src/index.css`.

## Submitting a Pull Request

1. Create a new branch for your feature or bugfix.
2. Make your changes and test them locally.
3. If changing cycle logic, ensure `npm test` passes.
4. Submit a PR describing your changes.
