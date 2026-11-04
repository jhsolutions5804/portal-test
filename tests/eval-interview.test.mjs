// 인사평가 면담 도구 시험(2026-11-04 대표님: 성과면담 가이드 반영 ②근거 메모 ③면담 기록·실행 합의 ④준비 체크·진행 안내)
import fs from 'node:fs';
const VER = (fs.readFileSync(new URL('../app/modules/eval/index.js', import.meta.url), 'utf8').match(/eval-perm\.js\?v=([0-9a-z]+)/) || [])[1];
globalThis.Element = class Element {};
const L = await import('../app/modules/eval/interview-logic.js');
const V = await import('../app/modules/eval/interview-view.js');
const R = await import('../app/modules/eval/interview-report.js');
const C = await import('../app/modules/eval/interview-io.js');
const P = await import('../app/shared/eval-perm.js?v=' + VER);
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const U = (o) => Object.assign({ uid: 'u', rank: '사원', perms: {}, isGuest: false }, o || {});
const src = (p) => fs.readFileSync(new URL('../app/' + p, import.meta.url), 'utf8');
const count = (s, re) => (s.match(re) || []).length;

// ═════ 저장 위치(보안 규칙을 바꾸지 않는다) ═════
ok(L.evidencePath('w1') === 'interviews/w1/evidence' && L.reviewDocPath('w1', 2026) === 'interviews/w1/review/2026' && L.hrRecordPath('w1', 2026) === 'interviews/w1/records/eval-2026' && L.reviewPath('w1') === 'interviews/w1/review', '★ 저장 경로 4개가 모두 interviews/{근로자} 아래 — 이미 관리자 전용인 컬렉션이라 새 보안 규칙이 필요 없다');
const rulesFile = ['/home/claude/pf/rules/firestore.test.rules', '/home/claude/pf/rules/firestore.prod.rules'].filter((f) => fs.existsSync(f));
if (rulesFile.length) rulesFile.forEach((f) => { const t = fs.readFileSync(f, 'utf8'); const m = t.match(/function isHrDataCollection\(\)[\s\S]*?\n\s*\}/); const clause = t.match(/match \/\{hrCol\}\/\{document=\*\*\} \{[\s\S]*?\n\s*\}/); ok(!!m && /'interviews'/.test(m[0]) && !!clause && /isHrDataCollection\(\) && isAdmin\(\)/.test(clause[0]), '★ ' + f.split('/').pop() + ': interviews 는 인사 데이터 컬렉션이고 하위 컬렉션까지 관리자만 읽고 쓴다(면담 데이터가 기댈 기존 규칙)'); });
else ok(true, '(규칙 파일이 없는 환경 — 규칙 대조는 건너뜀)');

// ═════ 준비 체크 ═════
ok(L.PREP_ITEMS.length === 4 && L.PREP_ITEMS.map((x) => x.key).join() === 'c1,c2,c3,c4' && L.PREP_ITEMS.every((x) => x.text.length > 10), '준비 체크 4개(c1~c4)');
ok(JSON.stringify(L.prepOf({ c1: true, c2: 'yes', c3: 1, zz: true })) === '{"c1":true,"c2":false,"c3":false,"c4":false}' && JSON.stringify(L.prepOf(null)) === JSON.stringify(L.emptyPrep()) && L.prepProgress({ c1: true, c4: true }).done === 2 && L.prepProgress(null).total === 4, '준비 체크: true 만 체크로 인정(문자열·숫자·알 수 없는 키 무시), 진행 n/4');
// ═════ 날짜 검사 ═════
ok(L.isDate('2026-11-04') && L.isDate('2028-02-29') && !L.isDate('2026-02-29') && !L.isDate('2026-13-01') && !L.isDate('2026-11-31') && !L.isDate('2026-1-4') && !L.isDate('') && !L.isDate(null) && !L.isDate('2026-11-00'), '날짜 검사: 윤년·달 길이·형식');
ok(L.kstToday(Date.UTC(2026, 10, 3, 16, 0, 0)) === '2026-11-04' && L.kstToday(Date.UTC(2026, 10, 3, 14, 59, 0)) === '2026-11-03' && /^\d{4}-\d{2}-\d{2}$/.test(L.kstToday()), '오늘(한국 시간 기준): UTC 15시 이후는 다음 날');
ok(L.evalYearNow(new Date(2026, 10, 4)) === 2026 && L.evalYearNow(new Date(2025, 0, 1)) === 2026 && L.evalYearNow(new Date(2027, 5, 1)) === 2027, '평가 연도: 2027년부터는 그 해, 그 전에는 2026(내 평가 화면과 같은 기준)');

// ═════ ② 근거 메모 ═════
const goodEv = { date: '2026-10-14', tone: 'gap', expected: '기한 준수', actual: ' 보고서가 사흘 늦게 제출됨 ', impact: '점검 일정 1회 연기', said: '자재 지연 때문이라고 설명' };
const be = L.buildEvidence(goodEv, '2026-11-04', 2026);
ok(be.ok && be.data.actual === '보고서가 사흘 늦게 제출됨' && be.data.evalYear === 2026 && be.data.tone === 'gap' && Object.keys(be.data).sort().join() === 'actual,date,evalYear,expected,impact,said,tone', '★ 근거 메모 저장 본문: 앞뒤 공백 제거, 평가 연도 포함, 정해진 필드만');
ok(!L.buildEvidence(Object.assign({}, goodEv, { date: '' }), '2026-11-04').ok && L.buildEvidence(Object.assign({}, goodEv, { date: '2026-12-01' }), '2026-11-04').errors[0] === '날짜가 오늘보다 뒤입니다.' && !L.buildEvidence(Object.assign({}, goodEv, { tone: 'zzz' }), '2026-11-04').ok && !L.buildEvidence(Object.assign({}, goodEv, { tone: undefined }), '2026-11-04').ok, '근거 메모: 날짜 없음·오늘보다 뒤·구분 없음/이상한 구분은 막힘');
ok(L.buildEvidence(Object.assign({}, goodEv, { actual: '   ' }), '2026-11-04').errors.join().includes(L.EV_LABELS.actual + '을(를) 입력해 주세요.') && L.buildEvidence({ date: '2026-10-14', tone: 'win', actual: 'x'.repeat(601) }, '2026-11-04').errors[0]?.includes('600자 이내') && L.buildEvidence({ date: '2026-10-14', tone: 'win', actual: 'ok', said: 'y'.repeat(401) }, '2026-11-04').errors[0]?.includes('400자 이내') && L.buildEvidence({ date: '2026-10-14', tone: 'win', actual: 'a', expected: 'z'.repeat(301) }, '2026-11-04').errors[0]?.includes('300자 이내'), '★ 근거 메모: 실제로 한 일·결과는 필수, 칸별 글자 상한(300·600·300·400)');
ok(L.buildEvidence({ date: '2026-10-14', tone: 'win', actual: 'ok' }, '2026-11-04').ok && L.buildEvidence(null, '2026-11-04').errors.length >= 3 && L.buildEvidence({ date: '2026-11-04', tone: 'win', actual: 'x' }, '2026-11-04').ok, '근거 메모: 선택 칸은 비워도 됨, 오늘 날짜 가능, null 입력도 오류 없이 처리');
ok(JSON.stringify(L.newEvidence('2026-11-04')) === '{"date":"2026-11-04","tone":"win","expected":"","actual":"","impact":"","said":""}', '새 근거 메모 틀(구분 기본 「성과」)');
const evs = [{ id: 'a', date: '2026-10-01', createdMs: 5 }, { id: 'b', date: '2026-10-14', createdMs: 1 }, { id: 'c', date: '2026-10-14', createdMs: 9 }, { id: 'd', date: '2026-09-01' }];
ok(L.evidenceSorted(evs).map((e) => e.id).join() === 'c,b,a,d' && L.evidenceSorted(null).length === 0 && evs[0].id === 'a', '근거 메모 정렬: 날짜 최신순, 같은 날은 늦게 쓴 것 먼저, 원본 불변');
ok(JSON.stringify(L.toneCounts([{ tone: 'win' }, { tone: 'win' }, { tone: 'gap' }, { tone: 'extra' }, { tone: 'x' }, null])) === '{"win":2,"gap":1,"extra":1,"total":4}' && L.toneCounts(null).total === 0, '구분별 건수(알 수 없는 구분·null 제외)');
ok(L.balanceNote({ win: 0, gap: 0, extra: 0, total: 0 }).includes('아직 근거 메모가 없습니다') && L.balanceNote({ win: 2, gap: 0, extra: 0, total: 2 }).startsWith('개선 필요 기록이 없습니다') && L.balanceNote({ win: 0, gap: 3, extra: 1, total: 4 }).startsWith('성과 기록이 없습니다') && L.balanceNote({ win: 1, gap: 1, extra: 0, total: 2 }) === '' && L.balanceNote(null).includes('아직'), '★ 균형 안내: 한쪽 기록만 있으면 알리고(막지 않음), 성과·개선 필요가 모두 있으면 안내 없음');

// ═════ ③ 면담 기록·실행 합의 ═════
const rv0 = L.reviewFromDoc(null, { name: '김종화' });
ok(rv0.exists === false && rv0.status === 'draft' && rv0.record.interviewer === '김종화' && rv0.record.date === '' && L.reviewStatusOf(rv0) === 'none' && L.reviewStatusOf(null) === 'none', '저장된 것이 없으면: 기록 없음, 면담자는 로그인한 사람 이름으로 채워짐');
const doc1 = { evalYear: 2026, status: 'done', prep: { c1: true, c3: true }, record: { date: '2026-11-20', interviewer: '송지훈', employeeAction: '도면 교육 수강', checkDate: 123, zzz: 'x' } };
const rv1 = L.reviewFromDoc(doc1, { name: '김종화' });
ok(rv1.exists && rv1.status === 'done' && rv1.prep.c1 && !rv1.prep.c2 && rv1.record.interviewer === '송지훈' && rv1.record.employeeAction === '도면 교육 수강' && rv1.record.checkDate === '' && !('zzz' in rv1.record) && L.reviewStatusOf(rv1) === 'done' && L.reviewFromDoc({ status: 'weird' }).status === 'draft', '저장된 문서 읽기: 문자열 값만 인정(숫자·알 수 없는 필드 무시), 상태는 done 만 완료');
const fullRec = { date: '2026-11-20', interviewer: '송지훈', summary: '설치 일정 단축', employeeAction: '도면 교육 수강', measure: '분기 말 시험', support: '교육비 지원', checkDate: '2026-12-20', disagreement: '' };
const bd = (rec, status, extra) => L.buildReview(Object.assign({ prep: { c1: true }, record: Object.assign({}, fullRec, rec) }, extra || {}), status, '2026-11-20', 2026);
// 임시저장은 형식만 검사
ok(L.buildReview({ prep: {}, record: {} }, 'draft', '2026-11-20', 2026).ok && L.buildReview(null, 'draft', '2026-11-20', 2026).ok, '★ 임시저장은 비어 있어도 저장된다(작성 중 보관)');
ok(!bd({ date: '2026-13-40' }, 'draft').ok && !bd({ checkDate: 'abc' }, 'draft').ok && bd({ date: '2026-13-40' }, 'draft').errors[0] === '면담일 형식이 올바르지 않습니다.' && bd({ checkDate: 'abc' }, 'draft').errors[0] === L.RC_LABELS.checkDate + ' 형식이 올바르지 않습니다.', '임시저장이라도 날짜 형식은 검사(면담일·중간 확인일)');
ok(!bd({ date: '2026-12-01', checkDate: '2026-11-25' }, 'draft').ok && bd({ date: '2026-12-01', checkDate: '2026-11-25' }, 'draft').errors.join().includes('면담일보다 앞'), '중간 확인일이 면담일보다 앞이면 막힘');
// 완료 조건
const dn = bd({}, 'done');
ok(dn.ok && dn.data.status === 'done' && dn.data.evalYear === 2026 && dn.data.record.checkDate === '2026-12-20' && dn.data.prep.c1 === true && dn.data.prep.c2 === false && Object.keys(dn.data).sort().join() === 'evalYear,prep,record,status', '★ 완료 본문: 상태 done·평가 연도·준비 체크·기록(정해진 필드만)');
ok(bd({ date: '' }, 'done').errors.includes('면담일을 입력해 주세요.') && bd({ employeeAction: '  ' }, 'done').errors[0] === L.RC_LABELS.employeeAction + '을(를) 입력해 주세요.' && bd({ checkDate: '' }, 'done').errors[0]?.startsWith(L.RC_LABELS.checkDate + '을(를) 입력해 주세요'), '★ 완료하려면 면담일·직원이 시작할 행동·중간 확인일이 필요하다');
ok(bd({ date: '2026-11-21' }, 'done').errors.join().includes('면담일이 오늘보다 뒤입니다') && bd({ date: '2026-11-20' }, 'done').ok, '완료는 면담을 마친 날(오늘 이전)만');
ok(bd({ summary: 'x'.repeat(601) }, 'draft').errors[0]?.includes('600자 이내') && bd({ employeeAction: 'x'.repeat(501) }, 'draft').errors[0]?.includes('500자 이내') && bd({ measure: 'x'.repeat(401) }, 'draft').errors[0]?.includes('400자 이내') && bd({ support: 'x'.repeat(401) }, 'draft').errors[0]?.includes('400자 이내') && bd({ disagreement: 'x'.repeat(601) }, 'draft').errors[0]?.includes('600자 이내') && bd({ interviewer: 'x'.repeat(41) }, 'draft').errors[0]?.includes('40자 이내'), '칸별 글자 상한(성과 요약 600·행동 500·확인 방법 400·도움 400·이견 600·면담자 40)');
ok(bd({ summary: '  앞뒤 공백  ' }, 'draft').data.record.summary === '앞뒤 공백' && L.buildReview({ prep: { c1: 'x', c2: true }, record: fullRec }, 'draft', '2026-11-20').data.prep.c1 === false, '저장할 때 앞뒤 공백 제거, 준비 체크는 true 만 저장');
// 인사 면담 이력
const memo = L.interviewMemo(fullRec, 2026);
ok(memo.startsWith('[인사평가 2026 면담]') && memo.includes('올해 주요 성과: 설치 일정 단축') && memo.includes(L.RC_LABELS.employeeAction + ': 도면 교육 수강') && memo.includes(L.RC_LABELS.measure + ': 분기 말 시험') && memo.includes(L.RC_LABELS.support + ': 교육비 지원') && memo.includes(L.RC_LABELS.checkDate + ': 2026-12-20') && !memo.includes(L.RC_LABELS.disagreement), '★ 인사 면담 이력 문구: 헤더 + 채운 항목만(비어 있는 이견은 쓰지 않음)');
ok(L.interviewMemo({ summary: 'a'.repeat(5000) }, 2026).length === 4000 && L.interviewMemo(null, 2026) === '[인사평가 2026 면담]', '이력 문구는 4,000자(인사 면담 화면 상한) 이하, 빈 기록도 안전');
const hr1 = L.hrRecordOf(Object.assign({}, fullRec, { disagreement: '평가 점수에 이견' }), 2026, '김종화'), hr0 = L.hrRecordOf(fullRec, 2026, '김종화');
ok(hr1.followUp === true && hr0.followUp === false && hr1.source === 'eval' && hr1.evalYear === 2026 && hr1.date === '2026-11-20' && hr1.interviewer === '송지훈' && hr1.createdByName === '김종화' && hr1.memo.includes('평가 점수에 이견'), '★ 인사 이력 한 건: 남은 이견이 있으면 「후속 조치 필요」, 출처 eval·평가 연도·면담일·면담자');
// 목록 요약
const rs = L.rowSummary({ id: 'w1', empNo: '23001', name: '윤석원', dept: 'PJT팀', rank: '과장' }, [{ tone: 'win' }, { tone: 'gap' }], L.reviewFromDoc(doc1));
ok(rs.id === 'w1' && rs.ev.total === 2 && rs.prep.done === 2 && rs.status === 'done' && L.rowSummary({ id: 'x' }, null, null).status === 'none' && L.rowSummary(null, null, null).prep.done === 0, '목록 요약: 근거 건수·준비 n/4·면담 상태, 빈 입력도 안전');
// ═════ ④ 진행 안내 · 저작권 점검 ═════
ok(L.FLOW.length === 5 && L.FLOW_TOTAL_MIN === 60 && L.FLOW.every((x) => x.title && x.say.length > 20) && L.HARD_QUESTIONS.length === 5 && L.HARD_QUESTIONS.every((x) => x.q && x.a.length > 40) && L.FEEDBACK.example.fact && L.FEEDBACK.title.includes('→'), '진행 안내: 5단계 60분, 어려운 질문 5개(동료평가 익명 질문 포함), 말하는 순서 예시');
ok(L.HARD_QUESTIONS.some((x) => x.q === '동료평가는 누가 줬나요?' && x.a.includes('익명') && x.a.includes('평균')) && L.HARD_QUESTIONS.some((x) => x.a.includes('참고자료') && x.a.includes('금액을 약속드릴 수는 없')), '★ 우리 회사 방식 반영: 동료평가는 익명·평균만, 올해 결과는 참고자료이고 연봉 금액은 약속하지 않음');
const guideText = JSON.stringify([L.FLOW, L.FEEDBACK, L.HARD_QUESTIONS, L.PREP_ITEMS, L.EV_LABELS, L.RC_LABELS, L.TONES]) + V.interviewDetailHtml({ iv: { year: 2026, d: { worker: { name: '가' }, evidence: [], rv: L.reviewFromDoc(null), self: null, ef: L.newEvidence('2026-11-04'), busy: false, today: '2026-11-04' } } });
const PDF_PHRASES = ['깜깜이 평가', '답정너', '성과 증발', '숨은 업무 누락', '기억보다 기록', '피드백 공식', '이 페이지를 면담 현장에', '완벽한 설득', '평가를 통보하지 말고', '열심히 했는데 왜 B등급', '왜 B입니까', 'A등급인데 연봉은 왜 그대로', '팀장님은 제 일을 모르시잖아요', '사전에 알려주지 않은 평가기준', '10월 제안서 초안', '검토와 고객 대응 시간이 줄었습니다', '서로 다른 의견도 함께 확인하겠습니다', '당초 기대수준', '실제 행동·성과', '업무에 미친 영향', '직원의 설명', '조직적 제약', '평가 불복', '면담 후 단절', '보상 불신', '평가자 관찰 부족', '지연 가능성을 이틀 전 공유'];
ok(PDF_PHRASES.every((p) => !guideText.includes(p)), '★ 저작권 점검: 외부 교육 자료(「무단 상업적 재배포를 삼가」)의 대표 문구·예시·칸 이름이 하나도 들어 있지 않다(' + PDF_PHRASES.length + '개 문구 대조)');
ok(!/리얼코칭|REAL COACHING|realcoaching/i.test(guideText + src('modules/eval/interview-view.js') + src('modules/eval/interview-report.js')), '외부 업체 이름·연락처를 화면·문서에 넣지 않았다');

// ═════ 화면: 목록 ═════
const wk = (o) => Object.assign({ id: 'w1', empNo: '23001', name: '윤석원', dept: 'PJT팀', rank: '과장' }, o || {});
const rows = [L.rowSummary(wk(), [{ tone: 'win' }, { tone: 'gap' }, { tone: 'extra' }], L.reviewFromDoc(doc1)), L.rowSummary(wk({ id: 'w2', empNo: '23002', name: '정다애', rank: '대리' }), [], null)];
const board = V.interviewBoardHtml({ iv: { year: 2026, rows, error: '' } });
ok(board.includes('면담 준비 · 기록 — 2026년 인사평가') && board.includes('2025-10-01') && board.includes('2026-09-30') && board.includes('사번순') && board.includes('직원에게는 공개되지 않습니다') && count(board, /data-iv-open="/g) === 2, '★ 목록: 제목·평가 기간·사번순 안내·비공개 안내, 대상자 행 2개(이름을 누르면 상세)');
ok(board.includes('성과 1 · 개선 1 · 추가 1') && board.includes('<td>2/4</td>') && board.includes('완료') && board.includes('2026-11-20') && board.includes('기록 없음') && board.includes('<td>0/4</td>') && board.includes('>없음<') && board.indexOf('윤석원') < board.indexOf('정다애'), '목록: 근거 메모 건수, 준비 n/4, 면담 상태·면담일, 순서 유지');
ok(V.interviewBoardHtml({ iv: { year: 2026, rows: [], error: '' } }).includes('2026년 평가 대상자가 없습니다') && V.interviewBoardHtml({ iv: { year: 2026, rows: [], error: '불러오지 못했습니다: 권한이 없습니다' } }).includes('role="alert"') && !V.interviewBoardHtml({ iv: { year: 2026, rows: [], error: '<b>x</b>' } }).includes('<b>x</b>'), '목록: 대상자가 없을 때 안내, 오류는 경고로(이스케이프)');
ok(V.NO_ACCESS.includes('사장단·관리자만') && V.NO_ACCESS.includes('직원에게 공개되지 않는'), '접근 불가 안내 문구');
// ═════ 화면: 상세 ═════
const evList = [{ id: 'e2', date: '2026-09-02', tone: 'win', actual: '설치 일정 단축' }, { id: 'e1', date: '2026-10-14', tone: 'gap', expected: '기한 준수', actual: '보고서가 사흘 늦음', impact: '점검 1회 연기', said: '자재 지연' }]; // 일부러 오래된 순으로 넣는다 — 화면이 최신순으로 정렬하는지 확인
const dst = (o) => ({ iv: { year: 2026, d: Object.assign({ worker: wk(), evidence: evList, rv: L.reviewFromDoc(doc1), self: { text: '[올해 성과]\n1. 설치 단축\n\n[내년 성장 목표]\n도면 교육', status: 'submitted', source: 'staff' }, ef: L.newEvidence('2026-11-04'), busy: false, today: '2026-11-04' }, o || {}) } });
const det = V.interviewDetailHtml(dst());
ok(det.includes('윤석원 · 면담 준비·기록 (2026년 인사평가)') && det.includes('PJT팀 · 과장') && det.includes('data-iv-act="back"') && det.includes('평가 기간 2025-10-01 ~ 2026-09-30') && det.includes('직원에게는 공개되지 않습니다'), '상세: 머리글(이름·연도·소속·평가 기간·비공개 안내)과 목록으로 돌아가기');
ok(count(det, /data-iv-prep="c\d"/g) === 4 && count(det, /data-iv-prep="c\d"[^>]* checked/g) === 2 && det.includes('면담 전 준비') && det.includes('>2/4<') && det.includes(L.PREP_ITEMS[0].text) && det.includes('평가 기준은 평가 시작 전에 안내한 것만 씁니다'), '★ 상세 ① 준비 체크: 4개 중 저장된 2개가 체크된 상태로 보이고 진행 2/4');
ok(det.includes('지금 근거 메모: 성과 1 · 개선 필요 1 · 추가 기여 0') && det.includes('추가 기여 0 — 추가 기여') === false && det.includes('균형이 맞습니다'), '준비 체크의 근거 메모 줄: 건수와 균형 안내(성과·개선 필요가 모두 있어 「균형이 맞습니다」)');
ok(V.interviewDetailHtml(dst({ evidence: [] })).includes('아직 근거 메모가 없습니다. 면담 전에') && V.interviewDetailHtml(dst({ evidence: [evList[0]] })).includes('개선 필요 기록이 없습니다'), '준비 체크의 균형 안내: 메모가 없으면 / 한쪽뿐이면 안내');
ok(det.includes('직원 자기평가') && det.includes('제출 완료') && det.includes('<b>올해 성과</b><br>1. 설치 단축') && det.includes('<b>내년 성장 목표</b><br>도면 교육') && det.includes('직원이 직접 쓴 자기평가입니다') && det.includes('점수에는 반영되지 않고'), '★ 상세: 직원 자기평가를 구역별로 구분해 보여 준다(제출 완료·직접 작성 표시)');
ok(V.interviewDetailHtml(dst({ self: { text: '대신 입력 글', status: 'submitted', source: 'admin' } })).includes('사장단이 대신 입력한 자기평가입니다') && V.interviewDetailHtml(dst({ self: { text: '쓰는 중', status: 'draft', source: 'staff' } })).includes('임시저장') && V.interviewDetailHtml(dst({ self: null })).includes('아직 자기평가가 없습니다') && V.interviewDetailHtml(dst({ self: { text: '   ', status: 'draft', source: 'staff' } })).includes('아직 자기평가가 없습니다'), '자기평가: 사장단 대신 입력 / 임시저장 / 없음·빈 글 표시');
ok(!V.interviewDetailHtml(dst({ self: { text: '<script>alert(1)</script>', status: 'submitted', source: 'staff' } })).includes('<script>alert'), '자기평가 표시는 이스케이프');
ok(det.includes('평가 근거 메모') && det.includes('성과 1 · 개선 1 · 추가 0') && count(det, /data-iv-ev-del="/g) === 2 && det.indexOf('2026-10-14') < det.indexOf('2026-09-02') && det.includes(L.EV_LABELS.expected) && det.includes('보고서가 사흘 늦음') && det.includes('자재 지연') && det.includes('aria-label="2026-10-14 근거 메모 삭제"'), '★ 상세 ② 근거 메모: 최신순 목록, 칸 이름·내용, 건별 삭제 단추(접근성 이름 포함)');
ok(count(det, /data-iv-tone="/g) === 3 && /data-iv-tone="win"[^>]*aria-pressed="true"/.test(det) && /data-iv-tone="gap"[^>]*aria-pressed="false"/.test(det) && /data-iv-ef="date"[^>]*max="2026-11-04"[^>]*value="2026-11-04"/.test(det) && count(det, /<textarea[^>]*data-iv-ef="/g) === 4 && det.includes('data-iv-act="ev-add"'), '근거 메모 입력: 구분 단추 3개(기본 성과), 날짜(오늘 이전), 칸 4개, 추가 단추');
ok(V.interviewDetailHtml(dst({ ef: Object.assign(L.newEvidence('2026-11-04'), { tone: 'extra', actual: '"따옴표" <태그>' }) })).includes('&quot;따옴표&quot; &lt;태그&gt;') && /data-iv-tone="extra"[^>]*aria-pressed="true"/.test(V.interviewDetailHtml(dst({ ef: Object.assign(L.newEvidence('2026-11-04'), { tone: 'extra' }) }))), '근거 메모 입력 값은 이스케이프, 선택한 구분이 눌린 상태');
ok(V.interviewDetailHtml(dst({ busy: true })).includes('data-iv-act="ev-add" disabled') || /data-iv-act="ev-add"[^>]*disabled/.test(V.interviewDetailHtml(dst({ busy: true }))), '저장 중에는 추가 단추가 잠긴다(중복 저장 방지)');
ok(det.includes('면담 진행 안내 · 60분') && det.includes('<details class="jh-iv-guide">') && L.FLOW.every((x) => det.includes(x.title)) && det.includes(L.FEEDBACK.title) && L.HARD_QUESTIONS.every((x) => det.includes(x.q)) && det.includes('연봉 금액을 약속하지 않습니다'), '★ 상세 면담 진행 안내: 접고 펼치는 안내에 진행 순서 5단계·말하는 순서·어려운 질문 5개');
ok(det.includes('면담 기록 · 실행 합의') && det.includes('data-iv-rf="date"') && det.includes('value="2026-11-20"') && det.includes('value="송지훈"') && det.includes('도면 교육 수강') && det.includes('data-iv-rf="checkDate"') && count(det, /data-iv-rf="/g) === 8, '★ 상세 ③ 면담 기록: 8개 칸(면담일·면담자·성과 요약·시작할 행동·확인 방법·도움·중간 확인일·이견), 저장된 값 표시');
ok(det.includes('data-iv-act="rv-done"') && det.includes('수정 저장') && det.includes('data-iv-act="rv-reopen"') && !det.includes('data-iv-act="rv-save"') && det.includes('data-iv-act="rv-print"') && det.includes('>완료<'), '면담 기록(완료 상태): 수정 저장·완료 취소·인쇄 단추, 임시저장 단추는 없다');
const draftDet = V.interviewDetailHtml(dst({ rv: L.reviewFromDoc({ status: 'draft', record: { employeeAction: 'x' } }) }));
ok(draftDet.includes('data-iv-act="rv-save"') && draftDet.includes('data-iv-act="rv-done"') && draftDet.includes('완료 처리') && !draftDet.includes('data-iv-act="rv-reopen"') && draftDet.includes('작성 중') && draftDet.includes('완료할 때 필수'), '면담 기록(작성 중): 임시저장·완료 처리·인쇄 단추, 필수 칸에 「완료할 때 필수」 안내');
ok(V.interviewDetailHtml(dst({ rv: L.reviewFromDoc(null) })).includes('기록 없음') && V.interviewDetailHtml(dst({ rv: L.reviewFromDoc({ status: 'draft', record: { summary: '"<i>x</i>"' } }) })).includes('&quot;&lt;i&gt;x&lt;/i&gt;&quot;'), '면담 기록: 저장 전에는 「기록 없음」, 값은 이스케이프');

// ═════ 인쇄 문서 ═════
const pd = { year: 2026, worker: { name: '윤석원', dept: 'PJT팀', rank: '과장' }, record: Object.assign({}, fullRec, { summary: '<script>x</script>' }), status: 'done' };
const ph = R.reviewHtml(pd);
ok(R.reviewPrintTitle(pd) === '인사평가 면담 기록서 - 윤석원 - 2026' && R.REVIEW_TITLE === '인사평가 면담 기록서' && R.reviewPrintTitle(null) === '인사평가 면담 기록서', '인쇄 문서 이름: 종류 - 이름 - 평가 연도(점수·직급 없음)');
ok(ph.includes('<title>인사평가 면담 기록서 - 윤석원 - 2026</title>') && ph.includes('2026-11-20') && ph.includes('2026-12-20') && ph.includes('도면 교육 수강') && ph.includes('교육비 지원') && ph.includes('PJT팀 · 과장') && ph.includes('직원 확인 (서명)') && ph.includes('면담자 확인 (서명)') && ph.includes('연봉 결정을 약속하는 문서가 아닙니다'), '★ 인쇄 문서: 면담 정보·합의 내용·서명란 두 곳·점수와 연봉을 약속하지 않는다는 안내');
ok(!ph.includes('<script>x') && ph.includes('&lt;script&gt;x&lt;/script&gt;') && R.reviewHtml(null).includes('—') && R.reviewHtml({ worker: null, record: null }).startsWith('<!doctype html>') && ph.includes('<div class="box">—</div>'), '인쇄 문서: 입력은 이스케이프, 빈 칸은 「—」, 빈 입력도 오류 없이');
// ═════ 컨트롤러(가짜 Firestore) ═════
const fs0 = () => { const data = {}; const calls = []; let seq = 0; const failOn = new Set(); const chk = (k) => { if (failOn.has(k)) throw Object.assign(new Error('denied'), { code: 'permission-denied' }); };
  const x = { db: {}, collection: (db, path) => ({ kind: 'col', path }), doc: (db, path) => ({ kind: 'doc', path }), query: (col, ...wh) => ({ kind: 'query', col, wh }), where: (f, op, v) => ({ f, op, v }), serverTimestamp: () => '<ts>',
    getDocs: async (ref) => { chk('read'); const col = ref.kind === 'query' ? ref.col : ref; const wh = ref.kind === 'query' ? ref.wh : []; const pre = col.path + '/'; const out = Object.keys(data).filter((p) => p.startsWith(pre) && !p.slice(pre.length).includes('/')).map((p) => ({ id: p.slice(pre.length), data: () => data[p] })).filter((d) => wh.every((w) => d.data()[w.f] === w.v)); return { forEach: (fn) => out.forEach(fn), docs: out, size: out.length }; },
    getDoc: async (ref) => { chk('read'); return { id: ref.path.split('/').pop(), exists: () => ref.path in data, data: () => data[ref.path] }; },
    setDoc: async (ref, d, o) => { chk('write'); calls.push(['set', ref.path, JSON.parse(JSON.stringify(d)), o || null]); data[ref.path] = o && o.merge ? Object.assign({}, data[ref.path] || {}, d) : Object.assign({}, d); },
    addDoc: async (col, d) => { chk('write'); const id = 'a' + (++seq); data[col.path + '/' + id] = Object.assign({}, d); calls.push(['add', col.path, JSON.parse(JSON.stringify(d))]); return { id }; },
    deleteDoc: async (ref) => { chk('write'); calls.push(['del', ref.path]); delete data[ref.path]; } };
  return { data, calls, x, failOn }; };
class El extends Element { constructor(attrs, props, parent) { super(); this.attrs = attrs || {}; Object.assign(this, props || {}); this.parent = parent || null; } getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; } matches(sel) { return sel.split(',').map((s) => s.trim()).some((s) => { const m = /^\[([\w-]+)\]$/.exec(s); return !!m && m[1] in this.attrs; }); } closest(sel) { let n = this; while (n) { if (n.matches(sel)) return n; n = n.parent; } return null; } }
const mk = (setup, o) => { const f = fs0(); const toasts = []; const painted = { n: 0 }; const st = {}; const wins = []; let confirmOk = true;
  const W = (id, empNo, name, rank, extra) => { f.data['workers/' + id] = Object.assign({ empNo, name, rank, dept: 'PJT팀', hireDate: '2020-03-01' }, extra || {}); };
  W('w3', '26001', '이한영', '사원'); W('w1', '23001', '윤석원', '과장'); W('w2', '23002', '정다애', '대리'); W('w9', '00000', '송지훈', '대표'); W('w7', '26003', '형일우', '사원', { status: 'resigned' }); W('w8', '26009', '신규', '사원', { hireDate: '2026-10-15' }); W('w6', '26005', '', '사원');
  if (setup) setup(f);
  const win = { document: { write: (h) => wins.push(h), close() {} } };
  const c = C.createInterviewController(Object.assign({ db: f.x.db, collection: f.x.collection, getDocs: f.x.getDocs, getDoc: f.x.getDoc, setDoc: f.x.setDoc, addDoc: f.x.addDoc, deleteDoc: f.x.deleteDoc, doc: f.x.doc, query: f.x.query, where: f.x.where, serverTimestamp: f.x.serverTimestamp, toast: (m) => toasts.push(m), confirmDialog: async () => ({ ok: confirmOk }), paint: () => { painted.n++; }, st, ctx: { me: { uid: 'U1', name: '김종화', admin: true, rank: '부사장' } }, year: 2026, today: '2026-11-20', openWindow: () => (o && o.noWin ? null : win) }, o || {}));
  return { f, c, st, toasts, painted, wins, setConfirm: (v) => { confirmOk = v; } }; };
{ // 불러오기: 평가 대상자만, 사번순
  const t = mk((f) => { f.data['interviews/w1/evidence/e1'] = { evalYear: 2026, date: '2026-10-14', tone: 'gap', actual: 'a' }; f.data['interviews/w1/evidence/e0'] = { evalYear: 2025, date: '2025-01-01', tone: 'win', actual: 'old' }; f.data['interviews/w1/review/2026'] = { status: 'done', prep: { c1: true }, record: { date: '2026-11-18', checkDate: '2026-12-18' } }; });
  await t.c.load();
  ok(t.st.iv.rows.map((r) => r.name).join() === '윤석원,정다애,이한영' && t.st.iv.loaded && t.st.iv.rows.length === 3, '★ 불러오기: 평가 대상자만(대표·퇴사자·평가 기간 뒤 입사자·이름 없음 제외), 사번순');
  const r1 = t.st.iv.rows[0]; ok(r1.ev.total === 1 && r1.ev.gap === 1 && r1.prep.done === 1 && r1.status === 'done' && r1.date === '2026-11-18' && t.st.iv.rows[1].status === 'none', '불러오기: 다른 해의 근거 메모는 세지 않고, 면담 상태·준비 진행을 요약');
  ok(t.st.iv.year === 2026 && t.st.iv.today === '2026-11-20' && t.st.iv.sel === '' && t.st.iv.d === null, '시작 상태: 목록, 선택 없음');
}
{ // 열기: 근거·면담·자기평가
  const t = mk((f) => { f.data['interviews/w1/evidence/e1'] = { evalYear: 2026, date: '2026-10-14', tone: 'gap', actual: '늦음', createdAt: { toMillis: () => 5 } }; f.data['eval_submissions/2026__UX__w1__self'] = { year: 2026, kind: 'self', targetWid: 'w1', text: '[올해 성과]\n1. 성과', status: 'submitted' }; f.data['eval_submissions/2026__UX__w2__self'] = { year: 2026, kind: 'self', targetWid: 'w2', text: '임시 글', status: 'draft' }; f.data['evaluations/w3/cycles/2026'] = { self: { text: '대신 입력한 글' } }; f.data['eval_submissions/2025__UX__w1__self'] = { year: 2025, kind: 'self', targetWid: 'w1', text: '작년 글', status: 'submitted' }; });
  await t.c.load(); await t.c.open('w1');
  ok(t.st.iv.sel === 'w1' && t.st.iv.d.worker.name === '윤석원' && t.st.iv.d.evidence.length === 1 && t.st.iv.d.evidence[0].createdMs === 5 && t.st.iv.d.rv.exists === false && t.st.iv.d.self?.text.includes('성과') && t.st.iv.d.self?.status === 'submitted' && t.st.iv.d.self?.source === 'staff' && t.st.iv.d.ef.date === '2026-11-20' && t.painted.n >= 1, '★ 열기: 근거 메모·면담 기록·자기평가(작년 것이 아니라 올해 제출)를 읽고 입력 틀은 오늘 날짜로');
  await t.c.open('w2'); ok(t.st.iv.d.self?.status === 'draft' && t.st.iv.d.self?.source === 'staff', '자기평가: 임시저장도 보인다(임시저장 표시)');
  await t.c.open('w3'); ok(t.st.iv.d.self?.text === '대신 입력한 글' && t.st.iv.d.self?.source === 'admin' && t.st.iv.d.self?.status === 'submitted', '★ 자기평가: 제출이 없으면 사장단이 대신 입력해 둔 값(evaluations/…/cycles/2026.self)을 보여 준다');
  await t.c.open('w9'); ok(t.st.iv.sel === 'w3', '대상자가 아닌 사람은 열리지 않는다(선택 유지)');
}
{ // 근거 메모 추가·삭제
  const t = mk(); await t.c.load(); await t.c.open('w1'); const d = () => t.st.iv.d;
  d().ef.actual = ''; await t.c.onClick({ target: new El({ 'data-iv-act': 'ev-add' }) });
  ok(t.f.calls.filter((x) => x[0] === 'add').length === 0 && t.toasts.pop() === L.EV_LABELS.actual + '을(를) 입력해 주세요.', '근거 메모: 필수 칸이 비면 저장하지 않고 안내');
  d().ef = Object.assign(L.newEvidence('2026-11-20'), { date: '2026-10-14', tone: 'gap', actual: '보고서 사흘 지연', impact: '점검 연기' });
  await t.c.onClick({ target: new El({ 'data-iv-act': 'ev-add' }) });
  const add = t.f.calls.find((x) => x[0] === 'add'); ok(!!add && add[1] === 'interviews/w1/evidence' && add[2].tone === 'gap' && add[2].evalYear === 2026 && add[2].actual === '보고서 사흘 지연' && add[2].createdBy === 'U1' && add[2].createdByName === '김종화' && add[2].createdAt === '<ts>', '★ 근거 메모 추가: interviews/w1/evidence 에 저장(평가 연도·구분·작성자·시각)');
  ok(d().evidence.length === 1 && d().ef.actual === '' && d().ef.date === '2026-10-14' && d().ef.tone === 'gap' && t.toasts.pop() === '근거 메모를 추가했습니다.' && d().busy === false, '추가 뒤: 목록 갱신, 입력 칸은 비우되 날짜·구분은 유지(같은 날 연달아 적기 편하게), 저장 중 표시 해제');
  const id = d().evidence[0].id; t.setConfirm(false); await t.c.onClick({ target: new El({ 'data-iv-ev-del': id }) }); ok(t.f.calls.filter((x) => x[0] === 'del').length === 0 && d().evidence.length === 1, '삭제: 확인에서 취소하면 지우지 않는다');
  t.setConfirm(true); await t.c.onClick({ target: new El({ 'data-iv-ev-del': id }) }); ok(t.f.calls.some((x) => x[0] === 'del' && x[1] === 'interviews/w1/evidence/' + id) && d().evidence.length === 0 && t.toasts.pop() === '삭제했습니다.', '삭제: 확인하면 그 건만 지우고 목록 갱신');
  t.f.failOn.add('write'); d().ef = Object.assign(L.newEvidence('2026-11-20'), { actual: '실패 시험' }); await t.c.onClick({ target: new El({ 'data-iv-act': 'ev-add' }) });
  ok(t.toasts.pop()?.includes('저장하지 못했습니다') && d().busy === false && d().evidence.length === 0, '★ 저장 실패(권한 없음 등): 저장된 것처럼 보이지 않고 알리며 저장 중 표시가 풀린다');
}
{ // 면담 기록 저장·완료·완료 취소
  const t = mk(); await t.c.load(); await t.c.open('w1'); const d = () => t.st.iv.d;
  Object.assign(d().rv.record, { employeeAction: '도면 교육 수강' });
  await t.c.onClick({ target: new El({ 'data-iv-act': 'rv-save' }) });
  const s1 = t.f.calls.find((x) => x[0] === 'set' && x[1] === 'interviews/w1/review/2026'); ok(!!s1 && s1[2].status === 'draft' && s1[2].record.employeeAction === '도면 교육 수강' && s1[2].evalYear === 2026 && s1[2].updatedBy === 'U1' && s1[2].updatedByName === '김종화' && !('doneAt' in s1[2]) && !t.f.calls.some((x) => x[1] === 'interviews/w1/records/eval-2026') && d().rv.exists && t.toasts.pop() === '임시저장했습니다.', '★ 임시저장: review/2026 에만 저장(작성자·시각), 인사 면담 이력은 만들지 않는다');
  await t.c.onClick({ target: new El({ 'data-iv-act': 'rv-done' }) }); ok(t.toasts.pop() === '면담일을 입력해 주세요.' && d().rv.status === 'draft', '완료 처리: 필수 칸이 비면 완료되지 않고 첫 안내를 보여 준다');
  Object.assign(d().rv.record, { date: '2026-11-18', checkDate: '2026-12-18', disagreement: '점수에 이견' });
  await t.c.onClick({ target: new El({ 'data-iv-act': 'rv-done' }) });
  const done = t.f.calls.filter((x) => x[0] === 'set' && x[1] === 'interviews/w1/review/2026').pop(); const hr = t.f.calls.find((x) => x[1] === 'interviews/w1/records/eval-2026');
  ok(done[2].status === 'done' && done[2].doneAt === '<ts>' && d().rv.status === 'done' && !!hr && hr[2].followUp === true && hr[2].source === 'eval' && hr[2].date === '2026-11-18' && hr[2].memo.startsWith('[인사평가 2026 면담]') && hr[2].createdByName === '김종화' && t.toasts.pop()?.includes('인사 면담 이력에도 남았습니다'), '★ 완료 처리: 면담 기록을 done 으로 저장하고, 인사 면담 이력(records/eval-2026)에 후속 조치 표시와 함께 한 건을 남긴다');
  await t.c.onClick({ target: new El({ 'data-iv-act': 'rv-done' }) }); ok(t.f.calls.filter((x) => x[1] === 'interviews/w1/records/eval-2026').length === 2 && Object.keys(t.f.data).filter((p) => p.startsWith('interviews/w1/records/')).length === 1, '수정 저장: 같은 문서 id 라서 인사 이력은 계속 한 건(중복 안 쌓임)');
  t.setConfirm(false); await t.c.onClick({ target: new El({ 'data-iv-act': 'rv-reopen' }) }); ok(d().rv.status === 'done' && 'interviews/w1/records/eval-2026' in t.f.data, '완료 취소: 확인에서 취소하면 아무것도 바뀌지 않는다');
  t.setConfirm(true); await t.c.onClick({ target: new El({ 'data-iv-act': 'rv-reopen' }) }); const re = t.f.calls.filter((x) => x[0] === 'set' && x[1] === 'interviews/w1/review/2026').pop();
  ok(d().rv.status === 'draft' && re[2].status === 'draft' && !('doneAt' in re[2]) && !('interviews/w1/records/eval-2026' in t.f.data) && t.toasts.pop() === '완료를 취소했습니다.', '★ 완료 취소: 작성 중으로 되돌리고 인사 면담 이력의 그 한 건도 지운다');
  t.f.failOn.add('write'); await t.c.onClick({ target: new El({ 'data-iv-act': 'rv-save' }) }); ok(t.toasts.pop()?.includes('저장하지 못했습니다') && d().busy === false, '면담 기록 저장 실패: 알리고 저장 중 표시 해제');
}
{ // 준비 체크 저장
  const t = mk(); await t.c.load(); await t.c.open('w2');
  await t.c.onChange({ target: new El({ 'data-iv-prep': 'c2' }, { checked: true }) });
  const p1 = t.f.calls.find((x) => x[1] === 'interviews/w2/review/2026'); ok(p1[2].prep.c2 === true && p1[2].prep.c1 === false && p1[2].status === 'draft' && p1[3] && p1[3].merge === true && t.st.iv.d.rv.prep.c2 && t.st.iv.d.rv.exists, '★ 준비 체크: 누르면 바로 저장(병합 저장이라 이미 쓴 면담 기록은 건드리지 않는다)');
  await t.c.onChange({ target: new El({ 'data-iv-prep': 'c2' }, { checked: false }) }); ok(t.st.iv.d.rv.prep.c2 === false && t.f.data['interviews/w2/review/2026'].prep.c2 === false, '체크를 풀면 저장도 풀린다');
  const t2 = mk(); await t2.c.load(); await t2.c.open('w1'); Object.assign(t2.st.iv.d.rv.record, { employeeAction: '행동', date: '2026-11-18', checkDate: '2026-12-18' }); await t2.c.onClick({ target: new El({ 'data-iv-act': 'rv-done' }) }); await t2.c.onChange({ target: new El({ 'data-iv-prep': 'c1' }, { checked: true }) });
  const doc = t2.f.data['interviews/w1/review/2026']; ok(doc.status === 'done' && doc.record.employeeAction === '행동' && doc.prep.c1 === true, '완료한 뒤 준비 체크를 바꿔도 완료 상태와 기록이 그대로');
}
{ // 입력 처리·화면 전환
  const t = mk(); await t.c.load(); await t.c.open('w1'); const d = () => t.st.iv.d; const form = new El({});
  ok(t.c.onInput({ target: new El({ 'data-iv-ef': 'actual' }, { value: '메모 내용' }, form) }) === true && d().ef.actual === '메모 내용' && t.c.onInput({ target: new El({ 'data-iv-rf': 'summary' }, { value: '요약' }, form) }) === true && d().rv.record.summary === '요약' && t.c.onInput({ target: new El({ 'data-x': '1' }, { value: 'x' }) }) === false, '입력 처리: 근거 메모·면담 기록 칸이 상태에 반영되고(다시 그리지 않음), 다른 칸은 무시');
  const painted = t.painted.n; await t.c.onClick({ target: new El({ 'data-iv-tone': 'extra' }) }); ok(d().ef.tone === 'extra' && t.painted.n === painted + 1 && d().ef.actual === '메모 내용', '구분 단추: 선택이 바뀌고 쓰던 내용은 유지');
  await t.c.onClick({ target: new El({ 'data-iv-act': 'back' }) }); ok(t.st.iv.sel === '' && t.st.iv.d === null && t.st.iv.rows[0].id === 'w1', '목록으로: 상세를 닫고 목록 행을 갱신');
  ok(await t.c.onClick({ target: new El({ 'data-zzz': '1' }) }) === false && (await t.c.onClick({ target: {} })) === false, '관계없는 클릭은 처리하지 않는다');
}
{ // 인쇄
  const t = mk(); await t.c.load(); await t.c.open('w1'); Object.assign(t.st.iv.d.rv.record, { employeeAction: '도면 교육', date: '2026-11-18' });
  await t.c.onClick({ target: new El({ 'data-iv-act': 'rv-print' }) }); ok(t.wins.length === 1 && t.wins[0].includes('<title>인사평가 면담 기록서 - 윤석원 - 2026</title>') && t.wins[0].includes('도면 교육') && t.wins[0].includes('window.print()'), '★ 인쇄: 새 창에 면담 기록서를 쓰고 문서 이름이 붙은 채 인쇄 스크립트를 실행한다');
  const t3 = mk(null, { noWin: true }); await t3.c.load(); await t3.c.open('w1'); await t3.c.onClick({ target: new El({ 'data-iv-act': 'rv-print' }) }); ok(t3.toasts.pop()?.includes('팝업이 차단되었습니다'), '인쇄: 팝업이 막히면 안내');
}
{ // 읽기 권한 오류
  const t = mk(); t.f.failOn.add('read'); try { await t.c.load(); } catch (e) { t.st.iv.error = String(e.message); } ok(!!t.st.iv.error || t.st.iv.rows.length === 0, '읽기 권한이 없으면 목록이 비고 오류가 남는다(데이터를 보여 주지 않음)');
}
// ═════ 접근 권한과 연결 ═════
ok(P.isInterviewUser(U({ admin: true })) && P.isInterviewUser(U({ rank: '대표', admin: true })) && P.isInterviewUser(U({ rank: '부사장', admin: true })) && !P.isInterviewUser(U({ rank: '대표' })) && !P.isInterviewUser(U({ perms: { hrEval: true } })) && !P.isInterviewUser(U()) && !P.isInterviewUser(U({ admin: true, isGuest: true })) && !P.isInterviewUser(null) && !P.isInterviewUser(U({ admin: 'true' })), '★ 면담 화면 접근: 평가 운영 권한 + 관리자 계정(대표·부사장도 관리자 계정이어야 함). 관리자가 아닌 사장단 직급·인사평가 권한자·일반 직원·GUEST·로그인 없음은 못 연다');
const LL = await import('../app/modules/legacy/list.js?v=' + VER); const def = LL.LEGACY_DEFS.find((d) => d.id === 'eval');
const labels = (cfg) => (cfg.sections || []).flatMap((x) => (x.items || []).map((i) => i.label)); const seen = (me) => (def.perm(me) ? labels(LL.sideConfig(def, 'mine', null, me, null)) : null);
ok(seen(U({ uid: 'a', admin: true, rank: '대리' })).includes('면담 준비·기록') && seen(U({ uid: 'c', rank: '대표', admin: true })).includes('면담 준비·기록'), '★ 메뉴: 관리자·사장단(관리자 계정)에게는 「면담 준비·기록」이 보인다');
ok(!seen(U({ uid: 'h', perms: { hrEval: true } })).includes('면담 준비·기록') && !seen(U({ uid: 'k' })).includes('면담 준비·기록') && JSON.stringify(seen(U({ uid: 'k' }))) === '["내 평가"]' && !seen(U({ uid: 'x', rank: '대표' })).includes('면담 준비·기록'), '★ 메뉴: 인사평가 권한만 있는 사람·일반 직원·관리자가 아닌 직급자에게는 면담 메뉴가 없다(일반 직원은 「내 평가」만)');
ok(seen(U({ uid: 'a', admin: true })).includes('정기평가') && seen(U({ uid: 'h', perms: { hrEval: true } })).includes('정기평가') && seen(U({ uid: 'h', perms: { hrEval: true } })).includes('평가 결과 통보'), '기존 평가 운영 메뉴는 그대로(인사평가 권한자도 정기평가·결과 통보를 본다)');
const idx = src('modules/eval/index.js'), mods = src('modules/index.js'), iv = src('modules/eval/interview.js');
ok(idx.includes("if (key === 'interview') return mountInterview(root, ctx);") && idx.includes("import { mountInterview } from './interview.js") && /\['mine', 'cycle', 'adhoc', 'result', 'interview'\]\.forEach\(\(k\) => hostNative\('eval', k,/.test(mods), '연결: 평가 모듈이 interview 경로를 면담 화면으로 열고, 모듈 등록에도 interview 가 들어 있다');
ok(iv.includes("export const canOpenInterview = isInterviewUser;") && iv.includes('if (!canOpenInterview(me)) { root.innerHTML = NO_ACCESS; return; }') && iv.indexOf('canOpenInterview(me)') < iv.indexOf('createInterviewController('), '★ 화면 보호: 권한이 없으면 데이터를 읽기 전에 막는다(실제 보호는 관리자 전용 규칙, 화면은 안내)');
ok(!/updateDoc|evaluations\/\' \+ wid \+ '\/cycles\/' \+ year, \{/.test(src('modules/eval/interview-io.js')) && !/setDoc\(doc\(db, 'eval_/.test(src('modules/eval/interview-io.js')), '면담 도구는 평가 점수·회차·제출 문서에 쓰지 않는다(읽기만) — 평가 점수 체계는 건드리지 않았다');
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); process.exit(fail ? 1 : 0);
