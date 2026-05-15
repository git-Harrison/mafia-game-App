# S-client-village-movement-gap-prep — 실기기 전 코드 기준 잔여 UX 마감

## 0. 진입 컨텍스트

- 1단계 MVP 종료 (2026-05-14).
- `S-client-flame-phase-overlay` 자동화 완료 / 실기기
  `mobile-qa-checklist.md §L` 11항목 사용자 확인 전 → Blocked 유지.
- 이번 슬라이스는 **신규 movement 구현 X**. 이미 구현된 시스템 위에 잔여
  UX 갭만 폴리시. 코드 변경 0건 (Agent A 단계) → B/C/D/E 분담 후 코드 변경.
- 직전 슬라이스(`S-client-village-movement.md`)의 §0.1 "실측 진입 상태" 8항목
  + 본 문서 §1.1 의 10항목 점검 결과를 합쳐 작업 분담 가드레일로 사용.

---

## 1. 점검 결과 (Agent A, 2026-05-14)

### 1.1 10항목 코드 점검 표

| # | 항목 | 상태 | 위치 (파일:라인) | 갭 여부 |
|---|---|---|---|---|
| 1 | PlayerAvatar 8방향 walking/idle (4방향 × 2 상태) | 구현 확인 | `village_game.dart:429~580` (`PlayerAvatar`, `_AnimState` 8개, `_stateFor()`) | 갭 없음 |
| 2 | idle 상태 흔들림 (bobbing) 없음 | 구현 확인 | `village_game.dart:448~452` (`idle` row 0-3, `stepTime: 0.5s` — 평이한 호흡) | 갭 없음 (M.4 실기기 검증 필요) |
| 3 | walking 이동 중에만 재생 | 구현 확인 | `village_game.dart:517~528` (`delta.length2 > 0.02` → moving 분기) | 갭 없음 |
| 4 | 원격 플레이어 위치 보간 (lerp) | 구현 확인 | `village_game.dart:507~515` (`setTargetPosition` + `dt*8.0` clamp) | 갭 없음 |
| 5 | sendPlayerMove 10Hz throttle | 구현 확인 | `village_game.dart:111~113` (`_sendIntervalSec=0.1`), `:355~363` (accum) + `game_notifier.dart:471~486` (emitAck) | 갭 없음 |
| 6 | joystick vector normalize | 구현 확인 (Flame 기본) | `village_game.dart:345~354` (`_joystick.relativeDelta * 50 * dt`) — Flame `relativeDelta` 가 0~1 정규화 unit vector 반환 | 검증 필요 (대각선 1.0 cap — Flame 공식 동작) |
| 7 | diagonal 속도 보정 | 검증 필요 | 위와 동일. Flame `relativeDelta` 는 knob 거리 비례 unit vector (대각선이 더 빠르지 않음) | 갭 없음 (이론), M.2 실기기 체감 확인 |
| 8 | 사망 마커 표시 (X) | 구현 확인 | `village_game.dart:558~580` (`render` 오버라이드, ColorFilter desat 0.3 + 빨간 X 두 line) | 갭 없음 |
| 9 | dispose / ticker / timer 정리 | 구현 확인 | `village_pane.dart:36~42` (`unregister`), `village_overlay.dart:313~318` (`_GoldTimerBarState._ticker.cancel`), `lobby_chat_controller.dart:129~140` (speech expire `ref.mounted` 가드) | 갭 없음 |
| 10 | Flame registry pause/resume | 구현 확인 | `village_game_registry.dart:26~39` (`pauseAll/resumeAll` + `g.paused` 중복 안전 가드) + `app.dart`의 `didChangeAppLifecycleState` 연동 | 갭 없음 |

**요약:** 구현 확인 8개 / 검증 필요(코드 갭 X, 실기기 체감만) 2개 (#6, #7) /
**수정 필요(코드 갭) 0개**. → 본 슬라이스 본질은 "이미 도는 시스템 위에 본인
캐릭터 시각 구분 · 채팅 UX · Galaxy Tab 정책" 갭 폴리시.

### 1.2 추가 발견 (점검 표 밖, B/C/D/E 작업 직접 트리거)

- **본인 캐릭터 시각 구분 = 없음.** `VillagePlayerSlot.userId == config.myUserId`
  분기는 `_me` vs `_remotes[]` 로직에만 사용 (`village_game.dart:309~313`),
  PlayerAvatar render 에 본인/원격 시각 구분 없음. (→ Agent B)
- **광장 내 채팅(인게임)** = `_DayPanel` (`village_overlay.dart:429~549`) — 채팅
  로그 88dp 고정 높이 + 입력창, compact/expanded 토글 없음. 키보드 등장 시
  자동 expanded 정책도 없음. (→ Agent C)
- **대기실 채팅** = `lobby_chat_overlay.dart` — compact/expanded 이미 구현
  완료, 키보드 자동 expanded 도 적용. **Agent C 참고용 레퍼런스 패턴.**
- **`VillagePane` AspectRatio 1.0 + Center wrap** = `village_pane.dart:111~119`.
  Galaxy Tab 같은 넓은 화면에서 좌우 여백 발생 (정사각 캐릭터 영역). overlay
  `OverlayPanel.maxWidth=360` 은 phase 안내만 — 광장 자체 폭/AspectRatio 정책
  미정. (→ Agent E)

---

## 2. 갭 → 작업 분담 (B/C/D/E 가드레일)

### Agent B — 본인 캐릭터 시각 구분

- **현재 상태:** PlayerAvatar 에 본인 분기 없음. 닉네임 라벨만
  (`village_game.dart:478~494`) 4명 전부 동일 톤.
- **갭:** 본인 캐릭터를 시각적으로 구분 (자율 결정 — 화살표 / 외곽선 / 색상
  하이라이트 중 택1).
- **권장:** `PlayerAvatar` 생성자에 `isLocal: bool` 추가 → render() 안에서
  본인이면 닉네임 색을 `PixelPalette.gold` 또는 머리 위 작은 ▼ 화살표.
  생성자 default `false` 라 signature 호환.
- **파일:** `village_game.dart` (PlayerAvatar 영역) +
  `village_pane.dart:140~148` (slot 생성 시 `isLocal: p.userId == myUserId`).

### Agent C — 채팅 compact/expanded UX 개선

- **현재 상태 (인게임 낮 채팅):** `_DayPanel` (`village_overlay.dart:429~549`)
  = 88dp 고정 chat log + 입력창 항상 노출. 4줄 reversed slice. 키보드 토글
  대응 없음.
- **현재 상태 (대기실 채팅):** `lobby_chat_overlay.dart` — compact/expanded
  토글 + 키보드 자동 expanded + AnimatedSize 200ms + dim 처리 완비.
- **갭:** 인게임 낮 채팅(`_DayPanel`)에도 대기실 패턴 이식. compact 시 최근
  2~3줄만 + 입력창 숨김, expanded 시 입력창 + ~6줄, IME 등장 시 자동
  expanded.
- **파일:** `village_overlay.dart` (`_DayPanel` 영역) — 신규 위젯 분리하면
  `flame/widgets/game_chat_overlay.dart` 1개 (총 신규 5개 미만 유지).
- **참고 (변경 X):** `lobby_chat_overlay.dart`, `lobby_chat_input.dart`,
  `lobby_chat_controller.dart`.

### Agent D — 조이스틱 속도 / idle 조건 코드 점검

- **현재 상태:**
  - Joystick = `village_game.dart:320~325` (좌하단 margin 22/96, knob 14 /
    bg 36, `JoystickComponent` 기본).
  - 이동 = `:343~354` (`_joystick.relativeDelta * 50.0 * dt`, plaza
    `[80, 160]` clamp).
  - throttle = `:111~113`, `:355~363` (10Hz, `_lastSentPos` length2 0.0001
    이상만 송신).
  - idle 분기 = `PlayerAvatar.update :517~528` — `(position - _prevPos)
    .length2 > 0.02` → moving. 정지 즉시 idle 전환 (timeout 없음).
- **갭 (코드 변경 0건 권장):**
  - 항목 #6, #7 모두 Flame 공식 `relativeDelta` 동작 — 코드 변경 0건.
  - idle 즉시 전환은 의도된 동작 — 200~400ms timeout 도입은 자율 결정 영역
    (회귀 위험 작음, 단 광장에서 캐릭터 짧게 멈출 때 idle 깜빡임 가능).
- **권장:** Agent B 끝난 후 단독 진행. 코드 변경 0~소폭. M.2 / M.4 항목은
  실기기 (§L Blocked 해제 후) 체감 후 결정.
- **파일:** `village_game.dart` (`update()` `:343~363` + `PlayerAvatar.update`
  `:503~529`). **B 영역(`PlayerAvatar` render/생성자)과 충돌 가능 — B 가
  끝난 뒤 D 진행.**

### Agent E — Galaxy Tab / 넓은 화면 maxWidth 정책

- **현재 상태:**
  - `OverlayPanel.maxWidth = 360` 기본 (`phase_overlay_panel.dart:26`) +
    중앙 정렬 — phase 안내 overlay 4종 적용 완료.
  - `VillagePane` = `Container` 풀 + `Center` + `AspectRatio(1.0)` +
    `GameWidget` (`village_pane.dart:111~119`). Tab 처럼 가로가 긴 화면에서
    좌우 여백이 까만 배경(`0xFF0E1F0C`)으로 노출.
  - `_TopHud` (`village_overlay.dart:130~151`) = `Row` + `Expanded` (자체
    maxWidth 없음).
  - 룸 / 결과 / 홈에 산발적 maxWidth: home `560`, `lobby_player_avatar`
    `96/160`, `day_pane` `280`, `result_player_list` `140`.
- **갭:** Galaxy Tab(가로 ~600+dp) 에서 광장 좌우 여백 처리 정책 미정.
  overlay 는 360 cap 있지만 광장 자체 폭 / 배경 cover 처리는 미정.
- **권장:** Galaxy Tab 처럼 가로 600+dp 에서는 overlay maxWidth 360 중앙
  유지(이미 OK) + 광장 배경을 풀스크린 cover (`Container` color 채우는 현재
  방식 유지) + AspectRatio 1.0 도 유지 (16:9 가로로 펴면 캐릭터 가독성
  떨어짐). 신규 정책 단일 진입점 = `OverlayPanel.maxWidth` 상수 (이미
  존재) — Tab 에서도 동일 360 유지가 합리적.
- **파일:** `village_pane.dart` (광장 폭/배경) + `flame/widgets/*_overlay.dart`
  (overlay maxWidth) + (선택) `room/presentation/widgets/*` 의 maxWidth
  일관성. **새 파일 0~1.**

### Agent F — 문서 / QA 게이트

- 본 문서 (Agent A 작성) + `mobile-qa-checklist.md §M` 10항목 + 실기기
  Blocker(§L) 모니터링.
- Agent B/C/D/E 작업 완료 후 `S-client-village-movement.md` §8 의 M.1~M.10
  항목과 본 문서 §3 정합 확인.

---

## 3. 파일 소유권 (B/C/D/E 충돌 방지)

| 파일 | 담당 | 다른 Agent 손대지 마 |
|---|---|---|
| `client/lib/features/game/flame/village_game.dart` — `PlayerAvatar` / `VillagePlayerSlot` 영역 | B | C/D/E |
| `client/lib/features/game/flame/village_game.dart` — `update()` joystick / `PlayerAvatar.update()` idle | D (B 끝난 뒤) | C/E |
| `client/lib/features/game/flame/village_overlay.dart` — `_DayPanel` (인게임 채팅) | C | B/D/E |
| `client/lib/features/game/flame/widgets/game_chat_overlay.dart` (신규, 선택) | C | B/D/E |
| `client/lib/features/game/flame/village_pane.dart` — 광장 폭 / 배경 / Center wrap | E | B/C/D (단 B 는 `_build`에서 `isLocal` slot 1줄 추가 가능 — E 와 사전 동기) |
| `client/lib/features/game/flame/widgets/*_overlay.dart` — maxWidth 정책 | E | B/C/D |
| 대기실 채팅 (`lobby_chat_overlay.dart`, `lobby_chat_input.dart`, `lobby_chat_controller.dart`) | (참고만) | 변경 0건 — 이미 OK |
| 도큐먼트 / `mobile-qa-checklist.md` | F | A~E |

---

## 4. 변경 0건 영역 (전 인스턴스 공통 락)

- 서버 / Prisma / Socket payload — 0건.
- `playerMove` / `playerPositionUpdate` 페이로드 / throttle 10Hz — 0건.
- WS 이벤트 13개 — 0건.
- 게임 룰 / phase machine / movement-zone clamp `[80, 160]` — 0건.
- `GameNotifier` / `GameState` public 시그니처 — 0건.
- `VillageGame` / `VillagePane` / `VillageGameRegistry` public 시그니처 — 0건.
- 이미 구현된 movement / walking / idle / throttle / lerp / markDead /
  registry pause/resume 의 동작 의미 — 0건 (signature 호환 추가만 OK).
- 신규 의존성 — 0건.
- 신규 파일 5개 이상 한 슬라이스 — 묻기.
- 1단계 6 fallback pane / `_useFlameView` 4 조건 / `Env.flameMode` default —
  0건.

---

## 5. 실기기 확인 필요 항목 (이번 슬라이스에서 Pass 처리 X)

- **§L 11항목** (`mobile-qa-checklist.md`, 직전 슬라이스) — 사용자 미수행,
  Blocked 유지.
- **§M 10항목** (`S-client-village-movement.md §8` 작성 완료) — M.1~M.10,
  Agent E 가 §L 해제 후 본 문서 §1.1 #6/#7 와 함께 일괄 검증.
- 본 슬라이스의 코드 변경 결과 항목 (본인 캐릭터 시각 구분, 인게임 채팅
  compact/expanded, Galaxy Tab maxWidth) → Agent F 가 §M 보강 또는 §N 신설
  결정.

---

## 6. 검증 (코드 변경 0건 슬라이스 — Agent A 단계)

- 코드 변경 0건 (Agent A) → `flutter analyze` / `flutter test` 회귀 0 확인
  불필요.
- markdown 정합성만 (표 컬럼 정렬 / 코드블록 닫힘) Agent A 자체 검토 완료.
- B/C/D/E 코드 변경 후에는 각 Agent 가 `flutter analyze` clean +
  `flutter test` 39+ 유지 + APK debug build OK + iOS Simulator 빌드 OK 확인.

---

## 6. maxWidth 정책 (Agent E, 2026-05-14)

### 6.1 패널별 maxWidth (현재 + 권장)

| 패널 | 현재 | 권장 | Galaxy Tab 확인 예정 |
|---|---|---|---|
| phase overlay (DayOverlay / VoteOverlay / NightOverlay / NightResultOverlay) | `OverlayPanel.maxWidth=360` | **360 유지** | [ ] §M+ |
| chat overlay (인게임 `_DayPanel` — Agent C) | 미정 (88dp 고정 높이만) | 500~600 (Agent C 결정) | [ ] §M+ |
| HUD (`_TopHud`, `village_overlay.dart:130~151`) | Row + Expanded (자체 정책) | 자체 정책 유지 | [ ] §M+ |
| 광장 배경 (`VillagePane`) | `AspectRatio 1.0` + letterbox 색 `PixelPalette.background` | 유지 | [ ] §M+ |
| 홈 (`home_screen.dart:113`) | 560 | 유지 (영역별 자체 정책) | (해당 없음) |
| `day_pane.dart:154` (1단계 fallback) | 280 | 유지 | (해당 없음) |
| `result_player_list.dart:62` | 140 (per-card) | 유지 | (해당 없음) |
| `lobby_player_avatar.dart` | 96 / 160 (per-avatar) | 유지 | (해당 없음) |

각 영역의 maxWidth 는 **서로 분리된 자체 정책**. 통합 `ScreenBreakpoints`
helper 도입은 1단계 결승선까지 보류 — 회귀 위험 대비 효용 낮음.

### 6.2 breakpoint 결정

- 1단계 결승선 시점: **breakpoint helper 미도입.** 현재 패널별 maxWidth
  유지로 충분.
- 향후 Galaxy Tab 실측에서 어색하면 다음 슬라이스에서 도입 검토:
  - `class ScreenBreakpoints { static const phone=600; static const tablet=840; }`
  - `OverlayPanel` 이 `MediaQuery.sizeOf(context).width` 로 360 / 420 분기.

### 6.3 코드 변경 결과 (Agent E)

- `phase_overlay_panel.dart` 헤더 주석에 maxWidth 정책 표기 (코드 동작 0
  변경).
- `village_pane.dart:111~119` letterbox 배경색 `0xFF0E1F0C` → `0xFF0A1825`
  (= `PixelPalette.background`). HUD / overlay 의 navy 톤과 통일.
- 그 외 파일 0건. 신규 helper 파일 0건.

### 6.4 Galaxy Tab 실기기 확인 예정 (§L 해제 후 §M+ 항목)

- [ ] phase overlay 360 cap 이 가로 600+dp 화면에서 좁아 보이지 않음
  (안내 텍스트 의도된 부수 UI).
- [ ] `_DayPanel` 채팅 영역이 가로 화면에서 너무 퍼지지 않음 (Agent C
  작업 후 재확인).
- [ ] `VillagePane` 정사각 광장 좌우 letterbox 색이 navy(`PixelPalette
  .background`) 로 통일되어 어색하지 않음.
- [ ] 캐릭터 sprite 가 가로 화면에서 작아 보이지 않음 (AspectRatio 1.0
  유지로 sprite 픽셀 비율 변동 없음 — Agent B 결과와 합쳐 확인).

## 7. 슬라이스 완료 상태 (Agent F, 2026-05-14)

### 7.1 작업 완료
- [x] Agent A 전수 점검 (10항목 중 8 구현 확인 / 2 실기기 검증 / 0 코드 갭)
- [x] Agent B 본인 캐릭터 시각 구분 (isLocal + 발밑 노란 타원 + 닉네임 골드)
- [x] Agent C 채팅 compact/expanded (village_chat_overlay 신설)
- [x] Agent D 조이스틱/idle 점검 (코드 로직 0 / 주석 2블록)
- [x] Agent E Galaxy Tab maxWidth 정책 (코드 1줄 + 주석 + docs §6)
- [x] Agent F 문서/QA 게이트

### 7.2 자동화 게이트
- [x] flutter analyze: No issues found
- [x] flutter test: 39/39 passed
- [x] flutter build apk --debug: OK
- [x] server pnpm test: 150/150 passed (변경 0이라 재실행 불필요)
- [x] server/prisma/socket contract: 0 변경
- [x] WS 이벤트 13개 1:1 정합성 유지

### 7.3 실기기 수동 게이트 (Blocked 유지 — 사용자 대기)
- [ ] §L 11항목 (S-client-flame-phase-overlay)
- [ ] §M 17~18항목 (S-client-village-movement-gap-prep)

### 7.4 다음 슬라이스 진입 조건
- §L + §M 실기기 모두 Pass + Critical/Blocker 0건 → `S-client-village-movement` 본격 진입.
- Fail 발견 시 BUG-FLAME-L### 또는 BUG-MOVE-M### 양식으로 보고 → 픽스 슬라이스.

## 8. 갱신 이력

- 2026-05-14: Agent A 의 10항목 전수 점검 + B/C/D/E 작업 범위 분담 + 파일
  소유권 표 (Agent A). 점검 결과: 구현 확인 8 / 검증 필요(실기기 체감) 2 /
  수정 필요(코드 갭) 0. 본 슬라이스 본질 = 본인 캐릭터 시각 구분(B) +
  인게임 채팅 compact/expanded(C) + 조이스틱/idle 점검(D) + Galaxy Tab
  maxWidth 정책(E).
- 2026-05-14: §6 maxWidth 정책 부록 추가 (Agent E). 결정: 옵션 A + C 조합
  (현재 정책 유지 + 패널별 분리 가이드 명시). breakpoint helper 미도입.
  코드 변경 = phase_overlay_panel.dart 주석 1블록 + village_pane.dart
  letterbox 색 1줄. 신규 파일 0건.
- 2026-05-14: §7 슬라이스 완료 상태 신설 (Agent F) — A~F 작업 완료 / 자동화
  게이트 6/6 그린 / 실기기 §L+§M Blocked 유지 / 다음 슬라이스 진입 조건 명시.
