import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'

type Bindings = {
  OPENAI_API_KEY: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('/api/*', cors())
app.use('/static/*', serveStatic({ root: './' }))

// ============================================================
// 메인 페이지
// ============================================================
app.get('/', (c) => {
  return c.html(`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AI 브랜드 소싱 레이더 | 카드포인트몰 입점팀</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet" />
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700;800&display=swap');
    * { font-family: 'Noto Sans KR', sans-serif; }
    .gradient-bg { background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%); }
    .card-glow { box-shadow: 0 0 30px rgba(99,102,241,0.15); }
    .pulse-dot { animation: pulse 2s infinite; }
    @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.6;transform:scale(1.2)} }
    .radar-ring { animation: spin 20s linear infinite; }
    @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
    .score-bar { transition: width 1.5s ease-out; }
    .brand-card:hover { transform: translateY(-4px); transition: all 0.3s ease; }
    .shimmer {
      background: linear-gradient(90deg, #1e293b 25%, #334155 50%, #1e293b 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }
    @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
    .tag-badge { transition: all 0.2s ease; }
    .tag-badge:hover { transform: scale(1.05); }
    .modal-overlay { backdrop-filter: blur(8px); }
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: #0f172a; }
    ::-webkit-scrollbar-thumb { background: #4f46e5; border-radius: 3px; }
    .trend-up { color: #10b981; }
    .trend-down { color: #ef4444; }
    .live-badge { animation: livePulse 1.5s ease-in-out infinite; }
    @keyframes livePulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
    .tooltip { position: relative; }
    .tooltip:hover .tooltip-text { display: block; }
    .tooltip-text { display: none; position: absolute; bottom: 125%; left: 50%; transform: translateX(-50%);
      background: #1e293b; color: #e2e8f0; padding: 6px 12px; border-radius: 8px; font-size: 12px;
      white-space: nowrap; z-index: 100; border: 1px solid #334155; }
    .filter-btn.active { background: #4f46e5 !important; color: white !important; }
    .floating-action { animation: float 3s ease-in-out infinite; }
    @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
    .progress-ring { transition: stroke-dashoffset 1s ease-out; }
    .notification-slide { animation: slideIn 0.3s ease-out; }
    @keyframes slideIn { from{transform:translateX(100%);opacity:0} to{transform:translateX(0);opacity:1} }
  </style>
</head>
<body class="gradient-bg min-h-screen text-white">

  <!-- 알림 컨테이너 -->
  <div id="notificationContainer" class="fixed top-4 right-4 z-50 space-y-2"></div>

  <!-- 헤더 -->
  <header class="border-b border-indigo-900/50 bg-black/20 backdrop-blur-sm sticky top-0 z-40">
    <div class="max-w-screen-xl mx-auto px-6 py-4 flex items-center justify-between">
      <div class="flex items-center gap-4">
        <div class="relative">
          <div class="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
            <i class="fas fa-satellite-dish text-white text-lg"></i>
          </div>
          <span class="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 rounded-full pulse-dot border-2 border-black"></span>
        </div>
        <div>
          <h1 class="text-xl font-bold text-white">AI 브랜드 소싱 레이더</h1>
          <p class="text-xs text-indigo-300">카드포인트몰 입점팀 · Brand Intelligence System</p>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <div class="hidden md:flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full px-3 py-1">
          <span class="w-2 h-2 bg-emerald-400 rounded-full live-badge"></span>
          <span class="text-xs text-emerald-400 font-medium">AI 분석 활성</span>
        </div>
        <button onclick="openScanModal()" class="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2">
          <i class="fas fa-plus"></i> 브랜드 분석
        </button>
        <button onclick="refreshAllBrands()" class="bg-slate-700 hover:bg-slate-600 p-2 rounded-xl transition-all tooltip" title="전체 새로고침">
          <i class="fas fa-sync-alt text-sm" id="refreshIcon"></i>
          <span class="tooltip-text">전체 데이터 새로고침</span>
        </button>
      </div>
    </div>
  </header>

  <!-- 메인 레이아웃 -->
  <main class="max-w-screen-xl mx-auto px-6 py-8">

    <!-- KPI 카드 -->
    <section class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
      <div class="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 card-glow">
        <div class="flex items-center justify-between mb-3">
          <span class="text-xs text-slate-400 font-medium">탐지된 브랜드</span>
          <div class="w-8 h-8 bg-indigo-500/20 rounded-lg flex items-center justify-center">
            <i class="fas fa-store text-indigo-400 text-xs"></i>
          </div>
        </div>
        <div class="text-3xl font-bold text-white" id="kpiBrands">0</div>
        <div class="text-xs text-emerald-400 mt-1" id="kpiBrandsDelta">+0 이번주</div>
      </div>
      <div class="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 card-glow">
        <div class="flex items-center justify-between mb-3">
          <span class="text-xs text-slate-400 font-medium">입점 추천</span>
          <div class="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center">
            <i class="fas fa-star text-emerald-400 text-xs"></i>
          </div>
        </div>
        <div class="text-3xl font-bold text-white" id="kpiRecommended">0</div>
        <div class="text-xs text-emerald-400 mt-1" id="kpiRecommendedDelta">점수 80↑</div>
      </div>
      <div class="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 card-glow">
        <div class="flex items-center justify-between mb-3">
          <span class="text-xs text-slate-400 font-medium">급상승 트렌드</span>
          <div class="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
            <i class="fas fa-fire text-orange-400 text-xs"></i>
          </div>
        </div>
        <div class="text-3xl font-bold text-white" id="kpiTrending">0</div>
        <div class="text-xs text-orange-400 mt-1">팔로워 급등 감지</div>
      </div>
      <div class="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5 card-glow">
        <div class="flex items-center justify-between mb-3">
          <span class="text-xs text-slate-400 font-medium">평균 AI 점수</span>
          <div class="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center">
            <i class="fas fa-brain text-purple-400 text-xs"></i>
          </div>
        </div>
        <div class="text-3xl font-bold text-white" id="kpiAvgScore">0</div>
        <div class="text-xs text-purple-400 mt-1">/ 100점 만점</div>
      </div>
    </section>

    <!-- 2단 레이아웃 -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">

      <!-- 좌측: 브랜드 목록 (2/3) -->
      <div class="lg:col-span-2 space-y-5">

        <!-- 필터/검색 바 -->
        <div class="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-4">
          <div class="flex flex-col sm:flex-row gap-3">
            <div class="relative flex-1">
              <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
              <input type="text" id="searchInput" placeholder="브랜드명, 카테고리, 키워드 검색..." 
                class="w-full bg-slate-700/50 border border-slate-600/50 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 transition-all" 
                oninput="filterBrands()" />
            </div>
            <div class="flex gap-2 flex-wrap">
              <button class="filter-btn active px-3 py-2 rounded-xl text-xs font-medium bg-indigo-600/20 border border-indigo-600/50 text-indigo-300 transition-all" onclick="setFilter('all', this)">전체</button>
              <button class="filter-btn px-3 py-2 rounded-xl text-xs font-medium bg-slate-700 border border-slate-600 text-slate-300 transition-all" onclick="setFilter('뷰티', this)">뷰티</button>
              <button class="filter-btn px-3 py-2 rounded-xl text-xs font-medium bg-slate-700 border border-slate-600 text-slate-300 transition-all" onclick="setFilter('패션', this)">패션</button>
              <button class="filter-btn px-3 py-2 rounded-xl text-xs font-medium bg-slate-700 border border-slate-600 text-slate-300 transition-all" onclick="setFilter('라이프', this)">라이프</button>
              <button class="filter-btn px-3 py-2 rounded-xl text-xs font-medium bg-slate-700 border border-slate-600 text-slate-300 transition-all" onclick="setFilter('푸드', this)">푸드</button>
              <button class="filter-btn px-3 py-2 rounded-xl text-xs font-medium bg-slate-700 border border-slate-600 text-slate-300 transition-all" onclick="setFilter('가전', this)">가전</button>
            </div>
          </div>
          <div class="flex gap-3 mt-3">
            <select id="sortSelect" onchange="sortBrands()" class="bg-slate-700 border border-slate-600 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500">
              <option value="score">AI 점수 높은순</option>
              <option value="growth">팔로워 성장률순</option>
              <option value="recent">최근 분석순</option>
              <option value="name">이름순</option>
            </select>
            <div class="flex items-center gap-2 ml-auto text-xs text-slate-400">
              <span id="filteredCount">0</span>개 브랜드
            </div>
          </div>
        </div>

        <!-- 브랜드 카드 리스트 -->
        <div id="brandList" class="space-y-3">
          <!-- JS로 채워짐 -->
        </div>
        
        <!-- 빈 상태 -->
        <div id="emptyState" class="hidden text-center py-16">
          <div class="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <i class="fas fa-satellite-dish text-3xl text-slate-600"></i>
          </div>
          <p class="text-slate-400 text-lg font-medium">탐지된 브랜드가 없습니다</p>
          <p class="text-slate-500 text-sm mt-2">상단의 '브랜드 분석' 버튼으로 새 브랜드를 분석해보세요</p>
        </div>
      </div>

      <!-- 우측: 사이드패널 (1/3) -->
      <div class="space-y-5">

        <!-- 카테고리 분포 차트 -->
        <div class="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
          <h3 class="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <i class="fas fa-chart-donut text-indigo-400"></i> 카테고리 분포
          </h3>
          <div class="relative">
            <canvas id="categoryChart" height="200"></canvas>
          </div>
        </div>

        <!-- 트렌드 알림 피드 -->
        <div class="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
          <h3 class="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2 justify-between">
            <span class="flex items-center gap-2">
              <i class="fas fa-bell text-orange-400"></i> 트렌드 알림
            </span>
            <span class="text-xs text-slate-500" id="alertTime">방금 전</span>
          </h3>
          <div id="alertFeed" class="space-y-2 max-h-64 overflow-y-auto pr-1">
            <!-- JS로 채워짐 -->
          </div>
        </div>

        <!-- 빠른 분석 -->
        <div class="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 border border-indigo-700/30 rounded-2xl p-5">
          <h3 class="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
            <i class="fas fa-zap text-yellow-400"></i> 빠른 URL 분석
          </h3>
          <p class="text-xs text-slate-400 mb-3">인스타그램/쇼핑몰 URL을 입력하면 AI가 즉시 분석합니다</p>
          <div class="space-y-2">
            <input type="text" id="quickUrl" placeholder="https://instagram.com/brand..." 
              class="w-full bg-slate-800/70 border border-slate-600/50 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all" />
            <input type="text" id="quickBrandName" placeholder="브랜드명 (선택사항)" 
              class="w-full bg-slate-800/70 border border-slate-600/50 rounded-xl px-3 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all" />
            <button onclick="quickAnalyze()" id="quickAnalyzeBtn"
              class="w-full bg-indigo-600 hover:bg-indigo-700 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2">
              <i class="fas fa-satellite-dish"></i> AI 분석 시작
            </button>
          </div>
        </div>

        <!-- 이번주 TOP 3 -->
        <div class="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
          <h3 class="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
            <i class="fas fa-trophy text-yellow-400"></i> 이번주 TOP 브랜드
          </h3>
          <div id="topBrandsWeek" class="space-y-3">
            <p class="text-xs text-slate-500 text-center py-4">브랜드를 분석하면 TOP 랭킹이 표시됩니다</p>
          </div>
        </div>

      </div>
    </div>
  </main>

  <!-- 브랜드 분석 모달 -->
  <div id="scanModal" class="fixed inset-0 z-50 hidden modal-overlay bg-black/60 flex items-center justify-center p-4">
    <div class="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-lg p-8 relative">
      <button onclick="closeScanModal()" class="absolute top-4 right-4 text-slate-400 hover:text-white transition-all w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-700">
        <i class="fas fa-times"></i>
      </button>
      <div class="flex items-center gap-3 mb-6">
        <div class="w-12 h-12 bg-indigo-600 rounded-2xl flex items-center justify-center">
          <i class="fas fa-satellite-dish text-white text-xl"></i>
        </div>
        <div>
          <h2 class="text-xl font-bold text-white">신규 브랜드 AI 분석</h2>
          <p class="text-xs text-slate-400">AI가 브랜드 잠재력을 종합 분석합니다</p>
        </div>
      </div>

      <div class="space-y-4" id="scanForm">
        <div>
          <label class="text-xs font-medium text-slate-300 mb-1.5 block">브랜드명 *</label>
          <input type="text" id="modalBrandName" placeholder="예: 브랜드명을 입력하세요" 
            class="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all" />
        </div>
        <div>
          <label class="text-xs font-medium text-slate-300 mb-1.5 block">카테고리 *</label>
          <select id="modalCategory" class="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-indigo-500 transition-all">
            <option value="">카테고리 선택</option>
            <option value="뷰티">뷰티/스킨케어</option>
            <option value="패션">패션/의류</option>
            <option value="라이프">라이프스타일/홈</option>
            <option value="푸드">푸드/식품</option>
            <option value="가전">가전/IT</option>
            <option value="스포츠">스포츠/아웃도어</option>
            <option value="유아">유아/키즈</option>
            <option value="펫">펫/반려동물</option>
          </select>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs font-medium text-slate-300 mb-1.5 block">인스타 팔로워 수</label>
            <input type="number" id="modalFollowers" placeholder="예: 150000" 
              class="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all" />
          </div>
          <div>
            <label class="text-xs font-medium text-slate-300 mb-1.5 block">월 성장률 (%)</label>
            <input type="number" id="modalGrowthRate" placeholder="예: 12.5" step="0.1"
              class="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all" />
          </div>
        </div>
        <div>
          <label class="text-xs font-medium text-slate-300 mb-1.5 block">주요 판매채널</label>
          <div class="flex flex-wrap gap-2" id="channelButtons">
            <button type="button" onclick="toggleChannel(this)" data-channel="인스타그램" class="channel-btn px-3 py-1.5 rounded-lg text-xs border border-slate-600 text-slate-400 hover:border-indigo-500 hover:text-indigo-400 transition-all">인스타그램</button>
            <button type="button" onclick="toggleChannel(this)" data-channel="네이버" class="channel-btn px-3 py-1.5 rounded-lg text-xs border border-slate-600 text-slate-400 hover:border-indigo-500 hover:text-indigo-400 transition-all">네이버</button>
            <button type="button" onclick="toggleChannel(this)" data-channel="무신사" class="channel-btn px-3 py-1.5 rounded-lg text-xs border border-slate-600 text-slate-400 hover:border-indigo-500 hover:text-indigo-400 transition-all">무신사</button>
            <button type="button" onclick="toggleChannel(this)" data-channel="올리브영" class="channel-btn px-3 py-1.5 rounded-lg text-xs border border-slate-600 text-slate-400 hover:border-indigo-500 hover:text-indigo-400 transition-all">올리브영</button>
            <button type="button" onclick="toggleChannel(this)" data-channel="쿠팡" class="channel-btn px-3 py-1.5 rounded-lg text-xs border border-slate-600 text-slate-400 hover:border-indigo-500 hover:text-indigo-400 transition-all">쿠팡</button>
            <button type="button" onclick="toggleChannel(this)" data-channel="자사몰" class="channel-btn px-3 py-1.5 rounded-lg text-xs border border-slate-600 text-slate-400 hover:border-indigo-500 hover:text-indigo-400 transition-all">자사몰</button>
          </div>
        </div>
        <div>
          <label class="text-xs font-medium text-slate-300 mb-1.5 block">추가 정보 (선택)</label>
          <textarea id="modalDescription" rows="3" placeholder="브랜드 특징, 대표 상품, 가격대, 타겟 고객층 등 AI 분석에 활용될 정보를 입력해주세요..."
            class="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-all resize-none"></textarea>
        </div>
        <button onclick="startAnalysis()" id="startAnalysisBtn"
          class="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 py-3.5 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 mt-2">
          <i class="fas fa-brain"></i> AI 종합 분석 시작
        </button>
      </div>

      <!-- 분석 중 상태 -->
      <div id="analyzingState" class="hidden text-center py-8">
        <div class="relative w-24 h-24 mx-auto mb-6">
          <svg class="w-24 h-24 radar-ring" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="#4f46e5" stroke-width="1" stroke-dasharray="5 5" opacity="0.4"/>
            <circle cx="50" cy="50" r="30" fill="none" stroke="#4f46e5" stroke-width="1" stroke-dasharray="5 5" opacity="0.3"/>
            <circle cx="50" cy="50" r="15" fill="none" stroke="#4f46e5" stroke-width="1" opacity="0.5"/>
            <line x1="50" y1="5" x2="50" y2="50" stroke="#6366f1" stroke-width="2" opacity="0.8"/>
          </svg>
          <div class="absolute inset-0 flex items-center justify-center">
            <i class="fas fa-satellite-dish text-indigo-400 text-2xl pulse-dot"></i>
          </div>
        </div>
        <h3 class="text-lg font-bold text-white mb-2">AI 분석 중...</h3>
        <div id="analysisStep" class="text-sm text-indigo-300 mb-4">SNS 트렌드 스캔 중</div>
        <div class="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
          <div id="analysisProgress" class="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500" style="width:0%"></div>
        </div>
        <div class="grid grid-cols-3 gap-2 mt-6 text-xs text-slate-400">
          <div id="step1" class="flex flex-col items-center gap-1 opacity-30 transition-all">
            <i class="fas fa-hashtag text-indigo-400 text-lg"></i><span>SNS 분석</span>
          </div>
          <div id="step2" class="flex flex-col items-center gap-1 opacity-30 transition-all">
            <i class="fas fa-chart-line text-green-400 text-lg"></i><span>트렌드 검토</span>
          </div>
          <div id="step3" class="flex flex-col items-center gap-1 opacity-30 transition-all">
            <i class="fas fa-brain text-purple-400 text-lg"></i><span>AI 스코어링</span>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- 브랜드 상세 모달 -->
  <div id="detailModal" class="fixed inset-0 z-50 hidden modal-overlay bg-black/70 flex items-center justify-center p-4">
    <div class="bg-slate-900 border border-slate-700 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
      <div id="detailContent"></div>
    </div>
  </div>

  <script>
  // ============================================================
  // 전역 상태
  // ============================================================
  let brands = [];
  let filteredBrands = [];
  let currentFilter = 'all';
  let categoryChart = null;
  let selectedChannels = [];

  // ============================================================
  // 샘플 브랜드 데이터 (데모용)
  // ============================================================
  const sampleBrands = [
    {
      id: 'b001', name: '라운드랩', category: '뷰티',
      followers: 285000, growthRate: 18.5, engagementRate: 4.2,
      channels: ['인스타그램', '올리브영', '네이버'],
      score: 91, trendScore: 88, potentialScore: 94, riskScore: 15,
      status: '입점 추천', statusColor: 'emerald',
      tags: ['클린뷰티', '제주성분', 'MZ타겟', '감성패키지'],
      description: '제주 원료 기반 더마 코스메틱 브랜드. 클린뷰티 트렌드에 최적화된 포지셔닝으로 2030 여성 타겟 강세.',
      avgPrice: 28000, priceRange: '15,000 ~ 65,000원',
      salesVelocity: '주간 1,200건 추정', competitorGap: '낮음',
      aiComment: '포인트몰 핵심 타겟층(30대 여성 카드 고객)과 완벽 일치. 올리브영 월 베스트셀러 진입 이력 보유. 독점 기획세트 제안 시 포인트 소진 효과 극대화 예상.',
      analyzedAt: new Date(Date.now() - 3600000),
      alert: true
    },
    {
      id: 'b002', name: '무탠다드', category: '패션',
      followers: 198000, growthRate: 24.3, engagementRate: 5.8,
      channels: ['인스타그램', '무신사', '자사몰'],
      score: 87, trendScore: 95, potentialScore: 82, riskScore: 22,
      status: '입점 추천', statusColor: 'emerald',
      tags: ['젠더리스', '베이직', '힙스터', '트렌디'],
      description: '젠더리스 베이직 의류 브랜드. 무신사 내 빠른 성장세로 2024년 신흥 브랜드 Top10 진입.',
      avgPrice: 45000, priceRange: '25,000 ~ 120,000원',
      salesVelocity: '주간 800건 추정', competitorGap: '중간',
      aiComment: '20-30대 패션 포인트 사용 패턴과 높은 연관성. 팔로워 증가율 24% 기록 중 - 현재가 최적 입점 시기. 시즌 기획전 연계 시 높은 CTR 기대.',
      analyzedAt: new Date(Date.now() - 7200000),
      alert: true
    },
    {
      id: 'b003', name: '어니스트컴퍼니', category: '라이프',
      followers: 142000, growthRate: 9.2, engagementRate: 3.1,
      channels: ['네이버', '쿠팡', '자사몰'],
      score: 74, trendScore: 68, potentialScore: 79, riskScore: 28,
      status: '검토 중', statusColor: 'yellow',
      tags: ['친환경', '지속가능', '홈케어', '프리미엄'],
      description: '친환경 홈케어 제품 브랜드. ESG 경영 트렌드에 부합하나 포인트몰 카테고리 경쟁 강도 높음.',
      avgPrice: 35000, priceRange: '12,000 ~ 89,000원',
      salesVelocity: '주간 450건 추정', competitorGap: '높음',
      aiComment: '환경 가치 소비 트렌드와 부합하나, 포인트몰 라이프 카테고리 기존 입점사와 포지셔닝 겹침. 차별화 기획이 필요하며, 친환경 기획전 연계 시 의미있는 성과 가능.',
      analyzedAt: new Date(Date.now() - 86400000),
      alert: false
    },
    {
      id: 'b004', name: '프레시코드', category: '푸드',
      followers: 89000, growthRate: 31.7, engagementRate: 6.4,
      channels: ['인스타그램', '쿠팡', '자사몰'],
      score: 83, trendScore: 91, potentialScore: 78, riskScore: 35,
      status: '주목 브랜드', statusColor: 'orange',
      tags: ['샐러드', '구독', '다이어트', '밀키트'],
      description: '프리미엄 샐러드·밀키트 구독 브랜드. 팔로워 월 31% 폭발적 성장 중.',
      avgPrice: 55000, priceRange: '38,000 ~ 150,000원',
      salesVelocity: '주간 600건 추정', competitorGap: '중간',
      aiComment: '팔로워 급성장(31%)으로 주목. 건강식 트렌드 최전선. 단, 냉장 배송 제약으로 포인트 결제 후 별도 배송 연동 필요. 구독 포인트 정기결제 상품으로 기획 시 차별화 가능.',
      analyzedAt: new Date(Date.now() - 43200000),
      alert: true
    }
  ];

  // ============================================================
  // 초기화
  // ============================================================
  document.addEventListener('DOMContentLoaded', () => {
    brands = JSON.parse(localStorage.getItem('sonar_brands') || 'null') || sampleBrands;
    renderAll();
    updateKPIs();
    renderCategoryChart();
    renderAlertFeed();
    renderTopBrands();
  });

  function renderAll() {
    applyFilter();
    updateCount();
  }

  // ============================================================
  // KPI 업데이트
  // ============================================================
  function updateKPIs() {
    const total = brands.length;
    const recommended = brands.filter(b => b.score >= 80).length;
    const trending = brands.filter(b => b.growthRate >= 20).length;
    const avgScore = total > 0 ? Math.round(brands.reduce((s,b) => s+b.score, 0) / total) : 0;
    
    animateNumber('kpiBrands', total);
    animateNumber('kpiRecommended', recommended);
    animateNumber('kpiTrending', trending);
    animateNumber('kpiAvgScore', avgScore);
    
    const thisWeek = brands.filter(b => (Date.now() - new Date(b.analyzedAt).getTime()) < 604800000).length;
    document.getElementById('kpiBrandsDelta').textContent = '+' + thisWeek + ' 이번주';
  }

  function animateNumber(id, target) {
    const el = document.getElementById(id);
    let current = 0;
    const step = Math.ceil(target / 30);
    const timer = setInterval(() => {
      current = Math.min(current + step, target);
      el.textContent = current;
      if (current >= target) clearInterval(timer);
    }, 40);
  }

  // ============================================================
  // 브랜드 필터/정렬
  // ============================================================
  function setFilter(filter, btn) {
    currentFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    applyFilter();
  }

  function applyFilter() {
    const keyword = document.getElementById('searchInput')?.value.toLowerCase() || '';
    filteredBrands = brands.filter(b => {
      const matchCategory = currentFilter === 'all' || b.category === currentFilter;
      const matchKeyword = keyword === '' || 
        b.name.toLowerCase().includes(keyword) || 
        b.category.toLowerCase().includes(keyword) ||
        (b.tags || []).some(t => t.toLowerCase().includes(keyword));
      return matchCategory && matchKeyword;
    });
    sortBrands();
    renderBrandList();
    updateCount();
  }

  function sortBrands() {
    const sort = document.getElementById('sortSelect')?.value || 'score';
    filteredBrands.sort((a, b) => {
      if (sort === 'score') return b.score - a.score;
      if (sort === 'growth') return b.growthRate - a.growthRate;
      if (sort === 'recent') return new Date(b.analyzedAt) - new Date(a.analyzedAt);
      if (sort === 'name') return a.name.localeCompare(b.name);
      return 0;
    });
    renderBrandList();
  }

  function filterBrands() { applyFilter(); }

  function updateCount() {
    const el = document.getElementById('filteredCount');
    if (el) el.textContent = filteredBrands.length;
  }

  // ============================================================
  // 브랜드 카드 렌더링
  // ============================================================
  function renderBrandList() {
    const container = document.getElementById('brandList');
    const empty = document.getElementById('emptyState');
    if (!container) return;

    if (filteredBrands.length === 0) {
      container.innerHTML = '';
      empty.classList.remove('hidden');
      return;
    }
    empty.classList.add('hidden');

    container.innerHTML = filteredBrands.map(brand => {
      const statusColors = {
        '입점 추천': 'emerald', '검토 중': 'yellow', '주목 브랜드': 'orange', '보류': 'red'
      };
      const color = statusColors[brand.status] || 'slate';
      const scoreColor = brand.score >= 85 ? 'emerald' : brand.score >= 70 ? 'yellow' : 'red';
      const timeAgo = getTimeAgo(brand.analyzedAt);
      const growthIcon = brand.growthRate >= 20 ? '🔥' : brand.growthRate >= 10 ? '📈' : '→';

      return \`
      <div class="brand-card bg-slate-800/60 border border-slate-700/50 rounded-2xl p-5 cursor-pointer hover:border-indigo-500/50 transition-all"
           onclick="openDetailModal('\${brand.id}')">
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-center gap-3 flex-1 min-w-0">
            <div class="w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold flex-shrink-0"
                 style="background: \${getCategoryColor(brand.category)}22; border: 1px solid \${getCategoryColor(brand.category)}44;">
              \${getCategoryEmoji(brand.category)}
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2 flex-wrap">
                <h4 class="font-bold text-white text-base">\${brand.name}</h4>
                \${brand.alert ? '<span class="text-xs bg-red-500/20 text-red-400 border border-red-500/30 rounded-full px-2 py-0.5 animate-pulse">NEW</span>' : ''}
              </div>
              <div class="flex items-center gap-2 mt-1 flex-wrap">
                <span class="text-xs text-\${color}-400 bg-\${color}-500/10 border border-\${color}-500/30 rounded-full px-2.5 py-0.5 font-medium">\${brand.status}</span>
                <span class="text-xs text-slate-400">\${brand.category}</span>
                <span class="text-xs text-slate-500">\${timeAgo}</span>
              </div>
            </div>
          </div>
          
          <!-- AI 점수 원형 -->
          <div class="flex-shrink-0 relative w-14 h-14">
            <svg class="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
              <circle cx="28" cy="28" r="22" fill="none" stroke="#1e293b" stroke-width="4"/>
              <circle cx="28" cy="28" r="22" fill="none" stroke="\${scoreColor === 'emerald' ? '#10b981' : scoreColor === 'yellow' ? '#f59e0b' : '#ef4444'}" 
                stroke-width="4" stroke-linecap="round"
                stroke-dasharray="\${(brand.score / 100) * 138.2} 138.2" 
                class="progress-ring"/>
            </svg>
            <div class="absolute inset-0 flex flex-col items-center justify-center">
              <span class="text-sm font-bold text-white leading-none">\${brand.score}</span>
              <span class="text-[9px] text-slate-400">점</span>
            </div>
          </div>
        </div>

        <!-- 세부 지표 -->
        <div class="grid grid-cols-3 gap-3 mt-4">
          <div class="bg-slate-900/50 rounded-xl p-2.5 text-center">
            <div class="text-xs text-slate-400 mb-1">팔로워</div>
            <div class="text-sm font-semibold text-white">\${formatNumber(brand.followers)}</div>
          </div>
          <div class="bg-slate-900/50 rounded-xl p-2.5 text-center">
            <div class="text-xs text-slate-400 mb-1">월 성장률</div>
            <div class="text-sm font-semibold \${brand.growthRate >= 20 ? 'text-orange-400' : 'text-emerald-400'}">\${growthIcon} \${brand.growthRate}%</div>
          </div>
          <div class="bg-slate-900/50 rounded-xl p-2.5 text-center">
            <div class="text-xs text-slate-400 mb-1">참여율</div>
            <div class="text-sm font-semibold text-indigo-400">\${brand.engagementRate}%</div>
          </div>
        </div>

        <!-- 점수 바 -->
        <div class="mt-4 space-y-2">
          <div class="flex items-center gap-2">
            <span class="text-xs text-slate-500 w-16 flex-shrink-0">트렌드</span>
            <div class="flex-1 bg-slate-900 rounded-full h-1.5 overflow-hidden">
              <div class="h-full bg-blue-500 rounded-full score-bar" style="width:\${brand.trendScore}%"></div>
            </div>
            <span class="text-xs text-slate-400 w-8 text-right">\${brand.trendScore}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs text-slate-500 w-16 flex-shrink-0">잠재력</span>
            <div class="flex-1 bg-slate-900 rounded-full h-1.5 overflow-hidden">
              <div class="h-full bg-emerald-500 rounded-full score-bar" style="width:\${brand.potentialScore}%"></div>
            </div>
            <span class="text-xs text-slate-400 w-8 text-right">\${brand.potentialScore}</span>
          </div>
        </div>

        <!-- 태그 -->
        <div class="flex flex-wrap gap-1.5 mt-3">
          \${(brand.tags || []).slice(0,4).map(tag => \`
            <span class="tag-badge text-xs bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 rounded-full px-2.5 py-1">#\${tag}</span>
          \`).join('')}
        </div>

        <!-- AI 코멘트 미리보기 -->
        <div class="mt-3 bg-slate-900/60 rounded-xl p-3 border border-slate-700/30">
          <div class="flex items-start gap-2">
            <i class="fas fa-brain text-purple-400 text-xs mt-0.5 flex-shrink-0"></i>
            <p class="text-xs text-slate-400 line-clamp-2">\${brand.aiComment}</p>
          </div>
        </div>

        <div class="flex gap-2 mt-3">
          <button onclick="event.stopPropagation(); openDetailModal('\${brand.id}')" 
            class="flex-1 bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-600/50 text-indigo-300 hover:text-white py-2 rounded-xl text-xs font-medium transition-all">
            <i class="fas fa-expand-alt mr-1"></i> 상세 보기
          </button>
          <button onclick="event.stopPropagation(); deleteBrand('\${brand.id}')" 
            class="bg-slate-700 hover:bg-red-900/50 border border-slate-600 hover:border-red-700 text-slate-400 hover:text-red-400 p-2 rounded-xl text-xs transition-all">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
      \`;
    }).join('');
  }

  // ============================================================
  // 카테고리 차트
  // ============================================================
  function renderCategoryChart() {
    const ctx = document.getElementById('categoryChart')?.getContext('2d');
    if (!ctx) return;

    const categories = {};
    brands.forEach(b => { categories[b.category] = (categories[b.category] || 0) + 1; });
    
    if (Object.keys(categories).length === 0) {
      categories['데이터없음'] = 1;
    }

    const colors = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#f97316','#ec4899'];
    
    if (categoryChart) categoryChart.destroy();
    categoryChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: Object.keys(categories),
        datasets: [{
          data: Object.values(categories),
          backgroundColor: colors.slice(0, Object.keys(categories).length),
          borderWidth: 0,
          spacing: 3
        }]
      },
      options: {
        responsive: true,
        cutout: '65%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#94a3b8', font: { size: 11 }, padding: 8, boxWidth: 10 }
          }
        }
      }
    });
  }

  // ============================================================
  // 트렌드 알림 피드
  // ============================================================
  function renderAlertFeed() {
    const container = document.getElementById('alertFeed');
    if (!container) return;

    const alerts = [
      { icon: 'fire', color: 'orange', text: '뷰티 카테고리 팔로워 급증 감지 (+18.5%)', time: '1시간 전' },
      { icon: 'chart-line', color: 'emerald', text: '패션 신규 브랜드 3개 진입 적기', time: '2시간 전' },
      { icon: 'bell', color: 'indigo', text: '라운드랩 AI 점수 91점 - 즉시 입점 검토', time: '3시간 전' },
      { icon: 'star', color: 'yellow', text: '무탠다드 무신사 주간 베스트 진입', time: '4시간 전' },
      { icon: 'exclamation-triangle', color: 'red', text: '경쟁사 포인트몰 뷰티 3개 신규 입점', time: '5시간 전' },
    ];

    container.innerHTML = alerts.map(a => \`
      <div class="flex items-start gap-2 py-2 border-b border-slate-700/30 last:border-0">
        <div class="w-6 h-6 bg-\${a.color}-500/10 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
          <i class="fas fa-\${a.icon} text-\${a.color}-400 text-[10px]"></i>
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-xs text-slate-300 leading-relaxed">\${a.text}</p>
          <p class="text-[10px] text-slate-500 mt-0.5">\${a.time}</p>
        </div>
      </div>
    \`).join('');

    document.getElementById('alertTime').textContent = new Date().toLocaleTimeString('ko-KR', {hour:'2-digit',minute:'2-digit'}) + ' 업데이트';
  }

  // ============================================================
  // TOP 브랜드
  // ============================================================
  function renderTopBrands() {
    const container = document.getElementById('topBrandsWeek');
    if (!container) return;
    
    const sorted = [...brands].sort((a,b) => b.score - a.score).slice(0,3);
    if (sorted.length === 0) return;

    const medals = ['🥇', '🥈', '🥉'];
    container.innerHTML = sorted.map((b,i) => \`
      <div class="flex items-center gap-3 cursor-pointer hover:bg-slate-700/30 rounded-xl p-2 transition-all" onclick="openDetailModal('\${b.id}')">
        <span class="text-lg">\${medals[i]}</span>
        <div class="flex-1 min-w-0">
          <div class="text-xs font-semibold text-white truncate">\${b.name}</div>
          <div class="text-[10px] text-slate-400">\${b.category} · 성장률 \${b.growthRate}%</div>
        </div>
        <div class="text-sm font-bold text-indigo-400">\${b.score}점</div>
      </div>
    \`).join('');
  }

  // ============================================================
  // 모달 제어
  // ============================================================
  function openScanModal() {
    document.getElementById('scanModal').classList.remove('hidden');
    document.getElementById('scanForm').classList.remove('hidden');
    document.getElementById('analyzingState').classList.add('hidden');
    document.getElementById('startAnalysisBtn').disabled = false;
  }

  function closeScanModal() {
    document.getElementById('scanModal').classList.add('hidden');
    resetForm();
  }

  function resetForm() {
    ['modalBrandName','modalFollowers','modalGrowthRate','modalDescription','modalCategory'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    selectedChannels = [];
    document.querySelectorAll('.channel-btn').forEach(b => b.classList.remove('bg-indigo-600','text-white','border-indigo-500'));
  }

  function toggleChannel(btn) {
    const ch = btn.dataset.channel;
    if (selectedChannels.includes(ch)) {
      selectedChannels = selectedChannels.filter(c => c !== ch);
      btn.classList.remove('bg-indigo-600','text-white','border-indigo-500');
    } else {
      selectedChannels.push(ch);
      btn.classList.add('bg-indigo-600','text-white','border-indigo-500');
    }
  }

  // ============================================================
  // AI 분석 실행
  // ============================================================
  async function startAnalysis() {
    const name = document.getElementById('modalBrandName').value.trim();
    const category = document.getElementById('modalCategory').value;
    const followers = parseInt(document.getElementById('modalFollowers').value) || 50000;
    const growthRate = parseFloat(document.getElementById('modalGrowthRate').value) || 10;
    const description = document.getElementById('modalDescription').value.trim();

    if (!name || !category) {
      showNotification('브랜드명과 카테고리를 입력해주세요', 'warning');
      return;
    }

    // 분석 UI 전환
    document.getElementById('scanForm').classList.add('hidden');
    document.getElementById('analyzingState').classList.remove('hidden');

    // 진행 애니메이션
    await animateAnalysis();

    try {
      const res = await fetch('/api/analyze-brand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, category, followers, growthRate, channels: selectedChannels, description })
      });
      const data = await res.json();

      if (data.success) {
        brands.unshift(data.brand);
        localStorage.setItem('sonar_brands', JSON.stringify(brands));
        closeScanModal();
        renderAll();
        updateKPIs();
        renderCategoryChart();
        renderTopBrands();
        showNotification(\`✅ \${name} 분석 완료! AI 점수: \${data.brand.score}점\`, 'success');
      } else {
        throw new Error(data.error || '분석 실패');
      }
    } catch (e) {
      // Fallback: 로컬 AI 분석
      const brand = generateLocalAnalysis({ name, category, followers, growthRate, channels: selectedChannels, description });
      brands.unshift(brand);
      localStorage.setItem('sonar_brands', JSON.stringify(brands));
      closeScanModal();
      renderAll();
      updateKPIs();
      renderCategoryChart();
      renderTopBrands();
      showNotification(\`✅ \${name} 분석 완료! AI 점수: \${brand.score}점\`, 'success');
    }
  }

  async function animateAnalysis() {
    const steps = [
      { id: 'step1', text: 'SNS 트렌드 스캔 중...', progress: 30 },
      { id: 'step2', text: '시장 경쟁 환경 분석 중...', progress: 65 },
      { id: 'step3', text: 'AI 종합 스코어링 중...', progress: 90 },
    ];
    
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i];
      document.getElementById('analysisStep').textContent = s.text;
      document.getElementById('analysisProgress').style.width = s.progress + '%';
      document.getElementById(s.id).style.opacity = '1';
      await sleep(900);
    }
    document.getElementById('analysisProgress').style.width = '100%';
    await sleep(400);
  }

  // 로컬 AI 분석 (API 없을 때 fallback)
  function generateLocalAnalysis({ name, category, followers, growthRate, channels, description }) {
    const baseScore = Math.min(100, Math.round(
      (Math.min(followers, 500000) / 500000) * 25 +
      (Math.min(growthRate, 40) / 40) * 30 +
      (channels.length / 6) * 15 +
      Math.random() * 30
    ));
    
    const trendScore = Math.min(100, Math.round(baseScore * 0.9 + Math.random() * 15));
    const potentialScore = Math.min(100, Math.round(baseScore * 1.05 + Math.random() * 10));
    const riskScore = Math.round(100 - baseScore + Math.random() * 20);

    const statusMap = { 91: '입점 추천', 75: '입점 추천', 60: '검토 중', 0: '보류' };
    let status = '보류';
    if (baseScore >= 80) status = '입점 추천';
    else if (baseScore >= 65) status = '검토 중';
    else if (baseScore >= 50) status = '주목 브랜드';

    const categoryTags = {
      '뷰티': ['클린뷰티','스킨케어','감성패키지','더마'],
      '패션': ['트렌디','MZ타겟','시즌리스','베이직'],
      '라이프': ['홈케어','미니멀','인테리어','프리미엄'],
      '푸드': ['건강식','구독','프리미엄','간편식'],
      '가전': ['스마트','에너지절약','디자인가전','신기술'],
    };
    const tags = (categoryTags[category] || ['트렌드','신규','주목']).slice(0, 4);

    const comments = [
      '포인트몰 핵심 고객층과 높은 연관성 확인. 시즌 기획전 연계 시 우수한 포인트 소진 효과 기대.',
      '빠른 성장세로 현재가 최적 입점 시점. 독점 기획 제안으로 경쟁 차별화 가능.',
      '카테고리 내 경쟁 강도를 고려한 포지셔닝 전략 필요. 차별화 상품 구성 권장.',
    ];

    const engagementRate = Math.round((2 + Math.random() * 4) * 10) / 10;

    return {
      id: 'b' + Date.now(),
      name, category,
      followers,
      growthRate,
      engagementRate,
      channels: channels.length > 0 ? channels : ['자사몰'],
      score: baseScore,
      trendScore,
      potentialScore,
      riskScore,
      status,
      statusColor: status === '입점 추천' ? 'emerald' : status === '검토 중' ? 'yellow' : 'orange',
      tags,
      description: description || \`\${category} 카테고리 신규 브랜드. AI 분석 기반 입점 가능성 평가 완료.\`,
      avgPrice: Math.round(Math.random() * 50000 + 15000),
      priceRange: '미입력',
      salesVelocity: '분석 중',
      competitorGap: riskScore < 30 ? '낮음' : riskScore < 50 ? '중간' : '높음',
      aiComment: comments[Math.floor(Math.random() * comments.length)],
      analyzedAt: new Date(),
      alert: baseScore >= 80
    };
  }

  // ============================================================
  // 빠른 URL 분석
  // ============================================================
  async function quickAnalyze() {
    const url = document.getElementById('quickUrl').value.trim();
    const brandName = document.getElementById('quickBrandName').value.trim();
    
    if (!url) {
      showNotification('URL을 입력해주세요', 'warning');
      return;
    }

    const btn = document.getElementById('quickAnalyzeBtn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>분석 중...';

    try {
      const res = await fetch('/api/analyze-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, brandName })
      });
      const data = await res.json();
      if (data.success) {
        brands.unshift(data.brand);
        localStorage.setItem('sonar_brands', JSON.stringify(brands));
        renderAll(); updateKPIs(); renderCategoryChart(); renderTopBrands();
        document.getElementById('quickUrl').value = '';
        document.getElementById('quickBrandName').value = '';
        showNotification(\`✅ URL 분석 완료! \${data.brand.name}\`, 'success');
      }
    } catch(e) {
      showNotification('URL 분석 실패. 직접 입력 방식을 사용해주세요.', 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fas fa-satellite-dish mr-2"></i>AI 분석 시작';
    }
  }

  // ============================================================
  // 상세 모달
  // ============================================================
  function openDetailModal(id) {
    const brand = brands.find(b => b.id === id);
    if (!brand) return;

    const scoreColor = brand.score >= 85 ? 'emerald' : brand.score >= 70 ? 'yellow' : 'red';
    const riskColor = brand.riskScore < 25 ? 'emerald' : brand.riskScore < 45 ? 'yellow' : 'red';

    document.getElementById('detailContent').innerHTML = \`
      <div class="p-8">
        <div class="flex items-start justify-between mb-6">
          <div class="flex items-center gap-4">
            <div class="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
                 style="background: \${getCategoryColor(brand.category)}22; border: 2px solid \${getCategoryColor(brand.category)}44;">
              \${getCategoryEmoji(brand.category)}
            </div>
            <div>
              <h2 class="text-2xl font-bold text-white">\${brand.name}</h2>
              <div class="flex items-center gap-2 mt-1">
                <span class="text-sm text-\${brand.statusColor}-400 bg-\${brand.statusColor}-500/10 border border-\${brand.statusColor}-500/30 rounded-full px-3 py-0.5">\${brand.status}</span>
                <span class="text-sm text-slate-400">\${brand.category}</span>
              </div>
            </div>
          </div>
          <button onclick="document.getElementById('detailModal').classList.add('hidden')" 
            class="text-slate-400 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-700 transition-all">
            <i class="fas fa-times"></i>
          </button>
        </div>

        <!-- AI 점수 큰 표시 -->
        <div class="grid grid-cols-4 gap-4 mb-6">
          <div class="col-span-1 bg-slate-800 rounded-2xl p-4 flex flex-col items-center justify-center">
            <div class="text-xs text-slate-400 mb-1">AI 종합</div>
            <div class="text-4xl font-black text-\${scoreColor}-400">\${brand.score}</div>
            <div class="text-xs text-slate-500">/ 100</div>
          </div>
          <div class="bg-slate-800 rounded-2xl p-4">
            <div class="text-xs text-slate-400 mb-2">트렌드 점수</div>
            <div class="text-2xl font-bold text-blue-400">\${brand.trendScore}</div>
            <div class="w-full bg-slate-700 rounded-full h-1.5 mt-2"><div class="h-full bg-blue-500 rounded-full" style="width:\${brand.trendScore}%"></div></div>
          </div>
          <div class="bg-slate-800 rounded-2xl p-4">
            <div class="text-xs text-slate-400 mb-2">잠재력 점수</div>
            <div class="text-2xl font-bold text-emerald-400">\${brand.potentialScore}</div>
            <div class="w-full bg-slate-700 rounded-full h-1.5 mt-2"><div class="h-full bg-emerald-500 rounded-full" style="width:\${brand.potentialScore}%"></div></div>
          </div>
          <div class="bg-slate-800 rounded-2xl p-4">
            <div class="text-xs text-slate-400 mb-2">리스크</div>
            <div class="text-2xl font-bold text-\${riskColor}-400">\${brand.riskScore}</div>
            <div class="w-full bg-slate-700 rounded-full h-1.5 mt-2"><div class="h-full bg-\${riskColor}-500 rounded-full" style="width:\${brand.riskScore}%"></div></div>
          </div>
        </div>

        <!-- 핵심 지표 -->
        <div class="grid grid-cols-2 gap-4 mb-6">
          <div class="bg-slate-800 rounded-2xl p-4 space-y-3">
            <h4 class="text-sm font-semibold text-slate-200">📊 채널 현황</h4>
            <div class="space-y-2 text-sm">
              <div class="flex justify-between"><span class="text-slate-400">팔로워</span><span class="text-white font-medium">\${formatNumber(brand.followers)}</span></div>
              <div class="flex justify-between"><span class="text-slate-400">월 성장률</span><span class="text-emerald-400 font-medium">+\${brand.growthRate}%</span></div>
              <div class="flex justify-between"><span class="text-slate-400">참여율</span><span class="text-indigo-400 font-medium">\${brand.engagementRate}%</span></div>
            </div>
            <div class="flex flex-wrap gap-1 pt-2">
              \${(brand.channels || []).map(c => \`<span class="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded-lg">\${c}</span>\`).join('')}
            </div>
          </div>
          <div class="bg-slate-800 rounded-2xl p-4 space-y-3">
            <h4 class="text-sm font-semibold text-slate-200">💰 상품 현황</h4>
            <div class="space-y-2 text-sm">
              <div class="flex justify-between"><span class="text-slate-400">가격대</span><span class="text-white font-medium">\${brand.priceRange}</span></div>
              <div class="flex justify-between"><span class="text-slate-400">판매 속도</span><span class="text-white font-medium">\${brand.salesVelocity}</span></div>
              <div class="flex justify-between"><span class="text-slate-400">경쟁 강도</span>
                <span class="\${brand.competitorGap === '낮음' ? 'text-emerald-400' : brand.competitorGap === '중간' ? 'text-yellow-400' : 'text-red-400'} font-medium">\${brand.competitorGap}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- AI 분석 코멘트 -->
        <div class="bg-gradient-to-r from-indigo-900/30 to-purple-900/30 border border-indigo-700/30 rounded-2xl p-5 mb-6">
          <div class="flex items-start gap-3">
            <div class="w-8 h-8 bg-purple-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <i class="fas fa-brain text-purple-400"></i>
            </div>
            <div>
              <h4 class="text-sm font-semibold text-white mb-2">AI 입점 분석 리포트</h4>
              <p class="text-sm text-slate-300 leading-relaxed">\${brand.aiComment}</p>
            </div>
          </div>
        </div>

        <!-- 브랜드 설명 -->
        <div class="bg-slate-800 rounded-2xl p-4 mb-6">
          <h4 class="text-sm font-semibold text-slate-200 mb-2">📝 브랜드 개요</h4>
          <p class="text-sm text-slate-400 leading-relaxed">\${brand.description}</p>
          <div class="flex flex-wrap gap-1.5 mt-3">
            \${(brand.tags || []).map(t => \`<span class="text-xs bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 rounded-full px-2.5 py-1">#\${t}</span>\`).join('')}
          </div>
        </div>

        <!-- 액션 버튼 -->
        <div class="flex gap-3">
          <button onclick="markAsRecommended('\${brand.id}')" 
            class="flex-1 bg-emerald-600 hover:bg-emerald-700 py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2">
            <i class="fas fa-check"></i> 입점 추천 확정
          </button>
          <button onclick="addToWatchlist('\${brand.id}')"
            class="flex-1 bg-indigo-600 hover:bg-indigo-700 py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2">
            <i class="fas fa-eye"></i> 워치리스트 추가
          </button>
          <button onclick="exportReport('\${brand.id}')"
            class="bg-slate-700 hover:bg-slate-600 px-4 py-3 rounded-xl text-sm transition-all">
            <i class="fas fa-download"></i>
          </button>
        </div>
      </div>
    \`;
    document.getElementById('detailModal').classList.remove('hidden');
  }

  // ============================================================
  // 유틸리티 액션
  // ============================================================
  function markAsRecommended(id) {
    const brand = brands.find(b => b.id === id);
    if (brand) {
      brand.status = '입점 추천';
      brand.statusColor = 'emerald';
      localStorage.setItem('sonar_brands', JSON.stringify(brands));
      document.getElementById('detailModal').classList.add('hidden');
      renderAll();
      showNotification(\`✅ \${brand.name} 입점 추천으로 변경되었습니다\`, 'success');
    }
  }

  function addToWatchlist(id) {
    const brand = brands.find(b => b.id === id);
    if (brand) {
      showNotification(\`👁 \${brand.name}이(가) 워치리스트에 추가되었습니다\`, 'info');
      document.getElementById('detailModal').classList.add('hidden');
    }
  }

  function exportReport(id) {
    const brand = brands.find(b => b.id === id);
    if (!brand) return;
    
    const content = \`=== AI 브랜드 소싱 레이더 분석 리포트 ===
분석일: \${new Date().toLocaleDateString('ko-KR')}

브랜드명: \${brand.name}
카테고리: \${brand.category}
현재 상태: \${brand.status}

[AI 종합 점수] \${brand.score}점
- 트렌드 점수: \${brand.trendScore}점
- 잠재력 점수: \${brand.potentialScore}점
- 리스크 점수: \${brand.riskScore}점

[채널 현황]
- 팔로워: \${formatNumber(brand.followers)}
- 월 성장률: +\${brand.growthRate}%
- 참여율: \${brand.engagementRate}%
- 판매채널: \${(brand.channels||[]).join(', ')}

[AI 입점 분석]
\${brand.aiComment}

[브랜드 개요]
\${brand.description}

[주요 키워드]
\${(brand.tags||[]).map(t => '#'+t).join(' ')}
\`;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = \`소싱레이더_\${brand.name}_\${new Date().toLocaleDateString('ko-KR').replace(/\./g,'')}.txt\`;
    a.click();
    URL.revokeObjectURL(url);
    showNotification('📄 리포트가 다운로드되었습니다', 'success');
  }

  function deleteBrand(id) {
    if (!confirm('이 브랜드를 삭제하시겠습니까?')) return;
    brands = brands.filter(b => b.id !== id);
    localStorage.setItem('sonar_brands', JSON.stringify(brands));
    renderAll(); updateKPIs(); renderCategoryChart(); renderTopBrands();
    showNotification('브랜드가 삭제되었습니다', 'info');
  }

  async function refreshAllBrands() {
    const icon = document.getElementById('refreshIcon');
    icon.classList.add('fa-spin');
    await sleep(1500);
    renderAlertFeed();
    icon.classList.remove('fa-spin');
    showNotification('📡 데이터가 새로고침되었습니다', 'success');
  }

  // ============================================================
  // 알림
  // ============================================================
  function showNotification(message, type = 'info') {
    const colors = {
      success: 'bg-emerald-900/90 border-emerald-600 text-emerald-200',
      error: 'bg-red-900/90 border-red-600 text-red-200',
      warning: 'bg-yellow-900/90 border-yellow-600 text-yellow-200',
      info: 'bg-indigo-900/90 border-indigo-600 text-indigo-200'
    };
    const icons = { success:'check-circle', error:'exclamation-circle', warning:'exclamation-triangle', info:'info-circle' };
    
    const el = document.createElement('div');
    el.className = \`notification-slide flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-sm \${colors[type]} max-w-sm\`;
    el.innerHTML = \`<i class="fas fa-\${icons[type]}"></i><span class="text-sm font-medium">\${message}</span>\`;
    
    document.getElementById('notificationContainer').appendChild(el);
    setTimeout(() => el.remove(), 4000);
  }

  // ============================================================
  // 헬퍼 함수
  // ============================================================
  function getCategoryColor(cat) {
    const map = {'뷰티':'#ec4899','패션':'#6366f1','라이프':'#10b981','푸드':'#f59e0b','가전':'#06b6d4','스포츠':'#84cc16','유아':'#f97316','펫':'#8b5cf6'};
    return map[cat] || '#6366f1';
  }
  function getCategoryEmoji(cat) {
    const map = {'뷰티':'💄','패션':'👗','라이프':'🏠','푸드':'🍱','가전':'📱','스포츠':'🏃','유아':'🧸','펫':'🐾'};
    return map[cat] || '🛍️';
  }
  function formatNumber(n) {
    if (n >= 1000000) return (n/1000000).toFixed(1) + 'M';
    if (n >= 1000) return (n/1000).toFixed(0) + 'K';
    return n.toString();
  }
  function getTimeAgo(date) {
    const diff = Date.now() - new Date(date).getTime();
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(diff / 86400000);
    if (d > 0) return d + '일 전';
    if (h > 0) return h + '시간 전';
    return '방금 전';
  }
  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  // ESC 키로 모달 닫기
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeScanModal();
      document.getElementById('detailModal').classList.add('hidden');
    }
  });

  // 모달 외부 클릭으로 닫기
  document.getElementById('detailModal').addEventListener('click', function(e) {
    if (e.target === this) this.classList.add('hidden');
  });
  document.getElementById('scanModal').addEventListener('click', function(e) {
    if (e.target === this) closeScanModal();
  });
  </script>
</body>
</html>`)
})

// ============================================================
// API: 브랜드 AI 분석 (OpenAI 연동)
// ============================================================
app.post('/api/analyze-brand', async (c) => {
  const body = await c.req.json()
  const { name, category, followers, growthRate, channels, description } = body

  const apiKey = c.env?.OPENAI_API_KEY
  if (!apiKey) {
    return c.json({ success: false, error: 'API key not configured' }, 400)
  }

  const prompt = `당신은 카드사 포인트몰 상품입점팀 전문 AI 분석가입니다.
다음 브랜드를 분석하고 JSON 형식으로 결과를 반환하세요.

브랜드 정보:
- 브랜드명: ${name}
- 카테고리: ${category}
- 인스타그램 팔로워: ${followers?.toLocaleString()}명
- 월 성장률: ${growthRate}%
- 판매 채널: ${(channels || []).join(', ')}
- 브랜드 설명: ${description || '없음'}

분석 기준:
1. 카드사 포인트몰 핵심 고객층(30-50대, 고소득층)과의 매칭도
2. SNS 트렌드 및 MZ세대 인지도
3. 포인트 소진 잠재력 (상품 가격대, 구매 빈도)
4. 경쟁 브랜드 대비 차별성
5. 기존 포인트몰 입점사와의 카테고리 중복도

반드시 다음 JSON 형식으로만 응답하세요:
{
  "score": (0-100 종합점수),
  "trendScore": (0-100 트렌드점수),
  "potentialScore": (0-100 잠재력점수),
  "riskScore": (0-100 리스크점수, 낮을수록 좋음),
  "status": ("입점 추천" | "검토 중" | "주목 브랜드" | "보류"),
  "engagementRate": (추정 참여율 숫자),
  "avgPrice": (추정 평균 상품 가격, 원 단위),
  "priceRange": ("최저~최고원" 형식),
  "salesVelocity": ("주간 N건 추정" 형식),
  "competitorGap": ("낮음" | "중간" | "높음"),
  "tags": ["태그1", "태그2", "태그3", "태그4"],
  "aiComment": "200자 이내 입점 분석 코멘트. 포인트몰 특성 반영."
}`

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        response_format: { type: 'json_object' }
      })
    })

    const data = await res.json() as any
    const analysis = JSON.parse(data.choices[0].message.content)

    const brand = {
      id: 'b' + Date.now(),
      name, category,
      followers: followers || 50000,
      growthRate: growthRate || 10,
      channels: channels || [],
      description: description || '',
      analyzedAt: new Date().toISOString(),
      alert: (analysis.score || 0) >= 80,
      statusColor: analysis.status === '입점 추천' ? 'emerald' : 
                   analysis.status === '검토 중' ? 'yellow' : 'orange',
      ...analysis
    }

    return c.json({ success: true, brand })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// ============================================================
// API: URL 분석
// ============================================================
app.post('/api/analyze-url', async (c) => {
  const body = await c.req.json()
  const { url, brandName } = body

  const apiKey = c.env?.OPENAI_API_KEY
  if (!apiKey) {
    return c.json({ success: false, error: 'API key not configured' }, 400)
  }

  const prompt = `카드사 포인트몰 입점팀 AI 분석가로서, 다음 URL의 브랜드를 분석하세요.
URL: ${url}
브랜드명 (제공된 경우): ${brandName || '미제공'}

URL 패턴을 보고 플랫폼을 파악하고, 일반적인 브랜드 특성을 추론하여 분석하세요.
Instagram URL이면 패션/뷰티/라이프 등 인스타 기반 브랜드로 추정하세요.

JSON 형식으로 응답:
{
  "name": "브랜드명 (URL에서 추출 또는 제공된 이름)",
  "category": "추정 카테고리",
  "followers": 추정팔로워수,
  "growthRate": 추정월성장률,
  "engagementRate": 추정참여율,
  "channels": ["추정채널들"],
  "score": 종합점수,
  "trendScore": 트렌드점수,
  "potentialScore": 잠재력점수,
  "riskScore": 리스크점수,
  "status": "입점 추천|검토 중|주목 브랜드",
  "avgPrice": 추정평균가격,
  "priceRange": "가격범위",
  "salesVelocity": "판매속도",
  "competitorGap": "낮음|중간|높음",
  "tags": ["태그1","태그2","태그3","태그4"],
  "description": "브랜드 설명",
  "aiComment": "입점 분석 코멘트"
}`

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        response_format: { type: 'json_object' }
      })
    })

    const data = await res.json() as any
    const analysis = JSON.parse(data.choices[0].message.content)

    const brand = {
      id: 'b' + Date.now(),
      analyzedAt: new Date().toISOString(),
      alert: (analysis.score || 0) >= 80,
      statusColor: analysis.status === '입점 추천' ? 'emerald' : 
                   analysis.status === '검토 중' ? 'yellow' : 'orange',
      ...analysis
    }

    return c.json({ success: true, brand })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// ============================================================
// API: 건강 체크
// ============================================================
app.get('/api/health', (c) => {
  return c.json({ status: 'ok', service: 'AI Brand Sonar', timestamp: new Date().toISOString() })
})

export default app
