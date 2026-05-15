# 실 디바이스 성능 QA — 배터리 / 메모리 / FPS / 발열 / 네트워크

> 함께 읽기: `mobile-qa-checklist.md` (기능 체크리스트), `mobile-qa-log-template.md` (실측 기록),
> `android-debug-qa.md` (APK 설치 / adb), `release-readiness.md` (출시 readiness).
> 본 문서는 출시 전 실 디바이스에서 성능 지표를 측정하기 위한 운영 가이드.

## 0. 개요

- 도트 마피아 출시 전 실 디바이스 성능 (배터리/메모리/FPS/발열/네트워크) 측정 절차.
- 실측 전엔 "성능 문제 없음" 단정 금지. 본 문서로 측정 → `mobile-qa-log-template.md` 로 결과 기록.

## 1. Android 측정 절차

### 1.1 사전 준비

- adb 설치 (`brew install --cask android-platform-tools`)
- USB 디버깅 (`docs/android-debug-qa.md` §2 참조)
- 폰 배터리 80%+, 충전기 분리 (배터리 측정 시)

### 1.2 메모리 측정

```bash
# 패키지명 확인
adb shell pm list packages | grep mafiaclient

# 메모리 스냅샷
adb shell dumpsys meminfo net.siliconii.mafia.mafiaclient.9795dev
```

관찰: TOTAL PSS / Java Heap / Native Heap / Graphics. 10분/30분/60분마다 기록.

### 1.3 배터리 측정

```bash
# 배터리 통계 리셋
adb shell dumpsys batterystats --reset

# 30분 플레이 후
adb shell dumpsys batterystats > batterystats-after.txt
adb shell dumpsys battery
```

관찰: 앱 wakeup 횟수, screen-on 시간 동안 mAh 소비.

### 1.4 로그 + 발열 모니터링

```bash
# 백그라운드 logcat 저장
adb logcat -v time | grep -E "flutter|GC|Choreographer" > logcat.txt

# 발열은 폰 손으로 체감 + 표면 온도 (체크 어플 없으면 정성 평가)
```

Choreographer skipped frames 라인 = 프레임 드랍 신호.

### 1.5 Flutter DevTools

```bash
# debug 빌드로 실행
flutter run -d <android-serial> --release
# 또는 profile 모드 (DevTools 가능)
flutter run -d <android-serial> --profile

# 별 터미널에서
flutter pub global activate devtools
flutter pub global run devtools
```

브라우저에서 DevTools URL 접속:

- Performance: FPS / GPU/CPU 사용
- Memory: heap snapshot, leak detection
- Network: HTTP/WS 요청

## 2. iOS 측정 절차

### 2.1 사전 준비

- Xcode (App Store 또는 https://developer.apple.com/xcode/)
- 폰 + USB + 신뢰
- `flutter build ios --profile --no-codesign` 또는 Xcode 에서 실행

### 2.1bis 시뮬레이터 빌드·설치 (실 기기 부재 시 1차 확인)

```bash
# 0) 부팅된 시뮬레이터 확인 — 없으면 부팅
xcrun simctl list devices booted
xcrun simctl boot "iPhone 17"   # 또는 좁은 폭은 "iPhone SE (3rd generation)"

# 1) 시뮬레이터용 디버그 빌드 (약 1~2분)
cd /Users/silicon2_it2/Desktop/ma/APP/mafia-app/client
flutter build ios --simulator --debug \
  --dart-define=API_BASE_URL=http://localhost:3000

# 2) 설치 + 실행
xcrun simctl install booted build/ios/iphonesimulator/Runner.app
xcrun simctl launch booted net.siliconii.mafia.mafiaclient.9795dev

# 3) 스크린샷 (반복 확인 / 회귀 비교)
xcrun simctl io booted screenshot /tmp/mafia_ios.png
```

좁은 폭 회귀 점검: iPhone SE 3rd (375dp) 가 iOS 26.5 런타임 페어 가능 최소.
iPhone SE 1세대 (320dp) 는 iOS 26 런타임과 페어 불가 — 실 기기 또는 구
iOS 런타임 추가 설치 필요.

### 2.2 Xcode Instruments

1. Xcode → Open Developer Tool → Instruments
2. **Time Profiler** — CPU 사용 핫스팟
3. **Allocations** — 메모리 할당 추적
4. **Energy Log** — 배터리/CPU/GPU/네트워크/위치 소모 종합

폰 연결 + 앱 선택 → Record. 10분/30분/60분 시나리오 별 기록.

### 2.3 Flutter DevTools (iOS)

```bash
flutter run -d <ios-id> --profile
# 또는
flutter run -d <ios-id> --release
```

DevTools 동일 사용.

### 2.4 Console 로그

Xcode → Window → Devices and Simulators → 폰 선택 → Open Console.
검색: "Flutter", `[lobbyMove]`, `[playerMove]` 등 디버그 prefix.

## 3. 시나리오별 측정

### 3.1 10분 플레이 (대기실)

- 폰 2대 같은 방 대기실 입장
- 양쪽 캐릭터 이동 + 채팅 5분 + 5분 대기
- 측정: 시작/10분 시점 메모리 + 배터리

### 3.2 30분 플레이 (게임 한 사이클)

- 4명 입장 → 게임 시작 → 한 사이클 (낮/투표/밤 3페이즈 × 2~3회) → 결과
- 측정: 시작/30분 메모리 + 배터리

### 3.3 60분 장시간

- 게임 시작/종료 반복 (5게임 정도)
- 측정: 60분 후 메모리/배터리 + 발열 체감

## 4. 기록 체크리스트

| 항목 | 10분 | 30분 | 60분 | 비고 |
|---|---|---|---|---|
| 메모리 (MB) — Android Java/Native/Graphics 합 | | | | |
| 메모리 (MB) — iOS Allocations 총합 | | | | |
| FPS 체감 (60/30/렉) | | | | |
| Choreographer skipped frames | | | | |
| 배터리 소모 (%/시간) | | | | |
| 발열 (정성: 안 따뜻 / 살짝 / 명확) | | | | |
| 앱 강제 종료 발생 | Y/N | Y/N | Y/N | |
| 화면 전환 오류 | | | | |
| socket 재연결 오류 | | | | |
| 채팅 지연 (ms 체감) | | | | |
| 위치 동기화 지연 (ms 체감) | | | | |

기록 위치: `docs/mobile-qa-log-template.md` 회차 표 §3 이슈 옆에 §4 성능 측정 추가.

## 5. 출시 전 성능 기준 (지표 권장값)

| 지표 | 권장 | 차단 (출시 보류) |
|---|---|---|
| 메모리 60분 후 | ≤ 350 MB | > 600 MB 누수 의심 |
| Choreographer skipped frames/분 | ≤ 5 | > 20 (렉 명백) |
| FPS 체감 | 안정적 60 (대기실) / 30+ (인게임) | 잦은 멈춤 |
| 배터리 30분 소모 | ≤ 8% | > 15% |
| 발열 (60분) | 안 따뜻 ~ 살짝 | 명확 (사용 불가) |
| 앱 강제종료 | 0 | 1회 이상 |

수치는 권장값 — 실측 후 조정.

### 5.bis 10분 최소 측정 기준 (회차 2 필수)
실폰 확보 후 회차 2에서 다음 4개 항목 최소 측정:

| 항목 | 측정 도구 | 권장 임계 |
|---|---|---|
| 메모리 (MB) | adb dumpsys meminfo / Flutter DevTools | 시작 + 10분 후 비교, 증가 ≤ 150 MB |
| FPS 체감 | 사용자 정성 | 60fps 유지 (대기실), 30fps+ (인게임) |
| 발열 | 손 체감 | 살짝 따뜻 이하 |
| Choreographer skipped frames | adb logcat | ≤ 10/분 |

10분 측정 결과는 `mobile-qa-log-template.md §7.4` 에 기록.

## 6. 코드 측 명백한 위험 (실측 전 사전 점검)

- Home 5초 polling — dispose 정상 작동 확인 (`StreamProvider.autoDispose`)
- socket listener 중복 등록 — 화면 재진입 시 grep
- Timer.periodic / Future.delayed — cancel 누락
- AnimationController / TextEditingController / ScrollController / FocusNode — dispose
- ListView 무한 누적 (채팅 메시지, room list) — max length 정책

→ 이번 슬라이스 B/C/G 에이전트가 코드 측 정리 진행 중.

## 7. 측정 후 조치

- 메모리 누수 발견 → DevTools Memory snapshot diff → 누수 위젯/provider 식별 → 코드 슬라이스
- FPS 드랍 → Performance Profile → 핫스팟 위젯 식별 → repaint boundary 또는 const 위젯화
- 배터리 과소비 → wakeup 원인 (Timer/polling/socket) → throttle 또는 lifecycle 정리

## 8. 갱신 이력

- 2026-05-13: 1차 작성
- 2026-05-13: profile APK 빌드 검증 — 81~82MB. 10/30/60분 실측 미실행 → 회차 2 권장.
- 2026-05-13: §5.bis 10분 최소 측정 기준 신설 — 회차 2 필수 4개 항목 (메모리/FPS/발열/Choreographer)
- 2026-05-13: 대기실 캐릭터 걷기 애니메이션 추가 — 인게임 30분 시점 메모리/FPS 재측정 권장
