// 규칙으로 기존 카드 전표 다시 분류(대표님 2026-10-26) — 카드사 검사·계획·장부 점검·화면·실행 연결. 가짜 가맹점·금액만 쓴다.
import fs from 'node:fs';
import { parseMerchantTable, ISSUERS, merchantKey } from '../app/shared/merchant-table.js';
import { applyMerchantTable, ruleReclassPlan, netByAccount, verifyReclass, cardIssuerOf, cardMerchantOf, accountName } from '../app/modules/finance/logic.js';
import { ruleReclassHtml, rulesHtml } from '../app/modules/finance/view.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const J = JSON.stringify;
// ── 카드사 검사(서버 ISSUERS 와 같은 목록)
ok(J(ISSUERS) === J(['nonghyup', 'samsung', 'hyundai', 'ibk_sales', 'ibk_approval']), '★ 규칙을 저장할 수 있는 카드사는 서버(functions/ledger-act.js)와 같은 5개');
const H = ['번호', '가맹점', '대표님 분류', '메모', '카드사 코드', '가맹점 키'];
const T = (rows) => parseMerchantTable([H].concat(rows));
const t1 = T([[1, '가', '개인 지출(인출금)', '', 'hyundai', '가'], [2, '나', '업무용 구매·소모품', '', 'unknown', '나'], [3, '다', '모름', '', 'unknown', '다'], [4, '라', '업무 식대(복리후생·현장식대)', '', '', '라'], [5, '마', '보험료(업무·차량)', '', 'ibk_approval', '마']]);
ok(t1.rules.map((r) => r.key).join() === '가,마' && t1.badIssuer.length === 1 && t1.badIssuer[0].key === '나' && t1.badIssuer[0].issuer === 'unknown' && t1.filled === 4, '★ 카드사를 알 수 없는 곳(unknown)은 규칙에서 빼고 이름을 알려 준다(모름·카드사 비어 있는 줄은 건너뜀)');
const t2 = T([[1, '가', '존재하지않는분류', '', 'unknown', '가']]); ok(t2.rules.length === 0 && t2.unknown.length === 1 && t2.badIssuer.length === 0, '알 수 없는 분류가 먼저 걸리면 카드사 제외로 세지 않는다');
const ap = applyMerchantTable([[H, [1, '가', '개인 지출(인출금)', '', 'hyundai', '가'], [2, '나', '업무용 구매·소모품', '', 'unknown', '나']].flat ? [H, [1, '가', '개인 지출(인출금)', '', 'hyundai', '가'], [2, '나', '업무용 구매·소모품', '', 'unknown', '나']] : []], []);
ok(ap.incoming === 1 && ap.added === 1 && ap.badIssuer.length === 1 && ap.rules.length === 1 && !ap.rules.some((r) => r.issuer === 'unknown'), '업로드 요약: 저장할 규칙에서 unknown 이 빠지고 제외 목록이 따라온다(서버 "N번째 규칙이 올바르지 않습니다" 방지)');
// ── 전표에서 카드사·가맹점 읽기
const E = (id, memo, acc, o) => Object.assign({ id, no: id, date: '2026-09-01', memo, source: { kind: 'card', id: 'card_hyundai_2026-09-01_x' }, needsReview: true, lines: [{ account: acc, side: 'D', amount: 1000, partner: '분류 대기: 가' }, { account: '2020', side: 'C', amount: 1000, partner: '' }] }, o || {});
ok(cardIssuerOf(E('a', 'x', '6190')) === 'hyundai' && cardIssuerOf({ source: { id: 'card_ibk_sales_2026-01-02_Z' } }) === 'ibk_sales' && cardIssuerOf({ source: { id: 'card_unknown_2025-11-01_NPAY_1' } }) === 'unknown' && cardIssuerOf({ source: { id: 'bank_x' } }) === '' && cardIssuerOf(null) === '', '카드사 읽기: hyundai·ibk_sales(밑줄 포함)·unknown, 카드가 아니면 빈 값');
ok(cardMerchantOf({ memo: '(주)가나 · 소모품' }) === '(주)가나' && cardMerchantOf({ memo: '[재분류] 가나 · 소모품' }) === '가나' && cardMerchantOf({ memo: '' }) === '' && cardMerchantOf(null) === '', '가맹점 읽기: 메모 앞부분, [재분류] 머리글 제거, 빈 값');
// ── 계획
const RULES = [{ issuer: 'hyundai', key: '가', account: '3020', label: '개인 지출(인출금)' }, { issuer: 'hyundai', key: '나', account: '6020', label: '업무 식대' }, { issuer: 'hyundai', key: '케이비손해보험', account: '6110', label: '보험료' }];
const ENT = [E('e1', '가 · 기타', '6190'), E('e2', '가 · 기타', '3020'), E('e3', '없는곳 · x', '6190'), E('e4', '나 · 식당', '6190', { date: '2026-02-01' }), E('e5', '(주)케이비손해보험 · 보험', '6090'),
  E('x1', '가 · 기타', '6190', { reversedBy: 'r1' }), E('x2', '가 · 기타', '6190', { reverses: 'q' }), E('x3', '가 · 기타', '6190', { invalid: true }), E('x4', '가 · 기타', '6190', { needsReview: false }), E('x5', '가 · 기타', '6190', { source: { kind: 'bank', id: 'bank_h_1' } }),
  E('m1', '가 · 기타', '6190', { lines: [{ account: '6190', side: 'D', amount: 500 }, { account: '6020', side: 'D', amount: 500 }, { account: '2020', side: 'C', amount: 1000 }] }), E('u1', '가 · 기타', '6190', { source: { kind: 'card', id: 'card_unknown_2025-11-01_NPAY_1' } })];
const P = ruleReclassPlan(ENT, RULES, { today: '2026-10-26' });
ok(P.targets === 7 && P.items.length === 3 && P.same.length === 1 && P.noRule.length === 2 && P.skipped.length === 1, '★ 계획 건수: 대상 7(역분개됨·역분개 전표·무효·검토 아님·카드 아님 제외) → 바뀜 3·이미 같음 1·규칙 없음 2(없는곳·카드사 unknown)·건너뜀 1(차변 줄 둘)');
ok(P.items.map((i) => i.entry.id).join() === 'e1,e4,e5' && P.same[0].entry.id === 'e2' && P.noRule.map((x) => x.id).join() === 'e3,u1' && P.skipped[0].id === 'm1' && /차변 줄이 하나가 아닙니다/.test(P.skipped[0].reason), '계획 내용: 바뀜 e1·e4·e5, 같음 e2, 규칙 없음 e3·u1, 건너뜀 m1(이유 표시)');
const i1 = P.items[0]; ok(i1.from === '6190' && i1.to === '3020' && i1.amount === 1000 && i1.lines[0].account === '3020' && i1.lines[0].side === 'D' && i1.lines[1].account === '2020' && i1.lines[1].side === 'C' && i1.lines[0].amount === 1000 && i1.lines[1].amount === 1000, '★ 새 줄: 차변 계정만 바뀌고 대변(2020)·금액은 그대로');
ok(i1.lines[0].partner === '' && i1.date === '2026-09-01' && !i1.shifted, '새 줄: "분류 대기" 거래처 표시는 지워지고 일자는 원래 일자');
ok(P.items[2].to === '6110' && P.items[2].from === '6090', '가맹점 키 정규화: "(주)케이비손해보험" 전표가 키 "케이비손해보험" 규칙에 걸린다');
ok(P.amount === 3000 && P.personal.count === 1 && P.personal.amount === 1000 && P.moves.length === 3 && P.moves.every((m) => m.count === 1), '요약: 바뀌는 금액 합계, 개인 지출(3020)로 가는 건수·금액, 이동 3종');
const PL = ruleReclassPlan(ENT, RULES, { lockedThrough: '2026-03-31', today: '2026-10-26' }); ok(PL.shifted === 1 && PL.items.find((i) => i.entry.id === 'e4').date === '2026-04-01' && PL.items.find((i) => i.entry.id === 'e4').shifted === true && PL.items.find((i) => i.entry.id === 'e1').shifted === false, '마감일 이전 전표는 마감 다음 날(4/1)로 일자가 조정되고 건수를 센다');
ok(ruleReclassPlan(null, null).items.length === 0 && ruleReclassPlan([], RULES).targets === 0 && ruleReclassPlan(ENT, []).noRule.length === 7 && ruleReclassPlan(ENT, null).items.length === 0, '입력이 비어 있거나 규칙이 없으면 아무것도 바꾸지 않는다(예외 없음)');
const P2 = ruleReclassPlan(ENT, RULES, { today: '2026-10-26' }); ok(J(P2.items.map((i) => i.entry.id)) === J(P.items.map((i) => i.entry.id)) && ENT[0].lines[0].account === '6190', '계획은 입력 전표를 바꾸지 않는다(같은 입력은 같은 결과)');
// ── 장부 점검
const apply = (entries, items) => { const out = entries.slice(); items.forEach((i) => { const e = i.entry; out.push({ id: 'rv' + e.id, lines: e.lines.map((l) => Object.assign({}, l, { side: l.side === 'D' ? 'C' : 'D' })) }); out.push({ id: 'nw' + e.id, lines: i.lines }); }); return out; };
const before = netByAccount(ENT); const afterOk = netByAccount(apply(ENT, P.items));
ok(before.get('6190') > 0 && Math.round([...before.values()].reduce((a, b) => a + b, 0)) !== undefined && netByAccount(null).size === 0, '계정별 순합계: 차변 − 대변을 모은다(비어 있어도 예외 없음)');
const bal = (entries) => entries.filter((e) => !e.invalid); const okEntries = bal(ENT).filter((e) => e.id !== 'm1'); // 균형 잡힌 장부로 점검
const b2 = netByAccount(okEntries); const a2 = netByAccount(apply(okEntries, P.items)); const v2 = verifyReclass(b2, a2, P.items); ok(v2.ok && v2.balanced && v2.diffs.length === 0, '★ 장부 점검: 계획대로 처리하면 계정별 변화가 "from −금액·to +금액"과 같고 장부가 균형이면 통과');
const a3 = netByAccount(apply(okEntries, P.items.slice(0, 2))); const v3 = verifyReclass(b2, a3, P.items); ok(!v3.ok && v3.diffs.length > 0 && v3.balanced, '장부 점검: 계획 3건 중 2건만 반영됐는데 3건으로 점검하면 어긋남을 찾는다(균형은 유지)');
const v3b = verifyReclass(b2, a3, P.items.slice(0, 2)); ok(v3b.ok, '장부 점검: 실제로 처리한 건(2건)만 넘기면 통과(중간에 멈춘 경우)');
const a4 = netByAccount(apply(okEntries, P.items).concat([{ id: 'zz', lines: [{ account: '6190', side: 'D', amount: 7 }] }])); const v4 = verifyReclass(b2, a4, P.items); ok(!v4.ok && !v4.balanced && v4.diffs.some((d) => d.account === '6190'), '★ 장부 점검: 계획에 없는 변화(한쪽만 7원)가 생기면 대차 불균형과 계정 차이를 모두 찾는다');
ok(verifyReclass(null, null, []).ok && verifyReclass(new Map(), new Map(), null).ok, '장부 점검: 아무것도 없으면 통과(예외 없음)');
// ── 화면
const ST = (o) => ({ rl: Object.assign({ merchant: RULES, purchase: [], bank: [], q: '', upload: null, error: '', rr: {} }, o && o.rl), data: Object.assign({ entries: ENT, rules: RULES, settings: {} }, o && o.data) });
const h = ruleReclassHtml(ST()); ok(h.includes('📚 규칙으로 기존 카드 전표 다시 분류') && h.includes('data-act="rr-run"') && h.includes('3건 재분류 + 1건 확인 완료 표시 실행') && !/data-act="rr-run"[^>]*disabled/.test(h), '★ 화면: 카드 제목·실행 단추("3건 재분류 + 1건 확인 완료 표시 실행")');
ok(h.includes('개인 지출(인출금)으로 넘어가는 전표 1건') && h.includes('data-tone="warn"') && h.includes('회사 비용에서 빠지고'), '화면: 개인 지출(인출금)으로 가는 건과 합계를 경고로 따로 보여 준다');
ok(h.includes('검토 필요 카드 전표') && h.includes('규칙 없음(그대로)') && h.includes('이미 같음 → 확인 완료 표시') && h.includes(accountName('6190')) && h.includes(accountName('3020')) && h.includes('3건') && h.includes('1,000'), '화면: 숫자 네 칸과 계정 이동 표');
ok(ruleReclassHtml(ST({ data: { rules: [] } })) === '' && ruleReclassHtml({ rl: { rr: {} }, data: { entries: [], rules: [], settings: {} } }) === '', '화면: 저장된 규칙이 없으면 카드를 그리지 않는다');
ok(/data-act="rr-run"[^>]*disabled/.test(ruleReclassHtml(ST({ data: { entries: [] } }))) && ruleReclassHtml(ST({ data: { entries: [] } })).includes('계정이 바뀌는 전표가 없습니다') && /data-act="rr-run"[^>]*disabled/.test(ruleReclassHtml(ST({ rl: { rr: { running: true, progress: '2/3 재분류 중… e2' } } }))) && ruleReclassHtml(ST({ rl: { rr: { running: true, progress: '2/3 재분류 중… e2' } } })).includes('2/3 재분류 중… e2'), '화면: 처리할 전표가 없거나 실행 중이면 단추가 꺼지고, 실행 중에는 진행(2/3)이 보인다');
const hr = ruleReclassHtml(ST({ rl: { rr: { result: { done: 3, marked: 1, failed: [], markErr: '', verify: { ok: true, diffs: [], balanced: true } } } } })); ok(hr.includes('3건 재분류 · 1건 확인 완료 표시') && hr.includes('✅ 계정별 변화가 계획과 같고 차변·대변이 맞습니다'), '화면: 실행 결과 — 건수와 장부 점검 통과 문구');
const hf = ruleReclassHtml(ST({ rl: { rr: { result: { done: 2, marked: 0, failed: ['e9: 마감됨'], markErr: '권한', verify: { ok: false, diffs: [{ account: '6190', expected: -1000, actual: 0 }], balanced: false } } } } })); ok(hf.includes('data-tone="danger"') && hf.includes('실패 1건') && hf.includes('e9: 마감됨') && hf.includes('다시 누르면 남은 전표만 처리') && hf.includes('차변·대변이 맞지 않습니다') && hf.includes('기대') && hf.includes('확인 완료 표시 실패: 권한'), '화면: 실패·점검 불일치는 danger 로, 실패 전표·다시 누르라는 안내·계정 차이·표시 실패를 보여 준다');
const XS = ST({ data: { entries: [E('z1', '<img src=x onerror=1> · y', '6190', { source: { kind: 'card', id: 'card_hyundai_2026-09-01_x' } })], rules: [{ issuer: 'hyundai', key: merchantKey('<img src=x onerror=1>'), account: '3020' }] }, rl: { rr: { result: { done: 1, marked: 0, failed: ['<script>1</script>: 오류'], markErr: '<b>x</b>', verify: { ok: false, diffs: [{ account: '<i>', expected: 1, actual: 2 }], balanced: true } } } } }); const hx = ruleReclassHtml(XS);
ok(!hx.includes('<script>1') && !hx.includes('<img src=x') && !hx.includes('<b>x</b>') && hx.includes('&lt;script&gt;'), '★ 화면: 실패 문구·오류 문구에 들어온 HTML 은 글자로만 보인다');
ok(rulesHtml(ST({ data: { entries: ENT, rules: RULES } })).includes('data-act="rr-run"') && rulesHtml(ST({ data: { entries: ENT, rules: [] } })).includes('data-act="rr-run"') === false, '화면: 규칙 탭 왼쪽(분류표 올리기 아래)에 카드가 붙고, 규칙이 없으면 없다');
const hu = rulesHtml(ST({ rl: { upload: { incoming: 5, added: 5, changed: 0, same: 0, unknown: [], badIssuer: [{ key: '금강' }, { key: 'b' }, { key: 'c' }, { key: 'd' }], rules: [] } } })); ok(hu.includes('카드사를 알 수 없어 제외 4곳') && hu.includes('금강') && hu.includes(' 외)'), '★ 화면: 업로드 안내에 "카드사를 알 수 없어 제외 4곳(이름…)" 이 보인다');
// ── 화면 연결(소스 글자)
const idx = fs.readFileSync(new URL('../app/modules/finance/index.js', import.meta.url), 'utf8');
ok(/ruleReclassPlan, netByAccount, verifyReclass, reclassDefaultDate/.test(idx) && idx.includes("act === 'rr-run'") && idx.includes('async function rrRun()') && /rr: \(S\.rl && S\.rl\.rr\) \|\| \{\}/.test(idx), '연결: 계산 함수 가져오기·실행 처리기·실행 함수·규칙 탭을 다시 만들어도 결과가 사라지지 않는 상태');
const rr = idx.slice(idx.indexOf('async function rrRun()'), idx.indexOf('async function onRulesFile'));
ok(rr.includes('reclassifyEntry(it.entry.id, it.date,') && rr.includes('markReviewed(plan.same.map') && rr.includes('verifyReclass(before, netByAccount(S.data.entries), done)') && rr.indexOf('confirmDialog') < rr.indexOf('reclassifyEntry') && rr.indexOf('const before = netByAccount') < rr.indexOf('reclassifyEntry') && rr.indexOf('await reload()') < rr.indexOf('verifyReclass(') && rr.indexOf('S.rl.rr = { running: false') > rr.indexOf('await reload()'), '★ 연결 순서: 확인 창 → 실행 전 장부 합계 → 한 건씩 서버 재분류 → 확인 완료 표시 → 다시 불러온 뒤 점검 → 결과 보관');
ok(/failed\.length >= 5 && !done\.length\) break/.test(rr) && /if \(R\.rr && R\.rr\.running\) return/.test(rr), '연결: 처음부터 5건 연속 실패하면 멈추고(권한 문제 등), 실행 중에는 다시 시작하지 않는다');
console.log('\n' + (fail ? 'FAILED ' : 'ALL OK ') + pass + ' pass / ' + fail + ' fail'); process.exit(fail ? 1 : 0);
