/* 주간 공정회의 PPT — 모든 프로젝트 같은 양식(순수: PptxGenJS 비슷한 객체를 받아 슬라이드를 만든다). 구포털 Ph2 의 주간 공정회의 자료 양식 그대로: 섹터마다 한 장.
 * 한 장의 구성: 제목("○○ 시공 현황")·주차(수~화 기준) · 섹터 칩("작업 이름_섹터") · 도면(원본 비율 유지)과 그 위에 장비 박스(도달한 최종 단계 색, 투명도 33%) · 범례(단계 흐름, 최전선 단계 강조) · 표(구역·Activity·Step·단위·총 물량·전주 누계(누계·공정률)·금주(금주·누계·공정률)·Remark).
 * 단계는 프로젝트의 공정 구조를 따른다. 도면이 없는 섹터는 "도면 미등록" 자리표시. */
import { calcGroup } from './progress.js?v=20261031f';
import { reachedStage, frontierIndex, fitContain } from './layout.js?v=20261031f';
import { stageColor, fmtDate } from './progress-ppt.js?v=20261031f';
const C = { navy: '1F3864', chip: 'D6DCE5', chipLn: 'A9BCDC', line: '8EA9D4', white: 'FFFFFF', text: '1E293B', sub: '64748B', headBg: 'EAF0F8', gridLn: 'D9E2EC' };
const FONT = '맑은 고딕';
export const weeklyFileName = (no, client, label) => no + '주차_' + String(client || '').replace(/\s+/g, '') + (client ? '_' : '') + String(label || '').replace(/\s+\(/g, '(').replace(/\s+/g, '_') + '_주간공정회의자료.pptx';
/** 섹터마다 이번 주(화요일 기준)와 전주의 단계별 완료 수·공정율 */
export function weeklyStats(structure, group, mergedThis, mergedLast) {
  const a = calcGroup(group, structure, mergedThis), b = calcGroup(group, structure, mergedLast); const total = group.items.length;
  const stats = a.stages.map((s, i) => ({ name: s.name, qty: s.done, pct: total ? s.done / total * 100 : 0, lastQty: b.stages[i].done, lastPct: total ? b.stages[i].done / total * 100 : 0 }));
  return { stats, total, calcThis: a, calcLast: b };
}
/** 슬라이드 만들기 — pres: PptxGenJS 인스턴스, meta: { client, label, title, unit }, week: { no, from, to }(YYYY-MM-DD), statesThis/statesLast: { 섹터 id: { merged } }, layouts: { 섹터 id: { points } }, images: { 섹터 id: { data | path, w, h } | null } */
export function buildWeekly(pres, meta, structure, week, statesThis, statesLast, layouts, images) {
  const stages = structure.stages; const unit = meta.unit || '대'; pres.layout = 'LAYOUT_WIDE';
  const grand = structure.groups.reduce((a, g) => { const c = calcGroup(g, structure, (statesThis[g.id] || {}).merged); return { ch: a.ch + c.totalChecked, mx: a.mx + c.mx }; }, { ch: 0, mx: 0 }); const totalPct = grand.mx ? grand.ch / grand.mx * 100 : 0;
  structure.groups.forEach((g) => {
    const mt = (statesThis[g.id] || {}).merged || {}, ml = (statesLast[g.id] || {}).merged || {}; const w = weeklyStats(structure, g, mt, ml); const frontier = frontierIndex(w.stats);
    const s = pres.addSlide(); s.background = { color: C.white };
    s.addText((meta.label || '').replace(/\s+\(/g, '(') + ' 시공 현황', { x: 0.45, y: 0.32, w: 9, h: 0.6, fontSize: 26, bold: true, fontFace: FONT, color: C.navy }); s.addText(week.no + '주차 · ' + fmtDate(week.from) + ' ~ ' + fmtDate(week.to) + ' 기준', { x: 9.3, y: 0.32, w: 3.6, h: 0.5, fontSize: 12, align: 'right', fontFace: FONT, color: C.sub, valign: 'bottom' });
    s.addShape('line', { x: 0.45, y: 1.0, w: 12.43, h: 0, line: { color: C.line, width: 1.5 } });
    s.addShape('roundRect', { x: 0.45, y: 1.18, w: 7.4, h: 0.55, fill: { color: C.chip }, line: { color: C.chipLn, width: 0.75 }, rectRadius: 0.08 }); s.addText((meta.title ? meta.title + '_' : '') + (g.name || '전체'), { x: 0.65, y: 1.18, w: 7.0, h: 0.55, fontSize: 17, bold: true, fontFace: FONT, color: C.navy, valign: 'middle' });
    const tblY = Math.min(5.5, 7.35 - 0.31 * (stages.length + 2)); /* 표 아래가 슬라이드 밖으로 나가지 않게(행 높이는 글자 크기에 따라 0.3 인치쯤) */ const boxX = 0.45, boxY = 2.05, maxW = 9.5, maxH = Math.max(1.5, tblY - 0.15 - boxY); const info = images && images[g.id]; const lay = layouts && layouts[g.id]; let ix, iy, iw, ih;
    if (info && info.w && info.h) { const f = fitContain(info.w, info.h, boxX, boxY, maxW, maxH); ix = f.x; iy = f.y; iw = f.w; ih = f.h; s.addImage(Object.assign({ x: ix, y: iy, w: iw, h: ih }, info.data ? { data: info.data } : { path: info.path })); }
    else { ix = boxX; iy = boxY; iw = maxW; ih = maxH; s.addShape('rect', { x: ix, y: iy, w: iw, h: ih, fill: { color: 'FAFBFC' }, line: { color: C.gridLn, width: 0.75, dashType: 'dash' } }); s.addText('도면 미등록', { x: ix, y: iy, w: iw, h: ih, align: 'center', valign: 'middle', fontSize: 12, color: C.sub, fontFace: FONT }); }
    if (info && info.w && lay && lay.points) Object.keys(lay.points).forEach((id) => { const b = lay.points[id]; const si = reachedStage(structure, mt, id); if (si < 0) return; s.addShape('rect', { x: ix + b.x * iw, y: iy + b.y * ih, w: b.w * iw, h: b.h * ih, fill: { color: stageColor(si), transparency: 33 }, line: { type: 'none' } }); });
    const legX = 10.15, legY = 2.05, legW = 2.73, pillH = Math.min(0.32, (tblY - legY - 0.9) / stages.length - 0.1), pillGap = 0.14, legH = 0.54 + stages.length * (pillH + pillGap) + 0.1;
    s.addShape('roundRect', { x: legX, y: legY, w: legW, h: legH, fill: { color: 'FFFFFF' }, line: { color: C.chipLn, width: 1.25 }, rectRadius: 0.12 }); s.addText('범례', { x: legX, y: legY + 0.14, w: legW, h: 0.26, fontSize: 12, bold: true, align: 'center', fontFace: FONT, color: C.navy });
    const pillW = legW - 0.6, pillX = legX + 0.3, startY = legY + 0.54;
    stages.forEach((sg, i) => { const py = startY + i * (pillH + pillGap); s.addShape('roundRect', { x: pillX, y: py, w: pillW, h: pillH, fill: { color: stageColor(i) }, line: { type: 'none' }, rectRadius: 0.5 }); s.addText(sg.name, { x: pillX, y: py, w: pillW, h: pillH, align: 'center', valign: 'middle', fontSize: 11, bold: i === frontier, fontFace: FONT, color: 'FFFFFF' }); if (i < stages.length - 1) s.addText('↓', { x: pillX, y: py + pillH, w: pillW, h: pillGap, align: 'center', valign: 'middle', fontSize: 9, fontFace: FONT, color: C.sub }); });
    const H = (t, o) => ({ text: t, options: Object.assign({ bold: true, fill: { color: C.headBg }, align: 'center' }, o || {}) }); const rows = [];
    rows.push([H('구 역', { valign: 'middle', rowspan: 2 }), H('Activity', { valign: 'middle', rowspan: 2 }), H('Step', { valign: 'middle', rowspan: 2 }), H('단위', { valign: 'middle', rowspan: 2 }), H('총 물량', { valign: 'middle', rowspan: 2 }), H('전주 누계', { colspan: 2 }), H('금주 누계', { colspan: 3 }), H('Remark', { valign: 'middle', rowspan: 2 })]);
    rows.push([H('누계'), H('공정률'), H('금주'), H('누계'), H('공정률')]);   // 둘째 머리글 행에는 병합(rowspan)으로 이어지는 칸을 넣지 않는다 — 구포털 방식(빈 칸을 따로 넣음)은 열이 17개가 되어 표가 깨졌다
    w.stats.forEach((st, i) => { const wk = st.qty - st.lastQty; const col = stageColor(i); const row = [];
      if (i === 0) { row.push({ text: g.name || '전체', options: { align: 'center', valign: 'middle', rowspan: stages.length } }); row.push({ text: meta.title || '공정', options: { align: 'center', valign: 'middle', rowspan: stages.length } }); }
      row.push({ text: st.name, options: { align: 'center', color: col, bold: i === frontier } }); row.push({ text: unit, options: { align: 'center' } }); if (i === 0) row.push({ text: String(w.total), options: { align: 'center', valign: 'middle', rowspan: stages.length } });
      row.push({ text: String(st.lastQty), options: { align: 'center' } }); row.push({ text: st.lastPct.toFixed(0) + '%', options: { align: 'center', color: col } }); row.push({ text: (wk > 0 ? '+' : '') + wk, options: { align: 'center' } }); row.push({ text: String(st.qty), options: { align: 'center' } }); row.push({ text: st.pct.toFixed(0) + '%', options: { align: 'center', color: col, bold: i === frontier } });
      if (i === 0) row.push({ text: '전체 공정율 ' + totalPct.toFixed(1) + '%', options: { align: 'center', valign: 'middle', rowspan: stages.length, fontSize: 10, color: C.navy, bold: true } }); rows.push(row); });
    s.addTable(rows, { x: 0.45, y: tblY, w: 12.43, colW: [1.4, 1.3, 1.1, 0.7, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.83], fontSize: stages.length > 6 ? 9 : 11, fontFace: FONT, border: { type: 'solid', color: C.gridLn, pt: 0.75 }, color: C.text, valign: 'middle', autoPage: false });
  });
  return { fileName: weeklyFileName(week.no, meta.client, meta.label), slideCount: pres.__slides ? pres.__slides.length : undefined, totalPct };
}
