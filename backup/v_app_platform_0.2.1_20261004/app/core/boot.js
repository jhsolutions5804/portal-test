import { watchMe, login, logout, authErrorMessage } from './auth.js?v=20261004a';
import { register, visibleFor, get } from './registry.js?v=20261004a';
import { parseHash, onChange } from './router.js?v=20261004a';
import { renderLogin, renderDenied, renderShell } from './shell.js?v=20261004a';
import * as edoc from '../modules/edoc/index.js?v=20261004a';

register(Object.assign({}, edoc.manifest, { mount: edoc.mount }));

const root = document.getElementById('jh-root');
let me = null; let shell = null; let mods = [];

function route() {
  if (!me || !shell) return;
  const r = parseHash();
  const mod = r.module ? get(r.module) : null;
  if (!mod || mods.indexOf(mod) === -1) { location.replace(mods[0].defaultHash); return; }
  shell.setActive(mod.id); shell.setTitle(mod.title);
  mod.mount(shell.main, r, { me, setBadge: shell.setBadge });
}

async function doLogin(id, pw) {
  try { await login(id, pw); } catch (e) { throw new Error(authErrorMessage(e && e.code)); }
}
const REASONS = {
  'signed-out': '', 'not-registered': '등록되지 않은 계정입니다. 관리자에게 문의해 주세요.',
  'not-approved': '승인되지 않은 계정입니다.', error: '계정 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
};

watchMe((user, reason) => {
  me = user; shell = null;
  if (!me) { renderLogin(root, { onSubmit: doLogin, message: REASONS[reason] || '' }); return; }
  mods = visibleFor(me);
  if (!mods.length) { renderDenied(root, '이 계정에는 사용할 수 있는 모듈이 없습니다.', logout); return; }
  shell = renderShell(root, me, mods, { onLogout: logout });
  route();
});
onChange(route);
