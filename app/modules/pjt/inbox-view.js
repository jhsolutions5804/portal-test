import { esc } from '../../core/ui.js?v=20261030a';
import { shortDate, dueText, suggestProject, showInbox } from '../../shared/pjt-log.js?v=20261030a';
/* 미분류 메일 받은함 카드(문자열) — 설계 docs/pjt-log-design.md §3 "미분류 메일 받은함(관리 권한자만) — 한 건씩 프로젝트를 1클릭으로 지정".
 * 서버(mail-inbox-act.js)가 권한·대외비·종료 프로젝트를 판정해 준 목록만 그린다. 비어 있거나 권한이 없으면 아무것도 그리지 않는다(홈이 시끄럽지 않게).
 * 메일 제목·링크는 외부에서 온 글자라 모두 이스케이프하고, 링크는 https 만 연다.
 * st = { data:{ items:[{id,date,category,title,sourceRef,dueDate,restricted,siteHint}], projects:[{id,name}], total }, pick:{[id]:pjtId}, busy, msg } */
const safeHref = (u) => (/^https:\/\//.test(String(u || '')) ? esc(String(u)) : '');

/** 한 줄 — 제목(원문 링크)·날짜·기한·현장 힌트 · 프로젝트 고르기 · [지정] [이 현장 아님] */
function itemRow(it, projects, pick, busy) {
  const chosen = pick && pick[it.id] !== undefined ? pick[it.id] : suggestProject(it.siteHint, projects); // 사람이 고른 값이 먼저, 없으면 현장 표기로 하나일 때만 추천
  const href = safeHref(it.sourceRef);
  const title = href ? '<a href="' + href + '" target="_blank" rel="noopener noreferrer" title="원본 메일 열기">' + esc(it.title) + '</a>' : esc(it.title);
  const dt = it.dueDate ? dueText(it.due || null) : '';
  const meta = [shortDate(it.date), it.siteHint ? '현장 표기 ' + it.siteHint : ''].filter(Boolean).map(esc).join(' · ');
  const opts = '<option value="">프로젝트 선택</option>' + (projects || []).map((p) => '<option value="' + esc(p.id) + '"' + (chosen === p.id ? ' selected' : '') + '>' + esc(p.name) + '</option>').join('');
  const dis = busy ? ' disabled' : '';
  // 받은함 줄 전용 구조 — 이력 줄(lgrow)과 달리 고르기·버튼이 넓어서, 제목은 윗줄 전체 폭·조작은 아랫줄로 쌓는다(좁은 칸에서 제목이 한 글자씩 쪼개지지 않게)
  return '<div class="jh-pjt__ibrow" data-ib-row="' + esc(it.id) + '">'
    + '<div class="jh-pjt__ibtitle"><span aria-hidden="true">📨</span> ' + title + (it.restricted ? ' <span class="jh-badge" data-tone="warn">대외비</span>' : '') + '</div>'
    + '<div class="jh-field__hint jh-pjt__ibmeta">' + meta + (it.dueDate ? ' · 기한 ' + esc(shortDate(it.dueDate)) : '') + (dt ? ' <span class="jh-badge">' + esc(dt) + '</span>' : '') + '</div>'
    + '<div class="jh-pjt__ibctl"><select class="jh-select" data-ib-pick="' + esc(it.id) + '" aria-label="이 메일을 넣을 프로젝트"' + dis + '>' + opts + '</select>'
    + '<div class="jh-pjt__ibacts"><button type="button" class="jh-btn" data-variant="secondary" data-ib-act="assign" data-ib-id="' + esc(it.id) + '"' + (chosen ? '' : ' disabled') + dis + '>지정</button>'
    + '<button type="button" class="jh-btn" data-variant="ghost" data-ib-act="dismiss" data-ib-id="' + esc(it.id) + '"' + dis + '>이 현장 아님</button></div></div></div>';
}

/** 받은함 카드. 비어 있거나 권한이 없으면 '' (그리지 않음) */
export function inboxHtml(st) {
  const d = st && st.data; if (!showInbox(d)) return '';
  const msg = st.msg ? '<div class="jh-alert" data-tone="info" role="status">' + esc(st.msg) + '</div>' : '';
  const note = '프로젝트를 정하지 못한 메일입니다. 맞는 프로젝트를 고르고 \"지정\"을 누르면 그 프로젝트 이력에 <b>후보</b>로 들어갑니다(확정은 이력 탭에서).';
  return '<section class="jh-card jh-pjt__inbox" aria-label="미분류 메일"><div class="jh-panel__head"><h3>📥 미분류 메일 <span class="jh-field__hint">' + d.items.length + (d.total > d.items.length ? ' / ' + d.total : '') + '건</span></h3></div>'
    + '<div class="jh-pjt__pad"><div class="jh-field__hint">' + note + '</div>' + msg
    + d.items.map((it) => itemRow(it, d.projects || [], st.pick, !!st.busy)).join('') + '</div></section>';
}
