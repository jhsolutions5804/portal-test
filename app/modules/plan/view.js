import { esc } from '../../core/ui.js?v=20261031a';
import { COMP_ROLES, compGroups } from './logic.js?v=20261031a';
const card = (title, body, right) => '<section class="jh-card"><div class="jh-panel__head"><h3>' + esc(title) + '</h3>' + (right || '') + '</div>' + body + '</section>';
const roleChips = (c) => COMP_ROLES.filter(([k]) => c[k]).map(([k, l]) => '<span class="jh-plan__chip" data-role="' + k + '">' + esc(l) + '</span>').join(' ');
const compRow = (c) => '<button type="button" class="jh-plan__row" data-pc-open="' + esc(c.id) + '"><span class="jh-plan__main"><span class="jh-plan__line"><strong>' + esc(c.company || '-') + '</strong>' + roleChips(c) + '</span><span class="jh-field__hint">' + esc([c.ceo ? '대표 ' + c.ceo : '', c.bizno || '', c.tel || ''].filter(Boolean).join(' · ')) + '</span></span><span class="jh-field__hint">수정 ›</span></button>';
const group = (title, list, emptyText) => '<div class="jh-plan__group"><div class="jh-plan__gtitle">' + esc(title) + ' <span class="jh-field__hint">' + list.length + '</span></div>' + (list.length ? list.map(compRow).join('') : '<div class="jh-empty">' + esc(emptyText) + '</div>') + '</div>';
/** 거래처 목록. st.view: 'all'(발행처·수신처·미지정) | 'partners'(협력사) */
export function companiesListHtml(st) {
  const g = compGroups(st.companies, st.view); const partners = st.view === 'partners';
  const head = '<div class="jh-plan__bar"><button type="button" class="jh-btn" data-variant="primary" data-pc-act="new">+ 업체 등록</button></div><div class="jh-field__hint">' + (partners ? '위탁·지급 대상 업체입니다. 업체 수정에서 "협력사"로 지정하면 여기에 나타납니다.' : '업체를 등록하고 역할(발행처 / 수신처 / 협력사)을 지정하면, 견적·정산 작성 시 역할에 맞는 드롭다운에 나타납니다.') + '</div>';
  const body = partners ? group('협력사 (지급 대상)', g.vendors, '협력사로 지정된 업체가 없습니다.') : group('발행처 (우리 발행 주체)', g.sup, '발행처로 지정된 업체가 없습니다.') + group('수신처 (거래 상대)', g.cli, '수신처로 지정된 업체가 없습니다.') + (g.none.length ? group('역할 미지정', g.none, '') : '');
  return '<div class="jh-plan">' + card(partners ? '협력사' : '거래처', '<div class="jh-plan__pad">' + head + body + '</div>') + '</div>';
}
const fld = (label, inner, hint) => '<div class="jh-field"><label class="jh-field__label">' + esc(label) + '</label>' + inner + (hint ? '<div class="jh-field__hint">' + esc(hint) + '</div>' : '') + '</div>';
const inp = (key, val, attr) => '<input class="jh-input" data-pc-f="' + key + '" value="' + esc(val == null ? '' : val) + '" ' + (attr || '') + '>';
/** 업체 등록·수정 폼. st.form(compToForm), st.sel(수정 중인 문서 id 또는 '') */
export function companyFormHtml(st) {
  const f = st.form; const edit = !!st.sel;
  const roles = COMP_ROLES.map(([k, l, h]) => '<label class="jh-plan__check"><input type="checkbox" data-pc-role="' + k + '"' + (f[k] ? ' checked' : '') + '> <span><strong>' + esc(l) + '</strong> <span class="jh-field__hint">' + esc(h) + '</span></span></label>').join('');
  const cts = f.contacts.map((t, i) => '<div class="jh-plan__ct"><input class="jh-input" placeholder="이름" data-pc-ct="' + i + ':name" value="' + esc(t.name) + '"><input class="jh-input" placeholder="전화번호" inputmode="tel" data-pc-ct="' + i + ':tel" value="' + esc(t.tel) + '"><input class="jh-input" placeholder="이메일" data-pc-ct="' + i + ':email" value="' + esc(t.email) + '"><button type="button" class="jh-btn" data-variant="ghost" data-pc-ctdel="' + i + '" aria-label="담당자 삭제">✕</button></div>').join('');
  const body = '<div class="jh-plan__pad">' + fld('회사명', inp('company', f.company)) + fld('역할 (중복 선택 가능)', '<div class="jh-plan__checks">' + roles + '</div>') + '<div class="jh-plan__grid">' + fld('대표자', inp('ceo', f.ceo)) + fld('사업자번호', inp('bizno', f.bizno)) + '</div>' + fld('주소', inp('address', f.address))
    + '<div class="jh-field"><div class="jh-plan__bar"><label class="jh-field__label">담당자</label><button type="button" class="jh-btn" data-variant="ghost" data-pc-act="ct-add">+ 담당자 추가</button></div>' + cts + '<div class="jh-field__hint">담당자를 등록하면 견적·정산 작성 시 업체 선택 후 담당자를 선택할 수 있습니다.</div></div>'
    + '<div class="jh-plan__bar">' + (edit ? '<button type="button" class="jh-btn" data-variant="danger" data-pc-act="del">삭제</button>' : '') + '<button type="button" class="jh-btn" data-variant="ghost" data-pc-act="cancel">취소</button><button type="button" class="jh-btn" data-variant="primary" data-pc-act="save">저장</button></div></div>';
  return '<div class="jh-plan"><div class="jh-plan__bar"><button type="button" class="jh-btn" data-variant="ghost" data-pc-act="cancel">← 거래처 목록</button></div>' + card(edit ? '업체 수정' : '업체 등록', body) + '</div>';
}
