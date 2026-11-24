---
name: ship-whole-app
description: >-
  Use this when shipping a whole app on Cloudflare: project setup, auth,
  D1 migrations (including Drizzle), preview vs production, tests, gradual
  Worker releases, Time Travel restores, and rollback.
---
# Ship a whole app

A checklist for taking an app from idea to a safe Cloudflare release, with a way to undo it.

## Before you build

Write down what "done" means: who can use it, which tests must pass, and how you will undo a bad release. Split preview and production from the start (separate D1 databases, secrets, and bindings). Run tests before applying migrations or deploying.

Typical folders: app source, tests, `migrations/`, and a Wrangler config. Keep an auth gate on every protected route and query so unsigned-in people cannot reach private data.

On Pages, there are only `env.preview` and `env.production`. When a Wrangler file is used, it is the source of truth. Bindings (`vars`, `kv_namespaces`, `d1_databases`, `r2_buckets`, and others) are **non-inheritable**: if you override any one for an environment, you must specify all of them there, or deploy validation fails. There is no branch-based configuration. Declare both environments in full, with separate D1 and R2 resources for preview.

Docs: [Pages Wrangler configuration](https://developers.cloudflare.com/pages/functions/wrangler-configuration/) (Cloudflare docs).

## D1 migrations

Use Wrangler. Commands: `wrangler d1 migrations create|list|apply <DB>` with `--local`, `--preview`, or `--remote`.

- Apply to preview first, then production (`--remote`) only after preview looks good.
- A failed migration rolls back; earlier ones stay applied.
- `apply` takes a backup first. In CI it skips the prompt.

**Drizzle on D1:** `drizzle-kit generate` writes one subdirectory per migration (for example `migrations/0001_init/migration.sql`). Point Drizzle `out` and Wrangler `migrations_dir` at the same folder, and set `migrations_pattern` so Wrangler finds the nested files (the pattern must start with `migrations_dir`):

```toml
[[d1_databases]]
binding = "DB"
database_name = "my-database"
database_id = "<UUID>"
migrations_dir = "migrations"
migrations_pattern = "migrations/*/migration.sql"
```

Then apply with `wrangler d1 migrations apply <DB>` (`--local` or `--preview` first). Do **not** use `wrangler d1 migrations create` for this layout; it only writes top-level files. Pick **one** applier per database (Wrangler for CI and deploys). How Cloudflare's `d1_migrations` table interacts with Drizzle's own table, if both apply migrations, is not documented. Drizzle's `d1-http` driver can `migrate` over the HTTP API; prefer Wrangler for deploys, and reserve d1-http for `studio` and `introspect`. Drizzle's own D1 pages do not mention `migrations_pattern`, and the connect page may show `@rc` packages and a different folder name — align the folders yourself.

**Kysely on D1:** there is no official Workers migrator (`FileMigrationProvider` uses Node `fs`). If you use [kysely-d1](https://github.com/aidenwallis/kysely-d1) (MIT; last push Apr 19, 2025), apply SQL with Wrangler and use Kysely only as a query builder.

**Limits and atomicity** ([D1 limits](https://developers.cloudflare.com/d1/platform/limits/), [batch](https://developers.cloudflare.com/d1/worker-api/d1-database/#batch)): 100 bound parameters per query, 100 KB per statement, 30-second query duration, 1,000 queries per invocation on Paid (50 on Free). A `db.batch()` call counts as one query; each statement inside it still has the per-statement limits. For large writes, process about 1,000 rows at a time. `db.batch()` is a transaction: if one statement fails, the whole sequence is aborted or rolled back. D1 runs ordinary queries in auto-commit implicit transactions; do not ship user-written `BEGIN`/`COMMIT`. Do not assume Drizzle's `db.transaction()` uses `batch()` until that is checked.

Docs: [D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/) and [wrangler d1 commands](https://developers.cloudflare.com/workers/wrangler/commands/d1/) (Cloudflare docs).

## D1 Time Travel

Restores the database to any minute in the last 30 days on Workers Paid, or 7 days on Free. The restore **overwrites the database in place** and prints a bookmark you can restore to as an undo. Rehearse on a preview database first: `wrangler d1 time-travel restore <DB> --timestamp=<unix>`. Save the bookmark the command prints.

Docs: [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/) (Cloudflare docs).

## Gradual Worker releases and rollback

Split traffic with `wrangler versions deploy`. You can use only the last 100 uploaded versions. `wrangler rollback` puts 100% of traffic on a chosen version.

Rollback is blocked if the target version binds to an R2 bucket, KV namespace, or queue that no longer exists, or if there was a Durable Object class lifecycle change.

Docs: [gradual deployments](https://developers.cloudflare.com/workers/configuration/versions-and-deployments/gradual-deployments/) and [rollbacks](https://developers.cloudflare.com/workers/configuration/versions-and-deployments/rollbacks/) (Cloudflare docs).

## Pages rollback

There is **no** `wrangler pages` rollback command (the [Wrangler Pages commands](https://developers.cloudflare.com/workers/wrangler/commands/pages/) page does not list one). Roll back from the dashboard: Deployments, then "Rollback to this deployment" on a successfully built, non-deleted production deployment. Preview deployments are not valid targets. Official docs do not say whether a rollback changes bindings, environment variables, or D1 data; do not assume D1 data is reverted. Keep schema changes backward-compatible so a code rollback still runs.

Docs: [Pages rollbacks](https://developers.cloudflare.com/pages/configuration/rollbacks/) (Cloudflare docs).

## Rollback runbook

1. If the Worker is wrong: roll back to a known-good version (`wrangler rollback`). Check the blockers above first.
2. If a Pages deployment is wrong: roll back from the dashboard (no Wrangler command).
3. If the database is wrong: Time Travel restore on that database, then immediately save the undo bookmark from the output. Prefer restoring preview first and confirming, then production.
4. A Pages or Worker rollback does not, on the evidence of the docs, rewind D1 data.

## Don't

- Apply production migrations before preview has succeeded.
- Use `wrangler d1 migrations create` for Drizzle's nested layout, or let Wrangler and Drizzle both apply migrations to the same database.
- Restore Time Travel without saving the undo bookmark.
- Assume a Worker rollback will work after you deleted a bound R2, KV, or queue resource, or changed a Durable Object class.
- Assume a Pages rollback reverts D1 data, bindings, or env vars.
- Ship `BEGIN`/`COMMIT` against D1, or rely on Drizzle `db.transaction()` without checking that it uses `batch()`.
