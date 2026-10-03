import { fetchAll, fetchOne } from './data.js?v=20261004d';
import { listHtml, detailHtml } from './views.js?v=20261004d';
import { tabCounts } from './logic.js?v=20261004d';
import { buildHash, navigate } from '../../core/router.js?v=20261004d';
import { db, collection, doc, addDoc, updateDoc, serverTimestamp } from '../../core/firebase.js?v=20261004d';
import { toast } from '../../core/ui.js?v=20261004d';
import { confirmDialog } from '../../core/dialog.js?v=20261004d';
import { loadDirectory } from './directory.js?v=20261004d';
import { act } from './api.js?v=20261004d';
import * as C from './compose.js?v=20261004d';
import { chooserHtml, composeHtml, lineEditorHtml } from './compose-view.js?v=20261004d';

const URL_DEFAULTS = { tab: 'todo', type: 'all', status: 'all', page: '1', size: '20' };   // 주소에서 생략하는 기본값

export const manifest = {
  id: 'edoc',
  title: '전자결재',
  icon: '✍',
  perm: (me) => me.admin || (me.perms && me.perms.edoc === true),
  defaultHash: '#/edoc/box'
};

let cache = { uid: null, docs: null };
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
    const t = ev.target.closest('[data-tab],[data-open],[data-back],[data-refresh],[data-page],[data-new],[data-do]'); if (!t) return;
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
  paint();

  const firstInvalid = () => { const el = root.querySelector('[data-invalid="true"]'); if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); const inp = el.querySelector('input,select,textarea'); if (inp) inp.focus({ preventScroll: true }); } };

  async function persist() {
    const base = { projects: dir.projects, now: S.createdMs ? new Date(S.createdMs) : new Date() };
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
    if (t.hasAttribute('data-line-search')) {
      S.ui.search = t.value.trim(); S.ui.picked = null; S.ui.lineError = ''; paintLine();
      const el = root.querySelector('[data-line-search]'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
      return;
    }
    if (t.hasAttribute('data-input')) { S.values[t.getAttribute('data-input')] = t.value; clear(t); }
    else if (t.hasAttribute('data-item')) { const [i, k] = t.getAttribute('data-item').split('.'); S.values.items[+i][k] = t.value; clear(t); }
  };
  const clear = (el) => { const f = el.closest('[data-invalid="true"]'); if (f) { f.removeAttribute('data-invalid'); } };
  root.onchange = (ev) => {
    const t = ev.target; if (!t.hasAttribute('data-input')) return;
    const key = t.getAttribute('data-input'); S.values[key] = t.value;
    if (S.type === 'leave' && (key === 'leaveType' || key === 'startDate' || key === 'endDate')) {
      const d = C.calcLeaveDays(S.values.startDate, S.values.endDate, S.values.leaveType);
      if (d !== '') { S.values.days = d; const el = root.querySelector('#f-days'); if (el) el.value = d; }
    }
    if (key === 'leaveKind') { sync(); paint(); }   // 휴직이면 복직 예정일 항목이 나타난다
  };

  root.onclick = async (ev) => {
    const t = ev.target.closest('[data-act],[data-kind],[data-add-item],[data-remove-item],[data-move],[data-remove],[data-pick],[data-add]'); if (!t) return;
    if (t.hasAttribute('data-kind')) { if (S.edit) return; sync(); S.values.kind = t.getAttribute('data-kind'); S.errors = {}; paint(); return; }
    if (t.hasAttribute('data-add-item')) { sync(); S.values.items = (S.values.items || []).concat(C.emptyItem()); paint(); const last = root.querySelectorAll('[data-item$=".name"]'); if (last.length) last[last.length - 1].focus(); return; }
    if (t.hasAttribute('data-remove-item')) { sync(); S.values.items.splice(+t.getAttribute('data-remove-item'), 1); paint(); return; }
    if (t.hasAttribute('data-move')) { const [uid, d] = t.getAttribute('data-move').split(':'); S.line = C.moveApprover(S.line, uid, +d); paintLine(); return; }
    if (t.hasAttribute('data-remove')) { const r = C.removeFromLine(S.line, t.getAttribute('data-remove'), S.ctx); S.line = r.state; S.ui.lineError = r.error || ''; paintLine(); return; }
    if (t.hasAttribute('data-pick')) { S.ui.picked = t.getAttribute('data-pick'); S.ui.lineError = ''; paintLine(); return; }
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
      S.errors = submit ? C.validate(S.type, S.values, { projects: dir.projects }) : quickErrors();
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
