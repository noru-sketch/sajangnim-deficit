# 회계 플레이

편의점의 다섯 거래를 직접 기록하며 회계를 배우는 한국어 웹앱입니다.

## 실행

프로젝트 폴더에서 `npm install` 후 `npm run dev`를 실행하세요.

- 개발 화면 http://localhost:5173/
- 현재 검토용 빌드 http://localhost:5180/
- 빌드 `npm run build`
- 회계 계산 검사 `npm run check`
- 40개 판매 시나리오 `?sold=40`

## 제작 및 검증

BAZE GPT Astra가 구현과 시연 계획·리포트를 작성했고, 브라우저 도구 중계로 실제 시연했습니다. Seedream 이미지, ElevenLabs 효과음, Lyria 배경음악을 정적 파일로 포함합니다. 브라우저 실행에는 API 키가 필요하지 않습니다.

검증 결과는 `docs/ASTRA_VALIDATION_REPORT.md`, 미디어 출처는 `docs/BAZE_ASSETS.json`에 있습니다. 실제 휴대폰 터치와 Safari는 미검증이며, 새로고침하면 진행이 초기화됩니다.
