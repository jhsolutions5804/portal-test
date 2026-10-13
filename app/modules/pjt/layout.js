/* PJT 장비 배치도(도면 매핑)와 주간 공정회의 PPT 의 순수 규칙 — 모든 프로젝트 같은 규칙(화면·네트워크 없이 시험 가능).
 * 배치도 데이터: 섹터마다 { points: { <품목 id>: { x, y, w, h } }, image?: 데이터 URL } — 좌표는 도면 이미지 크기 대비 0~1 비율이라 이미지 크기가 달라져도 위치가 맞는다.
 * 저장(동결): Ph2 는 구포털 그대로 zone_layouts/<섹터 id>(도면 이미지는 저장소의 정적 파일 pjt/assets/floorplans/<섹터 id>.png), 그 밖의 프로젝트는 도면 이미지를 올려 같은 문서의 image 필드에 둔다(어댑터가 위치를 정한다). */
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const variance = (a) => { const m = mean(a); return mean(a.map((v) => (v - m) * (v - m))); };
export const CLICK_PX = 8;   // 이보다 작게 움직이면 드래그가 아니라 "클릭"으로 본다
/** 이미 찍은 박스들의 평균 크기(클릭으로 배치할 때 기준 크기). 박스가 없으면 null */
export function refSize(points) { const k = Object.keys(points || {}); if (!k.length) return null; return { w: mean(k.map((i) => points[i].w)), h: mean(k.map((i) => points[i].h)) }; }
/** 클릭 위치 보정: 직전에 배치한(순서상 앞의) 박스 4개까지의 중심이 한 줄(가로 또는 세로)을 이루면 그 줄에 맞춘다. 줄과 수직인 성분만 보정하고 줄 방향 위치는 클릭 그대로.
 *  order = 품목 id 순서, cur = 지금 배치하는 품목의 순서 번호 */
export function snapToAlignment(points, order, cur, clickX, clickY) {
  const pts = points || {}; const recent = [];
  for (let i = cur - 1; i >= 0 && recent.length < 4; i--) { const b = pts[order[i]]; if (b) recent.push({ x: b.x + b.w / 2, y: b.y + b.h / 2 }); }
  if (recent.length < 2) return { x: clickX, y: clickY };
  const xs = recent.map((p) => p.x), ys = recent.map((p) => p.y); const xv = variance(xs), yv = variance(ys), ax = mean(xs), ay = mean(ys); const ref = refSize(pts); const tolY = ref ? ref.h * 1.5 : 0.05, tolX = ref ? ref.w * 1.5 : 0.05;
  if (yv < xv * 0.3 && Math.abs(clickY - ay) < tolY) return { x: clickX, y: ay };
  if (xv < yv * 0.3 && Math.abs(clickX - ax) < tolX) return { x: ax, y: clickY };
  return { x: clickX, y: clickY };
}
/** 마우스·터치 제스처 → 저장할 박스. start·end = 도면 위 픽셀 좌표, size = { w, h } 도면 표시 크기(px). 작은 움직임(클릭)은 기준 크기를 클릭 지점 중심에 적용(기준 크기가 없으면 안내), 드래그는 그린 크기 그대로 */
export function boxFromGesture(start, end, size, points, order, cur) {
  const bx = Math.min(start.x, end.x), by = Math.min(start.y, end.y), bw = Math.abs(end.x - start.x), bh = Math.abs(end.y - start.y);
  if (bw < CLICK_PX && bh < CLICK_PX) { const ref = refSize(points); if (!ref) return { error: '먼저 품목 1개는 직접 드래그해서 기준 크기를 잡아 주세요. 이후부터는 클릭만으로 같은 크기가 자동 적용됩니다.' };
    const s = snapToAlignment(points, order, cur, end.x / size.w, end.y / size.h); return { box: { x: s.x - ref.w / 2, y: s.y - ref.h / 2, w: ref.w, h: ref.h } }; }
  return { box: { x: bx / size.w, y: by / size.h, w: bw / size.w, h: bh / size.h } };
}
/** 박스들을 중심은 그대로 두고 크기만 중앙값으로 통일(2개 미만이면 null) */
export function normalizeSizes(points) {
  const k = Object.keys(points || {}); if (k.length < 2) return null; const med = (arr) => arr.slice().sort((a, b) => a - b)[Math.floor(arr.length / 2)]; const mw = med(k.map((i) => points[i].w)), mh = med(k.map((i) => points[i].h)); const out = {};
  k.forEach((i) => { const b = points[i]; const cx = b.x + b.w / 2, cy = b.y + b.h / 2; out[i] = { x: cx - mw / 2, y: cy - mh / 2, w: mw, h: mh }; }); return { points: out, w: mw, h: mh };
}
const clamp01 = (n) => Math.max(0, Math.min(1, n));
/** 박스 하나를 0~1 범위로 정리(이미지 밖으로 나가지 않게, 너무 작은 박스는 거부) */
export function cleanBox(b) { if (!b || ![b.x, b.y, b.w, b.h].every((n) => typeof n === 'number' && isFinite(n))) return null; const x = clamp01(b.x), y = clamp01(b.y); const w = Math.min(b.w, 1 - x), h = Math.min(b.h, 1 - y); return w > 0.002 && h > 0.002 ? { x, y, w, h } : null; }
export const withPoint = (layout, id, box) => { const o = Object.assign({}, layout || {}); o.points = Object.assign({}, o.points); o.points[id] = box; return o; };
export const withoutPoint = (layout, id) => { const o = Object.assign({}, layout || {}); o.points = Object.assign({}, o.points); delete o.points[id]; return o; };
/** 매핑 진행: 섹터 품목 중 좌표가 있는 수 */
export const mappedCount = (items, points) => items.filter((it) => !!(points || {})[it.id]).length;
/** 품목이 지금 도달한 최종 단계(도면 박스 색): 단계 순서의 뒤에서부터 보아 처음으로 완료된 단계(합성 단계는 하위 항목이 모두 체크돼야 완료). 하나도 없으면 -1 */
export function reachedStage(structure, merged, itemId) {
  const m = merged || {}; const done = (st) => (st.subs ? st.subs.every((c) => m[itemId + '_' + c]) : !!m[itemId + '_' + st.name]);
  for (let i = structure.stages.length - 1; i >= 0; i--) if (done(structure.stages[i])) return i; return -1;
}
/** "진행 중인 최전선 단계": 공정율이 0보다 큰 단계 중 가장 뒤쪽(없으면 -1). stats = 단계별 { pct } */
export function frontierIndex(stats) { let f = -1; stats.forEach((s, i) => { if (s.pct > 0) f = i; }); return f; }
/** 박스 안에 원본 비율을 유지하며 최대로 맞춰 넣고 가운데 정렬(object-fit: contain) */
export function fitContain(natW, natH, boxX, boxY, maxW, maxH) { const ratio = natW / natH; let w = maxW, h = maxW / ratio; if (h > maxH) { h = maxH; w = maxH * ratio; } return { x: boxX + (maxW - w) / 2, y: boxY + (maxH - h) / 2, w, h }; }
/* ── 주간 공정회의 주차 계산: 회의는 화요일 기준, 한 주는 수요일~화요일. 기준(앵커)은 30주차 = 2026-07-15(수) ~ 2026-07-21(화) ── */
export const WEEK_ANCHOR = { tue: '2026-07-21', no: 30 };
const parse = (k) => { const [y, m, d] = k.split('-').map(Number); return Date.UTC(y, m - 1, d); };
const fmt = (t) => { const d = new Date(t); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0'); };
/** 입력 날짜가 속한(또는 그 뒤 처음 오는) 화요일 */
export function snapToTuesday(dateKey) { const t = parse(dateKey); const dow = new Date(t).getUTCDay(); return fmt(t + ((2 - dow + 7) % 7) * 86400000); }
export function weekNo(tueKey, anchor) { const a = anchor || WEEK_ANCHOR; return a.no + Math.round(Math.round((parse(tueKey) - parse(a.tue)) / 86400000) / 7); }
export const weekRange = (tueKey) => ({ from: fmt(parse(tueKey) - 6 * 86400000), to: tueKey, last: fmt(parse(tueKey) - 7 * 86400000) });
/** 도면 좌표의 품목 번호가 섹터의 품목과 맞지 않는 것(좌표는 있는데 품목에 없는 키) — 예: 본섭 Ph2 W-OB 의 좌표 키는 801~881 인데 품목은 W-101~W-181 */
export function unmatchedKeys(points, items) { const ids = new Set((items || []).map((i) => i.id)); return Object.keys(points || {}).filter((k) => !ids.has(k)); }
const natKey = (s) => String(s).replace(/\d+/g, (m) => m.padStart(8, '0'));
/** 번호를 순서대로 맞추기: 맞지 않는 좌표 키를 자연 순서(숫자는 크기 순)로 정렬해 아직 좌표가 없는 품목에 앞에서부터 하나씩 대응시킨다 — 이미 맞는 좌표는 건드리지 않는다. 반환 { points, pairs: [[옛 키, 품목 id]…] } */
export function remapByOrder(points, items) {
  const bad = unmatchedKeys(points, items).sort((a, b) => (natKey(a) < natKey(b) ? -1 : natKey(a) > natKey(b) ? 1 : 0)); const free = (items || []).filter((i) => !(points || {})[i.id]); const out = {}; const pairs = [];
  Object.keys(points || {}).forEach((k) => { if (bad.indexOf(k) === -1) out[k] = points[k]; });
  bad.forEach((k, i) => { if (free[i]) { out[free[i].id] = points[k]; pairs.push([k, free[i].id]); } });
  return { points: out, pairs, left: bad.length - pairs.length };
}
