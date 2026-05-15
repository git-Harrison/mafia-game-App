# manual-sim-qa — 1단계 MVP 수동 시뮬 실행 환경

> 함께 읽기: [`mobile-qa-checklist.md`](./mobile-qa-checklist.md) (시나리오),
> [`android-debug-qa.md`](./android-debug-qa.md) (Android 실기기),
> [`../README.md`](../README.md) (구조·명령 요약).
>
> **이 문서의 역할:** 한 PC(macOS)에서 4명 한 판을 끝까지 돌려보기 위한
> 서버·클라이언트 실행 명령과 디바이스 매트릭스를 정리한다.

---

## ⚡ 빠른 실행 요약 (사용자 복붙용 — Docker Desktop 켠 직후)

> 이 박스만 따라가면 GUI 풀사이클이 시작된다. 상세 트러블슈팅·디바이스 매트릭스는 아래 §1~§8.

### 0) Mac LAN IP 확인 (실기기용)

```bash
LAN_IP=$(ipconfig getifaddr en0); echo "$LAN_IP"
# 예: 192.168.10.111 — Android/iOS 실기기 / 추가 클라가 이 IP 로 서버에 붙음.
# 비어 있으면 Wi-Fi 가 en0 이 아니란 뜻 → `ifconfig` 로 활성 인터페이스 확인 후
# 해당 인터페이스명으로 `ipconfig getifaddr <iface>` 재시도 (en1 등).
```

### 1) 서버 (터미널 1개)

```bash
cd /Users/silicon2_it2/Desktop/ma/APP/mafia-app
docker compose up -d db                # Postgres 컨테이너
cd server
pnpm prisma migrate deploy             # 최초 1회 또는 스키마 변경 시
pnpm start:dev                         # http://localhost:3000, hot reload
```

다른 터미널에서 health 확인 (서버 부팅 5~10초 후):

```bash
curl -s http://localhost:3000/health
# {"status":"ok","service":"mafia-server","time":"..."} 확인
```

### 2) 클라 4명 구성 (각 다른 터미널, 동시 실행)

#### 1번 — iOS Simulator

```bash
cd /Users/silicon2_it2/Desktop/ma/APP/mafia-app/client
open -a Simulator                                              # iOS Simulator 열기
flutter run --dart-define=API_BASE_URL=http://localhost:3000 -d "iPhone"
# `-d "iPhone"` 은 부분 매칭. 정확한 udid 는 `xcrun simctl list devices available` 로 확인.
```

#### 2번 — Android Emulator

```bash
flutter emulators --launch Pixel_8_API_36                      # AVD 이름은 환경별 다름
# 부팅 대기 후 (boot complete 까지 30~60초):
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000 -d emulator-5554
```

#### 3번 — iOS 실기기 (USB 케이블 + Developer Mode + 신뢰)

```bash
# 사전 조건: 폰 Wi-Fi == Mac Wi-Fi 같은 LAN, 케이블 연결, 신뢰 승인, Developer Mode ON.
# `flutter devices` 에 "<iPhone name> (mobile)" 라벨로 잡혀야 함.
flutter run --dart-define=API_BASE_URL=http://$LAN_IP:3000 -d "iPhone (mobile)"
```

#### 4번 — 다음 선택지 중 하나 (1~2개 가용 환경별)

- **(a) Android 실기기 / Galaxy Tab USB (권장):**
  ```bash
  flutter run --dart-define=API_BASE_URL=http://$LAN_IP:3000 -d <android-device-id>
  # `<android-device-id>` 는 `flutter devices` 출력에서 확인 (예: RF8XXXXXXX).
  ```
- **(b) 추가 AVD:** Android Studio → Device Manager → Create Device 로 다른 프로파일(Pixel 6 등) 만든 후 동시 실행. `emulator-5554` 와 `emulator-5556` 둘 다 띄울 수 있다.
- **(c) Chrome web** (개발용, GUI 풀사이클 신뢰도 낮음 — 시크릿 창 권장):
  ```bash
  flutter run --dart-define=API_BASE_URL=http://localhost:3000 -d chrome
  ```
- **(주의) macOS desktop 은 사용 불가** — `client/macos/` 미스캐폴드 상태, 별도 슬라이스 필요. iOS Simulator 2대 동시 attach 도 Blocked (§4-5).

### 3) 4명이 안 모이면

- 2~3명으로도 핵심 9 Step 진행 가능. 단 4인 직업 구성 (마피아 1 + 경찰 1 + 의사 1 + 시민 1) 검증을 위해 **가능한 한 4명 권장**.
- 인원 부족 시 핵심 9 Step 표의 "기기 부족 Blocked" 컬럼에 사유 기재 (예: "Android 실기기 미보유로 P4 Blocked").

> ⚠️ **실측 전에는 모든 step 의 Pass/Fail/Blocked 컬럼을 비워둔다.** 사용자가 직접 시뮬에서 확인한 결과만 기록한다. 실행 안 한 step 을 Pass 처리 금지.

**상세 셋업·디바이스 매트릭스·트러블슈팅은 아래 §1~§8 참조.**

---

## 0. 사전 요구 (1회 설치)

| 항목 | 확인 명령 | 측정값 (2026-05-13 기준 본 워크스테이션) |
|---|---|---|
| macOS | `sw_vers` | macOS 26.2 (darwin-arm64) |
| Xcode + iOS Simulator | `xcrun simctl list devices available` | iOS 26.5 — iPhone 17e / iPhone Air / iPad 다수 사용 가능 |
| Android Studio + SDK + AVD | `flutter emulators` | `Pixel_8_API_36` 1개 등록됨 |
| Docker Desktop | `docker --version` / `docker compose version` | 29.4.3 / Compose v5.1.3 (**daemon 미가동 상태로 측정 시 발견 — 사용 전 Docker Desktop 켜기**) |
| Flutter | `flutter --version` | 3.41.9 stable · Dart 3.11.5 |
| Node | `node --version` | v24.3.0 |
| pnpm | `pnpm --version` | 11.1.0 |
| Java (avdmanager용, 선택) | `java -version` | **미설치 — Android Studio 안의 임베디드 JDK 경유 권장** |

> `docker ps` 가 "Cannot connect to the Docker daemon" 으로 떨어지면 Docker Desktop 앱을
> 먼저 실행한다. CLI 만으로는 daemon 이 안 뜬다.

---

## 1. 1회 셋업 (레포 clone 직후)

```bash
# 0) 레포 루트
cd /Users/silicon2_it2/Desktop/ma/APP/mafia-app

# 1) env
cp .env.example .env        # 기본값 그대로 OK (개발용)

# 2) Postgres-only 컨테이너 기동
docker compose up -d db
# 헬스가 healthy 될 때까지 5~10s 대기. 확인:
docker compose ps db

# 3) 서버 의존성 + prisma migrate (최초 1회)
cd server
pnpm install
pnpm prisma migrate dev     # mafia DB 에 User/Room/Game/GamePlayer 테이블 생성

# 4) 클라이언트 의존성
cd ../client
flutter pub get
```

---

## 2. 매 시뮬 세션마다 실행 단계

### 2-1. 서버 (터미널 #1)

```bash
cd /Users/silicon2_it2/Desktop/ma/APP/mafia-app
docker compose up -d db                                # 이미 떠 있으면 noop

cd server
pnpm start:dev                                         # http://localhost:3000, hot reload
# 콘솔에 "mafia-server listening on http://0.0.0.0:3000" 떠야 정상.
```

### 2-2. 서버 health 체크 (터미널 #2 — 새 창)

```bash
curl -s http://localhost:3000/health
# 기대: {"status":"ok","service":"mafia-server","time":"2026-05-13T..."}
```

폰/에뮬에서도 같은 응답이 와야 네트워크 매핑 OK:

```bash
# Android 에뮬 안에서 (adb shell 또는 브라우저)
adb shell 'wget -qO- http://10.0.2.2:3000/health'
# Android 실기기 (같은 WiFi)
curl -s http://192.168.10.111:3000/health
```

### 2-3. 클라이언트 N개 띄우기

각 클라는 **새 터미널 창**에서 띄운다 (`flutter run` 은 hot-reload 콘솔을 점유하므로).

```bash
cd /Users/silicon2_it2/Desktop/ma/APP/mafia-app/client

# A) iOS Simulator
flutter run -d <iOS-simulator-udid> \
  --dart-define=API_BASE_URL=http://localhost:3000

# B) Android Emulator
flutter run -d emulator-5554 \
  --dart-define=API_BASE_URL=http://10.0.2.2:3000

# C) Chrome (웹) — 4번째 클라이언트 대용
flutter run -d chrome \
  --dart-define=API_BASE_URL=http://localhost:3000
```

> Flutter 의 `--dart-define=API_BASE_URL=...` 가 `client/lib/app/env.dart`
> 의 `Env.apiBaseUrl` 로 주입된다. 누락 시 기본값 `http://localhost:3000`.

---

## 3. 디바이스별 API_BASE_URL 매핑

> `$LAN_IP` 는 `ipconfig getifaddr en0` 출력값 (예: `192.168.10.111`). 사용자 환경마다 다르므로 하드코딩 금지.

| 디바이스 | API_BASE_URL | 비고 |
|---|---|---|
| iOS Simulator | `http://localhost:3000` | Info.plist `NSAllowsLocalNetworking=true` 적용됨 |
| Android Emulator | `http://10.0.2.2:3000` | `network_security_config.xml` 에서 10.0.2.2 cleartext 허용 |
| iOS 실기기 (USB) | `http://$LAN_IP:3000` (예: `http://192.168.10.111:3000`) | 케이블 + Developer Mode ON + 신뢰 승인. 폰 Wi-Fi == Mac Wi-Fi 같은 LAN 필수 |
| Android 실기기 (USB) | `http://$LAN_IP:3000` (예: `http://192.168.10.111:3000`) | LAN IP (변동 시 `ipconfig getifaddr en0` 재확인). 폰 브라우저에서 `/health` 200 확인 필수 |
| Chrome (web) | `http://localhost:3000` | 서버 CORS `origin: true` 로 허용됨. 시크릿 창 권장 (storage 분리) |
| macOS desktop | **사용 불가** | `client/macos/` 미스캐폴드 상태 — 별도 슬라이스 필요 (§4-3) |

---

## 4. 4명 동시 구성 — 본 워크스테이션 실측

### 4-1. 사용 가능한 시뮬레이터/에뮬레이터 (실측)

```text
iOS (xcrun simctl): iPhone 17e, iPhone Air, iPad Pro 13" M5, iPad Pro 11" M5,
                    iPad mini A17 Pro, iPad Air 13" M4, iPad Air 11" M4, iPad A16
Android (flutter emulators): Pixel_8_API_36 (1개)
flutter devices 추가 가용: macOS (desktop), Chrome (web)
```

### 4-2. 권장 4명 조합 — 실현 가능한 1순위

| 슬롯 | 디바이스 | API_BASE_URL | 가능 여부 |
|---|---|---|---|
| P1 | iOS Simulator (예: iPhone 17e) | `http://localhost:3000` | OK |
| P2 | Android Emulator (Pixel_8_API_36) | `http://10.0.2.2:3000` | OK |
| P3 | Chrome (web) — 별도 시크릿 창 권장 (스토리지 분리) | `http://localhost:3000` | OK |
| P4 | **Blocked** — 아래 §4-3 옵션 중 하나 골라야 함 | — | — |

### 4-3. 4번째 클라이언트 — Blocked 항목 + 선택지

본 워크스테이션은 4번째 슬롯을 **그대로는 못 채운다.** 해결 옵션:

1. **추가 Android AVD 생성 (권장)** — Android Studio AVD Manager 에서 Pixel 6 / Pixel 7 등
   다른 디바이스 프로파일을 추가 후 동시 실행. `emulator-5554` 와 `emulator-5556` 둘 다 띄울 수 있다.
   - 명령: Android Studio → Device Manager → Create Device. 또는 셸에서 `avdmanager create avd ...`
     (단 본 워크스테이션은 시스템 Java 미설치 — Android Studio 내장 JDK 경유 필요).
2. **두 번째 Chrome 인스턴스** — 다른 사용자 프로필 또는 시크릿 창으로 별도 `flutter run -d chrome`.
   `localStorage` / `sessionStorage` 가 분리되어야 별개 게스트 JWT 유지 가능. 같은 창에서 새 탭으로
   여는 경우 storage 공유로 동일 유저로 인식될 수 있음 (검증 필요).
3. **Android 실기기 (USB)** — `flutter devices` 에 잡혀있던 무선 iPhone 은 wireless 페어링 오류
   상태. USB Android 폰을 꽂으면 `192.168.10.111:3000` 으로 즉시 합류 가능.
4. **Flutter macOS desktop** — `client/macos/` 디렉터리가 **현재 없음.** 활성화하려면
   `cd client && flutter create --platforms=macos .` 가 필요한데 이는 코드/플랫폼 폴더 추가
   변경이라 본 슬라이스 스코프 외. 별도 슬라이스로 처리.

### 4-4. 동일 시뮬레이터 재로그인 = 다른 유저?

`server/src/auth/auth.service.ts:loginAsGuest` 는 **매 호출마다 `prisma.user.create`** 로
새 row 를 만든다. 따라서:

- 같은 시뮬레이터에서 앱을 완전 종료 후 재실행, 닉네임을 다시 입력하면 **새 `User.id` + 새 JWT**
  를 받는다 → 서버 입장에서 별개 유저로 보임.
- 단 **shared_preferences** 에 토큰이 캐싱되어 있으면 자동 재로그인으로 같은 유저가 될 수 있음.
  새 유저로 시작하려면 앱 데이터 초기화 (iOS sim: Device → Erase All Content and Settings,
  Android emu: Settings → Apps → Clear data, Chrome: 시크릿 창) 또는 클라 로그아웃 흐름 사용.
- 1대로 4명을 굴리는 건 멤버 리스트·동기화 검증엔 부분적으로 쓸 수 있지만, 위치 동기화·페이즈
  전환 동시성 검증엔 부족. 가능하면 §4-2 + §4-3 옵션으로 다중 디바이스 확보.

### 4-5. iOS Simulator 2대 동시 실행 — Blocked

Apple Simulator.app 은 동시에 **하나의 부팅된 디바이스만** 보여준다 (`xcrun simctl boot` 으로
여러 개 동시 부팅은 되나, Flutter 의 `flutter run` 이 동일 시뮬레이터에 한 번에 한 세션만
attach 가능). 4번째 슬롯을 iOS 두 번째 시뮬레이터로 채우는 건 **권장하지 않음 — Blocked**.

---

## 5. 게스트 로그인 + 방 생성/입장 + WS 흐름 (코드 레벨)

실제 호출은 Agent C 가 수동 시뮬에서 검증. 본 섹션은 흐름만.

1. **클라 부팅** → `Env.apiBaseUrl` 로 HTTP/WS 양쪽 base 설정.
2. **게스트 로그인:** `POST /auth/guest` body `{ "nickname": "<닉네임>" }` →
   `{ accessToken, user: { id, guestNickname } }`.
   - 서버: `User` 새 row 생성, JWT payload `{ sub: user.id, kind: 'guest' }`.
   - 클라: `accessToken` 을 shared_preferences 보관.
3. **WS 연결:** Socket.IO 클라이언트가 `Env.apiBaseUrl` 로 `connect`, handshake
   `auth: { token: accessToken }`. 서버는 `RoomsGateway` 미들웨어에서 JWT verify,
   소켓 `data.userId / nickname` 주입 + `user:<userId>` 룸 자동 join.
4. **방 생성:** WS `createRoom` 이벤트 → ack 로 `roomId`, `code(6자리)` 회신.
   호스트 자동 입장 + `housesAssigned` 등 후속 이벤트 준비.
5. **방 입장:** 다른 클라가 같은 코드로 `joinRoom { code }` → ack 성공 시 같은 방 멤버.
6. **시작:** 비호스트 전원 `playerReady=true` → 호스트 `startGame` →
   `assignRoles`(개인별) + `housesAssigned`(전체) → `phaseChanged` 사이클.

---

## 6. 트러블슈팅

| 증상 | 원인 | 대응 |
|---|---|---|
| `docker ps` → "Cannot connect to the Docker daemon" | Docker Desktop 안 켜짐 | `open -a Docker` 후 `docker info` 가 응답할 때까지 대기 (보통 20~40초). macOS Spotlight 에서 Docker Desktop 실행해도 동일 |
| `pnpm start:dev` → `ECONNREFUSED 5432` | Postgres 컨테이너 미가동 | `docker compose up -d db` 후 `docker compose ps db` 가 `healthy` 인지 확인 |
| iOS sim 에서 socket 연결 실패 (`Cleartext HTTP traffic ... not permitted`) | App Transport Security 차단 | `client/ios/Runner/Info.plist` 에 `NSAllowsLocalNetworking: true` 가 들어있는지 확인 (현 코드에 적용됨) |
| Android emu 에서 `localhost:3000` 으로 가는데 안 잡힘 | 에뮬 안의 localhost 는 에뮬 자신 | `--dart-define=API_BASE_URL=http://10.0.2.2:3000` 으로 다시 실행 |
| Android emu cleartext 거부 | network security config 미적용 | `client/android/app/src/main/res/xml/network_security_config.xml` 에 10.0.2.2 / localhost / 127.0.0.1 cleartext 허용 — 현 코드 OK |
| 포트 3000 충돌 (`EADDRINUSE`) | 다른 NestJS / Docker server 가 점유 | `lsof -nP -iTCP:3000 -sTCP:LISTEN` 으로 PID 확인 후 `kill -9 <pid>`. Docker server 프로파일이 떠 있으면 `docker compose --profile docker down` |
| 같은 닉네임으로 재로그인 했는데 같은 유저로 들어감 | 클라 shared_preferences 의 토큰 재사용 | 앱 완전 종료 + 데이터 초기화 또는 클라 로그아웃 흐름 사용 (§4-4) |
| 실기기에서 `/health` 200 안 옴 | LAN 도달 불가 / 맥 방화벽 / WiFi 분리 | 폰 브라우저에서 `http://192.168.10.111:3000/health` 직접 확인. 안 되면 시스템 설정 → 네트워크 → 방화벽에서 node 허용 |
| `flutter run -d <udid>` 가 "device not found" | 시뮬레이터 부팅 안 됨 | `xcrun simctl boot <udid>` 또는 `flutter emulators --launch <id>` 먼저 |
| iOS 실기기 wireless 페어링 에러 | Wi-Fi 페어링 불안정 | **케이블 + 신뢰 + Developer Mode ON** 필수. Settings → Privacy & Security → Developer Mode 활성화 후 재부팅 |

---

## 7. 검증 명령 모음 (한 줄씩, 실측 가능)

```bash
# 1. 서버 상태
curl -s http://localhost:3000/health

# 2. iOS sim 목록
xcrun simctl list devices available

# 3. Android AVD 목록
flutter emulators

# 4. Flutter 디바이스
flutter devices

# 5. 포트 점유 확인
lsof -nP -iTCP:3000 -sTCP:LISTEN
lsof -nP -iTCP:5432 -sTCP:LISTEN

# 6. 맥 LAN IP
ifconfig | awk '/inet / && $2 != "127.0.0.1" {print $2}'

# 7. 게스트 로그인 smoke test (서버가 뜬 후)
curl -s -X POST http://localhost:3000/auth/guest \
  -H 'Content-Type: application/json' \
  -d '{"nickname":"smoke"}'
```

---

## 8. 갱신 이력

- 2026-05-13: 최초 작성. 1단계 MVP 결승선 수동 시뮬 검증 직전 실행 환경
  · 디바이스 매트릭스 · health 흐름 정리. 본 워크스테이션 실측 (Flutter 3.41.9 /
  Pixel_8_API_36 1개 / iOS 26.5 시뮬 다수 / macOS desktop 미스캐폴드 / Docker daemon
  대기 상태) 반영.
