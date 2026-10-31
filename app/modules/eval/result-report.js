/* 평가 결과 통보서 — 순수 규칙(화면·네트워크 없이 시험 가능). 확정된 정기평가(+ 확정된 수시평가)를 직원 본인에게 알리는 문서의 "내용 결정"과 "HTML 생성".
 *  원칙: ① 확정된 평가만 ② 직원이 알아도 되는 것만 — 최종 점수·등급·영역별 점수·동료 평균·수시평가 결과·본인 자기평가. 사장단 개인별 점수·코멘트, 동료·팀장 개별 점수, 평가자 식별 정보는 넣지 않는다.
 *  ③ 문서는 메일 본문이 아니라 "본인 확인(휴대폰 문자 인증) 링크" 뒤에 저장되어, 본인만 본다. */
import { cycleSummary, areaItems, teamTypeOf, WEIGHTS_BY, AREA_LABELS, areaScore, leadAreasOf, adhocSummary, combineRegular, gradeOf, evalPeriod } from './evaluation.js?v=20261031f';
import { docFileName } from '../../shared/doc-filename.js?v=20261031f';
export const RESULT_DOC_TYPE = 'evalresult';
export const RESULT_TITLE = '인사평가 결과 통보서';
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const r1 = (n) => Math.round(n * 10) / 10;
const mean = (a) => { const v = (a || []).map(Number).filter((n) => isFinite(n)); return v.length ? v.reduce((x, y) => x + y, 0) / v.length : null; };
const AREAS = ['achievement', 'competency', 'conduct'];

/** 영역별 점수표: [{ key, label, weight, avg(5점 만점 평균), score(비중으로 환산한 점수) }] — 계산에 쓰인 값과 같은 출처(팀장 평가 집계 우선, 없으면 사장단 입력)를 쓴다 */
function areaRows(cycle, items, type) {
  const w = WEIGHTS_BY(type); const c = cycle || {}; const rows = [];
  if (type === 'pjt') {
    const src = leadAreasOf(c.leadAgg, items) || (c.team && c.team.areas) || {};
    for (const k of AREAS) rows.push({ key: k, label: AREA_LABELS[k], weight: w[k], avg: mean(src[k]), score: areaScore(src[k], w[k]) });
    const pa = Number(c.peerAgg && c.peerAgg.avg); const ok = c.peerAgg && c.peerAgg.avg !== null && c.peerAgg.avg !== '' && isFinite(pa) && pa >= 1 && pa <= 5;
    rows.push({ key: 'peer', label: AREA_LABELS.peer, weight: w.peer, avg: ok ? pa : null, score: ok ? areaScore([pa], w.peer) : null });
  } else {
    const raters = Object.values(c.exec || {}).filter((e) => e && e.areas && AREAS.every((k) => Array.isArray(e.areas[k]) && e.areas[k].length >= (items[k] || []).length && e.areas[k].slice(0, (items[k] || []).length).every((n) => isFinite(Number(n)))));
    for (const k of AREAS) { const avgs = raters.map((e) => mean(e.areas[k])).filter((x) => x != null); const scs = raters.map((e) => areaScore(e.areas[k], w[k])).filter((x) => x != null); rows.push({ key: k, label: AREA_LABELS[k], weight: w[k], avg: avgs.length ? mean(avgs) : null, score: scs.length ? r1(mean(scs)) : null }); }
  }
  return rows;
}

/** 통보서 내용 결정. o = { year, worker:{ id, name, dept, rank }, cycle(정기평가 문서), adhoc:[{ pjtName, rec(수시평가 문서), proj(프로젝트 성과 문서) }] }
 *  반환: { ok:true, data } | { ok:false, reason } — 확정되지 않았으면 만들지 않는다 */
export function buildResultData(o) {
  const x = o || {}; const w = x.worker || {}; const year = Number(x.year); const p = evalPeriod(year);
  if (!p) return { ok: false, reason: '평가 연도가 올바르지 않습니다.' };
  if (!x.cycle) return { ok: false, reason: '정기평가 기록이 없습니다.' };
  const type = teamTypeOf(w.dept); const items = areaItems(w.dept, w.rank); const sm = cycleSummary(x.cycle, { teamType: type, items });
  if (sm.final == null) return { ok: false, reason: '아직 확정되지 않은 평가입니다(팀 평가 완료 → 대표 확정 후에 안내할 수 있습니다).' };
  const adhoc = []; (x.adhoc || []).forEach((a) => { if (!a) return; const s = adhocSummary(a.rec, a.proj); if (s.final != null) adhoc.push({ name: String(a.pjtName || a.rec && a.rec.pjtName || '프로젝트'), final: s.final, grade: gradeOf(s.final) }); });
  const combined = adhoc.length ? combineRegular(sm.final, adhoc.map((a) => a.final)) : null;
  const selfText = String((x.cycle.self && x.cycle.self.text) || '').trim().slice(0, 2000);
  return { ok: true, data: { year, period: p, worker: { name: String(w.name || ''), dept: String(w.dept || ''), rank: String(w.rank || '') }, teamType: type, final: sm.final, grade: sm.grade, areas: areaRows(x.cycle, items, type), peerN: type === 'pjt' ? sm.raters : 0, adhoc, combined, combinedGrade: combined == null ? '' : gradeOf(combined), selfText } };
}

const CSS = 'body{margin:0;padding:18px;font-family:-apple-system,"Malgun Gothic","Noto Sans KR",sans-serif;color:#1f2937;line-height:1.6;background:#fff}.w{max-width:720px;margin:0 auto}h1{font-size:20px;margin:0 0 4px;color:#0f2a5c}h2{font-size:15px;margin:22px 0 8px;padding-left:9px;border-left:4px solid #1d4ed8;color:#0f2a5c}p{margin:6px 0}.sub{color:#6b7280;font-size:13px}table{border-collapse:collapse;width:100%;margin:6px 0}th,td{border:1px solid #cbd5e1;padding:7px 9px;text-align:left;font-size:14px}th{background:#eef2fb;width:28%}.c{text-align:center}.big{display:flex;gap:10px;flex-wrap:wrap;margin:10px 0}.card{flex:1 1 140px;border:2px solid #1d4ed8;background:#eef3ff;padding:10px 12px;text-align:center}.card b{display:block;font-size:26px;color:#0f2a5c}.card span{font-size:12px;color:#475569}.box{border:1px solid #cbd5e1;background:#f8fafc;padding:10px 12px;white-space:pre-wrap;font-size:14px}.note{border:2px solid #1d4ed8;background:#f0f6ff;padding:10px 12px;margin:14px 0;font-size:14px}.foot{margin-top:18px;padding-top:8px;border-top:1px solid #d1d5db;color:#6b7280;font-size:12px}@media print{body{padding:0}.card{break-inside:avoid}}';
const fmt = (n) => (n == null ? '-' : String(n));

/** 통보서 HTML(문서 전체). 모든 값은 이스케이프하고 스크립트·외부 자원이 없다. opts.today = 발행일(YYYY-MM-DD) */
export function resultHtml(d, opts) {
  const o = opts || {}; const w = d.worker; const rows = d.areas.filter((r) => r.weight > 0);
  const areaTable = '<table><tr><th class="c">영역</th><th class="c">비중</th><th class="c">평균(5점 만점)</th><th class="c">환산 점수</th></tr>' + rows.map((r) => '<tr><td>' + esc(r.label) + '</td><td class="c">' + esc(r.weight) + '점</td><td class="c">' + (r.avg == null ? '-' : esc(r1(r.avg))) + '</td><td class="c">' + (r.score == null ? '-' : esc(r.score)) + '</td></tr>').join('') + '</table>';
  const peerNote = d.teamType === 'pjt' ? '<p class="sub">동료평가는 같은 팀 동료들이 익명으로 평가한 평균입니다. 누가 몇 점을 주었는지는 누구에게도 공개되지 않습니다.</p>' : '';
  const adhocTable = d.adhoc.length ? '<h2>수시평가 (프로젝트별)</h2><table><tr><th class="c">프로젝트</th><th class="c">최종 점수</th><th class="c">등급</th></tr>' + d.adhoc.map((a) => '<tr><td>' + esc(a.name) + '</td><td class="c">' + esc(a.final) + '</td><td class="c">' + esc(a.grade) + '</td></tr>').join('') + '</table>' : '';
  const combined = d.combined != null ? '<div class="card"><b>' + esc(d.combined) + '</b><span>종합 점수 · ' + esc(d.combinedGrade) + '등급<br>(정기 60% + 수시 40%)</span></div>' : '';
  const self = d.selfText ? '<h2>나의 자기평가</h2><div class="box">' + esc(d.selfText) + '</div>' : '';
  return '<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>' + esc(RESULT_TITLE) + '</title><style>' + CSS + '</style></head><body><div class="w">'
    + '<h1>' + esc(d.year) + '년 ' + esc(RESULT_TITLE) + '</h1><p class="sub">평가 기간 ' + esc(d.period.from) + ' ~ ' + esc(d.period.to) + '</p>'
    + '<table><tr><th>성명</th><td>' + esc(w.name) + '</td></tr><tr><th>소속 · 직급</th><td>' + esc(w.dept) + ' · ' + esc(w.rank) + '</td></tr></table>'
    + '<h2>정기평가 결과</h2><div class="big"><div class="card"><b>' + esc(d.final) + '</b><span>정기평가 최종 점수 · ' + esc(d.grade) + '등급</span></div>' + combined + '</div>'
    + areaTable + peerNote + adhocTable + self
    + '<div class="note"><b>안내</b><br>올해 평가 결과는 <b>참고자료</b>로 활용하며 연봉·고과에 직접 반영하지 않습니다. 연봉협상 면담에서 이 결과를 함께 살펴봅니다.<br>면담 때 <b>본인이 준비한 실적 보고서</b>를 지참(또는 사전 제출)해 주세요. 면담 일정과 제출 방법은 인사총무팀에서 별도로 안내드립니다.</div>'
    + '<div class="foot">JH솔루션즈 인사총무팀' + (o.today ? ' · 발행일 ' + esc(o.today) : '') + '<br>이 문서는 본인 확인(휴대폰 문자 인증)을 거친 본인에게만 보이는 문서입니다. 외부로 공유하지 말아 주세요.</div></div></body></html>';
}

/* ───────── 인쇄(대기열 1-2-7 ②, 대표님 2026-10-22) ─────────
 * 관리자 화면의 미리보기는 sandbox="" iframe 이라 바깥에서 contentWindow.print() 를 부를 수 없다(교차 출처 차단 — 실제 크로미움에서 확인) → [인쇄] 버튼은 영업기획 문서처럼 새 창에 문서를 쓰고 인쇄한다.
 * 직원에게 보내는 확인 링크가 같은 resultHtml 을 쓰므로 resultHtml(발송·미리보기)은 바꾸지 않는다 — 새 창에 쓸 때만 아래 resultPrintHtml 로 <title> 을 문서 이름으로 바꾸고 인쇄 스크립트를 더한다. */
/** 문서 이름 — 종류 - 이름 - 평가 연도(점수·부서·직급은 넣지 않는다). d = buildResultData 의 data 또는 { year, worker:{ name } } */
export function resultPrintTitle(d) {
  const x = d && typeof d === 'object' && !Array.isArray(d) ? d : {}; const w = x.worker && typeof x.worker === 'object' ? x.worker : {};
  return docFileName({ group: 'person', kind: RESULT_TITLE, name: w.name, year: x.year });
}
const PRINT_SCRIPT = '<scr' + 'ipt>window.onload=function(){setTimeout(function(){window.print();},250);}</scr' + 'ipt>';
const cleanTitle = (t) => (typeof t === 'string' ? t.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200).trim() : '');
/** 새 창에 쓸 인쇄용 문서 — 본문은 그대로 두고 <title> 을 문서 이름으로 바꾸고(이스케이프) 문서를 다 읽은 뒤 인쇄하는 고정 스크립트를 더한다. 제목이 비면 원래 제목을 둔다 */
export function resultPrintHtml(html, title) {
  let h = typeof html === 'string' ? html : ''; const t = cleanTitle(title);
  if (t) { const tag = '<title>' + esc(t) + '</title>'; if (/<title>[\s\S]*?<\/title>/i.test(h)) h = h.replace(/<title>[\s\S]*?<\/title>/i, () => tag); else if (/<head[^>]*>/i.test(h)) h = h.replace(/<head[^>]*>/i, (m) => m + tag); else h = tag + h; }
  const i = h.toLowerCase().lastIndexOf('</body>'); return i >= 0 ? h.slice(0, i) + PRINT_SCRIPT + h.slice(i) : h + PRINT_SCRIPT;
}
