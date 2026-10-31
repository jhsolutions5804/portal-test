// 영업기획 목록의 페이지 나누기 — 기존 쪽 막대에 "페이지당 10·20·50줄" 선택과 쪽 번호 생략을 붙이고, 프로젝트·위탁 계약 목록에도 적용
import { paginate } from '../app/modules/plan/projects.js';
import { pagerHtml, pagerSizeGet, pagerSizeSet, pagerSizeSelect, pagerSizeAction } from '../app/modules/plan/ui.js';
import { projectsListHtml } from '../app/modules/plan/projects-view.js';
import { contractsListHtml } from '../app/modules/plan/contracts-view.js';
let pass = 0, fail = 0; const ok = (c, m) => { if (c) { pass++; console.log('OK   ' + m); } else { fail++; console.log('FAIL ' + m); } };
const L = (n) => Array.from({ length: n }, (_, i) => i);
ok(paginate(L(25), 1, 10).items.length === 10 && paginate(L(25), 3, 10).items.length === 5 && paginate(L(25), 3, 10).from === 21, '기본(10줄): 25건이면 1쪽 10건, 3쪽 5건(21~25번째)');
ok(pagerSizeSet('plan', 20) && pagerSizeGet('plan') === 20 && paginate(L(25), 1, 10).items.length === 20 && paginate(L(25), 2, 10).items.length === 5, '페이지당 20줄을 고르면 기존 목록(견적·정산서·비용장부 대조·프로젝트 상세)이 모두 20줄씩');
ok(!pagerSizeSet('plan', 7) && pagerSizeGet('plan') === 20 && !pagerSizeSet('plan', 'x') && pagerSizeGet('plan') === 20, '허용하지 않는 줄 수(7·글자)는 무시하고 선택 유지');
pagerSizeSet('plan', 50); ok(paginate(L(25), 1, 10).items.length === 25 && paginate(L(25), 1, 10).pages === 1, '50줄이면 25건은 한 쪽');
const h50 = pagerHtml(paginate(L(25), 1, 10), 'data-es-page', 'list'); ok(h50.includes('data-pg-size-group="plan"') && /<option value="50" selected>/.test(h50) && h50.includes('전체 25건'), '한 쪽이어도 줄이 10개를 넘으면 줄 수 선택 칸이 남아 있어(10줄로 되돌릴 수 있음)');
pagerSizeSet('plan', 10); const h10 = pagerHtml(paginate(L(25), 2, 10), 'data-es-page', 'list');
ok(h10.includes('data-es-page="list:1"') && h10.includes('data-es-page="list:3"') && h10.includes('전체 25건 중 11-20건') && /<option value="10" selected>/.test(h10) && !/data-es-page="list:2"[^>]*disabled/.test(h10), '쪽 막대: 기존 단추 형식(data-es-page) 유지, 범위 표시 "11-20건", 10줄 선택됨');
const h230 = pagerHtml(paginate(L(230), 12, 10), 'data-es-page', 'list'); ok(h230.includes('…') && (h230.match(/data-es-page="list:/g) || []).length < 14, '쪽이 많으면 번호를 생략(…)해 막대가 길어지지 않음');
ok(pagerHtml(paginate(L(8), 1, 10), 'data-es-page', 'list').includes('전체 8건') && !pagerHtml(paginate(L(8), 1, 10), 'data-es-page', 'list').includes('data-pg-size-group'), '10건 이하이면 지금과 같은 화면(줄 수 선택 없음)');
ok(pagerSizeSelect('plan', 10) === '' && pagerSizeSelect('plan', 11).includes('data-pg-size-group="plan"'), '줄 수 선택 칸은 10건을 넘을 때만');
const ev = { target: { matches: (s) => s === '[data-pg-size-group]', getAttribute: () => 'plan', value: '20' } }; ok(JSON.stringify(pagerSizeAction(ev)) === '{"group":"plan","size":20}' && pagerSizeAction({ target: { matches: () => false } }) === null && pagerSizeAction(null) === null, '줄 수 선택 이벤트 해석');
const P = (n) => Array.from({ length: n }, (_, i) => ({ id: 'p' + i, code: 'P' + String(i).padStart(2, '0'), name: '현장' + i, site: '', status: 'run', type: 'general' }));
const stp = { projects: P(23), estimates: [], settlements: [], filter: { status: 'all', q: '' }, pg: {} }; let ph = projectsListHtml(stp); const prow = (h) => (h.match(/data-pj-open="/g) || []).length;
ok(prow(ph) === 10 && ph.includes('1–10 / 23줄') && ph.includes('data-pg-key="plan-projects"'), '프로젝트 목록: 23건이면 처음 10건과 쪽 막대');
stp.filter.q = '현장7'; ph = projectsListHtml(stp); ok(stp.pg['plan-projects'].page === 1, '프로젝트 목록: 검색 조건이 바뀌면 1쪽');
const K = (n) => Array.from({ length: n }, (_, i) => ({ id: 'k' + i, no: 'C' + i, kind: 'sub', partnerName: '협력' + i, pjtId: '', title: '계약' + i, status: 'draft', items: [], startDate: '', endDate: '' }));
try { const stc = { contracts: K(14), companies: [], projects: [], filter: { partner: '', status: '' }, today: '2026-10-31', pg: {} }; const ch = contractsListHtml(stc); const crow = (ch.match(/data-ct-open="/g) || []).length; ok(crow === 10 && ch.includes('1–10 / 14줄') && ch.includes('data-pg-key="plan-contracts"'), '위탁 계약 목록: 14건이면 처음 10건과 쪽 막대'); } catch (e) { ok(false, '위탁 계약 목록 시험 오류: ' + e.message); }
console.log(fail ? '\n실패 ' + fail + '건 / 통과 ' + pass : '\n전부 통과 (' + pass + '건)'); process.exit(fail ? 1 : 0);
