# Contributing

Add your Supabase project to keep it alive!

## Step 1: Run the migration

Go to [Supabase Dashboard](https://supabase.com/dashboard) → Your Project → SQL Editor → New query:

```sql
CREATE OR REPLACE FUNCTION public.keep_alive()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN jsonb_build_object(
    'status', 'alive',
    'timestamp', now(),
    'message', 'Database is active'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.keep_alive() TO anon;
```

Click **Run**.

## Step 2: Get your credentials

From Supabase Dashboard → Settings → API, copy:
- **Project URL** (e.g., `https://abcdefghijk.supabase.co`)
- **anon public** key

> **Is the anon key safe to share?** Yes! It's designed for frontend/public use. Security comes from Row Level Security (RLS), not the key. The `keep_alive()` function only returns a timestamp.

## Step 3: Add your project

1. Fork this repository
2. Edit `projects.json`:

```json
[
  {
    "name": "My Project",
    "owner": "your-github-username",
    "url": "https://your-project-ref.supabase.co",
    "anon_key": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
]
```

3. Commit and open a Pull Request

## Step 4: Done!

Once merged:
- Your project gets pinged every 5 minutes
- Status appears in [STATUS.md](STATUS.md)
- Your free tier stays active!

---

## Removing Your Project

Open a PR removing your entry from `projects.json`.

## Questions?

Open an issue!
