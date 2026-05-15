# Android Debug APK 설치 / 실측 절차

> 함께 읽기: `mobile-qa-checklist.md` (폰 2대 QA 항목), `mobile-qa-log-template.md` (실측 기록 표),
> `release-readiness.md` (출시 readiness).
> 본 문서는 1단계 MVP 클라이언트 마감 직후 폰 2대 실측 직전, debug APK 설치 절차를
> 비개발자도 따라할 수 있게 풀어놓은 운영 가이드.

## 0. 개요

- Android 폰 2대에 debug APK 를 설치해 QA 하기 위한 절차.
- 비개발자도 따라할 수 있게 구성.
- 단, Play Store / 키스토어 / 서명 절차는 다루지 않음 (별도 출시 문서 — `release-readiness.md`).

## 1. 사전 준비

- macOS 또는 Windows
- Android SDK Platform Tools (`adb` 명령)
  - macOS Homebrew: `brew install --cask android-platform-tools` 또는 Android Studio 설치 시 자동
  - 또는 https://developer.android.com/studio/releases/platform-tools
- USB 케이블 (데이터 전송 가능)
- Android 폰 2대

## 2. 폰에서 USB 디버깅 켜기

1. 설정 → 휴대전화 정보 → 빌드 번호 7회 탭 → 개발자 옵션 활성화
2. 설정 → 개발자 옵션 → USB 디버깅 ON
3. USB 연결 시 폰 화면 "USB 디버깅 허용" → 허용

## 3. APK 빌드

```bash
cd /Users/silicon2_it2/Desktop/ma/APP/mafia-app/client
flutter build apk --debug --dart-define=API_BASE_URL=http://10.0.2.2:3000
```

빌드 결과: `client/build/app/outputs/flutter-apk/app-debug.apk` (약 181 MB)

> `API_BASE_URL` 은 서버 URL. 같은 WiFi 의 Mac LAN IP 면 `http://<mac-lan-ip>:3000`, Android Emulator 면 `http://10.0.2.2:3000`. 폰 2대 실측은 Mac LAN IP 또는 핫스팟 IP 권장.

## 4. 폰 인식 확인

```bash
adb devices
```

기대:

```
List of devices attached
1234567890ABCDEF   device
ABCDEF1234567890   device
```

`unauthorized` 가 나오면 폰 화면 USB 디버깅 허용 확인.

## 5. APK 설치

폰 ID 지정 (`-s <serial>` 옵션) 으로 2대 따로 설치:

```bash
adb -s 1234567890ABCDEF install -r build/app/outputs/flutter-apk/app-debug.apk
adb -s ABCDEF1234567890 install -r build/app/outputs/flutter-apk/app-debug.apk
```

`-r` 는 기존 설치 있으면 갱신.

또는 한 번에:

```bash
adb install -r build/app/outputs/flutter-apk/app-debug.apk
```

(단일 폰 또는 환경 변수 `ANDROID_SERIAL` 사용 시)

## 6. 앱 실행

폰 홈 → "도트 마피아" 아이콘 탭. 또는:

```bash
adb -s <serial> shell am start -n net.siliconii.mafia.mafiaclient.9795dev/.MainActivity
```

## 7. 권한 / 네트워크 확인

- 처음 실행 시 권한 요청 없으면 그대로 진행
- 닉네임 입력 → 서버 health check 성공해야 홈 진입
- 실패 시 → "서버 응답이 없습니다" — 6번 참조

## 8. 두 폰 같은 서버 환경 확인

- 같은 WiFi: 두 폰 모두 같은 SSID
- 핫스팟: 한 폰이 핫스팟 켜고 다른 폰 + Mac 이 그 핫스팟 접속
- `adb shell` → `ping <mac-ip>` 로 도달 가능 확인

## 9. 실패 대응

### `adb devices` 에 `unauthorized`

- 폰 화면에서 USB 디버깅 허용 다이얼로그 확인 + 허용
- 다이얼로그 안 뜨면 USB 다시 연결, 또는 `adb kill-server && adb start-server`

### `INSTALL_FAILED_VERSION_DOWNGRADE`

- 폰에 더 높은 버전 설치되어 있음. `adb uninstall net.siliconii.mafia.mafiaclient.9795dev` 후 재설치.

### `INSTALL_FAILED_UPDATE_INCOMPATIBLE`

- 서명 다름. uninstall 후 재설치.

### 앱이 서버에 연결되지 않음 ("서버 응답이 없습니다")

- 같은 WiFi 인지 확인
- Mac LAN IP 가 빌드 시 `--dart-define=API_BASE_URL` 과 일치하는지 확인
- 서버 실행 중인지 (`curl http://<mac-ip>:3000/health` Mac 에서)
- 폰 Safari 또는 Chrome 에서 `http://<mac-ip>:3000/health` 접속 가능한지
- 안 되면 라우터 AP isolation 또는 방화벽 의심 — 폰 핫스팟 모드 시도

### Android 14+ "악성 앱일 수 있음" 경고

- 알려지지 않은 출처 앱 허용 (개발자 옵션 또는 설정 → 보안)

## 10. QA 진행

설치 완료 → `mobile-qa-checklist.md §10` 절차 따라 진행 → 결과는 `mobile-qa-log-template.md` 표에 기록.

> 성능 측정은 [performance-qa.md](./performance-qa.md) §1 절차 참조.

## 11. 디버그 로그 보기 (선택)

```bash
adb logcat | grep -E "flutter|\[lobbyMove\]|\[playerMove\]|\[phase\]|\[countdown\]"
```

또는 `flutter logs -d <serial>` (Flutter SDK 환경)

## 12. 갱신 이력

- 2026-05-13: 1차 작성
- 2026-05-13: §10 끝에 performance-qa.md 링크 추가
