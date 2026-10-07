/* 새 버전 자동 확인 — GitHub Pages 와 앱 안 브라우저(카카오톡 등)는 index.html 을 길게 기억해서, 배포 후에도 옛 화면이 보일 수 있다.
 * version.json 은 매번 새로 받아(주소에 시각을 붙이고 캐시 사용 안 함) 지금 실행 중인 빌드와 비교한다. 다르면 캐시를 피하는 주소(?r=빌드)로 한 번만 다시 불러온다. */
export async function checkForUpdate() {
  try {
    const here = (document.querySelector('meta[name="jh-build"]') || {}).content || '';
    if (!here) return;
    const r = await fetch(new URL('version.json', location.href).pathname + '?t=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) return;
    const latest = (await r.json()).build;
    if (!latest || latest === here) return;
    const key = 'jh.reload.' + latest;                       // 같은 빌드로는 한 번만(무한 반복 방지)
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    const u = new URL(location.href); u.searchParams.set('r', latest); location.replace(u.toString());
  } catch (e) { /* 확인 실패는 무시 */ }
}
