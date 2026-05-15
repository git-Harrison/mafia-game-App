# 1단계 MVP — 4인 풀사이클 수동 QA 체크리스트

> **목적.** Agent C 가 시뮬레이터 2개 + macOS Chrome(또는 추가 시뮬) 2개로 **4명 한 판**을 처음부터 끝까지 돌려서 1단계 MVP 가 끊김 없이 동작하는지 검증한다.
>
> **함께 읽기.** `../mafia-app-context.md` (§2 룰 / §3 페이즈 머신 / §5 WS 이벤트), `../mafia-app-design-policy.md`, `../mafia-app-harness.md` §6.
>
> **테스트 대상.** 1단계 결승선 — 게스트 로그인 · 4~8명 방 · 직업/집 배정 · 낮·밤·투표 한 사이클 · 승패 판정 · 재접속 grace 60s.

## ⚡ 핵심 9 Step 실측 기록표 (사용자 GUI 풀사이클)

> 사용자 시나리오 매핑 — 서버 부팅부터 게임 종료까지 1회 풀사이클을 9개 step 으로 압축. **이 표만 다 Pass 면 1단계 MVP 종료**.
> 상세는 아래 §29 step 풀 체크리스트 참조.

| # | Step | Device/User | Action | Expected | Actual | Pass/Fail/Blocked | Log keyword | Bug ID |
|---|---|---|---|---|---|---|---|---|
| 1 | 서버 실행 | macOS 호스트 | `cd server && pnpm start:dev` | NestJS 부트 완료, `/health` 200, 포트 3000 listen | | | 서버 로그 `Nest application successfully started`, `/health` curl 200 | |
| 2 | 클라 4명 실행 | iOS-Sim Host / Android-Emu P2 / iOS-Real P3 / Android-Real P4 | 각 디바이스에서 `flutter run --dart-define=API_BASE_URL=...` | 4 디바이스 모두 스플래시 → 닉네임 화면 진입, 크래시 X | | | 클라 콘솔 flutter 부팅, splash route 진입 | |
| 3 | 닉네임 입력 | 4 디바이스 각각 | 닉네임 입력 → 확인 | 게스트 `User` 생성 + JWT 발급(`kind="guest"`), WS 핸드셰이크 통과, 홈 진입 | | | 서버 `WS auth ok: <socketId> as <닉네임>(<userId>)` | |
| 4 | 방 생성 | iOS-Sim Host | "방 만들기" → maxPlayers=4 → 생성 | `createRoom` ack `{ ok: true, data: { roomId, code } }`, 6자리 코드(O/I 제외) 표시, `roomUpdated` 수신 (호스트 1명) | | | 클라 `roomUpdated`, code 정규식 `/^[A-HJ-NP-Z]{6}$/` | |
| 5 | 방 입장 | Android-Emu P2 / iOS-Real P3 / Android-Real P4 | 코드 입력 → 참가 | 각 디바이스 `joinRoom` ack OK, `roomUpdated` members 4명 도달, 호스트 화면에서 P2/P3/P4 표시 | | | 클라 `roomUpdated` (members.length=4), 에러 시 `ALREADY_IN_ROOM` / `NOT_FOUND` / `FULL` | |
| 6 | 게임 시작 + 직업/집 배정 | 비호스트 3명 ready → iOS-Sim Host startGame | 비호스트 3명 "준비" → 호스트 "게임 시작" | `assignRoles` 본인만 (`{ role, houseId, mafiaAllies? }`, 마피아만 `mafiaAllies` 포함) → `housesAssigned` 전체 (8슬롯 고정, 4슬롯은 `ownerUserId: null`) | | | 클라 `assignRoles`, `housesAssigned` | |
| 7 | 낮/투표 (DAY → VOTE_SELECT → VOTE_CONFIRM → EXECUTION) | 4명 전원 | DAY 채팅 → 1차 투표 대상 탭 → 2차 찬반 탭 (후보 본인 버튼 비활성) | `phaseChanged DAY_DISCUSSION`(120s, env 단축 가능) → `chatMessage` → `VOTE_SELECT`(30s) `voteCast` 실시간 (변경 무제한·마지막 표만) → `VOTE_CONFIRM`(20s) 후보 자동 반대 1표 → `EXECUTION`(3s) `executionResult { reason: majority/no_majority/tie/no_votes, victimUserId }` | | | 클라 `phaseChanged`, `chatMessage`, `voteCast`, `executionResult` | |
| 8 | 밤 3페이즈 (DOCTOR → MAFIA → POLICE → RESULT) | 행동 직업 / 나머지 자기집 | 의사 보호 집 탭 → 마피아 살해 집 탭 + 마피아 채팅 → 경찰 조사 집 탭 | `NIGHT_DOCTOR`(30s, 자기보호 nightNumber===1만, 그 외 `SELF_PROTECTION_NOT_ALLOWED`) → `NIGHT_MAFIA`(30s, `mafiaChat`/`houseEntered` 마피아만, 4명방=1명 타겟 살해) → `NIGHT_POLICE`(30s, `policeResult` 본인만) → `NIGHT_RESULT`(5s) `nightResult { victimUserId }` (의사 보호 == 마피아 타겟이면 무효 = null) | | | 클라 `phaseChanged`(NIGHT_DOCTOR/MAFIA/POLICE/RESULT), `houseEntered`, `mafiaChat`, `policeResult`, `nightResult`. 에러: `FORBIDDEN` / `SELF_PROTECTION_NOT_ALLOWED` / `ALREADY_LOCKED` / `WRONG_PHASE` | |
| 9 | 결과/다음 사이클 또는 게임 종료 | 4명 전원 | 사이클 자동 진행 — 승부 미결정이면 다음 DAY, 결정되면 결과 화면 | 다음 사이클이면 `phaseChanged DAY_DISCUSSION` + 다음 밤에 `nightNumber` +1. 게임 종료면 `gameOver { winnerTeam, players[{userId,role,isWinner,finalAlive}] }` → game_over_pane 라우팅 → 홈 복귀 가능 (`leaveRoom` ack) | | | 클라 `gameOver`, 라우터 push `game_result_screen`. 서버 `Game ... persisted (winner=...)` (Postgres INSERT 완료 신호) | |

**1단계 종료 판정:** Critical 0 + 핵심 9 모두 Pass + 전체 29 중 90% Pass.

> ⚠️ 실측 전에는 모든 step 의 Actual / Pass/Fail/Blocked / Bug ID 컬럼을 비워둔다. 사용자가 직접 시뮬/실기기에서 확인한 결과만 기록.

**상세 step + 로그 키워드는 아래 §29 step 풀 체크리스트 참조.**

## 📋 결과 요약 템플릿 (사용자가 코워크에 붙여넣을 때)

```text
[GUI 풀사이클 실측 결과]
- 일시: YYYY-MM-DD HH:MM (소요 약 N분)
- 인원/기기: iOS-Sim(닉네임), Android-Emu(닉네임), iOS-Real(닉네임), Android-Real(닉네임)
  (또는 부족 시 사유: 예 "4명 구성 불가 → 3명 진행")
- 방 코드: ABCDEF
- 게임 결과: 시민/마피아 승, currentNightNumber=N, 소요 N분
- 핵심 9 Step:
  1. 서버 실행: Pass / Fail / Blocked
  2. 클라 4명 실행: Pass / Fail / Blocked
  3. 닉네임 입력: Pass / Fail / Blocked
  4. 방 생성: Pass / Fail / Blocked
  5. 방 입장: Pass / Fail / Blocked
  6. 게임 시작 + 직업/집 배정: Pass / Fail / Blocked
  7. 낮/투표 (DAY → VOTE_SELECT → VOTE_CONFIRM → EXECUTION): Pass / Fail / Blocked
  8. 밤 3페이즈 (DOCTOR → MAFIA → POLICE → RESULT): Pass / Fail / Blocked
  9. 결과/다음 사이클 또는 게임 종료: Pass / Fail / Blocked
- Critical/Blocker BUG: N건 (있으면 BUG-S1-NNN 형식, 아래 상세)
- 잔여 사소 이슈: N건 (Minor)
- 다음 액션: 1단계 MVP 종료 선언 / BUG 픽스 슬라이스 진입
```

## ✅ 실측 결과 (2026-05-14 — 1단계 MVP 종료)

```text
[GUI 풀사이클 실측 결과 — 회차 1]
- 일시: 2026-05-14
- 확인 방식: 디렉터 단언 Pass (상세 step 표는 회차 누적 시 채움)
- 핵심 9 Step: 모두 Pass
  1. 서버 실행: Pass
  2. 클라 실행: Pass
  3. 닉네임 입력: Pass
  4. 방 생성: Pass
  5. 방 입장: Pass
  6. 게임 시작 + 직업/집 배정: Pass
  7. 낮/투표 (DAY → VOTE_SELECT → VOTE_CONFIRM → EXECUTION): Pass
  8. 밤 3페이즈 (DOCTOR → MAFIA → POLICE → RESULT): Pass
  9. 결과/다음 사이클 또는 게임 종료: Pass
- Critical/Blocker BUG: 0건
- 다음 액션: 1단계 MVP 종료 선언 → `release-readiness.md §7` 갱신 완료 → 2단계 첫 슬라이스 `S-client-flame-phase-overlay` 진입.
```

> 회차 2 이상 또는 회귀 의심 시 동일 양식으로 추가 기록. 상세 9 Step 표 Actual 컬럼은 회차 누적되면서 채움.

## 🐛 Fail 보고 양식 (Critical/Blocker BUG 발생 시)

```text
[BUG-S1-NNN]
- 단계: Step N (이름)
- 기기: iOS-Sim / Android-Emu / iOS-Real / Android-Real
- 화면: 어떤 화면(스크린샷 있으면 첨부)
- 재현 단계:
  1. ...
  2. ...
  3. ...
- 기대 동작:
- 실제 동작:
- 서버 로그 grep 키워드: (예: `gameOver` / `phaseChanged` / `executionResult`)
- 클라 로그/콘솔 출력:
- 재현 여부: 매번 / 가끔(N회 중 M회) / 1회만
- 영상/스크린샷 경로: (있으면)
```

> 회차별 누적 로그 표(메타·시나리오별·성능·이슈)는 [`mobile-qa-log-template.md`](./mobile-qa-log-template.md) 참조 — GUI 풀사이클 결과 요약은 위 양식, 회차 반복·성능·재접속·차단 등 추가 시나리오는 그쪽 템플릿에 기록.

## 디바이스/유저 배정

| 호칭 | 디바이스 | 역할 | 비고 |
|---|---|---|---|
| **iOS-Host** | iOS Simulator | 호스트, P1 | 닉네임 예: `호스트1` |
| **Android-P2** | Android Emulator | 비호스트, P2 | `참가자2` · `API_BASE_URL=http://10.0.2.2:3000` |
| **macOS-P3** | macOS (Chrome WS 또는 추가 시뮬) | 비호스트, P3 | `참가자3` |
| **Android-P4** | Android 실기기 (USB) | 비호스트, P4 | `참가자4` · `http://<mac LAN IP>:3000` |

> 직업 분포(4명): 마피아 1, 경찰 1, 의사 1, 시민 1 (`mafia-app-context.md` §2). 누가 어떤 직업인지는 매 판 랜덤이라 결과 컬럼에 기록.

## 로그 grep 가이드

서버 콘솔에서 진행 추적할 때 다음 키워드 사용:

- WS 인증: `WS auth ok` / `WS auth fail`
- 연결: `WS reconnect` / `WS disconnect (in-game grace)` / `WS disconnected`
- 재접속 만료 사망: `reconnect grace expired`
- 페이즈 전이 실패: `Phase advance failed`
- 게임 종료 영속화: `Game ... persisted (winner=...)`
- 강퇴: `kicked` (클라 이벤트)
- 게임 ID 로 trace: `game-room.manager` 로그에는 `room/gameId` 포함 — `grep "<roomId>"`.

서버 emit 이벤트(클라가 수신):
`assignRoles` · `housesAssigned` · `phaseChanged` · `phaseSkipped` · `voteCast` · `executionResult` · `nightResult` · `policeResult` · `gameOver` · `houseEntered` · `chatMessage` · `mafiaChat` · `reconnectSnapshot` · `roomUpdated` · `lobbyChatMessage` · `lobbyChatHistory` · `lobbyPlayerPositionUpdated` · `kicked`

클라 송신 이벤트(ack 패턴):
`createRoom` · `joinRoom` · `leaveRoom` · `kickPlayer` · `playerReady` · `startGame` · `listRooms` · `quickMatch` · `sendLobbyChatMessage` · `lobbyMove` · `selectVoteTarget` · `confirmExecutionVote` · `sendChatMessage` · `sendMafiaChat` · `enterHouse` · `playerMove`

---

## 컬럼 정의 (모든 step 공통)

| 컬럼 | 의미 |
|---|---|
| **Step #** | 진행 순번 |
| **Device/User** | 행동 주체. 여러 디바이스가 동시 관찰이면 모두 기록 |
| **Action** | 사용자가 누른/입력한 행동 |
| **Expected** | 서버·클라 기대 동작 (`mafia-app-context.md` §2·3·5 근거) |
| **Actual** | Agent C 가 실측을 기록 — 공란으로 시작 |
| **Pass/Fail/Blocked** | 실측 결과. Pass 는 Actual 작성 후에만 |
| **Log keyword** | 서버 grep 키워드 + 클라가 받아야 하는 WS 이벤트명 |
| **Screenshot/video** | 선택 — Fail 시 첨부 권장. 파일명만 기입 |
| **Bug ID** | Fail 시 발급. 형식 예: `BUG-QA-001` |

---

## Step 목록 (총 28)

### 0. 앱 진입 & 인증

#### Step 1 — Cold start (앱 실행 / 스플래시)
- **Device/User:** 4 디바이스 전부 (순차 OK)
- **Action:** 앱 아이콘 탭 → cold start
- **Expected:**
  - splash 화면 노출 후 자동으로 닉네임 또는 홈으로 진입
  - 크래시·흰 화면 X
  - 디버그 콘솔에 Flutter 부팅 로그 + WS 미연결 상태(소켓은 닉네임/홈 이후 연결)
- **Actual:**
- **Pass/Fail/Blocked:**
- **Log keyword:** (클라) `flutter_native_splash`, splash route 진입 로그. (서버) 아직 연결 X.
- **Screenshot/video:**
- **Bug ID:**

#### Step 2 — 닉네임 입력 (게스트 인증)
- **Device/User:** 4 디바이스 각각
- **Action:** 닉네임 입력 → 확인
- **Expected:**
  - 서버에 게스트 `User` 생성 + JWT 발급 (`kind="guest"`)
  - WS 핸드셰이크 미들웨어가 토큰 검증 후 `socket.data` 에 `userId/nickname` 세팅
  - 서버 로그: `WS auth ok: <socketId> as <닉네임>(<userId>)`
  - 클라가 `user:<userId>` 룸 자동 join
- **Actual:**
- **Pass/Fail/Blocked:**
- **Log keyword:** 서버 `WS auth ok`. 실패 시 `WS auth fail`.
- **Screenshot/video:**
- **Bug ID:**

#### Step 3 — 홈 진입 (메뉴 표시)
- **Device/User:** 4 디바이스 각각
- **Action:** 닉네임 확정 후 자동 라우팅 또는 홈 진입
- **Expected:**
  - 홈에 "방 만들기" / "방 코드로 참가" / 방 목록 표시
  - `listRooms` ack 로 WAITING 상태 방 공개 요약 수신
  - 라우터 redirect 가드 (`로그인 토큰 체크`) 통과
- **Actual:**
- **Pass/Fail/Blocked:**
- **Log keyword:** 서버 `listRooms` ack 응답. 클라 home_screen 마운트 로그.
- **Screenshot/video:**
- **Bug ID:**

### 1. 방 만들기 & 모이기

#### Step 4 — 방 생성 (호스트)
- **Device/User:** iOS-Host
- **Action:** "방 만들기" → maxPlayers=4 선택 → 생성
- **Expected:**
  - `createRoom` ack `{ ok: true, data: { roomId, code } }`
  - 호스트가 `room:<roomId>` 룸 join
  - 본인에게 `lobbyChatHistory` 1회 emit (빈 배열)
  - 룸 전체에 `roomUpdated` 브로드캐스트 (호스트 1명 포함)
  - 방 상태 `WAITING`, 호스트는 ready=true 간주(서버 측 호스트 ready 토글 거부)
- **Actual:**
- **Pass/Fail/Blocked:**
- **Log keyword:** 서버 `createRoom` ack, `roomUpdated` emit. 클라 수신 이벤트: `lobbyChatHistory`, `roomUpdated`.
- **Screenshot/video:**
- **Bug ID:**

#### Step 5 — 방 코드 6자리 확인 (O/I 제외)
- **Device/User:** iOS-Host
- **Action:** 생성된 방 코드 화면에서 확인
- **Expected:**
  - 코드는 **대문자 알파벳 6자**, 사용 문자집합은 24자 (A,B,C,D,E,F,G,H,J,K,L,M,N,P,Q,R,S,T,U,V,W,X,Y,Z — **O/I 제외**) (`mafia-app-context.md` §5-1)
  - 코드 노출 + 복사/공유 UX (1단계는 텍스트 복사로 충분)
- **Actual:** (예: 발급된 코드 기록)
- **Pass/Fail/Blocked:**
- **Log keyword:** Step 4 ack 의 `code` 필드. 정규식 `/^[A-HJ-NP-Z]{6}$/`.
- **Screenshot/video:**
- **Bug ID:**

#### Step 6 — 나머지 3명 입장 (P2/P3/P4)
- **Device/User:** Android-P2 → macOS-P3 → Android-P4 (순차)
- **Action:** 각자 "방 코드로 참가" → Step 5 의 코드 입력 → 참가
- **Expected:**
  - 각 디바이스 `joinRoom` ack `{ ok: true, data: { roomId, code } }`
  - 참가자 본인에게 `lobbyChatHistory` 1회
  - 룸 전체에 `roomUpdated` (members 배열 증가, 각자 닉네임 포함)
  - 입장 후 인원수 4/4 도달
  - 4명 초과 시도하면 `FULL` 거부 (별도 검증 — 1단계 4~8명, 본 step 은 4로 제한)
- **Actual:**
- **Pass/Fail/Blocked:**
- **Log keyword:** 서버 `joinRoom` ack, `roomUpdated`. 실패 코드: `ALREADY_IN_ROOM`, `NOT_FOUND`, `FULL`.
- **Screenshot/video:**
- **Bug ID:**

#### Step 7 — Ready 토글 (호스트 제외 3명)
- **Device/User:** Android-P2, macOS-P3, Android-P4
- **Action:** 각자 "준비" 버튼 탭
- **Expected:**
  - 각자 `playerReady { ready: true }` ack → `{ ok: true }`
  - 룸 전체에 `roomUpdated` (해당 멤버 ready=true)
  - 3명 모두 ready 가 되면 iOS-Host 의 시작 버튼이 활성화 (`players.length ≥ 4` AND 비호스트 전원 ready) (`mafia-app-context.md` §5-1bis)
  - 호스트가 `playerReady` 보내면 서버에서 `HOST_CANT_READY` 거부 (선택 검증)
- **Actual:**
- **Pass/Fail/Blocked:**
- **Log keyword:** 서버 `playerReady` ack, `roomUpdated`. 클라 카피 `방장은 준비를 누를 수 없어요.` (코드 `HOST_CANT_READY`).
- **Screenshot/video:**
- **Bug ID:**

### 2. 게임 시작 — 직업/집 배정

#### Step 8 — 호스트 startGame → 직업 배정 (`assignRoles`)
- **Device/User:** iOS-Host (탭) / 4명 모두 (수신 관찰)
- **Action:** iOS-Host 가 "게임 시작" 탭
- **Expected:**
  - 서버 `startGame` ack `{ ok: true }`
  - `roomUpdated` (status `READY_CHECK` → 즉시 `IN_GAME`)
  - **각 플레이어에게 개인별** `assignRoles` emit (`emitToUser`)
    - payload: `{ role: 'CITIZEN'|'POLICE'|'DOCTOR'|'MAFIA', houseId, mafiaAllies? }`
    - `mafiaAllies` 는 **MAFIA 본인만** 받는 동료 식별 정보 (1명이면 본인 1명 포함 배열)
  - 4명 분포(`mafia-app-context.md` §2): MAFIA 1, POLICE 1, DOCTOR 1, CITIZEN 1
  - 시민은 `mafiaAllies` 필드 없음
- **Actual:** (각자 받은 role 기록 — 디버그 UI 또는 화면 표시)
- **Pass/Fail/Blocked:**
- **Log keyword:** 클라 `assignRoles`. 서버는 emit 직접 로그 없음 → 클라 디버그 콘솔로만 확인. (회귀 시) `game-room.manager` 영역 grep.
- **Screenshot/video:**
- **Bug ID:**

#### Step 9 — 집 배정 (`housesAssigned`)
- **Device/User:** 4명 전원 (수신 관찰)
- **Action:** Step 8 자동 진행 — 별도 입력 없음
- **Expected:**
  - 룸 전체에 `housesAssigned` 1회 emit
  - payload: `{ map: [{ userId, houseId }×4], houses: [{ houseId, slotIndex, ownerUserId }×8] }`
  - 집 슬롯 **8개 고정** (4명 방이라도 8슬롯 유지, 나머지 4슬롯은 `ownerUserId: null`)
  - 모든 플레이어의 `houseId` 가 본인의 `assignRoles.houseId` 와 일치
  - 닉네임 이름표는 낮·밤 모두 공개 (UI 검증)
- **Actual:**
- **Pass/Fail/Blocked:**
- **Log keyword:** 클라 `housesAssigned`.
- **Screenshot/video:**
- **Bug ID:**

### 3. 낮 사이클

#### Step 10 — 낮 페이즈 진입 (`phaseChanged: DAY_DISCUSSION`)
- **Device/User:** 4명 전원
- **Action:** Step 9 자동 진행
- **Expected:**
  - `phaseChanged { phase: 'DAY_DISCUSSION', endsAt }` 룸 브로드캐스트 (nightNumber 없음)
  - 기본 120초 (env `GAME_DAY_DISCUSSION_SEC` 기본). 테스트 시 단축 가능.
  - 클라가 낮 화면(day_pane.dart) 으로 라우팅
  - 카운트다운 표시
- **Actual:**
- **Pass/Fail/Blocked:**
- **Log keyword:** 클라 `phaseChanged` (phase=`DAY_DISCUSSION`).
- **Screenshot/video:**
- **Bug ID:**

#### Step 11 — 낮 채팅 (`sendChatMessage` → `chatMessage`)
- **Device/User:** 송신 1명 → 4명 모두 수신
- **Action:** 임의 1명이 채팅 입력 → 전송
- **Expected:**
  - 송신 ack `{ ok: true }`
  - 룸 전체에 `chatMessage` emit (송신자 포함)
  - payload 에 `senderUserId`, `senderName`, `message`, 타임스탬프 포함
  - 빈 문자열·DAY 외 페이즈는 거부 (`WRONG_PHASE`)
- **Actual:**
- **Pass/Fail/Blocked:**
- **Log keyword:** 클라 `chatMessage`. 에러 코드: `WRONG_PHASE` / `INVALID_INPUT`.
- **Screenshot/video:**
- **Bug ID:**

### 4. 투표

#### Step 12 — 투표 대상 선택 (`VOTE_SELECT`, `selectVoteTarget` → `voteCast`)
- **Device/User:** 4명 전원
- **Action:** DAY_DISCUSSION 만료 자동 진행 또는 호스트 강제 종료 후, 각자 1차 투표 대상 탭
- **Expected:**
  - `phaseChanged { phase: 'VOTE_SELECT', endsAt }` 룸 브로드캐스트 (기본 30s)
  - 각 투표마다 `selectVoteTarget { targetUserId }` ack `{ ok: true }`
  - 매번 룸 전체에 `voteCast { voterUserId, targetUserId }` 실시간 브로드캐스트 (`targetUserId: null` = 취소·기권)
  - 변경 무제한, **마지막 표만 집계**
  - 죽은 플레이어/본인 외 부정 대상은 `INVALID_TARGET`
- **Actual:** (각자 누구에게 투표했는지 + 변경 시도 했는지 기록)
- **Pass/Fail/Blocked:**
- **Log keyword:** 클라 `voteCast`. ack 에러: `INVALID_TARGET` / `WRONG_PHASE` / `DEAD`.
- **Screenshot/video:**
- **Bug ID:**

#### Step 13 — 1차 투표 집계 (최다 득표 / 동률)
- **Device/User:** 4명 전원 (관찰)
- **Action:** VOTE_SELECT 타이머 만료 대기
- **Expected:**
  - 서버가 `selectVotes` 집계 → 최다 득표 1명 = 후보
  - 동률·전원 기권 시 후보 없음 → VOTE_CONFIRM **스킵**, EXECUTION (3s) 로 직행
  - 후보 있으면 `phaseChanged { phase: 'VOTE_CONFIRM', endsAt }` (기본 20s)
- **Actual:** (후보 userId / 동률·기권 여부 기록)
- **Pass/Fail/Blocked:**
- **Log keyword:** 클라 `phaseChanged` (phase=`VOTE_CONFIRM` 또는 `EXECUTION`).
- **Screenshot/video:**
- **Bug ID:**

#### Step 14 — 2차 찬반 (`VOTE_CONFIRM`, 후보 자동 반대 1표)
- **Device/User:** 4명 전원 — 후보 본인 vs 나머지 분리 관찰
- **Action:** 후보 외 3명 찬반 탭
- **Expected:**
  - 후보 본인 UI: 찬성·반대 버튼 **비활성화** + "당신이 후보입니다" 카피
  - 후보가 `confirmExecutionVote` 보내면 `CANDIDATE_CANNOT_VOTE` (서버 정책 — 또는 무시)
  - 서버는 VOTE_CONFIRM 진입 시점에 후보 표를 **반대 1표 pre-count**
  - 나머지 3명 각자 `confirmExecutionVote { approve: bool }` ack `{ ok: true }`
- **Actual:**
- **Pass/Fail/Blocked:**
- **Log keyword:** 클라 카피 `당신이 후보예요. 본인 표결에는 참여할 수 없어요.` 매핑 (`CANDIDATE_CANNOT_VOTE`).
- **Screenshot/video:**
- **Bug ID:**

#### Step 15 — 처형 결과 (`executionResult`, 항상 emit)
- **Device/User:** 4명 전원
- **Action:** VOTE_CONFIRM 만료 또는 모든 표 완료 후
- **Expected:**
  - `phaseChanged { phase: 'EXECUTION' }` (고정 3s) → `executionResult` **1회** emit
  - payload: `{ reason: 'majority'|'no_majority'|'tie'|'no_votes', victimUserId: string|null }`
    - `majority`: 찬성 과반 → 처형 (`victimUserId` = 후보)
    - `no_majority`: 찬성 부족 → 미처형 (`victimUserId: null`)
    - `tie` / `no_votes`: VOTE_CONFIRM 스킵 시 (`victimUserId: null`)
  - 클라 execution_pane 이 reason 별 자체 카피 출력
  - 처형되면 `victim.isAlive=false` 반영
- **Actual:** (reason + victim 기록)
- **Pass/Fail/Blocked:**
- **Log keyword:** 클라 `executionResult`.
- **Screenshot/video:**
- **Bug ID:**

### 5. 밤 사이클

#### Step 16 — 의사 페이즈 진입 (`NIGHT_DOCTOR`)
- **Device/User:** 의사 1명 (행동) / 나머지 3명 (자기 집 화면)
- **Action:** 의사가 보호할 집 탭 → `enterHouse { houseId }`
- **Expected:**
  - `phaseChanged { phase: 'NIGHT_DOCTOR', endsAt, nightNumber: 1 }` (첫 밤이면 1)
  - 의사 진입 ack `{ ok: true }` + `houseEntered { actorId, houseId }` 는 **행동 직업에게만** (의사 본인만 수신, 다른 직업 X)
  - **자기 집 보호**는 `nightNumber === 1` 만 허용. 2번째 밤부터는 `SELF_PROTECTION_NOT_ALLOWED`
  - 진입 후 페이즈 끝까지 락 (`ALREADY_LOCKED`)
  - 비의사가 enterHouse 시 `FORBIDDEN`
  - 시민·경찰·마피아의 화면: 자기 집 안만 (1단계는 텍스트 UI)
- **Actual:**
- **Pass/Fail/Blocked:**
- **Log keyword:** 클라 `phaseChanged`(`NIGHT_DOCTOR`), `houseEntered`(의사 본인). 에러: `FORBIDDEN` / `SELF_PROTECTION_NOT_ALLOWED` / `ALREADY_LOCKED`.
- **Screenshot/video:**
- **Bug ID:**

#### Step 17 — 마피아 페이즈 (`NIGHT_MAFIA`, 마피아 채팅)
- **Device/User:** 마피아 1명 (행동) / 나머지 3명 (자기 집)
- **Action:** 마피아가 살해할 집 탭 → `enterHouse`. 마피아 채팅 시도 → `sendMafiaChat`
- **Expected:**
  - `phaseChanged { phase: 'NIGHT_MAFIA', endsAt, nightNumber }`
  - 4명 방은 마피아 1명 구성 → 그 1명의 타겟이 살해 후보 (`mafia-app-context.md` §8-1 4단계)
  - 마피아끼리만 `houseEntered` 수신 (의사·경찰·시민 X)
  - `sendMafiaChat` → `mafiaChat` 은 **마피아 한정 emitToUsers**. 비마피아는 수신 X
  - DAY 시도 `WRONG_PHASE`
- **Actual:**
- **Pass/Fail/Blocked:**
- **Log keyword:** 클라 `mafiaChat`, `houseEntered`. 에러: `FORBIDDEN`.
- **Screenshot/video:**
- **Bug ID:**

#### Step 18 — 경찰 페이즈 (`NIGHT_POLICE`, `policeResult`)
- **Device/User:** 경찰 1명 (행동) / 나머지 3명
- **Action:** 경찰이 조사할 집 탭 → `enterHouse`
- **Expected:**
  - `phaseChanged { phase: 'NIGHT_POLICE', endsAt, nightNumber }`
  - 경찰 본인에게만 `houseEntered`
  - 결과 emit 시점은 NIGHT_RESULT 진입 직후 — 경찰 본인에게만 `policeResult { targetUserId, isMafia: boolean }` (다른 사람 수신 X)
  - 경찰이 NIGHT_RESULT 시점에 사망하면 `policeResult` emit X
- **Actual:**
- **Pass/Fail/Blocked:**
- **Log keyword:** 클라 `policeResult`(경찰만), `houseEntered`(경찰만).
- **Screenshot/video:**
- **Bug ID:**

#### Step 19 — 밤 결과 (`NIGHT_RESULT`, 사망자 공개)
- **Device/User:** 4명 전원
- **Action:** 모든 행동 완료 또는 NIGHT_POLICE 만료 대기
- **Expected:**
  - `phaseChanged { phase: 'NIGHT_RESULT', endsAt, nightNumber }` 기본 5s
  - `nightResult { victimUserId: string|null }` 룸 브로드캐스트
  - 의사 보호 == 마피아 타겟이면 **사망 무효** (`victimUserId: null`)
  - 살해된 플레이어 `isAlive=false`, 클라가 자체 카피로 사망 공지
  - **카피는 클라가 reason/데이터로 결정** (서버는 룰 코드만 — design-policy 자체 작성)
- **Actual:**
- **Pass/Fail/Blocked:**
- **Log keyword:** 클라 `nightResult`. 같은 페이즈에 `policeResult` 별도(경찰만).
- **Screenshot/video:**
- **Bug ID:**

#### Step 20 — 의사 사망 시 페이즈 단축 (`phaseSkipped`)
- **Device/User:** 4명 전원 (의사 사망한 다음 밤에 관찰)
- **Action:** 의사가 죽은 직후 다음 밤 사이클이 시작될 때
- **Expected:**
  - `phaseSkipped { skipped: 'NIGHT_DOCTOR', reason: 'doctor_dead', nextPhase: 'NIGHT_MAFIA', noticeMs: 3000 }` 룸 emit
  - 클라 카피 (자체): "의사가 사망하여 의사 페이즈가 생략됩니다 (3초 후 마피아 페이즈)" (또는 동등 자체 작성 카피)
  - 3초 동안 currentPhase 는 `NIGHT_DOCTOR` 유지, 모든 행동 거부 (`PHASE_SKIPPING`)
  - 3초 후 정상 `phaseChanged { phase: 'NIGHT_MAFIA' }`
- **Actual:**
- **Pass/Fail/Blocked:**
- **Log keyword:** 클라 `phaseSkipped`. 에러 코드: `PHASE_SKIPPING`.
- **Screenshot/video:**
- **Bug ID:**

#### Step 21 — 경찰 사망 시 페이즈 단축 (`phaseSkipped`)
- **Device/User:** 4명 전원 (경찰 사망 후 밤에 관찰)
- **Action:** 경찰이 죽은 다음 밤
- **Expected:**
  - `phaseSkipped { skipped: 'NIGHT_POLICE', reason: 'police_dead', nextPhase: 'NIGHT_RESULT', noticeMs: 3000 }`
  - 클라 카피 (자체): "경찰이 사망하여 경찰 페이즈가 생략됩니다 (3초 후 밤 결과)"
  - 3초 후 `phaseChanged { phase: 'NIGHT_RESULT' }` + nightResult emit
- **Actual:**
- **Pass/Fail/Blocked:**
- **Log keyword:** 클라 `phaseSkipped`.
- **Screenshot/video:**
- **Bug ID:**

### 6. 다음 사이클 & 종료

#### Step 22 — 다음 낮 사이클 (currentNightNumber +1)
- **Device/User:** 4명 전원
- **Action:** NIGHT_RESULT 만료 자동 진행
- **Expected:**
  - 게임 종료 조건 미충족 시 `phaseChanged { phase: 'DAY_DISCUSSION', endsAt }` (nightNumber 없음)
  - 다음 밤 진입 시 `nightNumber` +1 적용 (NIGHT_DOCTOR phaseChanged 의 nightNumber 가 2 로)
  - 사망자는 채팅 송신 거부 (`DEAD`), 채팅·투표 UI 비활성화
- **Actual:**
- **Pass/Fail/Blocked:**
- **Log keyword:** 클라 `phaseChanged`(DAY → 다시 VOTE...→ NIGHT_DOCTOR with nightNumber=2).
- **Screenshot/video:**
- **Bug ID:**

#### Step 23 — 승리 조건 판정
- **Device/User:** 4명 전원
- **Action:** 사이클 진행
- **Expected:**
  - 평가 시점: `NIGHT_RESULT` 직후 + `EXECUTION` 직후 (`mafia-app-context.md` §2)
  - 마피아=0 → CITIZEN 승
  - 마피아 수 ≥ 시민팀(POLICE+DOCTOR+CITIZEN) 수 → MAFIA 승
  - 어느 조건도 만족 X → 다음 페이즈 계속
- **Actual:** (어느 진영이 어느 시점에 충족했는지)
- **Pass/Fail/Blocked:**
- **Log keyword:** 클라 `gameOver` (다음 step 에서 수신). 서버 로그 `Game ... persisted (winner=...)`.
- **Screenshot/video:**
- **Bug ID:**

#### Step 24 — 게임 종료 (`gameOver` payload)
- **Device/User:** 4명 전원
- **Action:** 승리 조건 충족 시 자동
- **Expected:**
  - `gameOver { winnerTeam: 'CITIZEN'|'MAFIA', players: [{ userId, role, isWinner, finalAlive }×4] }` 룸 브로드캐스트
  - 서버: `Game/GamePlayer` Postgres INSERT (`$transaction`)
  - 메모리 게임 인스턴스 정리 + Room 상태 WAITING 복귀
- **Actual:**
- **Pass/Fail/Blocked:**
- **Log keyword:** 클라 `gameOver`. 서버 `Game ... persisted (winner=...)`.
- **Screenshot/video:**
- **Bug ID:**

#### Step 25 — 결과 화면 표시 (`game_over_pane`)
- **Device/User:** 4명 전원
- **Action:** Step 24 자동 진행
- **Expected:**
  - game_over_pane (또는 game_result_screen) 으로 라우팅
  - 승리 진영 / 본인 승패 / 4명 직업 공개 / 사망자 overlay
  - 카피는 자체 작성 (design-policy)
- **Actual:**
- **Pass/Fail/Blocked:**
- **Log keyword:** 클라 라우터 push `game_result_screen`.
- **Screenshot/video:**
- **Bug ID:**

#### Step 26 — 다시 홈/새 게임 동선
- **Device/User:** 4명 전원
- **Action:** 결과 화면에서 "홈으로" / "새 게임" 버튼 탭
- **Expected:**
  - `leaveRoom` ack `{ ok: true }` → 홈 화면 복귀
  - 또는 같은 방에서 WAITING 으로 재모집 (호스트 권한)
  - 재라우팅 후 크래시 없음, 메모리 정리됨
- **Actual:**
- **Pass/Fail/Blocked:**
- **Log keyword:** 서버 `leaveRoom` ack, `roomUpdated` 또는 방 삭제.
- **Screenshot/video:**
- **Bug ID:**

### 7. 재접속 & lifecycle

#### Step 27 — 소켓 끊고 60s 안에 재연결 (자리·역할 보존)
- **Device/User:** 임의 1명 (예: macOS-P3)
- **Action:** 게임 중간(예: NIGHT_MAFIA) 에 비행기모드/네트워크 차단 → 30s 내에 복구
- **Expected:**
  - 서버 disconnect 감지 → `WS disconnect (in-game grace)` 로그
  - GameRoomManager 가 grace 60s 타이머 시작, 멤버 유지
  - 재연결 시 같은 토큰으로 핸드셰이크 통과 → `WS reconnect` 로그
  - `reconnectSnapshot { phase, endsAt, players, myRole, myHouseId, chatHistory, voteState, nightProgress }` emit (본인만)
  - 자리·역할·집·생존 상태 유지, 진행 페이즈에 맞는 UI 복원
- **Actual:**
- **Pass/Fail/Blocked:**
- **Log keyword:** 서버 `WS disconnect (in-game grace)`, `WS reconnect`. 클라 `reconnectSnapshot`.
- **Screenshot/video:**
- **Bug ID:**

#### Step 28 — 60s 초과 재접속 (사망 처리)
- **Device/User:** 임의 1명 (시민·경찰·의사 중 하나로 — 마피아 1명 방에서 마피아가 죽으면 즉시 게임 종료)
- **Action:** 게임 중간에 네트워크 차단 → **70~90s** 후 복구
- **Expected:**
  - 60s 만료 시점에 서버 로그 `Player <userId> in room <roomId> died: reconnect grace expired (60000ms)`
  - 즉시 `checkWinCondition` 재평가 → 승부 결정 나면 `gameOver`
  - 승부 미결정이면 다음 NIGHT_DOCTOR/POLICE 가 사망 직업이면 다음 사이클에서 `phaseSkipped`
  - 재접속한 클라이언트는 `reconnectSnapshot` 수신 시 본인이 사망 상태로 표시
- **Actual:**
- **Pass/Fail/Blocked:**
- **Log keyword:** 서버 `reconnect grace expired`. 클라 `reconnectSnapshot` (isAlive=false), 또는 `gameOver`.
- **Screenshot/video:**
- **Bug ID:**

#### Step 29 — 앱 background / resume (lifecycle_notifier)
- **Device/User:** iOS-Host 또는 Android-P2
- **Action:** 게임 중 홈 버튼 → 70s 대기 → 앱 복귀
- **Expected:**
  - `MafiaApp` 의 lifecycle observer 가 60s 초과 백그라운드 감지 시 `LifecycleEvent.longBackgroundResume` emit
  - room_lobby_screen / game_play_screen 의 listener 가 방·게임 상태 정합성 점검 → 필요 시 재연결 트리거
  - 서버 측은 Step 27/28 와 동일 (이미 grace 만료된 케이스는 사망/방 이탈)
  - 60s 미만 백그라운드는 longBackgroundResume emit 없음, 자동 WS 재연결만
- **Actual:**
- **Pass/Fail/Blocked:**
- **Log keyword:** 클라 디버그 로그 `emit longBackgroundResume`.
- **Screenshot/video:**
- **Bug ID:**

---

## 핵심 step (Critical Path)

다음 step 이 1단계 종료 판정의 **mandatory pass** 항목:

| Step | 검증 항목 |
|---|---|
| 8 | 직업 배정 (개인별, 마피아끼리 식별) |
| 10 | DAY 진입 / 페이즈 머신 |
| 12 | VOTE_SELECT 실시간 voteCast |
| 14 | VOTE_CONFIRM 후보 자동 반대 1표 |
| 15 | executionResult reason 4종 |
| 17 | NIGHT_MAFIA 살해 룰 |
| 19 | NIGHT_RESULT 의사 보호·살해 정산 |
| 23 | 승리 조건 평가 시점 |
| 24 | gameOver payload + 영속화 |

## 1단계 종료 판정 기준

1. **Critical/Blocker BUG 0개**
   - Blocker = 게임 진행이 멈추거나, 서버 권위 룰 위반(부정 클라가 룰 위반 가능), 또는 4명 중 1명이라도 시뮬에서 크래시
   - Critical = 핵심 step 중 1개 이상 Fail
2. **핵심 step 9개 (8, 10, 12, 14, 15, 17, 19, 23, 24) 전부 Pass** — 명확한 Blocked 사유(예: 환경 이슈)는 별도 보고로 분리
3. **전체 step 29개 중 Pass 비율 ≥ 90%** (= 26 Pass 이상)
4. 재접속·lifecycle (Step 27/28/29) 중 1개 이상은 Pass — 1단계 결승선 외이지만 출시 직전 4단계에 필요해 기본 검증 포함

## 보고 양식 (Agent C → Agent F)

```
✅ 진행: <전체 step Pass/Fail/Blocked 카운트>
⚠️ 발견 버그: <BUG-QA-### 목록 + 1줄 요약>
❓ 결정 필요: <스펙 모호로 판단 보류한 step 번호>
🧪 영속화: Game/GamePlayer INSERT 확인 (gameId=...)
```

## 종료 게이트 연결

> 핵심 9 Step 모두 Pass → `docs/release-readiness.md` 의 "§7 1단계 MVP 종료 게이트" 섹션 체크박스 갱신 → "1단계 MVP 종료" 선언 가능.

## 갱신 이력

- 2026-05-13: 최초 작성 (S-qa-full-cycle-checklist). 코드 grep 기반 이벤트명/로그 키워드 매핑.
- 2026-05-13: 핵심 9 step 압축본 → 사용자 GUI 풀사이클 실측 기록표(9컬럼)로 강화. 결과 요약 템플릿 + Fail 보고 양식(BUG-S1-NNN) 섹션 추가. mobile-qa-log-template.md 연결 한 줄 추가. 기존 29 step 풀 체크리스트는 유지.
- 2026-05-14: 종료 게이트 연결 한 줄 추가 — `release-readiness.md §7` 1단계 MVP 종료 게이트로 분기.
