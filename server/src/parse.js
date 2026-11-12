// Lecture des flux RSS / Atom / RDF et utilitaires de texte.
import { XMLParser } from 'fast-xml-parser';
import crypto from 'node:crypto';

// Les entités sont décodées ici et non par l'analyseur XML (certains flux en contiennent des milliers).
const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@', textNodeName: '#t', trimValues: true, processEntities: false });
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export const ent = s => String(s ?? '').replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi, (m, e) =>
  e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e.toLowerCase()]);
const arr = v => (v == null ? [] : Array.isArray(v) ? v : [v]);
const txt = v => ent(v == null ? '' : typeof v === 'object' ? (v['#t'] ?? v['#cdata'] ?? '') : String(v));

export const sha = s => crypto.createHash('sha1').update(s).digest('hex');

export function hrefs(html) {
  const out = new Set();
  for (const m of String(html || '').matchAll(/href=["']([^"'#]+)["']/gi)) out.add(m[1]);
  return [...out].slice(0, 40);
}

export function strip(html) {
  return String(html || '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;|&rsquo;/g, '’')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/\s+/g, ' ').trim();
}

export function excerpt(s, n = 260) {
  s = strip(s);
  if (s.length <= n) return s;
  const cut = s.slice(0, n);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), n - 40)) + '…';
}

export function date(v) {
  const s = txt(v); if (!s) return null;
  const d = new Date(s);
  return isNaN(d) || d.getFullYear() < 2000 || d > new Date(Date.now() + 2 * 864e5) ? null : d;
}

// Renvoie [{guid, url, title, html, published}] quel que soit le format du flux.
export function parseFeed(body, src = {}) {
  if (src.rlive) {   // revendications relevées par ransomware.live ; aucun lien vers un site de fuite n'est repris
    return JSON.parse(body).map(v => {
      const page = typeof v.url === 'string' && /^https:\/\/(www\.)?ransomware\.live\//.test(v.url) ? v.url : `https://www.ransomware.live/group/${encodeURIComponent(v.group ?? '')}`;
      return {
        guid: `${v.group}|${v.victim}|${v.attackdate ?? ''}`, url: page, title: `Revendication : ${v.victim} — groupe ${v.group}`,
        published: date(String(v.discovered ?? v.attackdate ?? '').replace(' ', 'T').slice(0, 19) + 'Z'),
        html: `Rançongiciel : le groupe ${v.group} affirme avoir attaqué ${v.victim}${v.attackdate ? ` (date annoncée : ${String(v.attackdate).slice(0, 10)})` : ''}. Revendication relevée par ransomware.live, sans validation de l’organisation visée.`,
      };
    }).filter(x => x.guid && !x.guid.startsWith('undefined'));
  }
  if (src.html) {   // page de liste sans flux RSS : titres et liens, sans date de publication
    const rx = new RegExp(src.html), seen = new Set(), list = [];
    for (const m of body.matchAll(/<a\b[^>]*href="([^"#?]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
      const title = strip(m[2]);
      if (!rx.test(m[1]) || title.length < 25 || seen.has(m[1])) continue;
      seen.add(m[1]);
      list.push({ guid: m[1], url: new URL(m[1], src.urls[0]).href, title, html: '', published: null });
    }
    if (!list.length) throw new Error('aucun lien d’actualité reconnu dans la page');
    return list.slice(0, src.max ?? 8);
  }
  const doc = xml.parse(body);
  const out = [];
  const rss = doc.rss?.channel ?? doc['rdf:RDF'];
  if (rss) {
    for (const it of arr(rss.item ?? doc['rdf:RDF']?.item)) {
      const url = txt(it.link) || txt(it.guid);
      out.push({ guid: txt(it.guid) || url, url, title: strip(txt(it.title)), html: txt(it['content:encoded']) || txt(it.description), published: date(it.pubDate ?? it['dc:date']) });
    }
  } else if (doc.feed) {
    for (const e of arr(doc.feed.entry)) {
      const links = arr(e.link);
      const l = links.find(x => x['@rel'] === 'alternate') ?? links.find(x => !x['@rel']) ?? links[0];
      const url = (l && (l['@href'] ? ent(l['@href']) : txt(l))) || txt(e.id);
      out.push({ guid: txt(e.id) || url, url, title: strip(txt(e.title)), html: txt(e.content) || txt(e.summary), published: date(e.published ?? e.updated) });
    }
  } else throw new Error('format de flux non reconnu');
  return out.filter(x => x.title && /^https?:\/\//.test(x.url));
}

const STOP = new Set(('the a an of to in on for and or with by from at as is are was were be been has have had its it this that these those after over into new says said say will may can could about against amid than more up out via not no ' +
  'le la les un une des du de au aux et ou en dans sur pour par avec sans ce cette ces son sa ses leur leurs qui que dont est sont été a ont plus après selon chez vers entre ' +
  'revendication groupe attack attacks attaque cyberattack cyber security sécurité hackers hacker hacked data breach ransomware vulnerability vulnerabilities vulnérabilité vulnérabilités flaw flaws bug critical critique update updates multiple multiples warns exploited exploit').split(' '));

// Jetons significatifs d'un titre. Les noms propres sont marqués d'un « ^ » : sigles, nombres, mots à majuscule en cours
// de phrase. Les titres « À La Mode Anglaise » ne prouvent rien : on s'appuie alors sur le résumé, écrit en prose.
export function tokens(title, summary = '') {
  const words = strip(title).split(/[^\p{L}\p{N}.$-]+/u).filter(Boolean);
  const caps = new Set();
  for (const m of strip(summary).matchAll(/[\p{Ll}\p{N},;:)] (\p{Lu}[\p{L}\p{N}-]{2,})/gu)) caps.add(m[1].toLowerCase());
  const long = words.filter(w => w.length > 3);
  const titleCase = long.length > 3 && long.filter(w => /^\p{Lu}/u.test(w)).length / long.length > 0.6;
  const out = new Set();
  words.forEach((w, i) => {
    w = w.replace(/^[.-]+|[.-]+$/g, '');
    const low = w.toLowerCase();
    if (low.length < 3 || STOP.has(low)) return;
    const proper = caps.has(low) || /^\p{Lu}{2,}/u.test(w) || /\d/.test(w) || /\p{Ll}\p{Lu}/u.test(w) || (!titleCase && i > 0 && /^\p{Lu}/u.test(w));
    out.add((proper ? '^' : '') + low);
  });
  return [...out];
}

// Deux titres parlent du même événement s'ils partagent l'essentiel de leurs noms propres et une bonne part de leurs mots.
// Un nom propre pèse double ; « Microsoft corrige Windows » et « Microsoft corrige Office » ne sont pas fusionnés.
export function similar(a, b) {
  const proper = new Set([...a, ...b].filter(t => t[0] === '^').map(t => t.slice(1)));
  const A = new Set(a.map(t => t.replace('^', ''))), B = new Set(b.map(t => t.replace('^', '')));
  const w = t => (proper.has(t) ? 2 : 1), sum = S => [...S].reduce((n, t) => n + w(t), 0);
  const shared = [...A].filter(t => B.has(t));
  if (shared.length < 2) return 0;
  const pA = [...A].filter(t => proper.has(t)).length, pB = [...B].filter(t => proper.has(t)).length, pS = shared.filter(t => proper.has(t)).length;
  if (!pS || pS / Math.min(pA, pB) < 0.6) return 0;
  return sum(shared) / Math.min(sum(A), sum(B));
}

export const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
