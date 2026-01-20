# Cloudflare Worker - Supabase Keep-Alive

Pinging via Cloudflare Workers. Runs every 5 minutes.

## Setup

1. Install wrangler:
   ```bash
   npm install
   ```

2. Login to Cloudflare:
   ```bash
   npx wrangler login
   ```

3. Deploy:
   ```bash
   npm run deploy
   ```

## Configuration

Edit `wrangler.toml` to change the schedule:

```toml
# Every 5 minutes (default)
crons = ["*/5 * * * *"]

# Every minute (aggressive)
crons = ["* * * * *"]

# Every 15 minutes
crons = ["*/15 * * * *"]
```

## Testing

Local dev:
```bash
npm run dev
```

Then visit `http://localhost:8787` to trigger manually.

## How it works

1. Worker fetches `projects.json` from GitHub (stays in sync with PRs)
2. Pings all projects in parallel
3. Logs results to Cloudflare dashboard

## Costs

Free tier includes:
- 100,000 requests/day
- Cron triggers included

At 9 projects every 5 minutes = ~2,592 requests/day (well within free tier)
