# mafia-app — Claude Code 프로젝트 가이드

iOS/Android 도트 마피아 모바일 앱. NestJS + Socket.IO + Prisma + Flutter Material 3 다크.
1인 개발, 1단계 MVP 진행 중. 이 파일은 Claude Code 가 매 세션 시작 시 자동 로드되어
워크플로·IP·테스트 정책을 코워크가 다시 명시하지 않아도 자동 적용되게 한다.

## Source 4개 (우선순위 순 — 충돌 시 위가 진실)

매 슬라이스 시작 시 아래 4개 source 가 인콘텍스트로 자동 로드된다. 명시적으로 다시
읽으라고 코워크가 말하지 않아도 의사결정 직전 항상 참조한다.

1. **게임 룰·페이즈·이벤트 명세**: @../mafia-app-context.md
2. **IP·표절 방지 정책**: @../mafia-app-design-policy.md
3. **워크플로·테스트 정책**: @../mafia-app-harness.md
4. **레포 개요·실행 명령**: @./README.md

**충돌 우선순위:** context > design-policy > harness > 슬라이스 컨텍스트 > 본 CLAUDE.md.
Source 문서 수정 필요 발견 시 직접 수정 X — 보고만 (별도 슬라이스로 처리).

## 인스턴스 self-id

세션 첫 입력이 `S-<area>-<번호>` 형식 슬라이스면 `<area>` 로 자기 영역 판단 후 한 줄
보고로 시작 (예: `Instance=A · scope=server/**`):

- `S-server-*` / `S-prisma-*` / `S-docker-*` → **Instance A (Backend)** — `.claude/agents/backend.md`
- `S-client-*` / `S-flutter-*` → **Instance B (Frontend)** — `.claude/agents/frontend.md`
- `S-meta-*` / `S-doc-*` → 영역 무관 메타 — 양쪽 가이드 모두 참조
- `S-qa-*` / `S-e2e-*` → 임시 C 인스턴스 — backend 가이드 우선, 클라 통합 검증 포함

`Agent` 도구로 backend/frontend 서브에이전트를 명시 호출할 수도 있음 — area 가 명확하면
바로 적합한 서브에이전트로 위임.

## 슬라이스 프로토콜

- **수신** (harness §3 6항목): S-id / 핵심 파일 / 인터페이스 / 자율 OK / 묻기 / 검증 / 금지.
  5번째 슬라이스 이후엔 1·2번만 와도 OK.
- **처리**: `slice-context` skill 자동 동작 — 묻기 영역 있으면 즉시 정지.
- **보고** (harness §4 4항목): `✅ 한 것 / ⚠️ 자율 처리 / ❓ 다음 결정 / 🧪 테스트`. **300자 안.** 코드 dump · 표 · 중간 결과 dump 금지.

## 결정 권한 (harness §5)

- **자율 (묻지 말고 진행)**: 명명·라이브러리 패치·에러 코드 문구 (자가검증 후, 기능 서술형)·테스트 케이스 추가·로그 카피·코드 주석·리팩토링.
- **묻기 (정지)**: 새 의존성·데이터 모델 변경·게임 룰 변경·WS 이벤트 명세 변경·design-policy hard-no 의심·스코프 외 작업·환경변수 신규·새 파일 5개+·인터페이스 계약 변경.
- **회색 (보고+진행)**: 기존 단위 테스트 수정·외부 무료 에셋 (출처·라이선스 기록)·메이저 버전 호환성 의심·DB 마이그레이션 (스키마 변경 아닌 데이터 이동·인덱스).

## IP self-check — design-policy §2 hard-no 6개

코드·UI·문구·명칭 출력 직전 자가검증. 의심 신호 시 `design-policy-check` skill 자동 동작:

1. 기존 게임 UI 복사 · 2. 캐릭터/도트 리소스 복사 · 3. 룰 설명문/카피 직역 · 4. 직업·스킬·아이템·세계관 시그니처 단어 · 5. 구조·디자인 모방 (Among Us / Town of Salem 등) · 6. 게임명 유사

자가질문: "**이게 어떤 기존 작품을 즉시 떠올리게 하나?**" → 떠오르면 정지 + 대체안 1~2 제안.

## 슬림 테스트 정책 (harness §6)

- 도메인 순수 함수 (`server/src/game/domain/**`) — **강제 100%** (jest coverageThreshold).
- 통합 (WS 핸들러·매니저·DB) — 기능당 **1~2개**, 핵심 경로 + 경계 1.
- 클라 단위 — 1단계 **0개**, 수동 시뮬로 대체.
- E2E — 슬라이스 그룹 끝에 **1개** (M-시리즈 끝).

상세: `test-policy` skill.

## 운영 메모

- **개발 모드** (슬림): `docker compose up -d db` (Postgres만) + `cd server && pnpm start:dev` (호스트).
- **네트워크**: iOS sim `localhost:3000`, Android emu `10.0.2.2:3000`, Android USB 실기기 `http://<mac LAN IP>:3000`.
- **페이즈 타이머**: env `GAME_*_SEC` 7종 (운영 default 30~120s, 테스트 1s). EXECUTION · skipNotice = 3s 고정.
- **인증**: WS handshake 미들웨어 + JWT (`server/src/rooms/rooms.gateway.ts`). 각 socket 은 `user:<userId>` 룸 자동 join.
- **DB**: Postgres 17 컨테이너, schema = `server/prisma/schema.prisma`. Game/GamePlayer 는 종료 시점에만 `$transaction` 으로 INSERT.

## 명령

- 단위: `cd server && pnpm test`
- 통합 전체: `cd server && pnpm test:e2e`
- 통합 단일: `cd server && pnpm test:e2e -- <file-prefix>`
- 커버리지: `cd server && pnpm test:cov`
- 클라 실행: `cd client && flutter run --dart-define=API_BASE_URL=<url> -d <device>`
- 클라 빌드만 검증: `cd client && flutter build ios` / `flutter build apk`

## 코드 주석 의무

서버 카피·이벤트명·에러 코드 신규 생성 시 인접 주석에 `자체 작성` 출처 한 줄 명시
(design-policy §2 항 3·4 대응). 예시:

```ts
// 카피는 클라가 reason 으로 결정. 서버는 룰 코드만 전송 (자체 작성 정책).
this.emitter.emitToRoom(roomId, 'executionResult', { reason, victimUserId });
```

## Skill / Subagent 인벤토리

- `agents/backend.md` — Instance A 페르소나, `server/**` 작업 가이드.
- `agents/frontend.md` — Instance B 페르소나, `client/**` 작업 가이드.
- `skills/slice-context` — 6항목 컨텍스트 파싱 → 4항목 보고 워크플로.
- `skills/design-policy-check` — IP hard-no 자가검증, 의심 시 정지 + 대체안.
- `skills/test-policy` — 슬림 테스트 정책 적용·검증 사이클 가이드.

이 6개 외 새 skill·subagent 추가 제안은 `묻기` 영역.
