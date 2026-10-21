import fs from 'node:fs';
import fs0 from 'node:fs';
const VER = (fs0.readFileSync(new URL('../app/modules/plan/projects.js', import.meta.url), 'utf8').match(/pjt-summary\.js\?v=([0-9a-z]+)/) || [])[1];   // 서비스 코드가 쓰는 버전 주소와 똑같이
const { pjtMargin, pjtSummary } = await import('../app/shared/pjt-summary.js?v=' + VER);
import { projNew, projToForm, projectBuild, pjtMargin as pjtMarginViaPlan } from '../app/modules/plan/projects.js';
import { marginHtml, marginExtraOf } from '../app/modules/plan/projects-view.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
// ── 마진율 계산(공용: 영업기획과 인사평가가 같은 함수)
const pm = (a, b) => { const r = pjtMargin(a, b); return { target: r.target, actual: r.actual, diff: r.diff }; };
ok(JSON.stringify(pm({ billed: 1000, paid: 850 }, { target: 12 })) === '{"target":12,"actual":15,"diff":3}' && JSON.stringify(pm({ billed: 2000, paid: 1700 }, { target: 20 })) === '{"target":20,"actual":15,"diff":-5}' && JSON.stringify(pjtMargin({ billed: 1000, paid: 700 }, { ownLabor: 100, direct: 50 }).cost) === '{"paid":700,"direct":50,"ownLabor":100,"total":850}', '★ 실현 마진율 = (청구 − 실투입비) ÷ 청구 × 100, 목표 대비(%p) — 프로젝트마다 따로 계산, 실투입비 구성(지급·직접비·자체 인건비)도 함께 돌려줌');
ok(pjtMargin({ billed: 1000, paid: 700 }, { target: 10, ownLabor: 100, direct: 50 }).actual === 15 && pjtMargin({ billed: 1000, paid: 700 }, { target: 10, labor: 500 }).actual === 30 && pjtMargin({ billed: 1000, paid: 850 }, {}).target === null && pjtMargin({ billed: 1000, paid: 850 }, { target: '' }).diff === null && pjtMargin({ billed: 1000, paid: 850 }, { target: 'x' }).target === null, '자체 인건비·직접비를 넣으면 실투입비에 더해 마진에서 차감(옛 labor 는 무시 — 지급에 이미 포함), 목표가 없거나 숫자가 아니면 목표·차이는 없음');
ok(JSON.stringify(pm({ billed: 0, paid: 100 }, { target: 10 })) === '{"target":null,"actual":null,"diff":null}' && pjtMargin(null, null).actual === null && pjtMargin({ billed: -5 }, {}).actual === null && pjtMargin({ billed: 500, paid: 600 }, { target: 5 }).actual === -20, '청구가 없으면(0 이하) 마진율을 계산하지 않음, 적자도 그대로 계산(−20%)');
ok(pjtMarginViaPlan === pjtMargin, '영업기획이 내보내는 pjtMargin 은 공용(shared)과 같은 함수 — 두 곳의 숫자가 달라질 수 없음');
// 영업기획의 청구−지급 집계와 연결: 같은 입력으로 요약→마진율
const sm = pjtSummary('P', [], [{ pjtId: 'P', docType: 'invoice', amount: 1000, status: 'done' }, { pjtId: 'P', docType: 'payment', amount: 850 }, { pjtId: 'P', docType: 'invoice', amount: 999, status: 'void' }]);
ok(sm.billed === 1000 && sm.paid === 850 && pjtMargin(sm, { target: 12 }).actual === 15, '정산서 집계(폐기 제외) → 마진율 15% 가 그대로 이어짐');
// ── 프로젝트 폼·저장(목표 마진율)
ok(projNew().targetMargin === '' && projToForm({ code: 'A', targetMargin: 12.5 }).targetMargin === '12.5' && projToForm({ code: 'A' }).targetMargin === '' && projToForm(null).targetMargin === '', '폼: 새 프로젝트는 목표 비어 있음, 저장된 값은 폼에 채워지고 없으면 빈 값');
const mk = (v) => projectBuild(Object.assign(projNew(), { code: 'P4 Ph2', link: 'none', targetMargin: v }), { now: 1 });
ok(mk('12').ok && mk('12').data.targetMargin === 12 && mk('12.34').data.targetMargin === 12.3 && mk(' 8 ').data.targetMargin === 8 && mk('-3').data.targetMargin === -3 && mk('0').data.targetMargin === 0 && mk(15).data.targetMargin === 15, '★ 목표 마진율 저장: 숫자(%) 한 자리로 반올림, 0·음수도 가능');
ok(mk('abc').ok === false && mk('abc').errors[0].includes('목표 마진율') && mk('101').ok === false && mk('-101').ok === false && mk('1e9').ok === false, '목표 마진율이 숫자가 아니거나 −100~100을 벗어나면 저장하지 않고 안내');
const clr = mk(''); ok(clr.ok && clr.data.clearTarget === true && !('targetMargin' in clr.data) && mk(null).data.clearTarget === true && !('clearTarget' in mk('12').data), '★ 목표를 비우면 "지움" 표시(저장 코드가 이전 값을 삭제 — merge 저장이라 안 지우면 남는다), 값이 있으면 지움 표시 없음');
// ── 화면: 허브 요약의 마진율 줄, 폼 입력칸
const vw = fs.readFileSync(new URL('../app/modules/plan/projects-view.js', import.meta.url), 'utf8');
const mh = marginHtml({ targetMargin: 12 }, { billed: 1000, paid: 850 });
ok(mh.includes('목표 마진율') && mh.includes('12%') && mh.includes('실현 마진율') && mh.includes('15%') && mh.includes('목표 대비') && mh.includes('+3%p') && mh.includes('data-tone="pos"') && mh.includes('인사평가(수시평가)'), '★ 프로젝트 요약의 마진율 줄: 목표 12% · 실현 15% · 목표 대비 +3%p(초록), 인사평가가 이 값을 읽는다는 안내');
const mn = marginHtml({ targetMargin: 20 }, { billed: 1000, paid: 900 }), m0 = marginHtml({}, { billed: 1000, paid: 850 }), me = marginHtml({ targetMargin: 12 }, { billed: 0, paid: 0 });
ok(mn.includes('-10%p') && mn.includes('data-tone="neg"') && m0.includes('미입력') && !m0.includes('%p') && me.includes('>-<') && !/\+\d+(\.\d+)?%p/.test(me), '목표에 못 미치면 −10%p(빨강), 목표 미입력이면 "미입력"과 차이 없음, 청구가 없으면 계산 안 함(−)');
ok(vw.includes("inp('targetMargin', f.targetMargin") && vw.includes('목표 마진율(%) — 이 프로젝트의 견적 시점 목표') && vw.includes('프로젝트마다 따로 정합니다') && vw.includes("' + marginHtml(p, s, marginExtraOf(st, p.id)) + '"), '프로젝트 등록·수정 폼에 목표 마진율 입력칸, 상세 요약에 마진율 줄이 연결됨');
const ix = fs.readFileSync(new URL('../app/modules/plan/index.js', import.meta.url), 'utf8');
ok(ix.includes('data.clearTarget') && ix.includes('data.targetMargin = deleteField()') && /import \{[^}]*deleteField[^}]*\} from '\.\.\/\.\.\/core\/firebase\.js/.test(ix) && ix.includes("setDoc(doc(db, 'gihoek_projects', r.id), data, { merge: true })"), '★ 저장 코드: 목표를 비우면 deleteField 로 이전 값 삭제(deleteField 를 가져옴), 수정 저장은 merge 그대로 — 다른 필드는 건드리지 않음');
const mj = marginHtml({ targetMargin: 12 }, { billed: 1000, paid: 850 }), mc = marginHtml({ targetMargin: 12 }, { billed: 1000, paid: 700 }, { direct: 100, ownLabor: 50 }), mp = marginHtml({ targetMargin: 12 }, { billed: 1000, paid: 700 }, { direct: 100 });
ok(mj.includes('실현 마진율 (잠정)') && mj.includes('직접비 미연결') && mj.includes('자체 인력 인건비 미연결') && mj.includes('잠정:') && mj.includes('지급(외주·노무) 기준') && mj.includes('실투입비 850원 = 지급(외주·노무) 850원'), '★ 직접비·자체 인건비가 연결되기 전에는 "잠정"(지급 기준)과 미연결 구성을 그대로 보여 줌');
ok(!mc.includes('잠정') && mc.includes('직접비 100원') && mc.includes('자체 인력 인건비 50원') && mc.includes('실투입비 850원') && mc.includes('15%') && mp.includes('잠정') && mp.includes('자체 인력 인건비 미연결') && mc.includes('팀 공수 노무비는 지급예정서에 이미 들어 있어 따로 빼지 않습니다'), '둘 다 연결되면 잠정 표기가 사라지고 구성(지급+직접비+자체 인건비)이 보임, 하나만 연결돼도 잠정, 노무비 이중 차감 없음 안내');
{ const full = { direct: 100, ownLabor: 50, notes: ['프로젝트 표시가 없는 간접비 3줄(1,200,000원)은 마진에 반영되지 않았습니다.', '사업주 4대보험 10% 추정 포함(고지서와 맞춰 보정).'] }; const mn1 = marginHtml({ targetMargin: 12 }, { billed: 1000, paid: 700 }, full);
  ok(!mn1.includes('잠정') && mn1.includes('간접비 3줄') && mn1.includes('4대보험 10% 추정') && mn1.includes('data-margin-notes'), '★ 직접비·자체 인력이 채워지면 "잠정" 경고가 사라지고 서버가 준 주의 문구(미표시 간접비·추정)가 마진 아래에 보인다');
  const mn2 = marginHtml({ targetMargin: 12 }, { billed: 1000, paid: 700 }, { direct: 100, ownLabor: 50 }); ok(!mn2.includes('data-margin-notes'), '주의 문구가 없으면 문구 칸 자체를 그리지 않는다');
  const mn3 = marginHtml({ targetMargin: 12 }, { billed: 1000, paid: 700 }, { direct: 100, ownLabor: 50, notes: ['<img src=x onerror=1>위험', '"><script>1</script>'] }); ok(!mn3.includes('<img src=x') && !mn3.includes('<script>1') && mn3.includes('&lt;'), '★ 주의 문구의 태그는 이스케이프된다');
  const mn4 = marginHtml({ targetMargin: 12 }, { billed: 1000, paid: 700 }, { error: '마진 집계를 불러오지 못했습니다.' }); ok(mn4.includes('잠정') && mn4.includes('불러오지 못했습니다') && mn4.includes('role="alert"') === false, '★ 서버 집계를 못 불러오면 "잠정" 경고가 유지되고 불러오지 못했다는 안내가 함께 보인다(틀린 값을 확정처럼 보이지 않음)');
  const mn5 = marginHtml({ targetMargin: 12 }, { billed: 1000, paid: 700 }, { direct: 100, ownLabor: 50, notes: [] }); ok(!mn5.includes('data-margin-notes') && !mn5.includes('잠정'), '빈 문구 목록이면 칸을 그리지 않고 "잠정"도 없다');
  const mn6 = marginHtml({ targetMargin: 12 }, { billed: 0, paid: 0 }, { direct: 0, ownLabor: 0, notes: ['사업주 4대보험 10% 추정 포함(고지서와 맞춰 보정).'] }); ok(mn6.includes('4대보험 10% 추정') && mn6.includes('-'), '청구가 없어 마진율이 없어도 주의 문구는 보인다'); }
{ const REPOK = { ok: true, upTo: '', projects: [{ pjt: 'pA', overhead: 100, ownLabor: 50 }], unmarked: { count: 2, amount: 3000 }, unallocatedLabor: [], payslipCheck: [], unlinked: { count: 0, amount: 0 }, estimated: true, employerRate: 0.1 };
  const mx = (m) => marginExtraOf({ margin: m }, 'pA'); const J2 = JSON.stringify;
  ok(J2(marginExtraOf(null, 'pA')) === J2({ ui: 'idle' }) && J2(marginExtraOf(undefined, 'pA')) === J2({ ui: 'idle' }) && J2(marginExtraOf({}, 'pA')) === J2({ ui: 'idle' }) && J2(mx(null)) === J2({ ui: 'idle' }) && J2(mx('x')) === J2({ ui: 'idle' }) && J2(mx({ state: 'idle' })) === J2({ ui: 'idle' }) && J2(mx({ state: 'zzz', data: REPOK })) === J2({ ui: 'idle' }), '★ 서버 집계를 아직 안 불렀거나 상태가 이상하면 { ui: "idle" } 뿐 — 값은 비어 있어 "잠정"이 유지되고 [반영해서 보기] 버튼이 보인다(던지지 않음)');
  ok(J2(mx({ state: 'loading' })) === J2({ ui: 'loading' }) && J2(mx({ state: 'denied' })) === J2({ ui: 'denied' }), '★ 부르는 중·권한 없음은 ui 만 있고 값은 없다');
  { const e = mx({ state: 'error' }); ok(e && e.ui === 'error' && typeof e.error === 'string' && e.error.includes('불러오지 못했습니다') && e.direct === undefined && e.ownLabor === undefined, '★ 실패하면 ui error 와 안내 문구만 — 직접비·자체 인력 값은 비워 "잠정"이 유지된다(틀린 값을 확정처럼 보이지 않음)'); }
  { const e = mx({ state: 'ok', data: REPOK }); ok(e && e.ui === 'ok' && e.direct === 100 && e.ownLabor === 50 && Array.isArray(e.notes) && e.notes.length === 2 && e.notes.some((n) => n.includes('2줄')), '★ 성공이면 ui ok 와 직접비 100·자체 인력 50 과 주의 문구(추정·미표시 2줄)가 채워진다'); }
  for (const bad of [{ ok: false }, null, { ok: true, projects: 'x' }, undefined]) { const e = mx({ state: 'ok', data: bad }); ok(e && e.ui === 'error' && e.direct === undefined && /형식|불러오지/.test(e.error), '★ 성공이라는데 응답이 이상하면(' + J2(bad) + ') 실패로 본다 — 값을 비우고 안내한다'); }
  { const e = marginExtraOf({ margin: { state: 'ok', data: REPOK } }, 'pZ'); ok(e && e.ui === 'ok' && e.direct === 0 && e.ownLabor === 0, '응답에 없는 프로젝트는 0 으로 채워 "완료" 로 본다(간접비·자체 인력이 없는 프로젝트)'); }
  const H = (extra) => marginHtml({ targetMargin: 12 }, { billed: 1000, paid: 700 }, extra); const btn = (h) => (h.match(/<button[^>]*data-pj-act="margin-load"[^>]*>[^<]*<\/button>/) || [''])[0];
  { const h = H(mx(null)); ok(h.includes('잠정') && btn(h).includes('반영해서 보기') && !/\sdisabled/.test(btn(h)) && h.includes('재무회계'), '★ 아직 안 불렀으면 "잠정"과 [반영해서 보기] 버튼(눌러야 서버를 부른다)이 보이고 버튼은 활성이다'); }
  { const h = H(mx({ state: 'loading' })); ok(/\sdisabled/.test(btn(h)) && btn(h).includes('불러오는 중') && h.includes('잠정'), '★ 부르는 중이면 버튼이 비활성 "불러오는 중…"이라 연속으로 눌러도 중복 호출이 없다'); }
  { const h = H(mx({ state: 'denied' })); ok(btn(h) === '' && h.includes('재무회계 권한이 있는 계정만') && h.includes('잠정'), '★ 권한이 없으면 버튼 없이 "재무회계 권한이 있는 계정만 볼 수 있습니다" 안내와 "잠정"만 보인다(직접 눌렀으니 이유를 알려 준다)'); }
  { const h = H(mx({ state: 'error' })); ok(btn(h).includes('다시 불러오기') && !/\sdisabled/.test(btn(h)) && h.includes('불러오지 못했습니다') && h.includes('잠정'), '★ 실패하면 안내와 [다시 불러오기] 버튼이 보이고 "잠정"이 유지된다'); }
  { const h = H(mx({ state: 'ok', data: REPOK })); ok(!h.includes('잠정') && btn(h).includes('다시 불러오기') && !/\sdisabled/.test(btn(h)) && h.includes('직접비 100원') && h.includes('자체 인력 인건비 50원') && h.includes('2줄'), '★ 성공이면 "잠정" 없이 직접비 100원·자체 인력 50원·미표시 안내가 보이고 [다시 불러오기]도 있다(데이터가 바뀌었을 때)'); }
  ok(btn(H({ direct: 100, ownLabor: 50 })) === '' && btn(H(undefined)) === '', '호출하는 쪽이 ui 를 주지 않으면(옛 호출) 버튼을 그리지 않는다 — 기존 화면은 그대로'); }
ok(pass + fail >= 36, '시험이 끝까지 실행됨');
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); if (fail) process.exit(1);
