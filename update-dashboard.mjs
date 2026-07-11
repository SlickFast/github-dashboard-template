// SlickFast live GitHub dashboard — plug-and-play template bot.
//
// What it does, every run:
//   1. Detects the repo it's running in and pulls its live GitHub stats.
//   2. Builds a dashboard and pushes it to a SlickFast live chart
//      (permanent view URL — the image updates, the URL never changes).
//   3. First run only: inserts the live dashboard into this repo's README
//      automatically (between slickfast-dashboard markers).
//
// Setup for users: ONE secret (SLICKFAST_KEY from slickfast.com). GitHub stats
// use the Action's built-in token — no personal token needed, ever.
//
// Layout: set repo variable LAYOUT to strip (default) | square | contributors |
// graphs | light.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const repo = process.env.REPO || process.env.GITHUB_REPOSITORY || '';
const cfg = {
  key: process.env.SLICKFAST_KEY,
  ghToken: process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '',
  repo,
  layout: (process.env.LAYOUT || 'strip').toLowerCase(),
  chartName: process.env.CHART_NAME || (repo ? repo.replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 60) : 'gh-pulse'),
  api: process.env.SLICKFAST_API || 'https://api.slickfast.com',
  writeReadme: process.env.GITHUB_ACTIONS === 'true' || process.env.WRITE_README === '1',
};

if (!cfg.key) { console.error('FATAL: SLICKFAST_KEY is required (add it as a repository secret).'); process.exit(1); }
if (!cfg.repo || !cfg.repo.includes('/')) { console.error('FATAL: no repo detected. In Actions this is automatic; locally set REPO="owner/name".'); process.exit(1); }

// ── theme ─────────────────────────────────────────────────────────────────────
const LIGHT = cfg.layout === 'light';
const BG = LIGHT ? '#ffffff' : '#0d1117';
const T = LIGHT ? '#f6f8fa' : '#161b22';
const GREEN = LIGHT ? '#2da44e' : '#39d353';
const BLUE = '#58a6ff';

// ── github fetch (built-in token; retries the "still computing" stats reply) ──
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function gh(path, { raw = false, retry202 = false } = {}) {
  for (let attempt = 0; attempt < (retry202 ? 5 : 1); attempt++) {
    const r = await fetch(`https://api.github.com/repos/${cfg.repo}${path ? '/' + path : ''}`, {
      headers: { accept: 'application/vnd.github+json', ...(cfg.ghToken ? { authorization: `Bearer ${cfg.ghToken}` } : {}) },
    });
    if (r.status === 202) { await sleep(2500); continue; }
    if (!r.ok) return null;
    return raw ? r : r.json();
  }
  return null;
}
const n = (v, f = 0) => (typeof v === 'number' && isFinite(v) ? v : f);

async function basics() {
  const j = await gh('');
  if (!j) throw new Error('repo not found or token lacks access');
  return { stars: n(j.stargazers_count), forks: n(j.forks_count), watchers: n(j.subscribers_count), openIssues: n(j.open_issues_count) };
}
async function commitsWeekly() {
  const a = await gh('stats/commit_activity', { retry202: true });
  return Array.isArray(a) ? a.slice(-12).map((w) => n(w.total)) : [];
}
async function topContributors() {
  const a = await gh('contributors?per_page=5&anon=false');
  return Array.isArray(a) ? a.map((c) => ({ label: c.login, value: n(c.contributions) })) : [];
}
async function contributorCount() {
  const r = await gh('contributors?per_page=1&anon=false', { raw: true });
  if (!r) return null;
  const m = (r.headers.get('link') || '').match(/[?&]page=(\d+)>;\s*rel="last"/);
  if (m) return Number(m[1]);
  const arr = await r.json().catch(() => []);
  return Array.isArray(arr) ? arr.length : null;
}
// SlickFast displays Eastern Time everywhere. DST-aware.
const ET = 'America/New_York';
const shortDate = (d) => new Intl.DateTimeFormat('en-US', { timeZone: ET, month: 'short', day: 'numeric' }).format(d);
const etStamp = (d) => `${new Intl.DateTimeFormat('en-US', { timeZone: ET, month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).format(d)} ET`;

async function latestReleaseInfo() {
  const j = await gh('releases/latest');
  if (j && j.tag_name) return { tag: j.tag_name, date: j.published_at || null };
  const t = await gh('tags?per_page=1'); // repos with tags but no formal releases
  if (Array.isArray(t) && t[0] && t[0].name) return { tag: t[0].name, date: null };
  return { tag: null, date: null };
}
async function ciGreenPct() {
  const j = await gh('actions/runs?per_page=20');
  const runs = ((j && j.workflow_runs) || []).filter((w) => w.conclusion);
  if (!runs.length) return null;
  return Math.round((runs.filter((w) => w.conclusion === 'success').length / runs.length) * 100);
}
async function languages() {
  const j = await gh('languages');
  if (!j) return [];
  const total = Object.values(j).reduce((a, b) => a + b, 0) || 1;
  return Object.entries(j).slice(0, 5).map(([k, v]) => ({ label: k, value: Math.max(1, Math.round((v / total) * 100)) }));
}

// ── tiles ─────────────────────────────────────────────────────────────────────
const kpi = (label, value, extra = {}) => ({ chart: { type: 'kpi', label, value, background: T, ...extra } });
const spark = (v) => { const s = Math.max(1, Math.round(v * 0.9)); return [s, Math.round((s + v) / 2), v]; };
const commitsArea = (commits, span) => ({ ...(span ? { span } : {}), chart: { type: 'area', title: 'Commits per week — last 12 weeks', background: T,
  data: { labels: commits.map(() => ''), series: [{ values: commits.length ? commits : [0], color: GREEN }] } } });

function buildSpec(d) {
  if (cfg.layout === 'release') {
    // singular tile: latest GitHub release + date, with the freshness stamp
    const cap = d.rel && d.rel.tag
      ? `${d.rel.tag}${d.rel.date ? ' — released ' + shortDate(new Date(d.rel.date)) : ''}`
      : 'no releases yet';
    return { type: 'callout', title: `Latest release — ${cfg.repo}`, caption: cap,
      note: `chart updated ${etStamp(new Date())}`, background: BG };
  }
  if (cfg.layout === 'ci') {
    // singular tile: just the CI health gauge — a live "build passing" badge, upgraded
    return { type: 'gauge', title: `CI runs green — ${cfg.repo}`, label: 'last 20 runs',
      value: d.ciPct ?? 0, min: 0, max: 100, valueUnit: '%', background: BG, color: GREEN };
  }
  const base = { type: 'dashboard', title: cfg.repo, background: BG, layout: { cols: 3, gap: 16, pad: 20, tileHeight: 190 } };
  const kpis3 = [kpi('Stars', d.stars, { sparkline: spark(d.stars) }), kpi('Forks', d.forks), kpi('Open issues', d.openIssues)];

  if (cfg.layout === 'square') {
    // 4 stats, commits graph full-width at the bottom
    return { ...base, layout: { cols: 2, gap: 16, pad: 20, tileHeight: 195 },
      tiles: [kpi('Stars', d.stars, { sparkline: spark(d.stars) }), kpi('Forks', d.forks),
        kpi('Contributors', d.contributorCount ?? d.watchers), kpi('Open issues', d.openIssues), commitsArea(d.commits, [2, 1])] };
  }
  if (cfg.layout === 'contributors') {
    // 3 rows: stats / stats / top-contributors bars + commits graph side by side
    return { ...base, layout: { cols: 2, gap: 16, pad: 20, tileHeight: 230 },
      tiles: [kpi('Stars', d.stars, { sparkline: spark(d.stars) }), kpi('Forks', d.forks),
        kpi('Contributors', d.contributorCount ?? d.watchers), kpi('Open issues', d.openIssues),
        { chart: { type: 'leaderboard', title: 'Top contributors', valueUnit: 'commits', background: T,
          items: d.top.length ? d.top.map((c) => ({ ...c, color: BLUE })) : [{ label: 'n/a', value: 0 }] } },
        commitsArea(d.commits)] };
  }
  if (cfg.layout === 'graphs') {
    // graphs only: commits/week horizontal bars + languages horizontal bars
    const last8 = d.commits.slice(-8);
    return { ...base, layout: { cols: 2, gap: 16, pad: 20, tileHeight: 300 },
      tiles: [
        { chart: { type: 'horizontal', title: 'Commits per week — last 8', background: T, showValues: true,
          data: { labels: last8.map((_, i) => `W${i + 1}`), series: [{ values: last8.length ? last8 : [0], colors: last8.map(() => GREEN) }] } } },
        { chart: { type: 'horizontal', title: 'Languages — % of code', background: T, showValues: true, valueUnit: '%',
          data: { labels: d.langs.map((l) => l.label), series: [{ values: d.langs.map((l) => l.value), colors: d.langs.map(() => BLUE) }] } } },
      ] };
  }
  // default (and light): THE main GitHub board — 6 tiles, 2 rows.
  // Row 1: stats. Row 2: three graphs — commits trend, commits bars, languages.
  const last8 = d.commits.slice(-8);
  return { ...base, layout: { cols: 3, gap: 16, pad: 20, tileHeight: 235 },
    tiles: [...kpis3,
      commitsArea(d.commits),
      { chart: { type: 'horizontal', title: 'Commits — last 8 weeks', background: T, showValues: true,
        data: { labels: last8.map((_, i) => `W${i + 1}`), series: [{ values: last8.length ? last8 : [0], colors: last8.map(() => GREEN) }] } } },
      { chart: { type: 'horizontal', title: 'Languages — % of code', background: T, showValues: true, valueUnit: '%',
        data: { labels: d.langs.length ? d.langs.map((l) => l.label) : ['n/a'], series: [{ values: d.langs.length ? d.langs.map((l) => l.value) : [0], colors: (d.langs.length ? d.langs : [0]).map(() => BLUE) }] } } },
    ] };
}

// ── push + auto-README ────────────────────────────────────────────────────────
async function push(spec) {
  const r = await fetch(`${cfg.api}/live/${cfg.chartName}`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.key}` }, body: JSON.stringify(spec),
  });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`push ${r.status}: ${body.error || ''}`);
  return body;
}

const START = '<!-- slickfast-dashboard:start -->', END = '<!-- slickfast-dashboard:end -->';
function updateReadme(svgUrl) {
  const block = `${START}\n![Live dashboard — powered by SlickFast](${svgUrl})\n${END}`;
  let md = existsSync('README.md') ? readFileSync('README.md', 'utf8') : `# ${cfg.repo}\n`;
  if (md.includes(START) && md.includes(END)) {
    const next = md.slice(0, md.indexOf(START)) + block + md.slice(md.indexOf(END) + END.length);
    if (next === md) return false;
    md = next;
  } else {
    const lines = md.split('\n');
    const h = lines.findIndex((l) => l.startsWith('#'));
    if (h >= 0) lines.splice(h + 1, 0, '', block); else lines.unshift(block, '');
    md = lines.join('\n');
  }
  writeFileSync('README.md', md);
  return true;
}

(async () => {
  try {
    const b = await basics();
    const wants = cfg.layout;
    const single = wants === 'ci' || wants === 'release'; // singular tiles skip the board data
    const [commits, top, cc, langs, ciPct, rel] = await Promise.all([
      single ? Promise.resolve([]) : commitsWeekly(),
      wants === 'contributors' ? topContributors() : Promise.resolve([]),
      single ? Promise.resolve(null) : contributorCount(),
      single ? Promise.resolve([]) : languages(),
      wants === 'ci' ? ciGreenPct() : Promise.resolve(null),
      wants === 'release' ? latestReleaseInfo() : Promise.resolve(null),
    ]);
    const d = { ...b, commits, top, contributorCount: cc, langs, ciPct, rel };
    console.log(`repo=${cfg.repo} layout=${cfg.layout} data=${JSON.stringify({ ...b, commits: commits.length, contributors: cc })}`);
    const out = await push(buildSpec(d));
    console.log(`\n✓ dashboard live: ${out.svg}`);
    if (cfg.writeReadme && updateReadme(out.svg)) {
      console.log('✓ README updated — the live dashboard is now embedded (commit follows in the workflow).');
    } else {
      console.log('README already wired (or local run). Embed manually with:');
      console.log(`  ![pulse](${out.svg})`);
    }
  } catch (e) {
    console.error('update failed (last-good chart keeps serving):', e.message);
    process.exit(1);
  }
})();
