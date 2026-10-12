// 验证 products/[id]/loading.tsx 的真实触发场景：客户端路由跳转时的过渡态。
// 事实：Next.js App Router 的 loading.tsx 只在客户端导航 / 动态段切换时展示，
// SSR 直连不会流式输出骨架（实测 TTFB 6s，首字节前无任何 HTML）。
// 因此这里先停在列表页（SSR 快），再用 Next router 触发客户端跳转到慢详情页。
import http from 'node:http';
import fs from 'node:fs';

const PORT = 9444;
const BASE = 'http://127.0.0.1:3055';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function getTargets() {
  return new Promise((resolve, reject) => {
    const req = http.get(`http://127.0.0.1:${PORT}/json/list`, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
  });
}

const targets = await getTargets();
const page = targets.find((t) => t.type === 'page');
if (!page) { console.error('FAIL 找不到页面 target'); process.exit(1); }

const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();
const events = [];
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m.result); pending.delete(m.id); }
  else if (m.method) events.push(m);
};
await new Promise((r) => (ws.onopen = r));
const send = (method, params = {}) =>
  new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
const evalInPage = async (expr) =>
  (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }))?.result?.value;

await send('Runtime.enable');
await send('Log.enable');
await send('Page.enable');

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

const PROBE = `(() => {
  const txt = document.body.innerText;
  return JSON.stringify({
    path: location.pathname,
    skeletons: document.querySelectorAll('.animate-pulse').length,
    tabs: document.querySelectorAll('nav[aria-hidden="true"] > div > div').length,
    hasWorkflow: txt.includes('单品运营流程'),
    notFound: txt.includes('404') && txt.includes('This page'),
    overflow: document.documentElement.scrollWidth > window.innerWidth,
  });
})()`;

// 1) 先落在首页（静态 shell 已在，客户端导航起点）
await send('Page.navigate', { url: `${BASE}/?_v=${Date.now()}` });
await sleep(2500);
console.log('起点:', await evalInPage(PROBE));

// 2) 触发客户端导航：优先点真实链接，退化到 router.push
const navResult = await evalInPage(`(() => {
  const link = Array.from(document.querySelectorAll('a[href^="/products/"]'))[0];
  if (link) { link.click(); return 'clicked:' + link.getAttribute('href'); }
  return 'no-link';
})()`);
console.log('导航动作:', navResult);

// 若首页因假后端 401 拿不到商品链接，直接构造链接再点（仍走 Next 客户端路由）
if (navResult === 'no-link') {
  await evalInPage(`(() => {
    const a = document.createElement('a');
    a.href = '/products/1'; a.id = '__probe_link'; a.textContent = 'probe';
    document.body.appendChild(a);
    return true;
  })()`);
  // 真实 <a> 不走 Next router，改用 Link 语义：点击被拦截的元素才生效，
  // 因此这里用 history + router 的等效方式不可行，退而验证 Next 的 prefetch 行为。
  console.log('提示：首页无商品链接（后端 401），改用直连 + 客户端二次导航');
  await sleep(500);
  await evalInPage(`document.getElementById('__probe_link').remove(); true`);
  await send('Page.navigate', { url: `${BASE}/?v=${Date.now()}` });
  await sleep(2000);
  // 用 Next 的 router API（window.next.router 在 App Router 下不可用）→ 改用真实 <a> 全页导航不可测。
  // 结论交给下面的直连采样：此时 loading.tsx 不出现是预期行为。
}

// 3) 无论导航方式如何，密集采样并记录
const timeline = [];
let peak = { skeletons: 0, tabs: 0, hasWorkflow: false, overflow: false };
let captured = false;
for (let i = 0; i < 30; i++) {
  await sleep(250);
  const raw = await evalInPage(PROBE);
  if (!raw) continue;
  const s = JSON.parse(raw);
  timeline.push({ t: i * 250, ...s });
  if (s.skeletons > peak.skeletons) peak = s;
  const line = `t=${String(i * 250).padStart(4)}ms path=${s.path} 骨架=${s.skeletons} tab=${s.tabs} 404=${s.notFound}`;
  if (!captured && s.skeletons >= 10) {
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.mkdirSync('docs/verify', { recursive: true });
    fs.writeFileSync('docs/verify/01-loading-skeleton.png', Buffer.from(shot.data, 'base64'));
    console.log(line + '  ← 已抓图');
    captured = true;
  } else {
    console.log(line);
  }
  if (s.notFound) break;
}

console.log('\n峰值:', JSON.stringify(peak));
check('客户端导航期间骨架真实渲染', peak.skeletons > 0, `峰值 × ${peak.skeletons}`);
if (peak.skeletons > 0) {
  check('骨架含 10 个 tab 占位', peak.tabs === 10, `${peak.tabs} 个`);
  check('骨架含工作流面板', peak.hasWorkflow === true);
  check('骨架态无横向溢出', peak.overflow === false);
  check('已抓到骨架截图', captured === true);
}

const jsErr = events.filter((e) => e.method === 'Runtime.exceptionThrown');
check('无 JS 未捕获异常', jsErr.length === 0, `${jsErr.length} 个`);

fs.mkdirSync('docs/verify', { recursive: true });
fs.writeFileSync('docs/verify/loading-timeline.json', JSON.stringify(timeline, null, 2));
console.log('时间线已存 docs/verify/loading-timeline.json');

ws.close();
console.log(`\n=== 采样结束 ===`);
