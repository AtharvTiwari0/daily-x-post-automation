# AI Daily X Post Automation (Production Ready)

An automated daily researcher and X (Twitter) post generation system that identifies trending tech, AI, startup, and open-source updates, ranks them using Gemini, creates multiple optimized post variations matching a custom developer persona, performs an automated quality check, and emails you the results.

Runs automatically every day at **2:40 PM IST** using GitHub Actions—**100% serverless, no VPS or paid infrastructure required.**

---

## Features

- **Multi-Source Curation**: Aggregates trending and fresh developer topics from:
  - **Hacker News**: Top articles submitted in the last 24 hours.
  - **Dev.to**: RSS feeds for general and targeted tags (React, JavaScript, AI, TypeScript, Next.js, Flutter).
  - **GitHub**: Search API capturing newly created repositories, trending developer tools, and fast-growing AI repos.
- **Deduplication & Similarity Filtering**: Automatically merges duplicates across sources and uses Gemini's semantic understanding to avoid writing about similar/duplicate topics covered within the past 30 days.
- **Custom developer Persona (`iamatharv`)**: Tailored tone—opinionated, practical, short, human-sounding, zero-fluff, and completely free of AI-writing clichés.
- **Diverse Draft Generation**: For each selected topic, generates 7 assets:
  1. Main Post
  2. Alternate Version
  3. Different Angle
  4. Hot Take (Opinionated debate starter)
  5. Reply Question (Community engagement hook)
  6. One-line Summary
  7. Suggested Image Idea
- **Self-Review Quality Loop**: Programmatically and AI-evaluates post drafts, scoring them (`★★★★★`, `★★★★☆`, `★★★☆☆`) and correcting any that exceed 280 characters or sound robotic.
- **Premium Email Notification**: Automatically sends structured text and visual HTML summaries directly to your inbox via Gmail SMTP.
- **Git State Persistence**: Automatically commits and pushes execution history (`history/history.json`) and run logs back to your repository so no VPS is required.

---

## Folder Structure

```
.github/
    workflows/
        daily-post.yml       # GitHub Actions schedule (2:40 PM IST / 9:10 AM UTC)

config/
    index.ts                # App configuration & environment validation

src/
    fetch/
        hackernews.ts       # Hacker News API fetcher
        devto.ts            # Dev.to RSS feed fetcher and deduplicator
        github.ts           # GitHub search APIs with rate-limit fallback

    ranking/
        index.ts            # Topic ranking, duplicate merging, & semantic filtering

    ai/
        gemini.ts           # Google Gemini API client setup
        index.ts            # X Post generator, self-review loop, & scoring

    prompts/
        templates.ts        # System instructions, target persona, and LLM prompts

    email/
        index.ts            # Nodemailer client and premium HTML templates

    history/
        index.ts            # History JSON file manager

    logger/
        index.ts            # Log writer (appends to logs/run.log)

    utils/
        helpers.ts          # Normalizers, dates, and retry-with-backoff utility

    index.ts                # Main orchestrator script

logs/                       # Timestamped run log files (Git tracked)
history/
    history.json            # 30-day history log to avoid semantic duplication

package.json                # Project dependencies
tsconfig.json               # TypeScript compiler config
README.md                   # Setup guide
```

---

## Installation & Local Development

1. **Clone the repository**:
   ```bash
   git clone <your-repo-url>
   cd daily-x-post-automation
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Local Environment**:
   Create a `.env` file in the root of the project (copying from `.env.example`):
   ```bash
   cp .env.example .env
   ```
   Fill in the environment variables:
   - `GEMINI_API_KEY`: Generate a key for free in [Google AI Studio](https://aistudio.google.com/).
   - `GMAIL_EMAIL`: Your Gmail address.
   - `GMAIL_APP_PASSWORD`: Your 16-character App Password (see Gmail Setup below).
   - `GITHUB_TOKEN`: A Personal Access Token (PAT) (optional for local, reduces rate limiting).

4. **Run in Dry-Run Mode (Mock API & Emails)**:
   Tests the data fetching and outputs draft emails in the console without expending Gemini API tokens or sending emails.
   ```bash
   npm run dry-run
   ```

5. **Run Locally (Production/Live Run)**:
   Runs live curation, queries Gemini, and sends a real email to your address.
   ```bash
   npm start
   ```

---

## Environment Variables & Secret Configuration

To deploy and run automatically on GitHub Actions, you must add these credentials as **Repository Secrets** in your GitHub repository:

1. Navigate to your GitHub repository.
2. Go to **Settings** -> **Secrets and variables** -> **Actions**.
3. Under **Repository secrets**, click **New repository secret** and add:
   - `GEMINI_API_KEY`: Your Gemini API key.
   - `GMAIL_EMAIL`: The recipient and sender Gmail address.
   - `GMAIL_APP_PASSWORD`: Gmail SMTP credentials.
   - `GITHUB_TOKEN`: This secret is automatically provided by GitHub Actions! You do **not** need to add it manually.

### Gmail App Password Setup
To allow the script to send emails via Gmail SMTP, you must configure a secure App Password:
1. Open your [Google Account settings](https://myaccount.google.com/).
2. Navigate to **Security**.
3. Under *How you sign in to Google*, ensure **2-Step Verification** is turned ON.
4. Search for or select **App passwords** (or go to `Security -> 2-Step Verification -> App passwords` at the bottom).
5. Enter a custom name (e.g. `X Post Automation`) and click **Create**.
6. Copy the generated **16-character password** and place it in `GMAIL_APP_PASSWORD` (without spaces).

---

## GitHub Actions & Git Persistence Setup

The GitHub Actions workflow requires permission to commit and push the updated history file and logs back to your repository.

Configure repository permissions:
1. Go to your repository **Settings** -> **Actions** -> **General**.
2. Scroll to the bottom to **Workflow permissions**.
3. Choose **Read and write permissions**.
4. Check **Allow GitHub Actions to create and approve pull requests** (optional but recommended).
5. Click **Save**.

The scheduler triggers daily at **2:40 PM IST** (9:10 AM UTC) but can be manually triggered at any time using the **Run workflow** button inside the **Actions** tab of your GitHub repository.

---

## Troubleshooting

- **Email fails to send**:
  - Verify that you are using a Gmail **App Password**, *not* your login password.
  - Verify that 2-Step Verification is active on the Gmail account.
- **GitHub API Rate Limits**:
  - Locally, make sure you configure a `GITHUB_TOKEN` to increase your rate limits.
  - In GitHub Actions, the workflow automatically forwards the built-in `GITHUB_TOKEN` so rate limits should not occur.
- **GitHub Actions failed to push changes**:
  - Double check that you've enabled "Read and write permissions" for workflows in your repository settings under Actions.

---

## Future Improvements

- Add LinkedIn post formatting alongside X posts.
- Auto-extract images or graphs from GitHub repos and embed them directly.
- Add support for posting directly to X via the X API v2 after approval.
