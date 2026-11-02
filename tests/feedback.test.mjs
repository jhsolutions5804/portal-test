// 2026-11-02 포털 문의·건의 창 — 규칙(feedback-logic) + 화면(feedback-view)
import { FB_COL, FB_MAX, feedbackEnabledFor, browserLabel, buildFeedbackDoc, cooldownLeft, sortNewestFirst, countByStatus, digest, nextStatus, categoryLabel, statusLabel, dayText } from '../app/shared/feedback-logic.js';
import { newState, buttonHtml, panelHtml, rowHtml, inboxHtml } from '../app/shared/feedback-view.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const me = { uid: 'u1', name: '홍길동', email: 'hong@jhsol.kr', admin: false }; const env = { hash: '#/pjt/p4ph2/home', build: '20261102a', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0', width: 1280.4, height: 720 };
ok(FB_COL === 'portal_feedback', '저장 컬렉션 이름');
ok(feedbackEnabledFor('/portal-test/app/') && feedbackEnabledFor('/portal-test') && !feedbackEnabledFor('/app/') && !feedbackEnabledFor('/') && !feedbackEnabledFor(undefined), '테섭 주소에서만 켜짐(본섭은 규칙 게시 전까지 닫힘)');
// 브라우저 표기
ok(browserLabel(env.userAgent) === 'Edge 130 · Windows', 'Edge/Windows 표기');
ok(browserLabel('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1') === 'Safari 17 · iOS', 'iPhone Safari 표기');
ok(browserLabel('Mozilla/5.0 (Linux; Android 14; SM-S911N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36') === 'Chrome 129 · Android', '안드로이드 Chrome 표기');
ok(browserLabel('') === '알 수 없음' && browserLabel('이상한 값') === '알 수 없음', '알 수 없는 브라우저는 알 수 없음');
// 문서 만들기·검증
const good = buildFeedbackDoc({ category: 'bug', text: '  공사일보 저장이 안 됩니다  ' }, me, env);
ok(good.doc && good.doc.text === '공사일보 저장이 안 됩니다' && good.doc.category === 'bug' && good.doc.uid === 'u1' && good.doc.status === 'new', '정상 입력: 앞뒤 공백 제거·본인 uid·상태 신규');
ok(good.doc.page === '#/pjt/p4ph2/home' && good.doc.build === '20261102a' && good.doc.ua === 'Edge 130 · Windows' && good.doc.viewport === '1280x720', '화면 위치·빌드·브라우저·화면 크기가 자동으로 붙음');
const keys = Object.keys(good.doc).sort().join(','); ok(keys === 'build,category,email,name,page,status,text,ua,uid,viewport', '문서 필드가 보안 규칙의 허용 목록과 같음(createdAt 은 저장할 때 서버 시각)');
ok(buildFeedbackDoc({ category: 'bug', text: '' }, me, env).error === '내용을 입력해 주세요.' && buildFeedbackDoc({ text: ' a ' }, me, env).error, '빈 내용·한 글자는 거부');
ok(buildFeedbackDoc({ text: 'x'.repeat(FB_MAX + 1) }, me, env).error.includes('2000자'), '2000자 초과 거부');
ok(buildFeedbackDoc({ text: 'x'.repeat(FB_MAX) }, me, env).doc, '정확히 2000자는 허용');
ok(buildFeedbackDoc({ category: '엉뚱한값', text: '불편합니다' }, me, env).doc.category === 'inconvenience', '모르는 분류는 「불편해요」로');
ok(buildFeedbackDoc({ text: '불편합니다' }, null, env).error.includes('로그인') && buildFeedbackDoc({ text: '불편합니다' }, {}, env).error, '로그인 정보가 없으면 거부');
ok(buildFeedbackDoc({ text: '긴 주소' }, me, { hash: '#/' + 'a'.repeat(400), userAgent: '' }).doc.page.length === 160, '화면 주소는 160자까지만');
// 연속 전송 방지
ok(cooldownLeft(0, 1000) === 0 && cooldownLeft(1000, 11000) === 10000 && cooldownLeft(1000, 21000) === 0 && cooldownLeft(1000, 30000) === 0, '20초 안에는 다시 못 보냄');
// 목록 정렬·집계·보고 재료
const rows = [{ id: 'a', d: { createdSec: 100, status: 'new', category: 'bug', page: '#/edoc/home?tab=1' } }, { id: 'b', d: { createdSec: 300, status: 'seen', category: 'idea', page: '#/pjt/p4ph2' } }, { id: 'c', d: { createdSec: 200, status: 'done', category: 'bug', page: '#/edoc/home' } }, { id: 'd', d: { status: 'new', category: 'bug' } }];
ok(sortNewestFirst(rows).map((r) => r.id).join('') === 'bcad', '최신 건의가 위, 시각이 없는 것은 맨 뒤');
ok(JSON.stringify(countByStatus(rows)) === '{"new":2,"seen":1,"done":1}', '상태별 건수');
const dg = digest(rows); ok(dg.total === 4 && dg.byCategory.bug === 3 && dg.byPage[0][0] === '#/edoc/home' && dg.byPage[0][1] === 2, '보고 재료: 분류별 건수와 같은 화면에서 모인 건수(주소의 ?조건 제외)');
ok(nextStatus('new') === 'seen' && nextStatus('seen') === 'done' && nextStatus('done') === 'done', '상태 순서 신규→확인→완료');
ok(categoryLabel('bug') === '오류예요' && statusLabel('seen') === '확인' && statusLabel(undefined) === '신규', '이름표');
ok(dayText(Date.UTC(2026, 10, 2, 1, 20) / 1000) === '11/02 10:20' && dayText(0) === '', '시각 표기는 한국 시간');
// 화면
const st = newState(me);
ok(buttonHtml(false).includes('data-fb-toggle') && buttonHtml(false).includes('aria-expanded="false"') && buttonHtml(true).includes('aria-expanded="true"') && buttonHtml(false).includes('문의·건의'), '떠 있는 버튼(접근성 표시 포함)');
let h = panelHtml(st); ok(h.includes('data-fb-text') && h.includes('data-fb-send') && h.includes('불편해요') && h.includes('오류예요') && h.includes('건의해요') && !h.includes('받은 건의'), '일반 직원은 건의하기만 보임(받은 건의 탭 없음)');
ok(h.includes('비밀번호·주민등록번호·계좌번호는 적지 마세요'), '민감 정보 입력 금지 안내');
st.text = '<script>alert(1)</script> & "따옴표"'; h = panelHtml(st); ok(!h.includes('<script>alert') && h.includes('&lt;script&gt;'), '입력한 글자는 HTML 로 해석되지 않게 바뀌어 다시 그려짐');
st.busy = true; ok(panelHtml(st).includes('disabled') && panelHtml(st).includes('보내는 중'), '보내는 중에는 단추가 잠김'); st.busy = false;
st.msg = '접수했습니다.'; st.msgTone = 'ok'; ok(panelHtml(st).includes('접수했습니다.') && panelHtml(st).includes('role="status"'), '결과 안내 문구');
const adm = newState({ uid: 'a', admin: true }); adm.tab = 'inbox';
ok(panelHtml(adm).includes('받은 건의') && panelHtml(adm).includes('data-fb-tab="send"'), '관리자는 두 탭이 보임');
ok(inboxHtml(adm).includes('jh-skeleton'), '불러오는 중 표시'); adm.loaded = true; ok(inboxHtml(adm).includes('받은 건의가 없습니다'), '비었을 때 안내');
adm.rows = [{ id: 'r1', d: { createdSec: 1793580000, status: 'new', category: 'bug', name: '김철수', text: '저장 버튼이 안 눌립니다', page: '#/edoc/new/leave', ua: 'Chrome 130 · Android', viewport: '390x800', build: '20261102a' } }, { id: 'r2', d: { createdSec: 1793500000, status: 'done', category: 'idea', name: '이영희', text: '다크 모드 글자가 작아요' } }];
h = inboxHtml(adm); ok(h.includes('신규 1') && h.includes('완료 1') && h.includes('저장 버튼이 안 눌립니다') && h.includes('김철수') && h.includes('Chrome 130 · Android'), '받은 건의 목록: 건수·내용·이름·환경 표시');
ok(h.includes('data-fb-next="r1"') && !h.includes('data-fb-next="r2"') && h.includes('확인함'), '신규에는 「확인함」 단추, 완료에는 단추 없음');
ok(rowHtml({ id: 'x', d: { text: '<img src=x onerror=alert(1)>', name: '<b>', status: 'seen' } }).includes('&lt;img') , '목록에서도 글자가 안전하게 표시됨');
adm.err = '불러오지 못했습니다'; ok(inboxHtml(adm).includes('role="alert"'), '불러오기 오류 안내');
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); process.exit(fail ? 1 : 0);
