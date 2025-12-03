# WP RescueMode AI – plan.md

**Role assumptions for this doc**

- You (human) = product owner / architect.
- AI tooling (OpenAI / Cursor / Codex) = primary implementation assistant.
- Target stack = WordPress plugin (PHP), React + shadcn/ui + Tailwind in wp-admin, OpenAI API for AI logic.
- This is Plugin #1 in a **suite** of “AI does it for you” tools.

---

## 1. Product Vision & UX Principles

### 1.1 Suite vision

We’re building a **suite** of WordPress plugins where:

- **Tagline:** “AI does it for you.”
- Users don’t troubleshoot; they **press one button** and AI explains and fixes (or prepares a dev-ready report).
- Every plugin shares:
  - Same base layout, typography, component shapes.
  - Slightly different **accent color** per plugin.
  - Same UX patterns for:
    - “Run AI”
    - Status/progress timelines
    - AI chat panel
    - “Generate email for developer” button.

This doc focuses on:

1. **Rescue Mode (outside normal WP flow)**  
2. **Conflict Scanner (inside wp-admin)**

---

## 2. Design Language for the Whole Suite

### 2.1 Layout

Common admin layout (React, shadcn, Tailwind):

- **Left sidebar** (fixed):
  - Suite logo + plugin name
  - Navigation sections: `Dashboard`, `Rescue Mode`, `Conflict Scanner`, `Settings`, `Activity Log`.
- **Top bar**:
  - Site name
  - AI status indicator (Idle / Scanning / Analyzing)
  - Quick access “Run AI” button.
- **Main content**:
  - Page title + description.
  - Main “AI action card” with big primary button.
  - Secondary cards for logs, details, history.

### 2.2 Visual style

- **Typography:** System font or Inter (keep it clean).
- **Corner radius:** `rounded-2xl` for cards, `rounded-lg` for smaller elements.
- **Spacing:** Generous `p-6`+ inside cards, `gap-4`+ between components.
- **Shadows:** Soft glow for primary cards (`shadow-lg`), subtle `shadow-sm` for others.
- **Animations:** Framer Motion (or basic Tailwind animations) for:
  - Progress timeline (bubbles filling)
  - AI “thinking” pulse on buttons / avatars.

### 2.3 Color system

Base neutral palette (shared):

- Background: `#020817` (dark mode), optional light-mode later.
- Card: `#020817` → `bg-slate-900` / `bg-slate-950`.
- Text: slate/white.

Accent color per plugin:

- **WP RescueMode AI**: warm orange (`#f97316`)
- Future plugins: each gets its own accent.

Tailwind config:

- `primary` = plugin accent (changes per plugin).
- `suiteAccent` = constant highlight (maybe cyan) if needed across suite.

---

## 3. Tech Stack & Libraries

### 3.1 WordPress / PHP side

- Base plugin: `wp-rescuemode-ai/wp-rescuemode-ai.php`
- **MU plugin loader**:
  - `wp-content/mu-plugins/wp-rescue-suite-loader.php`
  - Ensures core “engine” is loaded even if normal plugins are disabled.
- Use:
  - `WP_Filesystem` API for safe file operations.
  - `wp_safe_remote_post()` / `wp_remote_post()` for OpenAI HTTP calls (or official OpenAI PHP SDK if we add Composer).
  - WP REST API (`register_rest_route`) for admin React app.

### 3.2 JS / React side

- Bundler: `@wordpress/scripts` or Vite (depending on preference).
- React + TypeScript.
- **UI libs:**
  - shadcn/ui (alert, button, card, dialog, tabs, textarea, skeleton, toast, etc.).
  - Tailwind CSS (utility styling).
  - Framer Motion (animations, subtle transitions).
  - TanStack Query (server state management for REST endpoints).
  - Zustand or Redux Toolkit (global UI state if needed).
  - React Hook Form + Zod (settings forms, AI config).

### 3.3 Other concerns

- **Security**
  - Nonces & capability checks on all REST endpoints.
  - Signed, random token for “Rescue Mode URL.”
  - Debug log output sanitized & redacted (DB credentials, keys, etc.).
- **Performance**
  - Only tail of debug.log (e.g., last 2–5k lines).
  - Streaming AI responses later; initial version can be single response.

---

## 4. Core Features Overview

### 4.1 Feature 1 – External Rescue Mode

**Goal:** When the site is white-screening or throwing critical errors, user visits a **protected URL** where AI diagnoses and fixes plugin-related issues.

High level:

1. User sees WSOD / critical error.
2. They open `https://example.com/wp-rescue?token=XYZ`.
3. A standalone Rescue UI loads:
   - AI chat panel.
   - “Let AI fix this for me” button.
   - Read-only view of:
     - Latest **debug.log** entries.
     - Active plugins list (from filesystem + DB).
4. AI:
   - Reads logs.
   - Finds likely offending plugin(s).
   - **Renames plugin folder** to deactivate.
   - Explains what it did and what the user should see next.
5. Button: **“Generate email to developer”**:
   - AI writes a plain-language email summarizing:
     - The issue.
     - Error stack.
     - Plugins involved.
     - Steps already taken.
   - User copies & sends.

### 4.2 Feature 2 – Conflict Scanner (in wp-admin)

**Goal:** From a safe admin page, user clicks **Run Scan**, and AI:

1. Systematically toggles/isolates plugins (or sets), monitoring:
   - PHP errors via debug.log.
   - Optional JS console errors (instrumented).
2. Identifies conflicting plugin(s).
3. Presents:
   - Neat visual: animated timeline of the scan.
   - Plain-language explanation.
   - “Generate developer email” button.

---

## 5. Detailed UX – Rescue Mode

### 5.1 Access & onboarding

**In wp-admin (when site is healthy):**

- In plugin settings:
  - “Rescue Mode URL” card:
    - Shows URL: `/wp-rescue?token=5f9b4b...`
    - Buttons:
      - **Copy URL**
      - **Regenerate URL**
    - Short explanation: “Bookmark this. Use it if your site crashes.”
- Explanation tooltip: “The rescue URL uses a lightweight loader and MU-plugin so it still works when most plugins are broken.”

**When site is broken:**

- User visits rescue URL:
  - Minimal styling, still branded.
  - No theme, no other plugins – served via dedicated endpoint / script.

### 5.2 Rescue Mode layout

**Layout:**

- Top bar:
  - Logo + “WP RescueMode AI”
  - Status pill: `Idle / Analyzing / Fix applied`.
- Two-column main area:

  **Left: AI Chat & Actions**
  - Chat bubble UI (user + AI).
  - Pre-filled prompt suggestions:
    - “Diagnose my white screen”
    - “Tell me what went wrong”
    - “Fix my site automatically”
  - Primary CTA: **[Let AI fix this for me]**
  - Status line: “AI will look at your debug log and plugin setup.”

  **Right: Diagnostics Panel**
  - Card: “Current Situation”
    - Quick checks: 
      - PHP version, WP version.
      - Is `WP_DEBUG_LOG` enabled?
      - Last critical error message, if present.
  - Card: “Recent Errors”
    - Scrollable `code` block with last ~200 lines of debug.log (sanitized).
    - Filter buttons for `PHP Fatal`, `PHP Warning`, `Notice`.
  - Card: “Active Plugins Detected”
    - List with status badges: `Core`, `AI`, `Suspected`, `Deactivated`.

### 5.3 AI flow – Rescue Mode

**Flow when user clicks “Let AI fix this for me”:**

1. Frontend calls `/wp-rescuemode/v1/diagnose` REST endpoint.
2. Backend does:
   - Read tail of debug.log.
   - Get active plugins (`option_active_plugins`) + plugin headers.
   - Maybe parse last fatal error line using regex.
   - Build a **system prompt** for OpenAI:
     - Summary of environment.
     - Logs.
     - Instructions: identify plugin(s) to deactivate and return reasoning + recommended action.

3. AI returns structured JSON:
   - `suspected_plugins: [ 'plugin-folder/plugin.php' ]`
   - `confidence_score`
   - `explanation`
   - `steps_to_fix`

4. Backend:
   - Validates plugin list.
   - **Renames plugin folders** (e.g., `plugin-folder` → `plugin-folder.disabled-wpra`).
   - Writes an internal log entry: timestamp, errors, actions.

5. Frontend:
   - Updates UI:
     - Animated state machine component:
       - `Gathering data → Asking AI → Applying fix → Done`.
   - Shows explanation from AI.
   - Offers **“Revert changes”** button (if safe to do so).

### 5.4 Email generator UX

- After a fix (or even if AI declines to alter anything), show an **“Email the plugin developer”** card:

  - Dropdown to choose:
    - “Email about plugin conflict”
    - “Email about fatal error”
  - Button: **[Generate Email]**

- AI prompt includes:
  - Current debug log snippet.
  - Plugin name/author.
  - Date/time.
  - Site URL.
  - What RescueMode already tried.

- UI shows:
  - A textarea populated with the email text.
  - `Copy` button.
  - Optional “Tone” selector (Professional / Friendly / Direct) for later versions.

---

## 6. Detailed UX – Conflict Scanner (wp-admin)

### 6.1 Entry point: plugin admin page

In `wp-admin > Tools > WP RescueMode AI` (or Settings):

- Tabs: `Dashboard | Conflict Scanner | Settings | Logs`.
- On `Conflict Scanner` tab:

  **Hero card:**
  - Title: “AI Conflict Scanner”
  - Subtitle: “AI will test plugins and identify conflicts for you.”
  - Big button: **[Run Scan]**
  - Small text: “Your site may briefly toggle plugins while we test. We’ll restore your original configuration at the end.”

  **Optional advanced options accordion:**
  - Scan mode:
    - [x] Standard Scan (sequential plugin re-activation).
    - [ ] Advanced (pairwise conflicts) – planned later.
  - Include theme in scan? (checkbox).
  - Maximum scan time.

### 6.2 Scan progress UI

Once scan starts, replace hero card with a **visual scanner**:

- Full-width card with:

  - Progress header:
    - Step indicator: `Step 2 of 4 – Re-activating plugins`.
  - Animated timeline:
    - Dots for each phase: `Snapshot`, `Disable all`, `Re-enable one by one`, `Analyze results`, `Restore`.
    - Active step glowing via Framer Motion.
  - Live log feed:
    - “Deactivated all non-essential plugins…”
    - “Activating WooCommerce…”
    - “Fatal error detected with Plugin X.”
  - AI “thought bubble”:
    - “It looks like when X is active with Y, we see this error…”

User can **watch without understanding the tech**. The key: they see **AI is working**, not them.

### 6.3 Final results screen

When done:

- Summary card:

  - Big status: “We found a conflict.”
  - Bullet points:
    - “Most likely culprit: Plugin A”
    - “Possible contributor: Plugin B”
    - “Recommended: Deactivate Plugin A and contact its developer with the email below.”

- Secondary cards:
  - “Technical details”
    - Collapsible code blocks with error stack traces.
    - List of test cycles.
  - “What we changed”
    - “We temporarily toggled your plugins but **restored** your original configuration.”

- Email generator card (same pattern as Rescue Mode).

---

## 7. Implementation Architecture

### 7.1 Folder structure (proposal)

```text
wp-rescuemode-ai/
  wp-rescuemode-ai.php
  readme.txt
  assets/
    build/            # compiled JS/CSS
    src/
      admin/
        index.tsx
        components/
        hooks/
        pages/
          Dashboard.tsx
          ConflictScanner.tsx
          Settings.tsx
          Logs.tsx
      rescue/
        index.tsx     # for external rescue page (optional React)
  inc/
    class-plugin.php
    class-rescue-endpoint.php
    class-conflict-scanner.php
    class-ai-client.php
    class-logger.php
    helpers.php
  mu-loader/
    wp-rescue-suite-loader.php
