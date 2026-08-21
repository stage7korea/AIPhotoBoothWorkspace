# AI 포토부스 개발 프롬프터 v1 (2026-08-21)

> 용도: 코워크(Claude)가 앞으로 구현할 내용이 맞는지 **확인하기 위한 지시 문서**입니다.
> 각 항목을 읽고 "맞다/아니다/수정"으로 피드백해 주시면, 확정본(v2)을 기준으로 구현을 시작합니다.
> 이번 결정(확정): **Python 단일 스택 · 나노바나나 멀티이미지 합성 · 맥에서 개발 + 프린트는 목(mock)**

---

## 1. 목표

`AIPhotoBoothWorkspace`의 스토리보드(index.html / AI_PhotoBooth_Storyboard_Data.js)를 참조해,
실제로 동작하는 **키오스크 웹 앱**을 Python으로 만든다.

- 카메라 라이브 → 촬영 → 인물 추출 → 나노바나나(Gemini) AI 합성 → 인쇄까지 한 흐름으로 연결
- 이번 버전 범위: **공통-01(수정판) + AI 합성 A01~A05 + 인쇄(목)**
- 제외: 공통-02(이용 고지), 공통-03(모드 선택), 공통-04(결제), 일반 4컷(B 레인)

## 2. 화면 플로우 (이번 버전)

```
common-01(수정) → ai-01(수정) → ai-02 → ai-03 → ai-04 → ai-05 → 인쇄(목) → common-01 복귀
```

### common-01 — 대기·언어 선택 (스토리보드에서 변경)
- 홍보 영상 대신 **실제 카메라 라이브 화면을 전체 화면**으로 표시
- 다국어 시작 표현(시작 · Start · スタート · 开始 · ابدأ · Starten) 순환 표시, 터치 시 언어 버튼 노출
- **언어 선택 → 카운트다운 → 촬영 → 촬영본에서 사람(인물) 추출(누끼)** → ai-01로 이동
- 추출된 인물/얼굴은 세션에 저장(`capturedFaces` 방식 유지)되어 ai-01 의상 미리보기에 사용
- 사람이 감지된 상태에서만 진행 (기존 확정 설계 6번 유지)

### ai-01 — 통합 설정 (스토리보드에서 변경)
- 기존 5탭(배경·의상·얼굴·화풍·프레임) 중 **배경 · 의상 · 프레임 3개 탭만** 사용 (얼굴·화풍 탭 제거)
- 배경·프레임 = 공통 설정, 의상 = 인물별 설정 (기존 Option9 UI 재활용)
- 16:9 라이브 유지, 커버플로우 유지, `설정 완료` 하단 오른쪽 — 확정 설계 그대로
- **A01 설정값은 세션 상태로 저장되어 A04(합성)와 A05(배치)에 반드시 전달된다** (아래 5장 데이터 계약)

### ai-02 — AI용 사진 4장 촬영
- 스토리보드 그대로: 가로 6:4 라이브 + 선택 배경 위 실시간 누끼 표시, 자동 카운트다운 4회, 썸네일 4개

### ai-03 — 합성용 2장 선택
- 스토리보드 그대로: 4장 중 2장 선택, 선택 완료 버튼으로 확정

### ai-04 — 나노바나나 AI 합성
- 선택한 2장을 **각각** 나노바나나 API로 합성 → 결과 2장 (5:4)
- 진행률 화면(원형 게이지), 완료 시 자동으로 ai-05 이동
- 입력(멀티이미지): ① 촬영 인물 사진 ② A01 선택 배경 PNG ③ 인물별 의상 PNG + 텍스트 프롬프트
- 실패 시 1회 자동 재시도, 재실패 시 안내 후 ai-03으로 복귀 (제안 — 확인 필요)

### ai-05 — 결과 선택·배치
- 스토리보드 그대로: 결과 2장 중 1~2장 선택
  - 1장 → **6×4 가로** 인화 (5:4 사진 + 오른쪽 S7 마크)
  - 2장 → **4×6 세로** 인화 (5:4 사진 두 장 + 하단 S7 마크)
- **A01의 frameId를 최종 배치의 여백/프레임 디자인에 적용** ← "A01 설정이 A05에 영향" 요구사항
- 선택 완료 → 인쇄 렌더링 → 인쇄

### 인쇄 (result-01 간소화)
- 이번 버전: 인쇄 이미지 파일 생성 + **목 프린터**(파일 저장 + 로그)로 검증
- QR 다운로드 등 result 화면 상세는 다음 단계 (확인 필요)

## 3. 기술 스택 (확정: Python 단일)

| 영역 | 선택 |
|---|---|
| 백엔드 | Python 3.11+ / FastAPI + uvicorn (로컬 서버) |
| 프런트 | 기존 스토리보드 HTML/JS 재활용한 웹 키오스크 UI (Chromium/Safari 전체화면, `getUserMedia` 카메라) |
| 통신 | REST + WebSocket(합성 진행률) |
| 인물 추출 | `rembg`(U²-Net) 기본, 얼굴 감지는 MediaPipe — 맥/윈도우 공통 동작 |
| AI 합성 | Google `google-genai` SDK, 나노바나나 이미지 모델 (기본 `gemini-2.5-flash-image`, 설정으로 교체 가능) |
| 인쇄 | `PrinterInterface` 추상화 → `MockPrinter`(맥, 지금) / `DnpDriverPrinter`(Windows + pywin32, 나중) |
| 세션 상태 | 서버 메모리(dict) + 프런트 sessionStorage 미러 |

- API 키: `GEMINI_API_KEY` 환경변수. 코드·문서에 키를 하드코딩하지 않는다.
- 촬영 원본·마스크·합성 결과는 세션 폴더에 로컬 저장, 세션 종료 시 삭제(스토리보드 개인정보 원칙 유지).

## 4. 프로젝트 구조 (제안)

```
app/
  main.py               # FastAPI 엔트리, 정적 서빙, 세션 API
  config.py             # 모델명, 해상도, 프린터 종류 등 설정
  session.py            # 세션 상태 (아래 데이터 계약)
  vision/extract.py     # 인물 추출 (rembg + MediaPipe)
  ai/nanobanana.py      # Gemini 멀티이미지 합성 호출 + 프롬프트 빌더
  printing/base.py      # PrinterInterface (print_image(path, size, finish))
  printing/mock.py      # MockPrinter — output/ 폴더 저장 + 로그
  printing/dnp.py       # DnpDriverPrinter — Windows 전용 (뼈대만, 이번엔 미사용)
  render/layout.py      # A05 인쇄 이미지 렌더 (1컷 6x4 / 2컷 4x6, frameId 적용)
static/                 # 키오스크 UI (storyboard-ui 기반 개작)
sessions/<id>/          # 촬영본·마스크·결과 (세션 종료 시 삭제)
```

## 5. 세션 데이터 계약 — "A01이 A05에 영향"의 구현

```json
{
  "sessionId": "s-20260821-001",
  "language": "ko",
  "people": [{ "id": "p1", "face": "faces/p1.png" }],
  "settings": {
    "backgroundId": "moonlit-palace",
    "costumes": { "p1": "01_joseon_guard_m1" },
    "frameId": "mat-palace"
  },
  "captures": ["cap1.jpg", "cap2.jpg", "cap3.jpg", "cap4.jpg"],
  "selectedCaptures": ["cap2.jpg", "cap4.jpg"],
  "aiResults": ["result1.png", "result2.png"],
  "print": { "layout": "2cut", "selectedResults": ["result1.png", "result2.png"],
             "size": "4x6", "finish": "glossy", "copies": 1 }
}
```

- `settings`는 A01에서 쓰고, A04(배경·의상 → 합성 입력)와 A05(frameId → 배치 여백)에서 읽는다.
- 어떤 화면도 `settings`를 덮어쓰지 않는다. A05는 읽기 전용으로 참조.

## 6. 나노바나나 합성 스펙 (확정: 멀티이미지 입력)

- 모델: `gemini-2.5-flash-image` (나노바나나). 필요 시 상위 모델로 설정 교체 가능.
- 요청 1회 = 촬영 사진 1장 합성. 2장은 병렬 호출.
- 입력 구성:
  1. 촬영 인물 사진 (선택된 원본)
  2. `assets/backgrounds/...` 중 A01 선택 배경
  3. `assets/costumes/...` 중 인물별 의상 (2인이면 2장 첨부)
  4. 텍스트 프롬프트 (영어) — 템플릿:

```
Using the provided images: image 1 is a photo of the guest(s), image 2 is the
background scene, image 3 (and 4) are the costume references for each person.
Place the person(s) from image 1 naturally into the background of image 2,
dressed in the costume(s) shown. Keep each person's face, expression and
identity exactly as photographed. Match the lighting and color tone of the
background. Photorealistic, output aspect ratio 5:4, no text or watermark.
```

- 출력: 5:4 이미지 2장 (인쇄 슬롯 비율과 일치)
- 안전/실패 처리: 응답에 이미지가 없으면 재시도 1회 → 실패 시 사용자 안내

## 7. 인쇄 스펙 (하드웨어 반영)

**대상 프린터: DNP DS-RX1HS** (염료 승화, USB 2.0, Windows 권장)

| 항목 | 값 | 앱 반영 |
|---|---|---|
| 해상도 | 300×300(고속) / 300×600(고품질) dpi | 인쇄 렌더는 **300dpi 기준 픽셀**로 생성: 6×4 = 1800×1200, 4×6 = 1200×1800. 고품질 모드는 드라이버 설정 |
| 용지 | 4×6" 롤 (약 12.4초/장) | 1컷=6×4 가로, 2컷=4×6 세로 — 같은 4×6 미디어의 회전 |
| 마무리 | Glossy / Matte | `print.finish` 값으로 전달, 드라이버 레벨 제어 (목에서는 로그만) |
| 연결 | USB, Windows 스풀러 | `DnpDriverPrinter`: pywin32로 기본 프린터 큐에 이미지 인쇄 (다음 단계) |

- **이번 단계(맥)**: `MockPrinter`가 렌더된 인쇄 이미지를 `output/`에 저장하고 인쇄 파라미터를 로그로 출력 → 인쇄 데이터가 올바른지 파일로 검증
- **다음 단계(Windows 부스 PC)**: 동일 코드에 `PRINTER=dnp` 설정만 바꿔 실기 인쇄. 드라이버 상세 옵션(2인치 컷 등)이 pywin32로 부족하면 그때 C# 소형 에이전트를 보조로 검토 (지금은 불필요)

- 미확정(기존 메모): 부스 화면은 4:6 세로인데 1컷 인화는 6×4 가로 — 화면은 세로 유지, **용지만 가로 회전 출력**으로 진행 (확인 필요)

## 8. 구현 순서 (제안)

1. FastAPI 골격 + 세션 API + 정적 UI 서빙
2. common-01: 라이브 카메라 + 언어 선택 + 촬영 + 인물 추출
3. ai-01: 배경·의상·프레임 3탭으로 축소 개작, settings 저장
4. ai-02/03: 4장 촬영 + 2장 선택
5. ai-04: 나노바나나 합성 (진행률 WebSocket)
6. ai-05: 결과 선택 + frameId 적용 렌더 (1컷/2컷)
7. MockPrinter 인쇄 + common-01 복귀 + 세션 정리
8. 검증: 전체 플로우 통합 테스트, 인쇄 파일 300dpi 치수 확인

## 9. 확인이 필요한 항목 (답 주시면 v2에 반영)

1. **common-01 촬영 vs ai-02 촬영**: common-01에서 찍은 사진은 인물 추출·미리보기용이고, 합성에 쓰는 사진은 ai-02에서 다시 4장 촬영 — 이 이해가 맞나요? (아니면 common-01 촬영본을 그대로 합성에 사용하고 ai-02를 생략?)
2. **인원 수**: 최대 몇 명까지 지원하나요? (기존 UI는 인물 1~3명 전제)
3. **결제·고지 생략**: 공통-02~04는 이번 버전에서 완전히 빼고, 나중에 끼워 넣을 수 있게 화면 체인만 열어두면 되나요?
4. **QR/결과 화면**: 인쇄까지만 하고 result-01(QR 다운로드)은 다음 단계로 미뤄도 되나요?
5. **화풍(스타일)**: 이번엔 탭에서 빼지만, 나노바나나 프롬프트에 "photorealistic" 고정으로 두면 되나요?
6. **1컷 6×4 가로 출력**: 화면은 세로, 용지만 가로 회전 — 맞나요?
