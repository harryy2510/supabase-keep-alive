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
  timestamp: string;
  total: number;
  up: number;
  down: number;
  avgResponseTime: number;
  results: PingResult[];
}

interface Env {
  WEBHOOK_URL?: string;        // Discord/Slack webhook for alerts
  NOTIFY_ON?: string;          // "all" | "failures" (default: failures)
  PROJECTS_URL?: string;       // Override projects.json URL
}

const DEFAULT_PROJECTS_URL = 'https://raw.githubusercontent.com/harryy2510/supabase-keep-alive/main/projects.json';

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

    // Must consume response body to prevent deadlock
    await response.text();

    const duration = Date.now() - start;
    const status = response.ok ? 'up' : 'down';

    console.log(JSON.stringify({
      level: status === 'up' ? 'info' : 'warn',
      event: 'ping',
      project: name,
      status,
      httpCode: response.status,
      durationMs: duration,
    }));

    return { name, status, code: response.status, duration };
  } catch (error) {
    const duration = Date.now() - start;
    const message = error instanceof Error ? error.message : 'Unknown error';

    console.log(JSON.stringify({
      level: 'error',
      event: 'ping',
      project: name,
      status: 'error',
      error: message,
      durationMs: duration,
    }));

    return { name, status: 'error', code: 0, duration, error: message };
  }
}

async function sendWebhook(env: Env, summary: Summary): Promise<void> {
  if (!env.WEBHOOK_URL) return;

  const notifyOn = env.NOTIFY_ON || 'failures';
  if (notifyOn === 'failures' && summary.down === 0) return;

  const failed = summary.results.filter(r => r.status !== 'up');
  const color = summary.down === 0 ? 0x00ff00 : 0xff0000;
  const statusEmoji = summary.down === 0 ? '✅' : '🚨';

  // Discord webhook format (also works with many Slack-compatible webhooks)
  const payload = {
    embeds: [{
      title: `${statusEmoji} Supabase Keep-Alive Report`,
      color,
      fields: [
        { name: 'Total', value: String(summary.total), inline: true },
        { name: 'Up', value: `${summary.up} ✅`, inline: true },
        { name: 'Down', value: `${summary.down} ❌`, inline: true },
        { name: 'Avg Response', value: `${summary.avgResponseTime}ms`, inline: true },
      ],
      footer: { text: summary.timestamp },
    }],
  };

  if (failed.length > 0) {
    payload.embeds[0].fields.push({
      name: 'Failed Projects',
      value: failed.map(f => `• ${f.name}: ${f.error || `HTTP ${f.code}`}`).join('\n'),
      inline: false,
    });
  }

  try {
    const res = await fetch(env.WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    await res.text(); // Consume response body
    console.log(JSON.stringify({ level: 'info', event: 'webhook_sent' }));
  } catch (error) {
    console.log(JSON.stringify({ level: 'error', event: 'webhook_failed', error: String(error) }));
  }
}

async function pingAllProjects(env: Env): Promise<Summary> {
  const projectsUrl = env.PROJECTS_URL || DEFAULT_PROJECTS_URL;

  console.log(JSON.stringify({ level: 'info', event: 'fetch_projects', url: projectsUrl }));

  const response = await fetch(projectsUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch projects: ${response.status}`);
  }

  const projects: Project[] = await response.json();

  console.log(JSON.stringify({ level: 'info', event: 'projects_loaded', count: projects.length }));

  const startTime = Date.now();
  const results = await Promise.all(projects.map(pingProject));
  const totalTime = Date.now() - startTime;

  const up = results.filter(r => r.status === 'up').length;
  const down = results.filter(r => r.status !== 'up').length;
  const avgResponseTime = Math.round(results.reduce((sum, r) => sum + r.duration, 0) / results.length);

  const summary: Summary = {
    timestamp: new Date().toISOString(),
    total: results.length,
    up,
    down,
    avgResponseTime,
    results,
  };

  console.log(JSON.stringify({
    level: down > 0 ? 'warn' : 'info',
    event: 'summary',
    total: summary.total,
    up: summary.up,
    down: summary.down,
    avgResponseTimeMs: avgResponseTime,
    totalTimeMs: totalTime,
  }));

  return summary;
}

export default {
  async scheduled(event: ScheduledEvent, env: Env, _ctx: ExecutionContext): Promise<void> {
    console.log(JSON.stringify({
      level: 'info',
      event: 'cron_start',
      scheduledTime: new Date(event.scheduledTime).toISOString(),
    }));

    try {
      const summary = await pingAllProjects(env);
      await sendWebhook(env, summary);
    } catch (error) {
      console.log(JSON.stringify({
        level: 'error',
        event: 'cron_error',
        error: error instanceof Error ? error.message : String(error),
      }));
    }
  },

  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    console.log(JSON.stringify({
      level: 'info',
      event: 'http_request',
      method: request.method,
      url: request.url,
    }));

    try {
      const summary = await pingAllProjects(env);
      await sendWebhook(env, summary);

      return new Response(JSON.stringify(summary, null, 2), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.log(JSON.stringify({ level: 'error', event: 'http_error', error: message }));

      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  },
};
