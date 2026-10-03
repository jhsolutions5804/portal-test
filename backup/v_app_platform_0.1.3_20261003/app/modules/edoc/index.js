import { fetchAll, fetchOne } from './data.js?v=20261003d';
import { listHtml, detailHtml } from './views.js?v=20261003d';
import { tabCounts } from './logic.js?v=20261003d';
import { buildHash } from '../../core/router.js?v=20261003d';

const URL_DEFAULTS = { tab: 'todo', type: 'all', status: 'all' };   // 주소에서 생략하는 기본값

export const manifest = {
  id: 'edoc',
  title: '전자결재',
  icon: '✍',
  perm: (me) => me.admin || (me.perms && me.perms.edoc === true),
  defaultHash: '#/edoc/box'
};

let cache = { uid: null, docs: null };
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
  const goBox = (patch) => { location.hash = buildHash('edoc', '/box', Object.assign({}, q, patch), URL_DEFAULTS); };

  const docs = await ensureDocs(me, false);
  ctx.setBadge('edoc', tabCounts(docs, me).todo);
  listEl.innerHTML = listHtml({ docs, me, query: q, selectedKey });

  if (isDetail) {
    detailEl.innerHTML = detailHtml({ me, loading: true });
    let d = docs.find(x => x.dtype === dtype && x.id === id) || null;
    if (!d) { try { d = await fetchOne(dtype, id); } catch (e) { d = null; } }
    detailEl.innerHTML = d ? detailHtml({ me, doc: d }) : '<div class="jh-empty">문서를 찾을 수 없거나 열람 권한이 없습니다.</div>' +
      '<button type="button" class="jh-btn" data-variant="ghost" data-back>← 목록</button>';
  }

  root.onclick = (ev) => {
    const t = ev.target.closest('[data-tab],[data-open],[data-back],[data-refresh]'); if (!t) return;
    if (t.hasAttribute('data-tab')) return goBox({ tab: t.getAttribute('data-tab') });
    if (t.hasAttribute('data-open')) {
      const [dt, did] = t.getAttribute('data-open').split('/');
      location.hash = buildHash('edoc', '/doc/' + dt + '/' + did, q, URL_DEFAULTS); return;
    }
    if (t.hasAttribute('data-back')) return goBox({});
    if (t.hasAttribute('data-refresh')) {
      cache = { uid: null, docs: null };
      mount(root, route, ctx);
    }
  };
  root.onchange = (ev) => {
    const f = ev.target.getAttribute && ev.target.getAttribute('data-filter'); if (!f) return;
    goBox({ [f]: ev.target.value });
  };
}
