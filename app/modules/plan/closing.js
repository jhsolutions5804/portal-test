/* 영업기획 월말 마감(신규) — 순수 규칙(화면·네트워크 없이 시험 가능). 한 달의 청구·수금·지급 현황을 모으고, 마감 전에 챙길 점검 항목을 찾는다. 저장하는 데이터는 없다(조회·내려받기·인쇄만).
 * 월 기준: 청구서·지급예정서는 "발행일"이 그 달인 것, 수금·지급완료는 "완결 시각(doneAt)"이 그 달인 것(한국 시간). 프로젝트별 금액은 공급가액 기준(공동 발행분은 프로젝트 몫), 잔액은 합계금액(부가세 포함) 기준으로 청구·수금 화면과 같다. */
import { sortProjects, settleAmountForPjt, settleBelongsToPjt, isEstActive, estSupply, getLinkPjt } from './projects.js?v=20261031a';
import { acctMonthOf, SETTLE_LABEL, METHOD_LABEL } from './settlements.js?v=20261031a';
import { csvText } from '../../shared/csv.js?v=20261031a';
const T = (n) => Number(n) || 0; const active = (s) => !!s && s.status !== 'void'; const done = (s) => !!s && s.status === 'done';
const pad = (n) => String(n).padStart(2, '0');
/** Timestamp({seconds}) 또는 ISO 문자열의 한국 시간 월(YYYY-MM), 없으면 '' */
export function monthOfTs(ts) { if (!ts) return ''; const ms = typeof ts === 'object' ? (typeof ts.seconds === 'number' ? ts.seconds * 1000 : NaN) : (typeof ts === 'string' ? Date.parse(ts) : (typeof ts === 'number' ? ts : NaN)); if (!Number.isFinite(ms)) return ''; return new Date(ms + 9 * 3600000).toISOString().slice(0, 7); }
export const lastDayOf = (ym) => { const [y, m] = ym.split('-').map(Number); return ym + '-' + pad(new Date(y, m, 0).getDate()); };
export function shiftYm(ym, dir) { let [y, m] = ym.split('-').map(Number); m += dir; while (m > 12) { m -= 12; y++; } while (m < 1) { m += 12; y--; } return y + '-' + pad(m); }
const dayDiff = (a, b) => Math.round((Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 86400000);
const sum3 = (l) => ({ count: l.length, supply: l.reduce((a, s) => a + T(s.supply), 0), vat: l.reduce((a, s) => a + T(s.vat), 0), total: l.reduce((a, s) => a + (T(s.total) || T(s.amount)), 0) });
/** 한 달 요약: 청구·지급예정서 발행(건수·공급가·부가세·합계), 수금·지급완료(완결 시각이 그 달), 폐기, 잔액(미수금·미지급, 지금 기준), 프로젝트별 */
export function closingSummary(ym, projects, estimates, settlements) {
  const S = settlements || []; const issued = (kind) => S.filter((s) => s.docType === kind && active(s) && String(s.issueDate || '').startsWith(ym)); const doneIn = (kind) => S.filter((s) => s.docType === kind && done(s) && monthOfTs(s.doneAt) === ym);
  const invoiced = issued('invoice'), payIssued = issued('payment'), collected = doneIn('invoice'), paid = doneIn('payment');
  const voided = S.filter((s) => s.status === 'void' && (monthOfTs(s.voidedAt) || String(s.issueDate || '').slice(0, 7)) === ym);
  const byProject = sortProjects(projects || []).map((p) => { const share = (list) => list.filter((s) => settleBelongsToPjt(s, p.id)).reduce((a, s) => a + settleAmountForPjt(s, p.id), 0);
    const r = { id: p.id, code: p.code || '', name: p.name || '', status: p.status === 'done' ? 'done' : 'run', invoiced: share(invoiced), collected: share(collected), payIssued: share(payIssued), paid: share(paid) }; r.profit = r.invoiced - r.payIssued; return r; }).filter((r) => r.invoiced || r.collected || r.payIssued || r.paid);
  const tot = byProject.reduce((a, r) => ({ invoiced: a.invoiced + r.invoiced, collected: a.collected + r.collected, payIssued: a.payIssued + r.payIssued, paid: a.paid + r.paid, profit: a.profit + r.profit }), { invoiced: 0, collected: 0, payIssued: 0, paid: 0, profit: 0 });
  return { ym, invoice: sum3(invoiced), payment: sum3(payIssued), collected: { count: collected.length, total: sum3(collected).total }, paid: { count: paid.length, total: sum3(paid).total }, voided: voided.length,
    receivable: S.filter((s) => s.docType === 'invoice' && s.status === 'active').reduce((a, s) => a + (T(s.total) || T(s.amount)), 0), payable: S.filter((s) => s.docType === 'payment' && s.status === 'active').reduce((a, s) => a + (T(s.total) || T(s.amount)), 0), byProject, totals: tot };
}
const row = (id, title, meta, right, href) => ({ id, title, meta, right, href });
/** 마감 전 점검 항목. tone: warn(처리 필요) · info(참고) · ok(문제 없음). 각 항목은 {key, label, tone, count, hint, items:[{id,title,meta,right,href}]} */
export function closingChecks(ym, today, projects, estimates, settlements, monthly, tags) {
  const S = settlements || [], P = projects || [], E = estimates || []; const end = lastDayOf(ym); const code = (id) => { const p = P.find((x) => x.id === id); return p ? p.code : '-'; }; const out = [];
  const add = (key, label, hint, items, warn) => out.push({ key, label, hint, count: items.length, tone: items.length ? (warn ? 'warn' : 'info') : 'ok', items });
  add('overdueInvoices', '연체 청구서', '지급요청일이 지났는데 완결(수금)되지 않았습니다. 이미 받았다면 완결 처리를, 아니라면 수금을 확인하세요.', S.filter((s) => s.docType === 'invoice' && s.status === 'active' && /^\d{4}-\d{2}-\d{2}$/.test(String(s.payDate || '')) && s.payDate < today).sort((a, b) => a.payDate.localeCompare(b.payDate)).map((s) => row(s.id, s.no + ' · ' + code(s.pjtId), ((s.recipient && s.recipient.company) || '수신자 없음') + ' · 지급요청일 ' + s.payDate + ' (' + dayDiff(today, s.payDate) + '일 지남)', T(s.total) || T(s.amount), '#/plan/billing/' + s.id)), true);
  add('unpaidPayments', '지급완료 전 지급예정서', '이 달 말까지 지급일인데 지급완료 처리가 안 됐습니다. 송금했다면 지급완료를, 아니라면 지급을 확인하세요(지급완료 시 회계 외주비로 반영됩니다).', S.filter((s) => s.docType === 'payment' && s.status === 'active' && /^\d{4}-\d{2}-\d{2}$/.test(String(s.payDate || '')) && s.payDate <= end).sort((a, b) => a.payDate.localeCompare(b.payDate)).map((s) => row(s.id, s.no + ' · ' + code(s.pjtId), ((s.recipient && s.recipient.company) || '수신자 없음') + ' · 지급예정일 ' + s.payDate, T(s.total) || T(s.amount), '#/plan/payout/' + s.id)), true);
  add('noRecipient', '수신자가 비어 있는 정산서', '수신자(거래처)가 선택되지 않은 채 발행된 정산서입니다. 인쇄하면 수신 거래처가 "-"로 나옵니다.', S.filter((s) => active(s) && !(s.recipient && s.recipient.company)).map((s) => row(s.id, (SETTLE_LABEL[s.docType] || '정산서') + ' ' + s.no + ' · ' + code(s.pjtId), '발행 ' + (s.issueDate || '-'), T(s.total) || T(s.amount), '#/plan/' + (s.docType === 'payment' ? 'payout' : 'billing') + '/' + s.id)), true);
  add('noInvoiceThisMonth', '이 달 청구서가 없는 진행 프로젝트', '기준월 또는 발행일이 ' + ym + '인 청구서가 없습니다. 이 달에 청구할 것이 없으면 그대로 두세요.', P.filter((p) => p.status !== 'done' && !S.some((s) => s.docType === 'invoice' && active(s) && settleBelongsToPjt(s, p.id) && (s.baseMonth === ym || String(s.issueDate || '').startsWith(ym)))).map((p) => row(p.id, '[' + (p.code || '-') + '] ' + (p.name || ''), [p.site, p.client].filter(Boolean).join(' · '), 0, '#/plan/projects/' + p.id)), false);
  const billedBy = {}; S.filter((s) => s.docType === 'invoice' && active(s)).forEach((s) => Object.keys(s.perEst || {}).forEach((eid) => { const b = billedBy[eid] || (billedBy[eid] = { sum: 0, all: true }); b.sum += T(s.perEst[eid]); if (!done(s)) b.all = false; }));
  add('estimateReadyToClose', '정산이 끝난 견적 (종결 권장)', '견적 금액만큼 청구되었고 연결된 청구서가 모두 완결되었습니다. 견적을 종결하면 유효 견적 집계에서 빠집니다.', E.filter((e) => isEstActive(e) && billedBy[e.id] && billedBy[e.id].all && billedBy[e.id].sum >= estSupply(e) && estSupply(e) > 0).map((e) => row(e.id, (e.title || '-') + ' · ' + code(e.pjtId), e.no || '', estSupply(e), '#/plan/est/' + e.id)), false);
  add('acctMonthDiffers', '회계 계상월이 지급일 달과 다른 지급예정서', '지급완료된 지급예정서의 회계 계상월이 지급일의 달과 다릅니다. 의도한 것이 아니라면 지급·정산 상세에서 고치세요.', S.filter((s) => s.docType === 'payment' && done(s) && /^\d{4}-\d{2}-\d{2}$/.test(String(s.payDate || '')) && acctMonthOf(s) !== s.payDate.slice(0, 7)).map((s) => row(s.id, s.no + ' · ' + code(s.pjtId), '지급일 ' + s.payDate + ' → 계상월 ' + acctMonthOf(s), T(s.total) || T(s.amount), '#/plan/payout/' + s.id)), false);
  add('manualNoLink', '견적 연결이 없는 직접 입력 청구서', '유효 견적이 있는 프로젝트의 직접 입력 청구서인데 어느 견적에도 연결되지 않았습니다. 연결하면 이후 공정 정산의 기청구로 반영됩니다.', S.filter((s) => s.docType === 'invoice' && active(s) && s.method === 'manual' && !Object.keys(s.perEst || {}).some((k) => T(s.perEst[k]) > 0) && E.some((e) => e.pjtId === s.pjtId && isEstActive(e))).map((s) => row(s.id, s.no + ' · ' + code(s.pjtId), '발행 ' + (s.issueDate || '-') + ' · ' + (METHOD_LABEL[s.method] || ''), T(s.total) || T(s.amount), '#/plan/billing/' + s.id)), false);
  add('voidedThisMonth', '이 달 폐기된 정산서', '참고용입니다. 폐기된 정산서는 집계에서 빠져 있습니다.', S.filter((s) => s.status === 'void' && (monthOfTs(s.voidedAt) || String(s.issueDate || '').slice(0, 7)) === ym).map((s) => row(s.id, (SETTLE_LABEL[s.docType] || '정산서') + ' ' + s.no + ' · ' + code(s.pjtId), '발행 ' + (s.issueDate || '-'), T(s.total) || T(s.amount), '#/plan/' + (s.docType === 'payment' ? 'payout' : 'billing') + '/' + s.id)), false);
  /* 월간 보고서 미생성(설계 결정 10 — 경고 수준, 마감을 막지 않음). monthly = 서버 monthlyReportAct status 응답({ ok, ym, projects:[{ pjtId, exists }] }).
   * 믿을 수 없으면(없음·망가짐·다른 달 응답) "문제 없음"이 아니라 "확인하지 못함"으로 둔다. 이번 달·미래 달은 아직 안 끝났으니 세지 않는다. 연동 없음·자동 생성 예정·종료 프로젝트와 서버가 모르는 PJT 는 만들 곳이 없어 세지 않는다. */
  const mhint = '그 달의 현장 층 월간 보고서가 아직 만들어지지 않은 진행 프로젝트입니다. 눌러서 프로젝트 화면의 월간 보고서 탭에서 만들 수 있습니다(경고일 뿐 마감을 막지 않습니다).';
  const mok = !!monthly && typeof monthly === 'object' && monthly.ok === true && Array.isArray(monthly.projects) && monthly.ym === ym;
  if (monthly === 'loading') out.push({ key: 'monthlyReportMissing', label: '월간 보고서 미생성 프로젝트', hint: '월간 보고서 생성 현황을 확인하는 중입니다. 잠시만 기다려 주세요.', count: 0, tone: 'info', items: [] });
  else if (!mok) out.push({ key: 'monthlyReportMissing', label: '월간 보고서 미생성 프로젝트', hint: '월간 보고서 생성 현황을 확인하지 못했습니다(서버 응답이 없거나 다른 달의 것입니다). 잠시 뒤 다시 열어 보세요. 마감은 그대로 진행할 수 있습니다.', count: 0, tone: 'info', items: [] });
  else {
    const over = String(today || '').slice(0, 7) > ym; const have = new Map(monthly.projects.map((x) => [String(x && x.pjtId), x && x.exists === true]));
    const miss = !over ? [] : P.filter((p) => p.status !== 'done').map((p) => ({ p, k: getLinkPjt(p) })).filter((x) => x.k && x.k !== 'none' && x.k !== 'auto' && have.has(String(x.k)) && have.get(String(x.k)) === false);
    add('monthlyReportMissing', '월간 보고서 미생성 프로젝트', mhint, miss.map((x) => row(x.p.id, (x.p.code || '-') + ' ' + (x.p.name || ''), '월간 보고서 ' + ym, '', '#/pjt/' + x.k + '/monthly')), true);
  }
  /* 프로젝트 표시(전표 분석 태그) 미확정 — 재무회계 전표 중 프로젝트에 붙이는 줄(매출·프로젝트 원가)이 확정되지 않은 채 남았는지. tags = 서버 ledgerAct pjtTagStatus 응답({ ok, since, months:{ 'YYYY-MM': { targets, confirmed, pending } } }, 월별 개수만 — 금액·거래처 없음).
   * 월간 보고서 경고와 같은 규칙: 경고 수준(마감을 막지 않음)·이번 달과 미래 달은 아직 안 끝났으니 세지 않음·믿을 수 없으면(없음·ok 아님·months 가 객체가 아님) "문제 없음"이 아니라 "확인하지 못함". 과거 구간(since 미만)은 서버가 이미 뺀다. */
  const thint = '재무회계 전표 중 프로젝트에 붙이는 줄(매출·프로젝트 원가)이 아직 확정되지 않았습니다. 눌러서 재무회계 "프로젝트 표시" 탭에서 확인·확정하세요(경고일 뿐 마감을 막지 않습니다).';
  const tok = !!tags && typeof tags === 'object' && tags !== 'loading' && tags.ok === true && !!tags.months && typeof tags.months === 'object' && !Array.isArray(tags.months);
  if (tags === 'loading') out.push({ key: 'pjtTagPending', label: '프로젝트 표시가 확정되지 않은 전표', hint: '프로젝트 표시 현황을 확인하는 중입니다. 잠시만 기다려 주세요.', count: 0, tone: 'info', items: [] });
  else if (!tok) out.push({ key: 'pjtTagPending', label: '프로젝트 표시가 확정되지 않은 전표', hint: '프로젝트 표시 현황을 확인하지 못했습니다(서버 응답이 없거나 올바르지 않습니다). 잠시 뒤 다시 열어 보세요. 마감은 그대로 진행할 수 있습니다.', count: 0, tone: 'info', items: [] });
  else {
    const over2 = String(today || '').slice(0, 7) > ym; const mm = tags.months[ym]; const pend = over2 && mm && Number.isFinite(mm.pending) ? mm.pending : 0;
    add('pjtTagPending', '프로젝트 표시가 확정되지 않은 전표', thint, pend > 0 ? [row('pjttag_' + ym, '프로젝트 표시 미확정 ' + pend + '줄', ym + ' · 대상 ' + mm.targets + '줄 중 확정 ' + mm.confirmed + '줄', '', '#/finance/pjt')] : [], true);
  }
  return out;
}
/** 그 달 발행 정산서 목록 CSV(엑셀에서 한글이 깨지지 않게 맨 앞에 BOM): 세무사·회계 전달용 */
export function closingCsv(ym, projects, settlements) {
  const P = projects || []; const label = (s) => ((s.pjtIds && s.pjtIds.length > 1) ? s.pjtIds : [s.pjtId]).map((id) => { const p = P.find((x) => x.id === id); return p ? p.code : (id || '해당 없음'); }).join(' + ');
  const head = ['번호', '구분', '상태', '프로젝트', '거래처', '기준월', '발행일', '지급일', '공급가액', '부가세', '합계', '회계 계상월'];
  const rows = (settlements || []).filter((s) => String(s.issueDate || '').startsWith(ym)).sort((a, b) => String(a.issueDate || '').localeCompare(String(b.issueDate || '')) || String(a.no || '').localeCompare(String(b.no || ''))).map((s) => [s.no, SETTLE_LABEL[s.docType] || s.docType, s.status === 'void' ? '폐기' : s.status === 'done' ? (s.docType === 'invoice' ? '완결' : '지급완료') : '유효', label(s), (s.recipient && s.recipient.company) || '', s.baseMonth || '', s.issueDate || '', s.payDate || '', T(s.supply), T(s.vat), T(s.total), s.docType === 'payment' ? acctMonthOf(s) : '']);
  return csvText([head].concat(rows));
}
