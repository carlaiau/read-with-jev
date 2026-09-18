<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Project conventions

- Use the `gh` CLI for GitHub interactions, not a GitHub connector.
- Keep JEV credentials and model calls server-side. Use the official JavaScript SDK.
- Never use prediction artifacts as gold labels. Preserve dataset provenance and offset checks.
- Keep mention, quotation-speaker, and physical-presence labels distinct.
- Run `npm run data:prepare` after importer changes, then `npm test` and `npm run typecheck`.
