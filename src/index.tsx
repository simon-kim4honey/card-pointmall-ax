import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'

type Bindings = {
  OPENAI_API_KEY: string
  OPENAI_BASE_URL: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('/api/*', cors())
app.use('/static/*', serveStatic({ root: './' }))

/* ============================================================
   공통 AI 호출 헬퍼
   ============================================================ */
async function callAI(apiKey: string, baseUrl: string, messages: any[]): Promise<string> {
  const url = (baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '') + '/chat/completions'
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-5-nano',
      messages,
      max_tokens: 1200,
      reasoning_effort: 'low',
    }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`AI API error ${res.status}: ${err}`)
  }
  const data = await res.json() as any
  const content = data.choices?.[0]?.message?.content ?? ''
  if (!content) throw new Error('AI returned empty response')
  return content
}

/* ============================================================
   메인 페이지
   ============================================================ */
app.get('/', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>AI 브랜드 소싱 레이더 | 카드포인트몰 입점팀</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet"/>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700;800&display=swap');
    *{font-family:'Noto Sans KR',sans-serif;box-sizing:border-box;}
    body{margin:0;padding:0;}
    .gradient-bg{background:linear-gradient(135deg,#0f172a 0%,#1e1b4b 50%,#0f172a 100%);}
    .card-glow{box-shadow:0 0 30px rgba(99,102,241,.15);}
    .pulse-dot{animation:pulseA 2s infinite;}
    @keyframes pulseA{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.6;transform:scale(1.2)}}
    .radar-spin{animation:spin 20s linear infinite;}
    @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
    .brand-card:hover{transform:translateY(-3px);transition:all .3s ease;}
    .brand-card{transition:all .3s ease;}
    .score-bar{transition:width 1.2s ease-out;}
    .tag-badge:hover{transform:scale(1.05);transition:.2s;}
    .modal-overlay{backdrop-filter:blur(8px);}
    ::-webkit-scrollbar{width:5px;}
    ::-webkit-scrollbar-track{background:#0f172a;}
    ::-webkit-scrollbar-thumb{background:#4f46e5;border-radius:3px;}
    .live-badge{animation:livePulse 1.5s ease-in-out infinite;}
    @keyframes livePulse{0%,100%{opacity:1}50%{opacity:.4}}
    .notif-slide{animation:slideIn .3s ease-out;}
    @keyframes slideIn{from{transform:translateX(120%);opacity:0}to{transform:translateX(0);opacity:1}}
    .filter-btn.active{background:#4f46e5!important;color:#fff!important;border-color:#4f46e5!important;}
    .progress-ring{transition:stroke-dashoffset 1s ease-out;}
    .channel-btn.sel{background:#4f46e5;color:#fff;border-color:#4f46e5;}
    .step-active{opacity:1!important;}
    .shimmer{background:linear-gradient(90deg,#1e293b 25%,#334155 50%,#1e293b 75%);background-size:200% 100%;animation:shimmer 1.5s infinite;}
    @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
    .ai-streaming::after{content:'▋';animation:blink .7s infinite;}
    @keyframes blink{0%,100%{opacity:1}50%{opacity:0}}
  </style>
</head>
<body class="gradient-bg min-h-screen text-white">

<!-- 알림 -->
<div id="notifBox" class="fixed top-4 right-4 z-50 space-y-2 w-80"></div>

<!-- 헤더 -->
<header class="border-b border-indigo-900/50 bg-black/20 backdrop-blur-sm sticky top-0 z-40">
  <div class="max-w-screen-xl mx-auto px-6 py-4 flex items-center justify-between">
    <div class="flex items-center gap-3">
      <div class="relative">
        <div class="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
          <i class="fas fa-satellite-dish text-white"></i>
        </div>
        <span class="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full pulse-dot border-2 border-black"></span>
      </div>
      <div>
        <h1 class="text-xl font-bold">AI 브랜드 소싱 레이더</h1>
        <p class="text-xs text-indigo-300">카드포인트몰 입점팀 · Brand Intelligence System v1.0</p>
      </div>
    </div>
    <div class="flex items-center gap-2">
      <div class="hidden sm:flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-3 py-1">
        <span class="w-2 h-2 bg-emerald-400 rounded-full live-badge"></span>
        <span class="text-xs text-emerald-400 font-medium">GPT-5 연동 활성</span>
      </div>
      <button onclick="openScanModal()" class="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2">
        <i class="fas fa-plus"></i> 브랜드 분석
      </button>
      <button onclick="refreshFeed()" class="bg-slate-700 hover:bg-slate-600 p-2 rounded-xl transition-all" title="새로고침">
        <i class="fas fa-sync-alt text-sm" id="refreshIcon"></i>
      </button>
    </div>
  </div>
</header>

<!-- 메인 -->
<main class="max-w-screen-xl mx-auto px-6 py-8">

  <!-- KPI -->
  <section class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
    <div class="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 card-glow">
      <div class="flex items-center justify-between mb-3">
        <span class="text-xs text-slate-400">탐지된 브랜드</span>
        <div class="w-8 h-8 bg-indigo-500/20 rounded-lg flex items-center justify-center">
          <i class="fas fa-store text-indigo-400 text-xs"></i>
        </div>
      </div>
      <div class="text-3xl font-bold" id="kpiTotal">0</div>
      <div class="text-xs text-emerald-400 mt-1" id="kpiTotalSub">+0 이번주</div>
    </div>
    <div class="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 card-glow">
      <div class="flex items-center justify-between mb-3">
        <span class="text-xs text-slate-400">입점 추천</span>
        <div class="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center">
          <i class="fas fa-star text-emerald-400 text-xs"></i>
        </div>
      </div>
      <div class="text-3xl font-bold" id="kpiRecom">0</div>
      <div class="text-xs text-emerald-400 mt-1">AI 점수 80점↑</div>
    </div>
    <div class="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 card-glow">
      <div class="flex items-center justify-between mb-3">
        <span class="text-xs text-slate-400">급상승 트렌드</span>
        <div class="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
          <i class="fas fa-fire text-orange-400 text-xs"></i>
        </div>
      </div>
      <div class="text-3xl font-bold" id="kpiTrend">0</div>
      <div class="text-xs text-orange-400 mt-1">성장률 20%↑</div>
    </div>
    <div class="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 card-glow">
      <div class="flex items-center justify-between mb-3">
        <span class="text-xs text-slate-400">평균 AI 점수</span>
        <div class="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
          <i class="fas fa-brain text-purple-400 text-xs"></i>
        </div>
      </div>
      <div class="text-3xl font-bold" id="kpiAvg">0</div>
      <div class="text-xs text-purple-400 mt-1">/ 100점 만점</div>
    </div>
  </section>

  <!-- 2컬럼 -->
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

    <!-- 좌: 브랜드 목록 -->
    <div class="lg:col-span-2 space-y-4">

      <!-- 필터 바 -->
      <div class="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4 space-y-3">
        <div class="flex flex-col sm:flex-row gap-3">
          <div class="relative flex-1">
            <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
            <input id="searchInput" type="text" placeholder="브랜드명, 카테고리, 태그 검색..."
              class="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-all"
              oninput="applyFilter()"/>
          </div>
          <select id="sortSel" onchange="applyFilter()"
            class="bg-slate-700 border border-slate-600 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500">
            <option value="recent">최근 분석순</option>
            <option value="score">AI 점수 높은순</option>
            <option value="growth">성장률순</option>
            <option value="name">이름순</option>
          </select>
        </div>
        <div class="flex gap-2 flex-wrap items-center">
          <span class="text-xs text-slate-500">카테고리:</span>
          <button onclick="setFilter('all',this)" class="filter-btn active px-3 py-1 rounded-full text-xs border border-slate-600 text-slate-300 transition-all">전체</button>
          <button onclick="setFilter('뷰티',this)" class="filter-btn px-3 py-1 rounded-full text-xs border border-slate-600 text-slate-300 transition-all">💄 뷰티</button>
          <button onclick="setFilter('패션',this)" class="filter-btn px-3 py-1 rounded-full text-xs border border-slate-600 text-slate-300 transition-all">👗 패션</button>
          <button onclick="setFilter('라이프',this)" class="filter-btn px-3 py-1 rounded-full text-xs border border-slate-600 text-slate-300 transition-all">🏠 라이프</button>
          <button onclick="setFilter('푸드',this)" class="filter-btn px-3 py-1 rounded-full text-xs border border-slate-600 text-slate-300 transition-all">🍱 푸드</button>
          <button onclick="setFilter('가전',this)" class="filter-btn px-3 py-1 rounded-full text-xs border border-slate-600 text-slate-300 transition-all">📱 가전</button>
          <span class="ml-auto text-xs text-slate-400"><span id="listCount">0</span>개 표시</span>
        </div>
      </div>

      <!-- 카드 목록 -->
      <div id="brandList" class="space-y-3"></div>

      <!-- 빈 상태 -->
      <div id="emptyState" class="hidden text-center py-20">
        <div class="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
          <i class="fas fa-satellite-dish text-3xl text-slate-600"></i>
        </div>
        <p class="text-slate-400 font-medium">탐지된 브랜드가 없습니다</p>
        <p class="text-slate-500 text-sm mt-1">상단 '브랜드 분석' 버튼으로 AI 분석을 시작하세요</p>
      </div>
    </div>

    <!-- 우: 사이드 -->
    <div class="space-y-5">

      <!-- 카테고리 차트 -->
      <div class="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
        <h3 class="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
          <i class="fas fa-chart-pie text-indigo-400"></i> 카테고리 분포
        </h3>
        <canvas id="catChart" height="180"></canvas>
      </div>

      <!-- 트렌드 알림 -->
      <div class="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
        <div class="flex items-center justify-between mb-4">
          <h3 class="text-sm font-semibold flex items-center gap-2">
            <i class="fas fa-bell text-orange-400"></i> 트렌드 알림
          </h3>
          <span class="text-xs text-slate-500" id="alertUpdated">—</span>
        </div>
        <div id="alertFeed" class="space-y-2 max-h-56 overflow-y-auto pr-1"></div>
      </div>

      <!-- TOP 3 -->
      <div class="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
        <h3 class="text-sm font-semibold mb-4 flex items-center gap-2">
          <i class="fas fa-trophy text-yellow-400"></i> AI 점수 TOP 3
        </h3>
        <div id="topList" class="space-y-2"></div>
      </div>

    </div>
  </div>
</main>

<!-- ===================== 분석 모달 ===================== -->
<div id="scanModal" class="fixed inset-0 z-50 hidden modal-overlay bg-black/60 flex items-center justify-center p-4" onclick="if(event.target===this)closeScanModal()">
  <div class="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg p-8 relative max-h-[90vh] overflow-y-auto">
    <button onclick="closeScanModal()" class="absolute top-4 right-4 text-slate-400 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-700 transition-all">
      <i class="fas fa-times"></i>
    </button>

    <!-- 입력 폼 -->
    <div id="scanForm">
      <div class="flex items-center gap-3 mb-6">
        <div class="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center">
          <i class="fas fa-satellite-dish text-white text-xl"></i>
        </div>
        <div>
          <h2 class="text-xl font-bold">신규 브랜드 AI 분석</h2>
          <p class="text-xs text-slate-400">GPT-5 기반 실시간 입점 가능성 분석</p>
        </div>
      </div>
      <div class="space-y-4">
        <div>
          <label class="text-xs font-medium text-slate-300 mb-1.5 block">브랜드명 *</label>
          <input id="mName" type="text" placeholder="예: 라운드랩, 무탠다드..."
            class="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"/>
        </div>
        <div>
          <label class="text-xs font-medium text-slate-300 mb-1.5 block">카테고리 *</label>
          <select id="mCat" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all">
            <option value="">선택하세요</option>
            <option value="뷰티">💄 뷰티</option>
            <option value="리빙">🏡 리빙</option>
            <option value="펫">🐾 펫용품</option>
            <option value="토이굿즈">🧸 토이굿즈</option>
          </select>
        </div>
        <div>
          <label class="text-xs font-medium text-slate-300 mb-1.5 block">인스타그램 URL <span class="text-slate-500">(팔로워 링크)</span></label>
          <input id="mInstaUrl" type="text" placeholder="예: https://instagram.com/roundlab"
            class="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"/>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs font-medium text-slate-300 mb-1.5 block">인스타 팔로워</label>
            <input id="mFollowers" type="number" placeholder="예: 150000"
              class="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"/>
          </div>
          <div>
            <label class="text-xs font-medium text-slate-300 mb-1.5 block">월 성장률 (%)</label>
            <input id="mGrowth" type="number" step="0.1" placeholder="예: 12.5"
              class="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all"/>
          </div>
        </div>
        <div>
          <label class="text-xs font-medium text-slate-300 mb-1.5 block">주요 판매채널</label>
          <div class="flex flex-wrap gap-2">
            <button type="button" onclick="togCh(this)" data-ch="인스타그램" class="channel-btn px-3 py-1.5 rounded-lg text-xs border border-slate-600 text-slate-400 hover:border-indigo-500 transition-all">인스타그램</button>
            <button type="button" onclick="togCh(this)" data-ch="네이버" class="channel-btn px-3 py-1.5 rounded-lg text-xs border border-slate-600 text-slate-400 hover:border-indigo-500 transition-all">네이버</button>
            <button type="button" onclick="togCh(this)" data-ch="무신사" class="channel-btn px-3 py-1.5 rounded-lg text-xs border border-slate-600 text-slate-400 hover:border-indigo-500 transition-all">무신사</button>
            <button type="button" onclick="togCh(this)" data-ch="올리브영" class="channel-btn px-3 py-1.5 rounded-lg text-xs border border-slate-600 text-slate-400 hover:border-indigo-500 transition-all">올리브영</button>
            <button type="button" onclick="togCh(this)" data-ch="쿠팡" class="channel-btn px-3 py-1.5 rounded-lg text-xs border border-slate-600 text-slate-400 hover:border-indigo-500 transition-all">쿠팡</button>
            <button type="button" onclick="togCh(this)" data-ch="자사몰" class="channel-btn px-3 py-1.5 rounded-lg text-xs border border-slate-600 text-slate-400 hover:border-indigo-500 transition-all">자사몰</button>
            <button type="button" onclick="togCh(this)" data-ch="백화점" class="channel-btn px-3 py-1.5 rounded-lg text-xs border border-slate-600 text-slate-400 hover:border-indigo-500 transition-all">백화점</button>
          </div>
        </div>
        <div>
          <label class="text-xs font-medium text-slate-300 mb-1.5 block">브랜드 추가 정보 <span class="text-slate-500">(입력할수록 분석이 정확해집니다)</span></label>
          <textarea id="mDesc" rows="3" placeholder="브랜드 특징, 대표 상품, 가격대, 타겟층, SNS 특이사항 등..."
            class="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all resize-none"></textarea>
        </div>
        <button onclick="startAnalysis()" id="startBtn"
          class="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 py-3.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50">
          <i class="fas fa-brain"></i> GPT-5 AI 종합 분석 시작
        </button>
      </div>
    </div>

    <!-- 분석 중 상태 -->
    <div id="analyzingState" class="hidden text-center py-6">
      <div class="relative w-28 h-28 mx-auto mb-5">
        <svg class="w-28 h-28 radar-spin" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="46" fill="none" stroke="#4f46e5" stroke-width="1" stroke-dasharray="6 4" opacity="0.35"/>
          <circle cx="50" cy="50" r="32" fill="none" stroke="#6366f1" stroke-width="1" stroke-dasharray="5 5" opacity="0.25"/>
          <circle cx="50" cy="50" r="18" fill="none" stroke="#818cf8" stroke-width="1" opacity="0.4"/>
          <line x1="50" y1="4" x2="50" y2="50" stroke="#a5b4fc" stroke-width="2.5" opacity="0.9" stroke-linecap="round"/>
          <circle cx="50" cy="20" r="3" fill="#6366f1" opacity="0.8"/>
        </svg>
        <div class="absolute inset-0 flex items-center justify-center">
          <i class="fas fa-satellite-dish text-indigo-400 text-2xl pulse-dot"></i>
        </div>
      </div>
      <h3 class="text-lg font-bold mb-2">AI 분석 중...</h3>
      <p id="stepText" class="text-sm text-indigo-300 mb-4">GPT-5 엔진 초기화</p>
      <div class="w-full bg-slate-800 rounded-full h-2 overflow-hidden mb-5">
        <div id="progressBar" class="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-700" style="width:0%"></div>
      </div>
      <div class="grid grid-cols-3 gap-2 text-xs text-slate-400">
        <div id="step1" class="flex flex-col items-center gap-1.5 opacity-30 transition-all duration-500">
          <div class="w-9 h-9 bg-slate-800 rounded-xl flex items-center justify-center"><i class="fas fa-hashtag text-indigo-400"></i></div>
          <span>SNS 분석</span>
        </div>
        <div id="step2" class="flex flex-col items-center gap-1.5 opacity-30 transition-all duration-500">
          <div class="w-9 h-9 bg-slate-800 rounded-xl flex items-center justify-center"><i class="fas fa-chart-line text-emerald-400"></i></div>
          <span>트렌드 검토</span>
        </div>
        <div id="step3" class="flex flex-col items-center gap-1.5 opacity-30 transition-all duration-500">
          <div class="w-9 h-9 bg-slate-800 rounded-xl flex items-center justify-center"><i class="fas fa-brain text-purple-400"></i></div>
          <span>AI 스코어링</span>
        </div>
      </div>
      <!-- AI 스트리밍 미리보기 -->
      <div id="streamPreview" class="mt-5 bg-slate-800 rounded-xl p-4 text-left hidden">
        <p class="text-xs text-indigo-300 mb-2 font-medium">AI 분석 결과 생성 중...</p>
        <p id="streamText" class="text-xs text-slate-300 leading-relaxed ai-streaming"></p>
      </div>
    </div>
  </div>
</div>

<!-- ===================== 상세 모달 ===================== -->
<div id="detailModal" class="fixed inset-0 z-50 hidden modal-overlay bg-black/70 flex items-center justify-center p-4" onclick="if(event.target===this)this.classList.add('hidden')">
  <div class="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
    <div id="detailContent"></div>
  </div>
</div>

<script>
/* ============================================================
   전역 상태
   ============================================================ */
let brands = [];
let curFilter = 'all';
let selChannels = [];
let catChart = null;

const SAMPLE = [
  {
    id:'demo1', name:'라운드랩', category:'뷰티',
    followers:285000, growthRate:18.5, engagementRate:4.2,
    channels:['인스타그램','올리브영','네이버'],
    score:91, trendScore:88, potentialScore:94, riskScore:15,
    status:'입점 추천', statusColor:'emerald',
    tags:['클린뷰티','제주성분','더마','MZ타겟'],
    description:'제주 원료 기반 더마 코스메틱. 클린뷰티 트렌드에 최적화된 포지셔닝으로 2030 여성 타겟 강세.',
    avgPrice:28000, priceRange:'15,000 ~ 65,000원',
    salesVelocity:'주간 1,200건 추정', competitorGap:'낮음',
    aiComment:'포인트몰 핵심 타겟층(30대 여성)과 완벽 일치. 올리브영 월 베스트셀러 이력 보유. 독점 기획세트 제안 시 포인트 소진 효과 극대화 예상.',
    analyzedAt: new Date(Date.now()-3600000).toISOString(), alert:true
  },
  {
    id:'demo2', name:'무탠다드', category:'패션',
    followers:198000, growthRate:24.3, engagementRate:5.8,
    channels:['인스타그램','무신사','자사몰'],
    score:87, trendScore:95, potentialScore:82, riskScore:22,
    status:'입점 추천', statusColor:'emerald',
    tags:['젠더리스','베이직','힙스터','트렌디'],
    description:'젠더리스 베이직 의류 브랜드. 무신사 내 빠른 성장세로 2024년 신흥 브랜드 Top10 진입.',
    avgPrice:45000, priceRange:'25,000 ~ 120,000원',
    salesVelocity:'주간 800건 추정', competitorGap:'중간',
    aiComment:'20-30대 패션 포인트 사용 패턴과 높은 연관성. 팔로워 증가율 24% - 현재가 최적 입점 시기.',
    analyzedAt: new Date(Date.now()-7200000).toISOString(), alert:true
  },
  {
    id:'demo3', name:'프레시코드', category:'푸드',
    followers:89000, growthRate:31.7, engagementRate:6.4,
    channels:['인스타그램','쿠팡','자사몰'],
    score:83, trendScore:91, potentialScore:78, riskScore:35,
    status:'주목 브랜드', statusColor:'orange',
    tags:['샐러드','건강식','구독','다이어트'],
    description:'프리미엄 샐러드·밀키트 구독 브랜드. 팔로워 월 31% 폭발적 성장 중.',
    avgPrice:55000, priceRange:'38,000 ~ 150,000원',
    salesVelocity:'주간 600건 추정', competitorGap:'중간',
    aiComment:'팔로워 급성장(31%)으로 주목. 건강식 트렌드 최전선. 구독 포인트 정기결제 상품으로 기획 시 차별화 가능.',
    analyzedAt: new Date(Date.now()-43200000).toISOString(), alert:true
  }
];

/* ============================================================
   초기화
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  // 구버전 캐시 자동 삭제 (카테고리 변경으로 인한 초기화)
  localStorage.removeItem('sonar_v2');
  localStorage.removeItem('sonar_v1');
  const saved = localStorage.getItem('sonar_v3');
  brands = saved ? JSON.parse(saved) : [...SAMPLE];
  renderAll();
  renderAlerts();
});

function save() { localStorage.setItem('sonar_v3', JSON.stringify(brands)); }

function renderAll() {
  applyFilter();
  renderKPI();
  renderCatChart();
  renderTop();
}

/* ============================================================
   KPI
   ============================================================ */
function renderKPI() {
  const t = brands.length;
  const r = brands.filter(b=>b.score>=80).length;
  const tr = brands.filter(b=>b.growthRate>=20).length;
  const avg = t ? Math.round(brands.reduce((s,b)=>s+b.score,0)/t) : 0;
  numAnim('kpiTotal', t);
  numAnim('kpiRecom', r);
  numAnim('kpiTrend', tr);
  numAnim('kpiAvg', avg);
  const wk = brands.filter(b=>(Date.now()-new Date(b.analyzedAt).getTime())<604800000).length;
  document.getElementById('kpiTotalSub').textContent = '+'+wk+' 이번주';
}
function numAnim(id, target) {
  const el = document.getElementById(id); let c=0;
  const t = setInterval(()=>{ c=Math.min(c+Math.ceil(target/25),target); el.textContent=c; if(c>=target)clearInterval(t); }, 40);
}

/* ============================================================
   필터/정렬
   ============================================================ */
function setFilter(f, btn) {
  curFilter = f;
  document.querySelectorAll('.filter-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  applyFilter();
}

function applyFilter() {
  const kw = (document.getElementById('searchInput')?.value||'').toLowerCase();
  const sort = document.getElementById('sortSel')?.value||'recent';
  let list = brands.filter(b=>{
    const mc = curFilter==='all' || b.category===curFilter;
    const mk = !kw || b.name.toLowerCase().includes(kw) || b.category.toLowerCase().includes(kw) || (b.tags||[]).some(t=>t.toLowerCase().includes(kw));
    return mc && mk;
  });
  list.sort((a,b)=>{
    if(sort==='score') return b.score-a.score;
    if(sort==='growth') return b.growthRate-a.growthRate;
    if(sort==='recent') return new Date(b.analyzedAt)-new Date(a.analyzedAt);
    return a.name.localeCompare(b.name);
  });
  document.getElementById('listCount').textContent = list.length;
  renderBrandList(list);
}

/* ============================================================
   브랜드 카드
   ============================================================ */
function renderBrandList(list) {
  const container = document.getElementById('brandList');
  const empty = document.getElementById('emptyState');
  if(!list.length){ container.innerHTML=''; empty.classList.remove('hidden'); return; }
  empty.classList.add('hidden');
  container.innerHTML = list.map(b => {
    const sc = b.score>=85?'emerald':b.score>=70?'yellow':'red';
    const scHex = b.score>=85?'#10b981':b.score>=70?'#f59e0b':'#ef4444';
    const circ = (b.score/100)*138.2;
    const grIcon = b.growthRate>=20?'🔥':b.growthRate>=10?'📈':'→';
    return \`
    <div class="brand-card bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5 cursor-pointer hover:border-indigo-500/60"
         onclick="openDetail('\${b.id}')">
      <div class="flex items-start gap-3">
        <div class="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
             style="background:\${catColor(b.category)}18;border:1px solid \${catColor(b.category)}44;">\${catEmoji(b.category)}</div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <span class="font-bold text-base">\${b.name}</span>
            \${b.alert?'<span class="text-xs bg-red-500/20 text-red-400 border border-red-500/30 rounded-full px-2 py-0.5 live-badge">NEW</span>':''}
          </div>
          <div class="flex items-center gap-2 mt-1 flex-wrap">
            <span class="text-xs text-\${b.statusColor||'slate'}-400 bg-\${b.statusColor||'slate'}-500/10 border border-\${b.statusColor||'slate'}-500/30 rounded-full px-2.5 py-0.5">\${b.status}</span>
            <span class="text-xs text-slate-400">\${b.category}</span>
            <span class="text-xs text-slate-500">\${timeAgo(b.analyzedAt)}</span>
          </div>
        </div>
        <!-- 원형 점수 -->
        <div class="relative w-14 h-14 flex-shrink-0">
          <svg class="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="22" fill="none" stroke="#1e293b" stroke-width="4"/>
            <circle cx="28" cy="28" r="22" fill="none" stroke="\${scHex}" stroke-width="4"
              stroke-linecap="round" stroke-dasharray="\${circ} 138.2" class="progress-ring"/>
          </svg>
          <div class="absolute inset-0 flex flex-col items-center justify-center">
            <span class="text-sm font-bold leading-none">\${b.score}</span>
            <span class="text-[9px] text-slate-400">점</span>
          </div>
        </div>
      </div>

      <!-- 지표 -->
      <div class="grid grid-cols-3 gap-2 mt-4">
        <div class="bg-slate-900/60 rounded-xl p-2.5 text-center">
          <div class="text-[10px] text-slate-400 mb-0.5">팔로워</div>
          \${b.instaUrl
            ? \`<a href="\${b.instaUrl}" target="_blank" rel="noopener" class="text-sm font-semibold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center justify-center gap-1">\${fmtNum(b.followers)}<i class="fab fa-instagram text-[10px]"></i></a>\`
            : \`<div class="text-sm font-semibold">\${fmtNum(b.followers)}</div>\`}
        </div>
        <div class="bg-slate-900/60 rounded-xl p-2.5 text-center">
          <div class="text-[10px] text-slate-400 mb-0.5">성장률</div>
          <div class="text-sm font-semibold \${b.growthRate>=20?'text-orange-400':'text-emerald-400'}">\${grIcon}\${b.growthRate}%</div>
        </div>
        <div class="bg-slate-900/60 rounded-xl p-2.5 text-center">
          <div class="text-[10px] text-slate-400 mb-0.5">참여율</div>
          <div class="text-sm font-semibold text-indigo-400">\${b.engagementRate}%</div>
        </div>
      </div>

      <!-- 점수 바 -->
      <div class="mt-3 space-y-1.5">
        <div class="flex items-center gap-2">
          <span class="text-[10px] text-slate-500 w-12">트렌드</span>
          <div class="flex-1 bg-slate-900 rounded-full h-1.5"><div class="h-full bg-blue-500 rounded-full score-bar" style="width:\${b.trendScore}%"></div></div>
          <span class="text-[10px] text-slate-400 w-6 text-right">\${b.trendScore}</span>
        </div>
        <div class="flex items-center gap-2">
          <span class="text-[10px] text-slate-500 w-12">잠재력</span>
          <div class="flex-1 bg-slate-900 rounded-full h-1.5"><div class="h-full bg-emerald-500 rounded-full score-bar" style="width:\${b.potentialScore}%"></div></div>
          <span class="text-[10px] text-slate-400 w-6 text-right">\${b.potentialScore}</span>
        </div>
      </div>

      <!-- 태그 -->
      <div class="flex flex-wrap gap-1.5 mt-3">
        \${(b.tags||[]).slice(0,4).map(t=>\`<span class="tag-badge text-[10px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 rounded-full px-2.5 py-0.5">#\${t}</span>\`).join('')}
      </div>

      <!-- AI 코멘트 -->
      <div class="mt-3 bg-slate-900/50 rounded-xl p-3 border border-slate-700/30">
        <div class="flex gap-2">
          <i class="fas fa-brain text-purple-400 text-xs mt-0.5 flex-shrink-0"></i>
          <p class="text-xs text-slate-400 line-clamp-2">\${b.aiComment}</p>
        </div>
      </div>

      <div class="flex gap-2 mt-3">
        <button onclick="event.stopPropagation();openDetail('\${b.id}')"
          class="flex-1 bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-600/50 text-indigo-300 hover:text-white py-2 rounded-xl text-xs font-medium transition-all">
          <i class="fas fa-expand-alt mr-1"></i> 상세 리포트
        </button>
        <button onclick="event.stopPropagation();exportTxt('\${b.id}')"
          class="bg-slate-700 hover:bg-slate-600 px-3 py-2 rounded-xl text-xs transition-all" title="리포트 다운로드">
          <i class="fas fa-download"></i>
        </button>
        <button onclick="event.stopPropagation();delBrand('\${b.id}')"
          class="bg-slate-700 hover:bg-red-900/50 border border-slate-600 hover:border-red-700 text-slate-400 hover:text-red-400 px-3 py-2 rounded-xl text-xs transition-all">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>\`;
  }).join('');
}

/* ============================================================
   카테고리 차트
   ============================================================ */
function renderCatChart() {
  const ctx = document.getElementById('catChart')?.getContext('2d');
  if(!ctx) return;
  const cats = {};
  brands.forEach(b=>{ cats[b.category]=(cats[b.category]||0)+1; });
  if(!Object.keys(cats).length) cats['데이터없음']=1;
  const colors=['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899'];
  if(catChart) catChart.destroy();
  catChart = new Chart(ctx,{
    type:'doughnut',
    data:{ labels:Object.keys(cats), datasets:[{ data:Object.values(cats), backgroundColor:colors.slice(0,Object.keys(cats).length), borderWidth:0, spacing:3 }]},
    options:{ responsive:true, cutout:'65%', plugins:{ legend:{ position:'bottom', labels:{ color:'#94a3b8', font:{size:11}, padding:8, boxWidth:10 }}}}
  });
}

/* ============================================================
   알림 피드
   ============================================================ */
function renderAlerts() {
  const items = [
    {icon:'fire',color:'orange',text:'뷰티 카테고리 팔로워 급증 트렌드 감지 (+18.5%)'},
    {icon:'paw',color:'emerald',text:'펫 카테고리 신규 브랜드 입점 적기 신호 포착'},
    {icon:'star',color:'yellow',text:'라운드랩 AI 점수 91점 — 즉시 입점 검토 권장'},
    {icon:'home',color:'indigo',text:'리빙 카테고리 경쟁사 포인트몰 3개 신규 입점 확인'},
    {icon:'bell',color:'red',text:'포인트 만료 시즌 D-30 — 토이굿즈 기획전 준비 필요'},
    {icon:'cube',color:'purple',text:'토이굿즈 한정판 콜래버 시즌 진입 — 소싱 우선 검토 권장'},
  ];
  document.getElementById('alertFeed').innerHTML = items.map(a=>\`
    <div class="flex items-start gap-2.5 py-2 border-b border-slate-700/30 last:border-0">
      <div class="w-6 h-6 bg-\${a.color}-500/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
        <i class="fas fa-\${a.icon} text-\${a.color}-400 text-[10px]"></i>
      </div>
      <p class="text-xs text-slate-300 leading-relaxed">\${a.text}</p>
    </div>
  \`).join('');
  document.getElementById('alertUpdated').textContent = new Date().toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})+' 기준';
}

/* ============================================================
   TOP 3
   ============================================================ */
function renderTop() {
  const top = [...brands].sort((a,b)=>b.score-a.score).slice(0,3);
  const medals = ['🥇','🥈','🥉'];
  document.getElementById('topList').innerHTML = top.length
    ? top.map((b,i)=>\`
      <div class="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-700/30 cursor-pointer transition-all" onclick="openDetail('\${b.id}')">
        <span class="text-lg">\${medals[i]}</span>
        <div class="flex-1 min-w-0">
          <div class="text-xs font-semibold truncate">\${b.name}</div>
          <div class="text-[10px] text-slate-400">\${b.category} · 성장률 \${b.growthRate}%</div>
        </div>
        <div class="text-sm font-bold text-indigo-400">\${b.score}</div>
      </div>
    \`).join('')
    : '<p class="text-xs text-slate-500 text-center py-3">브랜드를 분석하면 랭킹이 표시됩니다</p>';
}

/* ============================================================
   모달 제어
   ============================================================ */
function openScanModal() {
  selChannels = [];
  document.querySelectorAll('.channel-btn').forEach(b=>b.classList.remove('sel'));
  ['mName','mDesc','mInstaUrl'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  ['mCat','mFollowers','mGrowth'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
  document.getElementById('scanForm').classList.remove('hidden');
  document.getElementById('analyzingState').classList.add('hidden');
  document.getElementById('scanModal').classList.remove('hidden');
}
function closeScanModal() { document.getElementById('scanModal').classList.add('hidden'); }

function togCh(btn) {
  const ch = btn.dataset.ch;
  if(selChannels.includes(ch)){ selChannels=selChannels.filter(c=>c!==ch); btn.classList.remove('sel'); }
  else { selChannels.push(ch); btn.classList.add('sel'); }
}

/* ============================================================
   AI 분석 실행 (실제 API 호출)
   ============================================================ */
async function startAnalysis() {
  const name = document.getElementById('mName').value.trim();
  const cat  = document.getElementById('mCat').value;
  if(!name||!cat){ notify('브랜드명과 카테고리를 입력해주세요','warning'); return; }

  const followers = parseInt(document.getElementById('mFollowers').value)||50000;
  const growth    = parseFloat(document.getElementById('mGrowth').value)||10;
  const desc      = document.getElementById('mDesc').value.trim();
  const instaUrl  = document.getElementById('mInstaUrl').value.trim();

  document.getElementById('scanForm').classList.add('hidden');
  document.getElementById('analyzingState').classList.remove('hidden');
  await runProgressAnim();

  try {
    const res = await fetch('/api/analyze-brand',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ name, category:cat, followers, growthRate:growth, channels:selChannels, description:desc, instaUrl })
    });
    const data = await res.json();
    if(!data.success) throw new Error(data.error||'분석 실패');
    brands.unshift(data.brand);
    save();
    closeScanModal();
    renderAll();
    notify(\`✅ \${name} AI 분석 완료! 점수: \${data.brand.score}점\`,'success');
  } catch(e) {
    notify('⚠️ AI 분석 오류: '+e.message,'error');
    document.getElementById('scanForm').classList.remove('hidden');
    document.getElementById('analyzingState').classList.add('hidden');
  }
}

async function runProgressAnim() {
  const steps = [
    { id:'step1', text:'SNS 트렌드 데이터 스캔 중...', prog:28 },
    { id:'step2', text:'시장 경쟁 환경 분석 중...', prog:60 },
    { id:'step3', text:'GPT-5 AI 종합 스코어링 중...', prog:88 },
  ];
  document.getElementById('streamPreview').classList.remove('hidden');
  const streamEl = document.getElementById('streamText');
  const previews = [
    '브랜드 채널 현황 파악 완료...',
    '카드사 회원 구매 패턴과 대조 분석 중...',
    '경쟁 포인트몰 유사 입점사 비교 완료...',
    '포인트 소진 잠재력 산출 중...',
    '최종 AI 입점 점수 계산 완료...',
  ];
  let pi=0;
  const tick = setInterval(()=>{ streamEl.textContent=previews[pi++%previews.length]; },900);
  for(const s of steps) {
    document.getElementById('stepText').textContent = s.text;
    document.getElementById('progressBar').style.width = s.prog+'%';
    document.getElementById(s.id).style.opacity='1';
    await sleep(950);
  }
  document.getElementById('progressBar').style.width = '100%';
  await sleep(400);
  clearInterval(tick);
}

/* ============================================================
   빠른 URL 분석
   ============================================================ */
async function quickAnalyze() {
  const url  = document.getElementById('quickUrl').value.trim();
  const name = document.getElementById('quickName').value.trim();
  const cat  = document.getElementById('quickCat').value;
  if(!url){ notify('URL을 입력해주세요','warning'); return; }

  const btn = document.getElementById('quickBtn');
  btn.disabled=true;
  btn.innerHTML='<i class="fas fa-spinner fa-spin mr-1"></i>분석 중...';

  try {
    const res = await fetch('/api/analyze-url',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ url, brandName:name, category:cat })
    });
    const data = await res.json();
    if(!data.success) throw new Error(data.error||'실패');
    brands.unshift(data.brand);
    save();
    renderAll();
    document.getElementById('quickUrl').value='';
    document.getElementById('quickName').value='';
    document.getElementById('quickCat').value='';
    notify(\`✅ \${data.brand.name} 분석 완료! 점수: \${data.brand.score}점\`,'success');
  } catch(e) {
    notify('⚠️ URL 분석 실패: '+e.message,'error');
  } finally {
    btn.disabled=false;
    btn.innerHTML='<i class="fas fa-satellite-dish mr-1"></i>AI 분석 시작';
  }
}

/* ============================================================
   상세 모달
   ============================================================ */
function openDetail(id) {
  const b = brands.find(x=>x.id===id);
  if(!b) return;
  const scHex = b.score>=85?'#10b981':b.score>=70?'#f59e0b':'#ef4444';
  const riskHex = b.riskScore<30?'#10b981':b.riskScore<50?'#f59e0b':'#ef4444';
  const riskLabel = b.riskScore<30?'emerald':b.riskScore<50?'yellow':'red';

  document.getElementById('detailContent').innerHTML = \`
  <div class="p-8">
    <div class="flex items-start justify-between mb-6">
      <div class="flex items-center gap-4">
        <div class="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
             style="background:\${catColor(b.category)}18;border:2px solid \${catColor(b.category)}44;">\${catEmoji(b.category)}</div>
        <div>
          <h2 class="text-2xl font-bold">\${b.name}</h2>
          <div class="flex items-center gap-2 mt-1">
            <span class="text-sm text-\${b.statusColor||'slate'}-400 bg-\${b.statusColor||'slate'}-500/10 border border-\${b.statusColor||'slate'}-500/30 rounded-full px-3 py-0.5">\${b.status}</span>
            <span class="text-sm text-slate-400">\${b.category}</span>
            <span class="text-xs text-slate-500">\${timeAgo(b.analyzedAt)}</span>
          </div>
        </div>
      </div>
      <button onclick="document.getElementById('detailModal').classList.add('hidden')"
        class="text-slate-400 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-700 transition-all flex-shrink-0">
        <i class="fas fa-times"></i>
      </button>
    </div>

    <!-- 점수 4종 -->
    <div class="grid grid-cols-4 gap-3 mb-6">
      <div class="bg-slate-800 rounded-2xl p-4 text-center">
        <div class="text-xs text-slate-400 mb-1">AI 종합</div>
        <div class="text-4xl font-black" style="color:\${scHex}">\${b.score}</div>
        <div class="text-xs text-slate-500">/ 100</div>
      </div>
      <div class="bg-slate-800 rounded-2xl p-4">
        <div class="text-xs text-slate-400 mb-2">트렌드</div>
        <div class="text-2xl font-bold text-blue-400">\${b.trendScore}</div>
        <div class="h-1.5 bg-slate-700 rounded-full mt-2 overflow-hidden"><div class="h-full bg-blue-500 rounded-full" style="width:\${b.trendScore}%"></div></div>
      </div>
      <div class="bg-slate-800 rounded-2xl p-4">
        <div class="text-xs text-slate-400 mb-2">잠재력</div>
        <div class="text-2xl font-bold text-emerald-400">\${b.potentialScore}</div>
        <div class="h-1.5 bg-slate-700 rounded-full mt-2 overflow-hidden"><div class="h-full bg-emerald-500 rounded-full" style="width:\${b.potentialScore}%"></div></div>
      </div>
      <div class="bg-slate-800 rounded-2xl p-4">
        <div class="text-xs text-slate-400 mb-2">리스크</div>
        <div class="text-2xl font-bold text-\${riskLabel}-400">\${b.riskScore}</div>
        <div class="h-1.5 bg-slate-700 rounded-full mt-2 overflow-hidden"><div class="h-full bg-\${riskLabel}-500 rounded-full" style="width:\${b.riskScore}%"></div></div>
      </div>
    </div>

    <!-- 채널 & 상품 -->
    <div class="grid grid-cols-2 gap-4 mb-5">
      <div class="bg-slate-800 rounded-2xl p-4 space-y-3">
        <h4 class="text-sm font-semibold">📊 채널 현황</h4>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between"><span class="text-slate-400">팔로워</span>
            \${b.instaUrl
              ? \`<a href="\${b.instaUrl}" target="_blank" rel="noopener" class="font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors">\${fmtNum(b.followers)}<i class="fab fa-instagram text-xs"></i></a>\`
              : \`<span class="font-medium">\${fmtNum(b.followers)}</span>\`}
          </div>
          <div class="flex justify-between"><span class="text-slate-400">월 성장률</span><span class="text-emerald-400 font-medium">+\${b.growthRate}%</span></div>
          <div class="flex justify-between"><span class="text-slate-400">참여율</span><span class="text-indigo-400 font-medium">\${b.engagementRate}%</span></div>
        </div>
        <div class="flex flex-wrap gap-1 pt-1">
          \${(b.channels||[]).map(c=>\`<span class="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded-lg">\${c}</span>\`).join('')}
        </div>
      </div>
      <div class="bg-slate-800 rounded-2xl p-4 space-y-3">
        <h4 class="text-sm font-semibold">💰 상품 현황</h4>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between"><span class="text-slate-400">가격대</span><span class="font-medium text-sm">\${b.priceRange||'미분석'}</span></div>
          <div class="flex justify-between"><span class="text-slate-400">판매 속도</span><span class="font-medium text-sm">\${b.salesVelocity||'미분석'}</span></div>
          <div class="flex justify-between"><span class="text-slate-400">경쟁 강도</span>
            <span class="\${b.competitorGap==='낮음'?'text-emerald-400':b.competitorGap==='중간'?'text-yellow-400':'text-red-400'} font-medium">\${b.competitorGap||'미분석'}</span></div>
        </div>
      </div>
    </div>

    <!-- AI 리포트 -->
    <div class="bg-gradient-to-r from-indigo-900/40 to-purple-900/40 border border-indigo-700/30 rounded-2xl p-5 mb-5">
      <div class="flex gap-3">
        <div class="w-9 h-9 bg-purple-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
          <i class="fas fa-brain text-purple-400"></i>
        </div>
        <div>
          <h4 class="text-sm font-semibold mb-2">GPT-5 AI 입점 분석 리포트</h4>
          <p class="text-sm text-slate-300 leading-relaxed">\${b.aiComment}</p>
        </div>
      </div>
    </div>

    <!-- 설명 & 태그 -->
    <div class="bg-slate-800 rounded-2xl p-4 mb-5">
      <h4 class="text-sm font-semibold mb-2">📝 브랜드 개요</h4>
      <p class="text-sm text-slate-400 leading-relaxed">\${b.description}</p>
      <div class="flex flex-wrap gap-1.5 mt-3">
        \${(b.tags||[]).map(t=>\`<span class="text-xs bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 rounded-full px-2.5 py-0.5">#\${t}</span>\`).join('')}
      </div>
    </div>

    <!-- 액션 버튼 -->
    <div class="flex gap-3">
      <button onclick="setRecom('\${b.id}')"
        class="flex-1 bg-emerald-600 hover:bg-emerald-700 py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2">
        <i class="fas fa-check"></i> 입점 추천 확정
      </button>
      <button onclick="exportTxt('\${b.id}')"
        class="flex-1 bg-indigo-600 hover:bg-indigo-700 py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2">
        <i class="fas fa-download"></i> 리포트 저장
      </button>
    </div>
  </div>\`;
  document.getElementById('detailModal').classList.remove('hidden');
}

/* ============================================================
   유틸 액션
   ============================================================ */
function setRecom(id) {
  const b = brands.find(x=>x.id===id);
  if(b){ b.status='입점 추천'; b.statusColor='emerald'; save(); document.getElementById('detailModal').classList.add('hidden'); renderAll(); notify(\`✅ \${b.name} 입점 추천 확정\`,'success'); }
}

function exportTxt(id) {
  const b = brands.find(x=>x.id===id);
  if(!b) return;
  const txt = [
    '=== AI 브랜드 소싱 레이더 분석 리포트 ===',
    '분석일: '+new Date().toLocaleDateString('ko-KR'),
    '',
    '브랜드명: '+b.name,
    '카테고리: '+b.category,
    '현재 상태: '+b.status,
    '',
    '[AI 점수]',
    '종합: '+b.score+'/100',
    '트렌드: '+b.trendScore,
    '잠재력: '+b.potentialScore,
    '리스크: '+b.riskScore,
    '',
    '[채널 현황]',
    '팔로워: '+fmtNum(b.followers),
    '월 성장률: +'+b.growthRate+'%',
    '참여율: '+b.engagementRate+'%',
    '판매채널: '+(b.channels||[]).join(', '),
    '',
    '[GPT-5 AI 분석]',
    b.aiComment,
    '',
    '[브랜드 개요]',
    b.description,
    '',
    '[키워드]',
    (b.tags||[]).map(t=>'#'+t).join(' '),
  ].join('\\n');
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([txt],{type:'text/plain;charset=utf-8'}));
  a.download='소싱레이더_'+b.name+'_'+new Date().toLocaleDateString('ko-KR').replace(/\\./g,'')+'.txt';
  a.click();
  notify('📄 리포트 다운로드 완료','success');
}

function delBrand(id) {
  if(!confirm('이 브랜드를 삭제하시겠습니까?')) return;
  brands=brands.filter(b=>b.id!==id); save(); renderAll(); notify('브랜드가 삭제되었습니다','info');
}

async function refreshFeed() {
  const icon=document.getElementById('refreshIcon');
  icon.classList.add('fa-spin');
  renderAlerts();
  await sleep(1200);
  icon.classList.remove('fa-spin');
  notify('📡 피드 새로고침 완료','success');
}

/* ============================================================
   알림
   ============================================================ */
function notify(msg, type='info') {
  const colors={success:'bg-emerald-900/90 border-emerald-600 text-emerald-200',error:'bg-red-900/90 border-red-600 text-red-200',warning:'bg-yellow-900/90 border-yellow-600 text-yellow-200',info:'bg-indigo-900/90 border-indigo-600 text-indigo-200'};
  const icons={success:'check-circle',error:'exclamation-circle',warning:'exclamation-triangle',info:'info-circle'};
  const el=document.createElement('div');
  el.className=\`notif-slide flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-sm \${colors[type]}\`;
  el.innerHTML=\`<i class="fas fa-\${icons[type]}"></i><span class="text-sm font-medium">\${msg}</span>\`;
  document.getElementById('notifBox').appendChild(el);
  setTimeout(()=>el.remove(),4500);
}

/* ============================================================
   헬퍼
   ============================================================ */
function catColor(c){return{뷰티:'#ec4899',패션:'#6366f1',라이프:'#10b981',푸드:'#f59e0b',가전:'#06b6d4',스포츠:'#84cc16',유아:'#f97316',펫:'#8b5cf6'}[c]||'#6366f1';}
function catEmoji(c){return{뷰티:'💄',패션:'👗',라이프:'🏠',푸드:'🍱',가전:'📱',스포츠:'🏃',유아:'🧸',펫:'🐾'}[c]||'🛍️';}
function fmtNum(n){if(n>=1000000)return(n/1000000).toFixed(1)+'M';if(n>=1000)return(n/1000).toFixed(0)+'K';return n?.toString()||'0';}
function timeAgo(d){const diff=Date.now()-new Date(d).getTime();const h=Math.floor(diff/3600000);const day=Math.floor(diff/86400000);if(day>0)return day+'일 전';if(h>0)return h+'시간 전';return '방금 전';}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ closeScanModal(); document.getElementById('detailModal').classList.add('hidden'); }});
</script>
</body>
</html>`)
})

/* ============================================================
   API: 브랜드 분석 (실제 GPT-5 호출)
   ============================================================ */
app.post('/api/analyze-brand', async (c) => {
  const body = await c.req.json()
  const { name, category, followers, growthRate, channels, description, instaUrl } = body

  const apiKey = c.env?.OPENAI_API_KEY
  const baseUrl = c.env?.OPENAI_BASE_URL || 'https://api.openai.com/v1'

  if (!apiKey) {
    return c.json({ success: false, error: 'OPENAI_API_KEY가 설정되지 않았습니다' }, 400)
  }
  if (!name || !category) {
    return c.json({ success: false, error: '브랜드명과 카테고리는 필수입니다' }, 400)
  }

  const prompt = `카드포인트몰 입점 AI 분석 요청. JSON으로만 응답하라.
브랜드:${name}|카테고리:${category}|팔로워:${followers||50000}|성장률:${growthRate||10}%|채널:${(channels||[]).join(',')}|정보:${description||'없음'}
반환 JSON: {"score":숫자,"trendScore":숫자,"potentialScore":숫자,"riskScore":숫자,"status":"입점 추천 or 검토 중 or 주목 브랜드 or 보류","engagementRate":소수,"avgPrice":숫자,"priceRange":"범위","salesVelocity":"주간N건 추정","competitorGap":"낮음 or 중간 or 높음","tags":["태그1","태그2","태그3","태그4"],"description":"설명","aiComment":"카드포인트몰 입점전략 포함 한국어 코멘트 130자 이내"}`

  try {
    const raw = await callAI(apiKey, baseUrl, [
      { role: 'system', content: '한국 카드사 포인트몰 입점 전문 AI. 마크다운 없이 JSON만 출력.' },
      { role: 'user', content: prompt }
    ])

    let analysis: any
    try {
      analysis = JSON.parse(raw)
    } catch {
      // JSON 파싱 실패 시 raw에서 JSON 추출 시도
      const match = raw.match(/\{[\s\S]*\}/)
      if (match) analysis = JSON.parse(match[0])
      else throw new Error('AI 응답 파싱 실패')
    }

    const brand = {
      id: 'b' + Date.now() + Math.random().toString(36).slice(2, 6),
      name: String(name),
      category: String(category),
      followers: Number(followers) || 50000,
      growthRate: Number(growthRate) || 10,
      channels: Array.isArray(channels) ? channels : [],
      description: analysis.description || description || '',
      analyzedAt: new Date().toISOString(),
      alert: (analysis.score || 0) >= 80,
      statusColor: analysis.status === '입점 추천' ? 'emerald'
                 : analysis.status === '검토 중'   ? 'yellow'
                 : analysis.status === '주목 브랜드' ? 'orange' : 'red',
      score:          Number(analysis.score)          || 70,
      trendScore:     Number(analysis.trendScore)     || 70,
      potentialScore: Number(analysis.potentialScore) || 70,
      riskScore:      Number(analysis.riskScore)      || 30,
      status:         String(analysis.status)         || '검토 중',
      engagementRate: Number(analysis.engagementRate) || 3.5,
      avgPrice:       Number(analysis.avgPrice)       || 30000,
      priceRange:     String(analysis.priceRange)     || '미분석',
      salesVelocity:  String(analysis.salesVelocity)  || '미분석',
      competitorGap:  String(analysis.competitorGap)  || '중간',
      tags:           Array.isArray(analysis.tags) ? analysis.tags : [],
      aiComment:      String(analysis.aiComment)      || '분석 완료',
      instaUrl:       instaUrl || '',
    }

    return c.json({ success: true, brand })
  } catch (e: any) {
    console.error('analyze-brand error:', e)
    return c.json({ success: false, error: e.message || '분석 중 오류 발생' }, 500)
  }
})

/* ============================================================
   API: URL 분석 (실제 GPT-5 호출)
   ============================================================ */
app.post('/api/analyze-url', async (c) => {
  const body = await c.req.json()
  const { url, brandName, category } = body

  const apiKey = c.env?.OPENAI_API_KEY
  const baseUrl = c.env?.OPENAI_BASE_URL || 'https://api.openai.com/v1'

  if (!apiKey) return c.json({ success: false, error: 'API key 미설정' }, 400)
  if (!url)    return c.json({ success: false, error: 'URL을 입력해주세요' }, 400)

  const prompt = `URL 기반 브랜드 카드포인트몰 입점 AI 분석. JSON으로만 응답.
URL:${url}|브랜드명:${brandName||'URL추론'}|카테고리:${category||'URL추론'}
URL패턴: instagram→뷰티/패션, smartstore→네이버기반, musinsa→패션, oliveyoung→뷰티, coupang→종합
반환 JSON: {"name":"브랜드명","category":"카테고리","followers":숫자,"growthRate":숫자,"engagementRate":소수,"channels":["채널들"],"score":숫자,"trendScore":숫자,"potentialScore":숫자,"riskScore":숫자,"status":"입점 추천 or 검토 중 or 주목 브랜드 or 보류","avgPrice":숫자,"priceRange":"범위","salesVelocity":"주간N건 추정","competitorGap":"낮음 or 중간 or 높음","tags":["태그1","태그2","태그3","태그4"],"description":"설명","aiComment":"한국어 코멘트 130자 이내"}`

  try {
    const raw = await callAI(apiKey, baseUrl, [
      { role: 'system', content: '한국 카드사 포인트몰 입점 전문 AI. 마크다운 없이 JSON만 출력.' },
      { role: 'user', content: prompt }
    ])

    let analysis: any
    try {
      analysis = JSON.parse(raw)
    } catch {
      const match = raw.match(/\{[\s\S]*\}/)
      if (match) analysis = JSON.parse(match[0])
      else throw new Error('AI 응답 파싱 실패')
    }

    const brand = {
      id: 'b' + Date.now() + Math.random().toString(36).slice(2, 6),
      analyzedAt: new Date().toISOString(),
      alert: (analysis.score || 0) >= 80,
      statusColor: analysis.status === '입점 추천' ? 'emerald'
                 : analysis.status === '검토 중'   ? 'yellow'
                 : analysis.status === '주목 브랜드' ? 'orange' : 'red',
      name:           String(analysis.name || brandName || 'Unknown Brand'),
      category:       String(analysis.category || category || '기타'),
      followers:      Number(analysis.followers)      || 50000,
      growthRate:     Number(analysis.growthRate)     || 10,
      engagementRate: Number(analysis.engagementRate) || 3.5,
      channels:       Array.isArray(analysis.channels) ? analysis.channels : [],
      score:          Number(analysis.score)          || 70,
      trendScore:     Number(analysis.trendScore)     || 70,
      potentialScore: Number(analysis.potentialScore) || 70,
      riskScore:      Number(analysis.riskScore)      || 30,
      status:         String(analysis.status)         || '검토 중',
      avgPrice:       Number(analysis.avgPrice)       || 30000,
      priceRange:     String(analysis.priceRange)     || '미분석',
      salesVelocity:  String(analysis.salesVelocity)  || '미분석',
      competitorGap:  String(analysis.competitorGap)  || '중간',
      tags:           Array.isArray(analysis.tags) ? analysis.tags : [],
      description:    String(analysis.description)    || '',
      aiComment:      String(analysis.aiComment)      || '분석 완료',
    }

    return c.json({ success: true, brand })
  } catch (e: any) {
    console.error('analyze-url error:', e)
    return c.json({ success: false, error: e.message || '분석 오류' }, 500)
  }
})

/* ============================================================
   API: 헬스체크
   ============================================================ */
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'AI Brand Sonar Radar',
    version: '1.0.0',
    ai: 'GPT-5 connected',
    timestamp: new Date().toISOString()
  })
})

export default app
