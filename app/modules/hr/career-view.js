/* 근로자 상세 「경력관리」 카드 — HTML 만 만드는 순수 함수(시험: tests/hr-career-view.test.mjs). 읽기·클릭 연결은 index.js mount(직원 상세).
 * 카드 안쪽만 다시 그려서(careerInnerHtml) 상세의 다른 입력 중인 칸을 건드리지 않는다. 관리자 전용(서버가 막고 화면은 안내). */
import { esc } from '../../core/ui.js?v=20261113b';
import { AWARD_KINDS, awardLabel, careerRows, isEdited, careerMonths, fmtMonths, periodLabel, linkCandidates } from './career-tab.js?v=20261113b';
import { deployStatus, deployWhen } from '../../shared/deploy-fmt.js?v=20261113b';

const chip = (text, tone) => '<span class="jh-chip" data-tone="' + tone + '">' + esc(text) + '</span>';
const card = (title, body, right) => '<section class="jh-card"><div class="jh-panel__head"><h3>' + esc(title) + '</h3>' + (right || '') + '</div>' + body + '</section>';
const sub = (t) => '<h4 class="jh-hr__sub">' + esc(t) + '</h4>';
const btn = (label, attr, variant, disabled) => '<button type="button" class="jh-btn" data-variant="' + (variant || 'secondary') + '" ' + attr + (disabled ? ' disabled' : '') + '>' + esc(label) + '</button>';
const inp = (attr, val, ph, type, extra) => '<input class="jh-input" type="' + (type || 'text') + '" ' + attr + ' value="' + esc(val == null ? '' : val) + '" placeholder="' + esc(ph || '') + '" maxlength="' + ((extra && extra.max) || 120) + '">';
const when = (s) => String(s || '').slice(0, 10);
const NOTE = '입사 입력(작성 링크)으로 받은 학력·자격·경력과 직접 적은 성과·교육 기록을 모아 보여 줍니다. 가족관계·병역·비상연락처는 여기에 나오지 않습니다(이력서 인쇄본에만 들어가며, 인쇄할 때마다 열람 기록이 남습니다). 입사 전 경력을 고쳐도 원본은 그대로 남고 「원본으로 되돌리기」로 돌아갑니다.';

function linkSection(c, worker) {
  const d = c.data; const cands = linkCandidates(worker, c.masters);
  if (d.masterId) { const m = (c.masters || []).find((x) => x.id === d.masterId); const who = m ? esc(m.name) + (m.birth ? ' · ' + esc(m.birth) + '생' : '') : esc(d.masterId); return sub('연명부 연결') + '<div class="jh-hr__bar"><span>' + who + '</span>' + chip('연결됨', 'ok') + btn('연결 해제', 'data-cr-unlink', 'ghost', c.busy) + '</div><div class="jh-field__hint">연결된 연명부 인원의 명단·공수 기록으로 아래 프로젝트 이력을 계산합니다.</div>'; }
  const opts = '<option value="">— 연명부 인원 선택 —</option>' + cands.map((m) => '<option value="' + esc(m.id) + '">' + esc(m.name) + (m.birth ? ' · ' + esc(m.birth) + '생' : '') + (m.resigned ? ' (퇴직)' : '') + '</option>').join('');
  return sub('연명부 연결') + '<div class="jh-hr__bar"><select class="jh-select" data-cr-linksel aria-label="연명부 인원">' + opts + '</select>' + btn('연결', 'data-cr-link', 'primary', c.busy || !cands.length) + '</div><div class="jh-field__hint">' + (cands.length ? '이름이 같은 연명부 인원 ' + cands.length + '명입니다. 생년월일을 보고 본인을 고르세요.' : '이름이 같은 연명부 인원이 없습니다. 연결하면 프로젝트 이력이 계산됩니다(사무직처럼 연명부에 없는 직원은 연결 없이 씁니다).') + '</div>';
}
function careerSection(c) {
  const d = c.data; const edited = isEdited(d); const rows = careerRows(d); const today = c.today || ''; const mo = careerMonths(rows, today.slice(0, 7));
  const last = (d.careerEdits || [])[ (d.careerEdits || []).length - 1 ];
  const head = sub('입사 전 경력') + '<div class="jh-hr__bar">' + (edited ? chip('수정됨', 'warn') : chip('입사 입력 원본', 'neutral')) + (rows.length ? '<span class="jh-field__hint">합계 ' + esc(fmtMonths(mo)) + ' (겹치는 기간은 한 번만)</span>' : '') + (c.edit ? '' : btn('수정', 'data-cr-edit', 'secondary', c.busy)) + (edited && !c.edit ? btn('원본으로 되돌리기', 'data-cr-reset', 'ghost', c.busy) : '') + '</div>';
  if (c.edit) {
    const trs = c.edit.rows.map((r, i) => '<tr><td>' + inp('data-cr-cell="' + i + ':company" aria-label="회사"', r.company, '회사', 'text', { max: 80 }) + '</td><td>' + inp('data-cr-cell="' + i + ':from" aria-label="입사"', r.from, '2020-03', 'text', { max: 7 }) + '</td><td>' + inp('data-cr-cell="' + i + ':to" aria-label="퇴사"', r.to, '비우면 재직', 'text', { max: 7 }) + '</td><td>' + inp('data-cr-cell="' + i + ':position" aria-label="직위"', r.position, '직위', 'text', { max: 40 }) + '</td><td>' + inp('data-cr-cell="' + i + ':duty" aria-label="업무"', r.duty, '담당 업무', 'text', { max: 200 }) + '</td><td>' + btn('삭제', 'data-cr-rowdel="' + i + '"', 'ghost') + '</td></tr>').join('');
    return head + '<div class="jh-hr__scroll"><table class="jh-hr-table"><thead><tr><th>회사</th><th>입사(YYYY-MM)</th><th>퇴사(YYYY-MM)</th><th>직위</th><th>업무</th><th></th></tr></thead><tbody>' + trs + '</tbody></table></div><div class="jh-hr__bar">' + btn('+ 줄 추가', 'data-cr-rowadd', 'ghost', c.edit.rows.length >= 30) + btn('저장', 'data-cr-save', 'primary', c.busy) + btn('취소', 'data-cr-cancel', 'ghost') + '</div><div class="jh-field__hint">입사·퇴사는 2020-03 형식입니다. 회사 이름이 없는 줄은 저장할 수 없고, 모두 비어 있는 줄은 저장할 때 빠집니다.</div>';
  }
  const body = rows.length ? '<div class="jh-hr__scroll"><table class="jh-hr-table"><thead><tr><th>회사</th><th>기간</th><th>직위</th><th>업무</th></tr></thead><tbody>' + rows.map((r) => '<tr><td>' + esc(r.company) + '</td><td>' + esc(periodLabel(r.from, r.to)) + '</td><td>' + esc(r.position || '—') + '</td><td>' + esc(r.duty || '—') + '</td></tr>').join('') + '</tbody></table></div>' : '<div class="jh-empty">' + (d.hasProfile ? '입사 전 경력이 없습니다.' : '입사 입력 기록이 없습니다. 「수정」으로 직접 적을 수 있습니다.') + '</div>';
  return head + body + (last ? '<div class="jh-field__hint">마지막 수정: ' + esc(when(last.at)) + ' ' + esc(last.byName || '') + ' (' + esc(last.kind === 'reset' ? '원본으로 되돌림' : last.before + '줄 → ' + last.after + '줄') + ')</div>' : '');
}
function projectSection(c) {
  const d = c.data; const head = sub('JH 프로젝트 이력');
  if (!d.masterId) return head + '<div class="jh-empty">연명부와 연결하면 프로젝트별 역할·기간·공수가 계산되어 나옵니다.</div>';
  const p = c.projects; if (!p) return head + '<div class="jh-skeleton" style="height:var(--u-100, 6rem)" aria-busy="true"></div>';
  const s = p.summary || { count: 0, manDays: 0, from: '', to: '' };
  const rows = (p.list || []).map((x) => '<tr><td>' + esc(x.name) + (x.ended ? ' ' + chip('종료', 'gray') : (x.active ? ' ' + chip('투입 중', 'ok') : ' ' + chip('투입 종료', 'gray'))) + '</td><td>' + esc(x.role || '미지정') + (x.segments && x.segments.length > 1 ? '<div class="jh-field__hint">' + x.segments.map((g) => esc((g.role || '미지정') + ' ' + g.from.slice(5) + '~' + g.to.slice(5))).join(' · ') + '</div>' : '') + '</td><td>' + (x.from ? esc(periodLabel(x.from, x.to)) : '<span class="jh-field__hint">기간 미상(공수 기록 없음)</span>') + '</td><td>' + esc(x.days) + '일</td><td>' + esc(x.manDays) + '</td></tr>').join('');
  return head + (rows ? '<div class="jh-field__hint">' + esc(s.count) + '개 프로젝트 · 공수 합계 ' + esc(s.manDays) + ' · ' + esc(periodLabel(s.from, s.to)) + '</div><div class="jh-hr__scroll"><table class="jh-hr-table"><thead><tr><th>프로젝트</th><th>역할</th><th>기간</th><th>출역일</th><th>공수</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : '<div class="jh-empty">이 인원의 프로젝트 명단·공수 기록이 없습니다.</div>')
    + '<div class="jh-field__hint">명단·공수 기록에서 계산한 값이라 따로 저장하지 않습니다. 역할은 PJT 「명단 관리」에서 고칩니다.</div>';
}
/** 프로젝트 투입 확인 현황(대기열 1-3-27-6) — 직원 본인이 투입 확인서에 응답한 결과. c.deploy 가 undefined 면(서버 함수 미연결) 구역 자체를 그리지 않는다 */
function deploySection(c) {
  if (c.deploy === undefined) return '';
  const head = sub('프로젝트 투입 확인');
  if (!c.deploy) return head + '<div class="jh-field__hint">투입 확인 현황을 불러오지 못했습니다. 「새로 읽기」를 눌러 다시 시도해 주세요.</div>';
  const items = c.deploy.items || [];
  if (!c.deploy.linked) return head + '<div class="jh-empty">연명부와 연결하면 프로젝트 투입 확인 현황이 나옵니다.</div>';
  if (!items.length) return head + '<div class="jh-empty">투입 확인 대상 프로젝트가 없습니다. 프로젝트 명단에 들어가면 직원 본인이 투입 확인서에 응답합니다.</div>';
  const pv = c.deploy.provisions || [];
  const rows = items.map((x) => { const st = deployStatus(x.status); const mine = pv.filter((p) => p.pjtId === x.pjtId); const last = mine[mine.length - 1];
    return '<tr><td>' + esc(x.name) + (x.ended ? ' ' + chip(x.removed ? '명단 제외' : '종료', 'gray') : '') + '</td><td>' + chip(st.label, st.tone) + '</td><td>' + esc(x.at ? deployWhen(x.at) : '-') + '</td><td>' + (last ? esc(mine.length) + '회 · 마지막 ' + esc(deployWhen(last.at).slice(0, 10)) : '<span class="jh-field__hint">-</span>') + '</td><td>' + (x.status === 'agreed' ? btn('소개서(외부용)', 'data-cr-ext="' + esc(x.pjtId) + '"', 'secondary', c.busy) : '<span class="jh-field__hint">동의 필요</span>') + '</td></tr>'; }).join('');
  const pend = items.filter((x) => x.status === 'pending' && x.canDecide).length;
  return head + '<div class="jh-field__hint">' + (pend ? '확인 대기 ' + esc(pend) + '건 — ' : '') + '직원 본인이 「투입 확인」 화면에서 응답합니다. 동의하지 않은 사업에는 투입하지 않습니다(다른 불이익 없음). 외부용 소개서는 동의한 프로젝트에서만 만들 수 있고, 만들 때마다 제공 이력이 남습니다.</div><div class="jh-hr__scroll"><table class="jh-hr-table"><thead><tr><th>프로젝트</th><th>상태</th><th>응답 일시</th><th>제공 이력</th><th>외부용 소개서</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
}
function awardSection(c) {
  const d = c.data; const f = c.aw || {}; const kinds = AWARD_KINDS.map((k) => '<option value="' + k[0] + '"' + ((f.kind || 'award') === k[0] ? ' selected' : '') + '>' + esc(k[1]) + '</option>').join('');
  const list = (d.awards || []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).map((a) => '<tr><td>' + esc(a.date) + '</td><td>' + chip(awardLabel(a.kind), 'neutral') + '</td><td><strong>' + esc(a.title) + '</strong>' + (a.note ? '<div class="jh-field__hint">' + esc(a.note) + '</div>' : '') + '</td><td>' + esc(a.byName || '') + '</td><td>' + btn('삭제', 'data-cr-award-del="' + esc(a.id) + '"', 'ghost', c.busy) + '</td></tr>').join('');
  return sub('성과 기록') + (list ? '<div class="jh-hr__scroll"><table class="jh-hr-table"><thead><tr><th>날짜</th><th>종류</th><th>내용</th><th>기록자</th><th></th></tr></thead><tbody>' + list + '</tbody></table></div>' : '<div class="jh-empty">성과 기록이 없습니다.</div>')
    + '<div class="jh-hr__bar"><input class="jh-input" type="date" data-cr-af="date" value="' + esc(f.date || '') + '" aria-label="날짜"><select class="jh-select" data-cr-af="kind" aria-label="종류">' + kinds + '</select>' + inp('data-cr-af="title" aria-label="제목"', f.title, '제목(예: 무사고 6개월)', 'text', { max: 80 }) + inp('data-cr-af="note" aria-label="메모"', f.note, '메모(선택)', 'text', { max: 300 }) + btn('기록 추가', 'data-cr-award-add', 'primary', c.busy) + '</div>';
}
function trainingSection(c) {
  const d = c.data; const f = c.tr || {};
  const certs = (d.certs || []).length ? '<div class="jh-hr__scroll"><table class="jh-hr-table"><thead><tr><th>자격·면허</th><th>취득일</th><th>발급처</th></tr></thead><tbody>' + d.certs.map((x) => '<tr><td>' + esc(x.name) + '</td><td>' + esc(x.date || '—') + '</td><td>' + esc(x.issuer || '—') + '</td></tr>').join('') + '</tbody></table></div><div class="jh-field__hint">자격·면허는 입사 입력 값입니다(건설기초·법정교육은 연명부에서 봅니다).</div>' : '<div class="jh-empty">입사 입력으로 받은 자격·면허가 없습니다.</div>';
  const list = (d.training || []).slice().sort((a, b) => String(b.date).localeCompare(String(a.date))).map((a) => '<tr><td>' + esc(a.date) + '</td><td><strong>' + esc(a.title) + '</strong>' + (a.note ? '<div class="jh-field__hint">' + esc(a.note) + '</div>' : '') + '</td><td>' + esc(a.org || '—') + '</td><td>' + esc(a.hours || '—') + '</td><td>' + btn('삭제', 'data-cr-tr-del="' + esc(a.id) + '"', 'ghost', c.busy) + '</td></tr>').join('');
  return sub('자격·교육') + certs + '<div class="jh-field__label">교육·자격 기록</div>' + (list ? '<div class="jh-hr__scroll"><table class="jh-hr-table"><thead><tr><th>날짜</th><th>내용</th><th>기관</th><th>시간</th><th></th></tr></thead><tbody>' + list + '</tbody></table></div>' : '<div class="jh-empty">교육 기록이 없습니다.</div>')
    + '<div class="jh-hr__bar"><input class="jh-input" type="date" data-cr-tf="date" value="' + esc(f.date || '') + '" aria-label="날짜">' + inp('data-cr-tf="title" aria-label="교육 이름"', f.title, '교육·자격 이름', 'text', { max: 80 }) + inp('data-cr-tf="org" aria-label="기관"', f.org, '기관(선택)', 'text', { max: 60 }) + inp('data-cr-tf="hours" aria-label="시간"', f.hours, '시간', 'text', { max: 6 }) + inp('data-cr-tf="note" aria-label="메모"', f.note, '메모(선택)', 'text', { max: 200 }) + btn('기록 추가', 'data-cr-tr-add', 'primary', c.busy) + '</div>';
}
/** 카드 안쪽 — c: { loading, error, data, masters, projects, errors, edit:{rows}|null, aw, tr, busy, today }, worker: 명부 문서 */
export function careerInnerHtml(c, worker) {
  const refresh = (c && c.data ? btn('🖨 이력서 인쇄(내부용)', 'data-cr-print', 'secondary', c.busy) : '') + btn('새로 읽기', 'data-cr-refresh', 'ghost', !c || c.loading);
  if (!c) return '';
  if (c.loading) return card('🧭 경력관리', '<div class="jh-hr__pad"><div class="jh-skeleton" style="height:var(--u-100, 6rem)" aria-busy="true"></div></div>', refresh);
  if (c.error || !c.data) return card('🧭 경력관리', '<div class="jh-hr__pad"><div class="jh-alert" data-tone="warn" role="alert">' + esc(c.error || '불러오지 못했습니다.') + '</div></div>', refresh);
  const warn = (c.errors && c.errors.length) ? '<div class="jh-alert" data-tone="warn" role="status">일부를 불러오지 못했습니다: ' + esc(c.errors.join(', ')) + '</div>' : '';
  return card('🧭 경력관리', '<div class="jh-hr__pad"><div class="jh-field__hint">' + esc(NOTE) + '</div>' + warn + linkSection(c, worker) + careerSection(c) + projectSection(c) + deploySection(c) + awardSection(c) + trainingSection(c) + '</div>', refresh);
}
/** 직원 상세 화면에 붙는 카드 자리(#w-career) */
export const careerCardHtml = (c, worker) => (c ? '<div id="w-career">' + careerInnerHtml(c, worker) + '</div>' : '');
