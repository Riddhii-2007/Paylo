# Paylo Expense Tracker

A 100% local-first, offline, installable personal expense tracker designed with a premium, quiet aesthetic.

## Deploy Your Own
Because this app has no backend and stores data locally via IndexedDB, anyone can host it for free on GitHub Pages.

1. Fork this repository.
2. Go to **Settings > Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions**.
4. GitHub will automatically deploy your app. You can access it at `https://<your-username>.github.io/Paylo`.

## Security & Data Safety
Your data lives **only on your device**. It is never sent to any server.

### Critical Warnings:
- **Do not clear your browser data or uninstall the app without backing up.** If you clear your browser's site data, your IndexedDB database will be wiped and your expenses will be lost forever.
- **Enable 2FA on GitHub.** To protect your deployed code, enable Two-Factor Authentication on your GitHub account.
- **Backup Regularly.** Use the in-app backup feature to export your data to a JSON or CSV file. Store these files securely.
- **App PIN Lock:** The optional app PIN lock only hides the UI; it does not encrypt the underlying IndexedDB database. Anyone with developer tools access to your unlocked phone could read the raw database.
- **Encrypted Backups:** If you use the password-protected backup feature, do not forget your password. We use AES-GCM encryption and there is no "forgot password" mechanism.

See `SECURITY.md` for more details.
