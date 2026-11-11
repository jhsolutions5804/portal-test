/* 인사평가 면담 화면 — 사장단·관리자 전용(면담 내용은 직원에게 공개되지 않는 인사 정보). 목록 → 직원 상세.
 * 보안: 읽기·쓰기는 컬렉션 interviews 의 기존 관리자 전용 보안 규칙이 강제하고, 화면도 같은 기준(isEvalOps + 관리자 계정)으로 막는다. */
import { db, collection, getDocs, getDoc, setDoc, addDoc, deleteDoc, doc, query, where, serverTimestamp } from '../../core/firebase.js?v=20261109x';
import { confirmDialog } from '../../core/dialog.js?v=20261109x';
import { esc, toast } from '../../core/ui.js?v=20261109x';
import { isInterviewUser } from '../../shared/eval-perm.js?v=20261109x';
import { interviewBoardHtml, interviewDetailHtml, NO_ACCESS } from './interview-view.js?v=20261109x';
import { createInterviewController } from './interview-io.js?v=20261109x';

export const canOpenInterview = isInterviewUser;
export async function mountInterview(root, ctx) {
  const me = (ctx && ctx.me) || {}; if (!canOpenInterview(me)) { root.innerHTML = NO_ACCESS; return; }
  root.innerHTML = '<div class="jh-hr"><div id="iv-body" aria-busy="true"><div class="jh-skeleton" style="height:var(--u-220)"></div></div></div>';
  const body = root.querySelector('#iv-body'); const st = {};
  const paint = () => { body.removeAttribute('aria-busy'); body.innerHTML = st.iv.sel && st.iv.d ? interviewDetailHtml(st) : interviewBoardHtml(st); };
  const c = createInterviewController({ db, collection, getDocs, getDoc, setDoc, addDoc, deleteDoc, doc, query, where, serverTimestamp, toast, confirmDialog, paint, st, ctx });
  try { await c.load(); } catch (e) { st.iv.error = '불러오지 못했습니다: ' + esc((e && e.message) || ''); }
  paint();
  root.onclick = async (ev) => { await c.onClick(ev); };
  root.oninput = (ev) => { c.onInput(ev); };
  root.onchange = async (ev) => { await c.onChange(ev); };
}
