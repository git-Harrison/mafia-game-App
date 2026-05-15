# 실시간 동기화 체크리스트 — 폰 2대 실 테스트용

> 1단계 MVP 도트 마피아의 WebSocket 실시간 동기화 이벤트를 한 곳에 모은 운영 가이드.
> 폰 2대(또는 시뮬레이터 + 실기기) 동시 접속 테스트 직전에 이 문서를 따라 점검한다.
> 자체 작성 정책 — 이벤트명·페이로드 키는 모두 기능 서술형이며 특정 게임과 무관.

## 개요 — 1단계 실시간 동기화 이벤트

1단계에서 실시간으로 양 클라이언트가 동기화해야 하는 흐름은 다음 4개 묶음.

1. **대기실 위치 동기화** — `lobbyMove` ↔ `lobbyPlayerPositionUpdated`. 캐주얼한 캐릭터
   움직임을 옆 폰 화면에 거의 즉시 반영. 서버는 검증만 하고 영속화하지 않는 relay.
2. **대기실 채팅** — `sendLobbyChatMessage` ↔ `lobbyChatMessage` (+ 입장 시 1회
   `lobbyChatHistory`). rate limit: 같은 userId 마지막 800ms 내 거부, 1초 sliding
   window 3건 초과 거부 (`server/src/rooms/rooms.gateway.ts`).
3. **인게임 캐릭터 이동** — `playerMove` ↔ `playerPositionUpdate`. 페이즈·직업·생존
   여부·zone 검증 후 룸 전체에 relay (영속화 X).
4. **페이즈 카운트다운** — `phaseChanged({phase, endsAt, nightNumber?})` + 보조
   `phaseSkipped`. 양쪽 디바이스가 같은 endsAt 을 기준으로 타이머를 그린다.

재접속(grace 60s)·채팅·투표·밤 액션·결과는 모두 서버 권위라서 일단 한쪽에서 보내고
ack 받으면 양쪽 화면이 알아서 같은 상태로 수렴.

## lobbyMove vs playerMove 빠른 비교

대기실 이동 (`lobbyMove`) 와 인게임 광장/마을 이동 (`playerMove`) 는 단계·페이즈·
좌표계·payload 가 모두 다르다. 분리 유지하는 게 책임 단순화에 더 좋아서 의도된 분기.

| 항목 | `lobbyMove` (대기실) | `playerMove` (인게임) |
|---|---|---|
| 단계 | 1단계 MVP | 2단계 도트 뷰 |
| 룸 상태 | `WAITING` 만 (`WRONG_STATUS` 가드) | `WAITING` 아님, `activeGame` 존재 시 (`NO_ACTIVE_GAME` 가드) |
| 좌표계 | `1500 × 800` (대기실 캔버스) | `240 × 240` (도트 마을 world) |
| 좌표 단위 | px (`x`,`y`) 직접 | px (`position.{x,y}`) 중첩 |
| payload key | `{ x, y }` | `{ position: { x, y } }` |
| 클라 throttle | 80ms (`LobbyMovementController`) | 100ms (`VillageGame._sendIntervalSec`) |
| 페이즈 가드 | 없음 (룸 상태만) | 페이즈별 zone 가드 (광장/집/마을) |
| 직업·생존 가드 | 없음 (관전·구분 없음) | 생존 (`DEAD`) + 페이즈별 직업 (`OUT_OF_ZONE`) |
| 시야 가드 | 없음 (룸 인원 전원에 broadcast) | 없음 — 좌표 자체는 룸 전원에게 broadcast (시야 차단은 클라가 night 페이즈 마스크로 처리) |
| broadcast 범위 | 같은 룸의 **sender 제외 전원** | 같은 룸의 **본인 포함 전원** |
| broadcast 이벤트 | `lobbyPlayerPositionUpdated` | `playerPositionUpdate` |
| 영속화 | X (relay) | X (relay) |
| 디버그 로그 | `[lobbyMove]` (kDebugMode) | `[playerMove]` (kDebugMode) |

핵심: 대기실은 "느슨한 룸 상태에서 좌표만 전달", 인게임은 "페이즈·직업·zone 검증 후
좌표 전달". 두 채널을 합치면 페이즈 가드 로직이 룸 상태 가드와 뒤엉켜 코드가 복잡해짐.

## 대기실 (lobby) 흐름

### 이벤트

- **`lobbyMove`** (client → server) — fire-and-forget.
  - payload: `{ x: number, y: number }`
  - 클라 throttle: **80ms** (`LobbyMovementController._broadcastThrottleMs`).
  - 서버 검증 (`server/src/rooms/rooms.gateway.ts` `lobbyMove`):
    - 소켓이 룸 소속이어야 함 (`NOT_IN_ROOM`).
    - 룸 상태 == `WAITING` (`WRONG_STATUS`).
    - `typeof x === 'number'` + `typeof y === 'number'` + 둘 다 `Number.isFinite` (`BAD_INPUT`).
    - 좌표 범위: `0 ≤ x ≤ 1500`, `0 ≤ y ≤ 800` (`BAD_INPUT`).
  - reject 시 broadcast 없음, 서버는 `logger.debug` 로 흔적만 남김.
- **`lobbyPlayerPositionUpdated`** (server → 같은 룸의 sender 제외 전원).
  - payload: `{ userId: string, x: number, y: number }`
  - 본인 소켓은 받지 않는다 (`socket.to(...)` 으로 제외).

### 적용 위치

- 송신: `client/lib/features/room/state/lobby_movement_controller.dart`
  - `applyJoystick` → 본인 위치 갱신 → `_maybeBroadcast` 가 80ms throttle 후 `_broadcaster` 호출.
  - `setBroadcaster` 와이어링은 `room_lobby_screen.dart` (이번 슬라이스에선 손대지 않음).
- 수신: 같은 controller 의 `applyRemotePosition(userId, x, y)`.
  - **본인 userId 는 무시** — 로컬이 진실 (`if (userId == state.myUserId) return`).
  - 멤버 리스트에 없는 userId 도 무시 (race 시 leave 후 늦은 이벤트 차단).

### 디버그 로그 (debug build only)

- emit 시점에 `debugPrint('[lobbyMove] x=... y=... (#카운트)')` 한 줄 출력 (`kDebugMode` 가드).
- emit 횟수 카운터: `LobbyMovementController.debugEmitCount`. 폰 2대 테스트 중 한쪽 콘솔에서
  `flutter logs | grep lobbyMove` 로 동기화 빈도를 직접 확인.
- release 빌드는 `kDebugMode==false` 라서 모든 디버그 코드가 dead code 로 dropped.

## 인게임 (in-game) 흐름

### 이벤트

- **`playerMove`** (client → server) — fire-and-forget (ack 실패 무시).
  - payload: `{ position: { x: number, y: number } }`
  - 클라 throttle: **100ms** (`VillageGame._sendIntervalSec = 0.1`, 약 10Hz).
  - 클라 가드: 직전 전송 좌표와 거의 동일하면 (`(p - _lastSentPos).length2 < 1e-4`) 생략.
  - 서버 검증 (`server/src/game/game.gateway.ts` `playerMove`
    + `server/src/game/game-room.manager.ts` `recordPlayerMove`
    + `server/src/game/domain/movement-zone.ts` `validateMovement`):
    - 룸 소속 + 활성 게임 존재 + `skipNotice == null` (PHASE_SKIPPING 시 거부).
    - 좌표 `Number.isFinite` (`INVALID_INPUT`).
    - 240×240 world 범위 (`OUT_OF_BOUNDS`).
    - 생존 (`DEAD`).
    - 페이즈별 zone:
      - `DAY_DISCUSSION` / `VOTE_SELECT` / `VOTE_CONFIRM` → 광장 박스 `x,y ∈ [80,160]` 안만.
      - `NIGHT_DOCTOR` / `NIGHT_MAFIA` / `NIGHT_POLICE` → 해당 직업은 world 전체, 비행동
        직업은 자기 집 박스 (슬롯 중심 반지름 24).
      - `EXECUTION` / `NIGHT_RESULT` / 그 외 전환 페이즈 → `WRONG_PHASE`.
- **`playerPositionUpdate`** (server → 같은 룸 전원, **본인 포함**).
  - payload: `{ userId: string, position: { x: number, y: number } }`
  - 영속화 없음 — relay 전용.

### 적용 위치

- 송신: `client/lib/features/game/flame/village_game.dart`
  - `update(dt)` 에서 조이스틱 입력 → `_me.position` 갱신 → 0.1s accumulate 후
    `config.onMyPositionChanged(x, y)`.
  - 콜백 와이어링: `client/lib/features/game/flame/village_pane.dart` →
    `GameNotifier.sendPlayerMove(x, y)` → `socket.emitAck('playerMove', { position })`.
- 수신: `client/lib/features/game/game_notifier.dart` `_onPlayerPositionUpdate`
  - VillagePane 가 좌표 맵을 watch 하다가 변경 시 `VillageGame.updateRemotePosition`
    호출 → 본인이면 `_me` 보정, 아니면 `_remotes[userId]` 의 보간 타겟 갱신.
  - 본인 좌표도 서버 응답으로 다시 그려서 서버 권위 일관 (Optimistic UI 없음).

### 알아둘 점

- 서버는 `playerPositionUpdate` 를 본인까지 포함해 broadcast 한다. 본인 캐릭터는
  로컬 즉시 이동 후 서버 응답으로 살짝 보정되는 구조.
- `OUT_OF_ZONE` 등 ack 실패는 의도된 race — `sendPlayerMove` 가 silently catch.
- 페이즈 전환 직후 짧은 PHASE_SKIPPING 윈도우(3s)에는 모든 이동 이벤트 거부.

### 페이즈별 이동 가드 요약 (서버)

`server/src/game/domain/movement-zone.ts validateMovement` 가 단일 진입점.

| 페이즈 | 허용 영역 | 비고 |
|---|---|---|
| `DAY_DISCUSSION` / `VOTE_SELECT` / `VOTE_CONFIRM` | 광장 박스 `[80,160]²` (전원) | 광장 밖 → `OUT_OF_ZONE` |
| `NIGHT_DOCTOR` | 의사: world 240×240 자유 / 그 외: 자기 집 박스 (반지름 24) | 비행동 직업이 마을 나오면 `OUT_OF_ZONE` |
| `NIGHT_MAFIA` | 마피아: world 자유 / 그 외: 자기 집 박스 | 마피아끼리는 서로 보임 (클라 처리) |
| `NIGHT_POLICE` | 경찰: world 자유 / 그 외: 자기 집 박스 | 시민은 자기 집 박스만 |
| `EXECUTION` / `NIGHT_RESULT` | 어떤 좌표든 거부 (`WRONG_PHASE`) | 전환 연출 페이즈 |
| `ROLE_ASSIGN_AND_HOUSING` / `READY_CHECK` / `WAITING` / `GAME_OVER` | 거부 (`WRONG_PHASE`) | 게임 외 페이즈 |

추가 가드:

- **`PHASE_SKIPPING` 윈도우 3s** — `skipNotice !== null` 이면 모든 좌표 거부.
- **죽은 유저** — `isAlive===false` 이면 어느 페이즈든 `DEAD`. 클라는 사망 후 죽은
  본인 좌표 emit 을 멈추는 게 정상 (`VillageGame.markDead` 로 표시).

### 죽은 유저 / 관전자 정책 (1단계 현황)

- **죽은 유저:** 서버는 `DEAD` 로 모든 `playerMove` reject. 좌표 broadcast 없음.
  클라는 사망 시 본인 아바타를 회색/유령 처리하고 조이스틱 입력을 비활성화.
  죽은 유저의 화면은 라이브 페이즈를 그대로 관전 (광장/마을 좌표는 산 자들의
  `playerPositionUpdate` 로 갱신).
- **관전자 (게임 외부 입장):** 1단계 스코프 외 — 진행 중 방에 새로 들어오는 관전자
  개념 없음. `joinRoom` 은 `WAITING` 상태에서만 허용. (TODO: 관전 모드는 4단계 이후
  검토 — 이 문서에는 결정 시점에 추가.)
- **연결 끊김 grace (60s):** 좌표는 영속화 X 라서 재접속 후엔 다음 emit 으로 자연
  복구. `reconnectSnapshot` payload 에 좌표 필드 없음 — 기본 위치에서 시작.

## 체크리스트 — 폰 2대 테스트 시 확인

1. **WS 연결 표시** — 두 디바이스 모두 debug indicator 좌상단에 초록 점 + `ws ok`.
2. **본인 이동 → 상대 화면 반영** — A 가 조이스틱으로 움직이면 B 화면의 A 캐릭터가
   80~120ms 이내 따라 움직이는지. 끊김 없이 부드럽게 보간되는지.
3. **상대 이동 → 본인 화면 반영** — B 가 움직이면 A 의 indicator `pos ... ms ago` 가
   100ms 안팎으로 갱신되는지.
4. **채팅 양방향 표시** — 한쪽이 채팅 보내면 양쪽 채팅 오버레이에 같은 timestamp 로
   표시. rate limit 발동 시 한쪽에 `LOBBY_CHAT_RATE_LIMITED` 토스트.
5. **카운트다운 동시성** — 호스트가 startGame → 양쪽 `phaseChanged` 수신 → 같은
   `endsAt` 기준 타이머. ±200ms 이내 동기로 0 도달.
6. **재접속 grace (in-game only)** — 한쪽 폰 비행기 모드 잠깐 → 60s 안에 복귀 시
   `reconnectSnapshot` 받고 자리·역할 보존. 60s 초과 시 사망 처리 + 승패 재평가.

### 인게임 이동 추가 체크포인트 (2단계 도트 뷰 도입 후)

대기실 항목 통과한 뒤, 게임 시작 후 다음을 확인:

1. **낮(`DAY_DISCUSSION` / `VOTE_SELECT` / `VOTE_CONFIRM`) 광장 이동만 broadcast** —
   A 가 광장 안에서 움직이면 B 의 A 아바타가 100~150ms 이내 따라감. 광장 박스
   `[80,160]²` 밖으로 클라 자체 clamp 되어 서버 reject 가 거의 안 떠야 정상.
   콘솔 grep `[playerMove]` 빈도 약 10Hz 유지.
2. **밤 행동 직업만 마을 이동 broadcast** — 의사/마피아/경찰 페이즈에서 해당 직업
   유저만 광장 밖 좌표가 상대 화면에 보임. 비행동 직업이 광장으로 나오려고 하면
   서버가 `OUT_OF_ZONE` reject (debug 로그 `playerMove reject ... error=OUT_OF_ZONE`)
   → 상대 화면엔 자기 집 안 그대로 멈춤.
3. **페이즈 전환 직후 3s PHASE_SKIPPING 윈도우** — 페이즈 바뀌는 순간 양쪽 화면에서
   잠깐 캐릭터가 안 움직이는 시점 있음. 콘솔에 `error=PHASE_SKIPPING` reject 가
   잠깐 쌓이면 정상. 3s 후 정상 이동 재개.

추가 디버그:

- 두 디바이스 모두 `[playerMove]` 카운터가 1초당 8~10개 증가하는지.
- 사망자는 `[playerMove]` emit 이 즉시 0 으로 떨어지는지 (클라가 dead 시 입력 차단).
- 서버 로그에서 `playerMove reject` 가 페이즈·zone 위반 시에만 나오는지 (정상 흐름엔 X).

## payload 예시

### lobbyMove (client → server)

```json
{ "x": 624.0, "y": 312.5 }
```

### lobbyPlayerPositionUpdated (server → others)

```json
{ "userId": "u-7f93", "x": 624.0, "y": 312.5 }
```

### playerMove (client → server)

```json
{ "position": { "x": 124.5, "y": 132.8 } }
```

### playerPositionUpdate (server → room)

```json
{ "userId": "u-7f93", "position": { "x": 124.5, "y": 132.8 } }
```

### phaseChanged (server → room)

```json
{ "phase": "DAY_DISCUSSION", "endsAt": 1715594400000, "nightNumber": null }
```

## debug indicator 활용법

`client/lib/features/room/presentation/widgets/lobby_debug_indicator.dart` 가
대기실 좌상단 (또는 배치된 위치) 에 다음 5줄을 표시 (kDebugMode 한정):

- `ws ok` / `ws disconnected` — 소켓 상태.
- `room <roomId 앞 8자>` — 현재 방.
- `players N` — 멤버 수.
- `pos NNNms ago` — 마지막 `lobbyPlayerPositionUpdated` 수신 후 경과. 본인 빼고
  다른 디바이스가 움직여야 갱신.
- `chat NNNms ago` — 마지막 `lobbyChatMessage` 수신 후 경과.

폰 2대 테스트 시 두 디바이스 모두 indicator 가 정상 갱신되어야 sync OK.
추가로 콘솔에서 `[lobbyMove]` grep 으로 송신 쪽 emit 빈도 확인.

## 알려진 한계 (1단계 의도된 단순화)

- **Home `listRooms` 폴링 5s** — 푸시 기반 갱신 X. 방 목록은 평균 2.5s 지연 허용.
- **`lobbyMove` fire-and-forget** — ack 사용하지 않음. reject 되어도 클라는 모름
  (다음 emit 으로 자연 복구). 변조 의심 좌표는 서버 로그만 남고 broadcast 차단.
- **`lobbyChatHistory` 1회만** — 입장 직후 본인에게 한 번 전달. 이후 history 재요청
  엔드포인트 없음 — 진행 중 채팅은 실시간 push 에 의존.
- **인게임 이동도 relay-only** — 서버는 좌표를 메모리에도 저장하지 않음. 재접속
  스냅샷에는 좌표 없음 — 다시 들어오면 기본 위치에서 시작 후 양쪽이 다음 emit 으로
  수렴.
- **단일 NestJS 인스턴스 + 인메모리 rate limit** — 수평 확장 시 Redis 어댑터 필요
  (M4 출시 직전에 도입 예정, 1단계 스코프 외).

## 갱신 이력

- 2026-05-13: 키보드 대응 / 약관 placeholder 화면 / 차단 목록 UX 슬라이스 완료에 맞춰
  `mobile-qa-checklist.md` 및 `release-readiness.md` 와 교차 링크 추가.
- 2026-05-13: friends/report repository boundary 추가 후 mobile-qa-checklist §10·11·12 보강.
- 2026-05-13: mobile-qa-log-template.md 추가 — 위치 동기화 실측 결과 기록은 해당 템플릿 사용
- 2026-05-13: performance-qa.md 신규 — 위치 동기화 지연 측정 절차 포함
- 2026-05-13: WidgetsBindingObserver + Flame pause/resume 추가 — 백그라운드 복귀 시 socket 재연결
- 2026-05-13: 네트워크/reconnect QA 점검 — listener `on/off` pair 정합 OK (room_lobby_screen 4개 / lobby_debug_indicator 2개 / game_notifier `_handlers` 맵 보존). socket_client 는 `setReconnectionAttempts(5)` 설정됨. 60초 grace 초과 후 reconnect 정책 (max retries 5회 후 종료 동작 + UI 안내) 은 다음 슬라이스에서 사용자 안내 다이얼로그 도입 후보로 TODO.
- 2026-05-13: reconnect 5회 한도 + 안내 UI 없음 — 다음 슬라이스 후보.
- 2026-05-13: 회차 2 Reconnect UX 시나리오 R1~R7 mobile-qa-checklist §15 에 명시
