/* NFC 출퇴근 화면 조각 — 문자열만 만든다(네트워크·저장 없음). 계산은 nfc-logic.js */
import { esc } from '../../core/ui.js?v=20261031f';
import { WORK_TYPES, locLabel, mapLink } from './nfc-logic.js?v=20261031f';

const ICON = { success: '✔', info: 'ℹ', warn: '!', danger: '✕' };

/** 태그 화면 한 장(직원 폰) — vm: tagResultView/FIXED_VIEWS/errorView 결과, extra: { registerHref, inputHref, retry } */
export function tagCardHtml(vm, extra) {
  const x = extra || {}; const v = vm || {};
  const btns = [];
  if (x.registerHref) btns.push('<a class="jh-btn" data-variant="primary" href="' + esc(x.registerHref) + '">이 폰 등록하기</a>');
  if (x.loginHref) btns.push('<a class="jh-btn" data-variant="primary" href="' + esc(x.loginHref) + '">포털에 로그인</a>');
  if (x.retry) btns.push('<button type="button" class="jh-btn" data-variant="secondary" data-tag-retry>다시 시도</button>');
  return '<div class="jh-tag" data-tone="' + esc(v.tone || 'info') + '" role="status" aria-live="polite">' +
    '<div class="jh-tag__icon" aria-hidden="true">' + esc(ICON[v.tone] || ICON.info) + '</div>' +
    '<h1 class="jh-tag__title">' + esc(v.title || '') + '</h1>' +
    (v.detail ? '<p class="jh-tag__detail">' + esc(v.detail) + '</p>' : '') +
    (v.note ? '<div class="jh-alert" data-tone="warn">' + esc(v.note) + '</div>' : '') +
    (btns.length ? '<div class="jh-tag__actions">' + btns.join('') + '</div>' : '') +
    (x.inputHref ? '<a class="jh-link jh-tag__fix" href="' + esc(x.inputHref) + '">잘못 기록되었으면 포털에서 수정 ›</a>' : '') + '</div>';
}

/** 기기 등록 화면(포털 로그인 상태, #/attendance/register) — S: { stage: idle|working|done|error, status, error, storageOk, label } */
export function registerPageHtml(S) {
  const head = '<div class="jh-panel__head"><h3>📱 이 폰을 출퇴근 기기로 등록</h3></div>';
  const note = (tone, text) => '<div class="jh-alert" data-tone="' + tone + '"' + (tone === 'danger' ? ' role="alert"' : ' role="status"') + '>' + esc(text) + '</div>';
  let body;
  if (S.stage === 'done') {
    body = S.status === 'pending'
      ? note('info', '등록 요청을 보냈습니다. 이미 쓰는 기기가 있어 대표님 승인 후에 사용할 수 있습니다. 그때까지는 포털 출근 버튼을 쓰세요.')
      : note('success', '등록되었습니다. 이제 사무실 스티커에 이 폰을 대면 출근·퇴근이 기록됩니다.');
    if (S.storageOk === false) body += note('danger', '이 브라우저는 기기 정보를 저장하지 못했습니다. 사생활 보호(시크릿) 모드가 아닌지 확인하고, 다시 등록해 주세요.');
  } else if (S.stage === 'error') {
    body = note('danger', S.error || '등록하지 못했습니다. 잠시 후 다시 시도해 주세요.') + '<div><button type="button" class="jh-btn" data-variant="secondary" data-nfc-register>다시 시도</button></div>';
  } else {
    body = '<p>이 폰을 본인 기기로 등록하면 로그인 없이 사무실 NFC 스티커에 대는 것만으로 출퇴근이 기록됩니다.</p>' +
      '<ul class="jh-list"><li>한 사람이 한 기기만 등록할 수 있습니다. 기기를 바꾸면 대표님 승인이 필요합니다.</li><li>출근·퇴근을 누르는 순간의 위치만 확인하고, 하루 종일 추적하지 않습니다.</li><li>이 폰의 브라우저에 기기 정보가 저장됩니다. 브라우저 데이터를 지우면 한 번 다시 등록합니다.</li></ul>' +
      '<div><button type="button" class="jh-btn" data-variant="primary" data-nfc-register' + (S.stage === 'working' ? ' disabled' : '') + '>' + (S.stage === 'working' ? '등록하는 중…' : '이 폰 등록하기') + '</button></div>';
  }
  return '<div class="jh-panel jh-card">' + head + '<div class="jh-form">' + body + '</div></div>';
}

/** 출근 버튼 위쪽의 근무 구분 선택(사무실 · 출장 · 외근). 사무실이 기본이고 체크하지 않는다 */
export function workTypeFieldHtml(value, disabled) {
  return '<fieldset class="jh-clock__type" role="radiogroup" aria-label="근무 구분"' + (disabled ? ' disabled' : '') + '><legend class="jh-field__hint">근무 구분</legend>' +
    WORK_TYPES.map((w) => '<label class="jh-chip jh-clock__typeopt"><input type="radio" name="jh-wtype" data-wtype value="' + esc(w.v) + '"' + ((value || '') === w.v ? ' checked' : '') + '> ' + esc(w.label) + '</label>').join('') +
    '</fieldset><span class="jh-field__hint">사무실에서는 체크하지 않아도 됩니다. 출장·외근일 때만 선택하세요.</span>';
}

const dtText = (ms) => { if (!ms) return '—'; const d = new Date(ms); return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };

/** 대표님 근태 확인 화면 — S: { loading, error, rows(reviewRows), devices(deviceRows), office, officeForm, addr:{key:text}, busy, noKey } */
export function reviewPageHtml(S) {
  const panel = (title, inner, count) => '<div class="jh-panel jh-card"><div class="jh-panel__head"><h3>' + title + (count != null ? ' <span class="jh-chip"' + (count ? ' data-tone="accent"' : '') + '>' + count + '건</span>' : '') + '</h3></div><div class="jh-form">' + inner + '</div></div>';
  if (S.loading) return '<div class="jh-empty">불러오는 중…</div>';
  if (S.error) return '<div class="jh-card"><div class="jh-form"><div class="jh-alert" data-tone="danger" role="alert">' + esc(S.error) + '</div><button type="button" class="jh-btn" data-variant="secondary" data-nfc-reload>다시 불러오기</button></div></div>';
  const rowsHtml = S.rows.length ? S.rows.map((r) => {
    const addr = S.addr && S.addr[r.key];
    const where = r.pos ? (addr ? esc(addr) : (S.noKey ? '주소 변환 설정 전 · ' : '') + '<a class="jh-link" href="' + esc(mapLink(r.pos)) + '" target="_blank" rel="noopener">지도로 보기 ›</a>') : '';
    return '<div class="jh-docrow"><span class="jh-docrow__main"><span class="jh-docrow__title">' + esc(r.name) + (r.rank ? ' ' + esc(r.rank) : '') + ' · ' + esc(r.date) + ' ' + esc(r.time) + '</span>' +
      '<span class="jh-docrow__summary">' + esc(r.reason) + ' · ' + esc(r.via) + (r.distanceM != null ? ' · 사무실에서 약 ' + esc(r.distanceM) + 'm' : '') + (where ? ' · ' + where : '') + '</span></span>' +
      '<span class="jh-docrow__side"><button type="button" class="jh-btn" data-variant="secondary" data-nfc-resolve="' + esc(r.key) + '"' + (S.busy ? ' disabled' : '') + '>확인 처리</button></span></div>';
  }).join('') : '<div class="jh-empty">확인할 건이 없습니다.</div>';
  const pend = S.devices.filter((d) => d.pending); const act = S.devices.filter((d) => !d.pending);
  const devHtml = (list, pending) => list.map((d) => '<div class="jh-docrow"><span class="jh-docrow__main"><span class="jh-docrow__title">' + esc(d.name) + (d.rank ? ' ' + esc(d.rank) : '') + ' · ' + esc(d.label) + '</span>' +
    '<span class="jh-docrow__summary">' + (pending ? '요청 ' + esc(dtText(d.createdAtMs)) + ' · 승인하면 이전 기기는 해제됩니다' : '마지막 사용 ' + esc(dtText(d.lastUsedAtMs))) + '</span></span>' +
    '<span class="jh-docrow__side">' + (pending ? '<button type="button" class="jh-btn" data-variant="primary" data-nfc-approve="' + esc(d.id) + '"' + (S.busy ? ' disabled' : '') + '>승인</button> ' : '') +
    '<button type="button" class="jh-btn" data-variant="secondary" data-nfc-revoke="' + esc(d.id) + '"' + (S.busy ? ' disabled' : '') + '>' + (pending ? '거절' : '해제') + '</button></span></div>').join('');
  const o = S.office; const f = S.officeForm || {};
  const officeHtml = (o ? '<p>현재 사무실: ' + esc(o.address || '주소 미입력') + ' · 위도 ' + esc(o.lat) + ' · 경도 ' + esc(o.lng) + ' · 반경 ' + esc(o.radiusM) + 'm</p>' : '<div class="jh-alert" data-tone="warn" role="status">사무실 위치가 저장되지 않았습니다. 저장하기 전에는 모든 기록이 \"위치 확인 안 됨\"이 되어 확인 필요가 쏟아집니다.</div>') +
    '<div class="jh-field"><label class="jh-field__label">반경(m)</label><input class="jh-input" type="number" inputmode="numeric" min="50" max="2000" data-nfc-radius value="' + esc(f.radiusM == null ? (o ? o.radiusM : 200) : f.radiusM) + '"></div>' +
    '<div><button type="button" class="jh-btn" data-variant="primary" data-nfc-office-here' + (S.busy ? ' disabled' : '') + '>지금 내 위치를 사무실로 저장</button> <span class="jh-field__hint">사무실 안에서 이 폰으로 누르세요(위치 허용 필요).</span></div>' +
    (S.officeErr ? '<div class="jh-alert" data-tone="danger" role="alert">' + esc(S.officeErr) + '</div>' : '');
  return panel('확인 필요 출퇴근', rowsHtml, S.rows.length) + panel('기기 변경 요청', pend.length ? devHtml(pend, true) : '<div class="jh-empty">대기 중인 요청이 없습니다.</div>', pend.length) +
    panel('등록된 기기', act.length ? devHtml(act, false) : '<div class="jh-empty">등록된 기기가 없습니다.</div>', act.length) + panel('사무실 위치', officeHtml);
}
export { locLabel };
