/* 옛 형식 엑셀(.xls, BIFF8)·HTML로 저장된 .xls·.xlsx 를 한 함수로 읽는다 — 홈택스는 .xls 로 내려준다.
 * 반환은 xlsx-read.js 와 같은 모양: { sheets:[{ name, rows:[[셀…]…] }] } (문자열 또는 숫자, 빈 칸 ''). 외부 라이브러리 없음. */
import { readXlsx } from './xlsx-read.js?v=20261011a';
const u8 = (b, o) => b[o]; const u16 = (b, o) => b[o] | (b[o + 1] << 8); const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0; const i32 = (b, o) => b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24);
const dv = (b, o) => new DataView(b.buffer, b.byteOffset + o, 8).getFloat64(0, true);
const ENDOFCHAIN = 0xFFFFFFFE;

function oleStreams(b) {
  const ss = 1 << u16(b, 0x1e), mss = 1 << u16(b, 0x20); const sec = (id) => b.subarray((id + 1) * ss, (id + 2) * ss);
  const difat = []; for (let i = 0; i < 109; i++) { const v = u32(b, 0x4c + i * 4); if (v < 0xFFFFFFFA) difat.push(v); }
  let dsec = u32(b, 0x44); for (let n = u32(b, 0x48); n > 0 && dsec < 0xFFFFFFFA; n--) { const s = sec(dsec); for (let i = 0; i < ss / 4 - 1; i++) { const v = u32(s, i * 4); if (v < 0xFFFFFFFA) difat.push(v); } dsec = u32(s, ss - 4); }
  const fat = []; difat.forEach((id) => { const s = sec(id); for (let i = 0; i < ss / 4; i++) fat.push(u32(s, i * 4)); });
  const chain = (start) => { const out = []; let id = start; const seen = new Set(); while (id < 0xFFFFFFFA && !seen.has(id)) { seen.add(id); out.push(id); id = fat[id]; } return out; };
  const readChain = (start, size) => { const ids = chain(start); const out = new Uint8Array(ids.length * ss); ids.forEach((id, i) => out.set(sec(id), i * ss)); return size != null ? out.subarray(0, size) : out; };
  const dir = readChain(u32(b, 0x30)); const ents = [];
  for (let o = 0; o + 128 <= dir.length; o += 128) { const nl = u16(dir, o + 64); if (!nl) continue; let name = ''; for (let i = 0; i < nl / 2 - 1; i++) name += String.fromCharCode(u16(dir, o + i * 2)); ents.push({ name, type: dir[o + 66], start: u32(dir, o + 116), size: u32(dir, o + 120) }); }
  const root = ents.find((e) => e.type === 5); const cutoff = u32(b, 0x38);
  let mini = null, miniFat = [];
  if (root && u32(b, 0x40) > 0) { mini = readChain(root.start, root.size); const mf = readChain(u32(b, 0x3c)); for (let i = 0; i < mf.length; i += 4) miniFat.push(u32(mf, i)); }
  const read = (e) => { if (e.size < cutoff && mini) { const out = new Uint8Array(Math.ceil(e.size / mss) * mss); let id = e.start, k = 0; const seen = new Set(); while (id < 0xFFFFFFFA && !seen.has(id)) { seen.add(id); out.set(mini.subarray(id * mss, (id + 1) * mss), k * mss); k++; id = miniFat[id]; } return out.subarray(0, e.size); } return readChain(e.start, e.size); };
  return { find: (n) => { const e = ents.find((x) => x.name === n && x.type === 2); return e ? read(e) : null; } };
}
/** 레코드 목록 [{type, data, off}] */
function records(w) { const out = []; let o = 0; while (o + 4 <= w.length) { const t = u16(w, o), n = u16(w, o + 2); out.push({ type: t, data: w.subarray(o + 4, o + 4 + n), off: o }); o += 4 + n; } return out; }
function rk(v) { let x; if (v & 2) x = v >> 2; else { const b = new Uint8Array(8); const d = new DataView(b.buffer); d.setUint32(4, v & 0xFFFFFFFC, true); x = d.getFloat64(0, true); } return (v & 1) ? x / 100 : x; }
/** 공유 문자열 표(SST) — CONTINUE 로 쪼개진 문자열(쪼개진 곳에서 글자 폭 표시 바이트가 다시 나옴)까지 처리 */
function readSst(recs, i) {
  const chunks = [recs[i].data]; let j = i + 1; while (j < recs.length && recs[j].type === 0x003C) { chunks.push(recs[j].data); j++; }
  const strs = []; let ci = 0, p = 8; const total = u32(chunks[0], 4);
  const cur = () => chunks[ci]; const need = () => { if (p >= cur().length && ci < chunks.length - 1) { ci++; p = 0; return true; } return false; };
  for (let s = 0; s < total && ci < chunks.length; s++) {
    need(); if (ci >= chunks.length || p + 3 > cur().length) break; const cch = u16(cur(), p); const fl = cur()[p + 2]; p += 3; let wide = !!(fl & 1); const rich = !!(fl & 8), ext = !!(fl & 4); let runs = 0, extLen = 0;
    if (rich) { runs = u16(cur(), p); p += 2; } if (ext) { extLen = u32(cur(), p); p += 4; }
    let str = ''; let left = cch;
    while (left > 0) { if (p >= cur().length) { if (ci >= chunks.length - 1) break; ci++; p = 0; wide = !!(cur()[p] & 1); p += 1; } const unit = wide ? 2 : 1; const avail = Math.floor((cur().length - p) / unit); const take = Math.min(left, avail); for (let k = 0; k < take; k++) { str += wide ? String.fromCharCode(u16(cur(), p + k * 2)) : String.fromCharCode(cur()[p + k]); } p += take * unit; left -= take; }
    let skip = runs * 4 + extLen; while (skip > 0) { if (p >= cur().length) { if (ci >= chunks.length - 1) break; ci++; p = 0; } const t = Math.min(skip, cur().length - p); p += t; skip -= t; }
    strs.push(str);
  }
  return strs;
}
function readBiff(w) {
  const recs = records(w); let sst = []; const sheets = []; let globalsDone = false;
  recs.forEach((r, i) => { if (r.type === 0x00FC && !globalsDone) sst = readSst(recs, i); if (r.type === 0x0085) { const d = r.data; const cch = d[6], fl = d[7]; let name = ''; if (fl & 1) for (let k = 0; k < cch; k++) name += String.fromCharCode(u16(d, 8 + k * 2)); else for (let k = 0; k < cch; k++) name += String.fromCharCode(d[8 + k]); sheets.push({ off: u32(d, 0), name, rows: [] }); } if (r.type === 0x000A && !globalsDone) globalsDone = true; });
  sheets.forEach((sh) => {
    let i = recs.findIndex((r) => r.off === sh.off); if (i < 0) return; let depth = 0; let lastFormula = null; const put = (r, c, v) => { (sh.rows[r] || (sh.rows[r] = []))[c] = v; };
    for (i; i < recs.length; i++) { const r = recs[i], d = r.data; if (r.type === 0x0809) { depth++; if (depth > 1) { /* 중첩 BOF(차트 등)는 건너뜀 */ } continue; } if (r.type === 0x000A) { depth--; if (depth <= 0) break; continue; } if (depth !== 1) continue;
      switch (r.type) {
        case 0x00FD: put(u16(d, 0), u16(d, 2), sst[u32(d, 6)] != null ? sst[u32(d, 6)] : ''); break;
        case 0x0203: put(u16(d, 0), u16(d, 2), dv(d, 6)); break;
        case 0x027E: put(u16(d, 0), u16(d, 2), rk(u32(d, 6))); break;
        case 0x00BD: { const row = u16(d, 0), c0 = u16(d, 2); const n = (d.length - 6) / 6; for (let k = 0; k < n; k++) put(row, c0 + k, rk(u32(d, 4 + k * 6 + 2))); break; }
        case 0x0204: { const cch = u16(d, 6), fl = d[8]; let s = ''; if (fl & 1) for (let k = 0; k < cch; k++) s += String.fromCharCode(u16(d, 9 + k * 2)); else for (let k = 0; k < cch; k++) s += String.fromCharCode(d[9 + k]); put(u16(d, 0), u16(d, 2), s); break; }
        case 0x0006: { const row = u16(d, 0), col = u16(d, 2); if (d[12] === 0xFF && d[13] === 0xFF) { lastFormula = [row, col]; } else { put(row, col, dv(d, 6)); lastFormula = null; } break; }
        case 0x0207: { if (lastFormula) { const cch = u16(d, 0), fl = d[2]; let s = ''; if (fl & 1) for (let k = 0; k < cch; k++) s += String.fromCharCode(u16(d, 3 + k * 2)); else for (let k = 0; k < cch; k++) s += String.fromCharCode(d[3 + k]); put(lastFormula[0], lastFormula[1], s); lastFormula = null; } break; }
        default: break; } }
    const rows = []; for (let r = 0; r < sh.rows.length; r++) { const row = sh.rows[r] || []; const out = []; for (let c = 0; c < row.length; c++) out[c] = row[c] === undefined ? '' : row[c]; rows.push(out); } sh.rows = rows; });
  return { sheets: sheets.map((s) => ({ name: s.name, rows: s.rows })) };
}
const decEnt = (s) => String(s).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&amp;/g, '&').trim();
function readHtmlTable(text) { const rows = []; const re = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi; let m; while ((m = re.exec(text))) { const cells = []; const cr = /<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi; let c; while ((c = cr.exec(m[1]))) cells.push(decEnt(c[1])); if (cells.length) rows.push(cells); } return { sheets: [{ name: 'Sheet1', rows }] }; }
/** 파일 앞부분으로 형식을 알아내 읽는다: xlsx(zip) · xls(OLE2) · HTML 표 */
export async function readSpreadsheet(buf) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  if (b[0] === 0x50 && b[1] === 0x4b) return readXlsx(b);
  if (b[0] === 0xD0 && b[1] === 0xCF && b[2] === 0x11 && b[3] === 0xE0) { const o = oleStreams(b); const w = o.find('Workbook') || o.find('Book'); if (!w) throw new Error('엑셀 파일 안에서 시트를 찾지 못했습니다.'); return readBiff(w); }
  const head = new TextDecoder('utf-8', { fatal: false }).decode(b.subarray(0, 600)).toLowerCase(); if (head.includes('<table') || head.includes('<html')) { let t = new TextDecoder('utf-8').decode(b); if (t.includes('\uFFFD')) { try { t = new TextDecoder('euc-kr').decode(b); } catch (e) { /* 그대로 */ } } return readHtmlTable(t); }
  throw new Error('엑셀(.xls·.xlsx) 파일 형식이 아닙니다.');
}
