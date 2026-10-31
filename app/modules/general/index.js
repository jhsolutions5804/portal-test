import { db, auth, functions, httpsCallable, collection, getDocs, addDoc, updateDoc, deleteDoc, setDoc, doc, serverTimestamp } from '../../core/firebase.js?v=20261031d';
import { esc, toast } from '../../core/ui.js?v=20261031d';
import { confirmDialog } from '../../core/dialog.js?v=20261031d';
import { GTYPES, GKEYS, kstToday, formToDoc, docToForm, newDefaults, SEED, driveCsv, addDays, parseDriveHistory, assignProject, matchHistory, creditFltDefault, creditCsv } from './logic.js?v=20261031d';
import { tabsHtml, homeHtml, listHtml, tableHtml, driveHtml, driveSelect, creditLogAreaHtml, creditCorpHtml, creditShownIdx } from './view.js?v=20261031d';

/** 총무(플랫폼 기본 모듈): 임대·차량·자산·갱신 일정을 한 곳에서. 관리자 전용 — 데이터는 general_* 컬렉션(보안 규칙에서 관리자 전용으로 잠가야 한다) */
/* 사이드바에는 따로 올리지 않는다(modules/index.js 의 MODULES 에 없음) — 인사총무 구역으로만 열린다. manifest 는 모듈 규약상 남겨 둔다 */
export const manifest = { id: 'general', order: 25, title: '총무', icon: '🗂️', defaultHash: '#/general/home', perm: (me) => !!me && me.admin === true };
const strRow = (r) => { const o = {}; Object.keys(r || {}).forEach((k) => { o[k] = r[k] == null ? '' : String(r[k]); }); return o; };
/** 인사총무 틀 안의 총무 구역으로 열기 — 주소는 #/hr/general/… */
export const mountSection = (root, route, ctx) => mount(root, route, ctx, { base: '#/hr/general', noTabs: true });   // 인사총무 안에서는 왼쪽 사이드바가 총무 메뉴를 대신한다
export async function mount(root, route, ctx, opts) {
  const BASE = (opts && opts.base) || '#/general'; const want = route.segs[0]; const tab = want === 'home' || want === 'drive' || GKEYS.includes(want) ? want : 'home'; const openId = route.segs[1] || '';
  root.onclick = null; root.oninput = null; root.onchange = null;
  const st = { drive: { mode: 'all', anchor: kstToday(), ym: kstToday().slice(0, 7), vehicleId: '', driver: '', pjtKey: '', approvedOnly: false, docs: [], hist: [], imp: null, projects: [], pa: { kw: '', pjt: '', from: '', to: '', over: false } }, base: BASE, data: {}, today: kstToday(), q: '', onlyActive: true, edit: null, seed: { lease: SEED.lease.length, vehicle: SEED.vehicle.length, asset: SEED.asset.length, renewal: SEED.renewal.length } };
  root.innerHTML = '<div class="jh-general">' + ((opts && opts.noTabs) ? '' : tabsHtml(tab, BASE)) + '<div id="g-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div></div>';
  const body = root.querySelector('#g-body'); const need = tab === 'home' ? GKEYS : tab === 'drive' ? ['vehicle'] : [tab];
  const load = async () => { await Promise.all(need.map(async (k) => { const s = await getDocs(collection(db, GTYPES[k].coll)); const arr = []; s.forEach((d) => arr.push(Object.assign({ id: d.id }, d.data()))); arr.sort((a, b) => String(GTYPES[k].label(a)).localeCompare(String(GTYPES[k].label(b)), 'ko')); st.data[k] = arr; })); };
  const loadDrive = async () => { const s = await getDocs(collection(db, 'edoc_drive')); const arr = []; s.forEach((d) => { const x = d.data(); arr.push(Object.assign({ id: d.id }, x, { createdMs: x.createdAt && x.createdAt.toMillis ? x.createdAt.toMillis() : 0 })); }); st.drive.docs = arr; const hs = await getDocs(collection(db, 'general_drive_history')); const ha = []; hs.forEach((d) => ha.push(Object.assign({ id: d.id }, d.data()))); st.drive.hist = ha; try { const ps = await getDocs(collection(db, 'gihoek_projects')); const pl = []; ps.forEach((d) => { const x = d.data(); if (x && x.name) pl.push({ id: d.id, code: x.code || '', name: x.name || '' }); }); st.drive.projects = pl.sort((a, b) => (a.code + a.name).localeCompare(b.code + b.name, 'ko')); } catch (e) { st.drive.projects = []; } };
  try { await load(); if (tab === 'drive') { await loadDrive(); const actv = (st.data.vehicle || []).filter(GTYPES.vehicle.active); if (actv.length === 1) st.drive.vehicleId = actv[0].id; } } catch (e) { body.innerHTML = '<div class="jh-alert" data-tone="danger" role="alert">불러오지 못했습니다: ' + esc((e && e.message) || '') + '<br>보안 규칙에 총무 컬렉션(관리자 허용)이 반영되었는지 확인해 주세요.</div>'; return; }
  body.removeAttribute('aria-busy');
  const paint = () => { body.innerHTML = tab === 'home' ? homeHtml(st) : tab === 'drive' ? driveHtml(st) : listHtml(st, tab); if (st.edit) { const e = body.querySelector('[data-gf]'); if (e && st.edit.fresh) { st.edit.fresh = false; e.scrollIntoView({ block: 'center' }); } } };
  const openEdit = (type, id) => {
    const d = id ? (st.data[type] || []).find((x) => x.id === id) : null; const T = GTYPES[type]; if (id && !d) return;
    st.edit = { type, id: id || '', isNew: !id, fresh: true, flt: type === 'credit' ? creditFltDefault() : null, vals: d ? docToForm(type, d) : newDefaults(type), rows: d && T.log ? (d[T.log.k] || []).map(strRow) : [] }; paint();
  };
  const reloadSoft = async () => { await load(); };
  /** 전자결재 "차량 운행일지"의 차량 선택 목록(edoc_settings/vehicles)을 사용 중인 차량으로 맞춘다 — 서버 함수가 관리자만 허용 */
  const syncVehicles = async () => {
    try { const list = (st.data.vehicle || []).filter(GTYPES.vehicle.active).map((v) => ({ id: v.id, name: v.name || '', plate: v.plate || '' })); await httpsCallable(functions, 'edocAct')({ action: 'saveSettings', kind: 'vehicles', vehicles: list }); toast('운행일지 차량 목록을 갱신했습니다(' + list.length + '대).'); return true; }
    catch (e) { toast('운행일지 차량 목록을 갱신하지 못했습니다: ' + ((e && e.message) || '') + ' — 서버 최신 배포 후 "운행일지 차량 목록 동기화"를 눌러 주세요.'); return false; }
  };
  const uidNow = () => (auth.currentUser && auth.currentUser.uid) || '';
  const newLogRow = () => {
    const e = st.edit; const L = GTYPES[e.type].log; const r = {}; const num = (s) => Number(String(s || '').replace(/[,\s원]/g, '')) || 0;
    L.cols.forEach((c) => { r[c.k] = ''; if (c.t === 'date' && c.req) r[c.k] = st.today; if (c.t === 'ym') r[c.k] = st.today.slice(0, 7); if (c.t === 'select' && c.req) r[c.k] = c.o[0]; });
     if (e.type === 'lease') r.amount = String(num(e.vals.rent) + num(e.vals.vat) || '');
    return r;
  };
  root.onclick = async (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return;
    if (tab === 'drive') {
      const f = st.drive;
      const kwb = t.closest('[data-d-kw]'); if (kwb) { f.pa.kw = kwb.getAttribute('data-d-kw'); paint(); return; }
      if (t.closest('[data-d-pa-go]')) {
        const p = f.pa; const proj = p.pjt === 'common' ? { id: 'common' } : (f.projects || []).find((x) => x.id === p.pjt); const mt = matchHistory(f.hist, p); if (!proj || !mt.n) return;
        const ok = await confirmDialog({ title: '프로젝트 지정', body: '내용에 "' + p.kw + '"가 들어 있는 ' + mt.n + '줄(' + Math.round(mt.km).toLocaleString('ko-KR') + 'km, ' + mt.months + '개월)을 ' + (proj.id === 'common' ? '"공통(프로젝트 무관)"' : '"' + ((proj.code ? proj.code + ' · ' : '') + proj.name) + '"') + '(으)로 지정합니다.' + (p.over ? ' 이미 지정된 줄도 바꿉니다.' : ''), confirmLabel: '지정' }); if (!ok.ok) return;
        try { const r = assignProject(f.hist, p, proj); for (const m of r.changed) await updateDoc(doc(db, 'general_drive_history', m.ym), { rows: m.rows, updatedAt: serverTimestamp(), updatedBy: uidNow() }); toast(r.n + '줄에 프로젝트를 지정했습니다.'); await loadDrive(); f.pa.kw = ''; paint(); }
        catch (e) { toast('지정하지 못했습니다: ' + ((e && e.message) || '')); }
        return;
      }
      if (t.closest('[data-d-imp-cancel]')) { f.imp = null; paint(); return; }
      if (t.closest('[data-d-imp-go]') && f.imp && f.imp.ok) {
        const b = f.imp.bundle; const ok = await confirmDialog({ title: '과거 일지 가져오기', body: f.imp.summary.rows + '줄(' + f.imp.summary.from + ' ~ ' + f.imp.summary.to + ')을 가져옵니다. 차량이 없으면 새로 등록하고, 이미 가져온 달은 덮어씁니다.', confirmLabel: '가져오기' }); if (!ok.ok) return;
        try {
          const map = {}; for (const v of b.vehicles) { const ex = (st.data.vehicle || []).find((x) => x.name === v.name); if (ex) { map[v.key] = ex.id; continue; } const r = formToDoc('vehicle', v, []); const ref = await addDoc(collection(db, GTYPES.vehicle.coll), Object.assign({}, r.doc, { createdAt: serverTimestamp(), createdBy: uidNow(), updatedAt: serverTimestamp() })); map[v.key] = ref.id; }
          for (const m of b.months) await setDoc(doc(db, 'general_drive_history', m.ym), { ym: m.ym, rows: m.rows.map((r) => Object.assign({}, r, { vehicleId: map[r.v] })), source: b.source || '', importedAt: serverTimestamp(), importedBy: uidNow() });
          toast(f.imp.summary.rows + '줄을 가져왔습니다.'); f.imp = null; await reloadSoft(); await loadDrive(); await syncVehicles(); const actv2 = (st.data.vehicle || []).filter(GTYPES.vehicle.active); if (actv2.length === 1) f.vehicleId = actv2[0].id; paint();
        } catch (e) { toast('가져오지 못했습니다: ' + ((e && e.message) || '')); }
        return;
      }
      const dm = t.closest('[data-d-mode]'); if (dm) { f.mode = dm.getAttribute('data-d-mode'); if (f.mode !== 'project') f.pjtKey = ''; paint(); return; }
      const dn = t.closest('[data-d-nav]'); if (dn) { const n = Number(dn.getAttribute('data-d-nav')); if (f.mode === 'day') f.anchor = addDays(f.anchor, n); else if (f.mode === 'week') f.anchor = addDays(f.anchor, 7 * n); else if (f.mode === 'month') { const [y, m] = f.ym.split('-').map(Number); f.ym = new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7); } paint(); return; }
      const dp = t.closest('[data-d-pjt]'); if (dp) { f.pjtKey = dp.getAttribute('data-d-pjt'); paint(); return; }
      if (t.closest('[data-g-act="d-csv"]')) { const sel = driveSelect(st); const nm = sel.vsel ? sel.vsel.name : '전체 차량'; const blob = new Blob([driveCsv(sel.rows, '차량 운행기록부 — ' + nm + ' (' + (f.mode === 'month' ? f.ym : f.mode === 'day' ? f.anchor : '기간') + ')')], { type: 'text/csv;charset=utf-8' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = '운행기록부_' + nm.replace(/[^\w가-힣]+/g, '_') + '_' + kstToday() + '.csv'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); return; }
    }
    if (t.closest('[data-g-sync]')) { await syncVehicles(); return; }
    const go = t.closest('[data-g-go]'); if (go) { location.hash = BASE + '/' + go.getAttribute('data-g-go') + '/' + go.getAttribute('data-g-id'); return; }
    if (t.closest('[data-g-add]')) { openEdit(tab, ''); return; }
    const op = t.closest('[data-g-open]'); if (op && !t.closest('input,select,button,textarea')) { openEdit(tab, op.getAttribute('data-g-open')); return; }
    if (t.closest('[data-g-credit-csv]') && st.edit && st.edit.type === 'credit') {
 const rowsV = creditShownIdx(st.edit).map((i) => st.edit.rows[i]); const nm = GTYPES.credit.label(st.edit.vals);
 const blob = new Blob([creditCsv(rowsV, '외상 장부 — ' + nm)], { type: 'text/csv;charset=utf-8' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = '외상장부_' + String(nm).replace(/[^\w가-힣]+/g, '_') + '_' + kstToday() + '.csv'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); return;
 }
 if (t.closest('[data-g-logadd]')) { if (st.edit.type === 'credit') st.edit.flt = Object.assign(creditFltDefault(), { desc: !!(st.edit.flt && st.edit.flt.desc) }); st.edit.rows.push(newLogRow()); paint(); return; }
    const ld = t.closest('[data-g-logdel]'); if (ld) { st.edit.rows.splice(Number(ld.getAttribute('data-g-logdel')), 1); paint(); return; }
    if (t.closest('[data-g-seed]')) {
      const arr = SEED[tab] || []; if (!arr.length) return; const ok = await confirmDialog({ title: '엑셀 기준 첫 목록 넣기', body: '월간 손익계산서 엑셀·지하111호 입금내역에서 확인된 ' + arr.length + '건을 ' + GTYPES[tab].title + ' 목록에 넣습니다. 넣은 뒤 각 항목을 열어 내용을 확인·수정하세요.', confirmLabel: '넣기' }); if (!ok.ok) return;
      try { for (const d of arr) await addDoc(collection(db, GTYPES[tab].coll), Object.assign({}, d, { createdAt: serverTimestamp(), createdBy: uidNow(), updatedAt: serverTimestamp() })); toast(arr.length + '건을 넣었습니다.'); await reloadSoft(); if (tab === 'vehicle') await syncVehicles(); paint(); } catch (e) { toast('넣지 못했습니다: ' + ((e && e.message) || '')); } return;
    }
    const act = t.closest('[data-g-act]'); if (!act || !st.edit) return; const a = act.getAttribute('data-g-act'); const e = st.edit; const T = GTYPES[e.type];
    if (a === 'cancel') { st.edit = null; if (openId) history.replaceState(history.state, '', BASE + '/' + tab); paint(); return; }
    if (a === 'delete') { const ok = await confirmDialog({ title: T.title + ' 항목 삭제', body: '"' + T.label(e.vals) + '" 항목과 그 이력을 지웁니다. 되돌릴 수 없습니다.', confirmLabel: '삭제', variant: 'danger' }); if (!ok.ok) return; try { await deleteDoc(doc(db, T.coll, e.id)); toast('삭제했습니다.'); st.edit = null; await reloadSoft(); if (e.type === 'vehicle') await syncVehicles(); paint(); } catch (er) { toast('삭제하지 못했습니다: ' + ((er && er.message) || '')); } return; }
    if (a === 'save') {
      const res = formToDoc(e.type, e.vals, e.rows); if (res.errors.length) { toast(res.errors[0]); return; }
      try { if (e.isNew) await addDoc(collection(db, T.coll), Object.assign({}, res.doc, { createdAt: serverTimestamp(), createdBy: uidNow(), updatedAt: serverTimestamp() })); else await updateDoc(doc(db, T.coll, e.id), Object.assign({}, res.doc, { updatedAt: serverTimestamp(), updatedBy: uidNow() })); toast('저장했습니다.'); st.edit = null; await reloadSoft(); if (e.type === 'vehicle') await syncVehicles(); paint(); } catch (er) { toast('저장하지 못했습니다: ' + ((er && er.message) || '')); }
    }
  };
  root.oninput = (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return;
    if (t.matches('[data-gf]') && st.edit) { st.edit.vals[t.getAttribute('data-gf')] = t.value; return; }
    if (t.matches('[data-glf]') && st.edit) { const k = t.getAttribute('data-glf'); st.edit.flt = st.edit.flt || creditFltDefault(); st.edit.flt[k] = t.type === 'checkbox' ? t.checked : t.value; const w = body.querySelector('#g-logwrap'); if (w) w.innerHTML = creditLogAreaHtml(st.edit); return; }
 if (t.matches('[data-gl]') && st.edit) { const [i, k] = t.getAttribute('data-gl').split(':'); if (st.edit.rows[Number(i)]) st.edit.rows[Number(i)][k] = t.value; return; }
    if (t.matches('[data-g-q]')) { st.q = t.value; const tb = body.querySelector('#g-table'); if (tb) tb.innerHTML = tableHtml(st, tab); const cp = body.querySelector('#g-corp'); if (cp) cp.innerHTML = creditCorpHtml(st); }
  };
  root.onchange = (ev) => {
    const t = ev.target; if (!(t instanceof Element)) return;
    if (tab === 'drive') {
      const f = st.drive;
      if (t.matches('[data-d-pa]')) { f.pa[t.getAttribute('data-d-pa')] = t.value; paint(); return; }
      if (t.matches('[data-d-pa-over]')) { f.pa.over = t.checked; paint(); return; }
      if (t.matches('[data-d-import]')) { const file = t.files && t.files[0]; t.value = ''; if (!file) return; file.text().then((txt) => { f.imp = parseDriveHistory(txt); paint(); }).catch(() => { f.imp = { ok: false, errors: ['파일을 읽지 못했습니다.'] }; paint(); }); return; }
      if (t.matches('[data-d-anchor]')) { if (/^\d{4}-\d{2}-\d{2}$/.test(t.value)) { f.anchor = t.value; paint(); } return; }
      if (t.matches('[data-d-ym]')) { if (/^\d{4}-\d{2}$/.test(t.value)) { f.ym = t.value; paint(); } return; }
      if (t.matches('[data-d-f]')) { f[t.getAttribute('data-d-f')] = t.value; paint(); return; }
      if (t.matches('[data-d-approved]')) { f.approvedOnly = t.checked; paint(); return; }
    }
    if (t.matches('[data-g-active]')) { st.onlyActive = t.checked; const tb = body.querySelector('#g-table'); if (tb) tb.innerHTML = tableHtml(st, tab); const cp = body.querySelector('#g-corp'); if (cp) cp.innerHTML = creditCorpHtml(st); return; }
 if (t.matches('[data-g-kind]')) { st.kind = t.value; const tb = body.querySelector('#g-table'); if (tb) tb.innerHTML = tableHtml(st, tab); const cp = body.querySelector('#g-corp'); if (cp) cp.innerHTML = creditCorpHtml(st); return; }
    root.oninput(ev);
  };
  paint(); if (openId && tab !== 'home') openEdit(tab, openId);
}
