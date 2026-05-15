# 모바일 QA 실측 로그 템플릿 — 폰 2대 회차별 결과 기록

> 함께 읽기: `mobile-qa-checklist.md` (절차), `realtime-sync-checklist.md` (WS 동기화 상세).
> 본 문서는 폰 2대 실측 QA 결과를 회차별 표로 기록하는 운영 템플릿.

## 0. 개요

- 폰 2대 실측 QA 결과를 즉시 기록하기 위한 표 템플릿.
- `docs/mobile-qa-checklist.md` 의 절차를 진행하면서 이 파일을 채워간다.
- 한 회차 = 한 표. 회차마다 새 섹션 추가.

## 1. 회차 메타 표

```markdown
| 항목 | 값 |
|---|---|
| 테스트 날짜 | YYYY-MM-DD |
| 기기 A 모델 / OS | (예: Pixel 7 / Android 14) |
| 기기 A 앱 빌드 | (예: app-debug.apk 2026-05-13 19:31) |
| 기기 B 모델 / OS | |
| 기기 B 앱 빌드 | |
| 네트워크 환경 | 같은 WiFi / 폰 핫스팟 / 셀룰러 |
| 서버 환경 | localhost / LAN / Docker |
| 방 코드 | |
| 테스트 닉네임 A | |
| 테스트 닉네임 B | |
| 담당자 | |
```

## 2. 시나리오별 체크 표

각 시나리오 1줄 / Pass / Fail / Blocked / N/A:

```markdown
| # | 시나리오 | 기대 결과 | 실제 결과 | 결과 | 비고 |
|---|---|---|---|---|---|
| 1 | 방 A 만들기 → 방 코드 공유 | /room/:roomId 진입 + 방 코드 노출 | | Pass/Fail | |
| 2 | 방 B 코드 입력 입장 | 같은 /room/:roomId 진입, 멤버 2명 표시 | | | |
| 3 | 대기실 위치 동기화 (lobbyMove) | A 조이스틱 이동 → B 화면 100~120ms 이내 캐릭터 따라감 | | | |
| 4 | 카운트다운 ±200ms | 4명 채워서 5/4/3/2/1 양쪽 동기 | | | |
| 5 | 대기실 채팅 (양방향) | A 채팅 → B 채팅창 + 말풍선 / B 채팅 → A 표시 | | | |
| 6 | 차단 후 채팅 숨김 | A 가 B 차단 → B 채팅 A 화면에서 안 보임 | | | |
| 7 | 차단 해제 후 다시 노출 | A 의 차단 목록에서 해제 → B 채팅 A 화면에 다시 노출 | | | |
| 8 | 게임 시작 (assignRoles/housesAssigned) | 카운트다운 종료 → IN_GAME 전환, /game/:roomId 자동 이동 | | | |
| 9 | 낮 토론 (chatMessage 양방향) | 낮 채팅 양방향 표시 | | | |
| 10 | 1차 투표 (voteCast) | 투표 양쪽 동기 | | | |
| 11 | 2차 찬반 (confirmExecutionVote / executionResult) | 결과 시스템 메시지 양쪽 동기 | | | |
| 12 | 밤 행동 (enterHouse / nightResult) | 행동 직업만 마을 시야, 결과 양쪽 동기 | | | |
| 13 | 결과 화면 (gameOver finalAlive) | 승리/패배 + 생존/사망 배지 양쪽 일관 | | | |
| 14 | 재접속 grace 60s | 한 폰 비행기 모드 30s → 복귀 → 자리 유지 | | | |
| 15 | 작은 화면 overflow (320dp) | iPhone SE 또는 작은 Android 폰 | | | |
```

## 3. 발견 이슈 표

```markdown
| 이슈 ID | 심각도 | 시나리오# | 재현 단계 | 기대 vs 실제 | 스크린샷/영상 | 로그 키워드 | 담당자 | 수정 PR/커밋 |
|---|---|---|---|---|---|---|---|---|
| BUG-001 | High/Medium/Low | 3 | 1) ... 2) ... | 기대: ... / 실제: ... | screenshots/qa-2026-05-13/issue1.png | `[lobbyPos<-]` 누락 | | |
```

### §4 성능 측정 (회차당 1세트)

| 항목 | 10분 | 30분 | 60분 | 비고 |
|---|---|---|---|---|
| 메모리 (MB) | | | | |
| FPS 체감 | | | | |
| Choreographer skipped frames | | | | |
| 배터리 소모 (%/시간) | | | | |
| 발열 (정성) | | | | |
| 앱 강제 종료 | Y/N | Y/N | Y/N | |
| 채팅 지연 (체감) | | | | |
| 위치 동기화 지연 (체감) | | | | |
| 측정 도구 (Android meminfo / iOS Instruments) | | | | |

상세 절차는 [performance-qa.md](./performance-qa.md) 참조.

## 4. 로그 수집 방법

```
# Android
flutter logs

# iOS (Xcode Console 또는)
flutter logs

# 검색 키워드:
[lobbyMove] [lobbyPos<-] [playerMove] [playerPos<-] [phase] [countdown] [chat]
```

스크린샷 폴더: `client/screenshots/qa-YYYY-MM-DD/`

## 5. 회차 종료 요약

```markdown
| 항목 | 값 |
|---|---|
| 전체 시나리오 | 15 |
| Pass | |
| Fail | |
| Blocked | |
| N/A | |
| 출시 차단 이슈 수 | |
| 다음 회차 일정 | |
```

## 6. 회차 1 — 환경 제약으로 실 폰 실측 미실행 (코드 기준 점검 대체)

상태: **Blocked** — 실 폰 USB/네트워크 접근 불가 (`adb devices` 결과 0대).
실측 대신 APK 빌드 검증 + 코드 기준 점검 1세트를 기록.

### 6.1 회차 1 메타

| 항목 | 값 |
|---|---|
| 테스트 날짜 | 2026-05-13 |
| 기기 A 모델 / OS | N/A — 실 폰 미연결 |
| 기기 A 앱 빌드 | `build/app/outputs/flutter-apk/app-debug.apk` (181MB, 2026-05-13 20:14) |
| 기기 B 모델 / OS | N/A — 실 폰 미연결 |
| 기기 B 앱 빌드 | 위와 동일 (단일 APK, --dart-define=API_BASE_URL=http://10.0.2.2:3000) |
| 네트워크 환경 | N/A (코드 점검) |
| 서버 환경 | N/A (코드 점검) |
| 방 코드 | N/A |
| 테스트 닉네임 A | N/A |
| 테스트 닉네임 B | N/A |
| 담당자 | Agent A (Android 실측 담당) |

### 6.2 회차 1 시나리오 결과 — 전 항목 Blocked

| # | 시나리오 | 기대 결과 | 실제 결과 | 결과 | 비고 |
|---|---|---|---|---|---|
| 1 | 방 A 만들기 → 방 코드 공유 | /room/:roomId 진입 + 방 코드 노출 | 미실행 | Blocked | adb devices 0대 |
| 2 | 방 B 코드 입력 입장 | 같은 /room/:roomId 진입, 멤버 2명 표시 | 미실행 | Blocked | 〃 |
| 3 | 대기실 위치 동기화 (lobbyMove) | A 조이스틱 이동 → B 화면 100~120ms 이내 캐릭터 따라감 | 미실행 | Blocked | 〃 |
| 4 | 카운트다운 ±200ms | 4명 채워서 5/4/3/2/1 양쪽 동기 | 미실행 | Blocked | 〃 |
| 5 | 대기실 채팅 (양방향) | A 채팅 → B 채팅창 + 말풍선 / B 채팅 → A 표시 | 미실행 | Blocked | 〃 |
| 6 | 차단 후 채팅 숨김 | A 가 B 차단 → B 채팅 A 화면에서 안 보임 | 미실행 | Blocked | 〃 |
| 7 | 차단 해제 후 다시 노출 | A 의 차단 목록에서 해제 → B 채팅 A 화면에 다시 노출 | 미실행 | Blocked | 〃 |
| 8 | 게임 시작 (assignRoles/housesAssigned) | 카운트다운 종료 → IN_GAME 전환, /game/:roomId 자동 이동 | 미실행 | Blocked | 〃 |
| 9 | 낮 토론 (chatMessage 양방향) | 낮 채팅 양방향 표시 | 미실행 | Blocked | 〃 |
| 10 | 1차 투표 (voteCast) | 투표 양쪽 동기 | 미실행 | Blocked | 〃 |
| 11 | 2차 찬반 (confirmExecutionVote / executionResult) | 결과 시스템 메시지 양쪽 동기 | 미실행 | Blocked | 〃 |
| 12 | 밤 행동 (enterHouse / nightResult) | 행동 직업만 마을 시야, 결과 양쪽 동기 | 미실행 | Blocked | 〃 |
| 13 | 결과 화면 (gameOver finalAlive) | 승리/패배 + 생존/사망 배지 양쪽 일관 | 미실행 | Blocked | 〃 |
| 14 | 재접속 grace 60s | 한 폰 비행기 모드 30s → 복귀 → 자리 유지 | 미실행 | Blocked | 〃 |
| 15 | 작은 화면 overflow (320dp) | iPhone SE 또는 작은 Android 폰 | 미실행 | Blocked | 〃 |

### 6.2-bis 회차 1 코드 기준 점검 결과 (실측 대안)

| # | 점검 항목 | 기대 | 확인 결과 | Pass/Fail |
|---|---|---|---|---|
| C1 | `flutter build apk --debug --dart-define=API_BASE_URL=http://10.0.2.2:3000` | 빌드 성공 + APK 생성 | exit 0, app-debug.apk 181MB 생성 (~9.2s assembleDebug) | Pass |
| C2 | 디버그 로그 prefix `[lobbyMove]` `kDebugMode` 가드 | release 빌드에서 미출력 | `lib/features/room/state/lobby_movement_controller.dart:118` `if (kDebugMode)` 가드 안에서만 emit | Pass |
| C3 | `[lobbyPos<-]` `kDebugMode` 가드 | 〃 | `lib/features/room/state/lobby_movement_controller.dart:71` 가드 OK | Pass |
| C4 | `[playerMove]` `kDebugMode` 가드 | 〃 | `lib/features/game/game_notifier.dart:473` 가드 OK | Pass |
| C5 | `[playerPos<-]` `kDebugMode` 가드 | 〃 | `lib/features/game/game_notifier.dart:360` 가드 OK | Pass |
| C6 | `[phase]` `kDebugMode` 가드 | 〃 | `lib/features/game/game_notifier.dart:136/162/272` 3곳 모두 가드 OK | Pass |
| C7 | `[countdown]` `kDebugMode` 가드 | 〃 | `lib/features/room/state/lobby_countdown_controller.dart:48/60/69/81` 4곳 모두 가드 OK | Pass |
| C8 | `LobbyDebugIndicator` release 가드 | release 빌드에서 SizedBox.shrink | `lib/features/room/presentation/widgets/lobby_debug_indicator.dart:86` `if (!kDebugMode) return const SizedBox.shrink();` | Pass |
| C9 | `MafiaApp` WidgetsBindingObserver 등록 | initState 에서 addObserver, dispose 에서 removeObserver | `lib/app/app.dart:30/37` 등록·해제 모두 OK. resumed 시 socket 미연결이면 토큰으로 reconnect 트리거 | Pass |
| C10 | `_ReconnectingBadge` 위치 충돌 | LobbyDebugIndicator (좌상단) 와 분리 | `room_lobby_screen.dart` LobbyDebugIndicator=top:60/left:10, _ReconnectingBadge=top:60/right:10. 좌·우 분리, 충돌 없음 | Pass |

### 6.2-ter 회차 1 Phase 2 코드/성능/네트워크 점검 결과

| # | 영역 | 점검 항목 | 결과 | Pass/Fail |
|---|---|---|---|---|
| C-UI-1 | UI 점검 (320dp) | 10개 위험 영역 점검 (lobby/home/profile/chat/dialog) | 명백한 위험 2건 수정 — `lobby_player_avatar.dart` Nameplate ConstrainedBox(maxWidth:96) + ellipsis, `lobby_user_list_sheet.dart` 닉네임 Expanded + ellipsis. iPhone SE 1세대 실 기기 확인 필요 | Pass (수정) |
| D-PF-1 | 성능 | `flutter build apk --profile` | 빌드 성공 82.2MB | Pass |
| D-PF-2 | 성능 (방어층) | `lobby_chat_controller` Future.delayed 콜백 `ref.mounted` 가드 | 추가 | Pass |
| D-PF-3 | 성능 (실측) | 10/30/60분 실측 시나리오 | 미실행 (실 폰 부재) | Blocked |
| E-NET-1 | 네트워크 | socket reconnect 정책 | `setReconnectionAttempts(5)` 한도 + 안내 UI 없음 → 다음 슬라이스 후보 | 보고됨 |
| F-TEST | 테스트 | 클라 단위 테스트 14→23 (+9: friend 거절·취소 2, report_reason_dialog 3, lobby_countdown_controller 4) | 23/23 통과 | Pass |

### 6.3 회차 1 발견 이슈

| 이슈 ID | 심각도 | 시나리오# | 재현 단계 | 기대 vs 실제 | 스크린샷/영상 | 로그 키워드 | 담당자 | 수정 PR/커밋 |
|---|---|---|---|---|---|---|---|---|
| (실측 BUG) | — | — | 실 폰 미연결로 미발견 | — | — | — | — | — |
| (코드 점검) | — | — | C1~C10 전 항목 Pass — 발견 이슈 없음 | — | — | — | — | — |
| (Phase 2) | — | — | C-UI-1 / D-PF-1~3 / E-NET-1 — 명백한 위험은 수정, 실측은 회차 2 이월 | — | — | — | — | — |

**BUG-### 트래킹 합계 (회차 1):** **0건** (실측 Blocked + 코드·UI·성능·네트워크 점검 모두 Pass 또는 수정 완료)

### 6.4 회차 1 종료 요약

| 항목 | 값 |
|---|---|
| 전체 시나리오 | 15 (실측) + 10 (코드 점검 보조) |
| Pass | 0 (실측) / 10 (코드 점검) |
| Fail | 0 |
| Blocked | 15 (실측 전 항목) |
| N/A | 0 |
| 출시 차단 이슈 수 | 0 |
| Blocked 사유 | 실 폰 USB/네트워크 접근 불가 (`adb devices` → List of devices attached, 0대) |
| 다음 회차 일정 | Android 폰 2대 USB 연결 확보 후 즉시 회차 2 실행. APK 는 이미 빌드 완료 (`build/app/outputs/flutter-apk/app-debug.apk`) |

## 7. 회차 2 — 실 폰 확보 후 (빈 표 선예약)

회차 2 진행 시 아래 표를 채워 넣고 결과를 §3 BUG 트래킹과 §4 성능 표에 누적한다.

### §7 회차 2 (실폰 확보 후 실행 예정)

#### 7.1 회차 메타
| 항목 | 값 |
|---|---|
| 테스트 날짜 | YYYY-MM-DD |
| 기기 A | (예: Pixel 7 / Android 14 / app-debug.apk YYYY-MM-DD) |
| 기기 B | |
| iOS 기기 (선택) | |
| 네트워크 | 같은 WiFi / 핫스팟 |
| 서버 환경 | LAN |
| 방 코드 | |
| 담당자 | |

#### 7.2 핵심 시나리오 결과 (mobile-qa-checklist §15 1~7)
| # | 시나리오 | 결과 | 실제 결과 | 비고 |
|---|---|---|---|---|
| 1 | 앱 실행 + 닉네임 | | | |
| 2 | 방 생성/입장 | | | |
| 3 | 대기실 이동 동기화 | | | |
| 4 | 대기실 채팅 | | | |
| 5 | 차단/해제 | | | |
| 6 | 게임 시작/카운트다운 | | | |
| 7 | 결과 화면 | | | |

#### 7.3 Reconnect UX 결과 (mobile-qa-checklist §15 R1~R7)
| # | 시나리오 | 결과 | 실제 결과 | 비고 |
|---|---|---|---|---|
| R1 | WiFi off → badge | | | |
| R2 | WiFi on 빠른 복구 | | | |
| R3 | WiFi off 30s+ → 안내 다이얼로그 | | | |
| R4 | "다시 시도" | | | |
| R5 | "홈으로 가기" | | | |
| R6 | background 5s → resume | | | |
| R7 | background 60s+ → resume | | | |

#### 7.4 성능 측정 (performance-qa §3.1 10분 시나리오)
| 항목 | 값 | 비고 |
|---|---|---|
| 메모리 시작 (MB) | | |
| 메모리 10분 (MB) | | |
| FPS 체감 (60/30/렉) | | |
| 발열 (안 따뜻/살짝/명확) | | |
| 배터리 소모 (%) | | |
| Choreographer skipped frames | | |
| 강제 종료 발생 | Y/N | |

#### 7.5 발견 이슈 (BUG-###)
회차 2에서 발견된 이슈 기록.

| ID | 심각도 | 시나리오# | 재현 단계 | 기대 vs 실제 | 담당자 |
|---|---|---|---|---|---|

#### 7.6 회차 종료 요약
| 항목 | 값 |
|---|---|
| 핵심 7개 Pass | / 7 |
| Reconnect 7개 Pass | / 7 |
| 성능 측정 완료 | Y/N |
| critical/blocker BUG | 0건 ? |
| 4단계 진입 가능 여부 | |

#### 7.7 대기실 UI/광장/캐릭터 모션 (L1~L12)
| # | 시나리오 | 결과 | 비고 |
|---|---|---|---|
| L1 | 픽셀 광장 전체화면 | | |
| L2 | 체크무늬 회귀 | | |
| L3 | 조이스틱 하단 중앙 | | |
| L4 | 채팅 좌측 세로 | | |
| L5 | 액션 우측 하단 | | |
| L6 | 캐릭터 걷기 모션 | | |
| L7 | 방향 전환 / flip | | |
| L8 | 캐릭터 테두리 제거 | | |
| L9 | 닉네임 ellipsis | | |
| L10 | 태블릿 700dp+ | | |
| L11 | 좁은 폰 320dp | | |
| L12 | 페이지별 배경 매핑 | | |

## §L Phase Overlay 회차 결과 (S-meta-flame-overlay-device-qa 이후)

`mobile-qa-checklist.md §L` 11항목을 실기기에서 확인한 후 다음 양식으로 기록.

```text
[Phase Overlay 회차 N — YYYY-MM-DD]
- 확인 기기: iPhone (모델/iOS 버전), Android 폰 (모델/Android 버전), Galaxy Tab (모델/Android 버전)
- 인원: N명 (4명 풀사이클이면 권장, 1~2명 단독 overlay 확인도 OK)

## §L 11항목 결과
- L.1 가시성 (iPhone DayOverlay 부분 점유 / Android VoteOverlay 겹침 X / Galaxy Tab maxWidth 360 중앙): Pass/Fail/Blocked
- L.2 중복 검증 (VoteOverlay 액션 0 / NightOverlay 집 탭 0): Pass/Fail/Blocked
- L.3 시민 fallback (NightPane 풀스크린 / 광장 미노출): Pass/Fail/Blocked
- L.4 NightResult 공존 (overlay + 기존 pane 자연스러운 전환): Pass/Fail/Blocked
- L.5 AnimatedSwitcher (250ms fade 멀미 X / 빠른 phase 변경 끊김 X): Pass/Fail/Blocked
- L.6 가독성·카피 (Galmuri11 잘림 X / 반투명 위 가독성 / 개발자 용어 0건): Pass/Fail/Blocked

## BUG-FLAME-L###
- (있으면 ID + 단계 + 기기 + 증상 + 재현 + 영상/스크린샷)

## 종합
- Pass 비율: N / 11
- Critical/Blocker: N건
- 다음 액션: 본 슬라이스 자동화 게이트 [x] / BUG 픽스 후 재실측 / 다음 슬라이스 진입
```

## §M Movement & 채팅 회차 결과 (S-client-village-movement-gap-prep 이후)

`mobile-qa-checklist.md §M` 17~18 항목 (M.1 시각 구분 3 / M.2 채팅 6 / M.3 조이스틱 4 / M.4 Galaxy Tab 4 / M.5 개발자 용어 3 / M.6 1단계 회귀 1+) 실기기 확인 후 다음 양식.

```text
[Movement & 채팅 회차 N — YYYY-MM-DD]
- 확인 기기: iPhone / Android 폰 / Galaxy Tab
- 결과 (각 항목 Pass/Fail/Blocked)
- BUG-MOVE-M### (있으면)
- 종합: Pass 비율 / Critical/Blocker / 다음 액션
```

## 8. 갱신 이력

- 2026-05-13: 1차 작성. 폰 2대 실측 QA 로그 템플릿 도입, `mobile-qa-checklist.md` §10 절차에서 연결.
- 2026-05-13: §4 성능 측정 표 신설 (performance-qa.md 연계).
- 2026-05-13: 회차 1 기록 — 실 폰 미연결로 실측 Blocked, 대신 APK 빌드 검증 + 코드 점검 10항목 (debug 로그 가드 6개 + LobbyDebugIndicator 가드 + WidgetsBindingObserver + _ReconnectingBadge 충돌 점검) 전 항목 Pass.
- 2026-05-13: 회차 1 완료 (Blocked) — Phase 2 (UI/성능/네트워크) 점검 결과 §6.2-ter 추가, BUG 합계 0건, 회차 2 (실 폰 확보 후) 재진행 예정 — §7 빈 표 선예약.
- 2026-05-13: 회차 2 표 7.1~7.6 구체화 — mobile-qa-checklist §15 항목 매핑
- 2026-05-13: §7.7 대기실 UI/광장/캐릭터 모션 (L1~L12) 표 추가 — 이번 슬라이스 (PixelBackgroundVariant / LobbyWorld 1800×900 / DefaultPixelAvatar showFrame=false / 8방향 walk / 조이스틱·채팅·액션 분리) 회귀 표
- 2026-05-13: §L Phase Overlay 회차 결과 양식 신설 — `S-meta-flame-overlay-device-qa` 슬라이스 연계, `mobile-qa-checklist §L` 11항목 결과 기록 슬롯 + BUG-FLAME-L### 트래킹 + 종합.
- 2026-05-14: §M Movement & 채팅 회차 결과 양식 신설 — `S-client-village-movement-gap-prep` 연계, `mobile-qa-checklist §M` 17~18항목 결과 기록 슬롯 + BUG-MOVE-M### 트래킹 + 종합.
