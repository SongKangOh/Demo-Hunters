# AI 웹 네비게이션 가이드 🧭

> 디지털 소외계층을 위한 AI 기반 웹사이트 안내 서비스

## 🎯 핵심 컨셉

**자연어로 물어보면, AI가 클릭할 곳을 직접 보여준다.**

```
입력: "주민등록등본 발급하고 싶어요"
출력: [민원서비스] 버튼에 하이라이트 + "여기를 클릭하세요"
```

## 🚀 설치 방법

### 1. 프로젝트 다운로드
```bash
git clone https://github.com/your-repo/Demo-Hunters.git
cd Demo-Hunters
```

### 2. API 키 설정
```bash
cp .env.example .env
# .env 파일에 Claude API 키 입력
```

### 3. Chrome에 Extension 설치
1. Chrome 브라우저에서 `chrome://extensions` 접속
2. 우측 상단 "개발자 모드" 활성화
3. "압축해제된 확장 프로그램을 로드합니다" 클릭
4. `Demo-Hunters` 폴더 선택

### 4. API 키 설정 (Extension 내)
1. Extension 아이콘 클릭
2. 하단 "⚙️ 설정" 클릭
3. Claude API 키 입력 후 저장

## 📂 프로젝트 구조

```
Demo-Hunters/
├── manifest.json          # Chrome Extension 설정
├── popup/
│   ├── popup.html         # 검색창 UI
│   ├── popup.js           # 입력 처리
│   └── popup.css          # 스타일
├── content/
│   ├── content.js         # DOM 분석 + 하이라이트
│   └── content.css        # 하이라이트 스타일
├── background/
│   └── background.js      # LLM API 연동
├── icons/
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── .env.example           # API 키 예시
└── README.md
```

## 🎮 사용 방법

1. **웹사이트 접속** (예: 정부24)
2. **Extension 아이콘 클릭** 또는 `Cmd+Shift+G` (Mac) / `Ctrl+Shift+G` (Windows)
3. **하고 싶은 일 입력**: "주민등록등본 발급하고 싶어요"
4. **확인**: AI가 찾은 버튼이 맞는지 확인
5. **클릭**: 하이라이트된 곳을 클릭

## 🛠 기술 스택

- **Chrome Extension** (Manifest V3)
- **Claude API** (sonnet 4.5)
- **Vanilla JavaScript**

## 🎯 MVP 지원 사이트

- 정부24 (www.gov.kr)
  - 주민등록등본 발급 찾기
  - 생활지원금 신청 찾기

## 👥 팀 역할

| 역할 | 담당 업무 |
|------|----------|
| **A** | Extension 구조 + Content Script |
| **B** | LLM API 연동 + 프롬프트 엔지니어링 |
| **C** | UI (팝업 + 하이라이트) + 발표자료 |

## 📝 라이선스

MIT License