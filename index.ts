// Supabase Keep-Alive Cloudflare Worker
// Runs every 5 minutes to ping all Supabase projects

interface Project {
  name: string;
  owner: string;
  url: string;
  anon_key: string;
}

interface PingResult {
  name: string;
  status: 'up' | 'down' | 'error';
  code: number;
  duration: number;
  error?: string;
}

interface Summary {
  total: number;
  up: number;
  down: number;
  results: PingResult[];
}

const PROJECTS_URL = 'https://raw.githubusercontent.com/harryy2510/supabase-keep-alive/main/projects.json';

async function pingProject(project: Project): Promise<PingResult> {
  const { name, url, anon_key } = project;
  const start = Date.now();

  try {
    const response = await fetch(`${url}/rest/v1/rpc/keep_alive`, {
      method: 'POST',
      headers: {
        'apikey': anon_key,
        'Authorization': `Bearer ${anon_key}`,
        'Content-Type': 'application/json',
      },
    });

    const duration = Date.now() - start;
    const status = response.ok ? 'up' : 'down';

    console.log(`${status === 'up' ? '✓' : '✗'} ${name}: ${response.status} (${duration}ms)`);

    return { name, status, code: response.status, duration };
  } catch (error) {
    const duration = Date.now() - start;
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(`✗ ${name}: Error - ${message} (${duration}ms)`);
    return { name, status: 'error', code: 0, duration, error: message };
  }
}

async function pingAllProjects(): Promise<Summary> {
  console.log('Fetching projects list...');

  const response = await fetch(PROJECTS_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch projects: ${response.status}`);
  }

  const projects: Project[] = await response.json();
  console.log(`Found ${projects.length} projects to ping\n`);

  const results = await Promise.all(projects.map(pingProject));

  const up = results.filter(r => r.status === 'up').length;
  const down = results.filter(r => r.status !== 'up').length;

  console.log(`\nSummary: ${up}/${results.length} projects alive`);
  if (down > 0) {
    console.log(`Warning: ${down} project(s) failed`);
  }

  return { total: results.length, up, down, results };
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    console.log(`\n=== Supabase Keep-Alive ===`);
    console.log(`Time: ${new Date().toISOString()}\n`);

    ctx.waitUntil(pingAllProjects());
  },

  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    console.log(`\n=== Supabase Keep-Alive (Manual) ===`);
    console.log(`Time: ${new Date().toISOString()}\n`);

    try {
      const result = await pingAllProjects();

      return new Response(JSON.stringify(result, null, 2), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};
