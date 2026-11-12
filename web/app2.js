// ───────────── État et stockage ─────────────
const DEFAULT_SERVER = 'https://raw.githubusercontent.com/ajimayell-wq/sentinel-cyber/data/api';
const S = {
  snap: null, watch: LS.get('watch', ['Maroc']), followed: LS.get('followed', []), seen: LS.get('seen', {}),
  rules: LS.get('rules', { patch: true, exploit: true, scope: true }), server: LS.get('server', DEFAULT_SERVER),
  alerts: LS.get('alerts', []), lastSync: LS.get('lastSync', null),
  syncing: false, error: null, fromCache: false, loading: true,
  tab: 'accueil', incView: 0, filters: newFilters(), showFilters: false, limit: 40, vulnFlags: new Set(), vulnQuery: '', vulnLimit: 40,
  mapSel: null, mode: {}, showNew: {}, answer: null, asked: '', q: '', busy: false, assistantOk: null, navCount: 0, installEvt: null,
};
const base = () => (S.server || DEFAULT_SERVER).replace(/\/+$/, '').replace(/\/snapshot\.json$/, '');
const isWatched = e => watchMatch(e, S.watch);
const saveWatch = () => LS.set('watch', S.watch);

// Cache hors connexion : IndexedDB (le JSON dépasse souvent la limite confortable de localStorage).
const idb = {
  open: () => new Promise((res, rej) => { const r = indexedDB.open('sentinel', 1); r.onupgradeneeded = () => r.result.createObjectStore('kv'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }),
  async get(k) { try { const d = await this.open(); return await new Promise((res, rej) => { const r = d.transaction('kv').objectStore('kv').get(k); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); } catch { return null; } },
  async put(k, v) { try { const d = await this.open(); await new Promise((res, rej) => { const t = d.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error); }); } catch { /* cache indisponible */ } },
};

function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg; document.body.appendChild(t);
  setTimeout(() => t.remove(), 3500);
}

async function sync(manual = false) {
  if (S.syncing) return;
  S.syncing = true; softRender();
  try {
    const r = await fetch(`${base()}/snapshot.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const raw = await r.json();
    const next = parseSnapshot(raw);
    if (!next.events.length && !next.generatedAt) throw new Error('instantané vide ou illisible');
    const old = S.snap;
    S.snap = next; S.fromCache = false; S.error = null; S.lastSync = Date.now(); LS.set('lastSync', S.lastSync);
    idb.put('snapshot', raw);
    if (old) notify(computeAlerts(old, next, S.watch, S.followed, S.rules));
    if (manual) toast('Données à jour.');
  } catch (e) {
    S.error = e.message || String(e);
    if (manual) toast('Synchronisation impossible : ' + S.error);
  } finally { S.syncing = false; S.loading = false; softRender(); }
}
function notify(alerts) {
  if (!alerts.length) return;
  S.alerts = [...alerts, ...S.alerts].slice(0, 30); LS.set('alerts', S.alerts);
  if ('Notification' in window && Notification.permission === 'granted') {
    for (const a of alerts.slice(0, 5)) { try { const n = new Notification(a.title, { body: a.lines.join('\n'), tag: a.id, icon: 'icon.svg' }); n.onclick = () => { focusWin(); location.hash = '#/fiche/' + enc(a.id); }; } catch { /* non supporté */ } }
  } else toast(`${alerts.length} alerte(s) sur votre périmètre.`);
}
async function askNotifications() {
  if (!('Notification' in window)) { toast('Ce navigateur ne gère pas les notifications.'); return; }
  const p = await Notification.requestPermission();
  toast(p === 'granted' ? 'Notifications autorisées pendant que la page est ouverte.' : 'Notifications refusées par le navigateur.');
  softRender();
}

// ───────────── Carte du monde en points ─────────────
const LAND_W = 90, LAND_H = 34;
const LAND_HEX = '00008203ff0000080f80000000fb707f8000089ffe3008fff2eb8f8007e7fffffffc3ffffc63860377ffffffff0f3ff83000038ffffffff40003ff8f00006fffffffc300007fffe000bffffffff880000fffec003ffffffffc000003fff0000671fffffe800000fff000060bfffffe0000001ffc0000703ffffe10000003fe00007e8fffff80000000f880003fffbfffe00000000e00001fff78fff000000001a00007ffde1ef000000000180001fffb061c400000000110007fff008100000000000f000fffe000020000000003f0001ff800640000000001fe0007fc000b00000000007fe000fe000001800000001ffc003f8000103000000003ff000fe000002000000000ff8003fa00003a000000001fe000fc80001fc000000007e0001f20001ff800000001f80007800003fe000000007c0001c00000ef800000001e000000000000e00000000600000000000000000000018000000000000010000000c000000000000000000000300000000000000000000000000000000000000';
const LAND = (() => { const o = new Array(LAND_W * LAND_H).fill(false); [...LAND_HEX].forEach((ch, i) => { const v = parseInt(ch, 16); for (let b = 0; b < 4; b++) { const k = i * 4 + b; if (k < o.length) o[k] = ((v >> (3 - b)) & 1) === 1; } }); return o; })();
const CSS = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
function markersOf(events) {
  const g = new Map();
  for (const e of events) if (!e.fictif && e.kind === 'incident') for (const c of e.countries) { const m = g.get(c.code) ?? g.set(c.code, { code: c.code, name: c.name, lat: c.lat, lon: c.lon, count: 0, severity: 'inconnue' }).get(c.code); m.count++; if (sevRank(e.severity) < sevRank(m.severity)) m.severity = e.severity; }
  return [...g.values()].sort((a, b) => b.count - a.count);
}
let mapRaf = 0;
function drawMap(canvas, markers, selected, onSelect) {
  cancelAnimationFrame(mapRaf);
  const dpr = window.devicePixelRatio || 1, ctx = canvas.getContext('2d');
  const colors = { line: CSS('--line'), text: CSS('--text'), blue: CSS('--blue'), red: CSS('--red'), orange: CSS('--orange'), yellow: CSS('--yellow'), green: CSS('--green') };
  const col = s => ({ critique: colors.red, elevee: colors.orange, moyenne: colors.yellow, faible: colors.green }[s] ?? colors.blue);
  const pos = (m, w, h) => [(m.lon + 180) / 360 * w, (78 - m.lat) / 136 * h];
  function size() { const r = canvas.getBoundingClientRect(); canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr); return [r.width, r.height]; }
  let [w, h] = size();
  const max = Math.max(1, ...markers.map(m => m.count));
  function frame(t) {
    if (!canvas.isConnected) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    const cw = w / LAND_W, ch = h / LAND_H;
    ctx.fillStyle = colors.line;
    for (let j = 0; j < LAND_H; j++) for (let i = 0; i < LAND_W; i++) if (LAND[j * LAND_W + i]) { ctx.beginPath(); ctx.arc((i + .5) * cw, (j + .5) * ch, cw * .27, 0, 6.2832); ctx.fill(); }
    const p = (t % 2400) / 2400;
    for (const m of [...markers].reverse()) {
      const [x, y] = pos(m, w, h), c = col(m.severity), r = cw * (1 + 1.5 * m.count / max);
      ctx.strokeStyle = c; ctx.globalAlpha = (1 - p) * .45; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, r + p * cw * 3.2, 0, 6.2832); ctx.stroke();
      ctx.globalAlpha = .22; ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x, y, r * 1.7, 0, 6.2832); ctx.fill();
      ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(x, y, r * .72, 0, 6.2832); ctx.fill();
      if (m.code === selected) { ctx.strokeStyle = colors.text; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.arc(x, y, r * 2.1, 0, 6.2832); ctx.stroke(); }
    }
    if (!still) mapRaf = requestAnimationFrame(frame);
  }
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (still) frame(0); else mapRaf = requestAnimationFrame(frame);
  canvas.onclick = ev => {
    if (!onSelect) return;
    const r = canvas.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top;
    let best = null, bd = 1e9;
    for (const m of markers) { const [mx, my] = pos(m, r.width, r.height), d = Math.hypot(mx - x, my - y); if (d < bd) { bd = d; best = m; } }
    onSelect(best && bd < 30 && best.code !== selected ? best.code : null);
  };
  window.onresize = () => { [w, h] = size(); if (still) frame(0); };
}

