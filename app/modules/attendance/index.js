import { loadWorkers } from '../../shared/workers-data.js?v=20261008f';
import { loadHolidays } from '../../shared/holidays.js?v=20261008f';
import { findWorker, dateKey, monthlyStandardHours } from '../../shared/worktime.js?v=20261008f';
import { loadRecord, loadMonth, writeClockIn, writeClockOut, writeManual } from './data.js?v=20261008f';
import { clockState, buildClockIn, buildClockOut, validateManual, editPermission, yesterdayKey, recentMonths, monthTotals, dayLabel } from './logic.js?v=20261008f';
import { clockWidgetHtml, inputPageHtml, msgHtml } from './view.js?v=20261008f';
import { toast, esc } from '../../core/ui.js?v=20261008f';

const WD = ['일', '월', '화', '수', '목', '금', '토'];
export const dateText = (d) => (d.getMonth() + 1) + '월 ' + d.getDate() + '일 ' + WD[d.getDay()] + '요일';
const hhmm = (d) => String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');

export const manifest = {
  id: 'attendance', order: 60, nav: false, title: '출퇴근', icon: '⏰', defaultHash: '#/attendance/input',
  perm: (me) => !me.isGuest,
  widgets: [{ id: 'clock', order: 10, mobileOrder: 1, reserve: 'tall', mount: mountClockWidget }]
};

/* ───────── 플랫폼 홈 위젯: 원터치 출근·퇴근 ───────── */
async function mountClockWidget(slot, ctx) {
  const { me } = ctx; const M = { state: 'loading', busy: false };
  const draw = () => { slot.innerHTML = clockWidgetHtml(M); };
  const load = async () => {
    M.state = 'loading'; draw(); const now = new Date();
    try {
      const worker = findWorker(await loadWorkers(false), me);
      if (!worker || !worker.linked) { M.state = 'unlinked'; draw(); return; }
      const today = dateKey(now); const ym = today.slice(0, 7);
      const [t, y, rows, hol] = await Promise.all([loadRecord(worker.id, today), loadRecord(worker.id, yesterdayKey(now)), loadMonth(worker.id, ym), loadHolidays()]);
      Object.assign(M, { state: 'ok', worker, today, ym, todayRec: t, yesterdayRec: y, monthHours: monthTotals(rows).hours, standard: monthlyStandardHours(now.getFullYear(), now.getMonth() + 1, hol) });
      refresh();
    } catch (e) { console.error('출퇴근 위젯', e); M.state = 'error'; draw(); }
  };
  const refresh = () => {
    const now = new Date(); M.clock = clockState(M.todayRec, M.yesterdayRec, now.getTime()); M.nowText = hhmm(now); M.dateText = dateText(now); draw();
  };
  slot.addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-clock],[data-clock-retry]'); if (!b || b.disabled) return;
    if (b.hasAttribute('data-clock-retry')) { load(); return; }
    if (M.busy || M.state !== 'ok') return;
    const kind = b.getAttribute('data-clock'); const now = new Date(); M.busy = true; refresh();
    try {
      if (kind === 'in') {
        const data = buildClockIn(M.worker, now); const r = await writeClockIn(data);
        toast(r.already ? '이미 출근 기록이 있습니다.' : '출근 ' + data.checkIn + ' 기록했습니다.');
      } else {
        const c = clockState(M.todayRec, M.yesterdayRec, now.getTime()); if (c.state !== 'working') { toast('퇴근할 출근 기록이 없습니다.'); }
        else { const patch = buildClockOut(c.target, now, c.overnight); const r = await writeClockOut(M.worker.id, c.target.date, patch); toast(r.already ? '이미 퇴근 기록이 있습니다.' : '퇴근 ' + patch.checkOut + ' 기록했습니다. (' + patch.workHours.toFixed(1) + 'h)'); }
      }
      await load();
    } catch (e) { console.error('출퇴근 기록', e); toast('기록하지 못했습니다. 잠시 후 다시 시도해 주세요.'); }
    finally { M.busy = false; if (M.state === 'ok') refresh(); }   // 처리가 끝난 뒤 버튼 상태를 다시 그린다(처리 중에는 비활성)
  });
  load();
  const timer = setInterval(() => { if (!slot.isConnected) { clearInterval(timer); return; } if (M.state === 'ok' && !M.busy) { const el = slot.querySelector('[data-clock-time]'); if (el) el.textContent = hhmm(new Date()); } }, 15000);
}

/* ───────── 출퇴근 기록 화면: 직접 입력·수정, 월 기록 ───────── */
export async function mount(root, route, ctx) {
  const { me } = ctx; root.onclick = null; root.onchange = null; root.oninput = null;
  root.innerHTML = '<div class="jh-empty">불러오는 중…</div>';
  const now = new Date(); const today = dateKey(now);
  let workers = []; try { workers = await loadWorkers(false); } catch (e) { workers = []; }
  const mine = findWorker(workers, me);
  const list = me.admin ? workers.filter((w) => w.name).slice().sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko')) : (mine && mine.linked ? [mine] : []);
  if (!list.length) { root.innerHTML = '<div class="jh-card"><div class="jh-form"><div class="jh-alert" data-tone="info">계정이 근무자 명부와 연동되어 있지 않아 기록을 볼 수 없습니다. 인사 담당자에게 연동을 요청해 주세요.</div></div></div>'; return; }
  const holidays = await loadHolidays();
  const S = { me, today, workers: list, worker: (mine && list.find((w) => w.id === mine.id)) || list[0], ym: today.slice(0, 7), months: recentMonths(now, 12), rows: [], standard: 0, form: { date: today, checkIn: '', checkOut: '', hours: 0 }, perm: { ok: true } };
  const recompute = () => {
    const v = validateManual(S.form, me, today); S.form.hours = v.hours; S.perm = editPermission(me, S.form.date, today); return v;
  };
  const load = async () => {
    const [y, m] = S.ym.split('-').map(Number); S.standard = monthlyStandardHours(y, m, holidays);
    try { S.rows = await loadMonth(S.worker.id, S.ym); } catch (e) { console.error('월 기록', e); S.rows = []; toast('기록을 불러오지 못했습니다.'); }
    // 오늘 기록이 있으면 폼에 채워 두어 바로 수정할 수 있게
    const cur = S.rows.find((r) => r.date === S.form.date);
    if (cur) { S.form.checkIn = cur.checkIn; S.form.checkOut = cur.checkOut; } recompute(); paint();
  };
  const paint = () => { root.innerHTML = inputPageHtml(S); };
  const refreshForm = () => {   // 입력 중에는 폼을 다시 그리지 않고 결과 칸만 갱신한다
    const v = recompute(); const set = (sel, html) => { const el = root.querySelector(sel); if (el && el.__rendered !== html) { el.innerHTML = html; el.__rendered = html; } };   // 마지막으로 그린 내용과 같으면 다시 그리지 않는다 — 24시간 입력칸은 포커스를 잃을 때(버튼을 누르는 순간) change 가 떠서, 같은 내용을 다시 그리면 그 순간 누른 버튼(결재 요청 작성)의 클릭이 사라졌다. (innerHTML 비교는 직렬화 차이로 항상 달라 쓸 수 없음)
    const hrs = root.querySelector('[data-att-hours]'); if (hrs) hrs.textContent = (S.form.hours || 0).toFixed(1) + 'h';
    set('[data-att-msg]', !S.perm.ok ? msgHtml(S.perm, S.form) : (v.errors.checkOut ? '<div class="jh-alert" data-tone="warn" role="status">' + esc(v.errors.checkOut) + '</div>' : ''));
    const sb = root.querySelector('[data-att-save]'); if (sb) sb.disabled = !S.perm.ok;
  };
  root.oninput = root.onchange = async (ev) => {
    const t = ev.target;
    if (t.hasAttribute && t.hasAttribute('data-att')) {
      const k = t.getAttribute('data-att'); S.form[k] = t.value;
      if (k === 'date') { const cur = S.rows.find((r) => r.date === S.form.date); S.form.checkIn = cur ? cur.checkIn : ''; S.form.checkOut = cur ? cur.checkOut : ''; if (S.form.date && S.form.date.slice(0, 7) !== S.ym && S.form.date <= today) { S.ym = S.form.date.slice(0, 7); await load(); return; } recompute(); paint(); return; }
      refreshForm(); return;
    }
    if (t.hasAttribute && t.hasAttribute('data-month')) { S.ym = t.value; S.form = { date: S.ym === today.slice(0, 7) ? today : S.ym + '-01', checkIn: '', checkOut: '', hours: 0 }; await load(); return; }
    if (t.hasAttribute && t.hasAttribute('data-worker')) { S.worker = list.find((w) => w.id === t.value) || S.worker; S.form = { date: today, checkIn: '', checkOut: '', hours: 0 }; S.ym = today.slice(0, 7); await load(); }
  };
  root.onclick = async (ev) => {
    const e = ev.target.closest('[data-edit],[data-att-save],[data-att-request]'); if (!e) return;
    if (e.hasAttribute('data-att-request')) {   // 지난 날짜는 근태 기록 수정 요청(결재)으로 — 입력한 값을 채워서 넘긴다
      const q = new URLSearchParams({ date: S.form.date, in: S.form.checkIn || '', out: S.form.checkOut || '' }); location.hash = '#/edoc/new/attend?' + q.toString(); return;
    }
    if (e.hasAttribute('data-edit')) { const r = S.rows.find((x) => x.date === e.getAttribute('data-edit')); if (r) { S.form = { date: r.date, checkIn: r.checkIn, checkOut: r.checkOut, hours: r.workHours }; recompute(); paint(); window.scrollTo(0, 0); } return; }
    const v = recompute(); const first = Object.values(v.errors)[0];
    if (first) { toast(first); return; }
    e.disabled = true;
    try {
      await writeManual(S.worker, { date: S.form.date, checkIn: v.checkIn, checkOut: v.checkOut, hours: v.hours }, me, v.source);
      toast(dayLabel(S.form.date) + ' 기록을 저장했습니다. (' + v.hours.toFixed(1) + 'h)'); S.form.checkIn = v.checkIn; S.form.checkOut = v.checkOut; await load();
    } catch (err) { console.error('직접 입력 저장', err); toast('저장하지 못했습니다. 권한을 확인해 주세요.'); e.disabled = false; }
  };
  await load();
}
