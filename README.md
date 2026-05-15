# mafia-app

iOS + Android 출시 목표의 도트 마피아 모바일 게임. 상세 명세는 `../mafia-app-context.md`.

## 구조
```
mafia-app/
  server/        # NestJS + Socket.IO + Prisma + PostgreSQL
  client/        # Flutter (Material 3 다크, 1단계는 위젯 UI만)
  docker-compose.yml   # db(postgres) + (옵션) server(NestJS)
  .env.example
```

## 사전 요구
- macOS, Xcode + iOS Simulator, Android Studio + AVD (또는 Android 실기기 USB)
- Flutter 3.x, Node 20+, pnpm, Docker Desktop

## 개발 실행 — 권장: Postgres-only + 호스트 NestJS

RAM 1~2GB 절약 + hot reload 빠름. 평소 이 모드로.

```bash
cp .env.example .env

# 1) Postgres 만 컨테이너로
docker compose up -d db

# 2) NestJS 는 호스트에서 (hot reload)
cd server
pnpm install
pnpm prisma migrate dev   # 최초 1회
pnpm start:dev            # http://localhost:3000

# 3) 클라이언트
cd ../client
flutter pub get
flutter run --dart-define=API_BASE_URL=http://localhost:3000        # iOS 시뮬
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000         # Android 에뮬
flutter run --dart-define=API_BASE_URL=http://192.168.x.y:3000      # Android 실기기 (맥 IP)
```

## 개발 실행 — 풀 도커 모드

CI/배포 검증용. server 컨테이너에 hot reload bind mount 포함.

```bash
docker compose --profile docker up --build
```

`docker compose run --rm server pnpm test`, `pnpm test:e2e` 처럼 일회성 명령도
풀 도커 모드에서 가능.

## 디바이스별 API 호스트 매핑

| 디바이스 | API_BASE_URL |
|---|---|
| iOS 시뮬레이터 | `http://localhost:3000` |
| Android 에뮬레이터 | `http://10.0.2.2:3000` (게스트→호스트 별칭) |
| Android 실기기 (USB) | `http://<mac LAN IP>:3000` |

## 단계 로드맵
- 0단계: 앱 골격 ✅
- 1단계 MVP — M1(룰 엔진) ✅ / M2-a(게스트인증+방) ✅ / M3-a(로비·방 UI) ✅ / M2-b 페이즈머신… 진행 예정
- 2단계: Flame 도트 게임 뷰 통합
- 3단계: 프로필/꾸미기
- 4단계: 푸시·크래시·분석·스토어 배포
- 5단계: IAP/시즌
