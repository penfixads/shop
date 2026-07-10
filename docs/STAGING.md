# Staging Environment — Penfix Shop

A shared, production-like environment where staff can stress-test changes
**before** they hit the live site. Built on the infrastructure you already
have (Vercel + Supabase) — no new servers.

## Why not just localhost?

`localhost` only runs on one machine, isn't shareable with staff, and doesn't
behave like the deployed site (build output, env vars, serverless/edge behavior
all differ). Use localhost for your own dev loop; use **staging** for team testing.

---

## The three environments

| Environment | Git branch | URL | Supabase project |
| --- | --- | --- | --- |
| Local dev | any | `localhost:3000` | staging DB (shared with penfixads-OS) |
| **Staging** | `staging` | Vercel preview URL | **staging DB** (same one penfixads-OS staging uses) |
| Live | `main` | production domain | production DB (same one penfixads-OS production uses) |

### Workflow

```
feature branch  ->  staging  (staff stress-test on preview URL)  ->  main  (live)
```

1. Do work on a feature branch (or directly on `staging` for small changes).
2. Merge/push to `staging`. Vercel auto-deploys a preview URL.
3. Staff test against that URL (it points at the **staging** database).
4. Once approved, open a PR `staging -> main` (or merge) to release to live.

---

## No separate Supabase project needed

Unlike a standalone app, the shop **writes directly into penfixads-OS's own
tables** (`job_orders`, `job_order_items`, `clients`, `rewards_ledger`) — a
shop-submitted order is meant to look identical to one staff created
internally. So the shop doesn't get its own database per environment; it
always points at **whichever Supabase project penfixads-OS is using for that
same environment**:

- Shop staging → penfixads-OS's staging Supabase project (see
  `penfixads-OS/docs/STAGING.md` and `PENFIX-OS-STAGING KEYS.txt` for those keys).
- Shop production → penfixads-OS's production Supabase project.

If penfixads-OS's staging DB is ever reset/reseeded, the shop's staging deploy
picks that up automatically — nothing to keep in sync manually.

---

## Vercel: scope env vars per environment

Vercel lets you set the **same variable name** to **different values** per
environment (Production / Preview / Development).

**Vercel Dashboard → Project → Settings → Environment Variables**

Set these, each with an environment-scoped value (see `.env.example`):

| Variable | Production | Preview (= staging) |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | penfixads-OS prod project URL | penfixads-OS **staging** project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | prod anon key | staging anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | prod service_role | staging service_role |
| `NEXT_PUBLIC_JOBS_URL` | `https://jobs.penfixads.com` | penfixads-OS's **staging** Preview URL |

When adding/editing each variable, tick only the relevant environment box so the
values don't leak across. The **Preview** scope applies to every branch that
isn't `main` — including `staging`.

> ⚠️ **The whole point:** if Preview used the *production* keys, staff testing
> checkout would write junk job orders and client records into the real
> business data. Keeping Preview on the staging DB makes stress-testing safe.

`NEXT_PUBLIC_JOBS_URL` matters too — it's what the client's rewards QR deep-links
to. If shop's Preview pointed at the *production* jobs app while writing to the
*staging* DB, a scanned QR would open a JO search on the wrong database.

After changing env vars, redeploy the `staging` branch for them to take effect.

---

## Quick checklist

- [x] `staging` branch created locally
- [ ] GitHub repo created and pushed
- [ ] Vercel project created and linked to the repo
- [ ] Vercel Preview env vars set to penfixads-OS's staging keys (4 vars above)
- [ ] Vercel Production env vars set to penfixads-OS's production keys
- [ ] Redeploy `staging`, confirm staff can reach the preview URL and it writes
      to the staging DB (check the JO shows up in penfixads-OS staging, not prod)
