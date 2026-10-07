import { esc, escMultiline } from '../../core/ui.js?v=20261007i';
import { TYPE_LABEL, fmtYmd, fmtDateTime, isPassive, toMillis } from './logic.js?v=20261007i';
import { FORMS } from './forms.js?v=20261007i';

/* 인쇄·PDF 양식 — 승인(또는 게시)된 문서만 뽑는다. 화면의 .jh-paper 는 어느 테마에서도 흰 종이(A4)다. */
const dotted = (s) => String(s || '').replace(/-/g, '. ');
const spaced = (s) => String(s).split('').join(' ');
const nz = (v, blank) => (v == null || String(v).trim() === '' ? (blank == null ? '' : blank) : v);

export function canPrint(doc) { return !!doc && (doc.status === 'approved' || doc.status === 'posted'); }

/** 결재란: 작성 + 결재 단계들. 승인된 칸에는 이름과 일자가 찍힌다(도장 대신). */
export function stampsHtml(doc) {
  const line = Array.isArray(doc.approvalLine) ? doc.approvalLine : [];
  const steps = line.filter((s) => s.role === '작성' || (!isPassive(s.role) && s.status !== 'skipped'));
  const cell = (s) => {
    const done = s.role === '작성' || s.status === 'approved';
    const when = s.role === '작성' ? fmtYmd(doc.createdAt ? new Date(toMillis(doc.createdAt)).toISOString().slice(0, 10) : '') : (s.approvedAt ? fmtDateTime(s.approvedAt).slice(5, 10).replace('.', '-') : '');
    return '<div class="jh-stamp"><div class="jh-stamp__role">' + esc(s.role === '작성' ? '담당' : s.role.replace(/^결재/, '결재 ')) + '</div>' +
      '<div class="jh-stamp__sign">' + (done ? esc(s.name || '') + '<br>' + esc(when) : '') + '</div>' +
      '<div class="jh-stamp__name">' + esc((s.name || '') + (s.proxyByName ? '(대리 ' + s.proxyByName + ')' : '')) + '</div></div>';
  };
  return '<div class="jh-stamps">' + steps.map(cell).join('') + '</div>';
}

const kvTable = (rows) => '<table class="jh-paper__table"><tbody>' + rows.filter((r) => r).map((r) => '<tr><th>' + esc(r[0]) + '</th><td' + (r[2] ? ' colspan="3"' : '') + '>' + (r[1] === '' || r[1] == null ? '&nbsp;' : r[1]) + '</td></tr>').join('') + '</tbody></table>';

function companyBlock(co, who) {
  const c = co || {};
  return '<div class="jh-paper__company"><div class="jh-paper__date">' + esc(who.dateText) + '</div>' +
    '<div>' + esc(nz(c.name, 'JH솔루션즈')) + '</div>' +
    (c.address ? '<div>' + esc(c.address) + '</div>' : '') + (c.bizNo ? '<div>사업자등록번호 ' + esc(c.bizNo) + '</div>' : '') +
    '<div>' + (who.en ? 'CEO' : '대표자') + ' ' + esc(nz(c.ceo, '')) + ' <span class="jh-paper__seal">' + (who.en ? '(Seal)' : '(직인)') + '</span></div></div>';
}

/** info: { hireDate, issueDate } 화면에서 입력한 인쇄용 정보, company: 회사 정보 */
export function paperHtml(doc, info, company) {
  const I = info || {}; const today = I.issueDate || new Date().toISOString().slice(0, 10);
  doc = Object.assign({}, doc, { authorDept: nz(doc.authorDept, I.dept), authorRank: nz(doc.authorRank, I.rank) });   // 문서에 없으면 인사 명부 값
  const t = doc.dtype;
  if (t === 'cert') {
    const en = String(doc.language || '').indexOf('영문') !== -1;
    const rows = en
      ? [['Name', esc(doc.authorName)], ['Department', esc(doc.authorDept)], ['Position', esc(doc.authorRank)], ['Date of Hire', esc(nz(I.hireDate))], ['Purpose', esc(doc.purpose)]]
      : [['성 명', esc(doc.authorName)], ['소 속', esc(doc.authorDept)], ['직 위', esc(doc.authorRank)], ['입 사 일', esc(dotted(I.hireDate))], ['용 도', esc(doc.purpose)]];
    return '<div class="jh-paper" data-paper="cert">' + stampsHtml(doc) +
      '<h1 class="jh-paper__title">' + (en ? 'CERTIFICATE OF EMPLOYMENT' : '재 직 증 명 서') + '</h1>' + kvTable(rows) +
      '<p class="jh-paper__body">' + (en ? 'This is to certify that the above-named person is currently employed at our company.' : '위 사람은 당사에 재직하고 있음을 증명합니다.') + '</p>' +
      companyBlock(company, { dateText: en ? today : dotted(today), en }) + '</div>';
  }
  if (t === 'resign') {
    const kind = doc.leaveKind === '휴직' ? '휴직' : '퇴직';
    const rows = [['소 속', esc(doc.authorDept)], ['직 위', esc(doc.authorRank)], ['성 명', esc(doc.authorName)], ['입 사 일', esc(dotted(I.hireDate))],
      [kind + ' 예정일', esc(dotted(doc.lastDate))], kind === '휴직' ? ['복직 예정일', esc(dotted(doc.returnDate))] : null, ['사 유', escMultiline(doc.reason)]];
    const created = doc.createdAt ? new Date(toMillis(doc.createdAt)).toISOString().slice(0, 10) : today;
    return '<div class="jh-paper" data-paper="resign">' + stampsHtml(doc) +
      '<h1 class="jh-paper__title">' + spaced(kind) + ' 원</h1>' + kvTable(rows) +
      '<p class="jh-paper__body">위와 같은 사유로 ' + kind + '하고자 하오니 허락하여 주시기 바랍니다.</p>' +
      '<div class="jh-paper__company"><div class="jh-paper__date">' + esc(dotted(created)) + '</div><div>신청인 ' + esc(doc.authorName) + ' <span class="jh-paper__seal">(서명)</span></div>' +
      '<div>' + esc(nz((company || {}).name, 'JH솔루션즈')) + ' ' + esc(nz((company || {}).ceo, '대표')) + ' 귀하</div></div></div>';
  }
  // 그 밖의 문서: 제목 + 항목 표 + 결재 이력
  const form = FORMS[t] || { rows: [] };
  const rows = form.rows.map((r) => {
    const raw = r.get ? r.get(doc) : doc[r.key];
    if (raw == null || raw === '' || (Array.isArray(raw) && !raw.length)) return null;
    const val = Array.isArray(raw) ? raw.map((x) => esc(x)).join('<br>') : r.fmt === 'multiline' ? escMultiline(raw) : r.fmt === 'date' ? esc(fmtYmd(raw)) : r.fmt === 'money' ? esc(Number(raw).toLocaleString('ko-KR')) : r.fmt === 'days' ? esc(raw) + '일' : esc(raw);
    return [r.label, val, r.fmt === 'multiline'];
  });
  const line = (Array.isArray(doc.approvalLine) ? doc.approvalLine : []).filter((s) => s.role !== '작성');
  const hist = line.map((s) => [s.role + (s.deputy ? '·업무대리' : ''), esc((s.name || '') + (s.rank ? ' ' + s.rank : '')) + ' — ' + (s.status === 'approved' ? '승인 ' + esc(fmtDateTime(s.approvedAt)) + (s.proxyByName ? ' (대리 ' + esc(s.proxyByName) + ')' : '') : s.status === 'skipped' ? '전결 생략' : isPassive(s.role) ? '열람' : esc(s.status)), true]);
  return '<div class="jh-paper" data-paper="generic">' + stampsHtml(doc) +
    '<h1 class="jh-paper__title">' + esc(spaced((TYPE_LABEL[t] || t).replace(/\s/g, ''))) + '</h1>' +
    kvTable([['제 목', esc(doc.title || ''), true], ['작성자', esc((doc.authorName || '') + (doc.authorRank ? ' ' + doc.authorRank : '') + (doc.authorDept ? ' · ' + doc.authorDept : '')), true]].concat(rows)) +
    '<h3 class="jh-paper__sub">결재 내역</h3>' + kvTable(hist) + '</div>';
}

/** 화면에서만 보이는 인쇄 준비 패널(인쇄물에는 나오지 않음) */
export function printPanelHtml(doc, info, company, isAdmin) {
  const needs = doc.dtype === 'cert' || doc.dtype === 'resign';
  const c = company || {};
  const missing = needs && (!c.ceo || !c.bizNo || !c.address);
  const fld = (id, label, val, type, hint) => '<div class="jh-field"><label class="jh-field__label" for="' + id + '">' + esc(label) + '</label><input class="jh-input" id="' + id + '" data-print="' + id + '" type="' + (type || 'text') + '" value="' + esc(val || '') + '">' + (hint ? '<span class="jh-field__hint">' + esc(hint) + '</span>' : '') + '</div>';
  return '<div class="jh-form jh-noprint"><header class="jh-form__head"><h2 class="jh-form__title">인쇄 · PDF</h2><p class="jh-form__sub">아래 양식을 확인하고 "인쇄 / PDF 저장"을 누르세요. 인쇄 창에서 대상을 "PDF로 저장"으로 고르면 PDF 파일이 됩니다.</p></header>' +
    (needs ? '<section class="jh-form__section"><h3 class="jh-form__h">발급 정보 <small>(이 화면에서만 쓰며 저장되지 않습니다)</small></h3><div class="jh-form__row">' +
      fld('hireDate', '입사일', info.hireDate, 'date', info.fromRoster ? '인사 명부에서 불러왔습니다. 다르면 고쳐 주세요.' : '인사 명부에 입사일이 없어 직접 입력합니다.') + fld('issueDate', doc.dtype === 'cert' ? '발급일' : '작성일', info.issueDate, 'date') + '</div></section>' : '') +
    (needs && isAdmin ? '<section class="jh-form__section"><h3 class="jh-form__h">회사 정보 <small>(관리자만 수정 · 모든 증명서에 공통)</small></h3>' +
      '<div class="jh-form__row">' + fld('co-name', '상호', c.name || 'JH솔루션즈') + fld('co-ceo', '대표자', c.ceo) + '</div><div class="jh-form__row">' + fld('co-bizNo', '사업자등록번호', c.bizNo) + fld('co-address', '주소', c.address) + '</div>' +
      '<div><button type="button" class="jh-btn" data-variant="secondary" data-save-company>회사 정보 저장</button></div></section>' : '') +
    (missing ? '<div class="jh-alert" data-tone="warn" role="alert">회사 정보(대표자·사업자등록번호·주소)가 비어 있어 증명서에 표시되지 않습니다. ' + (isAdmin ? '위 "회사 정보"를 입력하고 저장하세요.' : '관리자에게 입력을 요청하세요.') + '</div>' : '') + '</div>';
}
