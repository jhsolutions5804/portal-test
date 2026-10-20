/* 재무회계 "프로젝트 표시" 대기 목록 — 순수 계산(Firestore·화면을 모른다). 시험: tests/finance-pjt-tag.test.mjs
 * 하는 일: 전표 줄 중 프로젝트를 붙일 줄(대상)을 가려 → 아직 확정 태그가 없는 줄만 대기 목록으로 만들고 → 서버가 만든 제안을 붙이고 → 달별로 묶어 → 확정하면 프로젝트별 순액이 어떻게 되는지 미리 보여 주고 → 서버에 보낼 확정 요청을 만든다.
 * 대상 판정은 서버(functions/ledger-pjt-tags.js 의 untaggableReason)와 같은 규칙이다: 매출 4xxx 는 대변(+)·차변(−, 마이너스 수정세금계산서) 모두, 직접원가 5010·5210·5320·5340·5370 은 차변만. 공수 배분 5110·5350 과 회사 공통비 5360·5380 은 대상이 아니다.
 * 월 구분은 서버가 만든 제안의 기준월(basisMonth)을 그대로 쓰고, 제안이 없으면 전표 일자의 달로 묶는다 — 메모를 읽는 규칙을 화면에 두 번째로 만들지 않기 위해서다. */
const REVENUE = /^4\d{3}$/;
/* 프로젝트 표시 대상 비용 계정 — 서버 ledger-pjt-tags.js COST_TAGGED 와 같은 목록이어야 한다(시험이 양쪽에서 같은 값을 고정). 대표님 2026-10-21: 인건비를 제외한 특정 프로젝트 지출은 모두 프로젝트 간접비. 5010·5210 은 지급예정서 영역이라 표시는 하되 마진 집계에서만 뺀다. */
const COST_TAGGED = ['5010', '5210', '5310', '5320', '5330', '5340', '5350', '5360', '5370', '5380', '5390', '6020', '6030', '6040', '6050', '6060', '6090', '6100', '6110', '6120', '6130'];

/** 이 줄이 프로젝트 대상이면 null, 아니면 이유 문자열 */
export function taggableReason(line) {
  if (!line || typeof line !== 'object') return '줄이 없습니다.';
  const a = String(line.account || '');
  if (REVENUE.test(a)) return null;
  if (COST_TAGGED.includes(a)) return line.side === 'D' ? null : '비용 계정의 대변 줄은 대상이 아닙니다.';
  if (a === '5110') return '현장 급여(참여 프로젝트 비율로 배분하는 인건비)입니다.';
  if (a === '6010') return '사무 급여(인건비)입니다.';
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
/** 가져오기 직후 자동 제안(결정 2026-10-20) — 새 전표가 저장됐을 때만(posted > 0) 서버 pjtProposeNew 를 한 번 부른다. call = (payload) => Promise<응답>(ledgerAct).
 * 서버 동작이 멱등이라(이미 있는 제안·확정 태그는 덮어쓰지 않음) 반복해도 안전하다. 실패·이상한 응답이어도 던지지 않는다 — 가져오기 결과는 이미 저장됐고 제안은 대기 목록에서 언제든 다시 만들 수 있다.
 * 결과 = { created, note }: note 는 가져오기 안내에 덧붙일 짧은 문구(만든 제안이 없으면 ''). 금액·거래처는 담지 않는다. */
export async function autoProposeAfterImport(call, posted) {
  if (!Number.isFinite(posted) || posted <= 0) return { created: 0, note: '' };
  try {
    const r = await call({ action: 'pjtProposeNew', dryRun: false });
    const n = r && r.ok === true && Number.isFinite(r.created) && r.created > 0 ? Math.floor(r.created) : 0;
    return { created: n, note: n ? '프로젝트 표시 제안 ' + n + '건을 만들었습니다(재무회계 "프로젝트 표시" 탭에서 확정)' : '' };
  } catch (e) { return { created: 0, note: '프로젝트 표시 제안은 만들지 못했습니다(나중에 "프로젝트 표시" 탭에서 다시 만들 수 있습니다)' }; }
}
/** 줄 직접 지정 입력 검사 — 서버 cleanSplits 와 같은 규칙을 앱에서 먼저 알려 준다(최종 판단은 서버). amount = 줄 금액(양의 정수), rows = [{ pjt, amount(입력한 글자) }].
 * 프로젝트·금액이 둘 다 빈 칸은 "칸만 추가한 줄"이라 무시한다. 금액은 공백·쉼표를 지운 뒤 숫자만 인정(소수·음수·글자 거절). 한 줄은 최대 12개 프로젝트, 같은 프로젝트 두 번 금지, 합 = 줄 금액.
 * 결과 = { ok, splits, method, remaining, error }: 칸이 하나면 "직접", 여러 칸이면 "수동". remaining = 줄 금액 − 합(모자라면 양수·넘치면 음수). */
const MAX_SPLIT_ROWS = 12; const fmtWon = (n) => Math.abs(n).toLocaleString('ko-KR') + '원';
export function splitDraft(amount, rows) {
  const bad = (error, extra) => Object.assign({ ok: false, splits: [], method: '', remaining: 0, error }, extra || {});
  if (!Number.isInteger(amount) || amount <= 0) return bad('줄 금액을 확인할 수 없어 지정할 수 없습니다.');
  if (!Array.isArray(rows)) return bad('프로젝트별 금액을 한 개 이상 입력해 주세요.');
  const used = rows.map((r) => ({ pjt: String((r && r.pjt) == null ? '' : r.pjt).trim(), raw: String((r && r.amount) == null ? '' : r.amount).replace(/[,\s]/g, '') })).filter((r) => r.pjt || r.raw);
  if (!used.length) return bad('프로젝트별 금액을 한 개 이상 입력해 주세요.');
  if (used.length > MAX_SPLIT_ROWS) return bad('한 줄은 최대 ' + MAX_SPLIT_ROWS + '개 프로젝트까지 나눌 수 있습니다.');
  const seen = new Set(); const splits = []; let sum = 0;
  for (const r of used) {
    if (!r.pjt) return bad('프로젝트를 골라 주세요.'); if (!/^\d+$/.test(r.raw)) return bad('금액은 1원 이상의 정수로 입력해 주세요.');
    const n = Number(r.raw); if (!Number.isSafeInteger(n) || n <= 0) return bad('금액은 1원 이상의 정수로 입력해 주세요.');
    if (seen.has(r.pjt)) return bad('같은 프로젝트를 두 번 고를 수 없습니다.'); seen.add(r.pjt); sum += n; splits.push({ pjt: r.pjt, amount: n });
  }
  const remaining = amount - sum;
  if (remaining !== 0) return bad(remaining > 0 ? '합이 ' + fmtWon(remaining) + ' 모자랍니다. 합이 줄 금액과 같아야 저장됩니다.' : '합이 ' + fmtWon(remaining) + ' 넘칩니다. 합이 줄 금액과 같아야 저장됩니다.', { remaining });
  return { ok: true, splits, method: splits.length === 1 ? '직접' : '수동', remaining: 0, error: '' };
}
/** 줄 직접 지정 패널의 "남은 금액" 문구 — 패널을 처음 그릴 때(view.js)와 입력할 때마다 갱신(index.js)이 같은 함수를 쓴다. 칸의 금액은 공백·쉼표를 지운 뒤 숫자만 인정하고, 숫자가 아니면(글자·음수·소수) 0 으로 센다.
 * 합이 모자라면 "남은 금액 N원"(합이 맞으면 0원), 넘치면 "N원 넘침"(음수로 쓰지 않는다). 줄 금액은 절댓값 기준. */
export function splitLeftText(amount, rows) {
  const total = Math.abs(Number(amount) || 0); const sum = (Array.isArray(rows) ? rows : []).reduce((a, r) => { const raw = String((r && r.amount) == null ? '' : r.amount).replace(/[,\s]/g, ''); return a + (/^\d+$/.test(raw) ? Number(raw) : 0); }, 0);
  const rest = total - sum; return rest >= 0 ? '남은 금액 ' + rest.toLocaleString('ko-KR') + '원' : Math.abs(rest).toLocaleString('ko-KR') + '원 넘침';
}
/** 확정된 줄 — 대기 줄(buildPendingRows)과 반대 방향: 확정 태그(status 'confirmed')가 있는 줄만, 수정·해제할 수 있게 전표 정보와 합친다. 대기 줄과 같은 규칙으로 취소 전표(reverses)·프로젝트에 붙이지 않는 계정(taggableReason)은 뺀다.
 * 전표가 없거나 줄 번호가 범위 밖인 태그(지워진 전표 등)는 건너뛴다. 월 = 태그의 기준월(basis.month, YYYY-MM 형식일 때), 없으면 전표 일자의 달. opts.grouped 면 [{ month, rows, count }] 를 최신 달부터, 아니면 행 배열(일자·전표번호 오름차순).
 * 입력이 이상해도 던지지 않는다. */
export function buildConfirmedRows(entries, tags, opts) {
  const T = tags && typeof tags === 'object' ? tags : {}; const rows = [];
  (Array.isArray(entries) ? entries : []).forEach((e) => {
    if (!e || e.reverses || !Array.isArray(e.lines)) return;
    e.lines.forEach((l, i) => {
      if (!l || taggableReason(l)) return; const id = e.id + '_' + i; const t = T[id]; if (!t || t.status !== 'confirmed') return;
      const bm = t.basis && typeof t.basis.month === 'string' && /^\d{4}-\d{2}$/.test(t.basis.month) ? t.basis.month : '';
      rows.push({ id, entryId: e.id, lineIdx: i, no: e.no || '', date: e.date || '', memo: String(e.memo || ''), account: String(l.account), side: l.side, amount: l.amount, partner: String(l.partner || ''),
        splits: Array.isArray(t.splits) ? t.splits.map((x) => ({ pjt: x.pjt, amount: x.amount })) : [], method: String(t.method || ''), note: String(t.note || ''), setByName: String(t.setByName || ''), month: bm || ym(e.date) });
    });
  });
  rows.sort((a, b) => (a.date + a.no).localeCompare(b.date + b.no));
  if (!(opts && opts.grouped)) return rows;
  const m = {}; rows.forEach((r) => { (m[r.month] = m[r.month] || []).push(r); });
  return Object.keys(m).sort().reverse().map((k) => ({ month: k, rows: m[k], count: m[k].length }));
}
/** 거래처 규칙 입력 검사 — 서버 pjtRuleSave 와 같은 규칙을 앱에서 먼저 알려 준다(최종 판단은 서버). 규칙 = 거래처 이름에 걸리는 제안 방식(프로젝트 하나 single / 그 달 공수 비율 manday). 규칙은 제안의 입력일 뿐 확정이 아니다.
 * 거래처는 안의 공백까지 지운 2~40자(한 글자는 거의 모든 거래처에 걸려 받지 않음), 계정은 프로젝트에 붙이는 계정만(공수 배분 5110·5350, 회사 공통비 5360·5380 은 대상이 아님), 방식이 manday 면 프로젝트를 비운다.
 * 결과 = { ok, rule, error }(거절이면 rule null). 입력이 이상해도 던지지 않는다. */
export const RULE_ACCOUNTS = ['4010'].concat(COST_TAGGED);
export function ruleDraft(input) {
  const bad = (error) => ({ ok: false, rule: null, error });
  if (!input || typeof input !== 'object' || Array.isArray(input)) return bad('규칙 내용을 확인할 수 없습니다.');
  const partner = typeof input.partner === 'string' ? input.partner.replace(/\s+/g, '') : '';
  if (partner.length < 2 || partner.length > 40) return bad('거래처 이름은 공백 없이 2~40자로 입력해 주세요(한 글자는 거의 모든 거래처에 걸려 받지 않습니다).');
  if (!Array.isArray(input.accounts) || !input.accounts.length) return bad('규칙이 적용될 계정을 한 개 이상 골라 주세요.');
  const wrong = input.accounts.map(String).find((a) => RULE_ACCOUNTS.indexOf(a) === -1);
  if (wrong !== undefined) return bad('프로젝트에 붙이는 계정(' + RULE_ACCOUNTS.join('·') + ')만 고를 수 있습니다' + (wrong ? ': ' + wrong : '') + ' (인건비 계정은 대상이 아닙니다).');
  const accounts = Array.from(new Set(input.accounts.map(String))).sort();
  if (input.mode !== 'single' && input.mode !== 'manday') return bad('방식은 "프로젝트 하나" 또는 "공수 비율" 중에서 골라 주세요.');
  let pjt = ''; if (input.mode === 'single') { pjt = typeof input.pjt === 'string' ? input.pjt.trim() : ''; if (!pjt) return bad('"프로젝트 하나" 방식은 프로젝트를 지정해야 합니다.'); }
  const note = typeof input.note === 'string' ? input.note.trim().slice(0, 200) : '';
  return { ok: true, rule: { partner, accounts, mode: input.mode, pjt, note, active: input.active === false ? false : true }, error: '' };
}

