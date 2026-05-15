# S-client-flame-phase-overlay — VillageOverlay 위 phase 별 Material overlay 결합

> 진입 조건: `S-meta-user-gui-sim` Pass (1단계 MVP 명실상부 종료) 후.
> GUI 풀사이클 Pass 전에는 본 슬라이스 진입 X — 1단계 회귀 위험.
>
> 본 문서는 `S-client-flame-cleanup` 후속으로 디렉터가 그대로 던질 수 있는
> 6항목 슬라이스 컨텍스트. 자체 작성, mafia-app-harness §3 6항목 구조 준수.

---

## 0. 한 줄 목표

`VillageOverlay` Stack 의 하단 페이즈별 패널을 **phase 별 Material overlay
위젯 4종**으로 모듈화하여, 페이즈 전환 시 부드럽게 교체되도록 한다.
서버/룰/페이로드 변경 0건. 클라 UI 재구성만.

---

## 1. 핵심 파일 (4~6개)

- `client/lib/features/game/flame/village_overlay.dart` — Stack 위 phase 별
  overlay 결합 진입점. 현재 인라인으로 채팅·투표·밤 액션 패널을 직접 그리는
  부분을 dispatcher 로 정리.
- `client/lib/features/game/game_screen.dart` — `_useFlameView()` true 경로에서
  `VillageOverlay()` 가 들고 있는 phase overlay 호출 (호출자 인터페이스 변경 X).
- `client/lib/features/game/widgets/phase_header.dart` (이미 존재) — 재사용.
- `client/lib/features/game/widgets/skip_notice_pane.dart` (이미 존재) — 재사용.
- 신설 가능 (5번째 파일부터는 묻기 영역이지만 본 슬라이스는 phase overlay
  4개로 한정):
  - `client/lib/features/game/flame/overlays/day_overlay.dart`
  - `client/lib/features/game/flame/overlays/vote_overlay.dart`
  - `client/lib/features/game/flame/overlays/night_overlay.dart`
  - `client/lib/features/game/flame/overlays/night_result_overlay.dart`

---

## 2. 인터페이스 계약

### 변경하지 않는 영역 (서버/룰/payload 보호)

- 서버 WS 이벤트명 / payload 형식 (`phaseChanged`, `voteCast`,
  `executionResult`, `nightResult`, `gameOver` 등 13개).
- `GameNotifier` / `GameState` public 인터페이스.
- `VillagePane` / `VillageGame` / `VillageGameRegistry` public 시그니처.
- 게임 룰 (assign-roles / tally-votes / resolve-night-actions /
  check-win-condition / movement-zone).
- `phaseMachine` 전이 룰.
- Prisma 스키마.

### 신규 위젯 시그니처 (예시)

```dart
class DayOverlay extends ConsumerWidget {
  const DayOverlay({super.key});
  // 낮 채팅 + 토론 안내 + 광장 강조 overlay.
  // VillageOverlay Stack 내 Positioned 또는 SafeArea bottom.
}

class VoteOverlay extends ConsumerWidget {
  const VoteOverlay({super.key, required this.phase});
  // phase: GamePhase.voteSelect | GamePhase.voteConfirm
  final GamePhase phase;
}

class NightOverlay extends ConsumerWidget {
  const NightOverlay({super.key, required this.phase});
  // phase: nightDoctor | nightMafia | nightPolice
  final GamePhase phase;
}

class NightResultOverlay extends ConsumerWidget {
  const NightResultOverlay({super.key});
}
```

### dispatcher 형태 (village_overlay.dart 내)

```dart
Widget _phaseOverlayFor(GamePhase phase) {
  switch (phase) {
    case GamePhase.dayDiscussion:
      return const DayOverlay();
    case GamePhase.voteSelect:
    case GamePhase.voteConfirm:
      return VoteOverlay(phase: phase);
    case GamePhase.nightDoctor:
    case GamePhase.nightMafia:
    case GamePhase.nightPolice:
      return NightOverlay(phase: phase);
    case GamePhase.nightResult:
      return const NightResultOverlay();
    default:
      return const SizedBox.shrink();
  }
}
```

`AnimatedSwitcher` 로 감싸 페이즈 전환 시 fade/slide.

---

## 3. 자율 결정 OK

- overlay 위젯 명명 / 파일 명명 / 위치 (Stack 좌표, Positioned vs Align).
- 카피 (자체 작성, design-policy §2 hard-no 4 자가검증 의무 — 직업명·시그니처
  단어 인용 금지).
- 색상 / 투명도 / blur (Material 3 다크 `ColorScheme.fromSeed` 기반).
- overlay 진입 / 퇴장 애니메이션 (`AnimatedSwitcher` / `AnimatedOpacity`
  등 Flutter 표준 위젯만).
- 기존 인라인 코드를 새 overlay 위젯으로 옮길 때 내부 refactor 자유 —
  단, 사용자 동작 / 에러 카피 매핑 변경은 X.
- phase 별 overlay 가 공유하는 helper / mixin 추출.

---

## 4. 묻기 (정지)

- 새 의존성 추가 (`flame_audio`, `flame_tiled`, `rive`, `animations` 등
  Flutter 외부 패키지).
- WS 이벤트 신규 / 변경 / payload 필드 추가.
- 게임 룰 변경 (assign-roles / tally-votes / resolve-night-actions /
  check-win-condition).
- 새 에셋 (sprite / audio) 추가 — `client/assets/CREDITS.md` §1~§4 갱신 후
  코워크 결정.
- design-policy §2 hard-no 의심 카피 (특정 게임 카피 직역 의심).
- 5개째 신규 파일 — overlay 4개로 한정. shared helper 가 5번째 파일이 되면
  보고 + 진행 (회색).

---

## 5. 검증

- 단위 0 / 통합 0 / 수동 시뮬 OK (1단계 클라 테스트 정책 유지).
- 사용자 GUI 시뮬 1~2개에서 phase 전환 시 overlay 가 부드럽게 교체되는지
  시각 검증.
- 1단계 회귀 안전망 그대로 그린 유지:
  - 서버 단위 150 / 통합 + e2e 20/20.
  - 클라 단위 32/32 (있다면).
  - `flutter analyze` clean.
  - `flutter build apk --debug` 통과.
- iOS sim + Android emu 동시 1사이클 — 낮 채팅 → 1차 투표 → 2차 찬반 →
  처형 → 밤 3페이즈 → 밤 결과 → 다음 낮까지 overlay 전환 자연스러움 확인.

---

## 6. 금지

- 서버 / Prisma / Socket contract 변경.
- `VillageGame` 내부 component 재구성 (다음 슬라이스
  `S-client-village-movement` 영역).
- 기존 Material pane (`day_pane.dart` / `vote_select_pane.dart` /
  `vote_confirm_pane.dart` / `execution_pane.dart` / `night_pane.dart` /
  `night_result_pane.dart`) 삭제 — `flameMode=false` fallback 보호.
- `phaseMachine` 전이 변경.
- role assignment / win condition / vote tally / night action 룰 변경.
- `Env.flameMode` default 값 변경 (현재 true 유지).
- 새 WS 이벤트 / 새 에러 코드 / 새 환경변수.
- overlay 안에서 서버 ack 받기 전 optimistic UI 갱신 (harness §7 클라
  best practice).

---

## 7. 서브에이전트 분할안 (마이크로 — 총 3.5일치)

본 슬라이스는 Instance B (Frontend) 단독. 4개의 마이크로 step 으로 나눠
순차 진행하거나 디렉터가 병렬 인스턴스 B 를 띄워도 동일 파일 충돌 없음
(overlay 파일이 step 별로 분리됨).

| step | 범위 | 분량 | 주요 파일 |
|---|---|---|---|
| **A** | `village_overlay.dart` 진입점 + dispatcher 로직 + AnimatedSwitcher 골격 | 1일 | `village_overlay.dart` |
| **B** | `day_overlay.dart` + `vote_overlay.dart` (낮·투표) | 1일 | overlays/day, overlays/vote |
| **C** | `night_overlay.dart` + `night_result_overlay.dart` (밤·결과) | 1일 | overlays/night, overlays/night_result |
| **D** | 통합 + 수동 시뮬 검증 + 1단계 회귀 안전망 재확인 | 0.5일 | analyze / build apk / iOS sim + Android emu |

총 ~3.5일치. 디렉터 신뢰 모드 단일 슬라이스의 내부 마이크로 분할.

---

## 8. 진입 가드 체크리스트

본 슬라이스 진입 직전 다음 모두 그린:

- [x] `S-meta-user-gui-sim` Pass — GUI 풀사이클 1회 이상 정상 종료.
      (2026-05-14 1단계 MVP 종료, 디렉터 풀사이클 Pass 확인)
- [ ] 1단계 회귀 안전망 4종 모두 그린 (서버 단위 / e2e / 클라 단위 /
      analyze + apk build).
- [ ] `S-client-flame-cleanup` Pass (선행 권장).
- [ ] design-policy §2 hard-no 6 자가검증 의무 인지.

위 4개 중 하나라도 빨강이면 진입 X.

---

## A. 파일 소유권 (충돌 방지)

본 슬라이스는 디렉터가 다수 인스턴스를 띄워 batch 로 진행한다. 동시 작업
충돌을 막기 위해 파일/디렉토리별 담당 Agent 를 고정한다.

| 파일/디렉토리 | 담당 Agent | 작업 | 다른 Agent 손대지 마 |
|---|---|---|---|
| `client/lib/features/game/flame/village_overlay.dart` | B | phase 디스패치 + AnimatedSwitcher | C/D/E/F |
| `client/lib/features/game/flame/widgets/*.dart` (신규) | B | DayOverlay/VoteOverlay/NightOverlay/NightResultOverlay | C/D/E/F (단 E는 test에서 import만) |
| `client/lib/features/game/game_screen.dart` | C | `_useFlameView` 경로 검증 + 주석 | B/D/E/F |
| `client/lib/features/game/presentation/**` | C | pane fallback 유지 점검 | B/D/E/F |
| `client/lib/features/game/game_state.dart` | C (최소) | selector 1~2 추가 가능 | B/D/E/F |
| `client/test/features/game/flame/*_test.dart` (신규) | E | widget test | B/C/D/F |
| `docs/content-guidelines-12.md` | D | phase overlay 카피 원칙 한 줄 | A/B/C/E/F |
| `docs/slices/S-client-flame-phase-overlay.md` | A → F | A: 범위 고정 / F: 완료 체크박스 | B/C/D/E |
| `docs/phase2-flame-map-plan.md` | A (최소) | §10 cross-ref 확인 | F는 한 줄 가능 |
| `docs/mobile-qa-checklist.md` | F | 실기기 6항목 추가 | A/B/C/D/E |
| `docs/release-readiness.md` | F (§8 신설) | 2단계 진행 상태 | A/B/C/D/E |
| **server/, prisma/, socket contract** | — | **변경 0건. 절대 손대지 마** | 전체 |

> 표 외 파일을 수정해야 할 상황이 발견되면 슬라이스 정지 + 디렉터 결정
> 요청. 자율 결정 금지.

---

## B. 이번 슬라이스 구현 범위 (S-client-flame-phase-overlay)

본 슬라이스는 **VillageOverlay 위 phase 별 Material overlay 결합** 만이
스코프. Flame 대규모 변경·새 sprite·새 WS 이벤트 X.

### B.1 구현 대상 — overlay 4종 + dispatcher

- [ ] **DayOverlay** — 낮 안내 HUD ("마을의 낮이에요...") + 남은 시간 또는
      phase 상태 (작은 라벨, 상단/하단 SafeArea 내)
- [ ] **VoteOverlay** — 투표 가능 상태 안내. 기존 VoteSelect/VoteConfirmPane
      과 충돌하지 않게 **버튼/액션 제공 금지** — HUD 안내만
- [ ] **NightOverlay** — 밤 진행 안내 HUD. 시민/비-actor 는 `_useFlameView`
      false 경로로 NightPane 풀스크린이 보이므로 여기서는 **actor (의사/
      마피아/경찰) 가 자기 페이즈에 Flame view 도달한 경우만** 안전하게 안내
- [ ] **NightResultOverlay** — 밤 결과 대기/요약 안내. 기존
      `night_result_pane.dart` 와 공존 가능한 얇은 안내
- [ ] **`village_overlay.dart` dispatcher** — phase 기준으로 위 4종 중
      하나를 AnimatedSwitcher 로 전환
- [ ] **phase transition** — AnimatedSwitcher 의 SizedBox / FadeTransition
      정도, 과한 효과 X

### B.2 디자인 요건

- Pixel UI / Galmuri11 톤 유지 (`app/pixel_theme.dart` 활용)
- 12세 안심형 카피 (Agent D 가 카피 가이드 작성)
- 반투명 패널 (Flame view 보이게)
- SafeArea
- `BoxConstraints(maxWidth: 360)` 같은 작은 화면/태블릿 대응
- 전체 화면 덮기 금지 (광장이 항상 보여야 함)

> 카피 원칙: `docs/content-guidelines-12.md §9 Phase Overlay 카피 원칙` 참조
> (12세 톤 · 한 줄 35자 · 개발자 용어 금지 · phase별 표준 카피 표).

### B.3 절대 손대지 말 영역 (재확인)

- 서버 / Prisma / Socket payload / 게임 룰 / phase machine / role
  assignment / win condition / vote tally / night action / `pubspec.yaml`
- 기존 1단계 pane (`day_pane.dart` / `vote_pane.dart` / `execution_pane.dart`
  / `night_pane.dart` / `night_result_pane.dart` / `game_over_pane.dart`)
- `Env.flameMode` default 값 (현재 true 유지)

### B.4 다음 슬라이스로 넘김 (S-client-village-movement 또는 이후)

- 대규모 도트 맵 작화 / 교체
- 캐릭터 sprite 이동 / 충돌 / 애니메이션
- 조이스틱 / `playerMove` rate 변경
- 집 진입 sprite 이동 애니메이션 (`houseEntered` 수신 시 캐릭터 이동)
- 시민 자기 집 인테리어 도트 (현재 NightPane 풀스크린 Material 로 충분)
- 새 WS 이벤트 추가
- Flame audio
- 카메라 줌 / 마피아 동료 마커 / 결과 mini-animation
  (→ `S-client-flame-night-immersion`)

---

## C. 구현 체크박스 (Agent F가 슬라이스 종료 시 갱신)

- [x] B.1 overlay 4종 + dispatcher 모두 구현 (Agent B)
- [x] B.2 디자인 요건 (Pixel UI, 12세 카피, 반투명, SafeArea, maxWidth,
      부분 덮기) 충족 (Agent B/D)
- [x] B.3 절대 손대지 말 영역 0건 변경 확인 (Agent B 보고 + 통합 mtime cross-check)
- [x] 테스트 36+ 통과 (E) — 클라 39/39 + 서버 150/150 (2026-05-14 통합 검증)
- [x] `flutter analyze` clean — No issues found (2026-05-14 통합 검증)
- [x] APK debug build OK — `flutter build apk --debug` 성공 (2026-05-14 통합 검증)
- [x] `mobile-qa-checklist` 실기기 6항목 추가 (F)
- [x] `release-readiness §8` 2단계 진행 섹션 신설 (F)
- [x] 1단계 MVP 종료 상태 유지 (§7 미손상) (F)

---

## D. pane vs overlay 책임 분리 (2026-05-14 Agent C 검증)

새 Flame `flame/widgets/` overlay 4종과 기존 1단계 Material pane 6종이
같은 phase 동안 충돌 없이 공존하는지 코드 레벨 cross-check 결과.

### D.1 기존 1단계 Material pane (action / 풀스크린 UI · `_useFlameView=false`)

- `day_pane.dart` — 낮 채팅·토론 (텍스트 입력 + 말풍선 로그).
- `vote_pane.dart` — `VoteSelectPane` / `VoteConfirmPane`, 실제 투표 액션
  (대상 탭 / 찬반 버튼). 후보 본인 비활성 처리 포함.
- `execution_pane.dart` — 처형 결과 짧은 결과 표시 (3s 페이즈).
- `night_pane.dart` — 밤 actor (의사/마피아/경찰) 의 집 탭 액션 + 마피아
  채팅. 시민/비-actor 는 `_WaitingPane` 풀스크린 ("마을이 조용합니다…").
- `night_result_pane.dart` — 밤 결과 표시 (사망자·경찰 본인 조사 결과).
- `game_over_pane.dart` — gameOver 풀스크린 (사용 경로는 `game_screen.dart`
  의 별도 분기 `GameResultScreen` — pane 은 fallback 유지).

### D.2 신규 Flame `VillageOverlay` HUD overlay (안내 전용 · `_useFlameView=true`)

- `flame/widgets/day_overlay.dart` — 낮 안내 카피만.
- `flame/widgets/vote_overlay.dart` — voteSelect / voteConfirm 안내 카피만.
- `flame/widgets/night_overlay.dart` — 밤 3페이즈 안내 카피만 (actor /
  비-actor 분기 카피).
- `flame/widgets/night_result_overlay.dart` — 새벽 정산 안내 카피만.
- 공통: `phase_overlay_panel.dart` `OverlayPanel` (반투명 + maxWidth 360 +
  SafeArea), action button 0건.

### D.3 진입 경로 표 (`_useFlameView(GameState game)`)

| Phase | `_useFlameView` 결과 | 표시 화면 |
|---|---|---|
| `null` | false | 로더 (`CircularProgressIndicator`) |
| `dayDiscussion` | true | `VillageOverlay` → `DayOverlay` |
| `voteSelect` | true | `VillageOverlay` → `VoteOverlay(voteSelect)` |
| `voteConfirm` | true | `VillageOverlay` → `VoteOverlay(voteConfirm)` |
| `execution` | true | `VillageOverlay` → `SizedBox.shrink` (overlay X, 3s 짧은 페이즈) |
| `nightDoctor` | true (의사) / false (외) | actor → NightOverlay / 비-actor → `NightPane` 풀스크린 |
| `nightMafia` | true (마피아) / false (외) | 동일 |
| `nightPolice` | true (경찰) / false (외) | 동일 |
| `nightResult` | true | `VillageOverlay` → `NightResultOverlay` |
| `gameOver` | false (안전망) | `GameResultScreen` (game_screen 별도 분기) |

비-actor 분기는 `GameState.isInsideOwnHouseTonight` 게터가 결정 — 시민 및
자기 페이즈가 아닌 actor 직업은 `true` → `_useFlameView=false` → `NightPane`
풀스크린 (광장 시야 노출 차단, context.md §2 시야 규칙).

`execution` 페이즈가 `_useFlameView=true` 인데 `_phaseOverlayFor` 가
`SizedBox.shrink` 를 돌려주는 이유: EXECUTION 은 3s 짧은 결과 페이즈로
별도 overlay 없이 Flame 광장 위 상단 HUD (PhaseTitleBadge) 만으로 결과
사인을 충분히 전달. 결과 카피는 다음 day cycle 의 첫 라운드에서 처리.
별도 ExecutionOverlay 도입은 본 슬라이스 스코프 외 — 다음 슬라이스
후보로 보류.

### D.4 충돌 검증 결과 (2026-05-14)

- `flame/widgets/{day,vote,night,night_result}_overlay.dart` 4 파일 안
  action button 0건 — grep `onTap|onPressed|ElevatedButton|TextButton|
  IconButton|GestureDetector|InkWell` no matches.
- `VillageOverlay` public 시그니처 변경 0건 (`const VillageOverlay({super.key})`
  유지).
- 1단계 pane 6 파일 mtime 변경 0건 (모두 슬라이스 시작 이전).
- `_useFlameView(GameState)` 본문 4 조건 (`Env.flameMode` / `phase == null`
  / `phase == gameOver` / `isInsideOwnHouseTonight`) 그대로 유지.
- `game_screen.dart` 의 `_useFlameView` 호출 1곳, 시그니처 변경 0.
- `flutter analyze` clean / `flutter test` 32/32 — 1단계 회귀 안전망 그린.
- 카피 12세 톤 회귀 점검 결과 (2026-05-14): action 0건, socket emit 0건,
  개발자 용어 0건, VoteConfirm 카피 톤 다운 ("처형" → "탈락") + §9-4 표
  + 테스트 매칭 단어 동기 갱신.

---

## E. 실측 결과 슬롯 (회차 누적)

회차 1 ~ N 의 결과는 `docs/mobile-qa-log-template.md §L Phase Overlay 회차 결과` 양식 사용.

- 회차 1: 미실측 (사용자 실기기 QA 대기 — iPhone + Android 폰 + Galaxy Tab)
- 회차 N: ...

### 본 슬라이스 자동화 게이트와 수동 게이트 매핑

| 게이트 | 출처 | 상태 |
|---|---|---|
| flutter analyze clean | 통합 검증 | [x] (직전 슬라이스에서 확인) |
| flutter test 39+ | 통합 검증 | [x] |
| flutter build apk --debug | 통합 검증 | [x] |
| server/prisma/socket 0 변경 | 통합 검증 | [x] |
| overlay action grep 0 | Agent C | [x] |
| 사용자 화면 개발자 용어 0 | Agent C | (확인 후 갱신) |
| §L 11항목 실기기 Pass | 사용자 실측 | [ ] (대기) |

> §L 11항목 모두 Pass + Critical/Blocker 0건 → release-readiness §8.5 다음 슬라이스 진입 조건 충족.
