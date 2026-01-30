// ===== DOM 분석 및 하이라이트 Content Script =====

// 현재 분석된 요소 저장
let analyzedElements = [];
let highlightOverlay = null;
let tooltipElement = null;

// ===== 메시지 리스너 =====
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
        case 'ANALYZE_DOM':
            const elements = analyzeDom();
            sendResponse({ elements });
            break;

        case 'HIGHLIGHT_ELEMENT':
            highlightElement(message.targetId, message.message);
            sendResponse({ success: true });
            break;

        case 'CLEAR_HIGHLIGHT':
            clearHighlight();
            sendResponse({ success: true });
            break;

        case 'DEEP_CRAWL':
            handleDeepCrawl(message.maxDepth || 2, message.maxPages || 30)
                .then(sendResponse)
                .catch(error => {
                    console.error('[Crawler] Error:', error);
                    sendResponse({ error: error.message });
                });
            return true; // 비동기 응답

        case 'GET_CRAWL_STATUS':
            sendResponse({
                inProgress: typeof crawlInProgress !== 'undefined' ? crawlInProgress : false,
                pagesCount: typeof crawlCache !== 'undefined' ? crawlCache.size : 0
            });
            break;

        default:
            // 알 수 없는 메시지는 무시 (다른 핸들러가 처리할 수도 있음)
            return false;
    }
    return true; // 비동기 응답 허용
});

// ===== DOM 분석 =====
function analyzeDom() {
    console.log(`%c[AI Nav] ========== DOM 분석 시작 ==========`, 'background: #007AFF; color: white; padding: 4px 8px; border-radius: 4px;');
    console.log(`[AI Nav] 현재 URL: ${window.location.href}`);
    console.log(`[AI Nav] Document 상태: ${document.readyState}`);
    console.log(`[AI Nav] Body 존재: ${!!document.body}`);

    // 클릭 가능한 요소 선택자
    const selectors = [
        'button',
        'a[href]',
        'input[type="submit"]',
        'input[type="button"]',
        '[role="button"]',
        '[role="link"]',
        '[role="menuitem"]',
        '[onclick]',
        '.btn',
        '.button',
        '[class*="btn"]',
        '[class*="button"]',
        'label[for]',
        '[tabindex="0"]'
    ];

    const selectorString = selectors.join(', ');
    console.log(`[AI Nav] 사용된 선택자: ${selectors.length}개`);
    selectors.forEach((sel, i) => console.log(`  ${i + 1}. ${sel}`));

    let elements;
    try {
        elements = document.querySelectorAll(selectorString);
        console.log(`[AI Nav] querySelectorAll 성공: ${elements.length}개 요소 발견`);
    } catch (e) {
        console.error(`[AI Nav] querySelectorAll 실패:`, e);
        return [];
    }

    analyzedElements = [];

    // 필터링 통계
    let stats = {
        total: elements.length,
        invisible: 0,
        noText: 0,
        passed: 0
    };

    console.log(`%c[AI Nav] 요소 필터링 시작...`, 'color: #FF9500;');

    Array.from(elements).forEach((el, idx) => {
        const debugInfo = {
            index: idx,
            tag: el.tagName,
            id: el.id || '(없음)',
            className: el.className || '(없음)',
            href: el.getAttribute('href') || '(없음)'
        };

        // 보이지 않는 요소 제외
        const visibilityResult = checkVisibility(el);
        if (!visibilityResult.visible) {
            stats.invisible++;
            if (idx < 20) { // 처음 20개만 상세 로그
                console.log(`[AI Nav] ❌ 숨김 (${idx}): <${el.tagName.toLowerCase()}> - 이유: ${visibilityResult.reason}`);
            }
            return;
        }

        // 텍스트 추출
        const text = getElementText(el);
        if (!text || text.length < 1) {
            stats.noText++;
            if (idx < 20) {
                console.log(`[AI Nav] ❌ 텍스트 없음 (${idx}): <${el.tagName.toLowerCase()}>`);
            }
            return;
        }

        stats.passed++;

        // 고유 ID 생성
        const navId = `nav-${idx}`;
        el.dataset.navId = navId;

        const elementData = {
            id: navId,
            tag: el.tagName.toLowerCase(),
            text: text.substring(0, 100), // 최대 100자
            type: getElementType(el),
            ariaLabel: el.getAttribute('aria-label') || '',
            title: el.getAttribute('title') || '',
            href: el.getAttribute('href') || ''
        };

        analyzedElements.push(elementData);

        // 통과한 요소 로그
        console.log(`[AI Nav] ✅ (${navId}): [${elementData.type}] "${elementData.text.substring(0, 50)}${elementData.text.length > 50 ? '...' : ''}"`);
    });

    console.log(`%c[AI Nav] ========== 필터링 통계 ==========`, 'background: #34C759; color: white; padding: 4px 8px; border-radius: 4px;');
    console.log(`[AI Nav] 전체: ${stats.total}개`);
    console.log(`[AI Nav] 숨김 제외: ${stats.invisible}개`);
    console.log(`[AI Nav] 텍스트 없음 제외: ${stats.noText}개`);
    console.log(`[AI Nav] 최종 통과: ${stats.passed}개`);
    console.log(`%c[AI Nav] ========================================`, 'background: #007AFF; color: white; padding: 4px 8px; border-radius: 4px;');

    return analyzedElements;
}

// 요소가 화면에 보이는지 확인 (디버그 정보 포함)
function checkVisibility(el) {
    try {
        const style = window.getComputedStyle(el);
        const rect = el.getBoundingClientRect();

        if (style.display === 'none') {
            return { visible: false, reason: 'display:none' };
        }
        if (style.visibility === 'hidden') {
            return { visible: false, reason: 'visibility:hidden' };
        }
        if (style.opacity === '0') {
            return { visible: false, reason: 'opacity:0' };
        }
        if (rect.width <= 0) {
            return { visible: false, reason: `width=${rect.width}` };
        }
        if (rect.height <= 0) {
            return { visible: false, reason: `height=${rect.height}` };
        }

        return { visible: true, reason: 'ok' };
    } catch (e) {
        return { visible: false, reason: `에러: ${e.message}` };
    }
}

// 기존 isVisible 함수 (호환성 유지)
function isVisible(el) {
    return checkVisibility(el).visible;
}

// 요소의 텍스트 추출
function getElementText(el) {
    // aria-label 우선
    let text = el.getAttribute('aria-label');
    if (text) return text.trim();

    // title 속성
    text = el.getAttribute('title');
    if (text) return text.trim();

    // innerText
    text = el.innerText;
    if (text) return text.trim();

    // value (input 요소)
    text = el.value;
    if (text) return text.trim();

    // alt (이미지)
    text = el.getAttribute('alt');
    if (text) return text.trim();

    return '';
}

// 요소 타입 추출
function getElementType(el) {
    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute('role');
    const type = el.getAttribute('type');

    if (role) return role;
    if (tag === 'a') return 'link';
    if (tag === 'button') return 'button';
    if (tag === 'input' && type) return type;

    return tag;
}

// ===== 하이라이트 기능 =====
function highlightElement(targetId, message) {
    // 기존 하이라이트 제거
    clearHighlight();

    // 타겟 요소 찾기
    const targetEl = document.querySelector(`[data-nav-id="${targetId}"]`);
    if (!targetEl) {
        console.error(`[AI Nav] 요소를 찾을 수 없습니다: ${targetId}`);
        return;
    }

    // 요소로 스크롤
    targetEl.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
    });

    // 하이라이트 오버레이 생성
    const rect = targetEl.getBoundingClientRect();

    highlightOverlay = document.createElement('div');
    highlightOverlay.className = 'ai-nav-highlight';
    highlightOverlay.style.cssText = `
    position: fixed;
    top: ${rect.top - 8}px;
    left: ${rect.left - 8}px;
    width: ${rect.width + 16}px;
    height: ${rect.height + 16}px;
    border: 4px solid #667eea;
    border-radius: 12px;
    background: rgba(102, 126, 234, 0.15);
    box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.3), 0 0 30px rgba(102, 126, 234, 0.4);
    pointer-events: none;
    z-index: 2147483646;
    animation: ai-nav-pulse 1.5s ease-in-out infinite;
  `;

    // 툴팁 생성
    tooltipElement = document.createElement('div');
    tooltipElement.className = 'ai-nav-tooltip';
    tooltipElement.innerHTML = `
    <div class="ai-nav-tooltip-arrow"></div>
    <div class="ai-nav-tooltip-content">
      <span class="ai-nav-tooltip-icon">👆</span>
      <span class="ai-nav-tooltip-text">${message}</span>
    </div>
  `;
    tooltipElement.style.cssText = `
    position: fixed;
    top: ${rect.top - 60}px;
    left: ${rect.left + rect.width / 2}px;
    transform: translateX(-50%);
    z-index: 2147483647;
    animation: ai-nav-bounce 0.5s ease-out;
  `;

    document.body.appendChild(highlightOverlay);
    document.body.appendChild(tooltipElement);

    // 클릭 시 하이라이트 제거
    targetEl.addEventListener('click', clearHighlight, { once: true });

    // 스크롤/리사이즈 시 위치 업데이트
    window.addEventListener('scroll', updateHighlightPosition);
    window.addEventListener('resize', updateHighlightPosition);
}

function updateHighlightPosition() {
    if (!highlightOverlay) return;

    const targetId = highlightOverlay.dataset?.targetId;
    if (!targetId) return;

    const targetEl = document.querySelector(`[data-nav-id="${targetId}"]`);
    if (!targetEl) return;

    const rect = targetEl.getBoundingClientRect();

    highlightOverlay.style.top = `${rect.top - 8}px`;
    highlightOverlay.style.left = `${rect.left - 8}px`;
    highlightOverlay.style.width = `${rect.width + 16}px`;
    highlightOverlay.style.height = `${rect.height + 16}px`;

    if (tooltipElement) {
        tooltipElement.style.top = `${rect.top - 60}px`;
        tooltipElement.style.left = `${rect.left + rect.width / 2}px`;
    }
}

function clearHighlight() {
    if (highlightOverlay) {
        highlightOverlay.remove();
        highlightOverlay = null;
    }

    if (tooltipElement) {
        tooltipElement.remove();
        tooltipElement = null;
    }

    window.removeEventListener('scroll', updateHighlightPosition);
    window.removeEventListener('resize', updateHighlightPosition);
}

// ===== 네비게이션 경로 표시 UI =====
let navigationPathElement = null;
let navigationState = {
    steps: [],        // 전체 경로 단계
    currentIndex: 0,  // 현재 단계 인덱스
    goal: '',         // 최종 목표
    isActive: false
};

// 네비게이션 경로 표시
function showNavigationPath(steps, currentIndex, goal) {
    navigationState = {
        steps: steps,
        currentIndex: currentIndex,
        goal: goal,
        isActive: true
    };

    // 기존 경로 UI 제거
    clearNavigationPath();

    // 새 경로 UI 생성
    navigationPathElement = document.createElement('div');
    navigationPathElement.className = 'ai-nav-path-container';
    navigationPathElement.id = 'ai-nav-path';

    let stepsHTML = '';
    steps.forEach((step, idx) => {
        let stepClass = 'ai-nav-path-step ';
        if (idx < currentIndex) {
            stepClass += 'completed';
        } else if (idx === currentIndex) {
            stepClass += 'current';
        } else {
            stepClass += 'pending';
        }

        stepsHTML += `<span class="${stepClass}">${step}</span>`;

        if (idx < steps.length - 1) {
            stepsHTML += '<span class="ai-nav-path-arrow">→</span>';
        }
    });

    // 최종 목표 표시 (경로와 다른 경우)
    const goalHTML = goal && goal !== steps[steps.length - 1]
        ? `<span class="ai-nav-path-arrow">→</span><span class="ai-nav-path-goal">${goal}</span>`
        : '';

    navigationPathElement.innerHTML = `
        <div class="ai-nav-path-content">
            <span class="ai-nav-path-label">📍 경로</span>
            <div class="ai-nav-path-steps">
                ${stepsHTML}
                ${goalHTML}
            </div>
            <button class="ai-nav-path-close" id="ai-nav-path-close">×</button>
        </div>
    `;

    document.body.appendChild(navigationPathElement);

    // 닫기 버튼 이벤트
    document.getElementById('ai-nav-path-close').addEventListener('click', clearNavigationPath);

    console.log('[AI Nav] 네비게이션 경로 표시:', steps, '현재:', currentIndex);
}

// 현재 단계 업데이트
function updateNavigationStep(newIndex) {
    if (!navigationState.isActive || !navigationPathElement) return;

    navigationState.currentIndex = newIndex;
    showNavigationPath(navigationState.steps, newIndex, navigationState.goal);
}

// 단계 완료 처리 (다음 단계로 이동)
function advanceNavigationStep() {
    if (!navigationState.isActive) return;

    const nextIndex = navigationState.currentIndex + 1;
    if (nextIndex < navigationState.steps.length) {
        updateNavigationStep(nextIndex);
    } else {
        // 모든 단계 완료
        setTimeout(() => {
            clearNavigationPath();
        }, 2000);
    }
}

// 네비게이션 경로 UI 제거
function clearNavigationPath() {
    if (navigationPathElement) {
        navigationPathElement.remove();
        navigationPathElement = null;
    }
    navigationState.isActive = false;
}

// 네비게이션 상태 가져오기
function getNavigationState() {
    return navigationState;
}

// ===== 페이지 언로드 시 정리 =====
window.addEventListener('beforeunload', () => {
    clearHighlight();
    clearNavigationPath();
});

console.log('[AI 웹 네비게이션 가이드] Content Script 로드됨');

// ===== Deep Link Crawler - 재귀적 링크 크롤링 =====

// 크롤링 상태
let crawlCache = new Map();
let crawlInProgress = false;

// 딥 크롤링 실행
async function handleDeepCrawl(maxDepth, maxPages) {
    if (crawlInProgress) {
        return { error: '이미 크롤링 중입니다.' };
    }

    crawlInProgress = true;
    crawlCache.clear();

    const baseUrl = window.location.origin;
    const startUrl = window.location.href;

    console.log(`[Crawler] ========== 딥 크롤링 시작 ==========`);
    console.log(`[Crawler] Base URL: ${baseUrl}`);
    console.log(`[Crawler] Max Depth: ${maxDepth}, Max Pages: ${maxPages}`);

    try {
        // BFS로 링크 크롤링
        const visited = new Set();
        const queue = [{ url: startUrl, depth: 0, path: [] }];
        const siteMap = [];

        while (queue.length > 0 && siteMap.length < maxPages) {
            const { url, depth, path } = queue.shift();

            // 이미 방문했거나 depth 초과
            if (visited.has(url) || depth > maxDepth) continue;
            visited.add(url);

            console.log(`[Crawler] 분석 중 (depth ${depth}): ${url}`);

            // 페이지 분석
            const pageData = await crawlerAnalyzePage(url, baseUrl);
            if (!pageData) continue;

            // 사이트맵에 추가
            siteMap.push({
                url: url,
                depth: depth,
                path: path,
                elements: pageData.elements
            });

            // 하위 링크들을 큐에 추가
            for (const link of pageData.links) {
                if (!visited.has(link.href) && link.href.startsWith(baseUrl)) {
                    queue.push({
                        url: link.href,
                        depth: depth + 1,
                        path: [...path, { url: url, text: link.text }]
                    });
                }
            }

            // 진행 상황 업데이트
            updateCrawlProgress(siteMap.length, maxPages);
        }

        console.log(`[Crawler] ========== 크롤링 완료 ==========`);
        console.log(`[Crawler] 총 ${siteMap.length}개 페이지 분석됨`);

        // 전체 요소 목록 생성 (경로 정보 포함)
        const allElements = buildCrawlerElementList(siteMap);

        crawlInProgress = false;
        return {
            success: true,
            siteMap: siteMap,
            allElements: allElements,
            pageCount: siteMap.length
        };

    } catch (error) {
        crawlInProgress = false;
        throw error;
    }
}

// 페이지 분석 (fetch로 HTML 가져와서 파싱)
async function crawlerAnalyzePage(url, baseUrl) {
    try {
        // 현재 페이지면 직접 분석
        if (url === window.location.href) {
            return crawlerAnalyzeDocument(document, baseUrl, url);
        }

        // 다른 페이지면 fetch
        const response = await fetch(url, { credentials: 'include' });
        if (!response.ok) return null;

        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        return crawlerAnalyzeDocument(doc, baseUrl, url);

    } catch (error) {
        console.error(`[Crawler] 페이지 분석 실패: ${url}`, error);
        return null;
    }
}

// Document 분석 (크롤러용)
function crawlerAnalyzeDocument(doc, baseUrl, pageUrl) {
    const selectors = [
        'button',
        'a[href]',
        'input[type="submit"]',
        'input[type="button"]',
        '[role="button"]',
        '[role="link"]',
        '[role="menuitem"]'
    ].join(', ');

    const elements = doc.querySelectorAll(selectors);
    const analyzedElements = [];
    const links = [];

    elements.forEach((el, idx) => {
        const text = el.getAttribute('aria-label') ||
            el.getAttribute('title') ||
            el.innerText?.trim() ||
            el.value?.trim() ||
            el.getAttribute('alt') || '';
        if (!text || text.length < 1) return;

        const href = el.getAttribute('href');
        const fullHref = href ? new URL(href, pageUrl).href : null;

        analyzedElements.push({
            id: `page-${crawlCache.size}-nav-${idx}`,
            tag: el.tagName.toLowerCase(),
            text: text.substring(0, 100),
            type: el.getAttribute('role') || el.tagName.toLowerCase(),
            href: fullHref,
            pageUrl: pageUrl
        });

        // 내부 링크 수집
        if (fullHref && fullHref.startsWith(baseUrl) && !fullHref.includes('#')) {
            links.push({ href: fullHref, text: text.substring(0, 50) });
        }
    });

    return { elements: analyzedElements, links: links };
}

// 전체 요소 목록 생성 (경로 정보 포함)
function buildCrawlerElementList(siteMap) {
    const allElements = [];

    siteMap.forEach(page => {
        page.elements.forEach(el => {
            allElements.push({
                ...el,
                navigationPath: page.path.map(p => p.text),
                depth: page.depth
            });
        });
    });

    return allElements;
}

// 진행 상황 업데이트 (UI에 표시)
function updateCrawlProgress(current, total) {
    chrome.runtime.sendMessage({
        type: 'CRAWL_PROGRESS',
        current: current,
        total: total
    }).catch(() => { }); // Popup이 닫혀있을 수 있음
}

console.log('[Crawler] Deep Link Crawler 통합 완료');
