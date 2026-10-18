/* 공사일보 폰 폭 팝업 시험 — 대표님 2026-10-19: ①폰에서는 달력만 보이고, 날짜를 누르면 그날 공사일보가 팝업으로 뜨고, 닫기를 누르면 다시 달력만 ②다크 모드에서 종이를 살짝 어둡게.
 * 순수 함수(report-popup.js)·화면 마크업(report-view.js)·스타일(pjt.css)·컨트롤러 연결(index.js)을 확인한다. 실제 브라우저 배치는 tests/report-popup.test.py. */
import fs from 'node:fs';
import { fromStored } from '../app/modules/pjt/report.js';
import { reportHtml } from '../app/modules/pjt/report-view.js';
import { formShown, isDirty, openPopup, closePopup } from '../app/modules/pjt/report-popup.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const css = fs.readFileSync(new URL('../app/theme/pjt.css', import.meta.url), 'utf8');
const idx = fs.readFileSync(new URL('../app/modules/pjt/index.js', import.meta.url), 'utf8');
const stored = { author: '관리자', content: '4층 FCU 설치', tomorrow: '5층', headcount: 3, manday: 3, equip: '', note: '' };
const rst = (o) => Object.assign({ proj: 'p4ph2', label: 'P4 Ph2 (FAB)', ready: true, date: '2026-10-14', today: '2026-10-14', month: { y: 2026, m: 9 }, dates: new Set(['2026-10-14']), exists: true, editing: false, preview: false, manage: true, readonly: false, popup: false, ctx: { site: 'P4 Ph2 (FAB)', client: '귀뚜라미 범양냉방', dateKey: '2026-10-14' }, form: fromStored(stored) }, o || {});

// ── 1) 순수 함수
{ const st = {}; openPopup(st); ok(st.popup === true, '날짜를 누르면 팝업이 열린 상태가 된다(openPopup)'); closePopup(st); ok(st.popup === false, '닫기를 누르면 팝업이 닫힌 상태가 된다(closePopup)'); }
ok(formShown(rst({ exists: false })) === true && formShown(rst({ editing: true })) === true, '폼이 보이는 경우: 작성 전인 날·수정 중');
ok(formShown(rst()) === false && formShown(rst({ preview: true, editing: true })) === false && formShown(rst({ form: Object.assign(fromStored({}), { legacy: true }), exists: true, editing: true })) === false && formShown(null) === false, '폼이 안 보이는 경우: 작성된 일보를 보는 중·미리보기·옛 양식·상태 없음');
{ const f = fromStored(stored); const a = rst({ editing: true, form: f, snap: JSON.stringify(f) }); ok(isDirty(a) === false, '★ 폼을 열기만 했으면(기준과 같음) 입력 중이 아니다 — 닫을 때 확인창을 띄우지 않는다');
  const g = Object.assign({}, f, { content: '고친 내용' }); ok(isDirty(Object.assign({}, a, { form: g })) === true, '★ 내용을 고쳤으면 입력 중이다 — 닫을 때 확인창');
  ok(isDirty(rst({ snap: JSON.stringify(f) })) === false, '작성된 일보를 보는 중(폼 없음)에는 입력 중이 아니다');
  ok(isDirty(rst({ editing: true, snap: undefined })) === false, '기준이 없으면(읽기 전) 입력 중으로 보지 않는다(오류 없음)'); }

// ── 2) 화면 마크업
const closed = reportHtml(rst({ popup: false })), open = reportHtml(rst({ popup: true }));
ok(closed.includes('class="jh-pjt__rpcol" data-open="false"') && open.includes('class="jh-pjt__rpcol" data-open="true"'), '★ 오른쪽 열이 팝업 껍데기(jh-pjt__rpcol)로 감싸지고 열림 상태가 data-open 으로 표시된다');
ok((open.match(/data-rp-act="closepop"/g) || []).length === 1 && (closed.match(/data-rp-act="closepop"/g) || []).length === 1, '★ 닫기 버튼(data-rp-act="closepop")이 한 개 있다');
ok(open.includes('jh-pjt__rphead') && /jh-pjt__rphead"><strong>2026\. ?10\. ?14|jh-pjt__rphead"><strong>[^<]*2026/.test(open), '팝업 머리글에 날짜가 나온다');
ok(open.includes('data-rp-day="2026-10-14"') && open.includes('jh-pjt__calcol'), '달력(날짜 칸)은 팝업 밖에 그대로 있다');
ok(open.indexOf('jh-pjt__calcol') < open.indexOf('jh-pjt__rpcol'), '달력이 먼저, 공사일보 열이 그 뒤(2열에서 왼쪽 달력·오른쪽 일보 순서 유지)');
ok(reportHtml(rst({ popup: true, editing: true })).includes('data-rp-f="content"') && reportHtml(rst({ popup: true, preview: true })).includes('data-rp-act="closeprev"'), '작성 폼·미리보기도 팝업 안에서 그대로 나온다(미리보기 닫기는 별개 버튼)');
ok(reportHtml({ proj: '' }).indexOf('jh-pjt__rpcol') === -1 && reportHtml(rst({ ready: false })).indexOf('jh-pjt__rpcol') === -1, '프로젝트가 없거나 불러오는 중에는 껍데기를 그리지 않는다(기존 안내 그대로)');
ok(!/\bdata-open\b/.test(reportHtml(rst({ popup: true })).replace(/class="jh-pjt__rpcol" data-open="true"/, '')), '껍데기 외의 곳에 열림 표시가 새어 나가지 않는다');

// ── 3) 스타일 — 폭 분기점·겹침 순서·머리글 숨김·다크 종이·인쇄
const pop = css.slice(css.indexOf('공사일보: 폰 폭에서는 달력만'));
ok(pop.length > 200, '스타일에 폰 폭 팝업 규칙 구역이 있다');
ok(/\.jh-pjt__rphead \{ display: none; \}/.test(pop), '★ 팝업 머리글은 기본(넓은 화면)에서 숨긴다');
ok(/@media \(max-width: 599px\)/.test(pop), '★ 폰 폭(599px 이하)에서만 팝업이 된다');
ok(/\.jh-pjt__rpcol\[data-open="false"\] \{ display: none; \}/.test(pop), '★ 폰 폭에서 닫힌 상태는 공사일보를 숨기고 달력만 남긴다');
ok(/\.jh-pjt__rpcol\[data-open="true"\] \{[^}]*position: fixed;[^}]*inset: 0;[^}]*overflow-y: auto;/.test(pop), '★ 폰 폭에서 열린 상태는 화면 전체를 덮는 스크롤 가능한 팝업(position: fixed; inset: 0)');
ok(/z-index: calc\(var\(--z-dialog\) - 1\)/.test(pop), '★ 팝업은 하단 메뉴(20) 위·확인창(60) 아래(59)');
ok(/\.jh-pjt__rphead \{ display: flex; position: sticky; top: 0;/.test(pop), '팝업 머리글(닫기 버튼)은 스크롤해도 위에 붙어 있다');
ok(/env\(safe-area-inset-bottom/.test(pop) && /env\(safe-area-inset-top/.test(pop), '폰의 안전 영역(노치·하단 막대)을 피한다');
ok(/overscroll-behavior: contain/.test(pop), '팝업을 끝까지 스크롤해도 뒤 화면이 같이 움직이지 않는다');
ok(/:root\[data-theme="dark"\] \.jh-pjt__doc \{ background: #e3e7ed; \}/.test(pop) && /prefers-color-scheme: dark\) \{ :root:not\(\[data-theme="light"\]\) \.jh-pjt__doc \{ background: #e3e7ed; \}/.test(pop), '★ 다크 모드(설정·시스템 모두)에서 종이를 살짝 어둡게(#e3e7ed). 라이트 강제 설정이면 그대로 흰색');
ok(/@media print \{ \.jh-pjt__doc \{ background: #fff !important; \}/.test(pop), '★ 인쇄는 다크 모드에서도 흰 종이');
ok(/\.jh-pjt__doc \{ background: #fff; color: #111;/.test(css), '기본 종이 규칙(흰색·검정 글자)은 그대로');

// ── 4) 컨트롤러 연결(index.js mountReport)
ok(/import \{ formShown, isDirty, openPopup, closePopup \} from '\.\/report-popup\.js\?v=/.test(idx) || /import \{[^}]*openPopup[^}]*\} from '\.\/report-popup\.js\?v=/.test(idx), '컨트롤러가 팝업 함수를 불러온다(빌드 번호 붙은 주소)');
ok(/preview: false, equipHistory: \[\], ctx: \{\}, popup: false/.test(idx) || /popup: false/.test(idx.slice(idx.indexOf('export async function mountReport'))), '상태 초기값: 팝업 닫힘');
ok(/data-rp-day\]'\)\)\) \{ openPopup\(st\); await go\(/.test(idx), '★ 날짜 칸을 누르면 팝업을 연 다음 그 날짜를 불러온다');
ok(/act === 'closepop'/.test(idx) && /isDirty\(st\)/.test(idx) && /confirmDialog\(\{ title: '작성 중인 내용'/.test(idx), '★ 닫기: 입력 중인 내용이 있으면 확인창을 띄운다');
{ const i = idx.indexOf("act === 'closepop'"); const seg = idx.slice(i, i + 700); ok(/!ok \|\| !ok\.ok\) return;/.test(seg) && /closePopup\(st\); paint\(\)/.test(seg), '★ 확인창에서 취소하면 닫지 않고(ok.ok 로 읽음 — 확인창 객체는 항상 참), 확인하면 닫는다'); }
ok(/const loadDay0 = async \(\) =>/.test(idx) && /const loadDay = async \(\) => \{ await loadDay0\(\); st\.snap = JSON\.stringify\(st\.form\); \};/.test(idx), '★ 하루를 읽은 직후의 폼을 기준(snap)으로 저장한다 — 모든 호출 경로(날짜 이동·취소·처음 열기)가 같은 감싸개를 쓴다');
ok(!/act === 'closepop'[^;]*st\.editing = true/.test(idx), '닫기가 수정 상태를 켜지 않는다');

console.log('\n' + pass + ' passed, ' + fail + ' failed'); if (fail) process.exit(1);
