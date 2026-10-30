/* 영업기획 월간 보고서 엑셀(CSV) 내려받기 — 순수 함수(화면·네트워크 없음). 대기열 1-2-8 5단계, 대표님 2026-10-22. 시험: tests/plan-monthly-mgmt-csv.test.mjs.
 * 입력은 화면과 같은 컨트롤러 상태(st)라 화면 숫자와 파일 숫자가 같은 출처다. 구역 4개를 한 파일에 위아래로: 그 달 실적 · 추이(마진율) · 추이(노무 수율) · 원가 달성률.
 * 숫자는 원 단위 숫자 그대로(쉼표·원·% 없이 — 엑셀이 숫자로 읽어 합계·정렬이 된다), 음수 마진율도 숫자. 모르는 값은 빈 칸(숫자 열에 글자를 섞지 않음)이고 이유는 비고에 적는다. 서버 원가를 모르면 원가·마진율·노무 수율을 비우고 맨 위에 경고한다.
 * 수식으로 시작하는 글자(프로젝트 이름 등)는 shared/csv.js 가 보호한다. 직원·개인 정보는 화면에 없으므로 파일에도 없다. */
import { csvText } from '../../shared/csv.js?v=20261030a';
import { docFileName } from '../../shared/doc-filename.js?v=20261030a';
const isO = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const lbl = (r) => ((typeof r.code === 'string' && r.code ? r.code : '-') + (typeof r.name === 'string' && r.name ? ' ' + r.name : ''));
const note = (r) => { const n = []; if (r.status === 'nolink') n.push('PJT 연결 없음'); else if (r.status === 'nocost') n.push('원가 확인 못함'); else { if (r.restated === true) n.push('전달 값 정정됨'); if (!(num(r.collected) > 0)) n.push('완결 청구 없음'); else if (!(num(r.ownLabor) > 0)) n.push('노무 없음'); } return n.join('; '); };
const ach = (a) => (a.status === 'notarget' ? '목표 마진율 미입력' : a.status === 'badtarget' ? '목표 마진율이 100% 이상' : a.status === 'nolink' ? 'PJT 연결 없음' : a.status === 'nocost' ? '원가 확인 못함' : a.basis === 'budget' ? (a.over === true ? '실행예산 초과' : a.usingReserve === true ? '예비비 사용 중' : a.over === false ? '실행예산 안' : '') : a.over === true ? '목표 원가 초과' : a.over === false ? '목표 안' : '');
const basisOf = (a) => (a.basis === 'budget' ? '실행예산 r' + a.budgetRev : '목표 마진율'); // 실행예산 4단계(대기열 1-3-9): 어느 기준의 달성률인지 파일에도 남긴다
const catRate = (a, k) => { const c = Array.isArray(a.byCat) ? a.byCat.find((x) => isO(x) && x.cat === k) : null; return c ? num(c.rate) : null; }; // 비목별 달성률(실행예산 기준 행만, 그 밖은 빈 칸)
const REASON = { nodata: '서버가 아직 월별 값을 주지 않습니다(서버 업데이트 전)', unavailable: '월별 값을 불러오지 못했습니다(원가를 확인할 수 없어 추이를 볼 수 없습니다)', loading: '월별 값을 불러오는 중입니다' };
export function monthlyMgmtCsv(st) {
  const s = isO(st) ? st : {}; const ym = typeof s.ym === 'string' ? s.ym : ''; const srvOk = isO(s.srv) && s.srv.state === 'ok'; const out = [];
  if (!srvOk) out.push(['※ 서버 원가를 확인하지 못해 원가·마진율·노무 수율은 비어 있습니다.']);
  out.push(['[그 달 실적] ' + ym]); out.push(['프로젝트', '청구 발행', '완결(수금)', '지급 발행', '지급 완료', '현장경비', '자체 노무', '원가', '마진율(%)', '누적 마진율(%)', '노무 수율(배)', '비고']);
  /* 누적 마진율(그 달까지 누계) 병기 — 서버 ok · 월 행 ok · 누적 행 ok 일 때만 숫자(화면과 같은 이중 방어: 엑셀은 한 번 나가면 회수되지 않아 원가를 모르는 채 부풀려진 숫자가 나가면 안 된다) */
  const cumBy = new Map((Array.isArray(s.cum) ? s.cum : []).filter((k) => isO(k) && typeof k.id === 'string').map((k) => [k.id, k]));
  (Array.isArray(s.rows) ? s.rows : []).filter(isO).forEach((r) => { const c = srvOk && r.status === 'ok'; const k = cumBy.get(r.id); const kc = c && isO(k) && k.status === 'ok'; const nt = srvOk ? note(r) : (note(r).replace(/PJT 연결 없음|원가 확인 못함/, '') || ''); const kn = kc && !(num(k.collected) > 0) ? '누계 완결 없음' : ''; out.push([lbl(r), num(r.invoiced), num(r.collected), num(r.payIssued), num(r.paid), c ? num(r.direct) : null, c ? num(r.ownLabor) : null, c ? num(r.cost) : null, c ? num(r.margin) : null, kc ? num(k.margin) : null, c ? num(r.laborYield) : null, [nt, kn].filter(Boolean).join('; ')]); });
  { const t = isO(s.totals) ? s.totals : {}; const ct = isO(s.cumTotals) ? s.cumTotals : {}; const u = num(t.unknown) || 0; const c = srvOk && u === 0; const cu = num(ct.unknown) || 0; const kc = c && cu === 0; out.push(['합계', num(t.invoiced), num(t.collected), num(t.payIssued), num(t.paid), srvOk ? num(t.direct) : null, srvOk ? num(t.ownLabor) : null, c ? num(t.cost) : null, c ? num(t.margin) : null, kc ? num(ct.margin) : null, c ? num(t.laborYield) : null, srvOk && u > 0 ? '원가를 모르는 프로젝트 ' + u + '개 — 원가·마진율·노무 수율 합계를 비움' : '']); }
  out.push([]);
  const tr = isO(s.trend) ? s.trend : null; const months = tr && Array.isArray(tr.months) ? tr.months.filter((m) => typeof m === 'string') : [];
  for (const [key, title] of [['margin', '마진율(%)'], ['laborYield', '노무 수율(배)']]) {
    out.push(['[최근 6개월 추이 · ' + title + ']' + (months.length ? ' ' + months[0] + ' ~ ' + months[months.length - 1] : '')]);
    if (s.trendState !== 'ok' || !tr || !months.length) out.push([REASON[s.trendState] || REASON.loading]);
    else { out.push(['프로젝트'].concat(months)); (Array.isArray(tr.rows) ? tr.rows : []).filter((r) => isO(r) && Array.isArray(r.cells)).forEach((r) => out.push([lbl(r)].concat(months.map((m, i) => (isO(r.cells[i]) && srvOk ? num(r.cells[i][key]) : null))))); out.push(['합계'].concat(months.map((m, i) => { const t = Array.isArray(tr.totals) && isO(tr.totals[i]) ? tr.totals[i] : {}; return (num(t.unknown) || 0) > 0 || !srvOk ? null : num(t[key]); }))); }
    out.push([]);
  }
  out.push(['[원가 달성률 · ' + ym + ' 까지 누계]']);
  if (s.achState !== 'ok') out.push([s.achState === 'unavailable' ? '원가를 확인할 수 없어 달성률을 볼 수 없습니다' : '원가를 불러오는 중입니다']);
  else { const rows = (Array.isArray(s.ach) ? s.ach : []).filter(isO); if (!rows.length) out.push(['견적이 있는 프로젝트가 없습니다']); else { out.push(['프로젝트', '견적 공급가액', '목표 마진율(%)', '목표 원가', '실제 원가(누계)', '달성률(%)', '판정', '기준', '외주 달성률(%)', '자체 노무 달성률(%)', '현장경비 달성률(%)']); rows.forEach((a) => out.push([lbl(a), num(a.est), num(a.target), num(a.targetCost), num(a.cost), num(a.rate), ach(a), basisOf(a), catRate(a, 'sub'), catRate(a, 'labor'), catRate(a, 'site')])); } }
  return csvText(out);
}
/** 파일 이름 — 문서 파일 이름 규칙(월 단위 문서: 월간 보고서 - 연월). 월 형식이 이상하면 안전한 기본 이름 */
export function monthlyMgmtCsvName(ym) { const ok = typeof ym === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(ym); const n = ok ? docFileName({ group: 'month', ym, kind: '월간 보고서' }) : ''; return (n || '월간 보고서') + '.csv'; }
