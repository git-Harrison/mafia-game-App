# 모바일 QA 체크리스트 — 폰 2대 실 테스트 전 점검표

> 함께 읽기: `realtime-sync-checklist.md` (WS 동기화), `safety-reporting.md` (신고·차단),
> `release-readiness.md` (출시 전 readiness).
> 본 문서는 1단계 MVP 클라이언트 마감 직후 실 테스트 직전에 한 번에 훑는 운영 체크리스트.

## 0. 개요

- 도트 마피아 1단계 MVP 폰 2대 실 테스트 전 QA 체크리스트.
- 클라이언트 마감 기준 — 서버 변경 없음.
- 본 문서는 코드 추적용이 아닌 **수동 검증 체크리스트**. 매 슬라이스 종료 시 갱신.
- 우선순위: 1. 키보드 · 2. 라우트 · 3~6. 기능 mock · 7. 작은 화면 · 8. 실기기 매트릭스.

## 1. 키보드 대응

채팅·닉네임·방코드 입력 화면에서 소프트 키보드가 입력창과 액션 버튼을 가리지 않는지 확인.

- [ ] 닉네임 입력 화면 — 키보드가 입력창과 다음 버튼을 가리지 않음
- [ ] 방코드 입력 다이얼로그 — 키보드 등장 시 입장 버튼 접근 가능
- [ ] 대기실 채팅 input — 키보드 등장 시 채팅 input 이 키보드 위로 올라옴, 조이스틱·액션 버튼은 숨김
- [ ] 인게임 낮 채팅 / 마피아 채팅 input — 동일
- [ ] 외부 탭 시 키보드 자동 닫힘 (DismissKeyboardOnTap)

## 2. 라우트 점검

라우트 진입 자체가 깨지지 않는지 (white screen / red screen / 무한 로딩 X).

- [ ] `/home` 인증 후 정상 진입
- [ ] `/my-page` 마이페이지 진입
- [ ] `/friends` 친구 목록 / 받은 요청 / 보낸 요청 3탭
- [ ] `/settings` 설정 5섹션
- [ ] `/settings/blocked-users` 차단 목록
- [ ] `/notice` 공지 / 이벤트 목록 + 상세 다이얼로그
- [ ] `/guide` 게임 방법 8섹션
- [ ] `/legal/terms` 이용약관 placeholder
- [ ] `/legal/privacy` 개인정보처리방침 placeholder
- [ ] `/support` 고객센터 placeholder
- [ ] `/room/:roomId` 대기실 진입
- [ ] `/game/:roomId` 인게임 진입

## 3. 친구 mock 동작

1단계 친구는 클라 mock — 서버 호출 없음. UI 흐름과 빈 상태 카피만 점검.

- [ ] 친구 목록 mock 3명 표시
- [ ] 받은 요청 수락 → 친구 목록으로 이동
- [ ] 받은 요청 거절 → 사라짐
- [ ] 보낸 요청 취소
- [ ] 친구 삭제 확인 다이얼로그 동작
- [ ] 빈 상태 카피 노출 (목록 0건 / 요청 0건)

## 4. 차단 동작

차단은 클라 local set (SharedPreferences). 서버 영속 X. 본인 화면에서만 적용.

- [ ] 프로필 팝업에서 차단 → 채팅에서 즉시 숨김
- [ ] 차단 목록 화면에서 해제 → 다시 채팅 노출
- [ ] 시스템 메시지 / 카운트다운은 차단 영향 없음
- [ ] 빈 상태 카피 노출 (차단 0건)

상세 정책: `safety-reporting.md` §4.

## 5. 신고 동작

신고는 클라 mock — 서버 전송 X, kDebugMode 로그만. 사유 enum 은 `safety-reporting.md` §2.

- [ ] 프로필 팝업 신고 → 사유 5개 다이얼로그
- [ ] 사유 선택 → SnackBar
- [ ] 재신고 시 placeholder
- [ ] kDebugMode 로그만 (서버 전송 X)

## 6. 공지 / 가이드

공지·이벤트 카드 mock 데이터, 가이드 8섹션 static.

- [ ] 홈 이벤트 배너 탭 → `/notice`
- [ ] 공지 카드 탭 → 상세 다이얼로그
- [ ] 마이페이지 게임 방법 → `/guide`
- [ ] 가이드 8섹션 스크롤 OK

## 7. 작은 화면 (≤ 360dp) 회귀

iPhone SE (320dp 폭) 기준 모든 화면 overflow 없음 보장.

- [ ] 320dp 폭 iPhone SE — 어떤 화면도 overflow 없음
- [ ] 긴 닉네임 (10자) ellipsis
- [ ] 긴 공지 제목 (20자) maxLines 2
- [ ] 친구 요청 카드 0~여러 개 모두 깨짐 없음
- [ ] 키보드 등장 화면 overflow 없음

## 8. 실기기 매트릭스 — 폰 2대 동시 시연

WS 동기화 상세는 `realtime-sync-checklist.md`. 본 섹션은 매트릭스 조합만.

- [ ] Android 1대 + iOS 1대 동시 시연
- [ ] 또는 Android 2대 (LAN / 핫스팟)
- [ ] 위치 동기화 (대기실 `lobbyMove`)
- [ ] 카운트다운 양쪽 동기 ±200ms
- [ ] 채팅 양방향 즉시 표시

## 10. 폰 2대 QA 단계 절차

대기실 → 카운트다운 → 채팅 → 차단/해제까지 한 흐름으로 묶은 실측 시나리오. 항목별 OK/NG 만 표시.

### 10.1 사전 준비

- [ ] 두 폰 같은 WiFi (또는 한쪽 폰 핫스팟) — Mac LAN 도달 가능해야 함. 설치 절차 상세는 [android-debug-qa.md](./android-debug-qa.md) 참조.
- [ ] 서버 실행 — `docker compose up -d db` + `cd server && pnpm start:dev`.
- [ ] LAN IP 확인 후 `flutter run --release -d <phone-id> --dart-define=API_BASE_URL=http://<ip>:3000` 양 폰 설치.
- [ ] 서버 로그 콘솔 한 창 + 폰 A `flutter logs` + 폰 B `flutter logs` 3창 띄움.

### 10.2 같은 방 입장

- [ ] Phone A — 닉네임 입력 → 홈 → "방 만들기" (4명 슬롯) → `/room/:roomId` 진입.
- [ ] 방 코드 (6자리) 메모.
- [ ] Phone B — 닉네임 입력 → 홈 → "방 코드 입력" 다이얼로그 → 같은 `/room/:roomId` 진입.
- [ ] 양 폰 멤버 리스트에 서로 보임.

### 10.3 위치 동기화 (`lobbyMove`)

- [ ] Phone A 조이스틱 이동 → Phone B 화면에서 A 캐릭터가 **100~120ms 이내** 따라감.
- [ ] Phone B 의 debug indicator (kDebugMode) `pos <ms> ago` 가 100ms 안팎으로 갱신.
- [ ] 반대 방향도 동일 — 양방향 위치 broadcast OK.

### 10.4 카운트다운 ±200ms

- [ ] 4명 채워질 때까지 (필요 시 2대 더 추가) → 4명 충족 시 5초 카운트다운 시작.
- [ ] 양쪽 화면에 "5/4/3/2/1" 시스템 메시지가 **±200ms 안에** 동기 표시.
- [ ] 카운트다운 중 누구든 나가면 즉시 취소 — 양쪽 동시 취소.

### 10.5 대기실 채팅 양방향

- [ ] Phone A 채팅 "안녕" → Phone B 채팅창 + 캐릭터 위 말풍선 표시.
- [ ] Phone B 채팅 "반가워" → Phone A 화면에 표시.
- [ ] rate limit (800ms 내 연속) → `LOBBY_CHAT_RATE_LIMITED` 토스트 노출.

### 10.6 차단 후 채팅 숨김

- [ ] Phone A 가 Phone B 프로필 팝업 → 차단 → 차단 확인 다이얼로그 → 차단.
- [ ] Phone B 채팅 → **Phone A 화면에 안 보임** (채팅창 + 말풍선 모두).
- [ ] Phone A 채팅 → Phone B 화면엔 정상 노출 (차단은 본인 화면에서만 적용).

### 10.7 차단 해제 후 다시 노출

- [ ] Phone A 의 설정 → 차단 목록 → Phone B 닉네임 → 해제 다이얼로그 → 해제.
- [ ] Phone B 채팅 → Phone A 화면에 다시 노출.
- [ ] 차단 목록 0건 빈 상태 카피 노출.

### 10.8 인게임 진입 (선택)

- [ ] 4명 채워서 카운트다운 종료 후 startGame.
- [ ] `assignRoles` / `housesAssigned` 양 폰 정상 수신.
- [ ] `phaseChanged` 동기 — 양 폰 `DAY_DISCUSSION` 진입 시각 ±200ms.

실측 결과는 [mobile-qa-log-template.md](./mobile-qa-log-template.md) 의 표 템플릿에 기록.

## 11. 키보드 QA 화면별 분리

§1 의 키보드 항목을 화면별로 풀어서 한 번 더 점검.

### 11.A 닉네임 화면

- [ ] 키보드 등장 시 닉네임 입력창이 가려지지 않음.
- [ ] "다음" 버튼이 키보드 위로 올라옴 (또는 키보드 위에 노출 유지).
- [ ] 외부 영역 탭 시 키보드 자동 닫힘.
- [ ] SafeArea + SingleChildScrollView 로 작은 화면도 안전.

### 11.B 방코드 다이얼로그 (`/home` → "방 코드 입력")

- [ ] PixelDialog 가 `viewInsets.bottom` 을 반영 (insetPadding.bottom 적용).
- [ ] 입장 버튼이 키보드 위로 올라옴.
- [ ] 외부 탭 시 DismissKeyboardOnTap 동작.

### 11.C 대기실 채팅 (`/room/:roomId` 좌하단)

- [ ] 키보드 등장 시 채팅 input 이 키보드 위로 올라옴.
- [ ] 조이스틱 / 액션 버튼은 비표시 (`Visibility(visible: false)`).
- [ ] 채팅 송신 후 input unfocus.

### 11.D 인게임 낮 채팅 (`/game/:roomId`)

- [ ] Scaffold `resizeToAvoidBottomInset` 기본 동작.
- [ ] 채팅 input 가림 없음.

### 11.E 인게임 마피아 채팅 (`NIGHT_MAFIA`)

- [ ] 11.D 와 동일 — 마피아 전용 채팅도 가림 없음.

## 12. 작은 화면 (≤ 360dp) 명시 회귀

§7 의 일반 항목을 디바이스 / 시나리오로 풀어서 점검.

- [ ] iPhone SE 1세대 (320dp 폭) — 모든 화면 RenderFlex overflow 로그 없음.
- [ ] 긴 닉네임 "MaximumLen10" (10자) → 채팅 / 멤버 리스트 ellipsis.
- [ ] 긴 공지 제목 (20자 이상) → maxLines 2 + ellipsis.
- [ ] 친구 요청 카드 0/1/3/5개 — 깨짐 없음, 빈 상태 카피 정상.
- [ ] 마이페이지 `ProfileStatsPanel` 5칸 → Wrap 또는 비율 조정으로 줄바꿈 자연.
- [ ] 가이드 `GuideSectionCard` 본문 줄바꿈 자연 (320dp 폭에서 잘림 없음).

## §14 성능 측정

실 디바이스 성능 (메모리/FPS/배터리/발열) 측정은 별도 절차:
[performance-qa.md](./performance-qa.md)

성능 실측 결과는 mobile-qa-log-template §4 성능 측정 표에 기록.

## §15 회차 2 실폰 QA 핵심 시나리오 (실폰 확보 후 즉시 실행)

### 사전 조건
- [ ] Android 실폰 최소 1대 (권장 2대, 같은 WiFi)
- [ ] iOS 실기기 1대 또는 시뮬레이터 (선택)
- [ ] Mac LAN IP 확인 후 `--dart-define=API_BASE_URL=http://<mac-ip>:3000`
- [ ] 서버 가동 (`docker compose up -d db && cd server && pnpm start:dev`)
- [ ] 폰들이 Mac LAN 도달 가능 (`http://<mac-ip>:3000/health` 폰 브라우저 200)

### 7개 핵심 시나리오
| # | 시나리오 | 기대 결과 | 비고 |
|---|---|---|---|
| 1 | 앱 실행 + 닉네임 입력 | 닉네임 입력 → 홈 진입 | 키보드 가림 없음 |
| 2 | 방 생성 + 다른 폰에서 입장 | 같은 /room/:roomId 진입 | 멤버 2명 표시 |
| 3 | 대기실 위치 동기화 | A 조이스틱 → B 화면 100~120ms 이내 캐릭터 따라감 | `[lobbyMove]`/`[lobbyPos<-]` 로그 짝 |
| 4 | 대기실 채팅 | A 채팅 → B 채팅창 + 말풍선 양방향 | |
| 5 | 차단/해제 | A 가 B 차단 → 채팅 숨김 → 해제 → 다시 노출 | |
| 6 | 게임 시작/카운트다운 | 4명 채워 5초 카운트다운 → IN_GAME 전환 | 양쪽 ±200ms 동기 |
| 7 | 결과 화면 | 한 사이클 완료 → 승리/패배 + 생존/사망 배지 양쪽 일관 | |

### Reconnect UX 시나리오 (회차 2 필수)
| # | 시나리오 | 기대 결과 |
|---|---|---|
| R1 | WiFi off (5초) | `다시 연결 중…` badge 노출 |
| R2 | WiFi on 빠른 복구 | badge 사라짐, 게임 정상 진행 |
| R3 | WiFi off 30초+ → on | reconnect 5회 시도 실패 → 안내 다이얼로그 |
| R4 | 다이얼로그 "다시 시도" | reconnect 재시도 |
| R5 | 다이얼로그 "홈으로 가기" | /home 안전 이동 |
| R6 | background 5초 → resume | Flame resume + socket 정상 |
| R7 | background 60초+ → resume | 방 상태 안내 → 다이얼로그 |

### 회차 2 추가 — 대기실 UI/광장/캐릭터 모션 (이번 슬라이스)
| # | 시나리오 | 기대 결과 |
|---|---|---|
| L1 | 대기실 진입 | 픽셀 광장 (잔디 + 돌길 + 분수 + 집4 + 나무 + 가로등) 전체화면 표시 |
| L2 | 체크무늬 배경 회귀 | 어느 화면에도 체크무늬 없음 (홈/마이페이지/설정/공지/가이드/legal) |
| L3 | 조이스틱 위치 | 하단 중앙 — 손가락 자연스러움 |
| L4 | 채팅 위치 | 좌측 세로형 — 조이스틱과 안 겹침 |
| L5 | 액션 버튼 위치 | 우측 하단 — 채팅·조이스틱과 안 겹침 |
| L6 | 캐릭터 걷기 모션 | 조이스틱 이동 시 다리 swap + bob, 멈추면 idle |
| L7 | 캐릭터 방향 | 좌/우 이동 시 캐릭터 flip, 위/아래 이동 시 정면 |
| L8 | 캐릭터 테두리 | 박스/테두리 없음. 본인은 발밑 작은 그림자 |
| L9 | 닉네임 라벨 | 캐릭터 머리 위 작은 패널, 긴 닉네임 ellipsis |
| L10 | 태블릿 (700dp+) | 조이스틱·채팅 너무 퍼지지 않음 (캡 적용) |
| L11 | 좁은 폰 (320dp) | overflow 없음, 채팅 폭 200, 조이스틱 96 |
| L12 | 페이지별 배경 | home=village / my-page=paper / settings=plain / notice=document |

### 결과 기록
모든 항목 결과는 [`mobile-qa-log-template.md`](./mobile-qa-log-template.md) 회차 2 표에 Pass/Fail/Blocked 기록.

실측하지 않은 항목 절대 Pass 표시 금지 — Blocked 또는 "회차 2 확인 예정" 명시.

## L. Phase Overlay 실기기 확인 (S-client-flame-phase-overlay, 2026-05-14~)

Flame village view 위에 phase 별 안내 overlay 4종 + AnimatedSwitcher 디스패처가 결합됨.
다음 항목을 실기기에서 확인. 미실측 항목은 "확인 예정" 으로 표시.

### L.1 overlay 가 맵을 과하게 가리지 않는가
- [ ] **iPhone (작은 화면)** — DayOverlay 가 Flame village 광장을 덮지 않고 상단/하단 일부만 점유 (확인 예정)
- [ ] **Android 폰** — VoteOverlay 가 vote_pane 액션 영역과 시각적으로 겹치지 않음 (확인 예정)
- [ ] **Galaxy Tab** — overlay 가 maxWidth 360 으로 중앙 정렬, 좌우 여백 자연스러움 (확인 예정)

### L.2 vote/night action UI 중복 확인
- [ ] VoteOverlay 가 action 버튼 제공 0건 — 실제 투표는 기존 `vote_pane.dart` (확인 예정)
- [ ] NightOverlay 가 집 탭 액션 제공 0건 — 실제 집 탭은 기존 `night_pane.dart` (확인 예정)

### L.3 시민 밤 fallback 자연스러움
- [ ] 시민/비-actor 가 밤 진입 시 `_useFlameView=false` → NightPane 풀스크린 ("마을이 조용합니다…") 표시 (확인 예정)
- [ ] 시민 화면이 광장 (Flame view) 으로 새어 보이지 않음 (확인 예정)

### L.4 NightResultOverlay 와 기존 night_result_pane 공존
- [ ] NightResultOverlay 의 얇은 안내 + 기존 night_result_pane 의 사망자 표시 동시에 표시되거나 자연스럽게 전환 (확인 예정)

### L.5 AnimatedSwitcher 전환
- [ ] phase 전환 시 250ms fade 가 과하지 않음 (멀미 / 깜빡임 X) (확인 예정)
- [ ] phase 가 빠르게 변할 때 (예: VOTE_SELECT 30s → VOTE_CONFIRM 20s → EXECUTION 3s) overlay 전환이 끊김 없이 부드러움 (확인 예정)

### L.6 가독성 (iOS / Android / Galaxy Tab)
- [ ] 카피 폰트 (Galmuri11) 가 작은 화면에서 잘림 X (확인 예정)
- [ ] 반투명 배경 위에서 한국어 카피 가독성 OK — Galaxy Tab 큰 화면에서도 적절한 크기 (확인 예정)
- [ ] 개발자 용어 (socket, phase enum, debug, server) 노출 0건 (자동 grep + 실기기 cross-check) (확인 예정)

> 회차 누적 시 결과 일자 + 기기 + Pass/Fail 기록. 자동 grep 결과는 자동화 게이트로, 실기기 가독성은 수동 게이트로.

## M. 광장/대기실 Movement & 채팅 실기기 확인 (S-client-village-movement-gap-prep, 2026-05-14~)

본 슬라이스에서 코드 기준 잔여 UX 마감 완료. 다음 항목은 실기기에서만 확인 가능.
실기기 §L 11항목과 함께 검증 권장.

### M.1 본인 캐릭터 시각 구분 (Agent B)
- [ ] iPhone — 발밑 노란 타원 + 닉네임 골드 식별 가능 (확인 예정)
- [ ] Android 폰 — 동일 (확인 예정)
- [ ] Galaxy Tab — 큰 화면에서도 미묘하지 않음 (확인 예정)

### M.2 채팅 compact/expanded UX (Agent C)
- [ ] compact 56dp 3줄 표시 (확인 예정)
- [ ] expanded 화면 30% 8줄 + 입력창 (확인 예정)
- [ ] 헤더 탭 토글 정상 동작 (확인 예정)
- [ ] 키보드 등장 시 자동 expanded (확인 예정)
- [ ] 광장 시야 보존 — 좌측 세로형 + 조이스틱 겹침 X (확인 예정)
- [ ] 마피아 페이즈 + 마피아 본인일 때 빨강 보더 (확인 예정)

### M.3 조이스틱 속도 / idle (Agent D)
- [ ] 4방향 (상하좌우) 속도 일관 (확인 예정)
- [ ] 대각선 속도 4방향과 동등 (Flame normalize 동작 검증) (확인 예정)
- [ ] joystick 0 → 즉시 idle frame 고정 (흔들림 X) (확인 예정)
- [ ] 원격 플레이어 위치 변화 종료 후 idle 자연 전환 (확인 예정)

### M.4 Galaxy Tab / 넓은 화면 (Agent E)
- [ ] phase overlay maxWidth 360 — 큰 화면에서 좁아 보이지 않음 (확인 예정)
- [ ] chat overlay 너무 퍼지지 않음 (확인 예정)
- [ ] VillagePane letterbox navy 톤 일관 (확인 예정)
- [ ] 캐릭터 sprite 큰 화면에서도 가독성 OK (확인 예정)

### M.5 사용자 화면 개발자 용어 노출 (자동 grep으로 0건 통과, 실기기 시각 cross-check)
- [ ] iPhone (확인 예정)
- [ ] Android 폰 (확인 예정)
- [ ] Galaxy Tab (확인 예정)

### M.6 1단계 회귀 안전망 유지
- [x] 자동화 6/6 그린 (analyze / test 39/39 / build / server 150 / contract 0 / grep 0)
- [ ] 실기기 1단계 9 Step 회귀 X (확인 예정 — §L 1단계 풀사이클과 동시 확인 가능)

> 회차 누적은 `mobile-qa-log-template.md §M` 양식 사용 (Agent F 신설).

## 13. 갱신 이력

- 2026-05-13: 1차 작성. 1단계 MVP 클라이언트 마감 직전 폰 2대 실 테스트 직전 체크리스트로 도입.
- 2026-05-13: §10 폰 2대 단계별 절차 / §11 키보드 화면별 분리 / §12 작은 화면 명시 회귀 보강. friends/report repository 경계 도입 슬라이스에 맞춰 갱신.
- 2026-05-13: mobile-qa-log-template.md 신규 + §10 절차에서 링크
- 2026-05-13: android-debug-qa.md 신규 + §10 절차에서 링크
- 2026-05-13: performance-qa.md 신규 + §14 링크
- 2026-05-13: 출시 전 안정화 슬라이스 완료 — performance-qa 링크 추가, 16개 시나리오 점검 권장
- 2026-05-13: 1차 QA 슬라이스 — 실 폰 Blocked, 코드 점검 Pass, 다음 슬라이스 실측 권장
- 2026-05-13: §15 회차 2 핵심 시나리오 신설 — 실폰 확보 후 즉시 실행
- 2026-05-13: §15 회차 2 L1~L12 (대기실 UI/광장/캐릭터 모션) 추가 — PixelBackgroundVariant 6종 + LobbyWorld 1800×900 + DefaultPixelAvatar showFrame=false + 8방향 walk + 조이스틱·채팅·액션 분리 슬라이스 반영
- 2026-05-14: §L Phase Overlay 실기기 확인 (S-client-flame-phase-overlay) 신설 — overlay 가시성·중복·시민 fallback·AnimatedSwitcher·가독성 6항목 모두 "확인 예정" 슬롯.
- 2026-05-14: §M 광장/대기실 Movement & 채팅 실기기 확인 (S-client-village-movement-gap-prep) 신설 — 본인 캐릭터 시각 구분(3) / 채팅 compact-expanded(6) / 조이스틱 idle(4) / Galaxy Tab(4) / 개발자 용어(3) / 1단계 회귀(1) 총 17~18 항목 모두 "확인 예정" 슬롯.
