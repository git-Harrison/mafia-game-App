# 12세 이용가 카피 가이드라인

> 클라이언트 UI 카피 (Korean) 작성 정책. 자체 작성 의무는
> `mafia-app-design-policy.md` §2 (3)·(4) 와 함께 적용한다.

## 0. 한 줄 요약

12세 이용가 한국어 카피 원칙 — 도트 마피아 톤은 유지하면서 표현만 안심형으로.

## 1. 사용 가능 단어

- **게임 직업** (장르 표준 일반어): 시민, 경찰, 의사, 마피아
- **게임 흐름**: 낮 토론, 투표, 밤 행동, 결과, 탈락, 승리, 패배
- **시스템**: 안내, 알림, 확인, 진행, 기다려요, 살펴봐요

## 2. 사용 금지 단어 (대체 매핑)

| 금지 | 대체 |
|---|---|
| 죽임 / 처형 / 살해 | 탈락 / 투표 결과 / 지목 |
| 사망 | 탈락 (게임 결과 배지는 예외) |
| 응징 / 잔인 / 협박 / 피 | 사용 X |
| 어둠이 삼켰다 / 광장을 삼켰다 | 마을의 밤이 더 깊어졌어요 |
| 습격 | 찾아가다 / 노리다 |
| 제거 | 찾아내다 / 탈락시키다 |

## 3. 신고/차단 톤

- "검토 후 조치합니다" → "안전한 플레이를 위해 내용을 확인할게요"
- "이미 신고한 사용자입니다" → "이미 신고했어요"
- "차단했습니다. ~ 숨겨집니다" → "차단했어요. ~ 숨겨져요"
- 차단/해제 동작은 안심형 톤 (Agent B 가 차단 목록 다이얼로그·SnackBar 정리 완료)

## 4. 연결 오류 톤

- "socket", "server", "disconnect", "reconnect" 같은 개발자 용어 사용자 노출 금지
- 부드러운 안내 톤 — "연결이 잠시 끊겼어요", "다시 연결 중…", "잠시 자리를 비운 사이 방 상태가 바뀐 것 같아요"
- 사용자에게 항상 복구 행동 제시 — "다시 시도", "홈으로 가기"
- 에러 원인 단정 X — "방 상태가 바뀐 것 같아요" (확률), "네트워크 문제일 수 있어요" (조건)
- 카피는 `client/lib/shared/copy/connection_copy.dart` 의 `ConnectionCopy` 상수로 일원화

## 5. 결과 화면

- `PixelBadge`의 "사망" / "생존" 배지는 게임 룰 표현으로 유지 — 의미 명확 우선 (mafia-app-context.md §5-4 검증 함수와 1:1 매핑)
- NIGHT_RESULT 화면 본문은 "이번 밤에 탈락한 플레이어" 처럼 부드러운 톤 사용
- 패배 시 "다음 판은 더 잘할 수 있어요" 같은 격려 톤 유지

## 6. Apple/Google 등급 대응

- 12세 권장 (사용자 채팅 + 신고/차단 시스템 보유)
- 욕설 자동 필터는 출시 후 도입 — 1단계는 신고/차단으로 대응
- 카피 정기 검토 — 출시 후 분기마다

## 7. 자체 작성 정책 (design-policy §2 (3)·(4))

- 다른 마피아 게임의 시그니처 카피 직역 금지 (예: "Town has spoken", "Among Us!", "마피아가 당신을 노립니다" 한국어 의역 등)
- 기능 서술형 + 일반어 사용 (예: "투표 결과", "한 명을 골라요")
- 직업명은 시민/경찰/의사/마피아 일반어 그대로

## 8. 톤 예시 (권장 카피)

- "탈락"
- "밤 사이 사건이 일어났어요"
- "투표로 한 명을 지목해요"
- "불편한 플레이어는 차단할 수 있어요"
- "안전한 플레이를 위해 신고 내용을 확인할게요"
- "모두가 즐겁게 플레이할 수 있도록 배려해 주세요"

## 9. Phase Overlay 카피 원칙 (2단계 Flame view HUD)

Flame 도트 마을 뷰 위에 얹히는 phase 안내 overlay 의 카피는 다음 원칙을 따른다.
1단계 풀스크린 Material pane 카피는 §1~§8 기존 정책 그대로, 본 절은
2단계 `VillageOverlay` Stack 위 phase overlay HUD 에만 적용.

### 9-1. 톤

- **12세 안심형 (Pixel UI 게임 카피)** — 짧고 평이한 평서문, 친근한 어조.
- 공포 / 잔혹 / 폭력 묘사 금지 (예: "죽다" → "사라지다", "살해" → "사건").
- 자극적 단어 회피.
- 행동 유도는 부드럽게 ("골라주세요", "확인해주세요", "기다려요").

### 9-2. 길이

- 한 줄 (35자 이내 권장).
- 보조 문장 최대 한 줄 추가 가능 (예: "수상한 움직임을 살펴보세요.").

### 9-3. 금지 (사용자 화면에 절대 노출 X)

- 개발자 용어: `socket`, `phase`, `payload`, `WS`, `event`, `emit`,
  `dart-define`, `state machine`, `server`, `host`, `dev mode`, `debug`,
  `error code` 등.
- 영문 상태 enum 그대로 노출 (`DAY_DISCUSSION`, `NIGHT_MAFIA` 등). 이는
  로그 키워드일 뿐, 사용자에게는 한국어 안내로.
- 시간 단위 영문 (예: "120s") — 한국어 단위 "초"로 표기.
- 직업명도 사용자 안내에 노출할 때는 일반어 "의사 / 마피아 / 경찰 / 시민"
  그대로 (자체 별칭 별도 시즌 도입 시 design-policy §2 자가검증).

### 9-4. Phase 별 표준 카피 (S-client-flame-phase-overlay 베이스 — 2026-05-14)

| Phase | 카피 |
|---|---|
| DAY_DISCUSSION | "마을의 낮이에요. 수상한 움직임을 살펴보세요." |
| VOTE_SELECT | "의심스러운 한 명을 골라주세요." |
| VOTE_CONFIRM | "지목된 플레이어를 탈락시킬지 정해주세요." |
| NIGHT_DOCTOR (의사 본인) | "보호할 집을 골라주세요." |
| NIGHT_MAFIA (마피아 본인) | "마피아의 시간이에요. 함께 결정해주세요." |
| NIGHT_POLICE (경찰 본인) | "조사할 집을 골라주세요." |
| NIGHT_RESULT | "밤 사이 일어난 일을 확인하고 있어요." |
| 전환 (AnimatedSwitcher 안내) | "다음 시간이 다가오고 있어요." (선택, 실제 사용은 widget 재량) |

### 9-5. design-policy §2 self-check

- "이 카피가 어떤 기존 작품을 즉시 떠올리게 하나?" 항상 자가질문.
- Town of Salem 의 "The town has gone to sleep / spoken" 류 직역 금지
  (이미 1단계에서 점검됨).
- Among Us 의 "Emergency Meeting" / "Among Us!" 류 인용 금지.
- 의심 시 `design-policy-check` skill 자동 동작.

### 9-6. 갱신

- 2026-05-14: S-client-flame-phase-overlay 슬라이스에서 §9 Phase Overlay
  카피 원칙 신설.
- 2026-05-14: VOTE_CONFIRM 카피 톤 다운 — "처형" → "탈락" (12세 톤 강화).

## 10. 갱신 이력

- 2026-05-14: §9 Phase Overlay 카피 원칙 신설 (Agent D · S-client-flame-phase-overlay).
- 2026-05-13: §4 연결 오류 톤 추가, ConnectionCopy 상수 일원화 (Agent E Phase 1).
- 2026-05-13: 1차 작성 + 코드 카피 정리 패스 완료 (Agent C 슬라이스 Phase 3).
  - `result_winner_banner.dart` 어둠 삼킴 카피 → "마을의 밤이 더 깊어졌어요"
  - `phase_header.dart` / `game_phase_banner.dart` / `village_overlay.dart` / `execution_pane.dart` / `vote_pane.dart` 처형 → 투표 결과 / 지목 / 탈락
  - `lobby_profile_popup.dart` 신고/차단 SnackBar 안심형 톤
  - `error_copy.dart` 행정 톤 → 부드러운 "~어요" 톤
  - `guide_sections.dart` "제거" 표현 완화
  - `night_pane.dart` / `night_result_pane.dart` / `skip_notice_pane.dart` 밤/탈락 톤다운
  - `intro_logo.dart` "어둠 속" → "밤 사이"
