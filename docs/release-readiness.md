# 출시 Readiness — 스토어 출시 전 / 출시 후 작업 분리

> 함께 읽기: `mobile-qa-checklist.md` (실기기 QA), `safety-reporting.md` (신고·차단),
> `realtime-sync-checklist.md` (실시간 동기화).
> 본 문서는 4단계 (스토어 배포 준비) 진입 시 정식 슬라이스 단위로 쪼개기 위한
> 사전 체크리스트. 1단계 결승선 통과 시점에 작성.

## 0. 한 줄 요약

> **스토어 출시 전 필수 = 4단계 진입 전 완료.** 출시 후 가능 = M4 이후 우선순위로 관리.
> 1단계 → 4단계 사이 빈 슬롯에 채워 넣을 작업을 미리 카탈로그화.

## 1. 출시 전 필수 (4단계 진입 전 완료)

스토어 심사·법적 요건·운영 인프라. 빠지면 출시 자체 차단. 카테고리별로 정렬해 중복·누락을 줄임.

### 1.1 IP / 법무

- [ ] **상표 검색** — KIPRIS (한국), USPTO (미국), EUIPO (유럽) 에서 "도트 마피아" / "Dot Mafia" 충돌 확인. design-policy §3 의무.
- [ ] **도메인 가용성** — `dotmafia.com` 등 후보 확보.
- [ ] **정식 이용약관** — 현재 `/legal/terms` placeholder → 정식 문서로 교체. 외부 정적 호스팅 또는 in-app HTML.
- [ ] **정식 개인정보처리방침** — 현재 `/legal/privacy` placeholder → 정식 문서로 교체.
- [ ] **고객센터 운영 이메일** — `/support` placeholder → 실 이메일 + CS 채널 (Slack / Discord / 메일) 등록.
- [ ] **운영 검토 SOP** — 신고 접수 24시간 내 검토 약속. `safety-reporting.md` §6 운영자 행동 매뉴얼과 동기.

### 1.2 인프라

- [ ] **Apple Developer Program** ($99/년) 등록.
- [ ] **Google Play Console** ($25 일회) 등록.
- [ ] **Firebase 프로젝트** — `GoogleService-Info.plist` (iOS) + `google-services.json` (Android) 발급·연결.
- [ ] **Sentry DSN** — `--dart-define=SENTRY_DSN=...` 실값 주입 (또는 CI/CD 시크릿).
- [ ] **빌드 ID 충돌 회피** — 현재 `net.siliconii.mafia.mafiaclient.9795dev` placeholder → 출시용 unique ID 확정.
- [ ] **KGRB 등급 신청** — 한국 게임물관리위원회. 12세 이상 권장.

### 1.3 자산

- [ ] **앱 아이콘 1024×1024 최종본** — 현재 `assets/branding/placeholder_app_icon.png` 교체.
- [ ] **스플래시 로고 최종본** — 현재 placeholder 교체.
- [ ] **스크린샷 5장** — 6.7" iPhone + Android phone, 이미 capture 인프라 존재.
- [ ] **스토어 메타데이터** — 한국어 카피, `docs/store-copy-ko.md` 활용. 영문은 §2 다국어로 이월.
- **에셋 라이선스 / IP 점검 — `client/assets/CREDITS.md` 통과** (design-policy §3·§5 의무).
  CREDITS.md §4.0 의 5분류 정의에 따라 모든 항목이 분류 1·2·3 으로만 해소되어야
  하며, 다음 항목을 출시 전 필수 / 권장으로 분리한다.

  **Critical (출시 전 필수 — 미준수 시 출시 차단):**
  - [ ] **Galmuri11 OFL.txt 동봉** — `client/assets/fonts/OFL.txt` (OFL §4 의무, 출시 전 미준수 시 폰트 라이선스 위반). CREDITS.md §2.3 / §4.1 참조.
  - [ ] `client/assets/CREDITS.md §3 placeholder 0건` (현재 3건 → branding/ 최종 자산 교체)
  - [ ] `CREDITS.md §4 라이선스 미상 0건` (현재 분류 5 = 0건 유지, 분류 4 placeholder = 0건으로 해소)
  - [ ] 상표 검색 (KIPRIS / USPTO / Google) — 게임명·로고·주요 명칭 (4단계 진입 전). design-policy §3 의무.

  **Recommended (권장 — audit trail / 일관성):**
  - [ ] Kenney / Shade Puny CC0 출처 URL + 다운로드일 메타데이터 동봉 (Kenney 팩별 LICENSE 정식화, Shade Puny CC0 표시 1줄)
  - [ ] CREDITS.md §5 검증 절차 8단계 모두 통과 (유사 게임 채용 이력·색상/실루엣·상표·UI/카피 유사도·라이선스 텍스트·Acknowledgements·§4 분류 해소 점검)

### 1.4 테스트

- [ ] **TestFlight 내부 테스터** 5~10명 모집.
- [ ] **Play Internal Testing** 동시 운영.
- debug 빌드 폰 2대 실측 절차: [android-debug-qa.md](./android-debug-qa.md)
- [ ] **`docs/mobile-qa-checklist.md` 모든 항목 통과** — §10 폰 2대 절차 / §11 키보드 / §12 작은 화면 포함 OK.
- [ ] **사용자 채팅 신고 기능 동작** 확인 — Apple App Review 1.2 / Google Restricted content. 상세: `safety-reporting.md` §6.
- [ ] **성능 실측 완료** — [performance-qa.md](./performance-qa.md) §3 (10/30/60분 시나리오) 통과. 성능 실측 미완료 시 출시 불가.

## 2. M4 이후 가능 (출시 후 우선순위)

출시 차단 사유가 아닌 기능 강화·운영 자동화. 우선순위 순.

- [ ] **친구 시스템 서버 API** — `friendRequest` / `friendAccept` / `friendReject` / `friendList` / `friendRemove` WS + Prisma 모델. 현재 클라 mock.
- [ ] **신고 서버 API** — `reportUser` WS + `Report` Prisma 모델 + 운영자 검토 SOP. 페이로드 초안 `safety-reporting.md` §3.
- [ ] **공지 CMS** — 현재 `mock_notices.dart` const → 서버 endpoint 또는 정적 CDN.
- [ ] **푸시 알림 고도화** — APNs / FCM 토큰 등록 + 발송 서비스.
- [ ] **Redis rate limit 분산** — 현재 단일 인스턴스 인메모리. 수평 확장 시 필요.
- [ ] **마이페이지 전적 / 기록 서버 연동** — `GET /users/me/stats`, `GET /users/me/history`.
- [ ] **차단 / 친구 닉네임·아바타 메타 조회 endpoint**.
- [ ] **약관 동의 흐름** — 가입 시 동의 체크.
- [ ] **다국어** — 영문 출시.

## 3. 위험 영역 (출시 직전 점검)

릴리즈 빌드·다중 인스턴스·실사용 부하에서 깨지기 쉬운 가정 모음.

- **자유 서명 디버그 빌드 한계** — 폰 7일 후 만료. 실기기 장기 테스트엔 ad-hoc / TestFlight 필수.
- **클라 mock 데이터** — 친구 / 신고 / 공지 / 가이드 등 hardcoded. **M4 이후 서버 API 로 교체** — 출시 전엔 mock 그대로 OK, 운영팀에 mock 인 항목 명시.
- **채팅 rate limit 인메모리** — 다중 인스턴스 시 우회 가능. M4 Redis 도입 전엔 단일 인스턴스 유지.
- **광장 멀티 위치 동기화 실측 미완** — `docs/mobile-qa-checklist.md` §10 폰 2대 절차 + `realtime-sync-checklist.md` §"체크리스트" 따라 실측 필수.
- **release 빌드 사용자 노출 문자열 검사** — 출시 전 SOP 로 §5 참조.
- **실 디바이스 성능 (메모리/FPS/배터리/발열) 실측 미완** → `performance-qa.md` §6 코드 측 명백한 위험은 사전 점검됨, 실측 결과는 출시 직전 확정.

## 4. 갱신 이력

- 2026-05-13: 1차 작성 (클라 마감 직전). 1단계 MVP 결승선 도달 직전 시점에 4단계 진입 전 필수 / 출시 후 가능 작업을 분리 카탈로그화.
- 2026-05-13: §1 카테고리별 재정렬 (IP·법무 / 인프라 / 자산 / 테스트). QA 절차는 `mobile-qa-checklist.md` 로 분리해 중복 제거.
- 2026-05-13: §1.4 에 android-debug-qa.md 링크 추가 (debug 빌드 폰 2대 실측 절차 분리).
- 2026-05-13: 출시 전 코드 검사 SOP 추가 (§5) + §3 위험 영역에 1줄 링크.
- 2026-05-13: performance-qa.md 연계 — §1.4 성능 실측, §3 실측 미완 위험, §5 profile DevTools.
- 2026-05-13: 출시 전 안정화 슬라이스 — dead code 삭제, lifecycle observer, performance-qa SOP 신설.
- 2026-05-13: §6 4단계 진입 게이트 명확화, BUG-### 트래킹 표 추가 (log-template).
- 2026-05-13: §6.2 Reconnect UX (mobile-qa-checklist §15 R1~R7) 게이트 항목 추가.
- 2026-05-13: §6.2 대기실 UI/광장/캐릭터 모션 (mobile-qa-checklist §15 L1~L12) 게이트 항목 추가, §6.4 현재 상태 갱신 — 이번 슬라이스 (PixelBackgroundVariant / LobbyWorld / showFrame=false / 8방향 walk / 조이스틱·채팅·액션 분리) 반영.
- 2026-05-13: §1.3 자산에 `client/assets/CREDITS.md` 통과 체크박스 3개 추가 (placeholder 0건 / 라이선스 확인 0건 / 검증 절차 7개) — design-policy §3·§5 의무 audit trail.
- 2026-05-14: §1.3 라이선스 섹션 보강 — Galmuri11 OFL.txt 동봉을 Critical 로 승격, 5분류 명시.

## 5. 출시 전 코드 검사 SOP

release 빌드 직전, 사용자 화면에 개발자 문구가 노출되지 않는지 확인하는 단순 grep + 빌드 점검 절차.

- `grep -rn "9795dev" client/lib` — 빌드 ID placeholder 가 코드에 남아 있지 않은지 (식별자 제외 사용자 화면 0건).
- `grep -rn "TODO\|placeholder\|임시" client/lib` — 매치된 위치를 분류 (코드 주석 / debug-only / 식별자 / 사용자 노출). 마지막만 자연화 + 잔여 항목은 §1.1 ~ §1.4 로 이관.
- `flutter build apk --release --dart-define=SENTRY_DSN=... --dart-define=API_BASE_URL=https://...` — release 빌드가 깨지지 않는지 + 빌드 로그가 ASCII 만 출력하는지 (한글 깨짐 = 환경 문제 신호).
- debug indicator (`lobby_debug_indicator.dart`) release 빌드에서 `SizedBox.shrink()` 동작 — `if (!kDebugMode) return SizedBox.shrink();` 가드를 build 첫 줄에서 유지.
- 신규 `debugPrint` 는 가급적 `if (kDebugMode) debugPrint(...)` 패턴 (Flutter framework 가 release 에서 no-op 처리하므로 사용자 노출은 없지만, 의도 명시).
- `flutter run --profile` 로 DevTools Performance/Memory 확인. 10분 시나리오 메모리 안정성 확인.

## §6 4단계 (스토어 출시 준비) 진입 가능 조건

다음 조건 모두 충족 시 4단계 자산 마감 슬라이스 진입 가능. §1 은 4단계 진입 후 마감할 자산·법무·인프라 카탈로그, §6 은 진입 가능 여부를 결정하는 게이트.

### 6.1 코드 게이트

- [ ] `flutter analyze`: No issues found
- [ ] `flutter test`: 모든 테스트 통과 (현재 23/23)
- [ ] `flutter build apk --debug`: 성공
- [ ] `flutter build apk --profile` 또는 `--release`: 성공
- [ ] server `pnpm test`: 150/150 통과

### 6.2 QA 게이트

- [ ] Android 폰 2대 실 기기 QA 핵심 시나리오 Pass (`mobile-qa-checklist.md §10` 1-7 단계, 8 인게임은 권장)
  - 같은 방 입장, 대기실 위치 동기화, 채팅, 차단/해제, 카운트다운
- [ ] iOS 최소 1기기 또는 시뮬레이터 UI 시각 확인 (notch / SafeArea / overflow)
- [ ] 10분 성능 측정 1회 — `performance-qa.md §3.1` (메모리/배터리)
- [ ] **Reconnect UX 확인** — `mobile-qa-checklist.md §15 R1~R7` 7개 시나리오 Pass
- [ ] **대기실 UI/광장/캐릭터 모션** — `mobile-qa-checklist.md §15 L1~L12` 통과
- [ ] critical/blocker BUG 0개 (`mobile-qa-log-template.md §3` 이슈 표 기준)

### 6.3 4단계에서 마감 (진입 후)

- [ ] 정식 이용약관 (`/legal/terms` placeholder 교체)
- [ ] 정식 개인정보처리방침 (`/legal/privacy` placeholder 교체)
- [ ] 고객센터 운영 이메일 (`/support` placeholder 교체)
- [ ] 상표 검색 결과 (KIPRIS/USPTO/EUIPO)
- [ ] 앱 아이콘 1024×1024 최종본
- [ ] 스플래시 로고 최종본
- [ ] Firebase 프로젝트 (`GoogleService-Info.plist` + `google-services.json`)
- [ ] Sentry DSN 실 값
- [ ] 빌드 ID `9795dev` placeholder 교체 (유일 ID)
- [ ] KGRB 등급 신청 (12세 이상)
- [ ] TestFlight + Play Internal Testing 5~10명

### 6.4 현재 상태 (2026-05-13 기준)

- 6.1 코드 게이트: ✅ 모두 통과
- 6.2 QA 게이트: ⚪ Android 실 폰 실측 Blocked / iOS sim 부분 확인 / 10분 성능 미실측 / Reconnect UX R1~R7 + 대기실 UI/광장/캐릭터 모션 L1~L12 항목 추가, 회차 2 대기 / BUG 0건 (실측 부족 사유)
- 6.3 진입 후 마감: ⚪ 4단계 슬라이스에서 처리

→ **현재 4단계 진입 가능 여부**: 6.2 QA 게이트 부분 충족. 코드 측 명백한 위험 없음. 실 폰 QA 1회 실행 후 진입 권장.

### 6.5 다음 슬라이스 옵션 (택1)

- **옵션 A — 실 폰 QA 회차 2 먼저**: 장점 = 게이트 6.2 정식 통과, 실 동기화·발열·메모리 회귀 조기 포착. 단점 = 폰 확보 일정 의존, 슬라이스 1회 지연.
- **옵션 B — 4단계 자산 마감 선진입**: 장점 = 자산·법무·상표 검색 등 외부 의존 작업을 병렬 착수해 총 일정 단축. 단점 = QA 회귀 발견 시 4단계 슬라이스와 충돌 가능, 6.2 게이트는 출시 직전 별도 통과 필요.

## §7 1단계 MVP 종료 (✅ Pass — 2026-05-14)

1단계 MVP 는 다음 게이트를 모두 통과해야 "종료" 로 선언한다.
**자동화 게이트 풀그린 + 디렉터 GUI 풀사이클 1회 Pass 확인 (2026-05-14) → 1단계 MVP 종료 선언.**

### 7.1 자동화 게이트 (코드 안전망)

- [x] 서버 단위 테스트 — `cd server && pnpm test` → **150/150 passed**
- [x] 서버 E2E — `cd server && pnpm test:e2e` → **20/20 passed** (Docker daemon 가동 필요)
- [x] 클라 정적 분석 — `cd client && flutter analyze` → **No issues found**
- [x] 클라 단위 — `cd client && flutter test` → **32/32 passed**
- [x] 클라 빌드 — `cd client && flutter build apk --debug` → **OK**
- [x] server / prisma / socket contract 변경 0건 (1단계 결승선 진입 후 cleanup 슬라이스 포함)
- [x] WS 이벤트 1:1 정합성 (서버 emit ↔ 클라 수신, 13개)
- [x] `client/assets/CREDITS.md` 신설 + `release-readiness.md §1.3` 라이선스 섹션 연결

### 7.2 수동 게이트 (사용자 본인 실측)

- [x] **GUI 풀사이클 1회** — `docs/manual-full-cycle-qa.md` 상단 핵심 9 Step 모두 Pass (디렉터 확인, 2026-05-14)
  - Step 1 서버 실행 → [x]
  - Step 2 클라 4명 (또는 가능한 최대) 실행 → [x]
  - Step 3 닉네임 입력 → [x]
  - Step 4 방 생성 → [x]
  - Step 5 방 입장 → [x]
  - Step 6 게임 시작 + 직업/집 배정 → [x]
  - Step 7 낮/투표 (DAY → VOTE_SELECT → VOTE_CONFIRM → EXECUTION) → [x]
  - Step 8 밤 3페이즈 (DOCTOR → MAFIA → POLICE → RESULT) → [x]
  - Step 9 결과/다음 사이클 또는 게임 종료 → [x]
- [x] Critical/Blocker BUG 0건
- [x] 결과를 `docs/manual-full-cycle-qa.md` 의 결과 요약 섹션에 기록 (디렉터 단언 Pass — 상세 step 표는 추후 회차 누적 시 채움)

### 7.3 잔여 TODO 분리 게이트

- [x] 남은 TODO 가 2단계 또는 출시 준비 항목으로 분리되어 있음
  - 2단계 첫 슬라이스 → `docs/slices/S-client-flame-phase-overlay.md`
  - 출시 준비 → `release-readiness.md §1.3` 에셋 라이선스 + Galmuri11 OFL.txt 동봉

### 7.4 상태 표기

- **현재 상태:** ✅ **1단계 MVP 종료 (디렉터 GUI 풀사이클 Pass 확인 — 2026-05-14)**
- **종료 근거:** 자동화 게이트 8/8 [x] + 수동 게이트 9 Step 전부 [x] + Critical/Blocker 0건.
- **Fail 시 흐름 (참고용 유지):** 향후 회귀 감지 시 BUG 픽스 슬라이스 (`S-server-*-fix` 또는 `S-client-*-fix`) 진입 → 핵심 9 Step 재실측 → 게이트 재평가.

### 7.5 2단계 진입 조건

- **사전 조건:** 1단계 MVP 종료 선언 후.
- **첫 슬라이스:** `S-client-flame-phase-overlay` — `docs/slices/S-client-flame-phase-overlay.md` 참조.
- **GUI 풀사이클 Pass 전에 2단계 진입 금지** — 1단계 회귀 안전망이 무너질 위험.

### 7.6 갱신 이력
- 2026-05-14: 종료 게이트 신설. 현재 자동화 게이트 풀그린, 수동 게이트 대기.
- 2026-05-14: 디렉터 GUI 풀사이클 1회 Pass 확인 → **1단계 MVP 종료 선언**. 9 Step 모두 Pass, Critical/Blocker 0건. 다음 슬라이스 `S-client-flame-phase-overlay` 진입 가능.

## §8 2단계 진행 상태 (Flame 도트 게임 뷰 통합)

1단계 MVP 종료 (2026-05-14, §7) 직후 2단계 진입. 슬라이스 단위로 진행.

### 8.1 슬라이스 진행 표

| 슬라이스 | 상태 | 핵심 변경 | 종료 일자 |
|---|---|---|---|
| `S-client-flame-phase-overlay` | 🟡 구현 완료, 실기기 QA 대기 | VillageOverlay 위 phase 별 Material overlay 4종 + AnimatedSwitcher dispatcher | 2026-05-14 (구현) / 실기기 QA 대기 |
| `S-client-village-movement` (다음) | ⚪ 미진입 | 광장 캐릭터 sprite 이동 + 조이스틱 throttle + playerMove 송수신 | — |

### 8.2 자동화 게이트 (현 슬라이스)
- [x] `flutter analyze` clean — No issues found (2026-05-14 통합 검증)
- [x] `flutter test` 39 passed (32 → 39, +7 phase_overlays_test, 2026-05-14 통합 검증)
- [x] `flutter build apk --debug` OK (2026-05-14 통합 검증)
- [x] server / prisma / socket contract 변경 0건 (mtime cross-check — server/src 최신 5/13 18:37, prisma 5/12, socket_client.dart 5/13 20:35 모두 슬라이스 시작 전)
- [x] 새 의존성 0건 (pubspec.yaml mtime 변경 0)
- [x] 사용자 화면 개발자 용어 노출 grep 0건 (`Text(.*socket\|debug\|server\|host`) — flame/widgets/ 0건

### 8.3 수동 게이트 (실기기 QA)
- [ ] `mobile-qa-checklist.md §L` 항목 모두 Pass 또는 명확한 사유 (확인 예정)
- [ ] iOS 실기기 1회 / Android 폰 1회 / Galaxy Tab 1회 풀사이클 진행 (Phase overlay 4종 + AnimatedSwitcher 동작 확인)

### 8.4 1단계 MVP 종료 상태 유지 확인
- [x] §7 1단계 MVP 종료 (2026-05-14) 표기 유지
- [x] §7.1 자동화 게이트 8개 그대로 그린 — 서버 150/150 · 클라 analyze clean · 클라 test 39/39 (+7) · APK OK · contract 변경 0 (2026-05-14 통합 검증)

### 8.5 다음 슬라이스 진입 조건
- 현 슬라이스 자동화 8.2 모두 [x] + 수동 8.3 적어도 1개 실기기 Pass → `S-client-village-movement` 진입.

### 8.6 갱신 이력
- 2026-05-14: §8 신설. `S-client-flame-phase-overlay` 코드 구현 완료, 자동화/실기기 QA 대기.
- 2026-05-14: 통합 검증 완료 — 자동화 게이트 6/6 그린 (analyze clean / 클라 test 39 / APK OK / contract 0 / 의존성 0 / 사용자 카피 grep 0). 실기기 QA (§8.3, mobile-qa §L 11항목) 만 대기.
- 2026-05-14: S-meta-flame-overlay-device-qa 통합 검증 통과 — VoteConfirm 카피 톤 다운 ("처형" → "탈락시킬지"), S-client-village-movement 슬라이스 컨텍스트 작성 (Agent D). 자동화 6/6 재확인 (analyze clean · 클라 test 39 · 서버 test 150 · APK OK · contract 0 · widgets/ action·socket·개발자용어 grep 0). 실기기 §L 11항목 사용자 실측 대기 유지.
- 2026-05-14: S-client-village-movement-gap-prep 통과 — PlayerAvatar isLocal 본인 시각 구분 + village_chat_overlay compact/expanded + village_pane letterbox navy + 주석 보강. 실기기 §L/§M 확인 대기. test 39/39, contract 0 변경.
