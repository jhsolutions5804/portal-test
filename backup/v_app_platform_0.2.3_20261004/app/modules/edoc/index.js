import { fetchAll, fetchOne } from './data.js?v=20261004c';
import { listHtml, detailHtml } from './views.js?v=20261004c';
import { tabCounts } from './logic.js?v=20261004c';
import { buildHash, navigate } from '../../core/router.js?v=20261004c';

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

/** route: { segs:['box'] | ['doc', dtype, id], query } */
export async function mount(root, route, ctx) {
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

  const docs = await ensureDocs(me, false);
  ctx.setBadge('edoc', tabCounts(docs, me).todo);
  listEl.innerHTML = listHtml({ docs, me, query: q, selectedKey });
  if (!isDetail && listScroll != null) { window.scrollTo(0, listScroll); listScroll = null; }   // 상세에서 뒤로 오면 보던 위치로
  if (isDetail && window.matchMedia('(max-width: 899px)').matches) window.scrollTo(0, 0);        // 폰: 상세는 맨 위부터

  if (isDetail) {
    detailEl.innerHTML = detailHtml({ me, loading: true });
    let d = docs.find(x => x.dtype === dtype && x.id === id) || null;
    if (!d) { try { d = await fetchOne(dtype, id); } catch (e) { d = null; } }
    detailEl.innerHTML = d ? detailHtml({ me, doc: d }) : '<div class="jh-empty">문서를 찾을 수 없거나 열람 권한이 없습니다.</div>' +
      '<button type="button" class="jh-btn" data-variant="ghost" data-back>← 목록</button>';
  }

  root.onclick = (ev) => {
    const t = ev.target.closest('[data-tab],[data-open],[data-back],[data-refresh],[data-page]'); if (!t) return;
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
    if (t.hasAttribute('data-refresh')) {
      cache = { uid: null, docs: null };
      mount(root, route, ctx);
    }
  };
  root.onchange = (ev) => {
    if (ev.target.hasAttribute && ev.target.hasAttribute('data-pagesize')) return goBox({ size: ev.target.value, page: '1' });
    const f = ev.target.getAttribute && ev.target.getAttribute('data-filter'); if (!f) return;
    goBox({ [f]: ev.target.value, page: '1' });
  };
}
