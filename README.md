# 카드포인트몰 AX 도구 모음 | Card Pointmall AI Transformation Tools

## 프로젝트 개요
카드사 포인트몰 상품 소싱팀을 위한 4개 모듈 AI 전환(AX) 도구 세트

- **담당팀**: 카드포인트몰 입점팀
- **목적**: AI를 활용한 브랜드 소싱, 경쟁사 분석, 상품 평가, 벤더 커뮤니케이션 자동화

---

## 모듈 구성

| # | 모듈명 | 상태 | 설명 |
|---|--------|------|------|
| ① | AI 브랜드 소싱 레이더 | ✅ 완료 | 브랜드 입점 잠재력 AI 분석 |
| ② | AI 경쟁사 포인트몰 가격 모니터 | 🔜 예정 | 경쟁사 가격 실시간 추적 |
| ④ | AI 상품 잠재력 스코어링 | 🔜 예정 | 상품별 성공 가능성 예측 |
| ⑧ | AI 벤더 커뮤니케이션 자동화 | 🔜 예정 | 입점 협상 메일/메시지 자동 생성 |

---

## ① AI 브랜드 소싱 레이더 (현재 구현)

### 기능
- 브랜드명/카테고리/팔로워/성장률 입력 → AI 종합 분석
- 입점 점수, 트렌드 지수, 잠재력, 리스크 4개 지표 산출
- 입점 상태 판정: 입점 추천 / 검토 중 / 주목 브랜드 / 보류
- 브랜드 목록 필터링 (카테고리, 상태, 점수순)
- URL 스캔 방식 브랜드 분석 (사이드바)
- 카테고리별 도넛 차트 시각화
- localStorage 데이터 영속성

### API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/` | 메인 대시보드 |
| POST | `/api/analyze-brand` | 브랜드 AI 분석 |
| POST | `/api/analyze-url` | URL 기반 브랜드 분석 |
| GET | `/api/health` | 서비스 상태 확인 |

#### `/api/analyze-brand` 요청 예시
```json
{
  "name": "닥터지",
  "category": "뷰티",
  "followers": 500000,
  "growthRate": 15,
  "channels": ["인스타그램", "네이버"],
  "description": "피부과 전문의 추천 스킨케어"
}
```

#### 응답 예시
```json
{
  "success": true,
  "brand": {
    "score": 78,
    "status": "입점 추천",
    "trendScore": 82,
    "potentialScore": 75,
    "riskScore": 25,
    "engagementRate": 0.045,
    "avgPrice": 35000,
    "priceRange": "25,000~55,000원",
    "salesVelocity": "주간 1,200건 추정",
    "competitorGap": "낮음",
    "tags": ["피부과인증", "더마코스메틱", "민감성피부", "신뢰브랜드"],
    "aiComment": "입점 전략: 포인트 적립률 최적화..."
  }
}
```

---

## 기술 스택

- **백엔드**: Hono (TypeScript) on Cloudflare Workers
- **AI 엔진**: GPT-5-nano via Genspark LLM Proxy (`reasoning_effort: 'low'` 필수)
- **프론트엔드**: Tailwind CSS + FontAwesome + Chart.js (CDN)
- **배포**: Cloudflare Pages
- **로컬 개발**: Wrangler Pages Dev + PM2

## 환경 변수 (.dev.vars)

```
OPENAI_API_KEY=<GSK_API_KEY>
OPENAI_BASE_URL=https://www.genspark.ai/api/llm_proxy/v1
```

> `.dev.vars`는 gitignore 처리되어 있습니다. 실제 키를 커밋하지 마세요.

---

## 로컬 개발 실행

```bash
# 빌드
npm run build

# PM2로 서비스 시작
pm2 start ecosystem.config.cjs

# 상태 확인
curl http://localhost:3000/api/health

# 로그 확인
pm2 logs brand-sonar --nostream
```

---

## 배포 현황
- **플랫폼**: Cloudflare Pages
- **상태**: ✅ 로컬 활성
- **마지막 업데이트**: 2026-07-09
