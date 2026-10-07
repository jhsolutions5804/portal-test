/* 플랫폼에 꽂는 모듈 목록 — 모듈을 더하거나 빼는 일은 이 파일 한 곳만 고친다.
 * 각 항목은 { manifest, mount }. 핵심부(core/)는 모듈 폴더를 직접 알지 못하고 이 목록만 읽는다. */
import * as edoc from './edoc/index.js?v=20261007c';
import * as attendance from './attendance/index.js?v=20261007c';
import * as calendar from './calendar/index.js?v=20261007c';
import * as company from './company/index.js?v=20261007c';
import * as admin from './admin/index.js?v=20261007c';
import { modules as legacy } from './legacy/index.js?v=20261007c';

export const MODULES = [
  { manifest: edoc.manifest, mount: edoc.mount },
  { manifest: attendance.manifest, mount: attendance.mount },
  { manifest: calendar.manifest, mount: calendar.mount },
  { manifest: company.manifest, mount: company.mount },
  { manifest: admin.manifest, mount: admin.mount }
].concat(legacy);   // 옛 모듈(기획·인사·PJT·내 팀 공수표)은 어댑터로 입주 — 새 모듈로 바뀌면 이 줄에서 빠지고 위 목록으로 옮긴다
