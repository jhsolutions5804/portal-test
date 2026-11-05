import { deployHtml } from '../app/modules/deploy/view.js';
import { deployStatus, deployWhen, DEPLOY_STATUS } from '../app/shared/deploy-fmt.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const TERMS = { version: 'v1', draft: true, title: '프로젝트 투입 확인서', intro: '본인은 아래 사업에 투입됨을 확인하고 동의합니다.', rows: [{ label: '제공받는 자', text: '이 사업의 발주처와 시공사' }, { label: '제공 항목', text: '성명, 사진 <제외: 주민등록번호>' }], agree: '투입을 확인하고 제공에 동의합니다', decline: '동의하지 않습니다 (이 사업 투입 제외)' };
const IT = (o) => Object.assign({ pjtId: 'p1', name: 'P4 Ph2 (FAB)', client: '발주처갑', contractor: '시공사을', site: '평택', from: '2026-10-05', role: '품질', status: 'pending', at: '', version: '', ended: false, canDecide: true }, o || {});
const S = (items, o) => Object.assign({ loading: false, error: '', data: { linked: true, items, terms: TERMS }, busy: '' }, o || {});
const cnt = (h, re) => (h.match(re) || []).length;
// ── 공용 표시
ok(deployStatus('agreed').label === '동의' && deployStatus('declined').label === '동의 안 함' && deployStatus('withdrawn').label === '철회' && deployStatus('pending').label === '확인 대기' && deployStatus('weird') === DEPLOY_STATUS.pending && deployStatus(undefined) === DEPLOY_STATUS.pending, '상태 이름: 확인 대기·동의·동의 안 함·철회, 모르는 값은 확인 대기');
ok(deployWhen('2026-11-05T01:30:00.000Z') === '2026-11-05 10:30' && deployWhen('2026-11-05T16:00:00.000Z') === '2026-11-06 01:00' && deployWhen('') === '' && deployWhen('abc') === '' && deployWhen(null) === '', '시각: 한국 시각(+9시간)으로 「날짜 시:분」, 날짜가 넘어가는 경우도 맞음, 이상한 값은 빈 문자열');
// ── 화면 상태
ok(deployHtml({ loading: true }).includes('aria-busy="true"') && deployHtml({ error: '서버 <b>오류</b>' }).includes('role="alert"') && deployHtml({ error: '서버 <b>오류</b>' }).includes('서버 &lt;b&gt;오류&lt;/b&gt;') && deployHtml({ data: null }).includes('불러오지 못했습니다') && !deployHtml(undefined).includes('undefined'), '읽는 중·오류(이스케이프)·자료 없음');
const nl = deployHtml({ data: { linked: false, reason: 'worker', items: [], terms: TERMS } }); const nm = deployHtml({ data: { linked: false, reason: 'master', items: [], terms: TERMS } });
ok(nl.includes('계정과 연결된 직원 정보가 없습니다') && nm.includes('연명부와 연결되지 않아') && !nl.includes('data-dp-act') && !nm.includes('data-dp-act') && deployHtml(S([])).includes('확인할 투입 건이 없습니다'), '연결 안 된 계정·연명부 미연결·투입 건 없음 안내(단추 없음)');
// ── 대기 건
const p = deployHtml(S([IT()]));
ok(p.includes('P4 Ph2 (FAB)') && p.includes('발주처갑') && p.includes('시공사을') && p.includes('평택') && p.includes('2026-10-05') && p.includes('품질') && p.includes('>확인 대기<') && p.includes('확인이 필요한 투입 건이 1건 있습니다'), '대기 건: 사업 정보(발주처·시공사·현장·시작일·역할)와 대기 칩, 확인 필요 안내');
ok(p.includes('data-dp-act="agree"') && p.includes('data-dp-act="decline"') && !p.includes('data-dp-act="withdraw"') && p.includes('data-pjt="p1"') && p.includes('투입을 확인하고 제공에 동의합니다') && p.includes('동의하지 않습니다 (이 사업 투입 제외)') && p.includes('data-dp-version="v1"') && /<details class="dp-terms" open>/.test(p), '대기 건: 동의·동의 안 함 단추(문구는 서버가 준 것), 프로젝트 id·문구 버전 전달, 확인서가 펼쳐져 있음');
ok(p.includes('제공받는 자') && p.includes('이 사업의 발주처와 시공사') && p.includes('성명, 사진 &lt;제외: 주민등록번호&gt;') && !p.includes('<제외: 주민등록번호>') && p.includes('시험용 문구입니다(노무사 확인 전)') && p.includes('role="alert"'), '확인서 문구는 서버가 보낸 그대로(이스케이프), 시험용 문구면 안내를 띄움');
ok(!deployHtml(S([IT()], { data: { linked: true, items: [IT()], terms: Object.assign({}, TERMS, { draft: false }) } })).includes('시험용 문구입니다'), '확정 문구(draft=false)면 시험용 안내가 없음');
// ── 응답한 건
const ag = deployHtml(S([IT({ status: 'agreed', at: '2026-11-05T01:30:00.000Z' })])); const dc = deployHtml(S([IT({ status: 'declined', at: '2026-11-05T02:00:00.000Z' })])); const wd = deployHtml(S([IT({ status: 'withdrawn', at: '2026-11-05T03:00:00.000Z' })]));
ok(ag.includes('>동의<') && ag.includes('동의 · 2026-11-05 10:30') && ag.includes('data-dp-act="withdraw"') && !ag.includes('data-dp-act="agree"') && !ag.includes('data-dp-act="decline"') && !/<details class="dp-terms" open>/.test(ag) && !ag.includes('확인이 필요한 투입 건'), '동의한 건: 응답 일시, 철회 단추만, 확인서는 접혀 있고 대기 안내 없음');
ok(dc.includes('동의 안 함 · 2026-11-05 11:00') && dc.includes('data-dp-act="agree"') && dc.includes('data-dp-act="decline"') && dc.includes('동의하지 않은 사업에는 투입되지 않습니다') && wd.includes('철회 · 2026-11-05 12:00') && wd.includes('철회했습니다') && wd.includes('data-dp-act="agree"'), '동의 안 함·철회한 건: 응답 일시, 다시 선택할 수 있는 단추와 안내');
// ── 끝난·빠진 프로젝트, 처리 중, 이스케이프
const ended = deployHtml(S([IT({ status: 'agreed', at: '2026-08-01T00:00:00.000Z', ended: true, canDecide: false }), IT({ pjtId: 'p9', name: '빠진 현장', removed: true, status: 'declined', canDecide: false, ended: true })]));
ok(!ended.includes('data-dp-act') && ended.includes('끝난 프로젝트입니다') && ended.includes('투입 명단에서 빠진 프로젝트입니다') && ended.includes('기록은 그대로 보관됩니다'), '끝난·명단에서 빠진 프로젝트: 단추 없이 기록만 보여 줌');
const busy = deployHtml(S([IT()], { busy: 'p1' })); ok(cnt(busy, /data-dp-act="[a-z]+"[^>]*disabled/g) === 2, '처리 중에는 단추가 잠김');
const evil = deployHtml(S([IT({ pjtId: '"><script>1</script>', name: '<img src=x onerror=1>', client: '<b>', contractor: '<i>', site: '<u>', role: '<s>' })])); ok(!/<script>1/.test(evil) && !evil.includes('<img src=x') && !evil.includes('<b>') && !evil.includes('<u>') && evil.includes('&lt;img src=x onerror=1&gt;') && evil.includes('data-pjt="&quot;&gt;&lt;script&gt;'), '프로젝트 이름·업체·역할·id 의 HTML·따옴표를 막음');
const many = deployHtml(S([IT({ pjtId: 'a', status: 'agreed' }), IT({ pjtId: 'b' }), IT({ pjtId: 'c' })])); ok(cnt(many, /data-dp-item=/g) === 3 && many.includes('확인이 필요한 투입 건이 2건 있습니다'), '여러 건: 카드마다 한 건, 대기 건수 집계');
ok(!p.includes('workerId') && !p.includes('data-worker') , '화면은 직원 id 를 어디에도 싣지 않음(서버가 로그인 계정으로 찾음)');
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); if (fail) process.exit(1);
