# Supabase Keep-Alive

A community-driven service to keep free Supabase instances active.

Supabase pauses free-tier projects after 7 days of inactivity. This repo automatically pings all registered projects every 2 days to prevent that.

## Live Status

See [STATUS.md](STATUS.md) for current status of all projects.

## Add Your Project

1. Run a quick SQL migration on your Supabase project
2. Add your project URL + anon key to `projects.json`
3. Open a PR

**[Full instructions →](CONTRIBUTING.md)**

## How It Works

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  GitHub Actions │────▶│  keep-alive.sh   │────▶│  Your Supabase  │
│  (every 2 days) │     │ (100 concurrent) │     │    Projects     │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                │
                                ▼
                        ┌──────────────────┐
                        │   STATUS.md      │
                        │ (auto-updated)   │
                        └──────────────────┘
```

1. You create a `keep_alive()` function via simple SQL migration
2. You add your project to `projects.json` via PR
3. GitHub Actions pings all projects **in parallel** (100 concurrent) every 2 days
4. Each ping calls your `keep_alive()` function, exercising the database
5. Status is automatically updated in `STATUS.md`

## Is the anon key safe?

**Yes.** The anon key is designed for public use (it's used in frontend apps). Security comes from Row Level Security (RLS) policies, not the key. The `keep_alive()` function only returns a timestamp.

## Self-Hosting

Fork the repo - GitHub Actions runs automatically. Or run locally:

```bash
./keep-alive.sh  # requires: jq, curl
```

## License

MIT

---

**[Add your project →](CONTRIBUTING.md)** | **[View status →](STATUS.md)**
