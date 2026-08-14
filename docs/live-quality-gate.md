# Live Quality Gate (#37)

Production proof for the `nest` Supabase project and `https://api.acongm.com`.

## What this covers

- Additive schema that was missing on live:
  - `20260808050000_comments_constraints_repair`
  - `20260814010000_user_settings`
- Unauthenticated error contracts: `AUTH_REQUIRED`, `INVALID_TOKEN`
- Authenticated User Center + Chat v2 path using ephemeral users
- Cross-user chat hide (404)
- Cleanup of those ephemeral users

## What this does not cover

- Enabling Anonymous Auth or Manual Linking
- Historical `20260606000000_create_comments` tracking repair
- Browser OAuth / Chat Send-Retry-Cancel
- Mutation testing

## Run

```bash
export ACONGM_SUPABASE_ACCESS_TOKEN=...   # Supabase Management PAT
python3 scripts/live-quality-gate.py
```

Optional:

```bash
LIVE_API_URL=https://api.acongm.com python3 scripts/live-quality-gate.py
```

The script never prints tokens, passwords, or provider secrets. Exit `0` means the live API+schema slice passed.

## Project

- Supabase project: `nest` / `ejprvntpxlyydkzsjqnv`
- API: `https://api.acongm.com` (`dataMode=supabase`)
