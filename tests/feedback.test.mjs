// 2026-11-02 포털 문의·건의 창 — 규칙(feedback-logic) + 화면(feedback-view)
import { FB_COL, FB_MAX, FB_REPLY_MAX, feedbackEnabledFor, browserLabel, buildFeedbackDoc, cooldownLeft, sortNewestFirst, countByStatus, digest, nextStatus, categoryLabel, statusLabel, myStatusLabel, dayText, validateReply, buildReplyDoc, splitInbox, unreadCount, hasUnread } from '../app/shared/feedback-logic.js';
import { newState, buttonHtml, panelHtml, rowHtml, inboxHtml, mineHtml, replyHtml } from '../app/shared/feedback-view.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const me = { uid: 'u1', name: '홍길동', email: 'hong@jhsol.kr', admin: false }; const env = { hash: '#/pjt/p4ph2/home', build: '20261102a', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0', width: 1280.4, height: 720 };
ok(FB_COL === 'portal_feedback', '저장 컬렉션 이름');
ok(feedbackEnabledFor('/portal-test/app/') && feedbackEnabledFor('/portal-test') && feedbackEnabledFor('/app/') && feedbackEnabledFor('/app'), '테섭과 본섭 주소에서 켜짐(본섭은 규칙 게시 뒤 2026-11-02 에 열었음)');
ok(!feedbackEnabledFor('/') && !feedbackEnabledFor('/application') && !feedbackEnabledFor('/classic.html') && !feedbackEnabledFor('/m/tag.html') && !feedbackEnabledFor(undefined), '그 밖의 주소(옛 포털·모바일 태그 페이지 등)에서는 켜지지 않음');
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
ok(panelHtml(adm).includes('data-fb-tab="inbox"') && panelHtml(adm).includes('data-fb-tab="done"') && panelHtml(adm).includes('data-fb-tab="send"') && panelHtml(adm).includes('data-fb-tab="mine"'), '관리자는 건의하기·받은 건의·완료·내 건의 탭이 보임');
ok(panelHtml(st).includes('data-fb-tab="mine"') && !panelHtml(st).includes('data-fb-tab="done"') && !panelHtml(st).includes('data-fb-tab="inbox"'), '일반 직원은 건의하기·내 건의 탭만 보임(완료·받은 건의 탭 없음)');
ok(inboxHtml(adm, 'open').includes('jh-skeleton'), '불러오는 중 표시'); adm.loaded = true; ok(inboxHtml(adm, 'open').includes('처리할 건의가 없습니다') && inboxHtml(adm, 'done').includes('조치 완료된 건의가 없습니다'), '비었을 때 안내(처리 중·완료 각각)');
adm.rows = [{ id: 'r1', d: { createdSec: 1793580000, status: 'new', category: 'bug', name: '김철수', text: '저장 버튼이 안 눌립니다', page: '#/edoc/new/leave', ua: 'Chrome 130 · Android', viewport: '390x800', build: '20261102a' } }, { id: 'r2', d: { createdSec: 1793500000, status: 'done', category: 'idea', name: '이영희', text: '다크 모드 글자가 작아요' } }];
h = inboxHtml(adm, 'open'); ok(h.includes('신규 1') && h.includes('완료 1') && h.includes('저장 버튼이 안 눌립니다') && h.includes('김철수') && h.includes('Chrome 130 · Android'), '받은 건의 목록: 건수·내용·이름·환경 표시');
ok(h.includes('data-fb-next="r1"') && h.includes('확인함') && !h.includes('다크 모드 글자가 작아요'), '처리 중 탭: 신규에는 「확인함」 단추가 있고 완료 건은 보이지 않음');
const hd = inboxHtml(adm, 'done'); ok(hd.includes('다크 모드 글자가 작아요') && !hd.includes('저장 버튼이 안 눌립니다') && !hd.includes('data-fb-next'), '완료 탭: 조치 완료 건만 따로 모아 보임');
ok(rowHtml({ id: 'x', d: { text: '<img src=x onerror=alert(1)>', name: '<b>', status: 'seen' } }, adm).includes('&lt;img') , '목록에서도 글자가 안전하게 표시됨');
adm.err = '불러오지 못했습니다'; ok(inboxHtml(adm).includes('role="alert"'), '불러오기 오류 안내');
// ── 댓글·완료 탭·알림(2026-11-02)
ok(FB_REPLY_MAX === 1000 && validateReply('  조치했습니다  ').text === '조치했습니다' && validateReply('').text === '' && validateReply('x'.repeat(1001)).error.includes('1000자'), '댓글 검사: 빈 글은 허용(조치 완료만 누를 때), 1000자 초과는 거부');
ok(buildReplyDoc('저장 오류를 고쳤습니다', { uid: 'a', name: '관리자' }, 'done').doc.kind === 'done' && buildReplyDoc('답변', { uid: 'a' }, 'x').doc.kind === 'reply' && buildReplyDoc('', { uid: 'a' }, 'reply').error && buildReplyDoc('답변', null, 'reply').error, '댓글 문서: 조치 완료와 함께 남기면 done, 그 외 reply, 빈 글·로그인 없음은 거부');
ok(Object.keys(buildReplyDoc('답변', { uid: 'a', name: '관리자' }, 'reply').doc).sort().join(',') === 'kind,name,text,uid', '댓글 필드가 보안 규칙의 허용 목록과 같음(createdAt 은 저장할 때 서버 시각)');
const sp = splitInbox([{ id: 'a', d: { status: 'new', createdSec: 100 } }, { id: 'b', d: { status: 'done', createdSec: 300, handledSec: 500 } }, { id: 'c', d: { status: 'seen', createdSec: 200 } }, { id: 'd', d: { status: 'done', createdSec: 400, handledSec: 900 } }]);
ok(sp.open.map((r) => r.id).join('') === 'ca' && sp.done.map((r) => r.id).join('') === 'db', '처리 중은 최신 접수순, 완료는 최근 처리순');
ok(unreadCount([{ d: { userUnread: true } }, { d: { userUnread: false } }, { d: {} }, { d: { userUnread: true } }]) === 2 && hasUnread([{ d: { userUnread: true } }]) && !hasUnread([]) && !hasUnread(null), '읽지 않은 답변 건수');
ok(myStatusLabel('new') === '접수' && myStatusLabel('seen') === '확인 중' && myStatusLabel('done') === '조치 완료', '건의자에게 보이는 상태 이름');
ok(buttonHtml(false, true).includes('jh-fb__dot') && buttonHtml(false, true).includes('새 답변') && !buttonHtml(false, false).includes('jh-fb__dot'), '새 답변이 있으면 버튼에 점과 「새 답변」 표시');
const ex = newState({ uid: 'a', admin: true }); ex.tab = 'inbox'; ex.loaded = true; ex.rows = [{ id: 'r1', d: { createdSec: 1793580000, status: 'seen', category: 'bug', name: '김철수', text: '저장이 안 됨', replyCount: 2 } }, { id: 'r2', d: { createdSec: 1793500000, status: 'done', category: 'idea', name: '이영희', text: '글자 작음' } }];
let hx = inboxHtml(ex, 'open'); ok(hx.includes('data-fb-exp="r1"') && hx.includes('댓글·처리 2') && !hx.includes('data-fb-done'), '접힌 상태: 댓글 수만 보이고 입력칸은 없음');
ex.expand = 'r1'; ex.replies.r1 = { loaded: true, list: [{ id: 'p1', d: { name: '관리자', text: '확인했습니다', kind: 'reply', createdSec: 1793581000 } }, { id: 'p2', d: { name: '관리자', text: '수정 배포했습니다', kind: 'done', createdSec: 1793582000 } }], err: '' };
hx = inboxHtml(ex, 'open'); ok(hx.includes('확인했습니다') && hx.includes('수정 배포했습니다') && hx.includes('조치 완료') && hx.includes('data-fb-reply') && hx.includes('data-fb-replysend="r1"') && hx.includes('data-fb-done="r1"') && hx.includes('건의하신 분께 알림이 갑니다'), '펼친 상태: 댓글 목록 + 입력칸 + 「댓글 남기기」·「조치 완료로 처리」 단추 + 알림 안내');
ex.tab = 'done'; ex.expand = 'r2'; ex.replies.r2 = { loaded: true, list: [], err: '' }; hx = inboxHtml(ex, 'done'); ok(hx.includes('아직 댓글이 없습니다') && hx.includes('data-fb-replysend="r2"') && !hx.includes('data-fb-done="r2"'), '완료 건에도 댓글은 남길 수 있고 「조치 완료로 처리」 단추는 없음');
ex.replies.r2 = { loaded: false, list: [], err: '' }; ok(inboxHtml(ex, 'done').includes('jh-skeleton'), '댓글 불러오는 중 표시'); ex.replies.r2 = { loaded: true, list: [], err: '댓글을 불러오지 못했습니다.' }; ok(inboxHtml(ex, 'done').includes('role="alert"'), '댓글 불러오기 오류 안내');
ok(replyHtml({ id: 'z', d: { name: '<b>', text: '<script>1</script>', kind: 'reply' } }).includes('&lt;script&gt;'), '댓글 글자도 안전하게 표시됨');
ex.busy = true; ex.replies.r1 = { loaded: true, list: [], err: '' }; ex.expand = 'r1'; ex.tab = 'inbox'; ok(/data-fb-replysend="r1" disabled/.test(inboxHtml(ex, 'open')) && /data-fb-done="r1" disabled/.test(inboxHtml(ex, 'open')), '저장 중에는 댓글·조치 완료 단추가 잠김'); ex.busy = false;
const me2 = newState({ uid: 'u9', admin: false }); me2.tab = 'mine'; ok(mineHtml(me2).includes('jh-skeleton'), '내 건의 불러오는 중'); me2.mineLoaded = true; ok(mineHtml(me2).includes('보낸 건의가 없습니다'), '내 건의 비었을 때 안내');
me2.mine = [{ id: 'm1', d: { createdSec: 1793580000, status: 'done', category: 'bug', text: '저장이 안 됨', replyCount: 1, userUnread: true } }, { id: 'm2', d: { createdSec: 1793500000, status: 'new', category: 'idea', text: '글자 작음' } }];
let hm = mineHtml(me2); ok(hm.includes('조치 완료') && hm.includes('접수') && hm.includes('새 답변') && hm.includes('답변 1') && !hm.includes('data-fb-reply'), '내 건의: 처리 상태·새 답변 표시, 건의자에게는 댓글 입력칸이 없음');
me2.expand = 'm1'; me2.replies.m1 = { loaded: true, list: [{ id: 'p', d: { name: '관리자', text: '수정했습니다', kind: 'done', createdSec: 1793581000 } }], err: '' }; hm = mineHtml(me2); ok(hm.includes('수정했습니다') && !hm.includes('data-fb-replysend') && !hm.includes('data-fb-done'), '건의자는 관리자 댓글을 읽을 수만 있음');
me2.rows = []; me2.mine[0].d.userUnread = false; me2.newIds = { m1: true }; ok(mineHtml(me2).includes('새 답변'), '이번에 읽음 처리된 건도 열어 보는 동안은 「새 답변」 표시가 남음');
me2.tab = 'mine'; me2.mine[1].d.userUnread = true; ok(panelHtml(me2).includes('jh-fb__count') && panelHtml(me2).includes('새 1'), '내 건의 탭에 새 답변 건수 표시');
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); process.exit(fail ? 1 : 0);
