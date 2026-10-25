import { purgeChipHtml, purgeCardHtml, purgeHomeHtml } from '../app/modules/hr/recruit-purge-view.js';
import { purgeReport, purgeInfo } from '../app/modules/hr/recruit-purge.js';
import { applicantsHtml, homeHtml } from '../app/modules/hr/view.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const P = (o) => Object.assign({ id: 'j1', title: '사무직', status: 'closed', decidedDate: '2026-10-01', retentionDays: 90 }, o || {});
const A = (o) => Object.assign({ id: 'a1', jobKey: 'j1', jobTitle: '사무직', status: 'new', name: '가나다', phone: '010-0000-0000', created: '2026.10.16 09:00' }, o || {});
const T = '2026-12-31';
// ── 칩
ok(purgeChipHtml(purgeInfo(A(), P(), T)).includes('🔴 파기 기한 지남 2026-12-30 (D+1)') && purgeChipHtml(purgeInfo(A(), P(), '2026-12-20')).includes('🟠 파기 예정 임박 2026-12-30 (D-10)') && purgeChipHtml(purgeInfo(A(), P(), '2026-10-25')).includes('파기 예정 2026-12-30 (D-66)') && purgeChipHtml(purgeInfo(A(), P({ decidedDate: '' }), T)).includes('채용 확정일 미입력') && purgeChipHtml(purgeInfo(A({ status: 'pass' }), P(), T)).includes('✅ 합격자 — 파기 제외') && purgeChipHtml(purgeInfo(A(), null, T)).includes('공고 연결 없음'), '지원자 행 칩: 기한 지남·임박·예정(날짜와 D-day)·확정일 미입력·합격자 제외·공고 없음');
ok(purgeChipHtml(purgeInfo(A({ status: 'destroyed' }), P(), T)) === '' && purgeChipHtml(null) === '' && purgeChipHtml({ state: '이상한값' }) === '', '파기 완료·빈 값·모르는 상태는 칩을 그리지 않는다');
// ── 관리 카드
const apps = [A({ id: 'a1' }), A({ id: 'a2', status: 'pass' }), A({ id: 'a3', jobKey: 'j2' }), A({ id: 'a4', status: 'destroyed' }), A({ id: 'a5', jobKey: 'ghost' })];
const posts = [P(), P({ id: 'j2', title: '현장직', status: 'open', decidedDate: '', retentionDays: '' }), P({ id: 'j3', title: '<img src=x onerror=1>', status: 'open', decidedDate: '2026-10-20', retentionDays: 30 })];
const rep = purgeReport(apps, posts, T); let h = purgeCardHtml(rep);
ok(h.includes('🗑 지원서 개인정보 파기 관리') && h.includes('data-pg-table') && h.includes('overflow-x:auto') && h.includes('data-pg-run') && !/data-pg-run disabled/.test(h) && h.includes('기한 지난 1건 파기') && h.includes('기한 지남 1 · 임박 0 · 확정일 미입력 1 · 공고 없음 1 · 합격자 제외 1 · 파기 완료 1'), '카드: 제목·표·가로 스크롤·[기한 지난 1건 파기] 켜짐·상태별 건수');
ok(h.includes('data-pg-date="j1"') && h.includes('value="2026-10-01"') && h.includes('data-pg-days="j1"') && h.includes('value="90"') && h.includes('data-pg-save="j1"') && h.includes('min="14"') && h.includes('max="180"') && h.includes('placeholder="90"') && h.includes('2026-12-30') && h.includes('확정일 입력 필요'), '공고 줄: 채용 확정일·보관기간 입력칸(14~180, 기본 90 안내)·저장 단추·파기 예정일, 확정일이 없으면 "입력 필요"');
ok(h.includes('data-pg-days="j2" value=""') && h.includes('2026-11-19') && h.includes('(공고 없음)') && h.includes('공고가 지워진 지원서'), '보관기간을 비운 공고는 빈 칸, 공고 3(30일)은 파기 예정일 11-19, 공고가 없는 지원서 줄');
ok(!h.includes('<img src=x') && h.includes('&lt;img'), '공고 제목의 HTML 을 막는다');
ok(h.includes('채용절차법 제11조') && h.includes('개인정보보호법 제21조') && h.includes('되돌릴 수 없습니다') && h.includes('합격자는 파기하지 않습니다') && h.includes('지원 페이지에는 반환·보관·파기 안내'), '안내문: 근거 법, 되돌릴 수 없음, 합격자 제외, 지원 페이지 고지 의무');
h = purgeCardHtml(purgeReport([A({ id: 'x' })], [P({ decidedDate: '2026-12-25' })], T)); ok(/data-pg-run disabled/.test(h) && h.includes('기한 지난 0건 파기') && h.includes('data-variant="secondary" data-pg-run'), '기한 지난 지원서가 없으면 파기 단추가 꺼진다(눌러도 아무 일 없음)');
ok(purgeCardHtml(null) === '' && purgeCardHtml(purgeReport([], [], T)).includes('공고가 없습니다') && !purgeCardHtml(purgeReport([], [], T)).includes('data-pg-table'), '자료가 없으면 카드를 그리지 않거나 "공고가 없습니다"');
// ── 인사 홈 신호
ok(purgeHomeHtml(null).includes('aria-busy="true"') && purgeHomeHtml(purgeReport([], [], T)) === '', '홈: 불러오는 중에는 자리표시, 지원서가 하나도 없으면 아무것도 그리지 않는다');
h = purgeHomeHtml(rep); ok(h.includes('🗑 지원서 파기 기한') && h.includes('🔴 파기 기한이 지난 지원서 1건') && h.includes('role="alert"') && h.includes('href="#/hr/applicants"') && h.includes('data-variant="primary"') && h.includes('확정일 미입력 1'), '홈: 기한 지난 지원서가 있으면 빨간 안내와 지원자 화면 링크(강조)');
h = purgeHomeHtml(purgeReport([A({ id: 'n1', jobKey: 'j2' })], posts, T)); ok(!h.includes('role="alert"') && h.includes('채용 확정일 미입력 1') && h.includes('data-variant="secondary"'), '홈: 확정일 미입력만 있으면 빨간 안내 없이 한 줄 안내');
h = purgeHomeHtml(purgeReport([A({ status: 'pass' }), A({ id: 'q' })], [P({ decidedDate: '2026-12-25' })], T)); ok(h.includes('파기가 필요한 지원서가 없습니다') && h.includes('합격자 제외 1건') && !h.includes('href='), '홈: 처리할 것이 없으면 "없습니다" 한 줄(링크 없음)');
// ── 실제 지원자 화면·홈 틀에 연결됐는지
const st = (o) => Object.assign({ apList: apps.filter((a) => a.status !== 'destroyed').map((a) => Object.assign({}, a, { purgeInfo: purgeInfo(a, posts.find((p) => p.id === a.jobKey) || null, T) })), apFilter: 'all', apSel: '', purge: rep }, o || {});
const ap = applicantsHtml(st());
ok(ap.indexOf('🗑 지원서 개인정보 파기 관리') >= 0 && ap.indexOf('🗑 지원서 개인정보 파기 관리') < ap.indexOf('채용 지원자') && ap.includes('파기 기한 지남') && ap.includes('합격자 — 파기 제외') && ap.includes('공고 연결 없음') && ap.includes('채용 확정일 미입력'), '지원자 화면: 파기 관리 카드가 목록 위에, 각 행에 파기 상태 칩');
ok(!applicantsHtml(st({ purge: null })).includes('파기 관리') && !applicantsHtml(st({ apList: [A({ id: 'z' })] })).includes('파기 기한 지남 2026'), '파기 정보가 없으면 카드·칩 없이 예전 화면 그대로');
ok(applicantsHtml(st({ apSel: 'a1' })).indexOf('파기 관리') < 0, '지원서 상세를 열었을 때는 관리 카드가 끼어들지 않는다');
const hh = homeHtml(); ok(hh.indexOf('hm-week') < hh.indexOf('hm-purge') && hh.indexOf('hm-purge') < hh.indexOf('hm-work') && hh.indexOf('hm-work') < hh.indexOf('hm-list') && hh.indexOf('hm-list') < hh.indexOf('hm-cal'), '인사 홈 틀: 주 근로시간 → 지원서 파기 → 인력 현황 → 목록 → 캘린더 순서');
console.log('\n' + (fail ? 'FAILED ' : 'ALL OK ') + pass + ' pass / ' + fail + ' fail'); process.exit(fail ? 1 : 0);
