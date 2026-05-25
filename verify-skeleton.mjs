import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import { join } from 'path';

const BASE = 'http://localhost:4200';
const SUPABASE_URL = 'https://nipayavpzhbtdfputapv.supabase.co';
const SCREENSHOTS = join(process.cwd(), 'verify-screenshots');

await mkdir(SCREENSHOTS, { recursive: true });

const MOCK_USER = {
  id: 'mock-user-id-0001',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'test@prodeus.local',
  email_confirmed_at: '2024-01-01T00:00:00Z',
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: {},
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

const MOCK_SESSION = {
  access_token: 'mock-access-token',
  token_type: 'bearer',
  expires_in: 86400,
  expires_at: Math.floor(Date.now() / 1000) + 86400,
  refresh_token: 'mock-refresh-token',
  user: MOCK_USER,
};

const MOCK_PROFILE = {
  id: MOCK_USER.id,
  username: 'testuser',
  first_name: 'Test',
  last_name: 'User',
  role: 'user',
};

let shotIndex = 0;
async function shot(page, label) {
  const file = join(SCREENSHOTS, `${String(++shotIndex).padStart(2, '0')}-${label}.png`);
  await page.screenshot({ path: file, fullPage: false });
  console.log(`  📸 ${label} → ${file}`);
  return file;
}

// Wait for skeleton to disappear and measure time
async function measureSkeletonDuration(page) {
  const start = Date.now();
  // Check if skeleton is visible (animate-pulse elements)
  const hasSkeleton = await page.locator('.animate-pulse').first().isVisible().catch(() => false);
  if (!hasSkeleton) return 0;

  try {
    await page.waitForSelector('.animate-pulse', { state: 'detached', timeout: 5000 });
    return Date.now() - start;
  } catch {
    return -1; // still visible after 5s → STUCK
  }
}

async function checkSkeletonStuck(page, route, label) {
  console.log(`\n▶ Navigating to ${route} (${label})`);
  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle', timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(300); // let Angular finish first CD cycle

  const duration = await measureSkeletonDuration(page);
  const url = page.url();

  if (duration === -1) {
    console.log(`  ❌ SKELETON STUCK — still visible after 5s`);
    await shot(page, `STUCK-${label}`);
    return { stuck: true, label, url };
  } else if (duration === 0) {
    console.log(`  ✅ No skeleton (loaded instantly or already cached)`);
    await shot(page, `ok-${label}`);
    return { stuck: false, label, url };
  } else {
    console.log(`  ✅ Skeleton resolved in ${duration}ms`);
    await shot(page, `ok-${label}`);
    return { stuck: false, duration, label, url };
  }
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();

// ── Mock Supabase network calls ─────────────────────────────────
await context.route(`${SUPABASE_URL}/auth/v1/**`, async route => {
  const url = route.request().url();
  if (url.includes('/token') || url.includes('/session')) {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(MOCK_SESSION) });
  } else {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ user: MOCK_USER }) });
  }
});

await context.route(`${SUPABASE_URL}/rest/v1/profiles**`, async route => {
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([MOCK_PROFILE]) });
});

// Return empty array for all group queries (user has 0 groups)
await context.route(`${SUPABASE_URL}/rest/v1/group_members**`, async route => {
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
});

await context.route(`${SUPABASE_URL}/rest/v1/groups**`, async route => {
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
});

// Return empty for scoring_rules so rules page loads
await context.route(`${SUPABASE_URL}/rest/v1/scoring_rules**`, async route => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify([
      { id: '1', key: 'exact_score', points_value: 3 },
      { id: '2', key: 'correct_winner', points_value: 1 },
    ]),
  });
});

// ── Inject session into localStorage before Angular initializes ─
await context.addInitScript(session => {
  const KEY = 'sb-nipayavpzhbtdfputapv-auth-token';
  try {
    localStorage.setItem(KEY, JSON.stringify(session));
  } catch {}
}, MOCK_SESSION);

const page = await context.newPage();
page.on('console', msg => {
  if (msg.type() === 'error') console.log(`  [console.error] ${msg.text()}`);
});

const results = [];

// ── SCENARIO 1: Direct to /app/groups ──────────────────────────
results.push(await checkSkeletonStuck(page, '/app/groups', 'direct-groups'));

// ── SCENARIO 2: Dashboard → Mis grupos ─────────────────────────
console.log('\n▶ Loading dashboard first...');
await page.goto(`${BASE}/app`, { waitUntil: 'networkidle', timeout: 10000 }).catch(() => {});
await page.waitForTimeout(1500); // let dashboard fully load
await shot(page, 'dashboard-loaded');

console.log('  → Navigating to groups via click...');
const groupsLink = page.locator('a[href*="/app/groups"]').first();
const hasLink = await groupsLink.isVisible().catch(() => false);
if (hasLink) {
  await groupsLink.click();
} else {
  await page.goto(`${BASE}/app/groups`, { waitUntil: 'commit' });
}
await page.waitForTimeout(300);
const d1 = await measureSkeletonDuration(page);
const r1 = d1 === -1
  ? { stuck: true, label: 'dashboard→groups' }
  : { stuck: false, duration: d1, label: 'dashboard→groups' };
console.log(d1 === -1 ? `  ❌ SKELETON STUCK` : `  ✅ Skeleton resolved in ${d1}ms`);
await shot(page, `dashboard-to-groups`);
results.push(r1);

// ── SCENARIO 3: Reglas → Mis grupos ────────────────────────────
console.log('\n▶ Loading reglas first...');
await page.goto(`${BASE}/app/rules`, { waitUntil: 'networkidle', timeout: 10000 }).catch(() => {});
await page.waitForTimeout(1500);
await shot(page, 'reglas-loaded');

await page.goto(`${BASE}/app/groups`, { waitUntil: 'commit' });
await page.waitForTimeout(300);
const d2 = await measureSkeletonDuration(page);
const r2 = d2 === -1
  ? { stuck: true, label: 'reglas→groups' }
  : { stuck: false, duration: d2, label: 'reglas→groups' };
console.log(d2 === -1 ? `  ❌ SKELETON STUCK` : `  ✅ Skeleton resolved in ${d2}ms`);
await shot(page, `reglas-to-groups`);
results.push(r2);

// ── SCENARIO 4: Groups → Dashboard → Groups ────────────────────
console.log('\n▶ Groups → Dashboard → Groups...');
await page.goto(`${BASE}/app/groups`, { waitUntil: 'networkidle', timeout: 10000 }).catch(() => {});
await page.waitForTimeout(1000);
await page.goto(`${BASE}/app`, { waitUntil: 'networkidle', timeout: 10000 }).catch(() => {});
await page.waitForTimeout(800);
await page.goto(`${BASE}/app/groups`, { waitUntil: 'commit' });
await page.waitForTimeout(300);
const d3 = await measureSkeletonDuration(page);
const r3 = d3 === -1
  ? { stuck: true, label: 'groups→dash→groups' }
  : { stuck: false, duration: d3, label: 'groups→dash→groups' };
console.log(d3 === -1 ? `  ❌ SKELETON STUCK` : `  ✅ Skeleton resolved in ${d3}ms`);
await shot(page, `groups-dash-groups`);
results.push(r3);

// ── SCENARIO 5: Rapid navigation (stress) ──────────────────────
console.log('\n▶ Rapid navigation stress test...');
await page.goto(`${BASE}/app`, { waitUntil: 'commit' });
await page.waitForTimeout(100);
await page.goto(`${BASE}/app/rules`, { waitUntil: 'commit' });
await page.waitForTimeout(100);
await page.goto(`${BASE}/app/groups`, { waitUntil: 'commit' });
await page.waitForTimeout(400); // short wait — the bug appeared even with slow nav
const d4 = await measureSkeletonDuration(page);
const r4 = d4 === -1
  ? { stuck: true, label: 'rapid-nav→groups' }
  : { stuck: false, duration: d4, label: 'rapid-nav→groups' };
console.log(d4 === -1 ? `  ❌ SKELETON STUCK` : `  ✅ Skeleton resolved in ${d4}ms`);
await shot(page, `rapid-nav-groups`);
results.push(r4);

await browser.close();

// ── Report ──────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════');
console.log('RESULTS:');
const stuck = results.filter(r => r.stuck);
for (const r of results) {
  const icon = r.stuck ? '❌' : '✅';
  const timing = r.duration != null ? ` (${r.duration}ms)` : '';
  console.log(`  ${icon} ${r.label}${timing}`);
}
console.log('');
if (stuck.length === 0) {
  console.log('VERDICT: PASS — No skeleton got stuck in any scenario');
} else {
  console.log(`VERDICT: FAIL — ${stuck.length} scenario(s) with stuck skeleton:`);
  stuck.forEach(r => console.log(`  • ${r.label}`));
}
console.log('══════════════════════════════════════');
