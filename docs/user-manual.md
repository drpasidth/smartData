# Insightful User Manual

Insightful is an AI data analyst workspace. You load a CSV file or connect a database, build charts, see summary cards and a data preview, and ask questions about your data in plain English.

This manual is for everyday users. Administrators also need the **Operational Guide** (`operational-guide.md`), which covers configuration, backups and updates.

---

## Contents

1. [Signing in](#1-signing-in)
2. [The workspace at a glance](#2-the-workspace-at-a-glance)
3. [Loading data](#3-loading-data)
4. [Filtering and display controls](#4-filtering-and-display-controls)
5. [Building charts](#5-building-charts)
6. [Ask AI](#6-ask-ai)
7. [Connecting to data sources](#7-connecting-to-data-sources)
8. [Language](#8-language)
9. [Administration (superusers)](#9-administration-superusers)
10. [Tips and troubleshooting](#10-tips-and-troubleshooting)
11. [Glossary](#11-glossary)

---

## 1. Signing in

### First use: create the superuser

The first time the app starts, no accounts exist. The login page shows a **Set up your superuser account** form.

1. Enter your name, email address and a **one-time setup key**. Your administrator gets this key from the server's `.env` file (`ADMIN_SETUP_KEY`).
2. Create a password of at least **12 characters**.
3. Choose **Create superuser**.

### Signing in later

1. Enter your email address and password.
2. Choose **Sign in securely**.

Use **Show password** / **Hide password** to check what you typed. Your session is kept in a secure cookie. If you change the server settings, you may be asked to sign in again.

> Do not share your password. Ask an administrator to create or reset accounts for other users.

---

## 2. The workspace at a glance

After you sign in, the screen has three main areas.

| Area | What it does |
|---|---|
| **Sidebar (left)** | Navigation (**Overview**, **Ask AI**, **Data sources**), **Recent analyses**, the **Datasets** list, the **Date filter** and **Display controls**. On a phone, open the sidebar with the menu button at the top left. |
| **Top bar** | The breadcrumb (current section), the language switch, the system status, search, notifications, **Admin** (superusers only) and **? Help** (this manual). |
| **Main area** | The page heading, the **Active dataset** strip (name of the loaded data), summary cards, the chart canvas and the dataset preview. |

### Navigation

- **Overview**: the dashboard with summary cards, charts and the data preview.
- **Ask AI**: opens the AI question panel (see [section 6](#6-ask-ai)).
- **Data sources**: opens the dialog for connecting to databases and CSV tables (see [section 7](#7-connecting-to-data-sources)).

---

## 3. Loading data

Insightful works with **CSV files** (comma-separated text). The first row should contain column names.

### Upload a CSV file

1. Choose **Upload file** or **Attach data**.
2. Select a `.csv` file from your computer.
3. The file becomes the **Active dataset**. Its name appears in the dataset strip, and it is added to the **Datasets** list in the sidebar.

Once a dataset is loaded, the summary cards, charts, dataset preview and the **Ask AI** panel all use it.

### Switch between datasets

Click a dataset name in the **Datasets** list to make it active.

### Edit a dataset

Click the **pencil** icon next to a dataset to change its details (for example its name). Close the dialog with the **X** button when you are done.

### CSV tips

- Keep one header row and one record per line.
- Use plain numbers without thousands separators if you want numeric charts (for example `12500`, not `12,500`).
- Dates work best in one consistent format, such as `2026-01-31`.
- Empty cells are allowed. They are not counted as values in calculations.

> Uploaded files are read in your browser. Keep your original files, because the app does not change them.

---

## 4. Filtering and display controls

The sidebar has two groups of controls that change what you see without changing your data.

### Date filter

- Choose a date range from the **Date filter** list to show only the rows in that period.

### Display controls

- **Max rows**: limit how many rows the charts and preview use. Choose **All** to use every row.
- **Refresh charts**: choose how often the charts reload their data automatically.

If a chart looks empty, check the date filter and the max-rows setting first.

---

## 5. Building charts

Charts are placed on the chart canvas on the **Overview** page.

### Create a chart

1. Choose **+ New chart**.
2. Set the options:
   - **Type**: one of the chart types in the table below.
   - **Data**: the dataset to use (default is **Current data**).
   - **Category (X)**: the column that groups the data (for example `Month` or `Region`).
   - **Value (Y)**: the numeric column to measure (for example `Sales`).
   - **Calculation**: how values are combined for each category (see below).
   - **Columns**: for a table, choose which columns to show. **Show all** resets the choice.
   - **Width** and **Title**: layout and label.
3. Click on the canvas where the chart should appear. Press **Esc** or choose **Cancel** to stop placing it.

### Chart types

| Type | Use it for |
|---|---|
| **Line graph** | Trends over time |
| **Bar graph** | Comparing categories |
| **Donut** | Share of a whole, for a few categories |
| **Histogram** | How values are spread across ranges |
| **Box plot** | Median, spread and outliers of a numeric column |
| **Card (single value)** | One headline number |
| **Table** | Exact values, with selected columns |

### Calculations

| Calculation | Meaning |
|---|---|
| **Sum** | Total of the values |
| **Average** | Mean of the values |
| **Count** | Number of rows |
| **Minimum** | Smallest value |
| **Maximum** | Largest value |

### Move, resize and edit

- Move a chart by dragging it on the canvas. With **Show grid** turned on, charts snap to the grid. The grid size is set next to it.
- Use the **gear** icon to open **Chart settings** and change any option above.
- Use the **sparkle** icon to **Analyze with AI** for a written explanation of that chart.
- Use the **X** icon to delete a chart. Deleting a chart does not change your data.

If a chart shows a message:

- **Choose a category column** / **Choose a value column**: set the missing column in the chart settings.
- **No numeric values**: the value column has no numbers. Choose a numeric column, or check the CSV.
- **Could not load this data**: check the server and try again.

---

## 6. Ask AI

Ask AI answers questions about your data in plain English. It is available on the **Ask AI** page and through the floating **Ask AI** button.

> Ask AI needs an OpenRouter API key and a model. A superuser sets these in **Admin → OpenRouter provider** (see [section 9](#9-administration-superusers)). If it is not configured, the panel asks you to **Configure OpenRouter**.

### Ask a question

1. Open **Ask AI**.
2. Check the scope option: **Whole dashboard** uses all cards and charts. Leave it unchecked to use only the active dataset.
3. Type your question in the box (for example *"Which region had the highest sales last quarter?"*) and choose **Send question**.
4. Wait while the answer is prepared. This can take a few seconds.
5. Use **Copy answer** to copy the text, or **Clear answer** to start over.

You can also start from the **suggested questions** shown in the panel.

### Analyze a single chart

Use the **sparkle** icon on a chart to ask for an explanation of that chart only.

### Good to know

- Answers are based on the rows loaded in the app. Check important numbers against your source file.
- Only send data that you are allowed to share with the AI service configured by your administrator.

---

## 7. Connecting to data sources

Choose **Data sources** in the sidebar to open the **Connect data** dialog.

| Source | Status |
|---|---|
| **CSV** | Available. Pick a CSV table that is already stored on the server, preview it and use it. You can also convert a CSV table into a database table. |
| **PostgreSQL** or **MySQL** | Available. Enter the connection URL, test the connection, pick a table, load a preview (up to 50 rows), then choose **Use this data**. |
| **Google Sheets / Google Drive** | Not yet available. |

### Connect to PostgreSQL or MySQL

1. Open **Data sources** and choose **PostgreSQL** or **MySQL**.
2. Enter the connection address in the form `postgresql://user:password@host:port/database` (or `mysql://…`). For MySQL that needs TLS, add `?ssl=true` to the end.
3. Choose **Test connection**.
4. Select a table and check the preview.
5. Choose **Use this data** to show the table in the dashboard.

Connection details are sent to the server for each request. They are not saved by this feature. If you save a connection, its password is encrypted on the server.

> Only connect to databases and tables you are allowed to access.

---

## 8. Language

Use the language switch in the top bar to change between **English** and **Thai**. Your choice applies to the interface; your data is not translated.

---

## 9. Administration (superusers)

The **Admin** button in the top bar is visible only to superusers. The admin panel has these sections:

| Section | Purpose |
|---|---|
| **Application database** | Choose where the app stores its users and settings: SQLite3 (default), MySQL or PostgreSQL. Use **Test connection** before **Save and switch**. |
| **Superuser account** | Change your own name and email, and update your password. |
| **OpenRouter provider** | Set the server-side API key and default model used by Ask AI. The key is stored encrypted. |
| **Workspace users** | View the user accounts in the workspace. |

Keep at least one superuser account. For server setup, backups and secrets, see the **Operational Guide**.

---

## 10. Tips and troubleshooting

| Problem | What to try |
|---|---|
| The page is blank or shows an error | Refresh the browser. If it continues, ask an administrator to check that the server is running. |
| A chart is empty | Check the **Date filter**, **Max rows**, and that the chart's category and value columns are set. |
| Numbers look wrong | Check the CSV for text in number columns, thousands separators or mixed date formats. |
| **Ask AI** says it is not configured | An administrator must set the OpenRouter key and model in **Admin**. |
| **Ask AI** answer fails or is slow | Try again, or ask a shorter question. Check your internet connection. |
| The help window did not open | Allow pop-ups for this site in your browser, then choose **? Help** again. |
| Database connection fails | Check the host, port, user, password and the TLS setting with your database administrator. |
| Logged out unexpectedly | Sign in again. An administrator may have changed the server's session settings. |

---

## 11. Glossary

- **Active dataset**: the data currently used by the dashboard, charts and Ask AI.
- **Category (X)**: the column that groups values, shown along the horizontal axis.
- **Value (Y)**: the numeric column that is measured.
- **Calculation**: how values are combined for each category (sum, average, count, minimum, maximum).
- **Superuser**: an administrator account that can change app settings and manage users.
- **OpenRouter**: the AI service that answers Ask AI questions.
- **TLS**: encrypted connection to a database, often required by cloud providers.
