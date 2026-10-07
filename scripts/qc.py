#!/usr/bin/env python3
"""포털 QC (읽기 전용 · 경고 모드)  v0.2
테섭(portal-test) 업데이트 후 '사람이 챙기던 점검'을 자동으로 확인한다. 파일을 수정하지 않는다.

사용:
  python3 qc.py <테섭 폴더> [--prod <본섭 폴더>] [--tree-test tree_test.json] [--strict]
  (폴더 = repo를 내려받은 로컬 복사본. --strict 이면 '실패'가 있을 때 종료코드 1, 기본은 항상 0)

검사 묶음
  A 문법        모듈/일반 script node --check, CSS 중괄호 깊이
  B 환경 오염    테섭에 본섭 Firebase 프로젝트 ID, 본섭에 portal-test 가 섞였는지
  C 버전 주석    모듈별 build/ver 존재, 테섭↔본섭 버전 비교(본섭 미반영/본섭이 더 최신)
  D 공용 규칙    type="time" 입력이 있는 화면에 time24.js 포함
  E 회귀 규칙    과거 사고(learnings)를 규칙으로: 일괄처리 함수가 재직 명부 헬퍼를 쓰는지 등
  F 인라인 핸들러 onclick 등에서 부르는 함수가 전역에 노출돼 있는지(모듈 스코프 ReferenceError 방지)
  G 배포 후 점검  버전이 docs 에 기록됐는지, backup 폴더가 있는지
  H 기존 스크립트 scripts/ 의 secret_check · app_check · module_check · ui_contract_check 실행
"""
import re, os, sys, json, glob, argparse, subprocess, tempfile

PROD_ID = 'p4ph2-fab-506a7'
TEST_ID = 'portal-test-6e0ff'
SKIP_DIRS = ('/backup/', '/docs/', '/scripts/', '/node_modules/', '/.git/', '/app/', '/tools/')
RESULTS = []   # (묶음, 상태, 대상, 내용)


def add(group, status, target, msg):
    RESULTS.append((group, status, target, msg))


def read(p):
    return open(p, encoding='utf-8', errors='replace').read()


def html_files(root):
    out = []
    for f in sorted(glob.glob(root + '/**/*.html', recursive=True)):
        n = '/' + os.path.relpath(f, root).replace(os.sep, '/')
        if any(s in n for s in SKIP_DIRS):
            continue
        out.append(f)
    return out


def rel(root, f):
    return os.path.relpath(f, root).replace(os.sep, '/')


SCRIPT_RE = re.compile(r'<script([^>]*)>(.*?)</script>', re.S | re.I)
STYLE_RE = re.compile(r'<style[^>]*>(.*?)</style>', re.S | re.I)


def inline_scripts(text):
    """(kind, code) 목록. kind = 'module' | 'classic'. 외부 src / JSON·템플릿 타입은 제외."""
    res = []
    for m in SCRIPT_RE.finditer(text):
        attrs, code = m.group(1), m.group(2)
        if re.search(r'\bsrc\s*=', attrs, re.I) or not code.strip():
            continue
        t = re.search(r'type\s*=\s*["\']([^"\']+)["\']', attrs, re.I)
        t = t.group(1).lower() if t else ''
        if t == 'module':
            res.append(('module', code))
        elif t in ('', 'text/javascript', 'application/javascript'):
            res.append(('classic', code))
    return res


def node_check(code, module):
    with tempfile.TemporaryDirectory() as d:
        p = os.path.join(d, 'x.mjs' if module else 'x.js')
        open(p, 'w', encoding='utf-8').write(code)
        r = subprocess.run(['node', '--check', p], capture_output=True, text=True)
        return r.returncode == 0, (r.stderr or '').strip().splitlines()[:6]


def css_depth_ok(css):
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    css = re.sub(r'"[^"\n]*"|\'[^\'\n]*\'', '""', css)
    depth = 0
    for ch in css:
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth < 0:
                return False, '닫는 중괄호가 더 많음'
    return (depth == 0), ('열린 중괄호 %d개 미닫힘' % depth if depth else '')


# ---------------------------------------------------------------- A 문법
def check_syntax(root, label):
    for f in html_files(root):
        t = read(f); name = rel(root, f)
        bad = []
        for i, (kind, code) in enumerate(inline_scripts(t)):
            ok, err = node_check(code, kind == 'module')
            if not ok:
                bad.append('script#%d(%s): %s' % (i + 1, kind, ' | '.join(err[:2])))
        for i, m in enumerate(STYLE_RE.finditer(t)):
            ok, why = css_depth_ok(m.group(1))
            if not ok:
                bad.append('style#%d: %s' % (i + 1, why))
        add('A 문법', '실패' if bad else '통과', '%s:%s' % (label, name), '; '.join(bad)[:300])
    for f in glob.glob(root + '/*.js') + glob.glob(root + '/m/*.js'):
        ok, err = node_check(read(f), False)
        add('A 문법', '통과' if ok else '실패', '%s:%s' % (label, rel(root, f)), ' | '.join(err[:2]))
    for f in glob.glob(root + '/**/*.css', recursive=True):
        n = '/' + rel(root, f)
        if any(s in n for s in SKIP_DIRS):
            continue
        ok, why = css_depth_ok(read(f))
        add('A 문법', '통과' if ok else '실패', '%s:%s' % (label, rel(root, f)), why)


# ---------------------------------------------------------------- B 환경 오염
STORAGE_CALL = re.compile(r'firebase-storage|getStorage|uploadBytes|uploadString|getDownloadURL|storage\(\)', re.I)


def scan_files(root):
    for f in glob.glob(root + '/**/*', recursive=True):
        if not os.path.isfile(f):
            continue
        n = '/' + rel(root, f)
        if any(s in n for s in SKIP_DIRS) or n.endswith('README.md'):
            continue
        if f.endswith(('.html', '.js', '.json', '.css')):
            yield f


def check_env_test(root):
    """테섭 파일에 본섭 Firebase 프로젝트 ID 가 있는지. storageBucket 한 줄뿐이면 '잠재 위험'(경고),
    그 파일이 실제로 Storage 를 호출하면 실패, 그 밖의 위치면 실패."""
    fail, latent = [], []
    for f in scan_files(root):
        t = read(f)
        if PROD_ID not in t:
            continue
        lines = [l for l in t.splitlines() if PROD_ID in l]
        only_bucket = all(re.search(r'storageBucket', l) for l in lines)
        if not only_bucket:
            fail.append('%s(%d)' % (rel(root, f), len(lines)))
        elif STORAGE_CALL.search(t):
            fail.append('%s(storageBucket+Storage 호출)' % rel(root, f))
        else:
            latent.append(rel(root, f))
    if fail:
        add('B 환경 오염', '실패', 'test', '본섭 프로젝트 ID 발견: ' + ', '.join(fail[:8]))
    if latent:
        add('B 환경 오염', '경고', 'test', 'storageBucket 만 본섭 값(Storage 호출은 없어 지금은 영향 없음, 나중에 업로드 기능을 넣으면 본섭 버킷으로 감) %d개: %s' % (len(latent), ', '.join(latent[:8])))
    if not fail and not latent:
        add('B 환경 오염', '통과', 'test', '')


def check_env(root, label, forbidden, what):
    hit = []
    for f in scan_files(root):
        c = sum(read(f).count(x) for x in forbidden)
        if c:
            hit.append('%s(%d)' % (rel(root, f), c))
    add('B 환경 오염', '실패' if hit else '통과', label, ('%s 발견: ' % what + ', '.join(hit[:8])) if hit else '')


# ---------------------------------------------------------------- C 버전 주석
def parse_version(text):
    for m in re.finditer(r'<!--(.*?)-->', text[:60000], re.S):
        c = m.group(1)
        b = re.search(r'build:?\s*(\d{8}[a-z]*)', c)
        if b:
            v = re.search(r'ver(?:sion)?:?\s*(\d+\.\d+\.\d+|\d{4}-\d{2}-\d{2})', c[b.start():])
            return b.group(1), (v.group(1) if v else None)
    return None, None


MODULES = ['index.html', 'hr/index.html', 'edoc/index.html', 'pjt/index.html', 'pjt_ph4/index.html', 'pjt_light/index.html',
           'gihoek/index.html', 'pjt_roster/index.html', 'pjt_manday/index.html', 'team/index.html', 'attendance/index.html',
           'daily-report/index.html', 'sign.html']


def versions(root):
    out = {}
    for m in MODULES:
        p = os.path.join(root, m)
        if os.path.exists(p):
            out[m] = parse_version(read(p))
    return out


def check_versions(test_root, prod_root):
    tv = versions(test_root)
    pv = versions(prod_root) if prod_root else {}
    for m, (b, v) in tv.items():
        if not b:
            add('C 버전 주석', '정보', 'test:' + m, 'build/ver 주석 없음(버전 비교 불가)'); continue
        if m in pv and pv[m][0]:
            pb, pver = pv[m]
            if b == pb:
                add('C 버전 주석', '통과', m, '테섭=본섭 build %s ver %s' % (b, v))
            elif b > pb:
                add('C 버전 주석', '정보', m, '본섭 미반영 — 테섭 %s(%s) / 본섭 %s(%s)' % (b, v, pb, pver))
            else:
                add('C 버전 주석', '경고', m, '본섭이 더 최신 — 테섭 %s(%s) / 본섭 %s(%s) → 테섭 반영 누락?' % (b, v, pb, pver))
        else:
            add('C 버전 주석', '통과' if not prod_root else '정보', m, '테섭 build %s ver %s%s' % (b, v, '' if not prod_root else ' (본섭에 없음)'))
    return tv, pv


# ---------------------------------------------------------------- D 공용 규칙
def check_time24(root, label):
    for f in html_files(root):
        t = read(f)
        n = len(re.findall(r'type=["\']time["\']', t))
        if n and 'time24.js' not in t:
            add('D 공용 규칙', '실패', '%s:%s' % (label, rel(root, f)), 'type="time" %d곳인데 time24.js 없음(24시간 통일 규칙)' % n)
        elif n:
            add('D 공용 규칙', '통과', '%s:%s' % (label, rel(root, f)), 'type="time" %d곳, time24.js 포함' % n)


# ---------------------------------------------------------------- E 회귀 규칙
REGRESSION = [
    # (파일, 함수 이름, 반드시 포함돼야 하는 문자열, 이유)
    ('pjt/index.html', 'toggleAllWorkers', 'getActiveWorkersForDate', '퇴사자 일괄처리는 재직 명부로 거름(퇴사자 처리 버그)'),
    ('pjt/index.html', 'setAllManday', 'getActiveWorkersForDate', '퇴사자 일괄처리는 재직 명부로 거름(퇴사자 처리 버그)'),
    ('pjt_ph4/index.html', 'toggleAllWorkers', 'getActiveWorkersForDate', '퇴사자 일괄처리는 재직 명부로 거름(퇴사자 처리 버그)'),
    ('pjt_ph4/index.html', 'setAllManday', 'getActiveWorkersForDate', '퇴사자 일괄처리는 재직 명부로 거름(퇴사자 처리 버그)'),
]


def func_body(text, name):
    m = re.search(r'(?:async\s+)?function\s+%s\s*\(' % re.escape(name), text)
    if not m:
        m = re.search(r'(?:window\.)?%s\s*=\s*(?:async\s*)?(?:function\s*)?\(' % re.escape(name), text)
        if not m:
            return None
    i = text.find('{', m.end())
    if i < 0:
        return None
    depth = 0
    for j in range(i, min(len(text), i + 60000)):
        if text[j] == '{':
            depth += 1
        elif text[j] == '}':
            depth -= 1
            if depth == 0:
                return text[i:j + 1]
    return None


def check_regression(root, label):
    for f, fn, must, why in REGRESSION:
        p = os.path.join(root, f)
        if not os.path.exists(p):
            continue
        body = func_body(read(p), fn)
        if body is None:
            add('E 회귀 규칙', '정보', '%s:%s' % (label, f), '%s() 함수를 찾지 못함(이름 변경?)' % fn)
        elif must not in body:
            add('E 회귀 규칙', '실패', '%s:%s' % (label, f), '%s() 에 %s 없음 — %s' % (fn, must, why))
        else:
            add('E 회귀 규칙', '통과', '%s:%s' % (label, f), '%s() → %s 사용' % (fn, must))


# ---------------------------------------------------------------- F 인라인 핸들러 전역 노출
HANDLER_RE = re.compile(r'\bon(?:click|change|input|keydown|keyup|keypress|submit|blur|focus|dblclick|mousedown|mouseup|touchstart|touchend|load)\s*=\s*\\?(?:"([^"]*)"|\'([^\']*)\')', re.I)
IGNORE = set('''if for while switch return function var let const new typeof this event null undefined true false
alert confirm prompt parseInt parseFloat Number String Boolean JSON Math Date Array Object RegExp Promise Set Map
isNaN isFinite encodeURIComponent decodeURIComponent escape unescape setTimeout setInterval clearTimeout clearInterval
open close print fetch requestAnimationFrame Error catch try else do in of async await void delete instanceof'''.split())


def global_defs(code, kind):
    names = set()
    names |= set(re.findall(r'window\.([A-Za-z_$][\w$]*)\s*=', code))
    names |= set(re.findall(r'window\[\s*[\'"]([\w$]+)[\'"]\s*\]\s*=', code))
    names |= set(re.findall(r'globalThis\.([A-Za-z_$][\w$]*)\s*=', code))
    for m in re.finditer(r'Object\.assign\(\s*window\s*,\s*\{(.*?)\}\s*\)', code, re.S):
        names |= set(re.findall(r'([A-Za-z_$][\w$]*)\s*(?:,|:|\}|$)', m.group(1)))
    if kind == 'classic':
        names |= set(re.findall(r'(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(', code))
        names |= set(re.findall(r'(?:^|[;\n])\s*(?:var|let|const)\s+([A-Za-z_$][\w$]*)', code))
    return names


def check_handlers(root, label):
    for f in html_files(root):
        t = read(f); name = rel(root, f)
        defs = set()
        for kind, code in inline_scripts(t):
            defs |= global_defs(code, kind)
        base = os.path.dirname(f)
        for m in re.finditer(r'<script[^>]*\bsrc\s*=\s*["\']([^"\']+)["\']', t, re.I):
            s = m.group(1).split('?')[0]
            if s.startswith(('http', '//')):
                continue
            sp = os.path.normpath(os.path.join(root if s.startswith('/') else base, s.lstrip('/') if s.startswith('/') else s))
            if os.path.isfile(sp):
                defs |= global_defs(read(sp), 'classic')
        called = {}
        for m in HANDLER_RE.finditer(t):
            h = m.group(1) or m.group(2) or ''
            h = re.sub(r'\$\{[^}]*\}', '', h)                       # 템플릿 보간은 만들 때 평가됨
            h = re.sub(r"\+\s*[A-Za-z_$][\w$.]*\s*(?:\([^()]*\))?\s*\+", '', h)  # '+esc(id)+' 문자열 연결도 만들 때 평가됨
            h = re.sub(r"\\?'[^']*\\?'|&quot;.*?&quot;|\\?\"[^\"]*\\?\"", '""', h)  # 문자열 안 내용 제외
            for fn in re.findall(r'(?<![\w.$])([A-Za-z_$][\w$]*)\s*\(', h):
                if fn in IGNORE:
                    continue
                called[fn] = called.get(fn, 0) + 1
        missing = sorted(n for n in called if n not in defs)
        if not called:
            continue
        if missing:
            add('F 인라인 핸들러', '경고', '%s:%s' % (label, name), '전역에서 못 찾은 함수 %d개: %s' % (len(missing), ', '.join(missing[:8])))
        else:
            add('F 인라인 핸들러', '통과', '%s:%s' % (label, name), '핸들러 함수 %d종 전역 확인' % len(called))


# ---------------------------------------------------------------- G 배포 후 점검
def check_postdeploy(tv, docs_dir, tree_paths, label):
    docs = ''
    if docs_dir and os.path.isdir(docs_dir):
        docs = '\n'.join(read(f) for f in glob.glob(docs_dir + '/*.md'))
    backups = []
    for tp in tree_paths:
        if tp and os.path.exists(tp):
            backups += [x['path'] for x in json.load(open(tp)) if x['path'].startswith('backup/')]
    for m, (b, v) in tv.items():
        if not v or not re.match(r'\d+\.\d+\.\d+$', v):
            continue
        if docs_dir:
            n = docs.count(v)
            add('G 배포 후 점검', '통과' if n else '경고', '%s docs' % m, 'docs에 버전 %s %d회 언급' % (v, n) if n else 'docs에 버전 %s 기록 없음 — 기능 문서/개발로그 갱신 확인' % v)
        if backups:
            hit = [p for p in backups if ('v' + v) in p or (b and b in p)]
            near = [p for p in backups if b and b[:8] in p]
            if hit:
                add('G 배포 후 점검', '통과', '%s backup' % m, '백업 %d개 (예: %s)' % (len(hit), hit[0]))
            elif near:
                add('G 배포 후 점검', '정보', '%s backup' % m, '버전명 일치는 없고 같은 날짜(%s) 백업 있음: %s' % (b[:8], near[0]))
            else:
                add('G 배포 후 점검', '경고', '%s backup' % m, 'backup/ 에서 v%s·build %s·날짜 %s 흔적 없음' % (v, b, b[:8] if b else '-'))


# ---------------------------------------------------------------- I 파일 존재 비교
def check_fileset(test_root, prod_root):
    def names(root):
        return {rel(root, f) for f in glob.glob(root + '/**/*', recursive=True)
                if os.path.isfile(f) and f.endswith(('.html', '.js', '.css')) and not any(s in '/' + rel(root, f) for s in SKIP_DIRS)}
    t, p = names(test_root), names(prod_root)
    only_p = sorted(p - t)
    if only_p:
        add('I 파일 존재 비교', '경고', '본섭에만 있는 파일 %d개' % len(only_p), ', '.join(only_p[:12]) + ' — 테섭에 없어 테섭에서 테스트 불가')
    only_t = sorted(t - p)
    if only_t:
        add('I 파일 존재 비교', '정보', '테섭에만 있는 파일 %d개' % len(only_t), ', '.join(only_t[:12]))
    if not only_p and not only_t:
        add('I 파일 존재 비교', '통과', '', '두 repo 파일 구성 동일')


# ---------------------------------------------------------------- H 기존 스크립트
def run_existing(root, label):
    root = os.path.abspath(root)
    for s, args in [('secret_check.py', [root]), ('app_check.py', []), ('module_check.py', []), ('ui_contract_check.py', [])]:
        p = os.path.join(root, 'scripts', s)
        if not os.path.exists(p):
            continue
        if s != 'secret_check.py' and not os.path.isdir(os.path.join(root, 'app')):
            continue
        r = subprocess.run([sys.executable, p] + args, capture_output=True, text=True, cwd=root)
        out = (r.stdout + r.stderr).strip().splitlines()
        add('H 기존 스크립트', '통과' if r.returncode == 0 else '실패', '%s:scripts/%s' % (label, s), (out[-1] if out else '')[:200] if r.returncode == 0 else ' | '.join(out[:3])[:300])


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('test'); ap.add_argument('--prod'); ap.add_argument('--tree-test'); ap.add_argument('--tree-prod'); ap.add_argument('--strict', action='store_true')
    a = ap.parse_args()
    check_syntax(a.test, 'test')
    check_env_test(a.test)
    if a.prod:
        check_env(a.prod, 'prod', [TEST_ID, 'portal-test'], 'portal-test 문자열')
    tv, pv = check_versions(a.test, a.prod)
    check_time24(a.test, 'test')
    check_regression(a.test, 'test')
    check_handlers(a.test, 'test')
    docs = os.path.join(a.prod, 'docs') if a.prod else os.path.join(a.test, 'docs')
    check_postdeploy(tv, docs, [a.tree_test, a.tree_prod], 'test')
    if a.prod:
        check_fileset(a.test, a.prod)
    run_existing(a.test, 'test')
    order = {'실패': 0, '경고': 1, '정보': 2, '통과': 3}
    cnt = {}
    for g, s, t, m in RESULTS:
        cnt[s] = cnt.get(s, 0) + 1
    print('== QC 결과: 통과 %d · 정보 %d · 경고 %d · 실패 %d ==' % (cnt.get('통과', 0), cnt.get('정보', 0), cnt.get('경고', 0), cnt.get('실패', 0)))
    for g in sorted({r[0] for r in RESULTS}):
        rows = [r for r in RESULTS if r[0] == g]
        c = {s: sum(1 for r in rows if r[1] == s) for s in order}
        print('\n[%s] 통과 %d · 정보 %d · 경고 %d · 실패 %d' % (g, c['통과'], c['정보'], c['경고'], c['실패']))
        for _, s, t, m in sorted(rows, key=lambda r: (order[r[1]], r[2])):
            if s != '통과':
                print('  [%s] %s — %s' % (s, t, m))
    if a.strict and cnt.get('실패'):
        sys.exit(1)


if __name__ == '__main__':
    main()
