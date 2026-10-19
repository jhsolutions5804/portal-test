/* 재무회계 "프로젝트 표시" 대기 목록 — 순수 계산(Firestore·화면을 모른다). 시험: tests/finance-pjt-tag.test.mjs
 * 하는 일: 전표 줄 중 프로젝트를 붙일 줄(대상)을 가려 → 아직 확정 태그가 없는 줄만 대기 목록으로 만들고 → 서버가 만든 제안을 붙이고 → 달별로 묶어 → 확정하면 프로젝트별 순액이 어떻게 되는지 미리 보여 주고 → 서버에 보낼 확정 요청을 만든다.
 * 대상 판정은 서버(functions/ledger-pjt-tags.js 의 untaggableReason)와 같은 규칙이다: 매출 4xxx 는 대변(+)·차변(−, 마이너스 수정세금계산서) 모두, 직접원가 5010·5210·5320·5340·5370 은 차변만. 공수 배분 5110·5350 과 회사 공통비 5360·5380 은 대상이 아니다.
 * 월 구분은 서버가 만든 제안의 기준월(basisMonth)을 그대로 쓰고, 제안이 없으면 전표 일자의 달로 묶는다 — 메모를 읽는 규칙을 화면에 두 번째로 만들지 않기 위해서다. */
const REVENUE = /^4\d{3}$/; const COST_TAGGED = ['5010', '5210', '5320', '5340', '5370'];

/** 이 줄이 프로젝트 대상이면 null, 아니면 이유 문자열 */
export function taggableReason(line) {
  if (!line || typeof line !== 'object') return '줄이 없습니다.';
  const a = String(line.account || '');
  if (REVENUE.test(a)) return null;
  if (COST_TAGGED.includes(a)) return line.side === 'D' ? null : '비용 계정의 대변 줄은 대상이 아닙니다.';
  if (['5110', '5350'].includes(a)) return '공수 배분 계정입니다.';
  if (['5360', '5380'].includes(a)) return '회사 공통비입니다.';
  return '프로젝트에 붙이는 계정이 아닙니다.';
}
/** 같은 묶음 키 — "(수정)" 표시를 뺀 메모와 계정이 같으면 같은 묶음(수정세금계산서의 원본·마이너스·재발행) */
export const pairKey = (r) => String(r.memo || '').replace(/\s+/g, ' ').replace(/\s*\(수정\)\s*/g, '').trim() + '|' + String(r.account || '');
const ym = (date) => String(date || '').slice(0, 7);

/** 대기 줄 — 대상 줄 중 확정 태그가 없는 줄. proposals·tags 는 { '<전표id>_<줄번호>': 문서 } 형태 */
export function buildPendingRows(entries, proposals, tags) {
  const out = []; const P = proposals || {}, T = tags || {};
  (entries || []).forEach((e) => {
    if (!e || e.reverses) return;
    (e.lines || []).forEach((l, i) => {
      if (taggableReason(l)) return; const id = e.id + '_' + i; const t = T[id]; if (t && t.status === 'confirmed') return;
      const p = P[id]; const method = p ? String(p.method || '') : ''; const splits = p && Array.isArray(p.splits) ? p.splits.map((s) => ({ pjt: s.pjt, amount: s.amount })) : [];
      const confirmable = !!p && (method === '제외' || method === '공통' || (method !== '수동' && method !== '' && splits.length > 0));
      out.push({ id, entryId: e.id, lineIdx: i, no: e.no || '', date: e.date || '', memo: String(e.memo || ''), account: String(l.account), side: l.side, amount: l.amount, partner: String(l.partner || ''),
        hasProposal: !!p, method, splits, note: p ? String(p.note || '') : '', warn: p ? String(p.warn || '') : '', basisMonth: p && p.basisMonth ? p.basisMonth : '', confirmable, pair: pairKey({ memo: e.memo, account: l.account }) });
    });
  });
  return out;
}
/** 달별 묶음(오름차순) — 제안의 기준월, 없으면 전표 일자의 달 */
export function groupByMonth(rows) {
  const m = {}; (rows || []).forEach((r) => { const k = r.basisMonth || ym(r.date); (m[k] = m[k] || []).push(r); });
  return Object.keys(m).sort().map((k) => ({ month: k, rows: m[k], count: m[k].length, confirmableCount: m[k].filter((r) => r.confirmable).length }));
}
/** 확정하면 프로젝트별로 어떻게 되는지 — 매출은 대변(+)에서 차변(−)을 뺀 순액, 직접원가는 합. 분할이 없는 줄(제외·수동)은 넣지 않는다 */
export function monthPreview(rows) {
  const revenue = {}, cost = {}; let revenueTotal = 0, costTotal = 0;
  (rows || []).forEach((r) => (r.splits || []).forEach((s) => {
    if (REVENUE.test(String(r.account))) { const v = s.amount * (r.side === 'C' ? 1 : -1); revenue[s.pjt] = (revenue[s.pjt] || 0) + v; revenueTotal += v; } else { cost[s.pjt] = (cost[s.pjt] || 0) + s.amount; costTotal += s.amount; }
  }));
  return { revenue, cost, revenueTotal, costTotal };
}
/** 서버 pjtTagBatch 에 보낼 확정 요청 — 확정할 수 있는 줄만, 필요한 필드만. 100건씩 나누는 일은 data.js 가 한다 */
export function confirmItems(rows) {
  return (rows || []).filter((r) => r && r.confirmable).map((r) => ({ entryId: r.entryId, lineIdx: r.lineIdx, method: r.method, splits: (r.splits || []).map((s) => ({ pjt: s.pjt, amount: s.amount })), note: r.note || '', basis: { month: r.basisMonth || '', note: '대기 목록에서 확정' } }));
}
