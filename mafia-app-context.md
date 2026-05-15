# 모바일 도트 마피아 앱 — Claude Code 작업 컨텍스트

> **반드시 함께 읽기:** [`mafia-app-design-policy.md`](./mafia-app-design-policy.md)
> — 기존 게임의 UI/리소스/명칭/카피를 복제하지 않고 일반 룰만 참고한다는
> IP·표절 방지 정책. 코드·UI·문구·명칭을 생성하기 전에 항상 점검.

## 0. 제품 정의 (가장 중요)
이건 웹 게임이 아니라 **iOS + Android 스토어에 출시할 네이티브 모바일 앱**이다.

- 빌드 산출물: `.ipa` (iOS) + `.apk`/`.aab` (Android)
- 배포: App Store + Google Play
- 앱 레벨 요구: 회원가입/로그인, 푸시 알림, 인앱결제(추후), 딥링크, 앱 아이콘/스플래시, 권한 처리(네트워크), 기기 토큰 관리
- 오프라인 처리: 네트워크 끊김 시 재접속·재참가 로직 포함

### 0-1. 개발 환경 제약 (스코프 결정의 전제)
- **인력:** 1인 개발, 디자이너 없음
- **에셋:** 무료 픽셀 아트 팩(Kenney, LPC)을 1차 베이스. 폴더는 `client/assets/sprites/`만 잡아두고 구체 파일명은 0단계 셋업에서 확정. 자체 도트 작화는 후순위
- **UI 시스템:** Flutter **Material 3 + 다크 테마**(`useMaterial3: true`, `ColorScheme.fromSeed(brightness: dark)`). 커스텀 디자인 시스템 도입 금지
- **클라이언트 스택 확정:** Flutter + Flame (Unity는 후순위 옵션)
- **개발 OS:** **macOS** (iOS 빌드 필수 요건). 시뮬레이터는 iOS Simulator + Android Emulator 둘 다 사용. iOS는 **Xcode**, Android는 **Android Studio**. 로컬 백엔드는 **Docker Compose**로 Postgres + NestJS 컨테이너 띄움(루트 `docker-compose.yml`)
- **동접 가정:** **≤100명**(1단계 단일 NestJS 인스턴스 한 대로 충분한 부하)
- **인증(1단계):** **게스트 로그인 — 닉네임만 입력** + 서버가 **익명 JWT**(`sub=guestUserId`, `kind="guest"`) 발급. 이메일/비밀번호/이메일 검증·소셜 로그인은 **4단계 이후** 도입
- **인프라(1단계):** **단일 NestJS 인스턴스 + 인메모리 `Map<roomId, RoomState>`**. `RoomStore` 인터페이스로 추상화하되 1단계에는 **Redis 의존성 자체를 추가하지 않음**(`ioredis`, `@socket.io/redis-adapter` 미포함). 수평 확장 시 Redis 어댑터 구현체 추가.
- **클라이언트 UI 규약 (M4 갱신 — 1단계 → 2단계 점프 확정):**
  - 1단계 초기 가정 "Material 위젯만" 은 1단계 MVP (M1~M3) 동안 유지됐다. M4 부터 사용자 폰 테스트 결과 비주얼 퀄리티 요구 + 카드형 UI 의 사용자 경험 한계로 **Flame 게임 씬 통합을 1단계 종료 전 (M5) 에 앞당겨 진행** 한다.
  - 로비는 이미 Flame 으로 이행 완료 (M3-flame). 게임 화면은 M5 에서 Flame 일원화 + 카드형 fallback (`game_screen.dart:_useFlameView()` 분기) 완전 제거.
  - VOTE_DEFENSE 단상 / VOTE_OX 광장은 M6 에서 Flame 컴포넌트로 구현.
  - 캐릭터·맵·UI 디테일은 M7 비주얼 퀄리티 패스. **AI 픽셀아트 + Kenney/Puny CC0 + CustomPaint 자체 작화 혼합** (M7 갱신 — 외부 무료 에셋 출처 기록 정책 폐기, AI 생성 허용).
  - 단 서버 이벤트 명세는 §5 와 §3 그대로 — 클라 UI 만 교체.

- **인게임 고정 레이아웃 영역 (M7 갱신 — 모든 인게임 라우트 공통):**
  - 다음 3개 영역은 **모든 페이즈 (DAY_DISCUSSION / VOTE_SELECT / VOTE_DEFENSE / VOTE_OX / EXECUTION / NIGHT_*) 에서 동일 위치·크기·스타일** 로 노출. 페이즈별로 사라지거나 위치 이동 X.
    1. **조이스틱** — 화면 좌측 하단 고정. 가상 조이스틱 (Flame). 시민 밤 풀스크린 모드에서만 미노출.
    2. **채팅 영역** — 화면 상단~중앙 좌측 fading toast (지난 슬라이스 `lobby_chat_toast_layer.dart` 정책 — 5s 그룹 fade) + 우측 하단 chat FAB → 탭 시 하단 input row.
    3. **아이콘 영역** — 우측 세로 stack (지난 슬라이스 `lobby_action_stack.dart` — `PixelRoundIconButton` size 52). 봇 추가 (호스트+dev) / 참가자 / 채팅 토글 등 인게임 액션 버튼. 호스트 액션 (시작 등) 만 페이즈에 따라 조건부 노출.
  - 페이즈별로 바뀌는 건 **광장 위 콘텐츠** — 캐릭터 위치·인디케이터, 집 sprite tap 동작, 단상·O/X 영역 placeholder, 처형 결과 모달.
  - 키보드 등장 시 채팅 input 만 viewInsets 만큼 위로, 조이스틱·아이콘 영역은 그대로.
- **MVP 스코프 잠금:**
  - 1단계 MVP에서 **캐릭터 꾸미기·푸시 알림·인앱결제 전부 제외**
  - **`CharacterLoadout`, `Item`, `PlayerProfile`, `GamePlayer.characterSkin`, `updateCharacterLoadout`, `syncCharacterAppearance` 등 꾸미기 관련 모델·필드·이벤트도 1단계 Prisma 스키마/WS 이벤트 명세에서 완전 제거** → 3단계(프로필/꾸미기)에서 재도입
  - MVP는 **게임 루프(방→직업·집 배정→낮/3페이즈 밤→투표→승패) 검증**에만 집중
  - 도트 게임 뷰 통합은 2단계, 꾸미기는 3단계, 푸시/크래시·분석은 4단계, IAP는 5단계

## 1. 앱 개요
모바일 앱으로 동작하는 **도트 그래픽 기반 실시간 소셜 추리(마피아) 게임**. 어몽어스류 + 모바일 가상 조이스틱 + 도트 RPG 커스터마이징.

## 2. 게임 규칙 요약
**직업:** 시민 / 경찰 / 의사 / 마피아 (서버 권위 랜덤 배정, 마피아끼리만 서로 식별)

**1단계 인원:** **4~8명 고정** (9~15명은 베타 이후 오픈)

**인원별 직업 구성:**
- **4명:** 마피아 1, 경찰 1, 의사 1, 시민 1
- **5명:** 마피아 1, 경찰 1, 의사 1, 시민 2
- **6명:** 마피아 2, 경찰 1, 의사 1, 시민 2
- **7명:** 마피아 2, 경찰 1, 의사 1, 시민 3
- **8명:** 마피아 2, 경찰 1, 의사 1, 시민 4

**낮(`DAY_DISCUSSION`):** 광장에서만 이동·전체 채팅·토론. 능력 사용 불가. 집 출입 불가.

**밤(3페이즈 순차):**
1. **`NIGHT_DOCTOR` (30s)** — 의사만 마을 이동, 보호할 유저의 집에 진입. 자기 집 보호는 **첫 밤(`currentNightNumber === 1`)만 허용**, 2번째 밤부터 타인만 보호 가능. 그 외 직업은 자기 집 내부 화면.
2. **`NIGHT_MAFIA` (30s)** — 마피아만 마을 이동 + 마피아 전용 채팅. 마피아끼리는 서로 보임. 살해 룰:
   - 마피아 2명이 **같은 집** 진입 → 그 집 유저 살해
   - 마피아 2명이 **다른 집** 진입 → 둘 중 **무작위 1명**의 타겟이 살해
   - 마피아 1명 구성(4~5명 방) → 진입한 집의 유저가 살해 타겟
3. **`NIGHT_POLICE` (30s)** — 경찰만 마을 이동, 조사할 집 진입. 결과(마피아 여부)는 **본인에게만** 표시.
4. **`NIGHT_RESULT` (5s)** — 의사 보호 == 마피아 타겟이면 사망 무효. 사망자 공개.

**페이즈 공통 규칙:**
- 행동 직업이 집에 진입하면 **해당 페이즈가 끝날 때까지 집에서 못 나옴**. 페이즈 종료 시 자동 리셋(전원 자기 집으로 이동).
- 시야: **행동 직업만 마을 시야**, 나머지는 자기 집 안만 보임. 마피아끼리는 서로 식별 가능.
- 시민(밤 행동 없음)의 화면: LPC 인테리어 도트 1종 재사용 + 풍경음 + 랜덤 노크(분위기용, **실제 방문과 무관, 정보 노출 X**) + "마을이 조용합니다…" 카피.

**투표 3단계(`VOTE_SELECT` 30s → `VOTE_DEFENSE` 20s → `VOTE_OX` 15s):** 1차 최다 득표 → 처형 후보 (동률·전원 기권 시 두 페이즈 모두 스킵) → 후보 단상 최후 변론 → O/X 광장 다수결 (O 과반 시 처형). 처형 결과는 `EXECUTION` 페이즈에서 정체(마피아 여부) 공개.

**승리 조건:** 시민팀(마피아=0) / 마피아팀(마피아 수 ≥ 시민팀 수). `NIGHT_RESULT` 직후와 `EXECUTION` 직후 평가.

## 3. 게임 상태 머신

> **M4 갱신 (2026-05-14):** 기존 `VOTE_CONFIRM` (Material 찬반 버튼) 을 폐기하고
> **광장 픽셀 단계** 두 페이즈 — `VOTE_DEFENSE` (단상 변론) + `VOTE_OX` (O/X 영역 이동 = 찬반 표시) — 로 대체. 메커니즘은 동일 (다수결 후 후보 1명 최후 변론 + 찬반 다수결), 표현이 카드형 → Flame 픽셀 단계.

```
WAITING
  └─▶ READY_CHECK
        └─▶ ROLE_ASSIGN_AND_HOUSING        (직업 배정 + 집 슬롯 랜덤 매핑, 원자적)
              └─▶ DAY_DISCUSSION (120s)
                    └─▶ VOTE_SELECT (30s)
                          └─▶ VOTE_DEFENSE (20s) | (후보 없음 시 둘 다 스킵)
                                └─▶ VOTE_OX (15s)
                                      └─▶ EXECUTION (3s) → (승패 평가)
                                            └─▶ NIGHT_DOCTOR (30s)
                                                  └─▶ NIGHT_MAFIA (30s)
                                                        └─▶ NIGHT_POLICE (30s)
                                                              └─▶ NIGHT_RESULT (5s) → (승패 평가)
                                                                    └─▶ DAY_DISCUSSION 루프
                                                                          │
                                                                          └─▶ GAME_OVER
```
모든 페이즈 전이는 **서버 타이머 만료** 또는 **모든 행동 완료** 중 먼저 도달한 쪽에서 발생. `currentNightNumber`는 첫 `NIGHT_DOCTOR` 진입 시 1로 시작, 매 밤 사이클 시작마다 +1.

- **`VOTE_DEFENSE` (20s)** — `VOTE_SELECT` 다수결로 뽑힌 후보 1명이 단상에 자동 등장, 최후 변론 시간. 후보 외 유저는 광장에서 관전 + 광장 채팅 가능. 후보가 사망(disconnect grace 만료) 시 페이즈 스킵.
- **`VOTE_OX` (15s)** — 광장 한쪽에 **O 영역(찬성)** + **X 영역(반대)** 마커. 살아있는 유저(후보 제외)가 캐릭터를 영역으로 이동 = 찬반 표시. 후보는 자동으로 X 영역 (자기 처형 자동 반대 1표, §8-1 룰 유지). 페이즈 종료 시 영역 인원 집계, **O ≥ 과반 시 처형**.
- **`EXECUTION` (3s)** — 결과 카피 + 처형 시 정체 공개 (`revealedAsMafia`).

## 4. 핵심 데이터 모델

### 4-1. Postgres (영속) — 1단계
- `User(id, guestNickname, createdAt)` — 게스트 계정
- `Room(id, code, hostUserId, status, maxPlayers, settings, createdAt)`
- `Game(id, roomId, winnerTeam, startedAt, endedAt)` — 한 판 기록(완료 시 INSERT)
- `GamePlayer(gameId, userId, role, finalAlive, isWinner)` — 한 판 내 참가자 최종 결과

### 4-2. In-memory `RoomState` (1단계 `InMemoryRoomStore`)
서버 재시작 시 진행 중 게임은 종료 처리(1단계 허용).
- `RoomState(roomId, hostUserId, status, settings, members[], activeGame?)`
- `ActiveGame { gameId, currentPhase, currentNightNumber, phaseEndsAt, players[], houses[], votes, nightActions, chatLog }`
- `ActivePlayer(userId, role, isAlive, houseId, lastSeenAt, disconnectedAt?)`
- `House(id, roomId, slotIndex, position{x,y}, interiorAssetId, ownerUserId?)` — 방마다 8개 슬롯 고정
- `NightActions { doctorTargetHouseId?, mafiaTargetHouseIds: Map<mafiaUserId, houseId>, policeTargetHouseId? }`

### 4-3. 3단계(꾸미기) 도입 예정 — 1단계 스키마/메모리에서 완전 제외
- `PlayerProfile`
- `CharacterLoadout(hair/face/top/bottom/shoes/weapon/pet/effect)`
- `Item(type, rarity, assetPath)`
- `GamePlayer.characterSkin`

## 5. 핵심 WebSocket 이벤트

**1단계 범위:**
- **방 라이프사이클:** `createRoom` / `joinRoom` / `leaveRoom` / `kickPlayer` / `playerReady` / `startGame`
- **게임 시작 시 (원자적):** `assignRoles`(개인별 emit, 마피아 식별 정보 포함) / `housesAssigned`(전체에 `playerId → houseId` 매핑 브로드캐스트)
- **페이즈 진행:** `phaseChanged({ phase, endsAt, nightNumber?, defendantUserId? })` — `DAY_DISCUSSION` / `VOTE_SELECT` / `VOTE_DEFENSE` / `VOTE_OX` / `EXECUTION` / `NIGHT_DOCTOR` / `NIGHT_MAFIA` / `NIGHT_POLICE` / `NIGHT_RESULT`. `defendantUserId` 는 `VOTE_DEFENSE`·`VOTE_OX` 진입 시 동봉 (M4 추가).
- **결과:** `executionResult({ reason, victimUserId, revealedAsMafia? })` / `nightResult` / `gameOver`. `revealedAsMafia` 는 `reason: 'majority'` 일 때만 정의 — 자세히는 §8-1 5단계 추가 확정 참조.
- **광장 채팅(낮):** `sendChatMessage` (전체) / `chatMessage`
- **마피아 채팅(`NIGHT_MAFIA`만):** `sendMafiaChat` (마피아 한정) / `mafiaChat`
- **밤 집 진입:** `enterHouse({ houseId })` — 해당 페이즈의 행동 직업만 허용, 페이즈 종료까지 락. 응답: `houseEntered({ actorId, houseId })` — **페이즈 행동 직업에게만 브로드캐스트**(시민 수신 X). 마피아 페이즈에서는 마피아 전원에게만.
- **투표 (M4 갱신):**
  - `selectVoteTarget({ targetUserId })` — `VOTE_SELECT` 페이즈에서 후보 지목. 변경 가능 (마지막 표만 집계).
  - `stepIntoOxArea({ side: 'O' | 'X' | null })` — `VOTE_OX` 페이즈에서 영역 이동. `null` 은 영역 밖(기권). 후보 본인 호출은 무시. 변경 가능 (마지막 위치만 집계).
  - 브로드캐스트: `voteCast({ voterUserId, targetUserId | null })` (SELECT) / `oxAreaUpdate({ voterUserId, side: 'O' | 'X' | null })` (OX) — 실시간 관전.
- **경찰 조사 결과:** `policeResult({ targetUserId, isMafia })` — 경찰 본인에게만 직접 emit
- **재접속:** `reconnectSnapshot({ phase, endsAt, players, myRole, myHouseId, chatHistory, voteState, nightProgress, defendantUserId? })`

**2단계(도트 뷰) 도입:** `playerMove` / `playerPositionUpdate`
**3단계(꾸미기) 도입:** `updateCharacterLoadout` / `syncCharacterAppearance`

### 5-1. 방 / 인원 / 타이머 설정 (1단계)

- **방 코드:** **6자리 대문자 알파벳, O와 I 제외** (A,B,C,D,E,F,G,H,J,K,L,M,N,P,Q,R,S,T,U,V,W,X,Y,Z — 24자). 예: `AKNPRT`. **충돌 시 단순 재시도 최대 3회, 그래도 실패하면 HTTP 500** (24^6 ≈ 1.9억 풀이라 사실상 발생 X, 안전망용).
- **방 인원:** 4 ≤ players ≤ 8. 9~15는 베타 이후 오픈(`Room.maxPlayers` 화이트리스트로 차단).
- **재접속 보존:** 끊김 후 **60초 이내 같은 토큰으로 재연결** 시 자리·역할 보존. 초과 시 **사망 처리**(`isAlive=false`) 후 페이즈에 따라 즉시 승패 재평가.
- **타이머 기본값(모두 환경변수 + `Room.settings`로 오버라이드 가능):**
  | 페이즈 | 기본값 | env | settings 필드 |
  |---|---|---|---|
  | 낮 토론 | 120s | `GAME_DAY_DISCUSSION_SEC` | `dayDiscussionSec` |
  | 1차 투표 (VOTE_SELECT) | 30s | `GAME_VOTE_SELECT_SEC` | `voteSelectSec` |
  | 최후 변론 (VOTE_DEFENSE) | 20s | `GAME_VOTE_DEFENSE_SEC` | `voteDefenseSec` |
  | O/X 광장 (VOTE_OX) | 15s | `GAME_VOTE_OX_SEC` | `voteOxSec` |
  | 의사 페이즈 | 30s | `GAME_NIGHT_DOCTOR_SEC` | `nightDoctorSec` |
  | 마피아 페이즈 | 30s | `GAME_NIGHT_MAFIA_SEC` | `nightMafiaSec` |
  | 경찰 페이즈 | 30s | `GAME_NIGHT_POLICE_SEC` | `nightPoliceSec` |
  | 밤 결과 연출 | 5s | `GAME_NIGHT_RESULT_SEC` | `nightResultSec` |

  > M4 갱신: `voteConfirmSec` 폐기, `voteDefenseSec` + `voteOxSec` 신규. `EXECUTION` 페이즈 3s 는 고정 (§8-1 페이즈 단축 안내 프로토콜과 동일 정책).

### 5-1bis. 게임 시작 조건 (호스트 명시 `startGame`)

- 자동 시작 없음. 호스트가 `startGame` 이벤트를 명시적으로 호출해야 시작.
- **호스트의 시작 버튼 활성화 조건:** `players.length ≥ 4` **AND** `호스트를 제외한 전원이 ready=true`
- **호스트 본인은 준비 토글 불필요** — 호스트는 시작 권한자이므로 항상 ready로 간주
- `playerReady` 이벤트는 비호스트만 보냄. 호스트가 보내면 서버에서 무시(또는 400)

### 5-2. 집 시스템 (1단계)

- **맵(MVP):** 마을 맵 **1종**, **집 슬롯 8개 고정 배치 + 중앙 광장 1개**. 집 내부는 **인테리어 1종 재사용**.
- **집 배정:** `ROLE_ASSIGN_AND_HOUSING` 단계에서 서버가 **랜덤** 매핑. 모든 플레이어에게 `housesAssigned` 브로드캐스트(공개 정보).
- **이름표:** 집 위에 소유자 닉네임 표시 — **낮·밤 모두 공개**(메모리 게임이 아니라 마피아 게임이라).
- **낮 동작:** 집 출입 **불가**. 광장에서만 이동/토론/투표. 캐릭터는 광장 안에서 자유 이동(2단계 도트 뷰부터 시각화, 1단계는 텍스트 UI).
- **밤 동작:** §2 밤 시스템 규칙 적용. 행동 직업은 집 진입 후 페이즈 끝까지 락.
- **시야 / 권한 가드:** `enterHouse`는 서버에서 `actor.role`과 `currentPhase`로 검증. `houseEntered` 브로드캐스트 범위도 서버에서 결정(시민에게 누설 금지).

### 5-3. 서버 권위 5개 (변경 없음)
1. 직업 정보 노출(본인만, 마피아끼리는 식별)
2. 위치/집 진입 검증
3. 투표 집계
4. 밤 액션 결과(보호·살해·조사)
5. 채팅 라우팅(낮 전체, 밤 마피아끼리만)

### 5-4. 테스트 전략 (1단계)

**순수 함수 단위 테스트 필수** (M4 갱신: 4종 → 5종 — `tallyVotes` 가 1차만 다루고, OX 집계는 `tallyOxVotes` 로 분리. `pickDefendant` 신규.) — 게임 룰 회귀의 99%를 커버:

| 함수 | 검증 항목 |
|---|---|
| `assignRoles(playerCount: number) → Role[]` | 4~8명별 직업 구성 정확성, 랜덤 분포 sanity check(N회 호출 시 각 직업 비율) |
| `tallyVotes(votes: Vote[]) → VoteResult` | 1차 최다 득표 / 동률 시 처형 후보 없음 / 전원 기권 시 후보 없음. M4: 2차 찬반 케이스 제거 — `tallyOxVotes` 로 이관 |
| `pickDefendant(selectResult: VoteResult) → defendantUserId \| null` | 1차 결과를 받아 후보 1명 픽 (동률·기권 시 null). M4 신규 — `VOTE_DEFENSE` 페이즈 진입 시 호출 |
| `tallyOxVotes({ ox: Map<userId, 'O' \| 'X'>, defendantUserId, aliveUserIds }) → { executed: boolean }` | 후보 자기표 자동 X · O ≥ ⌈(aliveCount - 1) / 2⌉ + 1 시 처형 · 정확히 절반 = 부결 (기존 `tallyVotes` 의 2차 경계 룰 이관). M4 신규 |
| `resolveNightActions({ doctorTarget, mafiaTargets, policeTarget, nightNumber }) → NightResolution` | 의사 보호 == 마피아 합의 타겟이면 사망 무효 · 마피아 합의 시 그 집 사망 · 마피아 불일치 시 둘 중 **무작위 1명**의 타겟 사망 · 의사 자기 보호는 `nightNumber === 1`만 통과 |
| `checkWinCondition({ alivePlayers, roles }) → 'CITIZEN' \| 'MAFIA' \| null` | 마피아=0 → 시민 승 · 마피아 수 ≥ 시민팀 수 → 마피아 승 · 그 외 null |

**E2E 1개** (`test/game.e2e-spec.ts`): 방 생성 → 4명 입장 → 호스트 시작 → 직업·집 배정 → 낮 1턴(채팅) → 1차+2차 투표 → 밤 1턴(3페이즈) → 다음 낮 또는 게임 종료까지 **한 사이클**. Socket.IO 클라이언트 4개로 시뮬레이션.

추가 통합 테스트는 회귀 발견 시 그 케이스만 추가.

## 6. 추천 기술 스택 (모바일 앱 기준)

**서버:** NestJS + Socket.IO + PostgreSQL + Prisma
(Redis는 수평 확장 시점 도입 — 1단계는 인메모리 `RoomStore` 구현체로 시작, 인터페이스만 추상화)

**클라이언트 — 앱이라는 점을 고려한 비교:**

A안 — **Unity (1순위 추천)**
- iOS/Android 동일 빌드, 도트 2D + 실시간 통신 모두 강함
- 스토어 배포 워크플로 표준화
- 단점: 학습 곡선, 빌드 사이즈

B안 — **Flutter + Flame**
- 네이티브 앱 빌드, 도트 2D 게임 엔진(Flame) 내장
- UI(로비/마이페이지)와 게임뷰 통합이 깔끔
- 중간 난이도, 마피아 같은 가벼운 실시간 게임에 적합

C안 — **React Native + Phaser (WebView)**
- 빠른 프로토타입은 가능하나, Phaser가 WebView 안에서 도는 구조 → 성능·앱 심사 리스크
- **앱으로 출시한다면 권장도 낮음**

→ **결론: Unity 1순위, Flutter+Flame 2순위. React Native+Phaser는 앱 배포 시 비추.**

## 7. MVP 단계 (앱 기준)

**0단계 — 앱 골격**
프로젝트 셋업(Unity 또는 Flutter) · 앱 아이콘/스플래시 · 라우팅 · 환경변수 · API 클라이언트 · 소켓 클라이언트 · 디버그 빌드(iOS 시뮬레이터 + Android 에뮬레이터) 동작 확인

**1단계 — 서버 게임 루프 + 앱 텍스트 UI (MVP)**
회원가입/로그인 화면 · 로비 · 방 생성/참가 · 직업 배정 · 낮/밤 타이머 · 채팅 · 투표 · 승패 판정 (캐릭터 이동 없이 텍스트/리스트 UI로 먼저 검증)
**이 단계에서 제외:** 캐릭터 꾸미기, 푸시 알림, 인앱결제, 도트 게임 뷰. Flutter Material 위젯만 사용.

**2단계 — 도트 게임 뷰 통합**
2D 도트 맵 · 가상 조이스틱 · 이동 · 위치 동기화 · 충돌/애니메이션. 앱 내 게임 씬(Unity Scene 또는 Flame GameWidget)으로 통합.

**3단계 — 프로필/꾸미기**
마이페이지 · 캐릭터 미리보기 · 헤어/의상/무기/펫 장착 · 인게임 반영

**4단계 — 앱 출시 준비**
푸시 알림(FCM/APNs) · 크래시 리포팅(Sentry/Firebase Crashlytics) · 분석(Firebase Analytics) · 스토어 메타데이터 · TestFlight/Internal Testing 배포

**5단계 — 수익화/확장**
인앱결제 · 이벤트 룩 · 한정 의상 · 인벤토리 · 시즌 보상

## 8. 서버 폴더 구조
```
src/
  auth/  users/  rooms/  chat/  character/  items/  profiles/  common/
  game/
    game.gateway.ts
    game-room.manager.ts
    game-state.machine.ts
    role.service.ts
    vote.service.ts
    night-action.service.ts
    win-condition.service.ts
```

## 8-1. 4단계 확정 룰 (5개 + 2 보강)

1. **OX 광장에서 처형 후보의 자기 영역 이동** (M4 갱신 — `VOTE_CONFIRM` → `VOTE_OX` 이행)
   - 후보 본인의 캐릭터는 `VOTE_OX` 진입 시 **자동으로 X 영역(반대)에 배치**되며 영역 이동 불가 (서버 권위). 클라 화면에는 `"당신이 후보입니다 — 변론 후 광장의 결정을 기다리세요"` 카피 표시.
   - 서버는 후보의 `stepIntoOxArea` 호출을 무시(또는 400). 후보의 자동 X 표는 `tallyOxVotes` 의 pre-count.
2. **VOTE_SELECT 무표:** 기권으로 집계. 동률·전원 기권 시 처형 후보 없음 → 바로 `NIGHT_DOCTOR`
3. **마피아 1명 생존:** 그 1명의 타겟이 살해 후보
4. **의사 사망 시 NIGHT_DOCTOR 단축** — 즉시 0초 단축이 아니라 **`phaseSkipped` 안내 메시지 + 3초 노출 후** `NIGHT_MAFIA`로 전환. 카피: `"의사가 사망하여 의사 페이즈가 생략됩니다 (3초 후 마피아 페이즈)"`
5. **경찰 사망 시 NIGHT_POLICE 단축** — 동일 방식. 카피: `"경찰이 사망하여 경찰 페이즈가 생략됩니다 (3초 후 밤 결과)"`

**5단계 추가 확정**
- **VOTE_SELECT 풀 공개:** `voteCast { voterUserId, targetUserId }`로 누가 누구에게 투표했는지 실시간 전체 브로드캐스트. 마피아 게임 추리의 핵심 정보(투표 패턴)이므로 1단계부터 공개. 옵션화(공개/익명)는 4단계 베타 피드백 후 검토.
- **VOTE_OX 풀 공개 (M4 추가):** `oxAreaUpdate { voterUserId, side: 'O' | 'X' | null }` 로 누가 어느 영역에 있는지 실시간 전체 브로드캐스트. 캐릭터 위치 자체가 시각적 표시.
- **투표 변경 정책:** VOTE_SELECT / VOTE_OX 시간 내 횟수 제한 없이 변경 가능. 서버는 **마지막 표 (또는 마지막 영역) 만 집계**. 변경 시마다 `voteCast` / `oxAreaUpdate` 재발행(`targetUserId: null` 또는 `side: null` = 표 취소·기권).
- **`executionResult`는 항상 emit:** EXECUTION 페이즈(3s) 진입 시 1회. reason 필드로 사유 구분 + `revealedAsMafia` 로 정체 공개 (처형 시에만 정의).
  - `reason: 'tie'` — 1차 동률, 후보 없음 → `revealedAsMafia` 미정의
  - `reason: 'no_votes'` — 1차 전원 기권 → `revealedAsMafia` 미정의
  - `reason: 'majority'` — OX 광장 O 과반 → 처형 → `revealedAsMafia: true | false` (처형 대상자의 마피아 여부)
  - `reason: 'no_majority'` — OX 광장 O 부족 → 미처형 → `revealedAsMafia` 미정의
- **처형 결과 카피 (자체 작성, M4 — design-policy §2 자가검증 통과):**
  - 처형 + 마피아: `"OOO님은 마피아입니다."`
  - 처형 + 시민팀(시민/경찰/의사): `"OOO님은 마피아가 아닙니다."`
  - 미처형 (no_majority): `"광장의 결정 — 처형하지 않습니다."`
  - 후보 없음 (tie / no_votes): `"광장이 누구도 지목하지 못했습니다."`
- **정체 공개 범위 (M4 확정):** **마피아 여부만** 공개 (boolean). 처형 대상의 세부 직업(경찰·의사 등) 은 공개하지 않음 — 추리 게임성·design-policy §2 hard-no (Town of Salem 류 직업 공개) 회피.
- VOTE_SELECT에서 후보가 안 나오면 VOTE_DEFENSE + VOTE_OX 두 페이즈 모두 스킵, 바로 EXECUTION(3s)으로 이동 → NIGHT_DOCTOR. EXECUTION은 **항상 실행**되어 UX 리듬을 유지.
- **VOTE_DEFENSE 진입 시 후보 disconnect (60s grace 만료) 처리:** 후보 자동 사망 → DEFENSE + OX 두 페이즈 즉시 스킵 → EXECUTION 으로 이동, `reason: 'no_majority'` + `revealedAsMafia` 미정의. 카피: `"후보가 자리를 비워 광장의 결정이 무산됩니다."`

**7단계 추가 확정 — 레포 구조 / 환경변수 / OS 가정**
- **레포 구조: 단일 디렉터리 + 두 폴더 + 루트 docker-compose.yml**
  ```
  mafia-app/
    server/          # NestJS
    client/          # Flutter
    docker-compose.yml   # postgres + (선택, 1단계 비포함) redis
    .env.example         # 루트 단일 (개발용 통합 예시)
    README.md
    .gitignore
  ```
- **환경변수 관리(1단계):**
  - 루트 `.env.example` 1개 — 모든 키의 예시 모음(읽기용)
  - 서버 `server/.env` — `docker-compose`가 server 컨테이너에 주입
  - 클라이언트(Flutter) — `--dart-define=API_BASE_URL=...` 또는 `flutter_dotenv` 1택. 1단계 추천 **`--dart-define`** (런타임 의존성 0, 빌드 시 주입)
  - 공통 키 동기화 도구는 1단계 불필요
- **OS 가정: macOS** (Xcode + iOS Simulator + Android Studio + Android Emulator + Docker Desktop 전제). Windows/Linux 사용자 분기는 8단계 가이드에 짧은 경고로만 포함 — **Windows에서는 iOS 빌드 불가** → Android 우선 워크플로 권장.

**6단계 추가 확정 — 클라 보일러플레이트 최소화 (1단계)**
- **Riverpod 코드 생성 미사용:** `flutter_riverpod`만 추가, `riverpod_annotation` + `build_runner` 미사용. 수동 `Provider` / `NotifierProvider` / `StateProvider` / `StreamProvider` 선언만 사용. 코드 생성 도입은 2~3단계에서 상태 복잡도 증가 시 재검토.
- **go_router 단순 설정:** redirect 가드는 **"로그인 토큰 체크" 1개만**. 딥링크(예: `mafia://join/AKNPRT`)는 4단계 푸시·출시 준비와 묶어서 도입.

**페이즈 단축 안내 프로토콜**
- 서버: `phaseSkipped({ skipped, reason, nextPhase, noticeMs: 3000 })` emit
- 3초 동안 `currentPhase`는 스킵 대상 페이즈를 유지하되 **모든 행동 이벤트 거부**(`PHASE_SKIPPING` 에러 코드)
- 3초 후 정상 `phaseChanged({ phase: nextPhase, endsAt })` emit

## 9. 서버 권위 원칙
직업 배정·집 배정·집 진입 검증·투표 집계·밤 액션 결과·채팅 라우팅은 **전부 서버 권위**. 클라이언트는 입력만 전송.

---

## 10. Claude Code에게 보낼 최종 요청

> 너는 모바일 앱 + 멀티플레이어 게임 시니어 개발자이자 시스템 아키텍트다.
> 위 명세를 기반으로 **iOS/Android 네이티브 앱**으로 출시할 모바일 도트 마피아 게임을 MVP 중심으로 설계·구현하라.
>
> **이건 웹 게임이 아니라 앱이다.** 빌드 산출물은 `.ipa` + `.aab`이고, 스토어 배포가 최종 목표다. 따라서 앱 아이콘/스플래시/푸시 알림/크래시 리포팅/스토어 메타데이터까지 고려해서 단계를 잡아야 한다.
>
> 한 번에 전체를 만들지 말고 다음 순서로 작업하라:
>
> 1. 클라이언트 스택 확정 — Unity vs Flutter+Flame 비교 후 추천 (React Native+Phaser는 앱 배포 부적합으로 제외)
> 2. 전체 아키텍처 다이어그램 (앱 ↔ 서버 ↔ DB ↔ 실시간 흐름)
> 3. NestJS + Socket.IO + PostgreSQL + Prisma 서버 폴더 구조와 Prisma 스키마
> 4. 게임 상태 머신 구현 설계
> 5. WebSocket 이벤트 명세
> 6. 직업 배정 / 투표 / 밤 액션 / 승리 조건 로직
> 7. 클라이언트 화면 흐름 (스플래시 → 로그인 → 로비 → 방 → 게임 → 결과 → 마이페이지)
> 8. 0단계(앱 골격) 셋업 가이드 — 프로젝트 생성, 아이콘, 시뮬레이터 빌드까지
> 9. 1단계 MVP 구현 순서 (파일 단위 작업 리스트)
>
> 단계마다 동작하는 코드를 만들고, 각 단계 끝에서 멈춰 다음 단계 확인을 요청하라.
