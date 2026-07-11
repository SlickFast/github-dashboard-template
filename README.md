# 📈 Live GitHub Dashboard Template

**One click + one SlickFast key = a live dashboard on your GitHub README.**
Real stats — stars, forks, issues, commits-per-week — in one image that **updates itself.**

This very repo runs the template. The dashboard below is live:

<!-- slickfast-dashboard:start -->
![Live dashboard — powered by SlickFast](https://api.slickfast.com/live/0196f9ae1a01e034c2572b0045b6985e.svg)
<!-- slickfast-dashboard:end -->

## Get yours — 3 steps, ~2 minutes

1. **Click the green `Use this template` button** (top of this page) → create your repo.
2. **Add one secret:** your repo → *Settings → Secrets and variables → Actions → New
   repository secret* → Name: `SLICKFAST_KEY`, Value: your key from
   **[slickfast.com](https://slickfast.com)** (free tier, no card).
3. **Run it once:** your repo → *Actions* tab → *pulse* → *Run workflow*.

Done. The first run **adds the live dashboard to your README automatically** and prints its
permanent URL. From then on it refreshes itself every 6 hours — no server, no maintenance,
no GitHub tokens (the built-in Actions permission reads your repo's public stats).

## Pick a layout (optional)

Set a repository **variable** named `LAYOUT` (*Settings → Secrets and variables → Actions →
Variables tab*). Every example below is a **live chart** of facebook/react, rendered by this
exact template:

| `LAYOUT` | Looks like | Best for |
|---|---|---|
| `strip` *(default)* | [live example](https://api.slickfast.com/live/b2e8b5da04d2cb91f3bf081709b79fe9.svg) — 3 stats over 3 graphs (commits trend, commits bars, languages) | most READMEs |
| `square` | [live example](https://api.slickfast.com/live/d065ee3966c3b861df8ae55cee378c96.svg) — 4 stats, commits graph below | compact |
| `contributors` | [live example](https://api.slickfast.com/live/4f1c8602e8fefdd4336aadc505acefa0.svg) — stats + top-contributor bars + commits | team projects |
| `graphs` | [live example](https://api.slickfast.com/live/bb8ec3f266428ac25ec20e09fb4b0c4c.svg) — commits + languages, all graphs | data lovers |
| `ci` | [live example](https://api.slickfast.com/live/daa0532de1717e7b10754311d57c2aa7.svg) — a single CI-health gauge | a live "build passing" badge, upgraded |
| `light` | the strip on white | light-mode READMEs |

Every example is refreshed **daily with facebook/react's real, current stats** — click one
tomorrow and the numbers will have moved.

## Good to know

- **The image URL is keyless and permanent** — safe to embed anywhere; your SlickFast key
  stays a secret in Actions and never appears in your README.
- **SVG on GitHub** — the auto-embedded image is `.svg`: always crisp at any zoom. A `.png`
  twin exists at the same URL (swap the extension) for places that need it (email, Slack).
- **Free-tier friendly** — every-6-hours ≈ 120 updates/month, comfortably inside the free
  250. Faster refresh? Any paid plan lifts the ceiling; edit the `cron` in
  [`.github/workflows/pulse.yml`](.github/workflows/pulse.yml).
- **Local run** (optional): `REPO=owner/name SLICKFAST_KEY=... GITHUB_TOKEN=... node
  update-dashboard.mjs` — Node 18+, zero dependencies.

---

Built with **[SlickFast](https://slickfast.com)** — charts for AI agents and humans.
*Embed once, update forever.*
