# past-wiki

A wiki where every page is a question. Point it at any [past](https://past.dev) project, ask
in plain language, and read an article written from what the project remembers, with each
claim linked to the dated source it came from.

There is no table of contents and no page editor. past holds the knowledge; this app only
reads it. Ask something new and a new page exists.

This is a showcase for the past Memory API, kept small on purpose: one server route, one
typed client, one screen. Fork it, point it at your own notes, and you have a wiki that
answers questions about them.

## Run it

You need a **project key** from your past console (Settings › API keys). A project key reads
one project and nothing else, which is exactly the blast radius a public-facing wiki should
have. Never use the organization's management key here.

```sh
cp .env.example .env.local   # fill in PAST_API_KEY
npm install
npm run seed                 # push the sample notes into the project and wait for them
npm run dev                  # http://localhost:3000
```

Then ask the wiki something the sample knows: "who is on call?", "why did we move to
Hetzner?", "what does a telemetry box cost?".

| Variable        | Default                | What it does                                                        |
| --------------- | ---------------------- | ------------------------------------------------------------------- |
| `PAST_API_KEY`  | required               | The project key. Stays on the server; the browser never sees it.    |
| `PAST_BASE_URL` | `https://api.past.dev` | Your self-hosted URL if you run past yourself.                      |
| `PAST_IDENTITY` | `wiki`                 | Who the read answers as. Pages see project-wide knowledge plus this identity's audiences. |
| `WIKI_TITLE`    | `past wiki`            | The name in the sidebar and the tab.                                |

## Put your own notes in

`npm run seed -- <folder>` walks a folder and pushes every `.md`, `.markdown` and `.txt`
file as one data point, then waits until past has processed them.

```sh
npm run seed -- ./docs              # your folder
npm run seed -- ./docs --dry-run    # list what would be pushed, push nothing
npm run seed -- ./docs --no-wait    # push and return without waiting
```

- **The id is the path** relative to the folder. Run the seed again after editing a file and
  only that file is reprocessed; past reports the rest as unchanged. Rename a file and it
  becomes a new note.
- **The timestamp is the note's `date:`** front matter line (any ISO date), falling back to
  the file's modification time. The date is when the note was true; past orders knowledge by it and
  works out what superseded what, so it is worth setting.
- **The label is the `title:`** front matter line, else the first `# heading`, else the
  file name.

`sample/` holds the notes of Harbor Loop, a fictional eight-person company, dated across the
first half of 2026 with a few decisions that change over time. Delete the folder once you have
your own.

### Seeding from GitHub Actions

`.github/workflows/seed.yml` runs the same script on demand. In your fork, add the repository
secret `PAST_API_KEY` (and the variable `PAST_BASE_URL` if you self-host), then trigger
"seed" from the Actions tab with the folder to push. Commit your notes to the repository and
every edit is one workflow run away from the wiki.

## How a page is made

```text
browser ──POST /api/ask {question}──▶ Next.js route
                                        │
                                        ├─▶ POST {PAST_BASE_URL}/api/v1/answer
                                        │     article + citations + ranked evidence
                                        │
                                        └─▶ on 503 answerer-not-configured:
                                              POST /api/v1/recall
                                              ranked evidence only
```

- `/answer` returns a written answer, the documents it cited, and the full recall page that
  grounded it. The wiki renders the answer as the article and the page as numbered sources.
  Citations in the text (`d3`) become superscript links to source 3.
- A self-hosted past without an answer model refuses `/answer`. The wiki notices and serves
  the recall evidence as the page body instead, so it works on every deployment.
- Sources are numbered by their recall rank. Cited ones are listed first and tinted; the rest
  appear under "Also found". Each card can unfold the verbatim excerpts it derives from.
- The question lives in the URL (`/?q=...`), so a page is a link you can send. The sidebar is
  the list of questions this browser asked, kept in localStorage.

## Deploy it

It is a stock Next.js app: anything that runs `next build` and `next start` with the four
environment variables above will do. The only secret is `PAST_API_KEY`, and it is only read
on the server.

## Develop

```sh
npm run typecheck   # tsc, strict
npm run lint
npm test            # vitest: the ask flow, citation parsing, history, the seed
npm run build
```

The tests talk to a fake `fetch` and never reach past. Nothing here is mocked with a
framework; the fakes live next to the tests.

## Layout

```text
app/
  page.tsx            # the one screen
  api/ask/route.ts    # the one server route (holds the key)
components/           # Wiki (state + URL), AskBar, Sidebar, Article, Sources
lib/past/             # typed client for /answer, /recall and /ingest/batch
lib/wiki/             # ask (answer-or-evidence), page model, history, config, seed
scripts/seed.ts       # npm run seed
sample/               # notes to seed a fresh project with
tests/
```

MIT.
