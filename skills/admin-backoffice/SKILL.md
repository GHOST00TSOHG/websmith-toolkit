---
name: admin-backoffice
description: >-
  Use this when building back-office admin software: roles and permissions,
  sortable tables, empty and error states, and an append-only audit log.
---
# Admin back office

A checklist for building admin software with roles, clear tables, and a record of who changed what.

## Roles and permissions

Model permissions as statements with Better Auth's organization plugin (`createAccessControl`), then attach roles. Prefer per-organization roles, including roles created at runtime (dynamic access control) and Teams when people work in groups. Every admin route and mutation should check the caller's role before it runs.

Docs: [Better Auth organization plugin](https://better-auth.com/docs/plugins/organization) (Better Auth docs).

## Tables

Use [TanStack Table](https://tanstack.com/table) (MIT) for sortable, filterable admin tables. Include a clear empty state and a clear error state, not a blank page. **Server-side paging, sorting, and filtering: to research** against current TanStack Table docs before relying on a pattern.

For layout (sidebar, filters, settings, data-table arrangement), use [satnaing/shadcn-admin](https://github.com/satnaing/shadcn-admin) as a **reference only** (MIT; last push Sep 10, 2026). Copy patterns into the project repo and self-host; do not load it from a CDN. Confirm table details against current TanStack Table docs.

## Audit log

Keep an append-only log of **who**, **when**, and **what changed**, in an **insert-only** table (for example D1). Do not update or delete rows. Do not put private personal data in logs that many people can see.

[ejirocodes/better-auth-audit-logs](https://github.com/ejirocodes/better-auth-audit-logs) is an MIT Better Auth plugin for **auth events** (IP, user agent, severity, optional PII redaction, optional HMAC hash chain). It is **not append-only**: optional retention can delete old entries, and deleting only the oldest entries can look like a truncated chain. Use it for auth events, then write those events into your insert-only store. It needs better-auth >= 1.4.18. Last push was Aug 30, 2026; confirm it is still maintained before adopting it.

## Don't

- Expose an admin page or mutation without a role check.
- Delete or update audit-log rows.
- Put private personal data in a widely visible log.
- Load the reference dashboard from a CDN.
