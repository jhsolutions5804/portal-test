/* time24.js — 포털 공용: 모든 <input type="time">을 24시간(HH:MM) 입력 칸으로 바꾼다.
   이유: type=time 의 표시 형식(오전/오후 12시간제)은 사용자 브라우저·기기 설정이 정해서 코드로 강제할 수 없다.
   동작: 숫자만 쳐도 자동으로 07:00 형태로 맞춤(7→07, 730→07:30, 0700→07:00), 포커스 시 30분 단위 목록 제안,
        범위 밖(예: 25:00)은 직전 값으로 되돌림. 값(.value)은 항상 'HH:MM' 문자열이라 기존 코드는 수정 없이 동작한다.
   적용: 페이지 로드 시점과 이후 동적으로 추가되는 칸(innerHTML 렌더 포함)을 모두 자동 변환. 이미 변환된 칸은 건너뜀. */
(function () {
  if (window.__JH_T24) return; window.__JH_T24 = true;
  var LIST_ID = 'jh-t24-list';

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function ensureList() {
    if (document.getElementById(LIST_ID) || !document.body) return;
    var dl = document.createElement('datalist'); dl.id = LIST_ID;
    for (var h = 0; h < 24; h++) for (var m = 0; m < 60; m += 30) { var o = document.createElement('option'); o.value = pad(h) + ':' + pad(m); dl.appendChild(o); }
    document.body.appendChild(dl);
  }
  /* 입력 중 자동 서식: 숫자만 남겨 HH:MM 으로. 삭제 중에는 콜론을 다시 붙이지 않음 */
  function liveFormat(raw, deleting) {
    var d = String(raw || '').replace(/\D/g, '').slice(0, 4);
    if (d.length >= 1 && +d[0] > 2) d = '0' + d;                       // 7 → 07
    if (d.length >= 2 && +d.slice(0, 2) > 23) d = d.slice(0, 1);         // 24~29 → 첫 자리만
    if (d.length >= 3 && +d[2] > 5) d = d.slice(0, 2) + '0' + d[2];      // 07:7 → 07:07
    d = d.slice(0, 4);
    if (d.length <= 2) return (d.length === 2 && !deleting) ? d + ':' : d;
    return d.slice(0, 2) + ':' + d.slice(2);
  }
  /* 확정 정규화: 완성된 시각이면 'HH:MM', 빈 값이면 '', 해석 불가면 null */
  function normalize(v) {
    v = String(v || '').trim(); if (!v) return '';
    var h, m;
    if (v.indexOf(':') >= 0) {                       // 콜론이 있으면 화면에 보이는 그대로 해석 (20:0 → 20:00, 7:3 → 07:30)
      var pr = v.split(':'), hs = pr[0].replace(/\D/g, ''), ms = (pr[1] || '').replace(/\D/g, '').slice(0, 2);
      if (!hs || hs.length > 2) return null;
      h = +hs; m = ms.length === 0 ? 0 : (ms.length === 1 ? (+ms <= 5 ? +ms * 10 : +ms) : +ms);
      if (h > 23 || m > 59) return null;
      return pad(h) + ':' + pad(m);
    }
    var d = v.replace(/\D/g, '');
    if (!d || d.length > 4) return null;
    if (d.length <= 2) { h = +d; m = 0; }
    else if (d.length === 3) { h = +d[0]; m = +d.slice(1); }
    else { h = +d.slice(0, 2); m = +d.slice(2); }
    if (h > 23 || m > 59) return null;
    return pad(h) + ':' + pad(m);
  }
  function upgrade(inp) {
    if (!inp || inp.__t24) return; inp.__t24 = true;
    var start = inp.value;
    inp.type = 'text'; inp.removeAttribute('step'); inp.removeAttribute('min'); inp.removeAttribute('max');
    inp.setAttribute('inputmode', 'numeric'); inp.setAttribute('maxlength', '5'); inp.setAttribute('autocomplete', 'off');
    inp.setAttribute('placeholder', 'HH:MM'); inp.setAttribute('pattern', '([01][0-9]|2[0-3]):[0-5][0-9]');
    inp.setAttribute('title', '24시간 형식 (예: 07:00, 18:30)'); inp.classList.add('t24');
    ensureList(); if (document.getElementById(LIST_ID)) inp.setAttribute('list', LIST_ID);
    var n = normalize(start); if (n !== null && n !== start) inp.value = n;
    inp.__last = inp.value;
    inp.addEventListener('input', function (e) {
      var deleting = !!(e && e.inputType && e.inputType.indexOf('delete') === 0);
      var f = liveFormat(inp.value, deleting);
      if (f !== inp.value) inp.value = f;
    });
    inp.addEventListener('focus', function () { inp.__last = inp.value; });
  }
  function scan(root) {
    if (!root || !root.querySelectorAll) return;
    if (root.matches && root.matches('input[type="time"]')) upgrade(root);
    var l = root.querySelectorAll('input[type="time"]'); for (var i = 0; i < l.length; i++) upgrade(l[i]);
  }
  /* change 를 캡처 단계에서 먼저 정규화 → 기존 onchange 핸들러·저장 로직은 항상 정규화된 값을 읽는다 */
  document.addEventListener('change', function (e) {
    var t = e.target; if (!t || !t.__t24) return;
    var n = normalize(t.value);
    if (n === null) { t.value = t.__last || ''; t.style.outline = '2px solid #DC2626'; setTimeout(function () { t.style.outline = ''; }, 900); }
    else { t.value = n; t.__last = n; }
  }, true);
  document.addEventListener('focusout', function (e) {   // change 가 안 뜨는 경우(값 변화 없음)도 정리
    var t = e.target; if (!t || !t.__t24) return;
    var n = normalize(t.value); if (n === null) t.value = t.__last || ''; else if (n !== t.value) t.value = n;
  }, true);

  function boot() { scan(document); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  new MutationObserver(function (ms) {
    for (var i = 0; i < ms.length; i++) { var a = ms[i].addedNodes; for (var j = 0; j < a.length; j++) if (a[j].nodeType === 1) scan(a[j]); }
  }).observe(document.documentElement, { childList: true, subtree: true });
  window.JH_normalizeTime24 = normalize;   // 다른 코드에서 쓸 수 있게 공개
})();
