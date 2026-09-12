# Blueprint execution backend

Blueprint's browser UI is public, but repository-writing capability is locked behind server-side environment variables.

Required Vercel environment variables:

- `BLUEPRINT_ACCESS_KEY` — a long private password used by the Blueprint UI. Enter it with the **AGENT KEY** button. The browser stores it in `sessionStorage` for the current tab/session only.
- `GROQ_API_KEY` — Groq API key used only by the server route `/api/command`.
- `BLUEPRINT_GITHUB_TOKEN` — a fine-grained GitHub token with **Contents: Read and write** access only to the repositories Blueprint may edit.
- `BLUEPRINT_ALLOWED_REPOS` — optional comma-separated allowlist. Default: `sydneysoft/Orangesoft,sydneysoft/hellboychronicles`.
- `BLUEPRINT_GROQ_MODEL` — optional Groq model ID. Default: `openai/gpt-oss-120b`.

`OPENAI_API_KEY` and `BLUEPRINT_MODEL` are no longer used by Blueprint after the Groq migration.

Recommended GitHub token scope:

1. Fine-grained personal access token.
2. Repository access limited to `sydneysoft/Orangesoft` and `sydneysoft/hellboychronicles`.
3. Repository permission: Contents = Read and write.
4. Do not grant administration, secrets, Actions, packages, organization, or account permissions unless a future Blueprint feature specifically requires them.

How execution works:

1. `/blueprint` parses the custom command syntax and sends the raw command + parsed program to `/api/command`.
2. `/api/command` authenticates `x-blueprint-key` against `BLUEPRINT_ACCESS_KEY`.
3. The server calls Groq's OpenAI-compatible Responses API with restricted repository tools.
4. The agent may list/read files and create/update UTF-8 repository files.
5. Secret-like paths and `.github/workflows/*` are blocked.
6. A successful write commits to the requested production branch. Existing Vercel Git integration then starts deployment automatically.
7. The agent may verify only the approved public domains: `orangesoft.uk` and `storylingo.uk`.
8. Image assets written by the agent are surfaced as previews in the Blueprint console.

Example:

```text
zdrobic("orangesoft.logo")
```

With all credentials configured, the agent can inspect the OrangeSoft repository, create an SVG logo asset, commit it, preview it in Blueprint, and report the commit/deployment trigger.
