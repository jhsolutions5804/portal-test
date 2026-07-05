/* JH Solutions 모바일 공통 인증 가드 (auth-guard.js)
   - 30분 무동작 시 자동 로그아웃
   - 공통 로그아웃 함수 window.jhLogout({confirm})
   모든 m/*.html 에서 <script src="auth-guard.js"></script> 로 로드한다.
   (Firebase를 직접 초기화하지 않고 IndexedDB 세션을 직접 정리하는 방식) */
(function(){
  var IDLE_MS   = 30 * 60 * 1000;   // 자동 로그아웃 기준: 30분
  var LAST_KEY  = 'jh_last_active';  // 마지막 활동 시각(ms) 저장 키
  var LOGIN_KEY = 'jh_login_perms';  // 로그인 여부 판단 키
  var THROTTLE  = 5000;              // 활동시각 저장 최소 간격(5초)

  var _lastTouch = 0;

  function nowMs(){ return Date.now(); }

  function isLoggedIn(){
    try{ return !!JSON.parse(localStorage.getItem(LOGIN_KEY) || 'null'); }
    catch(e){ return false; }
  }

  // 사용자 활동 시각 갱신 (과도한 저장 방지를 위해 5초 스로틀)
  function touch(){
    if(!isLoggedIn()) return;
    var t = nowMs();
    if(t - _lastTouch < THROTTLE) return;
    _lastTouch = t;
    try{ localStorage.setItem(LAST_KEY, String(t)); }catch(e){}
  }

  // 공통 로그아웃: localStorage + Firebase 세션(IndexedDB) 완전 정리 후 로그인 화면 복귀
  window.jhLogout = function(opts){
    opts = opts || {};
    if(opts.confirm && !window.confirm('로그아웃 하시겠습니까?')) return;
    try{
      localStorage.removeItem(LOGIN_KEY);
      localStorage.removeItem('jh_login_name');
      localStorage.removeItem('jh_login_full');
      localStorage.removeItem(LAST_KEY);
    }catch(e){}
    var moved = false;
    function go(){ if(moved) return; moved = true; location.replace('../index.html'); }
    try{
      var req = indexedDB.deleteDatabase('firebaseLocalStorageDb');
      req.onsuccess = go; req.onerror = go; req.onblocked = go;
    }catch(e){ go(); }
    setTimeout(go, 1000); // 안전망: IndexedDB 삭제가 지연/차단돼도 이동 보장
  };

  // 무동작 시간 초과 검사 → 초과 시 조용히 로그아웃
  function checkIdle(){
    if(!isLoggedIn()) return;
    var last = 0;
    try{ last = parseInt(localStorage.getItem(LAST_KEY) || '0', 10) || 0; }catch(e){}
    if(last && (nowMs() - last > IDLE_MS)){
      window.jhLogout({ confirm:false });
    }
  }

  // 페이지 진입 시: 먼저 방치 여부 검사, 통과하면 활동시각 갱신
  checkIdle();
  touch();

  // 사용자 활동 감지 → 활동시각 갱신
  ['click','keydown','touchstart','scroll'].forEach(function(ev){
    document.addEventListener(ev, touch, { passive:true });
  });

  // 페이지에 머무는 동안 주기 검사 (1분 간격)
  setInterval(checkIdle, 60 * 1000);
})();
