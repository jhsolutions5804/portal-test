import { esc } from '../../core/ui.js?v=20261008n';
import { PERM_KEYS, hasPerm, sortStaff, ranksFor, linkedWorkerOf } from './staff-logic.js?v=20261008n';
import { isGuestUser } from '../../shared/org.js?v=20261008n';

export function staffListHtml(users, workers, meUid) {
  const rows = sortStaff(users).map((u) => {
    const guest = isGuestUser(u); const lw = linkedWorkerOf(workers, u.uid); const adm = u.admin === true;
    const badges = (adm ? '<span class="jh-chip">관리자</span>' : '') + (guest ? '<span class="jh-chip">GUEST</span>' : '') + (u.status && u.status !== 'approved' ? '<span class="jh-chip" data-warn="true">' + esc(u.status === 'pending' ? '승인 대기' : u.status === 'suspended' ? '사용 중지' : u.status) + '</span>' : '') + (!guest ? (lw ? '<span class="jh-chip">명부 연동</span>' : '<span class="jh-chip" data-warn="true">명부 미연동</span>') : '');
    const perms = adm ? '<span class="jh-field__hint">관리자는 모든 모듈이 열립니다.</span>' : PERM_KEYS.map(([k, l]) => '<button type="button" class="jh-staff__perm" data-perm="' + k + '" data-uid="' + esc(u.uid) + '" aria-pressed="' + hasPerm(u, k) + '">' + l + '</button>').join('');
    return '<div class="jh-card jh-staff__row" data-uid="' + esc(u.uid) + '"><div class="jh-staff__who"><div class="jh-staff__name"><strong>' + esc(u.name || '-') + '</strong> <span class="jh-field__hint">' + esc([u.rank, u.dept || '(미지정)', u.empNo].filter(Boolean).join(' · ')) + '</span></div><div class="jh-staff__badges">' + badges + '</div></div><div class="jh-staff__perms" role="group" aria-label="' + esc((u.name || '') + ' 모듈 권한') + '">' + perms + '</div><div><button type="button" class="jh-btn" data-variant="secondary" data-staff-edit="' + esc(u.uid) + '">상세 수정</button></div></div>';
  }).join('');
  return '<div class="jh-staff__bar"><button type="button" class="jh-btn" data-variant="primary" data-staff-new>＋ 새 직원 계정</button></div><p class="jh-field__hint">직원별 모듈 권한을 켜고 끄고, 상세 정보(사번·이름·직급·부서·전화)를 고칩니다. 프로젝트별 참여 지정은 각 프로젝트의 설정 탭에서 합니다.</p><div class="jh-staff__list">' + (rows || '<div class="jh-empty">등록된 계정이 없습니다.</div>') + '</div>' +
    '<p class="jh-field__hint">계정 생성·임시 비밀번호·사용 중지는 서버 함수(adminAct)가 처리합니다. 비밀번호는 화면에 한 번만 보이고 어디에도 저장되지 않습니다.</p>';
}
export function staffDialogHtml(u, lw, depts, match, isSelf) {
  const depOpts = ['<option value="">(미지정)</option>'].concat((u.dept && depts.indexOf(u.dept) === -1 ? depts.concat([u.dept]) : depts).map((d) => '<option value="' + esc(d) + '"' + (d === u.dept ? ' selected' : '') + '>' + esc(d) + '</option>')).join('');
  const rankOpts = ['<option value="">(없음)</option>'].concat(ranksFor(u.rank).map((r) => '<option value="' + esc(r) + '"' + (r === u.rank ? ' selected' : '') + '>' + esc(r) + '</option>')).join('');
  const link = isGuestUser(u) ? '' : (lw ? '<p class="jh-field__hint">인사 명부 연동됨 — 저장하면 명부의 이름·사번·직급·부서·전화도 같이 맞춰집니다.</p>' : (match ? '<div class="jh-staff__link"><span class="jh-field__hint">인사 명부에 같은 ' + esc(match.empNo ? '사번' : '이름') + '의 항목(' + esc(match.name || '') + ')이 있습니다.</span><button type="button" class="jh-btn" data-variant="secondary" data-staff-link>이 명부 항목과 연동</button></div>' : '<p class="jh-field__hint">인사 명부와 연동되어 있지 않고, 같은 사번·이름의 항목도 없습니다. 인사 화면에서 등록한 뒤 연동해 주세요.</p>'));
  return '<div class="jh-dialog__backdrop" data-close></div><div class="jh-dialog__panel jh-profile" role="document"><h3 class="jh-dialog__title" id="sf-title">' + esc(u.name || '직원') + ' 상세 수정</h3><div class="jh-dialog__body jh-profile__body">' +
    '<label class="jh-field"><span class="jh-field__label">이름</span><input class="jh-input" id="sf-name" value="' + esc(u.name || '') + '"></label>' +
    '<label class="jh-field"><span class="jh-field__label">사번</span><input class="jh-input" id="sf-emp" value="' + esc(u.empNo || '') + '"></label>' +
    '<label class="jh-field"><span class="jh-field__label">직급</span><select class="jh-input" id="sf-rank">' + rankOpts + '</select></label>' +
    '<label class="jh-field"><span class="jh-field__label">부서</span><select class="jh-input" id="sf-dept">' + depOpts + '</select></label>' +
    '<label class="jh-field"><span class="jh-field__label">전화번호</span><input class="jh-input" id="sf-phone" type="tel" inputmode="tel" value="' + esc(u.phone || '') + '" placeholder="010-0000-0000"></label>' +
    '<p class="jh-field__hint">메일(아이디): ' + esc(u.email || '-') + '</p>' + link +
    (isSelf ? '' : '<div class="jh-profile__sec"><h4>계정 관리</h4><div class="jh-staff__acts"><button type="button" class="jh-btn" data-variant="secondary" data-staff-pw>임시 비밀번호 발급</button><button type="button" class="jh-btn" data-variant="secondary" data-staff-mail>재설정 메일 보내기</button><button type="button" class="jh-btn" data-variant="secondary" data-staff-status data-to="' + (u.status === 'approved' || !u.status ? 'suspended' : 'approved') + '">' + (u.status === 'approved' || !u.status ? '사용 중지' : '사용 재개') + '</button></div><p class="jh-field__hint">임시 비밀번호를 발급하면 열려 있는 로그인이 끊기고 새 비밀번호가 화면에 한 번만 보입니다. 사용 중지하면 이 직원은 로그인할 수 없습니다.</p></div>') +
    '<p class="jh-field__hint" data-sf-msg role="alert"></p></div>' +
    '<div class="jh-dialog__actions"><button type="button" class="jh-btn" data-variant="ghost" data-close>취소</button><button type="button" class="jh-btn" data-variant="primary" data-staff-save>저장</button></div></div>';
}
export function newAccountDialogHtml(depts) {
  const depOpts = ['<option value="">(미지정)</option>'].concat(depts.map((d) => '<option value="' + esc(d) + '">' + esc(d) + '</option>')).join('');
  const rankOpts = ['<option value="">(없음)</option>'].concat(ranksFor('').map((r) => '<option value="' + esc(r) + '">' + esc(r) + '</option>')).join('');
  return '<div class="jh-dialog__backdrop" data-close></div><div class="jh-dialog__panel jh-profile" role="document"><h3 class="jh-dialog__title" id="sf-title">새 직원 계정</h3><div class="jh-dialog__body jh-profile__body">' +
    '<label class="jh-field"><span class="jh-field__label">아이디 (메일 앞부분)</span><input class="jh-input" id="nf-id" autocomplete="off" placeholder="예: hong.gd"><span class="jh-field__hint">로그인 아이디는 <b>아이디@jhsol.kr</b> 입니다.</span></label>' +
    '<label class="jh-field"><span class="jh-field__label">이름</span><input class="jh-input" id="nf-name"></label>' +
    '<label class="jh-field"><span class="jh-field__label">사번</span><input class="jh-input" id="nf-emp"></label>' +
    '<label class="jh-field"><span class="jh-field__label">직급</span><select class="jh-input" id="nf-rank">' + rankOpts + '</select></label>' +
    '<label class="jh-field"><span class="jh-field__label">부서</span><select class="jh-input" id="nf-dept">' + depOpts + '</select></label>' +
    '<label class="jh-field"><span class="jh-field__label">전화번호</span><input class="jh-input" id="nf-phone" type="tel" inputmode="tel" placeholder="010-0000-0000"></label>' +
    '<div class="jh-field"><span class="jh-field__label">모듈 권한</span><div class="jh-staff__perms" id="nf-perms">' + PERM_KEYS.map(([k, l]) => '<button type="button" class="jh-staff__perm" data-nf-perm="' + k + '" aria-pressed="' + (k === 'edoc') + '">' + l + '</button>').join('') + '</div></div>' +
    '<p class="jh-field__hint">만들면 임시 비밀번호가 화면에 한 번만 나옵니다. 직원에게 전달하고 로그인 뒤 "내 정보"에서 바꾸도록 안내해 주세요.</p><p class="jh-field__hint" data-sf-msg role="alert"></p></div>' +
    '<div class="jh-dialog__actions"><button type="button" class="jh-btn" data-variant="ghost" data-close>취소</button><button type="button" class="jh-btn" data-variant="primary" data-nf-save>계정 만들기</button></div></div>';
}
/** 임시 비밀번호 결과 창 — 닫으면 다시 볼 수 없다 */
export function secretDialogHtml(title, email, pw) {
  return '<div class="jh-dialog__backdrop"></div><div class="jh-dialog__panel jh-profile" role="document"><h3 class="jh-dialog__title" id="sf-title">' + esc(title) + '</h3><div class="jh-dialog__body">' +
    '<dl class="jh-profile__dl"><dt>아이디</dt><dd>' + esc(email || '-') + '</dd><dt>임시 비밀번호</dt><dd><input class="jh-input" id="sf-secret" readonly value="' + esc(pw) + '" aria-label="임시 비밀번호"></dd></dl>' +
    '<div class="jh-alert" data-tone="warn" role="alert">이 창을 닫으면 비밀번호를 다시 볼 수 없습니다. 직원에게 안전한 방법으로 전달하고, 로그인 뒤 "내 정보"에서 바꾸도록 안내해 주세요.</div></div>' +
    '<div class="jh-dialog__actions"><button type="button" class="jh-btn" data-variant="secondary" data-secret-copy>복사</button><button type="button" class="jh-btn" data-variant="primary" data-secret-close>확인(닫기)</button></div></div>';
}
