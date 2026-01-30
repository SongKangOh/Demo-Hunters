// ===== 상태 관리 =====
let currentCandidates = [];
let currentCandidateIndex = 0;
let currentQuery = ''; // 현재 검색어 저장 (단계별 안내용)
let navigationSteps = []; // 네비게이션 단계 저장

// ===== DOM 요소 =====
const elements = {
  searchInput: null,
  searchBtn: null,
  loadingSection: null,
  confirmSection: null,
  confirmTarget: null,
  confirmYes: null,
  confirmNo: null,
  resultSection: null,
  successResult: null,
  errorResult: null,
  errorMessage: null,
  retryBtn: null,
  multiResultSection: null,
  candidateList: null,
  feedbackSection: null,
  wrongBtn: null,
  settingsBtn: null,
  settingsModal: null,
  apiKeyInput: null,
  saveSettingsBtn: null,
  closeSettingsBtn: null,
  deepCrawlToggle: null,
  crawlProgress: null
};

// ===== 초기화 =====
document.addEventListener('DOMContentLoaded', async () => {
  initElements();
  bindEvents();
  await loadSettings();

  // 입력창에 포커스
  elements.searchInput.focus();
});

function initElements() {
  elements.searchInput = document.getElementById('searchInput');
  elements.searchBtn = document.getElementById('searchBtn');
  elements.loadingSection = document.getElementById('loadingSection');
  elements.confirmSection = document.getElementById('confirmSection');
  elements.confirmTarget = document.getElementById('confirmTarget');
  elements.confirmYes = document.getElementById('confirmYes');
  elements.confirmNo = document.getElementById('confirmNo');
  elements.resultSection = document.getElementById('resultSection');
  elements.successResult = document.getElementById('successResult');
  elements.errorResult = document.getElementById('errorResult');
  elements.errorMessage = document.getElementById('errorMessage');
  elements.retryBtn = document.getElementById('retryBtn');
  elements.multiResultSection = document.getElementById('multiResultSection');
  elements.candidateList = document.getElementById('candidateList');
  elements.feedbackSection = document.getElementById('feedbackSection');
  elements.wrongBtn = document.getElementById('wrongBtn');
  elements.settingsBtn = document.getElementById('settingsBtn');
  elements.settingsModal = document.getElementById('settingsModal');
  elements.apiKeyInput = document.getElementById('apiKeyInput');
  elements.saveSettingsBtn = document.getElementById('saveSettingsBtn');
  elements.closeSettingsBtn = document.getElementById('closeSettingsBtn');
  elements.deepCrawlToggle = document.getElementById('deepCrawlToggle');
  elements.crawlProgress = document.getElementById('crawlProgress');
}

function bindEvents() {
  // 검색
  elements.searchBtn.addEventListener('click', handleSearch);
  elements.searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSearch();
  });

  // 확인 모달
  elements.confirmYes.addEventListener('click', handleConfirmYes);
  elements.confirmNo.addEventListener('click', handleConfirmNo);

  // 피드백
  elements.wrongBtn.addEventListener('click', handleWrongFeedback);
  elements.retryBtn.addEventListener('click', handleRetry);

  // 설정
  elements.settingsBtn.addEventListener('click', openSettings);
  elements.saveSettingsBtn.addEventListener('click', saveSettings);
  elements.closeSettingsBtn.addEventListener('click', closeSettings);
}

// ===== 설정 관리 =====
async function loadSettings() {
  const result = await chrome.storage.local.get(['apiKey']);
  if (result.apiKey) {
    elements.apiKeyInput.value = result.apiKey;
  }
}

async function saveSettings() {
  const apiKey = elements.apiKeyInput.value.trim();
  await chrome.storage.local.set({ apiKey });
  closeSettings();
  showToast('설정이 저장되었습니다');
}

function openSettings() {
  elements.settingsModal.classList.remove('hidden');
}

function closeSettings() {
  elements.settingsModal.classList.add('hidden');
}

// ===== 검색 처리 =====
async function handleSearch() {
  const query = elements.searchInput.value.trim();
  if (!query) {
    showToast('검색어를 입력해주세요');
    return;
  }

  // API 키 확인
  const result = await chrome.storage.local.get(['apiKey']);
  if (!result.apiKey) {
    showToast('설정에서 API 키를 입력해주세요');
    openSettings();
    return;
  }

  // 검색어 저장
  currentQuery = query;

  // UI 상태 변경
  hideAllSections();
  elements.loadingSection.classList.remove('hidden');

  // 딥 크롤링 모드 확인
  const isDeepCrawl = elements.deepCrawlToggle?.checked || false;

  try {
    // 현재 탭의 DOM 분석 요청
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      throw new Error('현재 탭을 찾을 수 없습니다.');
    }

    console.log('[Popup] Current tab:', tab.url);
    console.log('[Popup] Deep crawl mode:', isDeepCrawl);

    // chrome:// 또는 edge:// 등 시스템 페이지 체크
    if (tab.url.startsWith('chrome://') || tab.url.startsWith('edge://') || tab.url.startsWith('about:')) {
      throw new Error('시스템 페이지에서는 사용할 수 없습니다. 일반 웹사이트에서 시도해주세요.');
    }

    // Content script 동적 주입 시도
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content/content.js']
      });
      await chrome.scripting.insertCSS({
        target: { tabId: tab.id },
        files: ['content/content.css']
      });
      console.log('[Popup] Content scripts injected');
    } catch (injectionError) {
      console.log('[Popup] Script already injected or injection failed:', injectionError.message);
    }

    // 잠시 대기 (스크립트 로드 시간)
    await new Promise(resolve => setTimeout(resolve, 100));

    let elementsToAnalyze;

    if (isDeepCrawl) {
      // 딥 크롤링 모드: 전체 사이트 분석
      elements.crawlProgress?.classList.remove('hidden');
      document.querySelector('.loading-text').textContent = '전체 사이트 분석 중...';

      const crawlResult = await chrome.tabs.sendMessage(tab.id, {
        type: 'DEEP_CRAWL',
        maxDepth: 2,
        maxPages: 30
      });

      if (crawlResult.error) {
        throw new Error(crawlResult.error);
      }

      console.log('[Popup] Deep crawl complete:', crawlResult.pageCount, 'pages');
      elementsToAnalyze = crawlResult.allElements;

    } else {
      // 일반 모드: 현재 페이지만 분석
      const domData = await chrome.tabs.sendMessage(tab.id, {
        type: 'ANALYZE_DOM'
      });

      if (!domData || !domData.elements || domData.elements.length === 0) {
        throw new Error('클릭 가능한 요소를 찾지 못했습니다.');
      }

      console.log('[Popup] DOM data received:', domData.elements.length, 'elements');
      elementsToAnalyze = domData.elements;
    }

    // Background에 LLM 분석 요청
    console.log('[Popup] Sending to LLM...', elementsToAnalyze.length, 'elements');
    document.querySelector('.loading-text').textContent = 'AI 분석 중...';

    const response = await chrome.runtime.sendMessage({
      type: isDeepCrawl ? 'ANALYZE_DEEP_QUERY' : 'ANALYZE_QUERY',
      query: query,
      elements: elementsToAnalyze,
      apiKey: result.apiKey
    });

    console.log('[Popup] LLM response:', response);

    // 딥 크롤링이든 일반 분석이든 동일하게 처리 (candidates 형식)
    handleAnalysisResult(response, tab.id);

  } catch (error) {
    console.error('[Popup] Search error:', error);
    showError(error.message || '분석 중 오류가 발생했습니다. 다시 시도해주세요.');
  }
}

function handleAnalysisResult(response, tabId) {
  hideAllSections();

  if (response.error) {
    showError(response.error);
    return;
  }

  if (!response.candidates || response.candidates.length === 0) {
    showError('해당 기능을 찾지 못했어요. 다른 방식으로 설명해주세요.');
    return;
  }

  currentCandidates = response.candidates;
  currentCandidateIndex = 0;

  // 첫 번째 후보로 확인 요청
  const firstCandidate = currentCandidates[0];
  showConfirmation(firstCandidate, tabId);
}

function showConfirmation(candidate, tabId) {
  hideAllSections();
  elements.confirmSection.classList.remove('hidden');

  // 중간 단계인지 확인
  const isIntermediate = candidate.isIntermediate === true;

  if (isIntermediate) {
    // 중간 단계: 이 메뉴를 클릭하면 원하는 기능이 있는 페이지로 이동
    document.querySelector('.confirm-question').textContent = '원하시는 기능이 있을 것 같은 메뉴:';
    elements.confirmTarget.textContent = `"${candidate.text || candidate.message}"`;
    elements.confirmTarget.insertAdjacentHTML('afterend',
      '<p class="intermediate-hint" style="font-size:14px;color:#888;margin-top:8px;">👆 이것을 클릭하면 다음 페이지에서 다시 찾아드립니다</p>'
    );
  } else {
    // 최종 목표
    document.querySelector('.confirm-question').textContent = '찾으시려는 기능이';
    elements.confirmTarget.textContent = `"${candidate.text || candidate.message}"`;
    // 이전 힌트 제거
    const oldHint = document.querySelector('.intermediate-hint');
    if (oldHint) oldHint.remove();
  }

  // 현재 tabId 저장
  elements.confirmYes.dataset.tabId = tabId;
  elements.confirmYes.dataset.targetId = candidate.target;
  elements.confirmYes.dataset.isIntermediate = isIntermediate;
}

async function handleConfirmYes() {
  const tabId = parseInt(elements.confirmYes.dataset.tabId);
  const targetId = elements.confirmYes.dataset.targetId;
  const isIntermediate = elements.confirmYes.dataset.isIntermediate === 'true';

  hideAllSections();

  // Content script에 하이라이트 요청
  try {
    const highlightMessage = isIntermediate
      ? '여기를 클릭하세요 → 다음 페이지에서 다시 검색해주세요'
      : '여기를 클릭하세요';

    await chrome.tabs.sendMessage(tabId, {
      type: 'HIGHLIGHT_ELEMENT',
      targetId: targetId,
      message: highlightMessage
    });

    elements.resultSection.classList.remove('hidden');
    elements.successResult.classList.remove('hidden');

    // 중간 단계일 경우 다른 메시지 표시
    if (isIntermediate) {
      document.querySelector('.result-message').textContent = '이 메뉴를 클릭하세요!';
      document.querySelector('.result-hint').textContent = '클릭 후 다음 페이지에서 다시 🔍 버튼을 눌러주세요';
    } else {
      document.querySelector('.result-message').textContent = '화면에서 찾았습니다!';
      document.querySelector('.result-hint').textContent = '하이라이트된 곳을 클릭하세요';
    }

    elements.feedbackSection.classList.remove('hidden');
    elements.wrongBtn.dataset.tabId = tabId;

  } catch (error) {
    console.error('Highlight error:', error);
    showError('하이라이트 표시 중 오류가 발생했습니다.');
  }
}

function handleConfirmNo() {
  // 다음 후보가 있으면 표시
  currentCandidateIndex++;

  if (currentCandidateIndex < currentCandidates.length) {
    const tabId = parseInt(elements.confirmYes.dataset.tabId);
    const nextCandidate = currentCandidates[currentCandidateIndex];
    showConfirmation(nextCandidate, tabId);
  } else {
    // 모든 후보 다 봤으면 다중 선택 표시
    showMultiResults();
  }
}

function showMultiResults() {
  hideAllSections();
  elements.multiResultSection.classList.remove('hidden');

  elements.candidateList.innerHTML = '';
  currentCandidates.forEach((candidate, index) => {
    const item = document.createElement('div');
    item.className = 'candidate-item';
    item.innerHTML = `
      <div class="candidate-text">${candidate.text || candidate.message}</div>
      <div class="candidate-confidence">확률: ${Math.round((candidate.confidence || 0.5) * 100)}%</div>
    `;
    item.addEventListener('click', () => selectCandidate(index));
    elements.candidateList.appendChild(item);
  });
}

async function selectCandidate(index) {
  const tabId = parseInt(elements.confirmYes.dataset.tabId);
  const candidate = currentCandidates[index];

  hideAllSections();

  try {
    await chrome.tabs.sendMessage(tabId, {
      type: 'HIGHLIGHT_ELEMENT',
      targetId: candidate.target,
      message: '여기를 클릭하세요'
    });

    elements.resultSection.classList.remove('hidden');
    elements.successResult.classList.remove('hidden');
    elements.feedbackSection.classList.remove('hidden');
    elements.wrongBtn.dataset.tabId = tabId;

  } catch (error) {
    showError('하이라이트 표시 중 오류가 발생했습니다.');
  }
}

async function handleWrongFeedback() {
  const tabId = parseInt(elements.wrongBtn.dataset.tabId);

  // 하이라이트 제거
  try {
    await chrome.tabs.sendMessage(tabId, { type: 'CLEAR_HIGHLIGHT' });
  } catch (e) { }

  // 다음 후보 표시
  currentCandidateIndex++;

  if (currentCandidateIndex < currentCandidates.length) {
    const nextCandidate = currentCandidates[currentCandidateIndex];

    hideAllSections();

    try {
      await chrome.tabs.sendMessage(tabId, {
        type: 'HIGHLIGHT_ELEMENT',
        targetId: nextCandidate.target,
        message: '여기를 클릭하세요'
      });

      elements.resultSection.classList.remove('hidden');
      elements.successResult.classList.remove('hidden');
      elements.feedbackSection.classList.remove('hidden');

    } catch (error) {
      showError('다음 후보를 표시할 수 없습니다.');
    }
  } else {
    showError('더 이상 후보가 없습니다. 다른 표현으로 다시 검색해주세요.');
  }
}

function handleRetry() {
  hideAllSections();
  elements.searchInput.value = '';
  elements.searchInput.focus();
}

// ===== UI 헬퍼 =====
function hideAllSections() {
  elements.loadingSection.classList.add('hidden');
  elements.confirmSection.classList.add('hidden');
  elements.resultSection.classList.add('hidden');
  elements.successResult.classList.add('hidden');
  elements.errorResult.classList.add('hidden');
  elements.multiResultSection.classList.add('hidden');
  elements.feedbackSection.classList.add('hidden');
  elements.crawlProgress?.classList.add('hidden');
}

function showError(message) {
  hideAllSections();
  elements.resultSection.classList.remove('hidden');
  elements.errorResult.classList.remove('hidden');
  elements.errorMessage.textContent = message;
}

function showToast(message) {
  // 간단한 알림 표시
  alert(message);
}

// ===== 딥 크롤링 결과 처리 (단계별 안내) =====
function handleDeepNavigationResult(response, tabId) {
  hideAllSections();

  if (response.error) {
    showError(response.error);
    return;
  }

  if (!response.found || !response.navigationPath || response.navigationPath.length === 0) {
    showError('원하시는 기능을 찾지 못했습니다. 다른 표현으로 시도해주세요.');
    return;
  }

  // 네비게이션 단계 저장
  navigationSteps = response.navigationPath;

  // 단계별 안내 UI 표시
  showNavigationSteps(response, tabId);
}

function showNavigationSteps(response, tabId) {
  hideAllSections();

  // 동적으로 단계별 UI 생성
  let stepsHtml = `
    <div class="steps-container">
      <h3 class="steps-title">🗺️ ${response.navigationPath.length}단계로 안내해드려요</h3>
      <div class="steps-list">
  `;

  response.navigationPath.forEach((step, idx) => {
    const isFirst = idx === 0;
    stepsHtml += `
      <div class="step-item ${isFirst ? 'step-current' : 'step-pending'}" data-step="${idx}">
        <div class="step-number">${step.step || idx + 1}</div>
        <div class="step-content">
          <div class="step-text">"${step.targetText}"</div>
          <div class="step-instruction">${step.instruction}</div>
        </div>
        ${isFirst ? '<button class="btn btn-primary step-go-btn">여기로 이동</button>' : ''}
      </div>
    `;
  });

  stepsHtml += `
      </div>
      <div class="steps-final">
        <p>🎯 최종 목표: <strong>${response.finalTarget?.targetText || '목표 달성'}</strong></p>
      </div>
    </div>
  `;

  // multiResultSection 재활용
  elements.multiResultSection.innerHTML = stepsHtml;
  elements.multiResultSection.classList.remove('hidden');

  // 첫 번째 단계 버튼 이벤트
  const goBtn = elements.multiResultSection.querySelector('.step-go-btn');
  if (goBtn) {
    goBtn.addEventListener('click', async () => {
      const firstStep = response.navigationPath[0];

      // 현재 페이지의 요소인 경우 하이라이트
      try {
        await chrome.tabs.sendMessage(tabId, {
          type: 'HIGHLIGHT_ELEMENT',
          targetId: firstStep.targetId,
          message: firstStep.instruction || '여기를 클릭하세요'
        });

        hideAllSections();
        elements.resultSection.classList.remove('hidden');
        elements.successResult.classList.remove('hidden');

        document.querySelector('.result-message').textContent = `1단계: "${firstStep.targetText}"`;
        document.querySelector('.result-hint').textContent = '클릭 후 다음 단계를 진행해주세요';

        elements.feedbackSection.classList.remove('hidden');
        elements.wrongBtn.dataset.tabId = tabId;

      } catch (error) {
        showError('첫 번째 단계를 표시할 수 없습니다.');
      }
    });
  }
}
