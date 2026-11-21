# Operational Guide — Insightful (AI Data Analyst)

This guide covers daily operation, configuration, secrets, backups, updates and troubleshooting. For first-time setup see `installation-guide.md`.

---

## 1. Start, stop and status

| Task | How |
|---|---|
| Start (normal) | Double-click `setup-and-run.bat`. On later runs it starts directly. |
| Auto start at logon | Created by the installer as `Insightful-Autorun.lnk` in the Startup folder. It runs `setup-and-run.bat --run` (no browser opens). |
| Stop | Close the console window, or press `Ctrl+C` in it. |
| Disable auto start | Open `shell:startup` (Windows Run dialog) and delete `Insightful-Autorun.lnk`. |
| Check it is running | Open http://localhost:3001. The log should show `Insightful API listening on http://localhost:3001`. |
| Docker start / stop | `docker compose up -d` / `docker compose down` |
| Docker logs | `docker compose logs -f app` |

---

## 2. Configuration (`.env`)

`.env` lives in the project root. The server reads it at startup, so **restart the app after any change**.

| Key | Purpose | Notes |
|---|---|---|
| `PORT` | HTTP port (default `3001`) | Change if the port is in use. |
| `NODE_ENV` | `production` or `development` | Installer sets `production`. |
| `SESSION_SECRET` | Signs login sessions | Keep private. Changing it logs everyone out. |
| `ENCRYPTION_KEY` | Encrypts stored DB passwords and OpenRouter credentials | **Critical.** Changing it makes saved credentials unreadable. Back it up. |
| `ADMIN_SETUP_KEY` | One-time key for creating the first superuser | Remove after setup. |
| `ADMIN_EMAIL`, `ADMIN_NAME`, `ADMIN_PASSWORD` | Optional automatic superuser creation | Alternative to the setup form. |
| `DATA_DIR` | Folder for `app.db` and `app-data.json` | Default is `data\`. Use a protected folder if needed. |
| `TRUST_PROXY` | Set to `1` behind Caddy or nginx | Gives correct client IPs for rate limiting. |
| `COOKIE_SECURE` | `false` for plain HTTP (for example on an IP address) | Keep the default in production with HTTPS. |
| `APP_URL` | Sent to OpenRouter as the referer | Optional. |

Secrets must be unique per installation. Do not reuse values from `server\.env.example`.

---

## 3. Managing `.env` and `.env.enc`

- `.env` — plain text with real secrets. It is used by the app. **Never share or commit it.**
- `.env.enc` — the same content, encrypted with a password. This is the file you move between PCs.

Both are excluded from git by `.gitignore`.

### Change settings

```powershell
$env:ENV_PASSWORD = "<your password>"
node tools\env-crypt.mjs decrypt
# edit .env in a text editor
node tools\env-crypt.mjs encrypt
Remove-Item .env
```

The password is taken from `ENV_PASSWORD` or as a command argument: `node tools\env-crypt.mjs decrypt "<password>"`. The script does not prompt for it.

`decrypt` overwrites `.env` without asking, so back up any existing `.env` first.

### Ensure required values

```bat
node tools\ensure-env.mjs
```

Generates any missing or placeholder `SESSION_SECRET`, `ENCRYPTION_KEY` or `ADMIN_SETUP_KEY`. It warns if it creates a new `ENCRYPTION_KEY`, because that breaks saved database credentials.

### Change the encryption password

Run `decrypt` with the old password, then `encrypt` with the new one. Tell the team the new password through a separate channel.

### Security rules

- Delete the plain `.env` when you are not running the app from it.
- Keep the password out of documents, tickets and chat logs.
- A short password (such as one that is easy to guess) can be cracked offline if `.env.enc` leaks. Use a long passphrase.

---

## 4. Data and backups

| Item | Location | Back up? |
|---|---|---|
| Application state and users | `data\app.db` (SQLite) and `data\app-data.json` | Yes |
| Settings and secrets | `.env` and `.env.enc` | Yes, stored securely |
| `ENCRYPTION_KEY` | Inside `.env` | **Yes, separately from the data** |
| Docker data | Volume `app-data` (mounted at `/data`) | Yes |
| Uploaded CSV files | Loaded in the browser, not stored on the server | Keep your originals |

### Backup procedure

1. Stop the app (close the window or `docker compose down`).
2. Copy the `data\` folder and `.env.enc` to a protected location.
3. Store the `ENCRYPTION_KEY` and the `.env.enc` password separately.
4. Restart the app.

Do not copy `app.db` while the server is writing to it. Stop the app first.

### Restore

1. Install the app (see installation guide), but stop before first start.
2. Copy `data\` back into the project folder (or set `DATA_DIR`).
3. Restore `.env` with the **same** `ENCRYPTION_KEY` as the backup.
4. Start the app.

---

## 5. Administration

- Sign in as a superuser, then open **Admin settings → Application database** to choose SQLite3, MySQL or PostgreSQL.
- Use **Test connection** before **Save and switch**. The app copies its current state to the new database.
- External data sources are configured in **Connect data**. Database URLs are sent per request and are not saved by that feature.
- Keep at least one superuser account. Do not share superuser accounts.

---

## 6. Updating the application

From the project folder:

```bat
git pull
npm ci
npm run build
```

Then restart the app. Back up `data\` and `.env.enc` before updating.

Docker:

```bat
git pull
docker compose up -d --build
```

---

## 7. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Installer says wrong password | Typo or wrong `.env.enc` | Retry (3 attempts). The file cannot be opened without the correct password. |
| `Node.js 18 or newer is required` | Old Node.js | Install Node.js LTS and rerun. |
| Browser shows an error or blank page | Build is missing | Run `npm run build` and restart. |
| `Port 3001 in use` | Another app uses the port | Set `PORT` in `.env` and restart. Update the URL. |
| Setup key rejected | Wrong or removed `ADMIN_SETUP_KEY` | Copy the value from the original `.env` or `.env.enc`. Restart after editing `.env`. |
| Login does not stick on `http://<ip>:3333` | Secure cookies over HTTP | Set `COOKIE_SECURE=false` (only for plain HTTP) and restart. |
| Saved database connection fails after a restore | `ENCRYPTION_KEY` differs from the backup | Restore the original `ENCRYPTION_KEY`. A new key cannot read old credentials. |
| Logged out after changing `.env` | `SESSION_SECRET` changed | Expected. Sign in again. |
| Rate limit errors behind a proxy | Missing `TRUST_PROXY` | Set `TRUST_PROXY=1`. |
| Autorun does not start | Shortcut deleted or moved | Rerun `setup-and-run.bat` once to recreate it. |
| Docker app unhealthy | Container start failed | `docker compose logs app`, then check `.env`. |

---

## 8. Checklist

- [ ] `.env` and `.env.enc` are not in git and not shared by email or chat.
- [ ] `ENCRYPTION_KEY` is backed up separately.
- [ ] `ADMIN_SETUP_KEY` is removed after the first superuser is created.
- [ ] `data\` is backed up on a schedule.
- [ ] `COOKIE_SECURE=true` and HTTPS are used for any network access.
- [ ] Plain `.env` is deleted when not in use.
