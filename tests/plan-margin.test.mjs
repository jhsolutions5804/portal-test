import fs from 'node:fs';
import fs0 from 'node:fs';
const VER = (fs0.readFileSync(new URL('../app/modules/plan/projects.js', import.meta.url), 'utf8').match(/pjt-summary\.js\?v=([0-9a-z]+)/) || [])[1];   // 서비스 코드가 쓰는 버전 주소와 똑같이
const { pjtMargin, pjtSummary } = await import('../app/shared/pjt-summary.js?v=' + VER);
import { projNew, projToForm, projectBuild, pjtMargin as pjtMarginViaPlan } from '../app/modules/plan/projects.js';
import { marginHtml } from '../app/modules/plan/projects-view.js';
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
ok(vw.includes("inp('targetMargin', f.targetMargin") && vw.includes('목표 마진율(%) — 이 프로젝트의 견적 시점 목표') && vw.includes('프로젝트마다 따로 정합니다') && vw.includes("' + marginHtml(p, s) + '"), '프로젝트 등록·수정 폼에 목표 마진율 입력칸, 상세 요약에 마진율 줄이 연결됨');
const ix = fs.readFileSync(new URL('../app/modules/plan/index.js', import.meta.url), 'utf8');
ok(ix.includes('data.clearTarget') && ix.includes('data.targetMargin = deleteField()') && /import \{[^}]*deleteField[^}]*\} from '\.\.\/\.\.\/core\/firebase\.js/.test(ix) && ix.includes("setDoc(doc(db, 'gihoek_projects', r.id), data, { merge: true })"), '★ 저장 코드: 목표를 비우면 deleteField 로 이전 값 삭제(deleteField 를 가져옴), 수정 저장은 merge 그대로 — 다른 필드는 건드리지 않음');
const mj = marginHtml({ targetMargin: 12 }, { billed: 1000, paid: 850 }), mc = marginHtml({ targetMargin: 12 }, { billed: 1000, paid: 700 }, { direct: 100, ownLabor: 50 }), mp = marginHtml({ targetMargin: 12 }, { billed: 1000, paid: 700 }, { direct: 100 });
ok(mj.includes('실현 마진율 (잠정)') && mj.includes('직접비 미연결') && mj.includes('자체 인력 인건비 미연결') && mj.includes('잠정:') && mj.includes('지급(외주·노무) 기준') && mj.includes('실투입비 850원 = 지급(외주·노무) 850원'), '★ 직접비·자체 인건비가 연결되기 전에는 "잠정"(지급 기준)과 미연결 구성을 그대로 보여 줌');
ok(!mc.includes('잠정') && mc.includes('직접비 100원') && mc.includes('자체 인력 인건비 50원') && mc.includes('실투입비 850원') && mc.includes('15%') && mp.includes('잠정') && mp.includes('자체 인력 인건비 미연결') && mc.includes('팀 공수 노무비는 지급예정서에 이미 들어 있어 따로 빼지 않습니다'), '둘 다 연결되면 잠정 표기가 사라지고 구성(지급+직접비+자체 인건비)이 보임, 하나만 연결돼도 잠정, 노무비 이중 차감 없음 안내');
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); if (fail) process.exit(1);
