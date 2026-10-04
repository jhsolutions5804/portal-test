import { fetchAll, fetchOne } from './data.js?v=20261004k';
import { listHtml, detailHtml } from './views.js?v=20261004k';
import { tabCounts } from './logic.js?v=20261004k';
import { buildHash, navigate } from '../../core/router.js?v=20261004k';
import { db, collection, doc, getDoc, addDoc, updateDoc, setDoc, serverTimestamp } from '../../core/firebase.js?v=20261004k';
import { toast } from '../../core/ui.js?v=20261004k';
import { confirmDialog } from '../../core/dialog.js?v=20261004k';
import { loadDirectory } from './directory.js?v=20261004k';
import { act } from './api.js?v=20261004k';
import * as C from './compose.js?v=20261004k';
import { paperHtml, printPanelHtml, canPrint } from './print-view.js?v=20261004k';
import { homeLists, homeHtml, worktimeHtml, leaveBoxHtml, todoHtml, pipelineHtml, recentHtml } from './home-view.js?v=20261004k';
import { todoCounts } from './home-stats.js?v=20261004k';
import { loadWorkers, loadMonthAttendance, loadHolidays } from './home-data.js?v=20261004k';
import { findWorker, calcLeaveBalance, computeLeaveHoursForMonth, monthlyStandardHours, monthlyMaxOvertimeHours, worktimeSummary, leaveDocsOf } from './home-calc.js?v=20261004k';
import { chooserHtml, composeHtml, lineEditorHtml, suggestHtml, balanceHintHtml } from './compose-view.js?v=20261004k';

const URL_DEFAULTS = { tab: 'todo', type: 'all', status: 'all', page: '1', size: '20' };   // 주소에서 생략하는 기본값

export const manifest = {
  id: 'edoc',
  title: '전자결재',
  icon: '✍',
  perm: (me) => me.admin || (me.perms && me.perms.edoc === true),
  defaultHash: '#/edoc/home',
  quick: { label: '새 문서 작성', icon: '✍', hash: '#/edoc/new' },   // 폰 하단 막대 버튼
  hideQuickOn: ['new', 'edit', 'print']                                 // 이미 작성·인쇄 중인 화면에서는 숨김
};

let cache = { uid: null, docs: null };
const homeMemo = { tab: null, scope: 'mine' };   // 홈에서 마지막으로 고른 탭·현황 범위(상세에 다녀와도 유지)
let listScroll = null;   // 문서를 열기 직전 목록 스크롤 위치(뒤로 오면 복원)
let loading = null;

async function ensureDocs(me, force) {
  if (!force && cache.uid === me.uid && cache.docs) return cache.docs;
  if (!loading) {
    loading = fetchAll(me).then(docs => { cache = { uid: me.uid, docs }; return docs; }).finally(() => { loading = null; });
  }
  return loading;
}
const dropCache = () => { cache = { uid: null, docs: null }; };

/** 정책(필수 결재자·대리 권한자)을 내 정보에 반영 — 화면이 보여 줄 버튼·칩을 정할 때 쓴다(허용 여부는 서버가 판단) */
async function withPolicy(me) {
  let dir = null;
  try { dir = await loadDirectory(false); } catch (e) { console.error('기준 정보 조회 오류', e); }
  me.isProxy = !!dir && dir.policy.proxy.indexOf(me.uid) !== -1;
  me.isRequired = !!dir && dir.policy.required.indexOf(me.uid) !== -1;
  return dir;
}

/** route: { segs:['box'] | ['doc', dtype, id] | ['new'] | ['new', type] | ['edit', dtype, id], query } */
export async function mount(root, route, ctx) {
  const kind = route.segs[0];
  if (kind === 'new' || kind === 'edit') return mountCompose(root, route, ctx);
  if (kind === 'home') return mountHome(root, route, ctx);
  if (kind === 'print') return mountPrint(root, route, ctx);
  return mountBox(root, route, ctx);
}

/* ───────────────────────── 결재함 + 상세 ───────────────────────── */
async function mountBox(root, route, ctx) {
  const { me } = ctx;
  const isDetail = route.segs[0] === 'doc';
  const dtype = isDetail ? route.segs[1] : null;
  const id = isDetail ? route.segs[2] : null;
  const selectedKey = isDetail ? dtype + '/' + id : '';

  root.innerHTML =
    '<div class="jh-split" data-view="' + (isDetail ? 'detail' : 'list') + '">' +
      '<section class="jh-split__list" id="edoc-list"><div class="jh-empty">불러오는 중…</div></section>' +
      '<section class="jh-split__detail" id="edoc-detail">' + detailHtml({ me, doc: null }) + '</section>' +
    '</div>';

  const listEl = root.querySelector('#edoc-list');
  const detailEl = root.querySelector('#edoc-detail');
  const q = route.query;
  const boxHash = (patch) => buildHash('edoc', '/box', Object.assign({}, q, patch), URL_DEFAULTS);
  const goBox = (patch) => navigate(boxHash(patch), { replace: true });   // 탭·필터·쪽 이동은 기록을 쌓지 않는다

  const [docs] = await Promise.all([ensureDocs(me, false), withPolicy(me)]);
  ctx.setBadge('edoc', tabCounts(docs, me).todo);
  listEl.innerHTML = listHtml({ docs, me, query: q, selectedKey });
  if (!isDetail && listScroll != null) { window.scrollTo(0, listScroll); listScroll = null; }   // 상세에서 뒤로 오면 보던 위치로
  if (isDetail && window.matchMedia('(max-width: 899px)').matches) window.scrollTo(0, 0);        // 폰: 상세는 맨 위부터

  let current = null;
  if (isDetail) {
    detailEl.innerHTML = detailHtml({ me, loading: true });
    // 상세는 항상 서버의 최신 내용으로 연다(다른 곳에서 승인·반려했을 수 있다). 실패하면 목록에 있던 내용을 쓴다.
    let d = null;
    try { d = await fetchOne(dtype, id); } catch (e) { d = null; }
    if (d) { const k = cache.docs ? cache.docs.findIndex(x => x.dtype === dtype && x.id === id) : -1; if (k !== -1) cache.docs[k] = d; }
    else d = docs.find(x => x.dtype === dtype && x.id === id) || null;
    current = d;
    detailEl.innerHTML = d ? detailHtml({ me, doc: d }) : '<div class="jh-empty">문서를 찾을 수 없거나 열람 권한이 없습니다.</div>' +
      '<button type="button" class="jh-btn" data-variant="ghost" data-back>← 목록</button>';
  }

  const reload = async () => { dropCache(); await mountBox(root, route, ctx); };

  async function runAction(key, btn) {
    const d = current; if (!d) return;
    const base = { dtype: d.dtype, docId: d.id };
    const finish = async (msg, goList) => { toast(msg); dropCache(); if (goList) navigate(boxHash({}), { replace: true }); else await reload(); };
    const call = async (payload, okMsg, goList) => {
      root.querySelectorAll('[data-do]').forEach(b => { b.disabled = true; });
      try { await act(Object.assign({}, base, payload)); await finish(okMsg, goList); }
      catch (e) { toast(e.message); root.querySelectorAll('[data-do]').forEach(b => { b.disabled = false; }); }
    };
    if (key === 'edit') { navigate('#/edoc/edit/' + d.dtype + '/' + d.id, { state: { jh: 'fromList' } }); return; }
    if (key === 'print') { navigate('#/edoc/print/' + d.dtype + '/' + d.id, { state: { jh: 'fromList' } }); return; }
    if (key === 'approve') {
      const r = await confirmDialog({ title: '승인', body: '"' + (d.title || '이 문서') + '"을(를) 승인합니다.', confirmLabel: '승인' });
      if (r.ok) await call({ action: 'approve' }, '승인했습니다.'); return;
    }
    if (key === 'approve_post') {
      const line = d.approvalLine || []; const cur = line.findIndex(s => s.status === 'pending' && /^결재/.test(s.role));
      const rest = line.filter((s, i) => i > cur && /^결재/.test(s.role) && s.status === 'pending').length;
      const r = await confirmDialog({ title: '승인 후 게시(전결)', body: '내 단계를 승인하고 문서를 바로 게시합니다.' + (rest ? '\n남은 결재 ' + rest + '단계는 건너뜁니다(전결 생략으로 기록).' : ''), confirmLabel: '승인 후 게시' });
      if (r.ok) await call({ action: 'approve', post: true }, '승인하고 게시했습니다.'); return;
    }
    if (key === 'reject') {
      const r = await confirmDialog({ title: '반려', body: '반려하면 작성자가 수정해 다시 상신할 수 있습니다.', confirmLabel: '반려', variant: 'danger', reason: { label: '반려 사유', placeholder: '작성자가 알아볼 수 있게 구체적으로 적어 주세요', required: true } });
      if (r.ok) await call({ action: 'reject', comment: r.reason }, '반려했습니다.'); return;
    }
    if (key === 'recall') {
      const r = await confirmDialog({ title: '회수', body: '상신을 거두고 임시저장 상태로 되돌립니다. 이미 받은 결재 진행은 초기화됩니다.', confirmLabel: '회수' });
      if (r.ok) await call({ action: 'recall' }, '회수했습니다. 임시저장 상태입니다.'); return;
    }
    if (key === 'post') {
      const r = await confirmDialog({ title: '게시', body: '승인된 문서를 게시합니다.' + (d.dtype === 'leave' ? '\n연차는 회사 일정에 자동으로 등록됩니다.' : ''), confirmLabel: '게시' });
      if (r.ok) await call({ action: 'post' }, '게시했습니다.'); return;
    }
    if (key === 'delete') {
      const r = await confirmDialog({ title: '삭제', body: '"' + (d.title || '이 문서') + '"을(를) 삭제합니다. 삭제하면 복구할 수 없습니다.', confirmLabel: '삭제', variant: 'danger' });
      if (r.ok) await call({ action: 'delete' }, '삭제했습니다.', true); return;
    }
  }

  root.onclick = (ev) => {
    const t = ev.target.closest('[data-tab],[data-open],[data-back],[data-refresh],[data-page],[data-new],[data-do],[data-home]'); if (!t) return;
    if (t.hasAttribute('data-home')) { navigate('#/edoc/home', { replace: true }); return; }
    if (t.hasAttribute('data-do')) { runAction(t.getAttribute('data-do'), t); return; }
    if (t.hasAttribute('data-new')) { navigate('#/edoc/new', { state: { jh: 'fromList' } }); return; }
    if (t.hasAttribute('data-tab')) return goBox({ tab: t.getAttribute('data-tab'), page: '1' });
    if (t.hasAttribute('data-page')) return goBox({ page: t.getAttribute('data-page') });
    if (t.hasAttribute('data-open')) {
      const [dt, did] = t.getAttribute('data-open').split('/');
      const target = buildHash('edoc', '/doc/' + dt + '/' + did, q, URL_DEFAULTS);
      if (isDetail) navigate(target, { replace: true });                       // PC: 다른 문서를 고를 때는 기록을 쌓지 않는다
      else { listScroll = window.scrollY; navigate(target, { state: { jh: 'fromList' } }); }   // 목록 → 문서: 새 화면이므로 기록을 쌓는다
      return;
    }
    if (t.hasAttribute('data-back')) {
      const st = history.state;
      if (st && st.jh === 'fromList') { history.back(); return; }   // 목록에서 들어왔으면 뒤로가기와 똑같이
      navigate(boxHash({}), { replace: true }); return;              // 주소로 바로 들어왔으면 목록으로 바꿔 놓는다
    }
    if (t.hasAttribute('data-refresh')) { dropCache(); mountBox(root, route, ctx); }
  };
  root.onchange = (ev) => {
    if (ev.target.hasAttribute && ev.target.hasAttribute('data-pagesize')) return goBox({ size: ev.target.value, page: '1' });
    const f = ev.target.getAttribute && ev.target.getAttribute('data-filter'); if (!f) return;
    goBox({ [f]: ev.target.value, page: '1' });
  };
  root.oninput = null;
}

/* ───────────────────────── 작성·수정 ───────────────────────── */
async function mountCompose(root, route, ctx) {
  const { me } = ctx;
  const leave = () => { const st = history.state; if (st && st.jh === 'fromList') history.back(); else navigate('#/edoc/box', { replace: true }); };
  root.onclick = null; root.onchange = null; root.oninput = null;
  window.scrollTo(0, 0);

  // 종류 고르기
  if (route.segs[0] === 'new' && !route.segs[1]) {
    root.innerHTML = '<div class="jh-card">' + chooserHtml() + '</div>';
    root.onclick = (ev) => {
      const t = ev.target.closest('[data-new-type],[data-act]'); if (!t) return;
      if (t.hasAttribute('data-new-type')) { navigate('#/edoc/new/' + t.getAttribute('data-new-type'), { replace: true }); return; }
      if (t.getAttribute('data-act') === 'cancel') leave();
    };
    return;
  }

  root.innerHTML = '<div class="jh-card"><div class="jh-empty">불러오는 중…</div></div>';
  let dir;
  try { dir = await loadDirectory(false); }
  catch (e) { root.innerHTML = '<div class="jh-card"><div class="jh-empty">작성에 필요한 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</div><button type="button" class="jh-btn" data-variant="ghost" data-act="cancel">돌아가기</button></div>'; root.onclick = (ev) => { if (ev.target.closest('[data-act=cancel]')) leave(); }; return; }

  const S = { type: null, values: null, errors: {}, line: null, ui: { search: '', picked: null, lineError: '' }, edit: null, rejectReason: '', formError: '', busy: false, ctx: null, docRef: null, createdMs: null };
  const lc = (type) => Object.assign(C.lineContext(me, dir.policy, dir.guides, dir.users, type), { projects: dir.projects });

  if (route.segs[0] === 'edit') {
    const [, dt, did] = route.segs;
    let d = null; try { d = await fetchOne(dt, did); } catch (e) { d = null; }
    if (!d || d.authorUid !== me.uid || (d.status !== 'draft' && d.status !== 'rejected')) {
      root.innerHTML = '<div class="jh-card"><div class="jh-empty">수정할 수 없는 문서입니다. (작성자 본인의 임시저장·반려 문서만 수정할 수 있습니다.)</div><button type="button" class="jh-btn" data-variant="ghost" data-act="cancel">돌아가기</button></div>';
      root.onclick = (ev) => { if (ev.target.closest('[data-act=cancel]')) leave(); }; return;
    }
    const v = C.valuesFromDoc(d); S.type = v.type; S.values = v.values; S.ctx = lc(S.type);
    S.line = (d.approvalLine && d.approvalLine.length) ? C.lineFromDoc(d, S.ctx) : C.initialLine(S.ctx);
    S.edit = { dtype: d.dtype, id: d.id }; S.docRef = S.edit; S.rejectReason = d.status === 'rejected' ? (d.rejectReason || '') : ''; S.createdMs = d._ms;
  } else {
    const type = route.segs[1];
    if (!C.composeType(type)) { navigate('#/edoc/new', { replace: true }); return; }
    S.type = type; S.values = C.defaultValues(type, me); S.ctx = lc(type); S.line = C.initialLine(S.ctx);
  }

  const paint = () => { root.innerHTML = '<div class="jh-card">' + composeHtml(S) + '</div>'; };
  const updateBalance = () => { const el = root.querySelector('#edoc-balance'); if (el) el.innerHTML = balanceHintHtml(S.balance, S.values.days, S.values.leaveType); };
  const applyDeputy = () => {   // 업무 대리인을 정하면 참조로 자동 포함, 바꾸면 이전 사람은 뺀다
    const r = C.setDeputy(S.line, S.values.deputyUid || null, S.autoCc || null, S.ctx);
    S.line = r.state; S.autoCc = r.auto; S.ctx.deputy = S.values.deputyUid || null; S.ui.lineError = r.error || '';
  };
  const paintLine = () => {
    const sec = root.querySelector('#edoc-line-section'); if (!sec) return;
    sec.innerHTML = '<h3 class="jh-form__h">결재선</h3>' + lineEditorHtml(S.line, S.ctx, S.ui);
  };
  const sync = () => {   // 화면의 입력값을 상태로 읽어 온다
    root.querySelectorAll('[data-input]').forEach((el) => { S.values[el.getAttribute('data-input')] = el.value; });
    root.querySelectorAll('[data-item]').forEach((el) => {
      const [i, k] = el.getAttribute('data-item').split('.'); if (S.values.items && S.values.items[+i]) S.values.items[+i][k] = el.value;
    });
  };
  if (S.type === 'leave' && S.values.deputyUid) applyDeputy();   // 불러온 문서의 업무 대리인 반영
  paint();
  if (S.type === 'leave') {   // 내 잔여 연차를 불러와 신청 화면에 안내(명부에 입사일이 없으면 안내 생략)
    (async () => {
      try {
        const w = findWorker(await loadWorkers(false), me); if (!w || !w.hireDate) return;
        S.balance = calcLeaveBalance(w.hireDate, leaveDocsOf(await ensureDocs(me, false), me)); updateBalance();
      } catch (e) { /* 안내만 생략 */ }
    })();
  }

  const firstInvalid = () => { const el = root.querySelector('[data-invalid="true"]'); if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); const inp = el.querySelector('input,select,textarea'); if (inp) inp.focus({ preventScroll: true }); } };

  async function persist() {
    const base = { projects: dir.projects, users: dir.users, now: S.createdMs ? new Date(S.createdMs) : new Date() };
    const data = C.buildDocData(S.type, S.values, me, base);
    if (S.docRef) {
      await updateDoc(doc(db, 'edoc_' + S.docRef.dtype, S.docRef.id), Object.assign({}, data, { updatedAt: serverTimestamp() }));
    } else {
      const ref = await addDoc(collection(db, 'edoc_' + data.dtype), Object.assign({}, data, { status: 'draft', createdAt: serverTimestamp() }));
      S.docRef = { dtype: data.dtype, id: ref.id };
    }
    dropCache();
    return S.docRef;
  }
  const quickErrors = () => C.validate(S.type, S.values, { projects: dir.projects, draft: true });   // 임시저장은 필수 항목이 비어 있어도 되지만, 형식이 틀린 값은 막는다

  root.oninput = (ev) => {
    const t = ev.target;
    if (t.hasAttribute('data-line-search')) {   // 입력창은 그대로 두고 검색 결과만 바꾼다 — 다시 그리면 한글 조합이 끊긴다
      S.ui.search = t.value.trim(); S.ui.picked = null; S.ui.lineError = '';
      const box = root.querySelector('[data-suggest-box]'); if (box) box.innerHTML = suggestHtml(S.line, S.ctx, S.ui);
      root.querySelectorAll('[data-add]').forEach((b) => { b.disabled = true; });
      return;
    }
    if (t.hasAttribute('data-input')) { S.values[t.getAttribute('data-input')] = t.value; clear(t); if (t.getAttribute('data-input') === 'days') updateBalance(); }
    else if (t.hasAttribute('data-item')) { const [i, k] = t.getAttribute('data-item').split('.'); S.values.items[+i][k] = t.value; clear(t); }
  };
  const clear = (el) => { const f = el.closest('[data-invalid="true"]'); if (f) { f.removeAttribute('data-invalid'); } };
  root.onchange = (ev) => {
    const t = ev.target; if (!t.hasAttribute('data-input')) return;
    const key = t.getAttribute('data-input'); S.values[key] = t.value;
    if (S.type === 'leave' && (key === 'leaveType' || key === 'startDate' || key === 'endDate')) {
      const d = C.calcLeaveDays(S.values.startDate, S.values.endDate, S.values.leaveType);
      if (d !== '') { S.values.days = d; const el = root.querySelector('#f-days'); if (el) el.value = d; }
      updateBalance();
    }
    if (key === 'leaveKind') { sync(); paint(); }   // 휴직이면 복직 예정일 항목이 나타난다
    if (key === 'deputyUid') { applyDeputy(); paintLine(); }
  };

  root.onclick = async (ev) => {
    const t = ev.target.closest('[data-act],[data-kind],[data-add-item],[data-remove-item],[data-move],[data-remove],[data-pick],[data-add]'); if (!t) return;
    if (t.hasAttribute('data-kind')) { if (S.edit) return; sync(); S.values.kind = t.getAttribute('data-kind'); S.errors = {}; paint(); return; }
    if (t.hasAttribute('data-add-item')) { sync(); S.values.items = (S.values.items || []).concat(C.emptyItem()); paint(); const last = root.querySelectorAll('[data-item$=".name"]'); if (last.length) last[last.length - 1].focus(); return; }
    if (t.hasAttribute('data-remove-item')) { sync(); S.values.items.splice(+t.getAttribute('data-remove-item'), 1); paint(); return; }
    if (t.hasAttribute('data-move')) { const [uid, d] = t.getAttribute('data-move').split(':'); S.line = C.moveApprover(S.line, uid, +d); paintLine(); return; }
    if (t.hasAttribute('data-remove')) { const r = C.removeFromLine(S.line, t.getAttribute('data-remove'), S.ctx); S.line = r.state; S.ui.lineError = r.error || ''; paintLine(); return; }
    if (t.hasAttribute('data-pick')) {
      S.ui.picked = t.getAttribute('data-pick'); S.ui.lineError = '';
      const box = root.querySelector('[data-suggest-box]'); if (box) box.innerHTML = suggestHtml(S.line, S.ctx, S.ui);
      root.querySelectorAll('[data-add]').forEach((b) => { b.disabled = false; });
      return;
    }
    if (t.hasAttribute('data-add')) {
      const fn = t.getAttribute('data-add') === 'cc' ? C.addCc : C.addApprover;
      const r = fn(S.line, S.ui.picked, S.ctx); S.line = r.state; S.ui.lineError = r.error || ''; if (!r.error) { S.ui.search = ''; S.ui.picked = null; } paintLine(); return;
    }
    const act_ = t.getAttribute('data-act');
    if (act_ === 'apply-guide') { S.line = C.applyGuide(S.ctx); S.ui.lineError = ''; paintLine(); return; }
    if (act_ === 'cancel') { leave(); return; }
    if (act_ === 'save' || act_ === 'submit') {
      if (S.busy) return;
      sync(); S.formError = ''; S.errors = {};
      const submit = act_ === 'submit';
      S.errors = submit ? C.validate(S.type, S.values, { projects: dir.projects, users: dir.users, meUid: me.uid }) : quickErrors();
      const lineProblems = submit ? C.lineIssues(S.line, S.ctx) : [];
      if (Object.keys(S.errors).length || lineProblems.length) {
        S.formError = Object.keys(S.errors).length ? '입력 내용을 확인해 주세요. 빨간 표시된 항목을 고치면 됩니다.' : lineProblems[0];
        paint(); firstInvalid(); return;
      }
      S.busy = true; paint();
      try {
        const ref = await persist();
        if (!submit) { toast('임시저장했습니다.'); S.busy = false; navigate('#/edoc/edit/' + ref.dtype + '/' + ref.id, { replace: true }); return; }
        await act({ dtype: ref.dtype, docId: ref.id, action: 'submit', line: S.line.approvers, cc: S.line.cc });
        dropCache(); toast('상신했습니다. 결재 대기 중입니다.');
        navigate('#/edoc/doc/' + ref.dtype + '/' + ref.id + '?tab=mine', { replace: true });
      } catch (e) {
        S.busy = false; S.formError = (e && e.message) || '처리하지 못했습니다.';
        if (S.docRef) S.formError += ' (작성한 내용은 임시저장되어 있습니다.)';
        paint(); const el = root.querySelector('#edoc-form-error'); if (el) el.scrollIntoView({ block: 'center' });
      }
    }
  };
}

/* ───────────────────────── 인쇄 · PDF ───────────────────────── */
async function mountPrint(root, route, ctx) {
  const { me } = ctx; const [, dtype, id] = route.segs;
  const back = () => { const st = history.state; if (st && st.jh === 'fromList') history.back(); else navigate('#/edoc/doc/' + dtype + '/' + id, { replace: true }); };
  root.onclick = null; root.onchange = null; root.oninput = null;
  root.innerHTML = '<div class="jh-empty">불러오는 중…</div>'; window.scrollTo(0, 0);
  let d = null; try { d = await fetchOne(dtype, id); } catch (e) { d = null; }
  if (!d) { root.innerHTML = '<div class="jh-empty">문서를 찾을 수 없거나 열람 권한이 없습니다.</div><button type="button" class="jh-btn" data-variant="ghost" data-back2>← 돌아가기</button>'; root.onclick = (ev) => { if (ev.target.closest('[data-back2]')) back(); }; return; }
  if (!canPrint(d)) { root.innerHTML = '<div class="jh-empty">승인된 문서만 인쇄할 수 있습니다. (현재 상태: 결재 진행 중)</div><button type="button" class="jh-btn" data-variant="ghost" data-back2>← 돌아가기</button>'; root.onclick = (ev) => { if (ev.target.closest('[data-back2]')) back(); }; return; }
  let company = {};
  try { const s = await getDoc(doc(db, 'edoc_settings', 'company')); if (s.exists()) company = s.data(); } catch (e) { company = {}; }
  const todayStr = C.ymd(new Date());
  const info = { hireDate: '', issueDate: todayStr, dept: '', rank: '', fromRoster: false };
  try {   // 작성자의 입사일·소속·직위를 인사 명부(일반 정보)에서 자동으로 채운다 — 주민번호 등 개인정보는 쓰지 않는다
    const w = findWorker(await loadWorkers(false), { uid: d.authorUid, email: d.authorEmail, name: d.authorName });
    if (w) { info.hireDate = w.hireDate || ''; info.dept = w.dept || ''; info.rank = w.rank || ''; info.fromRoster = !!w.hireDate; }
  } catch (e) { /* 못 불러오면 직접 입력 */ }
  const draw = () => {
    root.innerHTML = '<div class="jh-card jh-noprint">' + printPanelHtml(d, info, company, me.admin) + '</div>' +
      '<div class="jh-actionbar jh-noprint"><div class="jh-actionbar__primary"><button type="button" class="jh-btn" data-variant="primary" data-print>인쇄 / PDF 저장</button></div><div class="jh-actionbar__secondary"><button type="button" class="jh-btn" data-variant="ghost" data-back2>← 돌아가기</button></div></div>' +
      '<div id="edoc-paper">' + paperHtml(d, info, company) + '</div>';
  };
  const redrawPaper = () => { const el = root.querySelector('#edoc-paper'); if (el) el.innerHTML = paperHtml(d, info, company); };
  draw();
  root.oninput = (ev) => {
    const t = ev.target; const k = t.getAttribute && t.getAttribute('data-print'); if (!k) return;
    if (k === 'hireDate' || k === 'issueDate') info[k] = t.value; else company = Object.assign({}, company, { [k.replace('co-', '')]: t.value });
    redrawPaper();
  };
  root.onclick = async (ev) => {
    const t = ev.target.closest('[data-print],[data-back2],[data-save-company]'); if (!t) return;
    if (t.hasAttribute('data-back2')) { back(); return; }
    if (t.hasAttribute('data-print')) { window.print(); return; }
    if (t.hasAttribute('data-save-company')) {
      try { await setDoc(doc(db, 'edoc_settings', 'company'), { name: (company.name || '').trim(), ceo: (company.ceo || '').trim(), bizNo: (company.bizNo || '').trim(), address: (company.address || '').trim(), updatedAt: serverTimestamp() }, { merge: true }); toast('회사 정보를 저장했습니다.'); }
      catch (e) { toast('저장하지 못했습니다. 권한을 확인해 주세요.'); }
    }
  };
}

/* ───────────────────────── 전자결재 홈 ───────────────────────── */
async function mountHome(root, route, ctx) {
  const { me } = ctx;
  root.onclick = null; root.onchange = null; root.oninput = null;
  const now = new Date(); const ym = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  const model = { me, docs: [], lists: { approve: [], inbox: [], mine: [], posted: [] }, todo: { approve: 0, rejected: 0, postWait: 0, inbox: 0 }, scope: 'mine', tab: 'approve', work: { state: 'loading', month: ym }, leave: { state: 'loading' } };
  root.innerHTML = '<div class="jh-empty">불러오는 중…</div>';
  const [docs] = await Promise.all([ensureDocs(me, false), withPolicy(me)]);
  ctx.setBadge('edoc', tabCounts(docs, me).todo);
  model.docs = docs; model.lists = homeLists(docs, me); model.todo = todoCounts(docs, me);
  model.tab = homeMemo.tab || (model.lists.approve.length ? 'approve' : (model.lists.inbox.length ? 'inbox' : 'mine'));   // 마지막에 본 탭, 없으면 할 일이 있는 목록을 먼저
  model.scope = me.admin && homeMemo.scope === 'all' ? 'all' : 'mine';
  root.innerHTML = homeHtml(model);
  const setBox = (id, html) => { const el = root.querySelector('#' + id); if (el) el.innerHTML = html; };

  // 근로자 명부 → 입사일(연차)·근무자 번호(근로시간). 칸마다 따로 채워서 한쪽이 실패해도 다른 쪽은 보인다
  (async () => {
    let worker = null;
    try { worker = findWorker(await loadWorkers(false), me); } catch (e) { worker = null; }
    try {   // 연차 현황
      if (!worker || !worker.hireDate) model.leave = { state: 'nohire' };
      else model.leave = { state: 'ok', balance: calcLeaveBalance(worker.hireDate, leaveDocsOf(docs, me)) };
    } catch (e) { console.error('연차 현황', e); model.leave = { state: 'error' }; }
    setBox('edoc-leavebox', leaveBoxHtml(model.leave));
    try {   // 이번 달 근로시간
      if (!worker || !worker.linked) { model.work = { state: 'unlinked', month: ym }; }
      else {
        const [att, hol] = await Promise.all([loadMonthAttendance(worker.id, ym), loadHolidays()]);
        const leaveHours = computeLeaveHoursForMonth(leaveDocsOf(docs, me).map((d) => Object.assign({}, d, { authorName: me.name })), me.name, now.getFullYear(), now.getMonth() + 1);
        model.work = { state: 'ok', month: ym, summary: worktimeSummary(att.hours, leaveHours, monthlyStandardHours(now.getFullYear(), now.getMonth() + 1, hol), monthlyMaxOvertimeHours(now.getFullYear(), now.getMonth() + 1)) };
      }
    } catch (e) { console.error('근로시간', e); model.work = { state: 'error', month: ym }; }
    setBox('edoc-work', worktimeHtml(model.work));
  })();

  const TO = (go) => ({
    todo: '#/edoc/box', cc: '#/edoc/box?tab=cc', mine: '#/edoc/box?tab=mine', posted: me.admin ? '#/edoc/box?tab=all&status=posted' : '#/edoc/box?tab=all',
    rejected: '#/edoc/box?tab=mine&status=rejected', approved: me.admin ? '#/edoc/box?tab=all&status=approved' : '#/edoc/box?tab=mine&status=approved'
  })[go];
  root.onclick = (ev) => {
    const t = ev.target.closest('[data-go],[data-open],[data-new],[data-scope],[data-recent],[data-pipe]'); if (!t) return;
    if (t.hasAttribute('data-new')) { navigate('#/edoc/new', { state: { jh: 'fromList' } }); return; }
    if (t.hasAttribute('data-open')) { const [dt, did] = t.getAttribute('data-open').split('/'); navigate('#/edoc/doc/' + dt + '/' + did + '?tab=all', { state: { jh: 'fromList' } }); return; }
    if (t.hasAttribute('data-scope')) { model.scope = homeMemo.scope = t.getAttribute('data-scope'); setBox('edoc-pipe', pipelineHtml(model)); return; }
    if (t.hasAttribute('data-recent')) { model.tab = homeMemo.tab = t.getAttribute('data-recent'); setBox('edoc-recent', recentHtml(model)); return; }
    if (t.hasAttribute('data-pipe')) {   // 문서 현황 단계 → 결재함의 해당 상태 목록(범위에 맞는 탭)
      const key = t.getAttribute('data-pipe'); const tab = model.scope === 'all' && me.admin ? 'all' : 'mine';
      navigate('#/edoc/box?tab=' + tab + '&status=' + key, { state: { jh: 'fromList' } }); return;
    }
    const to = TO(t.getAttribute('data-go')); if (to) navigate(to, { state: { jh: 'fromList' } });
  };
}
