import fs from 'node:fs';
const VER = (fs.readFileSync(new URL('../app/modules/eval/index.js', import.meta.url), 'utf8').match(/eval-perm\.js\?v=([0-9a-z]+)/) || [])[1];
const L = await import('../app/modules/eval/mine-logic.js?v=' + VER);
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
// ── 키
ok(L.taskKey(2026, 'peer', 'w2') === '2026__peer__w2' && L.subId(2026, 'U1', 'w2', 'peer') === '2026__U1__w2__peer', '★ 과제 키와 제출 문서 id 의 모양이 보안 규칙·서버 함수와 같음(연도__종류__대상 / 연도__평가자uid__대상__종류)');
ok(JSON.stringify(L.parseKey('2026__peer__w2')) === '{"year":2026,"kind":"peer","target":"w2"}' && L.parseKey('2026__hack__w2') === null && L.parseKey('26__peer__w2') === null && L.parseKey('2026__peer') === null && L.parseKey('2026__peer__') === null && L.parseKey(null) === null && L.parseKey('2026__peer__w2__x') === null, '과제 키 해석: 종류가 self·peer·lead 가 아니거나 연도·칸 수가 틀리면 무시');
// ── 과제 목록
const names = { w1: '가나다', w2: '나다라', w3: '다라마' };
const tl = L.tasksOf({ keys: ['2026__peer__w3', '2026__self__w1', '2026__peer__w2', '2026__lead__w2', 'bad', '2026__zzz__w1'] }, names);
ok(tl.map((t) => t.key).join() === '2026__self__w1,2026__lead__w2,2026__peer__w2,2026__peer__w3' && tl[0].name === '가나다' && L.tasksOf(null, names).length === 0 && L.tasksOf({ keys: ['2026__peer__w9'] }, names)[0].name === '(이름 없음)', '★ 내 과제 목록은 자기평가 → 팀원 1차 → 동료평가 순이고(같은 종류는 이름순), 형식이 틀린 키는 빼며 이름을 모르면 "(이름 없음)"');
// ── 진행
const subs = { '2026__self__w1': { status: 'submitted' }, '2026__peer__w2': { status: 'draft' }, '2026__peer__w3': { status: 'draft' } };
const pr = L.progressOf(tl, subs); ok(JSON.stringify(pr) === '{"total":4,"done":1,"draft":2,"left":3}' && JSON.stringify(L.progressOf([], {})) === '{"total":0,"done":0,"draft":0,"left":0}' && L.statusOf(null) === 'none' && L.statusOf({ status: 'approved' }) === 'none' && L.statusOf({ status: 'submitted' }) === 'submitted', '진행 요약: 전체 4건 중 제출 1·임시저장 2·남은 3(임시저장은 아직 남은 것으로 셈), 이상한 상태 값은 "작성 전"');
// ── 제출 가능 판정
const full = { scores: { collab: 4, trust: 5, support: 3 } };
ok(L.canSubmit('peer', full).ok && !L.canSubmit('peer', { scores: { collab: 4, trust: 5 } }).ok && L.canSubmit('peer', { scores: { collab: 4, trust: 5 } }).reason.includes('업무 지원') && !L.canSubmit('peer', { scores: { collab: 4, trust: 5, support: 6 } }).ok && !L.canSubmit('peer', { scores: { collab: 4, trust: 5, support: 0 } }).ok && !L.canSubmit('peer', { scores: { collab: 4, trust: 5, support: 2.5 } }).ok && !L.canSubmit('peer', null).ok, '★ 동료평가는 3개 항목을 모두 1~5 정수로 채워야 제출 가능(빠진 항목 이름을 알려 줌, 6점·0점·소수는 불가)');
ok(L.canSubmit('lead', { scores: { achievement: 4, competency: 4, conduct: 5 } }).ok && !L.canSubmit('lead', { scores: { achievement: 4 } }).ok && L.canSubmit('self', { text: '올해 성과' }).ok && !L.canSubmit('self', { text: '   ' }).ok && !L.canSubmit('self', {}).ok && !L.canSubmit('self', { text: 'x'.repeat(2001) }).ok && L.canSubmit('self', { text: 'x'.repeat(2000) }).ok, '팀원 1차 평가는 3영역 점수, 자기평가는 서술(공백만은 불가, 2000자 초과 불가)이 필요');
// ── 저장 본문: 규칙이 허용하는 필드만
const b = L.buildSubmission(2026, 'U1', 'w2', 'peer', { scores: { collab: 4, trust: 5, support: 3, extra: 5, bad: 9 }, text: '메모', hacker: 1 }, 'draft', '<ts>');
ok(JSON.stringify(Object.keys(b).sort()) === JSON.stringify(['kind', 'raterUid', 'scores', 'status', 'targetWid', 'text', 'updatedAt', 'year']) && JSON.stringify(b.scores) === '{"collab":4,"trust":5,"support":3}' && !('submittedAt' in b) && b.status === 'draft', '★ 저장 본문은 규칙이 허용하는 필드만(year·raterUid·targetWid·kind·scores·text·status·updatedAt), 모르는 항목(extra)·범위 밖 점수(9)·모르는 필드(hacker)는 버리고, 임시저장에는 제출 시각이 없음');
const bs = L.buildSubmission(2026, 'U1', 'w1', 'self', { text: '성과' }, 'submitted', '<ts>'); ok(bs.status === 'submitted' && bs.submittedAt === '<ts>' && bs.updatedAt === '<ts>' && JSON.stringify(bs.scores) === '{}' && L.buildSubmission(2026, 'U1', 'w1', 'self', { text: 'x'.repeat(3000) }, 'draft', 't').text.length === 2000 && L.buildSubmission(2026, 'U1', 'w1', 'peer', {}, 'weird', 't').status === 'draft', '제출 문서에는 제출 시각이 있고, 자기평가는 점수 없이 서술만, 서술은 2000자로 자르며, 모르는 상태는 임시저장으로 처리');
// ── 입력 반영
const s1 = L.withScore(null, 'collab', 4); const s2 = L.withScore(s1, 'trust', 5); const s3 = L.withScore(s2, 'collab', 9); const s4 = L.withScore(s2, 'trust', 'x');
ok(JSON.stringify(s2.scores) === '{"collab":4,"trust":5}' && JSON.stringify(s1.scores) === '{"collab":4}' && JSON.stringify(s3.scores) === '{"trust":5}' && JSON.stringify(s4.scores) === '{"collab":4}', '점수 입력: 원본은 그대로 두고 복사본을 돌려주며, 범위 밖·숫자가 아닌 값은 그 항목 점수를 지움');
ok(L.withText({ scores: { collab: 4 } }, '안녕').text === '안녕' && L.withText(null, 'x'.repeat(2500)).text.length === 2000 && JSON.stringify(L.withText({ scores: { collab: 4 } }, 'a').scores) === '{"collab":4}', '서술 입력: 점수는 그대로, 2000자까지만');
// ── 내 근로자 찾기
const ws = [{ id: 'w1', empNo: '23001', portalUid: 'U1' }, { id: 'w2', empNo: '23002' }, { id: 'w3', empNo: '' }];
ok(L.myWorker({ uid: 'U1', empNo: 'x' }, ws).id === 'w1' && L.myWorker({ uid: 'zz', empNo: '23002' }, ws).id === 'w2' && L.myWorker({ uid: 'zz', empNo: '999' }, ws) === null && L.myWorker({ uid: '', empNo: '' }, ws) === null && L.myWorker(null, ws) === null && L.myWorker({ uid: 'U1' }, null) === null, '내 근로자는 포털 계정 연결(portalUid) 또는 사번으로 찾고, 연결이 없거나 사번이 빈 값이면 찾지 않음(빈 사번끼리 우연히 맞지 않게)');
ok(L.itemsOf('peer').length === 3 && L.itemsOf('lead').length === 3 && L.itemsOf('self').length === 0 && new Set(L.itemsOf('peer').map((i) => i.key)).size === 3, '항목 수: 동료평가 3개(서버가 집계에 쓰는 개수와 같음), 팀원 1차 평가 3영역, 자기평가는 점수 없음');
// ═══ 화면(마크업) ═══
const V = await import('../app/modules/eval/mine-view.js?v=' + VER);
const T = (kind, target, name) => ({ key: '2026__' + kind + '__' + target, year: 2026, kind, target, name });
const mkSt = (o) => ({ mine: Object.assign({ year: 2026, worker: { id: 'w1' }, cycle: { status: 'open' }, tasks: [T('self', 'w1', '가'), T('lead', 'w2', '나다라'), T('peer', 'w2', '나다라'), T('peer', 'w3', '다라마')], subs: {}, sel: '', draft: null }, o || {}) });
const list = V.mineListHtml(mkSt({ subs: { '2026__self__w1': { status: 'submitted' }, '2026__peer__w2': { status: 'draft' } } }));
ok(list.includes('내 평가 2026') && list.includes('제출 1 / 4') && list.includes('나의 자기평가') && list.includes('팀원 1차 평가') && list.includes('동료평가') && list.includes('data-ev-open="2026__peer__w3"') && list.includes('제출 완료') && list.includes('임시저장') && list.includes('작성 전') && list.indexOf('나의 자기평가') < list.indexOf('팀원 1차 평가') && list.indexOf('팀원 1차 평가') < list.indexOf('>동료평가<'), '★ 목록: 진행 "제출 1 / 4", 자기평가 → 팀원 1차 → 동료평가 순, 항목마다 상태(제출 완료·임시저장·작성 전)');
ok(list.includes('<strong>익명</strong>') && list.includes('사장단·인사팀·관리자도 볼 수 없고') && list.includes('2명 미만이면 반영하지 않습니다') && list.includes('참고자료로만'), '★ 목록 머리: 동료평가는 익명(사장단·인사팀·관리자도 못 봄, 2명 미만이면 미반영)이고 올해는 참고자료라는 안내');
ok(V.mineListHtml(mkSt({ worker: null })).includes('근로자 명부와 연결되어 있지 않습니다') && !V.mineListHtml(mkSt({ worker: null })).includes('data-ev-open') && V.mineListHtml(mkSt({ tasks: [] })).includes('배정된 평가가 없습니다') && V.mineListHtml(mkSt({ cycle: null })).includes('아직 열리지 않았습니다') && V.mineListHtml(mkSt({ cycle: { status: 'closed' } })).includes('평가 기간이 끝났습니다'), '명부 연결이 없거나 배정이 없거나 평가가 열리기 전·끝난 뒤에는 각각 알맞은 안내(연결 없으면 평가 버튼 없음)');
// 작성 화면
const formSt = (kind, target, sub, o) => mkSt(Object.assign({ sel: '2026__' + kind + '__' + target, draft: sub }, o || {}));
const peer = V.mineFormHtml(formSt('peer', 'w2', { scores: { collab: 4 }, text: '' }));
ok(peer.includes('동료평가 — 나다라') && ['collab', 'trust', 'support'].every((k) => [1, 2, 3, 4, 5].every((n) => peer.includes('data-ev-score="' + k + '|' + n + '"'))) && (peer.match(/class="jh-eval-dot"/g) || []).length === 15 && /data-ev-score="collab\|4"[^>]*aria-pressed="true"/.test(peer) && /data-ev-score="collab\|3"[^>]*aria-pressed="false"/.test(peer) && peer.includes('aria-label="협업·소통 4점"') && peer.includes('1 매우 아쉬움') && peer.includes('5 매우 좋음'), '★ 동료평가 작성: 3개 항목 × 점수 버튼 5개 = 15개(각 버튼에 "협업·소통 4점" 같은 접근성 이름), 누른 점수는 눌림 표시, 척도 설명(1 매우 아쉬움 ~ 5 매우 좋음)');
ok(peer.includes('<strong>익명</strong>으로 처리됩니다') && peer.includes('서술은 평균에 반영되지 않으며 본인만 볼 수 있습니다') && peer.includes('data-ev-act="save"') && peer.includes('data-ev-act="submit"') && peer.includes('data-ev-act="back"') && peer.includes('아직 점수를 주지 않은 항목이 있습니다: 신뢰·책임감, 업무 지원') && peer.includes('aria-disabled="true"') && peer.includes('maxlength="2000"'), '동료평가 작성: 익명 안내, 임시저장·제출·목록 버튼, 점수가 덜 찼으면 빠진 항목 이름을 안내하고 제출 버튼은 비활성 표시, 서술 2000자 제한');
const fullForm = V.mineFormHtml(formSt('peer', 'w2', { scores: { collab: 4, trust: 5, support: 3 }, text: '좋았어요' }));
ok(fullForm.includes('제출할 수 있습니다') && !fullForm.includes('aria-disabled') && fullForm.includes('좋았어요') && !fullForm.includes('아직 점수를 주지 않은 항목'), '점수를 다 채우면 제출 가능 안내가 나오고 제출 버튼 비활성 표시가 사라지며 쓴 서술이 채워져 있음');
const self = V.mineFormHtml(formSt('self', 'w1', { scores: {}, text: '' }));
ok(self.includes('나의 자기평가') && !self.includes('data-ev-score') && self.includes('올해 성과·성장·개선하고 싶은 점') && self.includes('면담 자료로 쓰입니다') && self.includes('한 줄이라도 써 주세요'), '자기평가 작성: 점수 버튼 없이 서술만, 점수에 반영되지 않고 면담 자료라는 안내, 서술이 비면 안내');
const lead = V.mineFormHtml(formSt('lead', 'w2', { scores: { achievement: 4, competency: 4 } }));
ok(lead.includes('팀원 1차 평가 — 나다라') && ['achievement', 'competency', 'conduct'].every((k) => lead.includes('data-ev-score="' + k + '|5"')) && lead.includes('업적') && lead.includes('태도·근태·안전') && lead.includes('태도·근태·안전'), '팀원 1차 평가 작성: 업적·역량·태도·근태·안전 3영역 점수');
// 제출 후·기간 밖에는 잠김
const locked = V.mineFormHtml(formSt('peer', 'w2', { scores: { collab: 4, trust: 5, support: 3 }, text: '완료' }, { subs: { '2026__peer__w2': { status: 'submitted' } } }));
ok(/data-ev-score="collab\|4"[^>]*disabled/.test(locked) && locked.includes('data-ev-text disabled') && !locked.includes('data-ev-act="save"') && !locked.includes('data-ev-act="submit"') && locked.includes('data-ev-act="back"') && locked.includes('제출했습니다. 수정할 수 없습니다') && locked.includes('제출 완료'), '★ 제출한 평가는 점수 버튼·서술이 잠기고 임시저장·제출 버튼이 없으며 "수정할 수 없습니다" 안내(목록으로만 돌아갈 수 있음)');
const closed = V.mineFormHtml(formSt('peer', 'w2', { scores: {}, text: '' }, { cycle: { status: 'closed' } }));
ok(/data-ev-score="collab\|1"[^>]*disabled/.test(closed) && !closed.includes('data-ev-act="submit"') && closed.includes('지금은 작성할 수 없습니다') && /data-ev-score="collab\|1"[^>]*disabled/.test(V.mineFormHtml(formSt('peer', 'w2', { scores: {}, text: '' }, { cycle: null }))), '평가 기간이 아니면(마감·아직 열리지 않음) 입력이 잠기고 제출 버튼이 없음');
// 익명·보안: 화면에 남의 점수·이름이 나오지 않는다
const dump = V.mineListHtml(mkSt({ subs: { '2026__peer__w2': { status: 'submitted', scores: { collab: 5, trust: 5, support: 5 }, raterUid: 'ZZZ' } } })) + peer;
ok(!/ZZZ|raterUid/.test(dump) && !/uid/i.test(V.mineListHtml(mkSt())) && V.mineFormHtml(formSt('peer', 'w9', { scores: {} })) === '', '★ 화면 마크업에 평가자 식별자(uid)가 노출되지 않고, 내 과제에 없는 대상의 작성 화면은 만들어지지 않음');
const evil = V.mineListHtml(mkSt({ tasks: [T('peer', 'w2', '<img src=x onerror=alert(1)>')] })) + V.mineFormHtml(mkSt({ tasks: [T('peer', 'w2', '"><script>alert(1)</script>')], sel: '2026__peer__w2', draft: { scores: {}, text: '<script>x</script>' } }));
ok(!/<img src=x|<script>/i.test(evil) && evil.includes('&lt;') , '★ 이름·서술에 HTML 이 들어 있어도 화면에서 실행되지 않게 이스케이프(스크립트 삽입 방지)');
// 소스 확인: 보안 규칙·서버와 같은 약속, 폰 요구
const fs2 = await import('node:fs'); const css = fs2.readFileSync(new URL('../app/theme/eval.css', import.meta.url), 'utf8'); const io = fs2.readFileSync(new URL('../app/modules/eval/mine-io.js', import.meta.url), 'utf8'); const mine = fs2.readFileSync(new URL('../app/modules/eval/mine.js', import.meta.url), 'utf8');
ok(/\.jh-eval-dot\s*\{[^}]*min-height: var\(--u-52\)/.test(css) && /\.jh-eval-dot\s*\{[^}]*min-width: var\(--u-44\)/.test(css) && /\.jh-eval-item\s*\{[^}]*min-height: var\(--u-52\)/.test(css) && /\.jh-eval-bar \.jh-btn\s*\{[^}]*min-height: var\(--u-52\)/.test(css) && /position: sticky; bottom: 0/.test(css) && css.includes('safe-area-inset-bottom') && /\.jh-eval-dots\s*\{[^}]*display: flex/.test(css) && !/\.jh-eval[^{]*\{[^}]*(min-width: var\(--u-(2|3)[0-9]{2}\))/.test(css), '★ 폰 요구: 점수 버튼·목록 항목·하단 버튼이 터치 목표 44px 이상(점수 52px), 점수 5개가 한 줄에 폭을 나눠 가짐, 하단 버튼 줄이 화면 아래에 고정(홈 바 영역 고려), 넓은 최소 폭으로 가로 스크롤을 만들지 않음');
ok(io.includes("where('raterUid', '==', me.uid)") && io.includes("'eval_tasks/' + year + '__' + me.uid") && io.includes("'eval_submissions/' + subId(year, me.uid") && !/deleteDoc|updateDoc|addDoc/.test(io) && io.includes('DEBOUNCE_MS') && io.includes("save('draft', true)") && io.includes('flush') && mine.includes('pagehide') && mine.includes('visibilitychange'), '★ 입출력: 내 과제·내 제출만 읽고 내 제출 문서 하나만 쓰며(삭제·부분 수정·새 문서 번호 생성 없음), 점수는 즉시·서술은 입력이 멈춘 뒤 자동 임시저장하고 화면을 떠나거나 앱이 가려질 때 마지막 저장');
ok(io.includes('toast(\'저장하지 못했습니다') && io.includes("e.code === 'permission-denied'") && io.includes('m.saving = false') && /catch \(e\) \{ m\.saving = false; toast\(/.test(io), '저장이 실패하면 저장된 것처럼 보이지 않고 이유와 함께 알림(권한 거부는 평가 기간·배정 확인 안내)');
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); if (fail) process.exit(1);
