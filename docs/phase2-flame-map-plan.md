# 2단계 — Flame 도트 마을 뷰 통합 설계

> 슬라이스 의도: **첫 슬라이스 설계서**.
> 실측 결과: 2단계 구현이 **이미 상당 부분 진행되어 있다.** `flame: ^1.37.0`
> 패키지 추가, `VillageGame`/`VillagePane`/`VillageOverlay`/`VillageGameRegistry`
> 4파일 골격, `Env.flameMode=true` 기본 ON, `playerMove`/`playerPositionUpdate`
> 서버·클라 양방향 송수신, 조이스틱·캐릭터 애니메이션·밤 오버레이까지 동작.
>
> 따라서 이 문서는 **"앞으로 만들 계획"이 아니라 "현재까지의 통합 형태를
> 캡처 + 잔여 갭 식별 + 정리 슬라이스 제안"** 의 성격을 갖는다. 디렉터가
> 1단계 결승선 종료 직후 2단계를 어떤 슬라이스로 쪼개 닫을지 결정할 수 있게
> 한다.
>
> 자체 작성. mafia-app-context.md §0-1, §7 2단계 항, design-policy §2 hard-no
> 6개와 정합.

---

## §1 현재 구조 요약 (실측)

### 1.1 게임 화면 라우팅

`game_screen.dart` 는 phase enum 으로 pane 을 switch 한다. `Env.flameMode`
플래그가 페이즈별로 적용 범위가 **불균일**하다 — 이게 잔여 갭의 핵심.

| phase | flameMode=true 분기 | flameMode=false 분기 |
|---|---|---|
| `DAY_DISCUSSION` | `DayPane` 내부에서 분기 (overlay) | `DayPane` Material |
| `VOTE_SELECT` | `VillageOverlay` | `VoteSelectPane` |
| `VOTE_CONFIRM` | `VillageOverlay` | `VoteConfirmPane` |
| `EXECUTION` | `VillageOverlay` | `ExecutionPane` |
| `NIGHT_*` | `NightPane` 내부에서 `VillageOverlay` | `NightPane` Material |
| `NIGHT_RESULT` | `VillageOverlay` | `NightResultPane` |
| `GAME_OVER` | 전용 `GameResultScreen` (flame 무관) | 동일 |

**관찰:** flameMode 분기점이 `game_screen`/`day_pane`/`night_pane` 세 군데에
흩어져 있다. 첫 정리 슬라이스 후보 — flameMode 분기를 한 곳으로 모으거나,
flameMode=true 가 영구 기본이라면 분기 자체를 제거한다.

### 1.2 상태 (GameState / GameNotifier)

- 페이즈·역할·집·플레이어·채팅·투표·밤액션 락은 1단계 그대로 유지.
- 2단계 신규 필드: `playerPositions: Map<userId, WorldPosition>` (선언만, 받기만).
- 2단계 신규 핸들러: `_onPlayerPositionUpdate` (서버 broadcast 수신).
- 2단계 신규 송신: `sendPlayerMove(x, y)` — `playerMove` ack emit + 10Hz throttle
  은 호출 측(`VillageGame.update`)에서 수행. ack 실패(`OUT_OF_ZONE` 등) 는 silent
  무시.
- design-policy §2-3 자체 카피 정책 충돌 없음.

### 1.3 Flame 폴더 (`features/game/flame/`)

| 파일 | 책임 |
|---|---|
| `village_game.dart` | `FlameGame` 본체. 마을 타일·집 8채·캐릭터·조이스틱·`NightOverlay`(밤 톤). 좌표 `worldSize=240`, 광장 80~160 clamp. 10Hz 송신 throttle. |
| `village_pane.dart` | Riverpod 브리지. `housesAssigned` + `players` + `members` → `VillageGameConfig` 빌드. `playerPositions` listen → `updateRemotePosition`. phase listen → `setPhaseMood`. |
| `village_overlay.dart` | 픽셀 RPG 톤 Stack — Top HUD(역할·페이즈·타이머·아이콘) + 중앙 `VillagePane` + 하단 페이즈별 패널(채팅·투표·밤 액션·결과). |
| `village_game_registry.dart` | 앱 lifecycle paused/resumed 일괄 pause/resumeEngine. `VillagePane.dispose` 에서 unregister. |

### 1.4 에셋 (pubspec.yaml + design-policy §2-2 자가검증)

- Kenney **Tinytown** 타일맵 (CC0): `assets/sprites/kenney/tinytown_tilemap.png`
- Kenney roguelike chars (CC0)
- 자체 빌드 decorations atlas + tinydungeon (CC0)
- Shade **"Puny Characters"** OpenGameArt (CC0) 32×32 8방향 5색 변주
- UI: 자체 RPG 톤 wood/gold 프레임 (`assets/ui_rpg/`)
- 폰트: **Galmuri11** (한국어 픽셀 폰트, 자체 라이선스 확인 필요)

**design-policy §2 hard-no 점검:**

- ✅ Among Us / Town of Salem 에 채용된 흔적 없는 무료 팩 — 1차 통과.
- ⚠️ 캐릭터 비례: 32×32 chibi 8방향, Among Us 풍 우주복(긴 다리+둥근 헬멧) 과
  명확히 다른 RPG 4등신. OK.
- ⚠️ `assets/sprites/decorations/roguelike_rpg_sheet.png` — 원본 출처가 pubspec
  주석에 없음. **CREDITS 파일 신설 의무 (4단계 출시 준비 항목)** — 지금은 회색
  지대 기록만.
- ⚠️ Galmuri11 폰트 — OFL 라이선스 (자유 사용·재배포 OK, 저작자 표기 권장).
  CREDITS 등재 후보.

---

## §2 Flame view 통합 위치 — 선택된 옵션

세 옵션 중 **B (Flame 배경 + 페이즈 패널 오버레이)** 가 현재 채택돼 있다.
사후 정리.

| 옵션 | 설명 | 채택 여부 | 사유 |
|---|---|---|---|
| A. Flame 풀스크린, Material 은 모달 | 도트 몰입 최대, 입력 충돌 위험 | ✗ | 채팅 IME 와 충돌 |
| **B. Flame 배경 + 상하 HUD 오버레이** | 광장 캐릭터는 늘 보이고 하단에 페이즈 패널 stack | **✓** | 채팅·투표·밤 액션을 Material 로 안정 처리하면서 도트 뷰 유지 |
| C. 페이즈별 Flame ↔ Material 토글 | 낮만 Flame, 밤은 Material | ✗ | 페이즈 전환마다 게임 인스턴스 재생성 → 비용 큼 |

**결정:** B 유지. 단 `Env.flameMode=false` fallback 경로(C 와 유사한 1단계
Material 전용 UI) 는 디렉터 검증·문제 분기용으로 유지 가치 있음 → 1단계
결승선 이후에도 제거하지 말고 빌드 인자로 토글 가능하게 둔다.

---

## §3 페이즈와 Flame view 의 관계

`VillagePane._VillagePaneState` 가 두 가지를 listen 한다.

1. **`playerPositions` listen** — 위치 갱신마다 `game.updateRemotePosition(uid, x, y)`.
2. **`phase` listen** — `setPhaseMood(code)` 로 `NightOverlay` 의 alpha+tint 보간.
   - 낮(0): alpha=0, 투명
   - `NIGHT_DOCTOR`(1): 청록 #0C2A38 / α 0.45
   - `NIGHT_MAFIA`(2): 짙은 적 #200A0C / α 0.55
   - `NIGHT_POLICE`(3): 보라 #1A0C34 / α 0.45
   - `NIGHT_RESULT`(4): navy #050B22 / α 0.50

**현재 누락 / 잔여 갭:**

- 밤 비행동 직업(시민 등) 의 "자기 집 인테리어 1종" 화면 — mafia-app-context §2
  에서 명시한 시민 풍경음 + 랜덤 노크 + "마을이 조용합니다…" 카피는 **flameMode
  에서 아직 미구현.** 현재는 광장이 그대로 보이고 NightOverlay 만 덮인다.
  (mafia-app-context §5-2 시야 규칙 위반은 아님 — 서버가 위치/액션 정보를
  비행동 직업에게 안 보내므로 누설은 없지만, "자기 집 안만 보임" 의 UX 의도와는
  거리가 있다.)
- 의사 자기 보호 가드 (`nightNumber===1` 만 허용) 는 패널 칩 disabled 로 반영됨.
- 마피아끼리 식별: `mafiaAllies` 가 클라에 도달하지만 도트 뷰에서 동료 마피아
  를 색·아이콘으로 강조하는 표시 없음. 시트 변주가 userId 정렬 기반이라 마피아
  팀 단서가 시각적으로 드러나지 않음 — 정책 OK이나, 마피아 페이즈 UX 개선
  슬라이스에서 동료에게만 가시화하는 후속 작업 후보.
- 카메라: 광장 줌인/줌아웃 전환 없음. `viewfinder.visibleGameSize=240` 고정.
  2단계 UX polish 후보지만 결승선 외.

---

## §4 player / house / role 가시성 매핑

### 4.1 house assignment

서버 `housesAssigned` 페이로드 → `GameState.houses[].slotIndex / ownerUserId`.
`VillagePane._build` 가 `slotIndex 0~7` 을 8집 배치(원형 8각형, 반경 80)에 매핑.
이름표는 `TextComponent(fontSize: 6)` 로 집 머리 위 — **낮·밤 모두 공개**
(mafia-app-context §5-2 메모리 게임 회피 정책).

### 4.2 player position

- 초기 위치: 전원 광장 중앙 (`worldSize/2`).
- 본인 이동: 조이스틱 입력 → `_me.position` 갱신 → 10Hz throttle → `playerMove` emit.
- 타인 이동: 서버 broadcast `playerPositionUpdate` → `playerPositions[uid]` 갱신 →
  `setTargetPosition(target)` → `PlayerAvatar.update` 에서 lerp 보간.
- 사망: `players[].isAlive=false` 가 broadcast 되면 `markDead(uid)` → 캐릭터
  렌더가 desaturation + 빨간 X 마커.

### 4.3 시야 권한

서버 권위 그대로. 클라는 받은 데이터만 그린다 — 마피아 페이즈에 마피아 동료
좌표가 broadcast 되는지, 비행동 직업에게 좌표 broadcast 가 차단되는지는
**서버 `game-room.manager.ts` 의 `playerMove`/`playerPositionUpdate` 라우팅 규칙
이 진실의 원천**. 클라는 누설 위험 없음.

---

## §5 Socket event ↔ Flame component 연결

이미 구현됨. 요약 표.

| 서버 → 클라 이벤트 | Flame 반응 |
|---|---|
| `assignRoles` | (상태만 — 캐릭터 외형 변화 X. role 은 본인 HUD 에만 노출) |
| `housesAssigned` | `VillagePane._build` 가 8집 ownerNick 매핑 → 이름표 그림 |
| `phaseChanged` | `setPhaseMood(code)` → NightOverlay 알파/색 보간 |
| `houseEntered` | (현재 Flame view 에선 별도 애니메이션 X — 패널 락만) |
| `playerPositionUpdate` | `updateRemotePosition` → `PlayerAvatar.setTargetPosition` |
| `nightResult` (victim) | `players[victim].isAlive=false` → 다음 listen tick 에서 `markDead` |
| `executionResult` (majority) | 동일 markDead 경로 |

| 클라 → 서버 송신 | Flame 트리거 |
|---|---|
| `playerMove({x,y})` | 10Hz throttle, 본인 위치 변화 시 |
| `enterHouse({houseId})` | 하단 night 패널 칩 탭 (Flame 외, Material) |
| `selectVoteTarget` / `confirmExecutionVote` | 하단 vote 패널 (Material) |
| `sendChatMessage` / `sendMafiaChat` | 하단 채팅 input (Material) |

**갭:** `houseEntered` 수신 시 캐릭터가 해당 집으로 짧게 이동하는 애니메이션
없음. 현재 본인은 lock 후 광장에 그대로 서 있고 타인은 좌표 broadcast 가
끊겨도 마지막 좌표에 머문다. UX 개선 후보 — 다음 슬라이스.

---

## §6 첫 정리 슬라이스 범위 — **이미 구현된 상태 기준 재정의**

원 컨텍스트의 `S-client-flame-static-map` (패키지 추가 + static map + house +
카메라) 는 **이미 완료된 작업.** 따라서 첫 슬라이스는 "추가 구현" 이 아니라
"하드닝 + 갭 정리" 로 재정의한다.

### S-client-flame-cleanup (제안, 0.5~1일)

1. `Env.flameMode` 분기 3곳(`game_screen` / `day_pane` / `night_pane`)을 한 곳으로
   모으거나, flameMode=true 가 1단계 결승선 이후 영구 기본이면 false 분기를
   조용히 deprecate (단, 빌드 인자로는 살려둔다).
2. `client/assets/CREDITS.md` 신설 — Kenney Tinytown / Shade Puny Characters /
   decorations atlas 출처·라이선스 한 줄씩. design-policy §3-5 의무. (4단계 정식
   화 전까지 임시 형태로 OK.)
3. 시민(밤 비행동) 의 "자기 집 인테리어" 화면 — flameMode 에서 광장 대신 단색
   배경 + "마을이 조용합니다…" 카피로 fallback. (인테리어 1종 sprite 가 무료
   에셋에 있으면 사용, 없으면 자체 작화는 후속 슬라이스.)
4. `houseEntered` 수신 시 본인 캐릭터를 해당 house pos 로 이동 애니메이션 1초
   (조이스틱 비활성).

**이건 묻기 영역이 섞여 있다** — 시민 인테리어 표현 결정은 룰/UX 영향이 있고
3번은 design-policy §2-1(기존 게임 UI 복사) 자가검증 통과 필요. 따라서
디렉터 결정 후 진행.

### S-server-player-move-guard (제안, Instance A, 0.5일)

서버측 `playerMove` 가드를 한 번 더 점검:
- 행동 페이즈에 비행동 직업의 좌표 broadcast 차단 (시야 누설 방지).
- 사망자의 `playerMove` ack 거부.
- 광장 zone (`movement-zone.ts`) 클램프 일관성 — 클라 80~160 clamp 와 일치하는지.

(이미 통과한다면 슬라이스 자체 불필요. 회색 — 백엔드 인스턴스가 spec 읽고
판단.)

### S-client-flame-night-immersion (제안, 1일, 후속)

- 카메라 줌: 행동 직업 페이즈에 마을 전체, 시민에겐 자기 집 줌인.
- 마피아 동료 마커 (마피아 페이즈에만 본인에게 표시).
- 의사 보호 / 경찰 조사 결과의 mini-animation.

---

## §7 위험 요소

1. **Flame 학습 곡선 / 유지 보수** — `village_game.dart` 가 569줄로 1파일에
   집중돼 있어 변경 시 회귀 가능성 큼. 정리 슬라이스에서 컴포넌트 단위 분리
   가치는 있으나 결승선 직전이라면 미루는 게 합리적.
2. **iOS/Android 성능** — 240×240 world 에 16×16 tile 225개 + 데코 ~20개 +
   캐릭터 4명. 단순 SpriteComponent 로 priority 정렬만 — 60fps 마진은 충분
   추정. 4명 실기기 테스트 필수.
3. **에셋 IP 검증** — Kenney / OpenGameArt CC0 팩들이 Among Us / Town of Salem
   에 직접 채용된 흔적 1차 검색 X. 그러나 출처 기록(`CREDITS.md`) 부재 →
   하드닝 슬라이스 의무.
4. **socket 이벤트 호환성** — `playerMove`/`playerPositionUpdate` 는 1단계
   서버에도 이미 포함됨. flameMode=false 와 flameMode=true 가 동일 서버에서
   동작 OK. **인터페이스 잠금 유지** — 페이로드 변경은 묻기 영역.
5. **백그라운드 lifecycle** — `villageGameRegistryProvider` 로 paused/resumed
   처리 중. iOS 백그라운드 시 WS 끊김은 별도 — 4단계 푸시 도입 전까지 60s grace
   재접속에 의존.

---

## §8 2단계 서브에이전트 분할안 — 갱신본

원 컨텍스트의 분할안은 **이미 구현된 상태와 어긋난다.** 갱신본 제안.

| 슬라이스 | 인스턴스 | 분량 | 비고 |
|---|---|---|---|
| ~~`S-client-flame-static-map`~~ | ~~B~~ | ~~1.5~2일~~ | **이미 완료** — slot index/8집/카메라/캐릭터/조이스틱 |
| ~~`S-client-flame-player-move`~~ | ~~B~~ | ~~다음 슬라이스~~ | **이미 완료** — 10Hz throttle, 보간 |
| ~~`S-server-player-move-event`~~ | ~~A~~ | ~~위와 동기~~ | **이미 완료** — `playerMove`/`playerPositionUpdate` |
| **`S-client-flame-cleanup`** | **B** | **0.5~1일** | flameMode 분기 정리 + CREDITS + 시민 fallback + houseEntered 이동 애니메이션 (§6) |
| **`S-server-player-move-guard`** | **A** | **0.5일 (조건부)** | 시야 누설 / 사망자 차단 / zone 가드 재점검 (§6) |
| **`S-client-flame-phase-overlay`** | **B** | **3.5일 (마이크로 4분할)** | 🟡 QA 대기 — VillageOverlay 위 phase 별 Material overlay 4종 모듈화 (day/vote/night/night_result) + AnimatedSwitcher. `docs/slices/S-client-flame-phase-overlay.md` 참조 |
| **`S-client-village-movement`** | **B** | **3.5~4일 (5 subagent)** | ⚪ 미진입 — 이동·walking/idle·조이스틱·throttle·보간·사망 마커 이미 구현됨. 잔여 갭 폴리시 (본인 캐릭터 표시 / 채팅 compact-expanded / Galaxy Tab / 시민 fallback 정합). `docs/slices/S-client-village-movement.md` 참조. **진입 가드: `S-client-flame-phase-overlay` 실기기 §L 11항목 Pass + Critical/Blocker 0건.** |
| `S-client-flame-night-immersion` | B | 1일 | 카메라 줌 / 마피아 동료 마커 / 결과 애니메이션 (§6) |
| `S-client-flame-asset-polish` | B | 0.5일 | 이름표 폰트·콘트라스트, 캐릭터 색 변주, 등불 발광 |

### 8.1 `S-client-flame-phase-overlay` 마이크로 분할 (Instance B 단독)

| step | 범위 | 분량 |
|---|---|---|
| A | `village_overlay.dart` 진입점 + dispatcher 로직 + AnimatedSwitcher 골격 | 1일 |
| B | `day_overlay.dart` + `vote_overlay.dart` (낮·투표). 카피 design-policy §2 자가검증 | 1일 |
| C | `night_overlay.dart` + `night_result_overlay.dart` (밤·결과) | 1일 |
| D | 통합 + 수동 시뮬 검증 + 1단계 회귀 안전망 재확인 | 0.5일 |

총 ~3.5일치 — 디렉터 신뢰 모드 단일 슬라이스의 내부 마이크로 분할.

**순서 권장:** 1단계 결승선 종료 → S-client-flame-cleanup (B) + S-server-player-
move-guard (A) 병렬 → **`S-meta-user-gui-sim` Pass 게이트** → S-client-flame-
phase-overlay (B, 마이크로 4분할) → S-client-flame-night-immersion → S-client-
flame-asset-polish.

---

## §9 2단계 결승선

> **4명 한 판이 Flame 도트 뷰 위에서 1단계와 동일하게 끝까지 동작하고,
> 광장에서 캐릭터가 보이며 이동·집 이름표·밤 톤 전환·사망 마커가 자연스럽게
> 나타난다.**

세부 체크 (수동 검증):

- [ ] 4명 입장 → 직업 배정 후 8집 중 4집에 이름표가 뜬다.
- [ ] 낮 페이즈에서 조이스틱으로 광장 안에서 4방향 이동 + walk 애니메이션.
- [ ] iOS sim 과 Android emu 두 클라가 서로의 좌표를 ~0.1s 내 반영.
- [ ] 밤 페이즈마다 NightOverlay 색 (의사 청록 / 마피아 적 / 경찰 보라) 전환.
- [ ] 사망 시 캐릭터에 X 마커.
- [ ] 백그라운드/포그라운드 토글 후 게임 재개.
- [ ] 60Hz 유지 (실기기 1대 이상).

---

## §10 첫 슬라이스 본문

`S-client-flame-cleanup` (선행) 은 §6 본문 + §8 표로 정의 완료.

후속 첫 슬라이스 `S-client-flame-phase-overlay` 의 6항목 컨텍스트는 별도
파일로 분리.

→ `docs/slices/S-client-flame-phase-overlay.md` 참조.

**진입 조건:** `S-meta-user-gui-sim` Pass 후. GUI 풀사이클 Pass 전에 본
슬라이스로 진입하면 1단계 회귀 안전망(서버 150 + e2e 20 + 클라 32 + analyze
clean + APK build) 이 무너질 위험 — 진입 가드.

> 진입 가드 해소: 2026-05-14 1단계 MVP 종료. S-client-flame-phase-overlay 진입 가능.
> 2026-05-14: 첫 슬라이스 `S-client-flame-phase-overlay` 코드 구현 완료. 실기기 QA 대기 (`mobile-qa-checklist.md §L`).
> 2026-05-14: 두 번째 슬라이스 `S-client-village-movement` 진입 조건 = `S-client-flame-phase-overlay` 실기기 §L 11항목 Pass + Critical/Blocker 0건 + 자동화 6/6 그린. `docs/slices/S-client-village-movement.md` 참조. (Agent D)

**한 줄 목표:** `VillageOverlay` Stack 의 하단 페이즈별 패널을 phase 별
Material overlay 위젯 4종(day / vote / night / night_result)으로 모듈화하여,
페이즈 전환 시 `AnimatedSwitcher` 로 부드럽게 교체.

서버 / 룰 / WS payload 변경 0건. 클라 UI 재구성만.
