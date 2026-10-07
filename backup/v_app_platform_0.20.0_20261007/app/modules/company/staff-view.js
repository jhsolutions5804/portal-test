import { esc } from '../../core/ui.js?v=20261007e';
import { PERM_KEYS, hasPerm, sortStaff, ranksFor, linkedWorkerOf } from './staff-logic.js?v=20261007e';
import { isGuestUser } from '../../shared/org.js?v=20261007e';

export function staffListHtml(users, workers) {
  const rows = sortStaff(users).map((u) => {
    const guest = isGuestUser(u); const lw = linkedWorkerOf(workers, u.uid); const adm = u.admin === true;
    const badges = (adm ? '<span class="jh-chip">관리자</span>' : '') + (guest ? '<span class="jh-chip">GUEST</span>' : '') + (u.status && u.status !== 'approved' ? '<span class="jh-chip">' + esc(u.status === 'pending' ? '승인 대기' : u.status) + '</span>' : '') + (!guest ? (lw ? '<span class="jh-chip">명부 연동</span>' : '<span class="jh-chip" data-warn="true">명부 미연동</span>') : '');
    const perms = adm ? '<span class="jh-field__hint">관리자는 모든 모듈이 열립니다.</span>' : PERM_KEYS.map(([k, l]) => '<button type="button" class="jh-staff__perm" data-perm="' + k + '" data-uid="' + esc(u.uid) + '" aria-pressed="' + hasPerm(u, k) + '">' + l + '</button>').join('');
    return '<div class="jh-card jh-staff__row" data-uid="' + esc(u.uid) + '"><div class="jh-staff__who"><div class="jh-staff__name"><strong>' + esc(u.name || '-') + '</strong> <span class="jh-field__hint">' + esc([u.rank, u.dept || '(미지정)', u.empNo].filter(Boolean).join(' · ')) + '</span></div><div class="jh-staff__badges">' + badges + '</div></div><div class="jh-staff__perms" role="group" aria-label="' + esc((u.name || '') + ' 모듈 권한') + '">' + perms + '</div><div><button type="button" class="jh-btn" data-variant="secondary" data-staff-edit="' + esc(u.uid) + '">상세 수정</button></div></div>';
  }).join('');
  return '<p class="jh-field__hint">직원별 모듈 권한을 켜고 끄고, 상세 정보(사번·이름·직급·부서·전화)를 고칩니다. 프로젝트별 참여 지정은 각 프로젝트의 설정 탭에서 합니다.</p><div class="jh-staff__list">' + (rows || '<div class="jh-empty">등록된 계정이 없습니다.</div>') + '</div>' +
    '<p class="jh-field__hint">계정 생성·비밀번호 재설정은 서버 함수 재배포 후 이 화면에 추가됩니다.</p>';
}
export function staffDialogHtml(u, lw, depts, match) {
  const depOpts = ['<option value="">(미지정)</option>'].concat((u.dept && depts.indexOf(u.dept) === -1 ? depts.concat([u.dept]) : depts).map((d) => '<option value="' + esc(d) + '"' + (d === u.dept ? ' selected' : '') + '>' + esc(d) + '</option>')).join('');
  const rankOpts = ['<option value="">(없음)</option>'].concat(ranksFor(u.rank).map((r) => '<option value="' + esc(r) + '"' + (r === u.rank ? ' selected' : '') + '>' + esc(r) + '</option>')).join('');
  const link = isGuestUser(u) ? '' : (lw ? '<p class="jh-field__hint">인사 명부 연동됨 — 저장하면 명부의 이름·사번·직급·부서·전화도 같이 맞춰집니다.</p>' : (match ? '<div class="jh-staff__link"><span class="jh-field__hint">인사 명부에 같은 ' + esc(match.empNo ? '사번' : '이름') + '의 항목(' + esc(match.name || '') + ')이 있습니다.</span><button type="button" class="jh-btn" data-variant="secondary" data-staff-link>이 명부 항목과 연동</button></div>' : '<p class="jh-field__hint">인사 명부와 연동되어 있지 않고, 같은 사번·이름의 항목도 없습니다. 인사 화면에서 등록한 뒤 연동해 주세요.</p>'));
  return '<div class="jh-dialog__backdrop" data-close></div><div class="jh-dialog__panel jh-profile" role="document"><h3 class="jh-dialog__title" id="sf-title">' + esc(u.name || '직원') + ' 상세 수정</h3><div class="jh-dialog__body jh-profile__body">' +
    '<label class="jh-field"><span class="jh-field__label">이름</span><input class="jh-input" id="sf-name" value="' + esc(u.name || '') + '"></label>' +
    '<label class="jh-field"><span class="jh-field__label">사번</span><input class="jh-input" id="sf-emp" value="' + esc(u.empNo || '') + '"></label>' +
    '<label class="jh-field"><span class="jh-field__label">직급</span><select class="jh-input" id="sf-rank">' + rankOpts + '</select></label>' +
    '<label class="jh-field"><span class="jh-field__label">부서</span><select class="jh-input" id="sf-dept">' + depOpts + '</select></label>' +
    '<label class="jh-field"><span class="jh-field__label">전화번호</span><input class="jh-input" id="sf-phone" type="tel" inputmode="tel" value="' + esc(u.phone || '') + '" placeholder="010-0000-0000"></label>' +
    '<p class="jh-field__hint">메일(아이디): ' + esc(u.email || '-') + '</p>' + link + '<p class="jh-field__hint" data-sf-msg role="alert"></p></div>' +
    '<div class="jh-dialog__actions"><button type="button" class="jh-btn" data-variant="ghost" data-close>취소</button><button type="button" class="jh-btn" data-variant="primary" data-staff-save>저장</button></div></div>';
}
