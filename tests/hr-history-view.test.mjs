import { historyCardHtml, historyInnerHtml, historyPrintHtml, HIST_PAGE } from '../app/modules/hr/history-view.js';
import { buildHistory } from '../app/modules/hr/history.js';
import { detailHtml } from '../app/modules/hr/view.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const W = { id: 'w1', name: '김가나', empNo: '24001', dept: '사업본부', rank: '대리', empType: 'field', job: 'FCU 설치', hireDate: '2024-03-01' };
const base = buildHistory({ worker: W, annual: [{ id: 'a1', contractDate: '2026-01-02', startDate: '2026-01-01', endDate: '2026-12-31', hourly: 10320, salary: 21565000 }], changes: [{ id: 'c1', type: 'rank', fromRank: '사원', toRank: '대리', effectiveDate: '2026-03-01' }], leaves: [{ id: 'v1', status: 'approved', leaveType: '연차', startDate: '2026-07-01', endDate: '2026-07-01' }], payslips: [{ month: '2026-08' }] });
const H = (o) => Object.assign({ loading: false, items: base.items, errors: [], skipped: 0, filter: 'all', limit: 30, shown: {} }, o || {});
const rowsOf = (h) => (h.match(/class="jh-hr__post"/g) || []).length;
// ── 상태
ok(historyCardHtml(null) === '' && historyCardHtml(undefined) === '' && historyInnerHtml(null) === '', '이력 자리가 없으면(상태 없음) 아무것도 그리지 않는다');
let h = historyCardHtml({ loading: true, filter: 'all', limit: 30, shown: {} });
ok(h.startsWith('<div id="w-hist">') && h.includes('aria-busy="true"') && /data-h-print disabled/.test(h) && !h.includes('data-h-filter') && !h.includes('jh-hr__post'), '읽는 중: #w-hist 자리·자리표시, 인쇄 단추는 꺼짐, 필터·목록 없음');
h = historyCardHtml(H());
ok(h.startsWith('<div id="w-hist">') && h.includes('📜 인사 이력') && rowsOf(h) === 5 && !/data-h-print disabled/.test(h) && h.includes('data-h-print'), '읽기 완료: 항목 5줄(입사·변동·계약·연차·급여명세서), 인쇄 단추 켜짐');
const pos = ['급여명세서 2026년', '>연차<', '인사 변동', '>연봉계약서<', '>입사<'].map((t) => h.indexOf(t)); ok(pos.every((x) => x > 0) && pos.every((x, i) => i === 0 || pos[i - 1] < x), '최신 순으로 그려진다(급여명세서 → 연차 → 인사 변동 → 연봉계약서 → 입사)');
const chips = [...h.matchAll(/data-variant="(\w+)" data-h-filter="(\w+)">([^<]*)</g)];
ok(chips.length === 6 && chips[0][1] === 'primary' && chips[0][2] === 'all' && chips[0][3] === '전체 5' && chips.find((c) => c[2] === 'contract')[3] === '계약 1' && chips.find((c) => c[2] === 'leave')[3] === '연차 1' && chips.find((c) => c[2] === 'doc')[3] === '서류 1' && chips.find((c) => c[2] === 'exit')[3] === '퇴직 0' && chips.filter((c) => c[1] === 'primary').length === 1, '묶음 단추 6개에 건수, 선택된 것만 강조');
h = historyCardHtml(H({ filter: 'contract' })); ok(rowsOf(h) === 1 && h.includes('연봉계약서') && !h.includes('입사') && /data-variant="primary" data-h-filter="contract"/.test(h) && /data-variant="ghost" data-h-filter="all"/.test(h), '계약만 거르면 계약 1줄, 강조가 옮겨 간다');
h = historyCardHtml(H({ filter: 'exit' })); ok(rowsOf(h) === 0 && h.includes('표시할 이력이 없습니다.'), '해당 이력이 없으면 안내');
// ── 금액
h = historyCardHtml(H());
ok(h.includes('금액 ●●●●●') && h.includes('data-h-show="annual:a1"') && !h.includes('21,565,000') && !h.includes('10,320') && !h.includes('시급'), '금액은 기본으로 가려져 있고 화면 글자 어디에도 숫자가 없다');
h = historyCardHtml(H({ shown: { 'annual:a1': true } })); ok(h.includes('🔓 시급 10,320원 · 연봉 21,565,000원') && !h.includes('data-h-show') && !h.includes('금액 ●'), '[보기]를 누르면 그 항목만 금액이 나타나고 단추는 사라진다');
ok(!historyCardHtml(H({ shown: { 'other:key': true } })).includes('21,565,000') && historyCardHtml(H({ shown: undefined })).includes('금액 ●●●●●'), '다른 항목의 보기는 영향이 없고, 상태 값이 없어도 깨지지 않는다');
// ── 안내
h = historyCardHtml(H({ errors: ['평가', '면담'], skipped: 2 })); ok(h.includes('⚠️ 일부 자료를 불러오지 못했습니다: 평가, 면담') && h.includes('role="status"') && h.includes('날짜를 알 수 없는 2건') && rowsOf(h) === 5, '일부 읽기 실패·날짜 없는 건수를 알리고 나머지는 그대로 보인다');
ok(!historyCardHtml(H()).includes('일부 자료') && !historyCardHtml(H()).includes('날짜를 알 수 없는') && historyCardHtml(H()).includes('새로 저장하지 않습니다') && historyCardHtml(H()).includes('인쇄본에는 들어가지 않습니다'), '문제가 없으면 경고가 없고, 저장하지 않음·인쇄본 금액 제외 안내는 항상 있다');
// ── 더 보기
const many = buildHistory({ worker: Object.assign({}, W, { hireDate: '' }), interviews: Array.from({ length: 70 }, (_, i) => ({ id: 'i' + i, date: '2026-01-' + String((i % 28) + 1).padStart(2, '0'), memo: 'm' + i })) });
ok(HIST_PAGE === 30 && rowsOf(historyCardHtml(H({ items: many.items }))) === 30 && historyCardHtml(H({ items: many.items })).includes('더 보기 (남은 40건)') && rowsOf(historyCardHtml(H({ items: many.items, limit: 60 }))) === 60 && historyCardHtml(H({ items: many.items, limit: 60 })).includes('남은 10건') && !historyCardHtml(H({ items: many.items, limit: 70 })).includes('data-h-more') && rowsOf(historyCardHtml(H({ items: many.items, limit: 70 }))) === 70, '30줄씩 보이고 [더 보기]는 남은 건수와 함께, 다 보이면 단추가 없다');
// ── 링크·이스케이프
h = historyCardHtml(H({ filter: 'contract' })); ok(h.includes('href="#/hr/annualc/w1"') && h.includes('화면 ›'), '항목의 화면 링크');
const evil = buildHistory({ worker: Object.assign({}, W, { id: 'a"b<c', hireDate: '' }), interviews: [{ id: 'q"><script>1</script>', date: '2026-06-01', memo: '<img src=x onerror=1>', followUp: true }], annual: [{ id: 'z', contractDate: '2026-01-01', startDate: '2026-01-01', endDate: '2026-12-31', hourly: 10000 }] });
h = historyCardHtml(H({ items: evil.items, errors: ['<b>평가</b>'], shown: {} }));
ok(!h.includes('<script>1') && !h.includes('<img src=x') && !h.includes('<b>평가</b>') && h.includes('&lt;img') && h.includes('&lt;b&gt;평가') && !h.includes('a"b<c') && h.includes('/a%22b%3Cc'), '내용·오류·키·직원 번호에 들어간 HTML·따옴표를 막는다');
h = historyCardHtml(H({ items: [{ key: 'k"><x>', kind: 'contract', date: '2026-01-01', title: 't', detail: '', link: '', secret: '<s>비밀</s>' }] })); ok(!h.includes('<x>') && h.includes('data-h-show="k&quot;&gt;&lt;x&gt;"') && !h.includes('<s>비밀'), '금액 [보기] 키와 숨은 금액도 이스케이프(숨겨져 있어 화면에는 없음)');
// ── 인쇄본
const items = base.items; const p = historyPrintHtml(Object.assign({}, W, { phone: '010-1111-2222', address: '비밀 주소', bankAccount: '123-456', jumin: '900101-1234567' }), items, '2026-10-25');
ok(p.includes('<title>인사기록카드 - 김가나</title>') && p.includes('인사기록카드') && p.includes('김가나') && p.includes('24001') && p.includes('사업본부') && p.includes('현장직') && p.includes('FCU 설치') && p.includes('2024-03-01') && p.includes('재직 중') && p.includes('출력일 2026-10-25') && p.includes('@page{size:A4'), '인쇄본: 제목, 기본 정보(성명·사번·소속·직급·구분·업무·입사일·재직), 출력일, A4');
ok(!p.includes('21,565,000') && !p.includes('10,320') && !p.includes('시급') && !p.includes('010-1111') && !p.includes('비밀 주소') && !p.includes('123-456') && !p.includes('900101') && !p.includes('href=') && !p.includes('화면 ›') && p.includes('금액은 포함하지 않습니다'), '인쇄본에는 금액·연락처·주소·계좌·주민번호·링크가 없다(명부에 값이 있어도)');
ok(p.includes('연봉계약서') && p.includes('2026-01-01 ~ 2026-12-31') && p.includes('인사 변동') && p.includes('직급 사원 → 대리') && p.includes('급여명세서 2026년 1건') && (() => { const t = p.slice(p.indexOf('<h2>인사 이력</h2>')); return t.indexOf('2026-08-01') > 0 && t.indexOf('2026-08-01') < t.indexOf('2026-03-01') && t.indexOf('2026-03-01') < t.indexOf('2026-01-02') && t.indexOf('2026-01-02') < t.indexOf('2024-03-01'); })(), '인쇄본 이력 표: 계약·변동·급여명세서·입사가 최신 순으로 들어간다');
const pe = historyPrintHtml({ name: '<b>이름</b>', empNo: '<i>1</i>', status: 'resigned', resignDate: '2026-09-30', empType: '이상한값' }, [{ date: '2026-01-01', kind: 'zzz', title: '<script>1</script>', detail: '<img onerror=1>' }], '<x>');
ok(!pe.includes('<script>1') && !pe.includes('<b>이름') && !pe.includes('<img onerror') && pe.includes('&lt;script&gt;') && pe.includes('2026-09-30') && !pe.includes('재직 중') && pe.includes('이상한값') && pe.includes('zzz') && !pe.includes('<x>'), '인쇄본: 이름·내용·출력일의 HTML 을 막고, 퇴직자는 퇴직일, 모르는 구분·종류도 그대로 표시');
ok(historyPrintHtml(W, [], '2026-10-25').includes('기록된 이력이 없습니다.') && historyPrintHtml(null, null, null).includes('인사기록카드') && historyPrintHtml({ name: '가', status: 'resigned' }, [], '').includes('<td>-</td>'), '이력이 없거나 입력이 비어도 깨지지 않는다(빈 칸은 -)');
// ── 직원 상세 화면에 붙는지
const FORM = Object.assign({ name: '', empNo: '', dept: '', rank: '', empType: '', job: '', hireDate: '', step: '', phone: '', email: '', address: '', bankAccount: '', taxFamily: '', taxChildren: '', reason: '', resignDate: '', certs: [] }, W); // index.js 의 toForm 과 같은 모양(그 함수는 지역 함수라 가져올 수 없다)
const st = (hist) => ({ today: '2026-10-25', workers: [W], sel: { id: 'w1', orig: W, form: FORM, history: null, hist } });
let d; try { d = detailHtml(st(H())); } catch (e) { d = 'ERR ' + e.message; }
ok(!d.startsWith('ERR') && d.includes('김가나 상세·수정') && d.includes('id="w-hist"') && d.indexOf('상세·수정') < d.indexOf('id="w-hist"') && d.includes('📜 인사 이력') && d.includes('data-h-print') && d.includes('data-w-act="save"'), '직원 상세 화면: 기존 수정 카드 아래에 이력 카드가 붙고, 기존 저장·닫기 단추는 그대로');
try { d = detailHtml(st(undefined)); } catch (e) { d = 'ERR ' + e.message; } ok(!d.startsWith('ERR') && !d.includes('w-hist') && d.includes('data-w-act="save"'), '이력 상태가 없는 상세 화면(옛 호출)은 카드 없이 기존 그대로');
const evil2 = historyCardHtml(H({ items: [{ key: 'k1', kind: 'contract', date: '2026-01-01', title: '<img src=x onerror=1>제목', detail: '', link: '#/x"><script>1</script>', secret: '' }] }));
ok(!evil2.includes('<img src=x') && !evil2.includes('<script>1') && evil2.includes('&lt;img') && evil2.includes('href="#/x&quot;&gt;&lt;script&gt;'), '화면 함수 자체가 항목 제목과 링크 주소에 들어온 HTML·따옴표를 막는다(계산 모듈의 인코딩에만 의존하지 않음)');
ok(!historyPrintHtml({ name: '가', status: 'resigned' }, [], '2026-10-25').includes('재직 중') && historyPrintHtml({ name: '가' }, [], '2026-10-25').includes('재직 중') && historyPrintHtml({ name: '가', status: 'resigned', resignDate: '2026-09-30' }, [], '').includes('2026-09-30'), '인쇄본: 퇴직 처리됐지만 퇴직일이 없으면 "재직 중"으로 찍지 않는다(빈 칸 -), 상태가 없으면 재직 중, 퇴직일이 있으면 그 날짜');
console.log('\n' + (fail ? 'FAILED ' : 'ALL OK ') + pass + ' pass / ' + fail + ' fail'); process.exit(fail ? 1 : 0);
