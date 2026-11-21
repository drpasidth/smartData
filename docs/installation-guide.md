# Installation Guide — Insightful (AI Data Analyst)

This guide explains how to install Insightful on a Windows PC. There are three options:

| Option | Best for | Effort |
|---|---|---|
| **A. Automatic (`setup-and-run.bat`)** | Windows PC, daily use, auto-start at logon | Lowest |
| **B. Manual (Node.js)** | Developers, custom setups | Medium |
| **C. Docker Compose** | Server or shared host, HTTP on port 3333 | Medium |

---

## 1. Requirements

- Windows 10 or 11 (64-bit)
- Internet connection (for the first install: Node.js and npm packages)
- Administrator rights are helpful, but not required for Option A
- For Option C only: Docker Desktop
- The project folder, including `setup-and-run.bat`, `package.json` and `tools\`
- **Your `.env.enc` file** (encrypted settings, see section 3) and its password

> `.env.enc` and `.env` are **not** stored in git. Copy them securely from the original PC (USB drive, encrypted storage or a password manager). Never email them in plain text.

---

## 2. Get the project

Option 1 — clone from git:

```bat
git clone https://github.com/drpasidth/smartData.git
cd smartData
```

Option 2 — copy the project folder from the original PC (include `.env.enc`, excluding `node_modules` and `dist` if present).

---

## 3. Option A: Automatic install (recommended)

1. Copy `.env.enc` into the project folder (next to `setup-and-run.bat`).
2. Double-click **`setup-and-run.bat`**.
3. The script runs these steps:
   - **[1/5] Checks Node.js.** If it is missing, it installs the LTS version with `winget`. Node.js 18 or newer is required.
   - **[2/5] Prepares `.env`.**
     - If `.env` already exists, it is kept.
     - If only `.env.enc` exists, the script asks for its password (input is hidden). You get 3 attempts.
     - If neither file exists, a new `.env` is created with random secrets.
     - Missing `SESSION_SECRET`, `ENCRYPTION_KEY` or `ADMIN_SETUP_KEY` values are generated automatically.
   - **[3/5] Installs packages** with `npm ci` (or `npm install` if there is no lock file).
   - **[4/5] Builds the frontend** with `npm run build`.
   - **[5/5] Adds an auto-start shortcut** to your Windows Startup folder.
4. The server starts and the browser opens **http://localhost:3001** after a few seconds.
5. Keep the console window open. Closing it stops the app.

### First-time admin sign-up

1. On the login page, choose the first-run setup form.
2. Enter the one-time **ADMIN_SETUP_KEY** value from `.env`.
3. Create the superuser account.
4. After setup, you may remove `ADMIN_SETUP_KEY` from `.env` (the file comments recommend this).

> If you restored from `.env.enc`, the `ADMIN_SETUP_KEY` in it is already set. If you created a new `.env`, the script tells you to copy that line.

---

## 4. Option B: Manual install

Requires Node.js 18+ (LTS recommended), installed from https://nodejs.org.

```bat
cd smartData
npm ci
```

Create or restore `.env` in the project root (see section 3 for `.env.enc`). If you are creating it by hand, copy `server\.env.example` to `.env` and fill in:

- `SESSION_SECRET` — long random value
- `ENCRYPTION_KEY` — a different long random value
- `ADMIN_SETUP_KEY` — one-time random value for first sign-up

Generate random values with PowerShell:

```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }))
```

Then build and start:

```bat
npm run build
npm start
```

Open **http://localhost:3001**.

For development with hot reload instead:

```bat
npm run dev
```

Vite serves the UI on **http://localhost:5173** and proxies `/api` to the server on port 3001.

---

## 5. Option C: Docker Compose

1. Install Docker Desktop and make sure it is running.
2. Restore `.env` first (the Docker setup reads `.env` directly, not `.env.enc`):
   ```powershell
   $env:ENV_PASSWORD = "<your password>"
   node tools\env-crypt.mjs decrypt
   ```
   The script takes the password from `ENV_PASSWORD` (or as a command argument). It does not prompt for it. Quote the password in PowerShell.
3. Start the stack:
   ```bat
   docker compose up -d --build
   ```
4. Open **http://localhost:3333** (or `http://<server-ip>:3333` on a network).
5. Stop with `docker compose down`. Data is kept in the `app-data` volume.

For HTTPS, put a proxy in front, set `COOKIE_SECURE=true` in `.env`, and restart the stack.

---

## 6. Verify the installation

- The login page loads at http://localhost:3001 (or 3333 for Docker).
- The first-run admin setup accepts `ADMIN_SETUP_KEY`.
- Upload a small CSV file (for example from `public\`) and check that the chart appears.
- Check the server log for the line `Insightful API listening on http://localhost:3001`.

---

## 7. Uninstall

1. Close the server window.
2. Delete the **Insightful-Autorun.lnk** shortcut (open `shell:startup` from the Windows Run dialog).
3. Delete the project folder. Back up `data\` and `.env.enc` first if you need them.
