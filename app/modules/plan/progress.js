/* 영업기획 공정 연동 청구서 — 순수 규칙(화면·네트워크 없이 시험 가능). 구포털 기획(gihoek)의 공정 자동 청구 계산을 그대로 옮겼다.
 * 견적 공급가액의 반입 80% + 설치 20% (+ 보증금 10%) 를 장비 수 대비 진척(반입 b/전체, 설치 i/전체)으로 계산하고, 이미 청구한 금액(기청구)을 뺀 값이 이번 청구액이다.
 * 반입·설치 진척은 날짜별 공정 체크 문서(연동 프로젝트의 progress_days)를 2026-05-01부터 기준월 말일까지 한 번이라도 체크된 것으로 모아 센다(구포털 그대로). */
import { estSupply, getLinkPjt } from './projects.js?v=20261031f';
export const BANIP_RATE = 0.8, INSTALL_RATE = 0.2, DEPOSIT_RATE = 0.1;
export const PROGRESS_SINCE = '2026-05-01';   // 구포털이 누적 진척을 읽기 시작하는 날(고정)
const num = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return Number.isNaN(n) ? 0 : n; };
/** 연동 프로젝트의 공정 프로파일(섹터·장비 목록·단계) — PJT 모듈이 저장한 공정 구조(프로젝트 문서의 progressStructure)로 만든다. 청구서 화면을 열 때 구조를 읽어 setProgressOverrides({ <프로젝트 id>: 프로파일 })로 넣는다(모든 프로젝트 같은 방식, 코드 상수 없음) */
let OVERRIDES = {};
export const setProgressOverrides = (m) => { OVERRIDES = m || {}; };
const EMPTY_PROFILE = { zones: [], checkCols: [], installCols: [] };
export function getProgProfile(project) { return OVERRIDES[getLinkPjt(project)] || EMPTY_PROFILE; }
/** 섹터·장비 자동추적이 되는 프로젝트(연동 프로젝트에 섹터·품목 구조가 있음) — 공정 연동 방식은 이 프로젝트의 견적에서만 쓴다 */
export const isTrackable = (project) => getProgProfile(project).zones.length > 0;
/** 견적 제목에서 섹터 추정(구포털 zoneGuess): 섹터의 키워드가 제목에 들어 있으면 그 섹터, 없으면 '' */
export const zoneGuess = (title, zones) => { const t = title || ''; const z = (zones || []).find((z) => z.kw.some((k) => t.includes(k))); return z ? z.id : ''; };
export function compactRanges(arr){ if(!arr||!arr.length) return '-';
  const parsed=arr.map(s=>{const m=String(s).match(/^(.*?)(\d+)$/); return m?{stem:m[1],n:parseInt(m[2]),raw:s}:{stem:String(s),n:null,raw:String(s)};});
  parsed.sort((a,b)=> a.stem===b.stem ? ((a.n||0)-(b.n||0)) : a.stem.localeCompare(b.stem));
  const out=[]; let i=0;
  while(i<parsed.length){ const p=parsed[i]; if(p.n==null){ out.push(p.raw); i++; continue; }
    let j=i; while(j+1<parsed.length && parsed[j+1].stem===p.stem && parsed[j+1].n===parsed[j].n+1) j++;
    out.push(j>i? parsed[i].raw+'~'+parsed[j].raw : p.raw); i=j+1; }
  return out.join(', ');
}
/** 기청구: 이미 발행된(폐기 아닌) 청구서가 그 견적에 청구한 금액 합 — 방식과 상관없이 perEst 에 기록된 모두(구포털 priorByEst) */
export const priorByEst = (settlements, estId) => (settlements || []).filter((s) => s.status !== 'void' && s.docType === 'invoice' && s.perEst && s.perEst[estId]).reduce((a, s) => a + s.perEst[estId], 0);
/** 견적 하나의 청구 계산(구포털 calcSetRow): 누적 = 반입 80% × (반입 수/전체) + 설치 20% × (설치 수/전체) + 보증금 10%(체크 시), 이번 청구 = 누적 − 기청구(0 미만은 0), 직접 고친 값이 있으면 그 값 */
export function calcProgressRow(d, e, zones, settlements) {
  const sup = estSupply(e); const z = (zones || []).find((z) => z.id === (d.estZone || {})[e.id]); const qty = z ? z.total : 1; const pg = (d.prog || {})[e.id] || { banip: 0, install: 0 };
  const banipAmt = Math.round(sup * BANIP_RATE * (pg.banip / qty)), installAmt = Math.round(sup * INSTALL_RATE * (pg.install / qty)), depAmt = (d.deposit || {})[e.id] ? Math.round(sup * DEPOSIT_RATE) : 0;
  const cum = banipAmt + installAmt + depAmt; const prior = priorByEst(settlements, e.id); const auto = Math.max(0, cum - prior); const ov = (d.billOverride || {})[e.id];
  return { banip: pg.banip, install: pg.install, qty, cum, prior, auto, thisBill: ov != null ? ov : auto, zone: z || null };
}
/** 견적 선택/해제(구포털 toggleSetEst): 선택하면 섹터는 제목으로 추정(없으면 첫 섹터), 진척은 0으로 시작 */
export function toggleProgressEst(d, id, guess, zones) {
  const i = d.estIds.indexOf(id);
  if (i < 0) { d.estIds.push(id); if (!d.estZone[id]) d.estZone[id] = guess || (zones[0] && zones[0].id) || ''; if (!d.prog[id]) d.prog[id] = { banip: 0, install: 0 }; if (!d.eqs[id]) d.eqs[id] = { banipEqs: [], installEqs: [] }; } else d.estIds.splice(i, 1);
}
export const setProgressZone = (d, id, z) => { d.estZone[id] = z; d.billOverride[id] = null; };
export const toggleProgressDeposit = (d, id) => { d.deposit[id] = !d.deposit[id]; d.billOverride[id] = null; };
export const setProgressBill = (d, id, v) => { d.billOverride[id] = Math.max(0, num(v)); };
/** 날짜별 공정 체크 문서(progress_days: [{ id(날짜), data: { groups: { 섹터 id: { 키: true } } } }])들을 섹터별로 합친다: PROGRESS_SINCE 부터 endKey(기준월 말일)까지 한 번이라도 체크된 항목은 계속 체크된 것으로 */
export function accumulateDays(dayDocs, zoneIds, endKey) {
  const cum = {}; (zoneIds || []).forEach((z) => { cum[z] = {}; });
  (dayDocs || []).forEach((dd) => { if (dd.id < PROGRESS_SINCE || dd.id > endKey) return; const g = (dd.data || {}).groups || {}; Object.keys(g).forEach((z) => { if (cum[z]) Object.keys(g[z] || {}).forEach((k) => { if (g[z][k]) cum[z][k] = true; }); }); });
  return cum;
}
/** 불러온 누적 체크로 견적별 반입·설치 장비 수와 번호를 정한다(구포털 fetchProgress): 반입 = '<장비>_반입' 체크, 설치 = 설치 공정 항목이 모두 체크. 직접 고친 청구액은 초기화 */
export function applyProgress(d, cum, profile) {
  d.estIds.forEach((id) => {
    const zid = d.estZone[id]; const z = profile.zones.find((z) => z.id === zid); const ch = cum[zid] || {}; let banip = 0, install = 0; const banipEqs = [], installEqs = [];
    if (z) z.eqs.forEach((eq) => { if (ch[eq + '_반입']) { banip++; banipEqs.push(eq); } if (profile.installCols.every((it) => ch[eq + '_' + it])) { install++; installEqs.push(eq); } });
    d.prog[id] = { banip, install }; d.eqs[id] = { banipEqs, installEqs }; d.billOverride[id] = null;
  });
}
/** 정산서 내역 한 줄(구포털 settleLines): 견적 제목 / "섹터 반입 b/전체 (장비 범위) · 설치 i/전체 (범위)" / 이번 청구액 */
export function progressLine(d, e, zones, settlements) {
  const r = calcProgressRow(d, e, zones, settlements); const eqd = (d.eqs || {})[e.id] || { banipEqs: [], installEqs: [] };
  const bN = eqd.banipEqs && eqd.banipEqs.length ? ' (' + compactRanges(eqd.banipEqs) + ')' : ''; const iN = eqd.installEqs && eqd.installEqs.length ? ' (' + compactRanges(eqd.installEqs) + ')' : '';
  return { name: e.title, spec: (r.zone ? r.zone.name : '') + ' 반입 ' + r.banip + '/' + r.qty + bN + ' · 설치 ' + r.install + '/' + r.qty + iN, qty: 1, price: r.thisBill, amount: r.thisBill };
}
