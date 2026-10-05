import { fetchAll, fetchOne } from './data.js?v=20261005d';
import { listHtml, detailHtml } from './views.js?v=20261005d';
import { tabCounts } from './logic.js?v=20261005d';
import { buildHash, navigate } from '../../core/router.js?v=20261005d';
import { db, collection, doc, getDoc, addDoc, updateDoc, setDoc, serverTimestamp } from '../../core/firebase.js?v=20261005d';
import { toast } from '../../core/ui.js?v=20261005d';
import { confirmDialog } from '../../core/dialog.js?v=20261005d';
import { loadDirectory, resetDirectory } from './directory.js?v=20261005d';
import { act } from './api.js?v=20261005d';
import * as C from './compose.js?v=20261005d';
import { paperHtml, printPanelHtml, canPrint } from './print-view.js?v=20261005d';
import { loadAttendRecord } from '../../shared/attendance-load.js?v=20261005d';
import { homeLists, homeHtml, worktimeHtml, leaveBoxHtml, todoHtml, pipelineHtml, recentHtml, homeTarget } from './home-view.js?v=20261005d';
import { todoCounts } from './home-stats.js?v=20261005d';
import { loadWorkers, loadMonthAttendance, loadHolidays } from './home-data.js?v=20261005d';
import { findWorker, calcLeaveBalance, computeLeaveHoursForMonth, monthlyStandardHours, monthlyMaxOvertimeHours, worktimeSummary, leaveDocsOf } from './home-calc.js?v=20261005d';
import { adminHtml, policyHtml, guideHtml, companyHtml } from './settings-view.js?v=20261005d';
import * as AT from './attach-logic.js?v=20261005d';
import { uploadFile, removeFile, openFile } from './attach.js?v=20261005d';
import * as SL from './settings-logic.js?v=20261005d';
import { chooserHtml, composeHtml, lineEditorHtml, suggestHtml, balanceHintHtml, attendHintHtml, attachHtml } from './compose-view.js?v=20261005d';

const URL_DEFAULTS = { tab: 'todo', type: 'all', status: 'all', page: '1', size: '20' };   // 주소에서 생략하는 기본값

export const manifest = {
  id: 'edoc',
  order: 30,
  title: '전자결재',
  icon: '✍',
  perm: (me) => me.admin || (me.perms && me.perms.edoc === true),
  defaultHash: '#/edoc/home',
  quick: { label: '새 문서 작성', icon: '✍', hash: '#/edoc/new' },   // 폰 하단 막대 버튼
  hideQuickOn: ['new', 'edit', 'print', 'admin'],                                // 이미 작성·인쇄 중인 화면에서는 숨김
  widgets: [{ id: 'leave', order: 15, reserve: 'tall', mount: mountLeaveWidget }, { id: 'todo', order: 20, wide: true, reserve: 'medium', mount: mountTodoWidget }]   // 플랫폼 홈에 놓이는 위젯
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
  if (kind === 'admin') return mountAdmin(root, route, ctx);
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
      const r = await confirmDialog({ title: '승인', body: '"' + (d.title || '이 문서') + '"을(를) 승인합니다.' + (d.dtype === 'attend' ? '\n마지막 결재자가 승인하면 출퇴근 기록에 바로 반영됩니다.' : ''), confirmLabel: '승인', reason: { label: '결재 의견 (선택)', placeholder: '작성자와 다음 결재자에게 전할 말이 있으면 적어 주세요', required: false } });
      if (r.ok) await call({ action: 'approve', comment: r.reason }, '승인했습니다.'); return;
    }
    if (key === 'approve_post') {
      const line = d.approvalLine || []; const cur = line.findIndex(s => s.status === 'pending' && /^결재/.test(s.role));
      const rest = line.filter((s, i) => i > cur && /^결재/.test(s.role) && s.status === 'pending').length;
      const r = await confirmDialog({ title: '승인 후 게시(전결)', body: '내 단계를 승인하고 문서를 바로 게시합니다.' + (rest ? '\n남은 결재 ' + rest + '단계는 건너뜁니다(전결 생략으로 기록).' : ''), confirmLabel: '승인 후 게시', reason: { label: '결재 의견 (선택)', placeholder: '남길 의견이 있으면 적어 주세요', required: false } });
      if (r.ok) await call({ action: 'approve', post: true, comment: r.reason }, '승인하고 게시했습니다.'); return;
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
    const t = ev.target.closest('[data-tab],[data-open],[data-back],[data-refresh],[data-page],[data-new],[data-do],[data-home],[data-file]'); if (!t) return;
    if (t.hasAttribute('data-file')) { openFile(t.getAttribute('data-file')).catch((e) => toast((e && e.message) || '파일을 열지 못했습니다.')); return; }
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

  const S = { files: [], uploading: [], attachError: '', type: null, values: null, errors: {}, line: null, ui: { search: '', picked: null, lineError: '' }, edit: null, rejectReason: '', formError: '', busy: false, ctx: null, docRef: null, createdMs: null };
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
    S.files = AT.sanitizeList(d.attachments); S.edit = { dtype: d.dtype, id: d.id }; S.docRef = S.edit; S.rejectReason = d.status === 'rejected' ? (d.rejectReason || '') : ''; S.createdMs = d._ms;
  } else {
    const type = route.segs[1];
    if (!C.composeType(type)) { navigate('#/edoc/new', { replace: true }); return; }
    S.type = type; S.values = C.defaultValues(type, me); S.ctx = lc(type); S.line = C.initialLine(S.ctx);
    if (type === 'attend' && route.query) {   // 출퇴근 기록 화면에서 넘어온 값으로 미리 채운다(날짜·출근·퇴근)
      const q = route.query; if (/^\d{4}-\d{2}-\d{2}$/.test(q.date || '')) S.values.date = q.date;
      if (/^\d{2}:\d{2}$/.test(q.in || '')) S.values.checkIn = q.in; if (/^\d{2}:\d{2}$/.test(q.out || '')) S.values.checkOut = q.out;
    }
  }
  S.worker = undefined;   // 근태 기록 수정 요청: 근무자 명부와 연동된 계정만(서버도 다시 확인)
  if (S.type === 'attend') { try { const w = findWorker(await loadWorkers(false), me); S.worker = w && w.linked ? w : null; } catch (e) { S.worker = null; } }

  const paint = () => { root.innerHTML = '<div class="jh-card">' + composeHtml(S) + '</div>'; };
  let attendSeq = 0;
  const updateAttend = async () => {   // 근태 요청: 근무시간 계산과 그 날의 현재 기록(날짜가 바뀌면 다시 조회)
    const v = S.values; const ok = /^([01]\d|2[0-3]):[0-5]\d$/;
    const hours = ok.test(v.checkIn || '') && ok.test(v.checkOut || '') && v.checkIn !== v.checkOut ? C.attendHoursOf(v.checkIn, v.checkOut) : null;
    S.attend = Object.assign({}, S.attend, { date: v.date, hours });
    const el = () => root.querySelector('#edoc-attend-hint'); if (el()) el().innerHTML = attendHintHtml(S.attend);
    if (S.attend.loadedDate !== v.date && /^\d{4}-\d{2}-\d{2}$/.test(v.date || '') && S.worker) {
      const seq = ++attendSeq; S.attend.loadedDate = v.date;
      try { const cur = await loadAttendRecord(S.worker.id, v.date); if (seq !== attendSeq) return; S.attend.current = cur && cur.checkIn ? cur : null; } catch (e) { S.attend.current = null; }
      if (el()) el().innerHTML = attendHintHtml(S.attend);
    }
  };
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
  if (S.type === 'attend') updateAttend();
  if (S.type === 'leave') {   // 내 잔여 연차를 불러와 신청 화면에 안내(명부에 입사일이 없으면 안내 생략)
    (async () => {
      try {
        const w = findWorker(await loadWorkers(false), me); if (!w || !w.hireDate) return;
        S.balance = calcLeaveBalance(w.hireDate, leaveDocsOf(await ensureDocs(me, false), me)); updateBalance();
      } catch (e) { /* 안내만 생략 */ }
    })();
  }

  const firstInvalid = () => { const el = root.querySelector('[data-invalid="true"]'); if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); const inp = el.querySelector('input,select,textarea'); if (inp) inp.focus({ preventScroll: true }); } };

  const paintAttach = () => { const el = root.querySelector('#edoc-attach'); if (el) el.innerHTML = attachHtml(S); };
  /** 첨부는 문서 번호가 필요하므로, 새 문서면 먼저 임시저장해 번호를 만든다 */
  async function ensureDoc() {
    if (S.docRef) return S.docRef;
    sync(); const bad = quickErrors();
    if (Object.keys(bad).length) { S.errors = bad; paint(); throw new Error('입력 형식이 올바르지 않은 항목을 먼저 고쳐 주세요.'); }
    await persist(); S.edit = S.docRef; toast('첨부를 위해 임시저장했습니다.'); return S.docRef;
  }
  const saveAttachments = () => updateDoc(doc(db, 'edoc_' + S.docRef.dtype, S.docRef.id), { attachments: S.files.slice(), updatedAt: serverTimestamp() });
  async function addFiles(fileList) {
    S.attachError = ''; const picked = Array.from(fileList || []); if (!picked.length) return;
    const accepted = []; const errors = [];
    picked.forEach((f) => { const r = AT.checkFile(f, S.files.concat(S.uploading, accepted)); if (r.ok) accepted.push(f); else errors.push(r.error); });
    if (errors.length) S.attachError = errors.join('\n');
    if (!accepted.length) { paintAttach(); return; }
    let ref; try { ref = await ensureDoc(); } catch (e) { S.attachError = (e && e.message) || '첨부할 수 없습니다.'; paintAttach(); return; }
    accepted.forEach((f) => { f.__u = { name: f.name, pct: 0 }; S.uploading.push(f.__u); }); paintAttach();
    for (const f of accepted) {
      try {
        const meta = await uploadFile({ dtype: ref.dtype, docId: ref.id, file: f, onProgress: (p) => { f.__u.pct = p; paintAttach(); } });
        S.files = S.files.concat(meta);
        S.uploading = S.uploading.filter((u) => u !== f.__u); await saveAttachments();
      } catch (e) { S.uploading = S.uploading.filter((u) => u !== f.__u); S.attachError = (S.attachError ? S.attachError + '\n' : '') + '"' + f.name + '": ' + ((e && e.message) || '올리지 못했습니다.'); }
      paintAttach();
    }
  }
  async function dropFile(id) {
    const f = S.files.find((x) => x.id === id); if (!f) return;
    S.attachError = '';
    try { await removeFile(f.path); S.files = S.files.filter((x) => x.id !== id); if (S.docRef) await saveAttachments(); }
    catch (e) { S.attachError = (e && e.message) || '지우지 못했습니다.'; }
    paintAttach();
  }

  async function persist() {
    const base = { projects: dir.projects, users: dir.users, worker: S.worker, now: S.createdMs ? new Date(S.createdMs) : new Date() };
    const data = Object.assign(C.buildDocData(S.type, S.values, me, base), { attachments: S.files.slice() });
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
    if (t.hasAttribute('data-input')) { S.values[t.getAttribute('data-input')] = t.value; clear(t); if (t.getAttribute('data-input') === 'days') updateBalance(); if (S.type === 'attend') updateAttend(); }
    else if (t.hasAttribute('data-item')) { const [i, k] = t.getAttribute('data-item').split('.'); S.values.items[+i][k] = t.value; clear(t); }
  };
  const clear = (el) => { const f = el.closest('[data-invalid="true"]'); if (f) { f.removeAttribute('data-invalid'); } };
  root.onchange = (ev) => {
    const t = ev.target;
    if (t.hasAttribute && t.hasAttribute('data-attach-input')) { const fl = Array.from(t.files || []); t.value = ''; addFiles(fl); return; }
    if (!t.hasAttribute('data-input')) return;
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
    const t = ev.target.closest('[data-act],[data-kind],[data-add-item],[data-remove-item],[data-move],[data-remove],[data-pick],[data-add],[data-attach-pick],[data-attach-remove],[data-attach-open]'); if (!t) return;
    if (t.hasAttribute('data-attach-pick')) { const inp = root.querySelector('#edoc-file-input'); if (inp) inp.click(); return; }
    if (t.hasAttribute('data-attach-remove')) { dropFile(t.getAttribute('data-attach-remove')); return; }
    if (t.hasAttribute('data-attach-open')) { openFile(t.getAttribute('data-attach-open')).catch((e) => { S.attachError = (e && e.message) || '파일을 열지 못했습니다.'; paintAttach(); }); return; }
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
      if (S.uploading.length) { toast('파일을 올리는 중입니다. 잠시 후 다시 눌러 주세요.'); return; }
      sync(); S.formError = ''; S.errors = {};
      const submit = act_ === 'submit';
      S.errors = submit ? C.validate(S.type, S.values, { projects: dir.projects, users: dir.users, meUid: me.uid, worker: S.worker }) : quickErrors();
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
      // 설정은 서버 함수가 검증해 저장한다(직원 화면이 직접 쓰지 않음)
      try { await act({ action: 'saveSettings', kind: 'company', company: { name: (company.name || '').trim(), ceo: (company.ceo || '').trim(), bizNo: (company.bizNo || '').trim(), address: (company.address || '').trim() } }); toast('회사 정보를 저장했습니다.'); }
      catch (e) { toast(e.message || '저장하지 못했습니다. 권한을 확인해 주세요.'); }
    }
  };
}

/* ───────────────────────── 관리자 설정 ───────────────────────── */
async function mountAdmin(root, route, ctx) {
  const { me } = ctx;
  root.onclick = null; root.onchange = null; root.oninput = null; window.scrollTo(0, 0);
  if (!me.admin) { root.innerHTML = '<div class="jh-empty">관리자만 열 수 있는 화면입니다.</div><button type="button" class="jh-btn" data-variant="ghost" data-back>← 전자결재 홈</button>'; root.onclick = (ev) => { if (ev.target.closest('[data-back]')) navigate('#/edoc/home'); }; return; }
  root.innerHTML = '<div class="jh-empty">불러오는 중…</div>';
  let dir = null; let company = {};
  try { dir = await loadDirectory(true); const s = await getDoc(doc(db, 'edoc_settings', 'company')); if (s.exists()) company = s.data(); }
  catch (e) { console.error('설정 조회 오류', e); root.innerHTML = '<div class="jh-empty">설정을 불러오지 못했습니다. 새로고침해 주세요.</div>'; return; }
  const S = SL.initState(dir, company, me);
  const redraw = () => { const y = window.scrollY; root.innerHTML = adminHtml(S); window.scrollTo(0, y); };
  const target = (scope) => { const [a, b] = scope.split('.'); return a === 'policy' ? { list: S.policy[b], set: (v) => { S.policy[b] = v; }, max: SL.LIMITS[b], approver: true } : { list: S.guides[a][b], set: (v) => { S.guides[a][b] = v; }, max: b === 'steps' ? SL.LIMITS.approvers : SL.LIMITS.cc, approver: b === 'steps' }; };
  redraw();
  root.oninput = (ev) => {
    const t = ev.target; if (!t.getAttribute) return;
    const note = t.getAttribute('data-note'); const co = t.getAttribute('data-co');
    if (note) { S.guides[note].note = t.value; const bar = t.closest('section').querySelector('[data-save]'); const st = t.closest('section').querySelector('.jh-admin__state'); const d = SL.isDirty(S, 'guides', note); if (bar) bar.disabled = !d; if (st) { st.dataset.dirty = d ? 'true' : 'false'; st.textContent = d ? '저장하지 않은 변경이 있습니다' : '변경 없음'; } }
    if (co) { S.company[co] = t.value; const sec = t.closest('section'); const d = SL.isDirty(S, 'company'); const bar = sec.querySelector('[data-save]'); const st = sec.querySelector('.jh-admin__state'); if (bar) bar.disabled = !d; if (st) { st.dataset.dirty = d ? 'true' : 'false'; st.textContent = d ? '저장하지 않은 변경이 있습니다' : '변경 없음'; } }
  };
  root.onclick = async (ev) => {
    const t = ev.target.closest('[data-back],[data-toggle],[data-add],[data-remove],[data-move],[data-save]'); if (!t) return;
    if (t.hasAttribute('data-back')) { navigate('#/edoc/home'); return; }
    if (t.hasAttribute('data-toggle')) { const k = t.getAttribute('data-toggle'); S.open = S.open === k ? '' : k; redraw(); return; }
    if (t.hasAttribute('data-add')) {
      const scope = t.getAttribute('data-add'); const sel = root.querySelector('[data-add-sel="' + scope + '"]'); const tg = target(scope);
      const r = SL.addTo(tg.list, sel && sel.value, tg.max); if (r.error) { toast(r.error); return; }
      tg.set(r.list); redraw(); return;
    }
    if (t.hasAttribute('data-remove')) { const [scope, uid] = t.getAttribute('data-remove').split(':'); const tg = target(scope); tg.set(SL.removeFrom(tg.list, uid)); redraw(); return; }
    if (t.hasAttribute('data-move')) { const [scope, uid, dir2] = t.getAttribute('data-move').split(':'); const tg = target(scope); tg.set(SL.moveIn(tg.list, uid, Number(dir2))); redraw(); return; }
    if (t.hasAttribute('data-save')) {
      const [section, key] = t.getAttribute('data-save').split(':'); const bad = SL.validateSection(S, section, key); if (bad) { toast(bad); return; }
      S.saving = section + ':' + (key || ''); redraw();
      try { await act(SL.payloadFor(section, S, key)); SL.markSaved(S, section, key); toast('저장했습니다.'); resetDirectory(); }
      catch (e) { toast(e.message || '저장하지 못했습니다.'); }
      S.saving = ''; redraw();
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

  const TO = (go) => homeTarget(go, me);
  root.onclick = (ev) => {
    const t = ev.target.closest('[data-go],[data-open],[data-new],[data-scope],[data-recent],[data-pipe],[data-admin]'); if (!t) return;
    if (t.hasAttribute('data-admin')) { navigate('#/edoc/admin'); return; }
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

/* ───────────────────────── 플랫폼 홈 위젯 ───────────────────────── */
const widgetShell = (title, link, body) => '<div class="jh-panel jh-card"><div class="jh-panel__head"><h3>' + title + '</h3>' + (link || '') + '</div>' + body + '</div>';
const loadingBox = (title) => widgetShell(title, '', '<div class="jh-empty">불러오는 중…</div>');
const failBox = (title) => widgetShell(title, '', '<div class="jh-form"><div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</div></div>');

/** 결재 현황 위젯: 결재 요청·반려·게시 대기·수신함 카드(눌러서 결재함으로) */
async function mountTodoWidget(slot, ctx) {
  const { me } = ctx; const T = '✍️ 전자결재';
  slot.innerHTML = loadingBox(T);
  try {
    const [docs] = await Promise.all([ensureDocs(me, false), withPolicy(me)]);
    ctx.setBadge('edoc', tabCounts(docs, me).todo);
    slot.innerHTML = widgetShell(T, '<a class="jh-link" href="#/edoc/home">전자결재 홈 ›</a>', '<div class="jh-form">' + todoHtml(todoCounts(docs, me)) + '</div>');
    slot.addEventListener('click', (ev) => { const t = ev.target.closest('[data-go]'); if (!t) return; const to = homeTarget(t.getAttribute('data-go'), me); if (to) navigate(to, { state: { jh: 'fromList' } }); });
  } catch (e) { console.error('결재 현황 위젯', e); slot.innerHTML = failBox(T); }
}
/** 내 연차 현황 위젯: 링 그래프 + 부여·사용·잔여 */
async function mountLeaveWidget(slot, ctx) {
  const { me } = ctx;
  slot.innerHTML = leaveBoxHtml({ state: 'loading' });
  try {
    const docs = await ensureDocs(me, false); let worker = null;
    try { worker = findWorker(await loadWorkers(false), me); } catch (e) { worker = null; }
    slot.innerHTML = leaveBoxHtml(!worker || !worker.hireDate ? { state: 'nohire' } : { state: 'ok', balance: calcLeaveBalance(worker.hireDate, leaveDocsOf(docs, me)) });
  } catch (e) { console.error('연차 위젯', e); slot.innerHTML = leaveBoxHtml({ state: 'error' }); }
}
