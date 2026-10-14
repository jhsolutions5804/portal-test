import { homeHtml } from '../app/modules/edoc/home-view.js';
import { chooserHtml, newDocLayoutHtml } from '../app/modules/edoc/compose-view.js';
import fs from 'node:fs';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const idx = (h, s) => h.indexOf(s);
const model = { me: { admin: true, uid: 'u' }, work: { state: 'loading', month: '2026-10' }, leave: { state: 'loading' }, todo: { approve: 2, rejected: 0, postWait: 1, inbox: 0 }, docs: [], lists: { approve: [], inbox: [], mine: [], posted: [] }, scope: 'mine', tab: 'approve' };
const h = homeHtml(model); const side = h.slice(idx(h, 'jh-ehome__side'), idx(h, 'jh-ehome__main')), main = h.slice(idx(h, 'jh-ehome__main'));
ok(idx(h, 'jh-pagehead') < idx(h, 'jh-ehome"') && idx(h, 'jh-ehome__side') < idx(h, 'jh-ehome__main') && !h.includes('jh-ehome__detail'), '★ 전자결재 홈은 2단: 제목 줄 아래 왼쪽(개인 현황) | 오른쪽(문서)');
ok(side.includes('id="edoc-work"') && side.includes('id="edoc-leavebox"') && idx(side, 'edoc-work') < idx(side, 'edoc-leavebox') && !side.includes('edoc-pipe') && !side.includes('edoc-recent') && main.includes('id="edoc-pipe"') && main.includes('id="edoc-recent"') && idx(main, 'edoc-pipe') < idx(main, 'edoc-recent') && !main.includes('edoc-work') && !main.includes('edoc-leavebox'), '왼쪽: 근무시간 → 내 연차 현황 · 오른쪽: 문서 현황 → 최근 문서(칸 id 는 그대로라 채우는 코드 무변경)');
ok(!h.includes('jh-todo') && !h.includes('edoc-todo') && h.includes('data-new') && h.includes('data-admin'), '할 일 카드 4개는 홈에서 뺌(문서 현황·최근 문서 탭 건수와 겹침), 제목 줄의 새 문서 작성·관리자 설정 버튼은 그대로');
const css = fs.readFileSync(new URL('../app/theme/edoc.css', import.meta.url), 'utf8');
ok(/\.jh-main\[data-sided\] \{ padding: 0; \}/.test(css) && /\.jh-edoc--side > \.jh-sidenav \{[^}]*height: 100vh[^}]*margin-bottom: calc\(var\(--sidenav-trim\) \* -1\)[^}]*border: 0; border-right: var\(--u-1\) solid var\(--c-line\); border-radius: 0/.test(css) && /overflow: clip; min-height: calc\(100vh - var\(--sidenav-trim\)\)/.test(css) && /\.jh-app\[data-worktabs\] \{ --sidenav-trim: calc\(var\(--u-64\) \+ var\(--u-44\)\)/.test(css) && /\.jh-ehome \{ display: grid; grid-template-columns: minmax\(26rem, 30rem\) minmax\(0, 1fr\)/.test(css) && /\.jh-ehome__side \.jh-statrow \{ flex-direction: column/.test(css) && !/jh-ehome__detail/.test(css), '스타일 보호: 사이드 메뉴는 왼쪽 끝 전체 높이(상단바·작업 탭 바 높이만큼 줄여 스크롤 없음), 홈은 왼쪽 26~30rem·오른쪽 가변 2단, 연차 카드는 세로 쌓기');
// 새 문서: 왼쪽 종류 목록(좁게) + 오른쪽 작성 화면
const none = newDocLayoutHtml('', ''); const picked = newDocLayoutHtml('leave', '<div class="jh-card" id="FORM">작성 화면</div>');
const rows = (h) => (h.match(/data-new-type="/g) || []).length;
ok(rows(chooserHtml()) >= 5 && rows(none) === rows(chooserHtml()) && none.indexOf('jh-newdoc__side') < none.indexOf('jh-newdoc__main') && none.includes('왼쪽에서 작성할 문서 종류를 고르면') && !none.includes('is-selected'), '★ 새 문서 분할 화면: 왼쪽에 문서 종류 목록, 오른쪽은 고르기 전에는 안내(고른 종류 표시 없음)');
ok(picked.indexOf('jh-newdoc__side') < picked.indexOf('id="FORM"') && picked.indexOf('id="FORM"') > picked.indexOf('jh-newdoc__main') && (picked.match(/is-selected/g) || []).length === 1 && /is-selected" aria-current="true" data-new-type="leave"/.test(picked) && !picked.includes('왼쪽에서 작성할 문서 종류를 고르면'), '종류를 고르면 오른쪽에 작성 화면, 왼쪽 목록에는 고른 종류(연차)만 표시, 안내는 사라짐');
ok(/\.jh-newdoc \{ display: grid; grid-template-columns: minmax\(26rem, 30rem\) minmax\(0, 1fr\)/.test(css) && /\.jh-newdoc__side \{ position: sticky/.test(css) && /@media \(max-width: 1099px\) \{ \.jh-newdoc \{ grid-template-columns: minmax\(0, 1fr\)/.test(css), '스타일 보호: 새 문서 왼쪽 목록 26~30rem(홈과 같은 폭)·오른쪽 가변, 1099px 이하 위아래');
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); if (fail) process.exit(1);
