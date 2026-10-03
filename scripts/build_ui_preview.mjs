// UI 미리보기 생성: 실제 앱 마크업(1단계) + 2·3단계 화면 마크업 규격을 가짜 샘플 데이터로 한 페이지에 모은다.
// 사용: NODE_PATH=/home/claude/node_modules node scripts/build_ui_preview.mjs <출력경로>
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { JSDOM } = require('jsdom');
const here = path.dirname(fileURLToPath(import.meta.url));
const app = path.join(here, '..', 'app');
globalThis.location = { pathname: '/portal-test/app/', hash: '' };
const V = await import(path.join(app, 'modules/edoc/views.js'));
const { renderShell, renderLogin } = await import(path.join(app, 'core/shell.js'));
const L = await import(path.join(app, 'modules/edoc/logic.js'));
const out = process.argv[2] || path.join(here, '..', 'preview.html');

const me = { uid: 'u-me', name: '홍길동', rank: '과장', admin: true, perms: { edoc: true } };
const now = Date.now();
const mk = (o) => Object.assign({ _ms: now - (o.ago || 0) * 3600e3, authorName: '김가나', authorDept: '경영총무팀', authorRank: '대리', authorUid: 'u-k' }, o);
const docs = [
  mk({ id: 'a1', dtype: 'leave', title: '20261005 김가나 연차 신청서', status: 'pending', leaveType: '연차(유급)', startDate: '2026-10-05', endDate: '2026-10-06', days: '2', reason: '개인 사유',
    approvalLine: [{ role: '작성', name: '김가나', rank: '대리', status: 'draft' }, { role: '결재1', uid: 'u-me', name: '홍길동', rank: '과장', status: 'pending' }, { role: '결재2', uid: 'u-x', name: '이다라', rank: '부사장', status: 'pending' }, { role: '참조', uid: 'u-y', name: '박마바', rank: '대리', status: 'pending' }] }),
  mk({ id: 'a2', ago: 5, dtype: 'expense', title: '20261002 박마바 지출결의서', authorName: '박마바', status: 'reviewing', expDate: '2026-10-02', category: '소모품', amount: '16500', vendor: '가나상사', purpose: '코팅필름 구매', receipt: '영수증 첨부',
    approvalLine: [{ role: '작성', name: '박마바', rank: '대리', status: 'draft' }, { role: '결재1', uid: 'u-me', name: '홍길동', rank: '과장', status: 'approved', approvedAt: new Date(now - 3600e3).toISOString() }, { role: '결재2', uid: 'u-x', name: '이다라', rank: '부사장', status: 'pending' }] }),
  mk({ id: 'a3', ago: 24, dtype: 'purchase', title: '20261001 김가나 구매품의서', status: 'approved', vendor: '다라상사', item: '하이스드릴 3.5mm', qty: '10', unitPrice: '2300', purpose: '현장 작업용', dueDate: '2026-10-08',
    approvalLine: [{ role: '작성', name: '김가나', status: 'draft' }, { role: '결재', uid: 'u-x', name: '이다라', rank: '부사장', status: 'approved', approvedAt: new Date(now - 20 * 3600e3).toISOString() }] }),
  mk({ id: 'a4', ago: 48, dtype: 'daily', title: '(P4 Ph2) 261001 김가나 업무일지', status: 'posted', pjtCode: 'P4 Ph2 (FAB)', pjtName: 'FCU 설치', date: '2026-10-01', todayWork: '07:10 TBM\n08:00 FCU 반입', tomorrowWork: '인원 수송', issue: '',
    approvalLine: [{ role: '작성', name: '김가나', status: 'done' }, { role: '결재', uid: 'u-x', name: '이다라', rank: '부사장', status: 'approved' }, { role: '수신', name: '최사아', rank: '대표', status: 'done' }] }),
  mk({ id: 'a5', ago: 72, dtype: 'resign', title: '20260929 김가나 휴직/퇴직', status: 'rejected', leaveKind: '휴직', lastDate: '2026-11-01', returnDate: '2027-02-01', reason: '개인 사유',
    approvalLine: [{ role: '작성', name: '김가나', status: 'draft' }, { role: '결재1', uid: 'u-x', name: '이다라', rank: '부사장', status: 'rejected' }, { role: '결재2', name: '최사아', rank: '대표', status: 'pending' }] }),
  mk({ id: 'a6', ago: 96, dtype: 'cert', title: '20260928 김가나 재직증명서', status: 'draft', purpose: '금융기관 제출용', language: '한국어', copies: '1', approvalLine: [] })
];

const dom = new JSDOM('<div id="shell"></div>');
const doc = dom.window.document;
const shell = renderShell(doc.getElementById('shell'), me, [{ id: 'edoc', title: '전자결재', icon: '✍', defaultHash: '#/edoc/box' }], { onLogout() {} });
shell.setTitle('전자결재'); shell.setActive('edoc'); shell.setBadge('edoc', 1);
shell.main.innerHTML = '<div class="jh-split" data-view="list"><section class="jh-split__list">' + V.listHtml({ docs, me, query: { tab: 'all' }, selectedKey: 'leave/a1' }) + '</section><section class="jh-split__detail">' + V.detailHtml({ doc: docs[0], me }) + '</section></div>';
const shellHtml = doc.getElementById('shell').innerHTML;
const loginDom = new JSDOM('<div id="l"></div>'); renderLogin(loginDom.window.document.getElementById('l'), { onSubmit() {}, message: '아이디 또는 비밀번호가 올바르지 않습니다.' });
const loginHtml = loginDom.window.document.getElementById('l').innerHTML;

const statuses = ['draft', 'pending', 'reviewing', 'approved', 'rejected', 'posted'].map(s => V.badgeHtml(s)).join(' ');
const stepStates = V.timelineHtml({ status: 'pending', approvalLine: [
  { role: '작성', name: '작성자', status: 'draft' }, { role: '결재1', uid: 'a', name: '완료', status: 'approved' }, { role: '결재2', uid: 'b', name: '차례', status: 'pending' },
  { role: '결재3', uid: 'c', name: '대기', status: 'pending' }, { role: '참조', uid: 'd', name: '열람', status: 'pending' }] })
  + '<div style="height:12px"></div>' + V.timelineHtml({ status: 'rejected', approvalLine: [{ role: '작성', name: '작성자', status: 'draft' }, { role: '결재1', uid: 'a', name: '반려', status: 'rejected' }] })
  + '<div style="height:12px"></div>' + V.timelineHtml({ status: 'approved', approvalLine: [{ role: '작성', name: '작성자', status: 'draft' }, { role: '결재1', uid: 'a', name: '김종화', status: 'approved' }, { role: '결재2', uid: 'b', name: '이다라', status: 'skipped' }] });

/* ── 2단계 화면 마크업 규격 (앱이 실제로 쓸 구조) ── */
const lineItems = `
<li class="jh-line-item" data-kind="author"><span class="jh-line-item__order">작성</span><span class="jh-line-item__name">홍길동 <small>과장</small></span><span class="jh-line-item__tag">작성자</span></li>
<li class="jh-line-item" data-kind="approver"><span class="jh-line-item__handle" aria-hidden="true">⋮⋮</span><span class="jh-line-item__order">결재1</span><span class="jh-line-item__name">이다라 <small>차장</small></span><span class="jh-line-item__tag">결재</span><span class="jh-line-item__actions"><button type="button" class="jh-iconbtn" data-act="up" aria-label="위로" disabled>↑</button><button type="button" class="jh-iconbtn" data-act="down" aria-label="아래로">↓</button><button type="button" class="jh-iconbtn" data-act="remove" aria-label="삭제">×</button></span></li>
<li class="jh-line-item" data-kind="approver" data-locked="true"><span class="jh-line-item__handle" aria-hidden="true">⋮⋮</span><span class="jh-line-item__order">결재2</span><span class="jh-line-item__name">최사아 <small>부사장</small></span><span class="jh-line-item__tag">필수</span><span class="jh-line-item__actions"><button type="button" class="jh-iconbtn" data-act="up" aria-label="위로">↑</button><button type="button" class="jh-iconbtn" data-act="down" aria-label="아래로" disabled>↓</button></span></li>
<li class="jh-line-item" data-kind="cc"><span class="jh-line-item__order">참조</span><span class="jh-line-item__name">박마바 <small>대리</small></span><span class="jh-line-item__tag">열람</span><span class="jh-line-item__actions"><button type="button" class="jh-iconbtn" data-act="remove" aria-label="삭제">×</button></span></li>`;
const lineEditor = `
<section class="jh-line-editor" aria-label="결재선">
  <h3 class="jh-form__h">결재선</h3>
  <ol class="jh-line-editor__list">${lineItems}</ol>
  <div class="jh-line-editor__add">
    <div><input class="jh-input" type="search" placeholder="이름으로 직원 검색" aria-label="직원 검색">
      <ul class="jh-suggest" role="listbox"><li class="jh-suggest__item" role="option" aria-selected="true"><span>김가나 <small>대리</small></span><span>경영총무팀</span></li><li class="jh-suggest__item" role="option"><span>김나다 <small>사원</small></span><span>현장관리팀</span></li></ul></div>
    <button type="button" class="jh-btn" data-variant="secondary" data-act="add-approver">결재자로 추가</button>
    <button type="button" class="jh-btn" data-variant="ghost" data-act="add-cc">참조로 추가</button>
  </div>
</section>`;
const guide = (diff) => `
<aside class="jh-guide" data-diff="${diff}">
  <div class="jh-guide__title">권장 결재선</div>
  <div class="jh-guide__line"><span class="jh-guide__step">이다라 <small>차장</small></span><span class="jh-guide__arrow">→</span><span class="jh-guide__step">최사아 <small>부사장</small></span></div>
  <p class="jh-guide__note">연차는 팀장 확인 후 부사장 결재를 권장합니다.</p>
  <p class="jh-guide__diff">현재 결재선이 권장과 다릅니다. (차단되지는 않습니다)</p>
  <button type="button" class="jh-btn" data-variant="secondary" data-act="apply-guide">권장대로 적용</button>
</aside>`;
const leaveForm = `
<form class="jh-form" data-type="leave" novalidate>
  <header class="jh-form__head"><h2 class="jh-form__title">연차신청서</h2><p class="jh-form__sub">작성자: 홍길동 과장 · 경영총무팀</p></header>
  <section class="jh-form__section"><h3 class="jh-form__h">휴가 내용</h3>
    <div class="jh-form__row">
      <label class="jh-field"><span class="jh-field__label">휴가 종류</span><select class="jh-select"><option>연차(유급)</option><option>반차-오전(유급)</option></select></label>
      <label class="jh-field" data-invalid="true"><span class="jh-field__label">일수</span><input class="jh-input" type="number" value=""><span class="jh-field__error">일수를 입력해 주세요.</span></label>
    </div>
    <div class="jh-form__row">
      <label class="jh-field"><span class="jh-field__label">시작일</span><input class="jh-input" type="date" value="2026-10-05"></label>
      <label class="jh-field"><span class="jh-field__label">종료일</span><input class="jh-input" type="date" value="2026-10-06"></label>
    </div>
    <div class="jh-form__row" data-cols="1">
      <label class="jh-field"><span class="jh-field__label">사유</span><textarea class="jh-textarea" placeholder="휴가 사유를 입력하세요"></textarea><span class="jh-field__hint">비상 연락처가 있으면 함께 적어 주세요.</span></label>
    </div>
  </section>
  <section class="jh-form__section">${lineEditor}${guide('true')}</section>
  <div class="jh-alert" data-tone="warn" role="alert">필수 결재자(최사아 부사장)가 결재선에 포함되어 있어야 상신할 수 있습니다.</div>
  <footer class="jh-form__foot"><button type="button" class="jh-btn" data-variant="ghost">임시저장</button><button type="button" class="jh-btn" data-variant="primary">결재 상신</button></footer>
</form>`;
const spendForm = `
<form class="jh-form" data-type="spend" novalidate>
  <header class="jh-form__head"><h2 class="jh-form__title">구매·지출 결의서</h2></header>
  <section class="jh-form__section"><h3 class="jh-form__h">구분</h3>
    <div class="jh-segmented" role="group" aria-label="구분"><button type="button" class="jh-segmented__item" aria-pressed="true">구매품의</button><button type="button" class="jh-segmented__item" aria-pressed="false">지출결의</button></div>
    <div class="jh-form__row">
      <label class="jh-field"><span class="jh-field__label">거래처</span><input class="jh-input" value="다라상사"></label>
      <label class="jh-field"><span class="jh-field__label">필요일</span><input class="jh-input" type="date" value="2026-10-08"></label>
    </div>
    <div class="jh-form__row">
      <label class="jh-field"><span class="jh-field__label">품목</span><input class="jh-input" value="하이스드릴 3.5mm"></label>
      <label class="jh-field"><span class="jh-field__label">프로젝트(선택)</span><select class="jh-select"><option>선택 안 함</option><option>P4 Ph2 (FAB)</option></select></label>
    </div>
    <div class="jh-form__row">
      <label class="jh-field"><span class="jh-field__label">수량</span><input class="jh-input" inputmode="numeric" value="10"></label>
      <label class="jh-field"><span class="jh-field__label">단가(원)</span><input class="jh-input" inputmode="numeric" value="2,300"><span class="jh-field__hint">합계 23,000원</span></label>
    </div>
  </section>
  <section class="jh-form__section">${lineEditor}${guide('false')}</section>
  <footer class="jh-form__foot"><button type="button" class="jh-btn" data-variant="ghost">임시저장</button><button type="button" class="jh-btn" data-variant="primary">결재 상신</button></footer>
</form>`;
const actionbars = `
<p class="pv-cap">① 내 차례인 일반 결재자</p>
<div class="jh-actionbar" role="group" aria-label="문서 처리"><div class="jh-actionbar__primary"><button type="button" class="jh-btn" data-variant="primary" data-act="approve">승인</button></div><div class="jh-actionbar__danger"><button type="button" class="jh-btn" data-variant="danger" data-act="reject">반려</button></div></div>
<p class="pv-cap">② 필수 결재자(전결·게시 가능)</p>
<div class="jh-actionbar" role="group" aria-label="문서 처리"><div class="jh-actionbar__primary"><button type="button" class="jh-btn" data-variant="primary" data-act="approve">승인</button><button type="button" class="jh-btn" data-variant="primary" data-act="approve-post">승인 후 게시(전결)</button></div><div class="jh-actionbar__danger"><button type="button" class="jh-btn" data-variant="danger" data-act="reject">반려</button></div></div>
<p class="pv-cap">③ 승인 완료 후 게시 / ④ 작성자 회수·수정</p>
<div class="jh-actionbar" role="group" aria-label="문서 처리"><div class="jh-actionbar__primary"><button type="button" class="jh-btn" data-variant="primary" data-act="post">게시</button></div><div class="jh-actionbar__secondary"><button type="button" class="jh-btn" data-variant="secondary" data-act="print">인쇄·PDF</button><button type="button" class="jh-btn" data-variant="ghost" data-act="recall">회수</button></div></div>`;
const dialog = `
<div class="jh-dialog" role="dialog" aria-modal="true" aria-labelledby="dlg-title" style="position:relative;min-height:260px;border-radius:12px;overflow:hidden">
  <div class="jh-dialog__backdrop"></div>
  <div class="jh-dialog__panel"><h3 class="jh-dialog__title" id="dlg-title">반려 사유</h3>
    <div class="jh-dialog__body"><label class="jh-field"><span class="jh-field__label">사유 (필수)</span><textarea class="jh-textarea" placeholder="작성자에게 전달됩니다"></textarea></label></div>
    <div class="jh-dialog__actions"><button type="button" class="jh-btn" data-variant="ghost">취소</button><button type="button" class="jh-btn" data-variant="danger">반려</button></div></div>
</div>`;
const rowSample = (r) => V.listHtml({ docs: [r], me, query: { tab: 'all' } }).split('<div class="jh-doclist">')[1].replace(/<\/div>$/, '');
const dashboard = `
<section class="jh-dashboard">
  <div class="jh-kpi-grid">
    <a class="jh-kpi" data-tone="accent" href="#"><span class="jh-kpi__label">내 결재 대기</span><span class="jh-kpi__value">3</span><span class="jh-kpi__hint">건</span></a>
    <a class="jh-kpi" href="#"><span class="jh-kpi__label">내가 올린 진행 중</span><span class="jh-kpi__value">2</span><span class="jh-kpi__hint">건</span></a>
    <a class="jh-kpi" href="#"><span class="jh-kpi__label">반려됨</span><span class="jh-kpi__value">1</span><span class="jh-kpi__hint">건</span></a>
    <a class="jh-kpi" href="#"><span class="jh-kpi__label">연차 잔여</span><span class="jh-kpi__value">11.5</span><span class="jh-kpi__hint">일</span></a>
  </div>
  <div class="jh-dashboard__grid">
    <section class="jh-card jh-panel"><header class="jh-panel__head"><h3>내가 결재할 문서</h3><a class="jh-link" href="#">전체보기</a></header><div class="jh-doclist">${rowSample(docs[0])}</div></section>
    <section class="jh-card jh-panel"><header class="jh-panel__head"><h3>내가 올린 문서</h3><a class="jh-link" href="#">전체보기</a></header><div class="jh-doclist">${rowSample(docs[5])}</div></section>
  </div>
</section>`;
const settings = `
<section class="jh-settings">
  <article class="jh-card jh-settings__card"><h3 class="jh-form__h">필수 결재자 · 대리 승인</h3>
    <div class="jh-settings__row"><span class="jh-settings__type">필수 결재자</span><div class="jh-chiplist"><span class="jh-chip" data-tone="accent">최사아 부사장</span></div></div>
    <div class="jh-settings__row"><span class="jh-settings__type">대리 승인 권한자</span><div class="jh-chiplist"><span class="jh-chip" data-tone="accent">최사아 부사장</span></div></div>
  </article>
  <article class="jh-card jh-settings__card"><h3 class="jh-form__h">문서별 권장 결재선</h3>
    <div class="jh-settings__row"><span class="jh-settings__type">연차신청서</span><div>${guide('false').replace('data-diff="false"', 'data-diff="false"')}</div></div>
    <div class="jh-settings__row"><span class="jh-settings__type">구매·지출 결의서</span><div>${guide('false')}</div></div>
  </article>
</section>`;
const paper = `
<div class="jh-paper">
  <h2 class="jh-paper__title">연차신청서</h2>
  <div class="jh-stamps"><div class="jh-stamp"><div class="jh-stamp__role">작성</div><div class="jh-stamp__sign">김가나</div><div class="jh-stamp__name">대리</div></div><div class="jh-stamp"><div class="jh-stamp__role">결재1</div><div class="jh-stamp__sign">승인</div><div class="jh-stamp__name">이다라</div></div><div class="jh-stamp"><div class="jh-stamp__role">결재2</div><div class="jh-stamp__sign">전결</div><div class="jh-stamp__name">최사아</div></div></div>
  <table class="jh-paper__table"><tr><th>휴가 종류</th><td>연차(유급)</td></tr><tr><th>기간</th><td>2026.10.05 ~ 2026.10.06 (2일)</td></tr><tr><th>사유</th><td>개인 사유</td></tr></table>
</div>`;
const states = `
<div class="jh-empty">조건에 맞는 문서가 없습니다.</div>
<div style="display:grid;gap:10px;padding:16px"><span class="jh-skeleton" style="width:60%"></span><span class="jh-skeleton" style="width:90%"></span><span class="jh-skeleton" style="width:40%"></span></div>
<div class="jh-alert" data-tone="info">1단계는 읽기 전용입니다.</div><div style="height:8px"></div>
<div class="jh-alert" data-tone="warn">필수 결재자가 결재선에 없습니다.</div><div style="height:8px"></div>
<div class="jh-alert" data-tone="danger">저장하지 못했습니다. 잠시 후 다시 시도해 주세요.</div>
<div style="height:8px"></div><span class="jh-chip">기본</span> <span class="jh-chip" data-tone="accent">내 차례</span> <span class="jh-chip" data-tone="warn">테섭</span>
<div style="height:12px"></div><button type="button" class="jh-btn" data-variant="primary">기본 버튼</button> <button type="button" class="jh-btn" data-variant="secondary">보조</button> <button type="button" class="jh-btn" data-variant="danger">위험</button> <button type="button" class="jh-btn" data-variant="ghost">고스트</button> <button type="button" class="jh-btn" data-variant="primary" disabled>비활성</button>`;

const rowsFake = Array.from({ length: 240 }, (_, i) => i);
const pagers = '<div class="pv-card" style="max-width:420px;margin-bottom:12px">' + V.pagerHtml(L.paginate(rowsFake, 1, 20)) + '</div>' +
  '<p class="pv-cap">중간 쪽(6/12) — 번호 버튼에 생략 표시(…)</p><div class="pv-card" style="max-width:520px;margin-bottom:12px">' + V.pagerHtml(L.paginate(rowsFake, 6, 20)) + '</div>' +
  '<p class="pv-cap">마지막 쪽 — 다음 버튼 비활성</p><div class="pv-card" style="max-width:520px;margin-bottom:12px">' + V.pagerHtml(L.paginate(rowsFake, 12, 20)) + '</div>' +
  '<p class="pv-cap">결과가 한 쪽뿐일 때 — 번호 이동 없이 건수 안내와 페이지당 건수만 표시</p><div class="pv-card" style="max-width:520px">' + V.pagerHtml(L.paginate(rowsFake.slice(0, 7), 1, 20)) + '</div>';
const sec = (n, t, body, box = true) => `<div class="pv-sec"><p class="pv-h">${n}. ${t}</p>${box ? '<div class="pv-box">' + body + '</div>' : body}</div>`;
const html = `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>전자결재 v2 UI 미리보기 (가짜 샘플 데이터)</title>
<link rel="stylesheet" href="theme/tokens.css"><link rel="stylesheet" href="theme/base.css"><link rel="stylesheet" href="theme/components.css"><link rel="stylesheet" href="theme/shell.css"><link rel="stylesheet" href="theme/edoc.css">
<style>.pv-sec{max-width:1200px;margin:32px auto;padding:0 16px}.pv-h{font-size:14px;color:var(--c-ink-2);margin:0 0 8px;font-weight:700}.pv-cap{font-size:12px;color:var(--c-ink-2);margin:12px 0 4px}.pv-box{background:var(--c-bg);padding:16px;border:1px dashed var(--c-line-strong);border-radius:12px}.pv-card{background:var(--c-surface);border:1px solid var(--c-line);border-radius:12px;max-width:760px}</style></head><body>
${sec(1, '앱 셸 + 결재함 + 상세 (900px 이상 PC 배치 / 미만 모바일 배치) — 1단계, 이미 구현됨', shellHtml, false)}
${sec(2, '로그인 (오류 메시지 표시 상태) — 1단계', loginHtml)}
${sec(3, '상태 배지 6종', statuses)}
${sec(4, '결재선 타임라인 상태: done 완료 · current 결재 차례 · pending 대기 · ref 열람 · rejected 반려 · skipped 전결로 건너뜀', stepStates)}
${sec(5, '공통 상태: 빈 화면 · 로딩 · 알림 3종 · 칩 · 버튼', states)}
${sec(6, '[2단계] 새 문서 — 연차신청서 (오류 표시·권장과 다른 결재선·필수 결재자 경고 포함)', `<div class="pv-card">${leaveForm}</div>`)}
${sec(7, '[2단계] 새 문서 — 구매·지출 결의서 (구분 전환, 권장 결재선과 같은 상태)', `<div class="pv-card">${spendForm}</div>`)}
${sec(8, '[2단계] 문서 상세 하단 처리 버튼 4가지 경우 (모바일에서는 화면 아래 고정)', actionbars)}
${sec(9, '[2단계] 확인 창 (반려 사유 입력)', dialog)}
${sec(10, '[2단계] 전자결재 홈 (숫자 카드 + 목록 2개)', dashboard)}
${sec(11, '[2단계] 관리자 설정 (필수 결재자·대리 승인·문서별 권장 결재선)', settings)}
${sec(12, '[3단계] 인쇄 양식 (A4, 결재란 도장 칸)', paper)}
${sec(13, '결재함 페이지 구분 (10·20·30건씩 / 모바일은 "현재 / 전체" 요약만 표시)', pagers)}
</body></html>`;
fs.writeFileSync(out, html);
console.log('생성:', out, html.length, 'bytes');
