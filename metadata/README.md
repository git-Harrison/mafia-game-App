# mafia-app 스토어 메타데이터 (4단계 출시 준비)

App Store + Google Play 제출용 메타데이터 템플릿. 디렉터가 4단계 진입 시 실제 카피·키워드·스크린샷으로 채움.

## 디렉터 결정 필요 (slice 금지 항목)

- [ ] **앱 이름** (한국·미국·일본·EU 상표 검색 후 확정 — design-policy §3·§6)
- [ ] **앱 아이콘 최종 디자인** (1024×1024 PNG, 4단계 placeholder → 디자이너 작업 또는 자체 도트)
- [ ] **스플래시 최종 디자인**
- [ ] **스토어 카테고리 + 키워드 (KR/EN)**
- [ ] **연령 등급** (KGRB·Apple·Google)
- [ ] **번들 ID 확정** (현재 `net.siliconii.mafia.mafiaClient` placeholder)
- [ ] **Apple 개발자 / Google Play 콘솔 계정 발급**
- [ ] **FCM Firebase 프로젝트 + iOS GoogleService-Info.plist / Android google-services.json**
- [ ] **Sentry 프로젝트 + DSN**

## 폴더 구조 (예정)

```
metadata/
  README.md                  # 본 파일
  ko-KR/
    title.txt                # 앱 이름 (최대 30자)
    short_description.txt    # 짧은 설명 (최대 80자) - Android 전용
    full_description.txt     # 긴 설명 (최대 4000자)
    keywords.txt             # 키워드 (최대 100자) - iOS 전용
    promo_text.txt           # 프로모 텍스트 (최대 170자) - iOS
    release_notes.txt        # 릴리스 노트
  en-US/
    (동일 파일 구조)
  screenshots/
    ios-67/
      1.png ~ 10.png         # 6.7" iPhone (1290×2796)
    ios-65/                  # 6.5" iPhone (1284×2778)
    android-phone/           # 1080×1920
    android-tablet-7/        # 600×1024
  app_icon/
    1024.png                 # App Store 1024×1024
    512.png                  # Play Store 512×512
  splash/
    splash_2x.png            # 적응형
```

## 1단계 placeholder (현재 슬라이스 적용 가능)

게임명 미정이라 일단 한국어 short copy placeholder 만:

- title.txt: `[게임명 미정]`
- short_description.txt: `친구들과 함께 즐기는 픽셀 마피아 소셜 추리 게임.`
- full_description.txt:
  ```
  4~8명의 친구가 모여 마피아를 찾아내는 클래식 사회 추리 게임을, 도트 그래픽 + 모바일 친화 UI 로 재해석했습니다.

  • 4가지 직업 (시민·경찰·의사·마피아)
  • 낮 토론과 투표, 밤의 행동
  • 빠른 한 판 6~10분 (1단계 기본 페이즈 타이머)
  • 친구 코드로 방 생성·참가
  • 한국어 인터페이스, 자체 픽셀 도트 아트

  사회 추리 장르의 일반 룰만 사용했으며, 특정 작품의 이름·캐릭터·UI 를 사용하지 않았습니다.
  ```

## 디렉터에게

- 앱 이름 후보 5~10개 (한국어/영문) 와 상표 검색 결과 정리 필요.
- 1차 인앱 스크린샷 4~5장 (현재 도트 마을·낮 토론·투표·밤·게임 종료).
- 4단계 진입 결정 시 본 폴더 채우기.
