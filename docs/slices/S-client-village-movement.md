# S-client-village-movement — 광장 캐릭터 이동·walking/idle·playerMove 클라 통합 (잔여 갭 폴리시)

> 본 슬라이스 진입 전, 코드 기준 잔여 UX 마감은
> `docs/slices/S-client-village-movement-gap-prep.md` 참조 (2026-05-14).

> 진입 조건: `S-client-flame-phase-overlay` 자동화 6/6 그린 + 사용자 실기기
> `mobile-qa-checklist.md §L` 11항목 Pass + Critical/Blocker 0건.
> 구현 전 가드: server / prisma / socket contract 변경 0건. 서버
> `playerMove` / `playerPositionUpdate` 이벤트는 이미 양방향 동작 — 클라 UI
> 폴리시와 잔여 갭만 손댄다.
>
> 본 문서는 디렉터 신뢰 모드 1~2일치 단일 슬라이스의 6항목 컨텍스트 + 마이크로
> 분할안. 자체 작성, mafia-app-harness §3 6항목 구조 + design-policy §2 hard-no
> 6개 자가검증 완료.

---

## 0. 한 줄 목표

광장 캐릭터 이동·sprite·walking/idle·조이스틱·`playerMove` throttle 송신·
`playerPositionUpdate` 보간 수신 — **이미 동작하는 베이스** 위에 12세 톤
폴리시, 본인 캐릭터 시각 구분, 대기실 채팅창 compact/expanded, Galaxy Tab
대응, 시민 fallback 정합 정도의 잔여 갭만 채운다.

### 0.1 실측 진입 상태 (Agent D 2026-05-14 확인)

| 항목 | 현재 상태 |
|---|---|
| `VillageGame` (Flame 본체, 581줄) | ✅ 구현 — 광장·집·캐릭터·조이스틱·NightOverlay |
| `PlayerAvatar` walking/idle sprite (`village_game.dart` §429~580) | ✅ Puny 시트 32×32 8방향, idle/walk 분기, 5 시트 색 변주 |
| `JoystickComponent` (좌하단 22/96 margin) | ✅ 구현 — 광장 80~160 clamp |
| `sendPlayerMove(x,y)` throttle 10Hz (`game_notifier.dart §471`) | ✅ 구현 — ack 실패 silent |
| `_onPlayerPositionUpdate` 수신 + Riverpod state | ✅ 구현 — `playerPositions: Map<userId, WorldPosition>` |
| `PlayerAvatar.setTargetPosition` lerp 보간 | ✅ 구현 — `dt*8.0` clamp |
| `markDead` 사망 X 마커 | ✅ 구현 |
| `villageGameRegistryProvider` lifecycle paused/resumed | ✅ 구현 |

→ 따라서 본 슬라이스는 **"빈 그릇 채우기" 가 아니라 "이미 도는 시스템의 폴리시
와 시민 fallback·UI 갭 메우기"** 다. subagent 분할안과 QA 항목도 그 전제 위에
구성한다.

**2026-05-14:** 본 슬라이스 진입 전 코드 기준 갭 폴리시 (`S-client-village-movement-gap-prep`)
완료. PlayerAvatar isLocal / chat compact-expanded / letterbox navy / 주석 보강.
본 슬라이스는 실기기 §L+§M Pass 후 본격 진입.

---

## 1. 핵심 파일 (4~8개)

- `client/lib/features/game/flame/village_game.dart` — 메인 Flame 본체.
  카메라 줌 / 본인 마커 / 마피아 동료 표시 (행동 페이즈 조건부) / 시민 자기 집
  내부 fallback 정합 정도만 손댐. **`PlayerAvatar`·`JoystickComponent`·
  `update()` throttle 인프라는 변경 X** — 회귀 방지.
- `client/lib/features/game/flame/village_pane.dart` — Riverpod glue. 시민
  fallback 처리 (광장 진입 비행동 직업) 와 본인 식별 props 전달.
- `client/lib/features/game/flame/village_overlay.dart` — Stack 내 채팅창
  compact/expanded 토글, Galaxy Tab maxWidth 360 중앙 정렬, overlay ↔ 조이스틱
  hit zone 겹침 방지.
- `client/lib/features/game/flame/overlays/day_overlay.dart` — 낮 채팅 영역
  compact/expanded UI. **신규 위젯 분리 가능 (선택)**.
- `client/lib/features/game/game_notifier.dart` — **변경 0건 권장.** throttle /
  송신 / 수신 그대로. 단 본인 식별·캐릭터 색 결정 보조 함수가 필요하면 selector
  만 추가.
- `client/lib/features/game/game_state.dart` — `playerPositions` selector 그대로.
  본인 PunySheet 결정 도우미는 `village_pane._build` 안 클로저로 충분.
- 자율: 신규 파일 1~3 가능 (`flame/widgets/lobby_chat_pane.dart` 등 분리).
  **총 신규 5개 미만 — 새 파일 5개 이상 한 슬라이스는 묻기 영역.**

---

## 2. 인터페이스 계약

### 변경 0건 영역 (서버 / 룰 / payload 보호)

- 서버 / Prisma — 변경 0건.
- WS 이벤트 13개 — 변경 0건.
  - `playerMove({ x, y })` — 클라 → 서버, 10Hz throttle 인프라 그대로.
  - `playerPositionUpdate({ userId, position: { x, y } })` — 서버 → 클라.
  - `phaseChanged`, `voteCast`, `executionResult`, `nightResult`, `gameOver`,
    `houseEntered`, `sendChatMessage`, `chatMessage`, `sendMafiaChat`,
    `mafiaChat`, `policeResult`, `reconnectSnapshot`, `phaseSkipped` 13개.
- 게임 룰 / phase machine / movement-zone — 변경 0건.
- `GameNotifier` / `GameState` public 인터페이스 — 변경 0건.
- `VillageGame` / `VillagePane` / `VillageGameRegistry` public 시그니처 —
  변경 0건.

### 신규/조정 클라 인터페이스 (예시 — 자율 결정 영역)

```dart
// village_game.dart — VillagePlayerSlot 에 isLocal 추가 가능 (자율).
class VillagePlayerSlot {
  // ... 기존 필드
  final bool isLocal; // 본인 캐릭터 시각 마커용 (화살표 / 외곽선 / 색상 강조).
}

// village_overlay.dart — 채팅창 compact/expanded 토글 (1단계 결과 회귀 X).
class LobbyChatPane extends ConsumerStatefulWidget {
  // compact: 하단 40~80dp / expanded: 하단 ~40% 높이 (전체 너비 X).
  // 광장 캐릭터 가림 최소.
}

// PlayerAvatar — 본인 마커 (자율, render() 안에 작은 화살표 또는 outline).
class PlayerAvatar {
  bool isLocal = false; // 생성자 추가 (signature 깨지지 않게 default false).
}
```

---

## 3. 자율 결정 OK

- 캐릭터 sprite / 폴더 / 명명 (현재 Puny 시트 5색 변주 유지).
- 조이스틱 위치 (현재 좌하단 22/96 margin — 유지 또는 미세 조정).
- walking 프레임 속도 (현재 0.13s/frame ≈ 7.7FPS — 4~8 FPS 권장 범위 안, 유지).
- idle timeout (현재 `_facing` 유지 + `moving=false` 즉시 idle 전환 — 200~400ms
  버퍼 추가 여부 자율).
- 채팅창 compact 높이 (40~80dp 권장) / expanded (전체 너비 X, 화면 ~40%).
- 카메라 줌 / follow 행동 (현재 정적 — 동적 줌 도입 자율, 단 비용 큰 변경은
  `S-client-flame-night-immersion` 으로 미루기 권장).
- 본인 캐릭터 시각 구분 (화살표 / 외곽선 / 색상 강조 중 택1).
- 디버그 좌표 표시 (`kDebugMode` 한정, release 노출 X — 1단계 기존 정책 준수).

---

## 4. 묻기 (정지)

- 새 의존성 (`flame_audio`, `flame_tiled`, `flame_forge2d` 등) — 추가 금지.
- 새 WS 이벤트 / payload 변경.
- 게임 룰 / phase machine 변경.
- 캐릭터 sprite 외부 에셋 신규 도입 (CREDITS.md §1~§4 갱신 + 디렉터 결정 필요).
- `playerMove` payload 형식 변경 / throttle 주기 변경 (현재 10Hz).
- 서버 rate limit / movement-zone clamp 변경.
- `Env.flameMode` default 변경.
- 1단계 6 fallback pane 삭제 (`flameMode=false` 검증·문제 분기 경로 보호).

---

## 5. 검증

- 단위 테스트 — **0개 신규.** Flame component 단위 테스트는 1단계 정책
  (mafia-app-harness §6) 상 비효율, 다음 슬라이스로 미룸. 기존 Flutter test 39+
  유지.
- 통합 테스트 — **0개 신규.** socket `playerMove`/`playerPositionUpdate` 는
  이미 e2e 20/20 검증 완료.
- 수동 시뮬 — iPhone + Android 폰 + Galaxy Tab 1사이클 + 멀티 클라 2대 이동
  동기 확인. `mobile-qa-checklist.md §M` 10항목 신설 예정 (아래 §8).
- 자동화 게이트 — `flutter analyze` clean / `flutter test` 39/39 유지 /
  APK debug build 통과 / iOS Simulator 빌드 통과.

---

## 6. 금지

- 서버 / Prisma / Socket payload — 0건 변경.
- 기존 1단계 6 fallback pane 삭제 — 0건.
- `_useFlameView` 4 조건 변경 — 0건.
- phase machine — 0건.
- 게임 룰 — 0건.
- `Env.flameMode` default — 0건.
- 새 의존성 — 0건.
- 새 파일 5개 이상 — 묻기.

---

## 7. 구현 범위 분할 (subagent 4분할안 — 총 ~3.5~4일)

| Subagent | 범위 | 분량 |
|---|---|---|
| **A — 캐릭터 sprite walking/idle 폴리시** | 기존 `PlayerAvatar` 위에 idle bobbing 제거 확인 / `_facing` 유지 정합 / 사망 시 X 마커 콘트라스트 / 본인 캐릭터 시각 구분 (외곽선·화살표·색상 강조 중 택1). **`_AnimState`·sprite sheet·시트 매핑 변경 X.** | 1일 |
| **B — 조이스틱 + 속도 보정** | 기존 `JoystickComponent` 유지 + 좌하단 hit zone ↔ 채팅창 ↔ overlay 겹침 점검. 대각선 속도 (현재 `relativeDelta * 50.0 * dt`) 4방향과 체감 비교 후 normalize 추가 여부 결정. throttle 10Hz 변경 X. | 0.5일 |
| **C — 원격 플레이어 동기 안정** | 기존 `setTargetPosition` lerp (`dt*8.0` clamp) 유지. 이동 중 walking → 정지 200~400ms timeout idle 복귀 정합. 멀티 클라 2대 시뮬 끊김 시 자연스러운 정지 확인. | 0.5일 |
| **D — 대기실 채팅창 + 본인 캐릭터 선택 표시 + 배경 + Galaxy Tab 대응** | compact/expanded 채팅 토글 위젯, 본인 캐릭터 색/외곽선 표시, 광장 배경 전체 화면 cover, Galaxy Tab 넓은 화면 레이아웃 (overlay maxWidth 360 중앙). 채팅 IME open 시 광장 가림 최소. | 1.5일 |
| **E — 통합 + 수동 시뮬 검증** | 모든 변경 통합, iPhone + Android + Galaxy Tab 실기기 1사이클, regression 안전망 (`flutter analyze` + `flutter test` 39+ + APK debug build), `mobile-qa-checklist.md §M` 10항목 기록. | 0.5일 |

**조건부 시민 fallback 보강 (선택):** 비행동 직업 시민이 밤 페이즈 광장
이동을 차단·자기 집 안 화면 폴백 정합 — 현재 `village_game.dart` 광장 80~160
clamp 로 비행동 직업도 광장에서 못 벗어남. UX 카피만 추가 (자체 작성, design-
policy §2-3 자가검증). 1단계 정합 회귀 0건이면 D 에 포함, 회귀 의심 시 별도
미니 슬라이스 (`S-client-flame-night-immersion` 로 이관).

---

## 8. 실기기 QA 항목 (`mobile-qa-checklist.md §M` 신설 예정)

- [ ] M.1 본인 캐릭터 이동 — 조이스틱 8방향 + 정지 시 즉시 idle.
- [ ] M.2 대각선 속도 — 4방향 속도와 체감 일관 (대각선 1.0 cap 검토).
- [ ] M.3 원격 플레이어 동기 — 멀티 클라 2대 위치 동기화 부드러움 (~0.1s lag).
- [ ] M.4 walking ↔ idle 전환 — 정지 200~400ms 후 idle, bobbing/흔들림 X.
- [ ] M.5 채팅창 compact/expanded — 토글 자연스러움, 맵 가림 최소.
- [ ] M.6 조이스틱 ↔ 채팅 ↔ overlay hit zone 겹침 0건.
- [ ] M.7 Galaxy Tab — 배경 전체 화면 cover, overlay maxWidth 360 중앙.
- [ ] M.8 본인 캐릭터 선택 표시 — 다른 캐릭터와 시각 구분 (12세 톤 부드럽게).
- [ ] M.9 사용자 화면 개발자 용어 노출 0건 (`OUT_OF_ZONE` 등 코드 직노출 금지).
- [ ] M.10 자동화 게이트 — `flutter analyze` clean + `flutter test` 39+ +
       APK debug build OK + iOS Simulator 빌드 OK.

---

## 9. 진입 조건

- 본 슬라이스 진입 = `S-client-flame-phase-overlay` 자동화 6/6 그린 + 사용자
  실기기 `mobile-qa-checklist.md §L` 11항목 Pass + Critical/Blocker 0건.
- 진입 후 `docs/release-readiness.md` §8.1 슬라이스 진행 표에 새 행 추가
  (`S-client-village-movement` — 진행중).
- 종료 시 `docs/phase2-flame-map-plan.md` §9 결승선 체크 7항목 중 본 슬라이스
  범위 (이동·walk 애니메이션·원격 동기·사망 마커) 모두 ✅ 표기.

---

## 10. 갱신 이력

- 2026-05-14: S-client-village-movement 슬라이스 컨텍스트 초안 작성 (Agent D).
  실측 진입 상태 (§0.1) — 광장 이동·walking/idle·조이스틱·throttle·보간·사망
  마커 모두 이미 구현됨 — 을 반영하여 슬라이스 본질을 "잔여 갭 폴리시" 로
  재정의. 4 subagent (A 폴리시 / B 조이스틱 / C 원격 동기 안정 / D 채팅·본인
  표시·Galaxy Tab) + E 통합 시뮬. 신규 의존성·WS 이벤트·payload·rule 변경 0건.
