/* 내 평가 화면 — 정직원 누구나(GUEST 제외). 폰에서도 작성: 목록 → 작성 → 제출. 자동 임시저장, 제출하면 잠김.
 * 보안: 읽기·쓰기는 보안 규칙(docs/rules/eval_rules_block.rules)이 강제하고, 이 화면은 본인 과제·본인 제출만 다룬다. */
import { db, collection, getDocs, getDoc, setDoc, doc, query, where, serverTimestamp } from '../../core/firebase.js?v=20261031d';
import { confirmDialog } from '../../core/dialog.js?v=20261031d';
import { esc, toast } from '../../core/ui.js?v=20261031d';
import { isEvalUser } from '../../shared/eval-perm.js?v=20261031d';
import { mineListHtml, mineFormHtml } from './mine-view.js?v=20261031d';
import { createMineController } from './mine-io.js?v=20261031d';

export async function mountMine(root, ctx) {
  const me = (ctx && ctx.me) || {}; if (!isEvalUser(me) || !me.uid) { root.innerHTML = '<div class="jh-card"><div class="jh-empty">평가는 정직원 계정으로만 열 수 있습니다.</div></div>'; return; }
  root.innerHTML = '<div class="jh-eval"><div id="ev-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div></div>';
  const body = root.querySelector('#ev-body'); const st = {};
  const paint = () => { body.removeAttribute('aria-busy'); body.innerHTML = st.mine.error && !st.mine.loaded ? '<div class="jh-card"><div class="jh-empty">' + esc(st.mine.error) + '</div></div>' : (st.mine.sel ? mineFormHtml(st) : mineListHtml(st)); if (st.mine.error && st.mine.loaded) body.insertAdjacentHTML('afterbegin', '<div class="jh-field__hint" data-tone="warn">' + esc(st.mine.error) + '</div>'); };
  const year = new Date().getFullYear() >= 2027 ? new Date().getFullYear() : 2026;   // 올해 평가 회차(2026년분은 2025-10~2026-09 기간을 11월에 평가)
  const c = createMineController({ db, collection, getDocs, getDoc, setDoc, doc, query, where, serverTimestamp, toast, confirmDialog, paint, st, ctx, year });
  try { await c.load(); } catch (e) { st.mine.error = '불러오지 못했습니다: ' + ((e && e.message) || ''); }
  paint();
  root.onclick = async (ev) => { await c.onClick(ev); };
  root.oninput = (ev) => { c.onInput(ev); };
  // 쓰다가 다른 화면으로 가도 마지막 입력이 사라지지 않게 — 화면을 떠나거나 앱이 가려질 때 임시저장
  const leave = () => { c.flush(); }; window.addEventListener('pagehide', leave); document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') leave(); });
}
