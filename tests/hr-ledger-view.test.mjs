import { ledgerPageHtml, ledgerStatusHtml, ledgerTableHtml, ledgerWhen } from '../app/modules/hr/ledger-view.js';
import { ledgerRow, closeChecks, LEDGER_HEAD } from '../app/modules/hr/ledger.js';
import { payslipCalc, payslipRecord } from '../app/modules/hr/payslip.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const calc = (n) => payslipCalc({ hourly: 11000, month: '2026-08', attHours: 176, leaveHours: 8, nightHours: 4, attDates: new Set(), leaveDocs: [], workerName: n, holidayRecords: [{ date: '2026-08-15', workHours: 6 }], holidaySet: new Set(), bonus: 100000, specialBonus: 0, extraPay: 0, techAllowance: 0, travelAllowance: 0, dormitory: 0 });
const mk = (name, id, days) => { const W = { id, name, empNo: 'E' + id, dept: '사업본부', rank: '대리', hireDate: '2024-03-01', job: 'FCU 설치' }; const s = Object.assign({ workerId: id }, payslipRecord(W, { hourly: 11000 }, '2026-08', '2026-09-30', '', calc(name), [], '2026-09-30T00:00:00Z')); return { W, s, row: ledgerRow(s, W, days) }; };
const a = mk('김가나', 'w1', 20), b = mk('이다라', 'w2', null);
const rows = [a.row, b.row]; const okChecks = closeChecks('2026-08', [a.W], { w1: a.s }, [a.row]); const badChecks = closeChecks('2026-08', [a.W], { w1: Object.assign({}, a.s, { netPay: 1 }) }, [a.row]);
const CLOSED = { status: 'closed', version: 2, closedAt: '2026-09-05T03:04:00Z', closedBy: 'adm@jhsol.kr', rowCount: 2, unlockLog: [{ at: '2026-09-01T00:00:00Z', by: 'hr@jhsol.kr', reason: '식대 정정' }] }, OPEN = { status: 'open', version: 1, unlockLog: [] };
const page = (o) => ledgerPageHtml(Object.assign({ ym: '2026-08', loading: false, error: '', busy: false, data: { rows, checks: okChecks, close: null }, unlockOpen: false, reason: '' }, o || {}));
const btn = (h, act) => { const m = h.match(new RegExp('<button[^>]*data-l-act="' + act + '"[^>]*>')); return m ? m[0] : null; };
const dis = (h, act) => { const x = btn(h, act); return x === null ? null : / disabled/.test(x); };
// ── 시각
ok(ledgerWhen('2026-09-05T03:04:00Z').match(/^2026-09-0[45] \d\d:\d\d$/) && ledgerWhen({ toDate: () => new Date(2026, 8, 5, 3, 4) }) === '2026-09-05 03:04' && ledgerWhen(new Date(2026, 0, 2, 3, 4)) === '2026-01-02 03:04' && ledgerWhen('') === '' && ledgerWhen(null) === '' && ledgerWhen('엉터리') === '' && ledgerWhen(12) === '', '시각 표시: 서버 시각·글자·날짜 모두 YYYY-MM-DD HH:MM, 이상한 값은 빈 글자');
// ── 상태
const sc = ledgerStatusHtml(CLOSED), so = ledgerStatusHtml(OPEN), sn = ledgerStatusHtml(null);
ok(sc.includes('마감됨 v2') && sc.includes('adm@jhsol.kr') && sc.includes('2명') && sc.includes('수정 잠금') && so.includes('해제됨') && so.includes('v1') && sn.includes('미마감') && ledgerStatusHtml(undefined).includes('미마감'), '상태 줄: 마감됨(버전·마감자·인원)/해제됨(다시 마감 필요)/미마감');
ok(!ledgerStatusHtml({ status: 'closed', version: 1, closedBy: '<script>x</script>' }).includes('<script>'), '상태 줄: 마감자 이름의 HTML 을 막는다');
// ── 표
const t = ledgerTableHtml(rows); const nth = (t.match(/<th[ >]/g) || []).length, trs = t.match(/<tr[ >]/g) || [];
ok(nth === LEDGER_HEAD.length && LEDGER_HEAD.length === 32 && trs.length === 1 + rows.length + 1, '표: 머리글 32칸, 줄 = 머리글 + 직원 2 + 합계 1');
ok([...t.matchAll(/<tr[^>]*>(.*?)<\/tr>/g)].every((m) => (m[1].match(/<t[hd][ >]/g) || []).length === 32), '표: 모든 줄의 칸 수가 머리글과 같다');
ok(t.includes('overflow-x:auto') && t.includes('position:sticky;left:0') && t.includes('jh-hr-table') && t.includes('jh-hr__sum') && t.includes('합계(2명)'), '표: 가로 스크롤 영역·첫 칸 고정·합계 줄');
ok(b.row.workDays === null && t.includes('<span class="jh-field__hint">—</span>') && !/>NaN</.test(t) && !/>undefined</.test(t), '표: 근로일수 자료가 없으면 "—", NaN·undefined 가 보이지 않는다');
ok(t.includes((a.row.netPay).toLocaleString('ko-KR')) && t.includes('김가나') && t.includes('FCU 설치') && t.includes('2024-03-01'), '표: 숫자는 천 단위 구분, 인적사항이 보인다');
const xss = mk('<img src=x onerror=alert(1)>', 'w9', 5); ok(!ledgerTableHtml([xss.row]).includes('<img') && ledgerTableHtml([xss.row]).includes('&lt;img'), '표: 이름에 들어간 HTML 을 막는다');
ok(ledgerTableHtml([]).includes('합계(0명)') && !ledgerTableHtml([]).includes('NaN'), '표: 빈 목록도 깨지지 않는다');
// ── 화면 전체
let h = page(); ok(h.includes('data-l-month') && h.includes('value="2026-08"') && h.includes('미마감') && h.includes('점검을 모두 통과') && h.includes('data-l-table') && h.includes('근로기준법 제48조'), '기본 화면: 귀속월 입력·미마감·점검 통과·표·근거 안내');
ok(dis(h, 'close') === false && dis(h, 'csv') === false && dis(h, 'print') === false && btn(h, 'unlock') === null && !h.includes('data-l-reason'), '점검 통과·미마감: 마감 가능, 엑셀·인쇄 가능, 해제 버튼·사유 입력은 없다');
h = page({ data: { rows, checks: badChecks, close: null } }); ok(dis(h, 'close') === true && h.includes('마감할 수 없습니다 (') && h.includes('실지급액') && h.includes('role="alert"') && dis(h, 'csv') === false, '점검에서 막히면 마감 버튼이 꺼지고 이유가 보인다(엑셀·인쇄는 가능)');
h = page({ data: { rows, checks: Object.assign({}, okChecks, { warnings: [{ code: 'x', msg: '이다라: 근로일수 자료가 없습니다' }] }), close: null } }); ok(dis(h, 'close') === false && h.includes('확인해 주세요 (1건)') && h.includes('마감은 할 수 있습니다') && h.includes('근로일수 자료가 없습니다') && !h.includes('점검을 모두 통과'), '경고만 있으면 마감은 가능하고 경고가 보인다');
h = page({ data: { rows, checks: okChecks, close: CLOSED } }); ok(dis(h, 'close') === true && dis(h, 'unlock') === false && h.includes('마감됨 v2') && h.includes('해제 이력') && h.includes('식대 정정') && h.includes('hr@jhsol.kr') && !h.includes('data-l-reason'), '마감된 달: 마감 버튼 꺼짐, 해제 버튼, 해제 이력 표시(사유 입력은 아직 없음)');
h = page({ data: { rows, checks: okChecks, close: CLOSED }, unlockOpen: true, reason: '</textarea><script>1</script>' }); ok(h.includes('data-l-reason') && h.includes('data-l-act="unlock-do"') && h.includes('data-l-act="unlock-cancel"') && h.includes('maxlength="500"') && !h.includes('<script>1') && h.includes('&lt;/textarea&gt;'), '해제 입력창: 사유 필수 안내·500자 제한, 사유 속 HTML 을 막는다');
h = page({ data: { rows, checks: okChecks, close: OPEN } }); ok(h.includes('해제됨') && dis(h, 'close') === false && btn(h, 'unlock') === null, '해제된 달: 다시 마감할 수 있고 해제 버튼은 없다');
h = page({ unlockOpen: true, data: { rows, checks: okChecks, close: null } }); ok(!h.includes('data-l-reason'), '마감 안 된 달에는 해제 입력창이 나오지 않는다(상태가 남아 있어도)');
h = page({ data: { rows: [], checks: closeChecks('2026-08', [], {}, []), close: null } }); ok(dis(h, 'close') === true && dis(h, 'csv') === true && dis(h, 'print') === true && h.includes('급여명세서가 없습니다') && !h.includes('data-l-table'), '명세서가 한 건도 없으면 마감·엑셀·인쇄가 모두 꺼지고 안내가 나온다');
h = page({ busy: true }); ok(dis(h, 'close') === true, '작업 중에는 마감 버튼이 꺼진다(두 번 누르기 방지)');
h = page({ data: { rows, checks: okChecks, close: CLOSED }, busy: true }); ok(dis(h, 'unlock') === true, '작업 중에는 해제 버튼도 꺼진다');
h = page({ loading: true, data: null }); ok(h.includes('aria-busy="true"') && h.includes('data-l-month') && !h.includes('data-l-table') && !h.includes('data-l-act'), '불러오는 중: 월 입력만 두고 자리표시, 버튼 없음');
h = page({ error: '<b>permission-denied</b>', data: null }); ok(h.includes('role="alert"') && h.includes('불러오지 못했습니다') && h.includes('&lt;b&gt;permission-denied') && !h.includes('<b>permission') && !h.includes('data-l-table'), '불러오기 실패: 오류를 그대로 보여 주되 HTML 은 막고 빈 표로 숨기지 않는다');
h = page({ data: null }); ok(h.includes('귀속월을 고르세요') && !h.includes('data-l-act'), '데이터 없음: 안내만');
h = page({ ym: '"><script>1</script>' }); ok(!h.includes('<script>1') && h.includes('&quot;&gt;&lt;script&gt;'), '귀속월 값의 HTML 을 막는다');
h = page({ data: { rows, checks: okChecks, close: Object.assign({}, CLOSED, { unlockLog: [{ at: 'x', by: '<i>a</i>', reason: '<script>2</script>' }] }) } }); ok(!h.includes('<script>2') && !h.includes('<i>a</i>') && h.includes('&lt;script&gt;2'), '해제 이력의 작성자·사유 HTML 을 막는다');
ok(/<th style="position:sticky;left:0[^"]*">성명<\/th>/.test(ledgerTableHtml(rows)) && /<td style="[^"]*position:sticky;left:0[^"]*">김가나<\/td>/.test(ledgerTableHtml(rows)), '표: 머리글의 "성명" 칸과 직원 줄의 이름 칸이 모두 고정된다(가로로 밀어도 누구 줄인지 보임)');
h = page({ data: { rows: [], checks: okChecks, close: null } }); ok(dis(h, 'close') === true, '점검 결과가 통과여도 직원 줄이 한 줄도 없으면 마감할 수 없다(방어)');
console.log('\n' + (fail ? 'FAILED ' : 'ALL OK ') + pass + ' pass / ' + fail + ' fail'); process.exit(fail ? 1 : 0);
