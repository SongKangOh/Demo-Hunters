// ===== Deep Link Crawler - 재귀적 링크 크롤링 =====

// 크롤링 상태
let crawlCache = new Map(); // URL -> 분석된 요소들
let crawlInProgress = false;

// 메시지 리스너
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'DEEP_CRAWL') {
        handleDeepCrawl(message.maxDepth || 2, message.maxPages || 30)
            .then(sendResponse)
            .catch(error => {
                console.error('[Crawler] Error:', error);
                sendResponse({ error: error.message });
            });
        return true;
    }

    if (message.type === 'GET_CRAWL_STATUS') {
        sendResponse({
            inProgress: crawlInProgress,
            pagesCount: crawlCache.size
        });
        return true;
    }
});

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
            const pageData = await analyzePage(url, baseUrl);
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
            updateProgress(siteMap.length, maxPages);
        }

        console.log(`[Crawler] ========== 크롤링 완료 ==========`);
        console.log(`[Crawler] 총 ${siteMap.length}개 페이지 분석됨`);

        // 전체 요소 목록 생성 (경로 정보 포함)
        const allElements = buildElementList(siteMap);

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
async function analyzePage(url, baseUrl) {
    try {
        // 현재 페이지면 직접 분석
        if (url === window.location.href) {
            return analyzeCurrentPage(baseUrl);
        }

        // 다른 페이지면 fetch
        const response = await fetch(url, { credentials: 'include' });
        if (!response.ok) return null;

        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        return analyzeDocument(doc, baseUrl, url);

    } catch (error) {
        console.error(`[Crawler] 페이지 분석 실패: ${url}`, error);
        return null;
    }
}

// 현재 페이지 분석
function analyzeCurrentPage(baseUrl) {
    return analyzeDocument(document, baseUrl, window.location.href);
}

// Document 분석
function analyzeDocument(doc, baseUrl, pageUrl) {
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
        const text = getElementText(el);
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

// 요소 텍스트 추출
function getElementText(el) {
    return el.getAttribute('aria-label') ||
        el.getAttribute('title') ||
        el.innerText?.trim() ||
        el.value?.trim() ||
        el.getAttribute('alt') ||
        '';
}

// 전체 요소 목록 생성 (경로 정보 포함)
function buildElementList(siteMap) {
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
function updateProgress(current, total) {
    // Popup에 진행 상황 전송
    chrome.runtime.sendMessage({
        type: 'CRAWL_PROGRESS',
        current: current,
        total: total
    }).catch(() => { }); // Popup이 닫혀있을 수 있음
}

console.log('[Crawler] Deep Link Crawler 로드됨');
