# Safety / Reporting / Blocking 정책 (자체 작성)

> 함께 읽기: `../mafia-app-context.md` (게임 룰), `../mafia-app-design-policy.md` (IP 정책).
> 본 문서는 사용자 채팅·신고·차단 기능의 단계별 책임 분리와 4단계 (스토어 출시 직전)
> 도입 계약 초안을 정의한다.

## 0. 한 줄 요약

> **1단계 = 클라 local 차단 + 신고 mock 토스트.** 서버 영속 신고 + 운영자 도구는
> 4단계 (스토어 출시 직전) 에 도입한다. 1단계에서는 Prisma 스키마/WS 이벤트를
> 늘리지 않는다.

## 1. 단계별 책임 분리

| 단계 | 신고 | 차단 | 운영자 |
|---|---|---|---|
| **1단계 (현재 MVP)** | 클라 로컬 mock — 버튼 누르면 토스트만 표시, 서버 전송 X | 클라 local blocked set (SharedPreferences). 차단된 유저 채팅/말풍선 즉시 숨김 | 없음 |
| **2~3단계** | 변동 없음 | 변동 없음 (3단계 친구 시스템 도입 시 서버 차단 연동 검토) | 없음 |
| **4단계 (스토어 출시 직전)** | `reportUser` WS / HTTP 이벤트 추가, 서버 영속 (`Report` Prisma 모델), 24시간 검토 SOP | 클라 local 유지 + 서버 양방향 hide 옵션 검토 | 별도 어드민 도구 (DB 직접 조회 또는 간이 대시보드) |
| **출시 후** | 자동 키워드 필터, 누적 신고 임계치 자동 임시 차단 | 영구 차단 정책 | 정식 대시보드 |

1단계 → 4단계 사이는 **클라 UI 흐름 유지**, 서버 송신 어댑터만 mock → 실 호출로 교체.

## 2. 신고 사유 enum (자체 작성)

```
ABUSIVE_LANGUAGE        // 욕설 / 비방 / 혐오 발언
SPAM                    // 동일 메시지 도배 / 광고
INAPPROPRIATE_NICKNAME  // 부적절한 닉네임
GAMEPLAY_DISRUPTION     // 의도적 게임 방해 (자살 투표 유도, 게임 던지기 등)
OTHER                   // 기타 (자유 입력 텍스트 동반)
```

- 카피는 클라에서 한국어로 매핑 (서버는 enum 문자열만 저장).
- 일반 서술어 — 특정 게임 카피 모방 X (design-policy §2-3 자가검증 OK).

## 3. 4단계 도입 시 reportUser 페이로드 초안

```jsonc
// client → server : "reportUser"
{
  "targetUserId": "...",
  "reason": "ABUSIVE_LANGUAGE",      // §2 enum 문자열
  "roomId": "...",                   // optional — 현재 방에서 신고
  "messagePreview": "...",           // optional — 최대 100자, 채팅 신고 시
  "context": "lobby_chat" | "game_chat" | "profile",
  "createdAt": "2026-05-13T12:34:56Z"   // ISO8601
}

// server → ack
{ "ok": true }
// or
{ "ok": false, "error": "DUPLICATE" | "BAD_INPUT" | "UNAUTHORIZED" }
```

- `DUPLICATE` — 같은 reporter→target 가 5분 이내 같은 context 로 재신고 시 (스팸 방지).
- `BAD_INPUT` — enum 외 reason, 100자 초과 messagePreview, 비존재 targetUserId.
- `UNAUTHORIZED` — JWT 무효 또는 게스트가 본인을 신고하는 경우.

## 4. blockUser 정책

- **1단계:** 클라 local set (SharedPreferences). 차단 즉시 채팅/말풍선/대기실 표시 숨김.
  - 본인 화면에서만 적용. 차단된 유저는 자신이 차단됐는지 알 수 없음.
  - 게임 시작 후 같은 방에 들어가도 차단 유지 (단, 게임 진행 정보 — 직업 추리·투표 결과
    등 — 은 서버 권위 이벤트라 가려지지 않음. 채팅·말풍선·닉네임 클릭만 숨김).
- **서버 차단 (양방향 보이지 않게 매칭):** 3단계 친구 시스템 도입 시 함께 검토.
- **차단 해제 UI:** 1단계 외 — TODO. 1단계에는 로컬 차단 목록 길이가 작아 앱 재설치
  시 초기화되어도 큰 문제 없음.

## 5. Prisma 모델 4단계 도입 초안

> **1단계엔 절대 도입하지 않는다.** 본 슬라이스에서도 Prisma 스키마는 손대지 않는다.
> 아래는 4단계 진입 시 PR 베이스로 쓸 초안만.

```prisma
// 4단계에 추가, 1단계엔 절대 도입 X
model Report {
  id             String   @id @default(cuid())
  reporterId     String
  targetUserId   String
  reason         String   // §2 enum 문자열
  roomId         String?
  messagePreview String?  // 최대 100자
  context        String   // lobby_chat | game_chat | profile
  createdAt      DateTime @default(now())
  status         String   @default("OPEN")
  // status: OPEN | REVIEWED | ACTIONED | DISMISSED

  @@index([targetUserId, status])
  @@index([reporterId, createdAt])
}
```

- 인덱스는 운영자 조회 패턴 (특정 타겟의 신고 누적 / 특정 신고자의 history) 기반.
- 누적 신고 임계치 자동 임시 차단은 모델 추가 후 별도 슬라이스.

## 6. Apple / Google 심사 대응 체크리스트

| 항목 | 근거 | 1단계 충족 여부 | 4단계 액션 |
|---|---|---|---|
| 사용자 채팅 신고 기능 | Apple App Review **1.2 User-generated content** | mock 토스트로 UI 만 충족 | 실 서버 신고 도입 |
| 사용자 차단 기능 | Apple **1.2** | 클라 local 차단 ✅ | 유지 + 서버 동기화 검토 |
| 24시간 내 신고 검토 약속 | Apple 1.2 명시 요구 | 운영 SOP 없음 | 출시 운영 SOP 문서화 + 약관 명시 |
| 욕설 자동 필터 | Google Restricted content | 미구현 | 출시 후 도입 (출시 차단 사유 아님) |
| 미성년자 보호 정책 | 12세 이상 등급 시 | 등급 미정 | 등급 결정 후 추가 |
| 약관 / 개인정보처리방침 | Apple **5.1.1**, GDPR | 미작성 | 4단계 필수 — 신고 처리 절차 명시 |

Apple 1.2 가 채팅 + UGC 가 있는 앱에 대해 명시적으로 요구하는 것: **(a) 신고 기능,
(b) 차단 기능, (c) 약관·EULA, (d) 운영자 24h 응답.** 1단계 종료 시점에는 (a)(b) 만
UI 차원에서 갖추고, (c)(d) 는 4단계에 묶는다.

## 7. 1단계 → 4단계 마이그레이션 비용 (예상)

- **클라:**
  - `BlockedUserController` (local 차단) → 그대로 유지.
  - 신고 mock 송신부 → 실 WS / HTTP 호출로 교체 (1~2시간).
  - 차단 해제 UI 신규 (반나절).
- **서버:**
  - `reportUser` `@SubscribeMessage` 핸들러 + DTO 검증 (반나절).
  - `Report` Prisma 모델 + 마이그레이션 (1시간).
  - 운영자 read endpoint — 별도 어드민 UI 또는 DB 직접 조회 (옵션, 반나절).
  - DUPLICATE 판단을 위한 인메모리 또는 DB 기반 5분 윈도 캐시.
- **문서 / 운영:**
  - 약관 / 개인정보처리방침 페이지 갱신.
  - 운영자 24h 응답 SOP 문서.
  - 스토어 메타데이터 (스크린샷에 신고 화면 1장 포함).

총 4단계 진입 시 1~2일 슬라이스 1개로 묶을 수 있는 분량. 1단계 클라 UI 가 깔려
있으면 서버 측 어댑터만 갈아끼우는 형태.

## 8. Client Mock Boundary (현재 상태)

1단계 클라 신고 흐름은 repository 경계로 mock 격리. 4단계 서버 연동 시 UI 변경 없이
repository 구현체만 교체한다.

- `lib/features/report/data/report_repository.dart` — `ReportRepository` interface +
  `ReportSubmission` 페이로드 (서버 §3 페이로드 형태와 1:1 대응).
- `lib/features/report/data/mock_report_repository.dart` — `MockReportRepository`,
  in-memory `Set<String>` 영속 (앱 라이프타임). `kDebugMode` 시 콘솔 로그.
- `lib/features/report/state/report_controller.dart` — UI 가 사용하는
  `reportControllerProvider` (Notifier<Set<String>>). `reportRepositoryProvider` 가
  Mock 을 주입.
- 호출부: `lib/features/room/presentation/widgets/lobby_profile_popup.dart` 의
  프로필 팝업 신고 버튼. 다이얼로그는 `lib/features/friends/presentation/widgets/
  report_reason_dialog.dart` (이동 이득 적어 friends 폴더 유지).

## 9. M4 Server Integration Point

1단계 → 4단계 교체 절차 (UI / state controller 변경 없음):

1. `RemoteReportRepository implements ReportRepository` 신규 — `submitReport` 에서
   WS `reportUser` 또는 HTTP POST 호출. ack 의 duplicate flag 를 `isAlreadyReported`
   캐시로 반영.
2. `reportRepositoryProvider` 를 `MockReportRepository` → `RemoteReportRepository`
   로 override (또는 환경 분기). `reportControllerProvider`·UI 호출부는 그대로.
3. WS payload 는 §3 참조 (`targetUserId`, `reason`, `roomId?`, `messagePreview?`,
   `context`, `createdAt`). 에러 코드 매핑 (`DUPLICATE` / `BAD_INPUT` /
   `UNAUTHORIZED`) 은 controller 또는 호출부에서 한국어 카피로 매핑.
4. mock 의 in-memory set 은 RemoteReportRepository 내부 session cache 로 옮겨
   네트워크 왕복 절감 + 즉시 UI 반영 유지.

## 10. 갱신 이력

- 2026-05-13: 최초 작성. 1단계 MVP 시점에 4단계 도입 계약 미리 잠금.
- 2026-05-13: §8·§9 추가 — client mock boundary (repository pattern) + M4 교체 절차.
