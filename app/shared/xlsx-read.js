/* 외부 라이브러리 없이 .xlsx 를 읽는다(브라우저의 DecompressionStream 사용) — 홈택스·카드사 내역 엑셀 가져오기용.
 * 반환: { sheets:[{ name, rows:[[셀값…]…] }] } — 셀은 문자열 또는 숫자, 빈 칸은 ''. 수식은 저장된 결과값을 읽는다. */
const u16 = (b, o) => b[o] | (b[o + 1] << 8); const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0;
async function inflateRaw(bytes) { const ds = new DecompressionStream('deflate-raw'); const w = ds.writable.getWriter(); w.write(bytes); w.close(); return new Uint8Array(await new Response(ds.readable).arrayBuffer()); }
/** ZIP 목록: 끝 디렉터리 → 중앙 디렉터리 → 항목별 압축 방식·위치 */
function zipEntries(b) {
  let e = -1; for (let i = b.length - 22; i >= Math.max(0, b.length - 66000); i--) { if (u32(b, i) === 0x06054b50) { e = i; break; } }
  if (e < 0) throw new Error('엑셀(.xlsx) 파일 형식이 아닙니다.');
  const n = u16(b, e + 10); let p = u32(b, e + 16); const out = {};
  for (let i = 0; i < n; i++) { if (u32(b, p) !== 0x02014b50) throw new Error('엑셀 파일이 손상되었습니다.'); const method = u16(b, p + 10), csize = u32(b, p + 20), nl = u16(b, p + 28), xl = u16(b, p + 30), cl = u16(b, p + 32), off = u32(b, p + 42); const name = new TextDecoder().decode(b.subarray(p + 46, p + 46 + nl)); out[name] = { method, csize, off }; p += 46 + nl + xl + cl; }
  return out;
}
async function readEntry(b, ent) { const o = ent.off; if (u32(b, o) !== 0x04034b50) throw new Error('엑셀 파일이 손상되었습니다.'); const data = b.subarray(o + 30 + u16(b, o + 26) + u16(b, o + 28), o + 30 + u16(b, o + 26) + u16(b, o + 28) + ent.csize); return ent.method === 0 ? data : inflateRaw(data); }
const dec = (s) => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&amp;/g, '&');
const text = (xml) => { let s = ''; const re = /<t\b[^>]*>([\s\S]*?)<\/t>/g; let m; while ((m = re.exec(xml))) s += dec(m[1]); return s; };
const colIdx = (ref) => { let n = 0; for (const ch of ref.replace(/[0-9]/g, '')) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };
export async function readXlsx(buf) {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf); const z = zipEntries(b); const get = async (name) => (z[name] ? new TextDecoder().decode(await readEntry(b, z[name])) : '');
  const sst = []; const sx = await get('xl/sharedStrings.xml'); { const re = /<si\b[^>]*>([\s\S]*?)<\/si>/g; let m; while ((m = re.exec(sx))) sst.push(text(m[1])); }
  const wb = await get('xl/workbook.xml'); const rels = await get('xl/_rels/workbook.xml.rels'); const relMap = {}; { const re = /<Relationship\b[^>]*>/g; let m; while ((m = re.exec(rels))) { const id = /\bId="([^"]+)"/.exec(m[0]), tg = /\bTarget="([^"]+)"/.exec(m[0]); if (id && tg) relMap[id[1]] = tg[1]; } }
  const sheets = []; const re = /<sheet\b[^>]*>/g; let m;
  while ((m = re.exec(wb))) { const name = (/\bname="([^"]*)"/.exec(m[0]) || [])[1] || ''; const rid = (/\br:id="([^"]+)"/.exec(m[0]) || [])[1]; let path = relMap[rid] || ''; path = path.startsWith('/') ? path.slice(1) : 'xl/' + path.replace(/^\.\//, ''); const xml = await get(path); const rows = [];
    const rr = /<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g; let r; while ((r = rr.exec(xml))) { const cells = []; const cc = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g; let c; while ((c = cc.exec(r[1] || ''))) { const attrs = c[1], body = c[2] || ''; const ref = (/\br="([A-Z]+[0-9]+)"/.exec(attrs) || [])[1]; if (!ref) continue; const t = (/\bt="([^"]+)"/.exec(attrs) || [])[1]; let v = ''; if (t === 's') { const x = /<v>([\s\S]*?)<\/v>/.exec(body); v = x ? sst[+x[1]] || '' : ''; } else if (t === 'inlineStr') v = text(body); else { const x = /<v>([\s\S]*?)<\/v>/.exec(body); v = x ? (t === 'str' || t === 'e' || t === 'b' ? dec(x[1]) : (x[1] !== '' && !isNaN(Number(x[1])) ? Number(x[1]) : dec(x[1]))) : ''; } cells[colIdx(ref)] = v; } for (let i = 0; i < cells.length; i++) if (cells[i] === undefined) cells[i] = ''; rows.push(cells); }
    sheets.push({ name: dec(name), rows }); }
  return { sheets };
}
