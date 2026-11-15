# Insightful — AI Data Analyst

A React/Vite analytics workspace prototype. It includes a responsive dashboard, interactive Recharts visualizations, a CSV uploader, automatic CSV summaries, a prompt-style analysis panel, and a data-source connection dialog.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. To create a production bundle, use `npm run build`.

## Use the dashboard

- Upload a `.csv` file from **Upload file** (or **Attach data**) to update the chart, KPI cards, dataset preview, and analysis context.
- Use **Ask your data** or one of the suggested questions to generate a quick summary from the currently loaded rows.
- **Connect data** lets you select Google Sheets, Google Drive, a database, or CSV and enter a link/connection string.

## Admin database configuration

After signing in as a superuser, open **Admin settings → Application database** to choose SQLite3, MySQL, or PostgreSQL. For MySQL and PostgreSQL, provide the host, port, database name, username, and password; enable TLS when required by your database provider. Use **Test connection** before **Save and switch**. The server checks the connection, creates its private application-state table, and copies the current workspace state to the selected database. Existing `data/app-data.json` installations are migrated into the default `data/app.db` SQLite database on first start.

Database passwords and OpenRouter credentials are encrypted at rest using `ENCRYPTION_KEY`. Set a stable, private `ENCRYPTION_KEY` in the project-root `.env` before configuring credentials, and back it up securely. Database credentials and data are stored on the server, never in browser storage. The application DB account needs permission to create/read/write the `app_state` table. Protect the SQLite file or database with appropriate access controls and backups.

The Connect data dialog is still a UI placeholder for external source ingestion; choosing an application database controls where this application stores its own users and settings, not arbitrary remote tables to query. Google Sheets/Drive and importing/querying user database tables require separate data-source integrations.
