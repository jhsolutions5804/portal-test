/* 평가 운영 화면(정기평가·수시평가) — 사장단·인사팀. 인사 모듈에서 분리했다(메뉴 단위 권한: 급여·계약서 같은 인사 화면은 열리지 않는다).
import { pagerAction, pagerApply } from '../../shared/pager.js?v=20261031h';
 * 화면(마크업)과 저장은 evaluation-view/evaluation-io/adhoc-view/adhoc-io 를 그대로 쓰고, 메뉴가 탭 역할을 하므로 화면 안 탭은 두지 않는다. */
import { db, functions, httpsCallable, collection, getDocs, getDoc, setDoc, doc, serverTimestamp } from '../../core/firebase.js?v=20261031h';
import { confirmDialog } from '../../core/dialog.js?v=20261031h';
import { esc, toast } from '../../core/ui.js?v=20261031h';
import { IS_TEST } from '../../core/config.js?v=20261031h';
import { isEvalOps } from '../../shared/eval-perm.js?v=20261031h';
import { evalBoardHtml, evalPanelHtml } from './evaluation-view.js?v=20261031h';
import { createCycleController } from './evaluation-io.js?v=20261031h';
import { adhocBoardHtml, adhocProjectHtml } from './adhoc-view.js?v=20261031h';
import { createAdhocController } from './adhoc-io.js?v=20261031h';
import { cycleCardHtml } from './cycle-admin-view.js?v=20261031h';
import { createCycleAdminController } from './cycle-admin-io.js?v=20261031h';
import { resultBoardHtml, resultPanelHtml } from './result-view.js?v=20261031h';
import { createResultController } from './result-io.js?v=20261031h';

/** 근로자 목록(퇴사 제외, 사번순) — 인사평가 화면과 같은 기준 */
async function loadWorkers() {
  const ws = await getDocs(collection(db, 'workers')); const list = []; ws.forEach((d) => { const x = Object.assign({ id: d.id }, d.data()); if (x.status !== 'resigned') list.push(x); });
  list.sort((a, b) => String(a.empNo || '').localeCompare(String(b.empNo || ''))); return list;
}
const noAccess = () => '<div class="jh-card"><div class="jh-empty">평가 운영은 사장단·인사팀만 열 수 있습니다. 직원 관리에서 "인사평가" 권한을 받으면 열람할 수 있습니다.</div></div>';

/** 서버 함수 evalAct 호출 — 오류는 사람이 읽는 문장으로. 함수가 아직 배포되지 않았으면(not-found) 그 사실을 알린다 */
/* 서버 마진 집계(marginAct) — 평가는 영업기획에서 저장한 평가용 마진 값만 읽는다(getEval). 오류는 호출하는 쪽(adhoc-io)이 삼켜 평가가 잠정으로 계속된다 */
async function callMargin(data) { return (await httpsCallable(functions, 'marginAct')(data)).data; }
async function callEval(data) {
  try { return (await httpsCallable(functions, 'evalAct')(data)).data; }
  catch (e) { const code = String((e && e.code) || ''); if (/not-found|unimplemented/.test(code)) throw new Error('서버 함수(evalAct)가 아직 배포되지 않았습니다. 배포한 뒤 다시 시도해 주세요.'); const m = String((e && e.message) || ''); throw new Error(m.replace(/^(functions\/)?[a-z-]+:\s*/i, '') || '처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'); }
}
/** kind = 'cycle'(정기평가 운영) | 'adhoc'(수시평가) */
export async function mountOps(root, kind, ctx, extra) {
  const me = (ctx && ctx.me) || {};
  // 권한이 없으면 데이터를 읽지 않는다 — 화면에서 막는 것은 안내일 뿐이고, 실제 보호는 보안 규칙(관리자 전용 컬렉션)이 한다
  if (!isEvalOps(me)) { root.innerHTML = noAccess(); return; }
  root.innerHTML = '<div class="jh-hr"><div id="ev-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div></div>';
  const body = root.querySelector('#ev-body');
  const st = { evWorkers: [], evTab: kind };
  const paint = () => { body.removeAttribute('aria-busy'); body.innerHTML = kind === 'result' ? (st.rs.preview ? resultPanelHtml(st) : resultBoardHtml(st)) : kind === 'adhoc' ? (st.ad.sel ? adhocProjectHtml(st) : adhocBoardHtml(st)) : (st.ec.sel ? evalPanelHtml(st) : cycleCardHtml(st) + evalBoardHtml(st)); };
  try { st.evWorkers = await loadWorkers(); } catch (e) { body.innerHTML = '<div class="jh-empty">근로자 목록을 불러오지 못했습니다: ' + esc((e && e.message) || '') + '</div>'; return; }
  const deps = { db, collection, getDocs, getDoc, setDoc, doc, serverTimestamp, toast, confirmDialog, paint, st, ctx };
  const cyc = createCycleController(deps); const adh = createAdhocController(Object.assign({ callMargin }, deps)); const cad = createCycleAdminController(Object.assign({ callEval }, deps)); const res = kind === 'result' ? createResultController(Object.assign({ root }, deps, extra || {}, { mailOn: !IS_TEST })) : null;
  try { if (kind === 'result') await res.load(); else { await (kind === 'adhoc' ? adh.load() : cyc.load()); if (kind === 'cycle') await cad.load(st.evWorkers, st.ec.users); } } catch (e) { toast('불러오지 못했습니다: ' + ((e && e.message) || '')); }
  paint();
  root.onclick = async (ev) => { { const pa = pagerAction(ev); if (pa) { if (pagerApply(st.pg || (st.pg = {}), pa)) paint(); return; } } if (kind === 'result') await res.onClick(ev); else if (kind === 'adhoc') await adh.onClick(ev); else if (!(await cad.onClick(ev))) await cyc.onClick(ev); };
  root.oninput = (ev) => { if (kind === 'result') return; if (kind === 'adhoc') adh.onInput(ev); else cyc.onInput(ev); };
  root.onchange = (ev) => { { const pa = pagerAction(ev); if (pa) { if (pagerApply(st.pg || (st.pg = {}), pa)) paint(); return; } } if (kind === 'result') return; if (kind === 'adhoc') adh.onChange(ev); else cyc.onChange(ev); };
}
