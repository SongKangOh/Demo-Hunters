// ===== 플로팅 위젯 UI =====

let widgetVisible = false;
let widgetElement = null;
let isDragging = false;
let dragOffset = { x: 0, y: 0 };

// API 키 저장 (로컬)
let apiKey = '';

// ===== 위젯 생성 =====
function createWidget() {
    if (widgetElement) return;

    // 위젯 컨테이너
    widgetElement = document.createElement('div');
    widgetElement.id = 'ai-nav-widget';
    widgetElement.innerHTML = `
        <div class="ai-nav-header" id="ai-nav-drag-handle">
            <span class="ai-nav-title">🧭 AI 길잡이</span>
            <button class="ai-nav-close" id="ai-nav-close">×</button>
        </div>
        <div class="ai-nav-body">
            <div class="ai-nav-search">
                <input type="text" id="ai-nav-input" placeholder="무엇을 찾으세요?" />
                <button id="ai-nav-search-btn">찾기</button>
            </div>
            <div class="ai-nav-option">
                <label>
                    <input type="checkbox" id="ai-nav-deep">
                    <span>🔍 전체 분석</span>
                </label>
            </div>
        </div>
        <div class="ai-nav-content" id="ai-nav-content"></div>
        <div class="ai-nav-footer">
            <button class="ai-nav-settings-btn" id="ai-nav-settings">⚙️</button>
        </div>
    `;

    // 스타일 주입
    injectStyles();

    document.body.appendChild(widgetElement);

    // 이벤트 바인딩
    bindWidgetEvents();

    // 저장된 위치 복원
    restorePosition();

    widgetVisible = true;
}

// ===== 스타일 주입 =====
function injectStyles() {
    if (document.getElementById('ai-nav-widget-styles')) return;

    const styles = document.createElement('style');
    styles.id = 'ai-nav-widget-styles';
    styles.textContent = `
        #ai-nav-widget {
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 320px;
            background: #ffffff;
            border-radius: 16px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.05);
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            z-index: 2147483647;
            overflow: hidden;
            transition: transform 0.2s ease, opacity 0.2s ease;
        }

        #ai-nav-widget.minimized {
            width: 60px;
            height: 60px;
            border-radius: 30px;
            cursor: pointer;
        }

        .ai-nav-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 12px 16px;
            background: linear-gradient(135deg, #007AFF 0%, #5856D6 100%);
            color: white;
            cursor: move;
            user-select: none;
        }

        .ai-nav-title {
            font-size: 15px;
            font-weight: 600;
        }

        .ai-nav-close {
            background: none;
            border: none;
            color: white;
            font-size: 20px;
            cursor: pointer;
            opacity: 0.8;
            transition: opacity 0.2s;
        }

        .ai-nav-close:hover {
            opacity: 1;
        }

        .ai-nav-body {
            padding: 16px;
        }

        .ai-nav-search {
            display: flex;
            gap: 8px;
            background: #f5f5f7;
            border-radius: 10px;
            padding: 4px;
        }

        #ai-nav-input {
            flex: 1;
            padding: 10px 12px;
            font-size: 14px;
            border: none;
            background: transparent;
            outline: none;
            color: #1a1a1a;
        }

        #ai-nav-input::placeholder {
            color: #999;
        }

        #ai-nav-search-btn {
            padding: 10px 16px;
            font-size: 13px;
            font-weight: 600;
            color: white;
            background: #007AFF;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            transition: background 0.2s;
        }

        #ai-nav-search-btn:hover {
            background: #0066DD;
        }

        .ai-nav-option {
            margin-top: 10px;
            font-size: 12px;
            color: #666;
        }

        .ai-nav-option label {
            display: flex;
            align-items: center;
            gap: 6px;
            cursor: pointer;
        }

        .ai-nav-option input[type="checkbox"] {
            width: 14px;
            height: 14px;
            accent-color: #007AFF;
        }

        .ai-nav-content {
            padding: 0 16px 16px;
            max-height: 300px;
            overflow-y: auto;
        }

        .ai-nav-content:empty {
            display: none;
        }

        .ai-nav-footer {
            padding: 8px 16px;
            border-top: 1px solid #f0f0f0;
            text-align: center;
        }

        .ai-nav-settings-btn {
            background: none;
            border: none;
            font-size: 14px;
            color: #888;
            cursor: pointer;
            padding: 4px 8px;
        }

        .ai-nav-settings-btn:hover {
            color: #007AFF;
        }

        /* 로딩 */
        .ai-nav-loading {
            text-align: center;
            padding: 20px;
        }

        .ai-nav-spinner {
            width: 30px;
            height: 30px;
            border: 3px solid #e5e5e5;
            border-top-color: #007AFF;
            border-radius: 50%;
            margin: 0 auto 10px;
            animation: ai-nav-spin 0.8s linear infinite;
        }

        @keyframes ai-nav-spin {
            to { transform: rotate(360deg); }
        }

        .ai-nav-loading-text {
            font-size: 13px;
            color: #666;
        }

        /* 확인 */
        .ai-nav-confirm {
            background: #f9f9fb;
            border-radius: 12px;
            padding: 16px;
            text-align: center;
        }

        .ai-nav-confirm-question {
            font-size: 13px;
            color: #666;
            margin-bottom: 4px;
        }

        .ai-nav-confirm-target {
            font-size: 16px;
            font-weight: 600;
            color: #007AFF;
            padding: 10px;
            background: white;
            border-radius: 8px;
            margin: 8px 0;
            border: 1px solid #e5e5ea;
        }

        .ai-nav-confirm-btns {
            display: flex;
            gap: 8px;
            margin-top: 12px;
        }

        .ai-nav-btn {
            flex: 1;
            padding: 10px;
            font-size: 13px;
            font-weight: 600;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            transition: all 0.2s;
        }

        .ai-nav-btn-primary {
            color: white;
            background: #007AFF;
        }

        .ai-nav-btn-primary:hover {
            background: #0066DD;
        }

        .ai-nav-btn-secondary {
            color: #666;
            background: #e5e5ea;
        }

        .ai-nav-btn-secondary:hover {
            background: #d1d1d6;
        }

        /* 결과 */
        .ai-nav-result {
            text-align: center;
            padding: 16px;
        }

        .ai-nav-result-icon {
            font-size: 32px;
            margin-bottom: 8px;
        }

        .ai-nav-result-message {
            font-size: 15px;
            font-weight: 600;
            color: #1a1a1a;
            margin-bottom: 4px;
        }

        .ai-nav-result-hint {
            font-size: 12px;
            color: #666;
        }

        /* 에러 */
        .ai-nav-error {
            background: #fff5f5;
            border-radius: 12px;
            padding: 16px;
            text-align: center;
        }

        .ai-nav-error-message {
            font-size: 13px;
            color: #FF3B30;
            margin-bottom: 12px;
        }

        /* 설정 모달 */
        .ai-nav-modal {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 2147483648;
        }

        .ai-nav-modal-content {
            background: white;
            padding: 20px;
            border-radius: 14px;
            width: 280px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.2);
        }

        .ai-nav-modal-title {
            font-size: 16px;
            font-weight: 600;
            margin-bottom: 16px;
            text-align: center;
        }

        .ai-nav-modal-input {
            width: 100%;
            padding: 10px;
            font-size: 13px;
            border: 1px solid #e5e5ea;
            border-radius: 8px;
            margin-bottom: 12px;
            box-sizing: border-box;
            background: white;
            color: #1a1a1a;
        }

        .ai-nav-modal-input:focus {
            outline: none;
            border-color: #007AFF;
        }

        .ai-nav-modal-btns {
            display: flex;
            gap: 8px;
        }

        /* 토글 버튼 (최소화) */
        #ai-nav-toggle {
            position: fixed;
            width: 56px;
            height: 56px;
            background: linear-gradient(135deg, #007AFF 0%, #5856D6 100%);
            border: none;
            border-radius: 28px;
            color: white;
            font-size: 24px;
            cursor: grab;
            box-shadow: 0 4px 20px rgba(0,122,255,0.4);
            z-index: 2147483646;
            transition: transform 0.2s, box-shadow 0.2s;
            user-select: none;
            -webkit-user-select: none;
        }

        #ai-nav-toggle:active {
            cursor: grabbing;
        }

        #ai-nav-toggle:hover {
            transform: scale(1.05);
            box-shadow: 0 6px 25px rgba(0,122,255,0.5);
        }
    `;

    document.head.appendChild(styles);
}

// ===== 이벤트 바인딩 =====
function bindWidgetEvents() {
    // 드래그
    const dragHandle = document.getElementById('ai-nav-drag-handle');
    dragHandle.addEventListener('mousedown', startDrag);
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', endDrag);

    // 닫기
    document.getElementById('ai-nav-close').addEventListener('click', hideWidget);

    // 검색
    document.getElementById('ai-nav-search-btn').addEventListener('click', handleWidgetSearch);
    document.getElementById('ai-nav-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleWidgetSearch();
    });

    // 설정
    document.getElementById('ai-nav-settings').addEventListener('click', showSettings);

    // API 키 로드
    loadApiKey();
}

// ===== 드래그 기능 =====
function startDrag(e) {
    isDragging = true;
    const rect = widgetElement.getBoundingClientRect();
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;
    widgetElement.style.transition = 'none';
}

function onDrag(e) {
    if (!isDragging) return;

    const x = e.clientX - dragOffset.x;
    const y = e.clientY - dragOffset.y;

    // 화면 범위 내로 제한
    const maxX = window.innerWidth - widgetElement.offsetWidth;
    const maxY = window.innerHeight - widgetElement.offsetHeight;

    widgetElement.style.left = `${Math.max(0, Math.min(x, maxX))}px`;
    widgetElement.style.top = `${Math.max(0, Math.min(y, maxY))}px`;
    widgetElement.style.right = 'auto';
    widgetElement.style.bottom = 'auto';
}

function endDrag() {
    if (isDragging) {
        isDragging = false;
        widgetElement.style.transition = '';
        savePosition();
    }
}

// ===== 위치 저장/복원 =====
function savePosition() {
    const rect = widgetElement.getBoundingClientRect();
    localStorage.setItem('ai-nav-position', JSON.stringify({
        left: rect.left,
        top: rect.top
    }));
}

function restorePosition() {
    try {
        const saved = localStorage.getItem('ai-nav-position');
        if (saved) {
            const pos = JSON.parse(saved);
            widgetElement.style.left = `${pos.left}px`;
            widgetElement.style.top = `${pos.top}px`;
            widgetElement.style.right = 'auto';
            widgetElement.style.bottom = 'auto';
        }
    } catch (e) { }
}

// ===== 위젯 표시/숨김 =====
function showWidget() {
    if (!widgetElement) createWidget();
    widgetElement.style.display = 'block';
    widgetVisible = true;
}

function hideWidget() {
    if (widgetElement) {
        widgetElement.style.display = 'none';
    }
    widgetVisible = false;
}

function toggleWidget() {
    if (widgetVisible) {
        hideWidget();
    } else {
        showWidget();
    }
}

// ===== Extension Context Invalidated 에러 처리 =====
function showContextInvalidatedError(contentEl) {
    contentEl.innerHTML = `
        <div class="ai-nav-error">
            <p class="ai-nav-error-message">확장 프로그램이 업데이트되었습니다.<br>페이지를 새로고침해주세요.</p>
            <button class="ai-nav-btn ai-nav-btn-primary" onclick="location.reload()">🔄 새로고침</button>
        </div>
    `;
}

// ===== API 키 관리 =====
function loadApiKey() {
    try {
        if (!chrome.runtime?.id) return; // Extension context invalidated
        chrome.storage.local.get(['apiKey'], (result) => {
            apiKey = result.apiKey || '';
        });
    } catch (e) {
        console.warn('[AI Nav] Extension context invalidated');
    }
}

function showSettings() {
    const content = document.getElementById('ai-nav-content');
    content.innerHTML = `
        <div class="ai-nav-modal-content" style="position:relative; box-shadow:none; padding:0;">
            <p class="ai-nav-modal-title">API 키 설정</p>
            <input type="password" class="ai-nav-modal-input" id="ai-nav-api-input" 
                   placeholder="sk-ant-...">
            <div class="ai-nav-modal-btns">
                <button class="ai-nav-btn ai-nav-btn-primary" id="ai-nav-save-api">저장</button>
                <button class="ai-nav-btn ai-nav-btn-secondary" id="ai-nav-close-settings">닫기</button>
            </div>
        </div>
    `;

    // 안전하게 기존 API 키 값 설정
    const apiInput = document.getElementById('ai-nav-api-input');
    if (apiKey) {
        apiInput.value = apiKey;
    }

    document.getElementById('ai-nav-save-api').addEventListener('click', () => {
        const newKey = document.getElementById('ai-nav-api-input').value.trim();
        try {
            if (!chrome.runtime?.id) throw new Error('Extension context invalidated');
            chrome.storage.local.set({ apiKey: newKey }, () => {
                apiKey = newKey;
                content.innerHTML = `
                    <div class="ai-nav-result">
                        <p class="ai-nav-result-icon">✅</p>
                        <p class="ai-nav-result-message">저장되었습니다</p>
                    </div>
                `;
                setTimeout(() => { content.innerHTML = ''; }, 1500);
            });
        } catch (e) {
            showContextInvalidatedError(content);
        }
    });

    document.getElementById('ai-nav-close-settings').addEventListener('click', () => {
        content.innerHTML = '';
    });
}

// ===== 검색 처리 =====
async function handleWidgetSearch() {
    const input = document.getElementById('ai-nav-input');
    const query = input.value.trim();

    if (!query) return;

    if (!apiKey) {
        showSettings();
        return;
    }

    const content = document.getElementById('ai-nav-content');
    const isDeep = document.getElementById('ai-nav-deep').checked;

    // 로딩 표시
    content.innerHTML = `
        <div class="ai-nav-loading">
            <div class="ai-nav-spinner"></div>
            <p class="ai-nav-loading-text">${isDeep ? '사이트 분석 중...' : '분석 중...'}</p>
        </div>
    `;

    try {
        let elementsToAnalyze;

        console.log(`%c[AI Nav Widget] 검색 시작: "${query}"`, 'background: #5856D6; color: white; padding: 4px 8px; border-radius: 4px;');
        console.log(`[AI Nav Widget] 딥 크롤링 모드: ${isDeep}`);

        if (isDeep) {
            // 딥 크롤링
            console.log(`[AI Nav Widget] 딥 크롤링 시작...`);
            const crawlResult = await handleDeepCrawl(2, 30);
            if (crawlResult.error) throw new Error(crawlResult.error);
            elementsToAnalyze = crawlResult.allElements;
            console.log(`[AI Nav Widget] 딥 크롤링 완료: ${elementsToAnalyze?.length || 0}개 요소`);
        } else {
            // 일반 분석
            console.log(`[AI Nav Widget] DOM 분석 호출...`);
            elementsToAnalyze = analyzeDom();
            console.log(`[AI Nav Widget] DOM 분석 완료: ${elementsToAnalyze?.length || 0}개 요소`);
        }

        // 분석된 요소 상세 로그
        console.log(`%c[AI Nav Widget] 분석된 요소 목록:`, 'color: #FF9500;');
        if (elementsToAnalyze && elementsToAnalyze.length > 0) {
            elementsToAnalyze.forEach((el, i) => {
                console.log(`  ${i + 1}. [${el.type}] "${el.text}" (id: ${el.id})`);
            });
        } else {
            console.warn(`[AI Nav Widget] ⚠️ 분석된 요소가 없습니다!`);
        }

        // LLM 분석 요청
        if (!chrome.runtime?.id) {
            throw new Error('확장 프로그램이 업데이트되었습니다. 페이지를 새로고침해주세요.');
        }

        console.log(`%c[AI Nav Widget] LLM 요청 전송...`, 'color: #007AFF;');
        console.log(`[AI Nav Widget] 요청 타입: ${isDeep ? 'ANALYZE_DEEP_QUERY' : 'ANALYZE_QUERY'}`);
        console.log(`[AI Nav Widget] 요소 개수: ${elementsToAnalyze?.length || 0}`);

        const response = await chrome.runtime.sendMessage({
            type: isDeep ? 'ANALYZE_DEEP_QUERY' : 'ANALYZE_QUERY',
            query: query,
            elements: elementsToAnalyze,
            apiKey: apiKey
        });

        console.log(`%c[AI Nav Widget] LLM 응답 수신:`, 'background: #34C759; color: white; padding: 4px 8px; border-radius: 4px;');
        console.log(`[AI Nav Widget] 응답:`, response);

        if (response?.candidates) {
            console.log(`[AI Nav Widget] 후보 개수: ${response.candidates.length}`);
            response.candidates.forEach((c, i) => {
                console.log(`  ${i + 1}. [${c.confidence?.toFixed(2) || '?'}] "${c.text}" (target: ${c.target}, isIntermediate: ${c.isIntermediate})`);
            });
        }

        handleWidgetResult(response);

    } catch (error) {
        console.error(`%c[AI Nav Widget] 에러 발생:`, 'background: #FF3B30; color: white; padding: 4px 8px; border-radius: 4px;');
        console.error(`[AI Nav Widget]`, error);
        content.innerHTML = `
            <div class="ai-nav-error">
                <p class="ai-nav-error-message">${error.message}</p>
                <button class="ai-nav-btn ai-nav-btn-secondary" onclick="document.getElementById('ai-nav-content').innerHTML=''">닫기</button>
            </div>
        `;
    }
}

// ===== 결과 처리 =====
function handleWidgetResult(response) {
    const content = document.getElementById('ai-nav-content');

    if (response.error) {
        content.innerHTML = `
            <div class="ai-nav-error">
                <p class="ai-nav-error-message">${response.error}</p>
            </div>
        `;
        return;
    }

    if (!response.candidates || response.candidates.length === 0) {
        content.innerHTML = `
            <div class="ai-nav-error">
                <p class="ai-nav-error-message">찾지 못했어요. 다른 표현으로 시도해주세요.</p>
            </div>
        `;
        return;
    }

    // 첫 번째 후보 확인 요청
    const candidate = response.candidates[0];
    window.currentCandidates = response.candidates;
    window.currentCandidateIndex = 0;

    // 현재 검색어 저장 (경로 표시용)
    const searchQuery = document.getElementById('ai-nav-input')?.value?.trim() || '';
    window.currentSearchQuery = searchQuery;

    // 다단계 네비게이션인 경우 경로 UI 표시
    if (candidate.isIntermediate || candidate.navigationPath?.length > 0) {
        showMultiStepNavigation(candidate, searchQuery);
    }

    showWidgetConfirm(candidate);
}

// 다단계 네비게이션 경로 UI 표시
function showMultiStepNavigation(candidate, goal) {
    // 경로 단계 구성
    let steps = [];

    // LLM이 제공한 navigationPath가 있으면 사용
    if (candidate.navigationPath && candidate.navigationPath.length > 0) {
        steps = [...candidate.navigationPath];
    }

    // 현재 클릭해야 할 요소 추가
    if (candidate.text && !steps.includes(candidate.text)) {
        steps.push(candidate.text);
    }

    // 최소 1단계 이상이면 경로 UI 표시
    if (steps.length >= 1 && typeof showNavigationPath === 'function') {
        showNavigationPath(steps, 0, goal);
    }
}

function showWidgetConfirm(candidate) {
    const content = document.getElementById('ai-nav-content');
    const isIntermediate = candidate.isIntermediate === true;

    content.innerHTML = `
        <div class="ai-nav-confirm">
            <p class="ai-nav-confirm-question">${isIntermediate ? '관련 메뉴:' : '찾으시는 게'}</p>
            <p class="ai-nav-confirm-target">"${candidate.text || candidate.message}"</p>
            <p class="ai-nav-confirm-question">${isIntermediate ? '👆 클릭 후 다시 검색' : '맞나요?'}</p>
            <div class="ai-nav-confirm-btns">
                <button class="ai-nav-btn ai-nav-btn-primary" id="ai-nav-confirm-yes">네</button>
                <button class="ai-nav-btn ai-nav-btn-secondary" id="ai-nav-confirm-no">아니요</button>
            </div>
        </div>
    `;

    document.getElementById('ai-nav-confirm-yes').addEventListener('click', () => {
        const targetId = candidate.target;
        const isIntermediate = candidate.isIntermediate === true;
        const message = isIntermediate ? '여기를 클릭 → 다시 검색' : '여기를 클릭하세요';

        // highlightElement가 content.js에 정의되어 있으므로 직접 호출
        if (typeof highlightElement === 'function') {
            highlightElement(targetId, message);

            // 다단계 네비게이션인 경우 안내 메시지 다르게 표시
            if (isIntermediate) {
                content.innerHTML = `
                    <div class="ai-nav-result">
                        <p class="ai-nav-result-icon">👆</p>
                        <p class="ai-nav-result-message">클릭 후 다시 검색하세요</p>
                        <p class="ai-nav-result-hint">이동한 페이지에서 같은 검색어로 다시 시도해주세요</p>
                    </div>
                `;
                // 경로 UI 다음 단계로 업데이트
                if (typeof advanceNavigationStep === 'function') {
                    advanceNavigationStep();
                }
            } else {
                content.innerHTML = `
                    <div class="ai-nav-result">
                        <p class="ai-nav-result-icon">✅</p>
                        <p class="ai-nav-result-message">찾았어요!</p>
                        <p class="ai-nav-result-hint">하이라이트된 곳을 클릭하세요</p>
                    </div>
                `;
                // 최종 목표 도달 - 경로 UI 완료 표시 후 제거
                if (typeof clearNavigationPath === 'function') {
                    setTimeout(() => clearNavigationPath(), 3000);
                }
            }
        } else {
            // fallback: 요소를 직접 찾아서 스크롤
            const targetEl = document.querySelector(`[data-nav-id="${targetId}"]`);
            if (targetEl) {
                targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                targetEl.style.outline = '4px solid #667eea';
                targetEl.style.outlineOffset = '4px';
                setTimeout(() => {
                    targetEl.style.outline = '';
                    targetEl.style.outlineOffset = '';
                }, 3000);
                content.innerHTML = `
                    <div class="ai-nav-result">
                        <p class="ai-nav-result-icon">✅</p>
                        <p class="ai-nav-result-message">찾았어요!</p>
                        <p class="ai-nav-result-hint">하이라이트된 곳을 클릭하세요</p>
                    </div>
                `;
            } else {
                content.innerHTML = `
                    <div class="ai-nav-error">
                        <p class="ai-nav-error-message">요소를 찾을 수 없습니다. 페이지를 새로고침 후 다시 시도해주세요.</p>
                    </div>
                `;
            }
        }
    });

    document.getElementById('ai-nav-confirm-no').addEventListener('click', () => {
        window.currentCandidateIndex++;
        if (window.currentCandidateIndex < window.currentCandidates.length) {
            showWidgetConfirm(window.currentCandidates[window.currentCandidateIndex]);
        } else {
            content.innerHTML = `
                <div class="ai-nav-error">
                    <p class="ai-nav-error-message">더 이상 후보가 없어요. 다른 표현으로 시도해주세요.</p>
                </div>
            `;
        }
    });
}

// ===== 토글 버튼 드래그 상태 =====
let isToggleDragging = false;
let toggleDragOffset = { x: 0, y: 0 };
let toggleElement = null;
let toggleDragMoved = false;

// ===== 토글 버튼 생성 =====
function createToggleButton() {
    if (document.getElementById('ai-nav-toggle')) return;

    const btn = document.createElement('button');
    btn.id = 'ai-nav-toggle';
    btn.innerHTML = '🧭';

    toggleElement = btn;

    // 드래그 이벤트
    btn.addEventListener('mousedown', startToggleDrag);
    document.addEventListener('mousemove', onToggleDrag);
    document.addEventListener('mouseup', endToggleDrag);

    // 터치 이벤트 (모바일 지원)
    btn.addEventListener('touchstart', startToggleDragTouch, { passive: false });
    document.addEventListener('touchmove', onToggleDragTouch, { passive: false });
    document.addEventListener('touchend', endToggleDrag);

    document.body.appendChild(btn);

    // 저장된 토글 버튼 위치 복원
    restoreTogglePosition();
}

// ===== 토글 버튼 드래그 기능 =====
function startToggleDrag(e) {
    isToggleDragging = true;
    toggleDragMoved = false;
    const rect = toggleElement.getBoundingClientRect();
    toggleDragOffset.x = e.clientX - rect.left;
    toggleDragOffset.y = e.clientY - rect.top;
    toggleElement.style.transition = 'none';
    e.preventDefault();
}

function startToggleDragTouch(e) {
    if (e.touches.length === 1) {
        isToggleDragging = true;
        toggleDragMoved = false;
        const rect = toggleElement.getBoundingClientRect();
        toggleDragOffset.x = e.touches[0].clientX - rect.left;
        toggleDragOffset.y = e.touches[0].clientY - rect.top;
        toggleElement.style.transition = 'none';
        e.preventDefault();
    }
}

function onToggleDrag(e) {
    if (!isToggleDragging) return;

    toggleDragMoved = true;
    const x = e.clientX - toggleDragOffset.x;
    const y = e.clientY - toggleDragOffset.y;

    // 화면 범위 내로 제한
    const maxX = window.innerWidth - toggleElement.offsetWidth;
    const maxY = window.innerHeight - toggleElement.offsetHeight;

    toggleElement.style.left = `${Math.max(0, Math.min(x, maxX))}px`;
    toggleElement.style.top = `${Math.max(0, Math.min(y, maxY))}px`;
    toggleElement.style.right = 'auto';
    toggleElement.style.bottom = 'auto';
}

function onToggleDragTouch(e) {
    if (!isToggleDragging || e.touches.length !== 1) return;

    toggleDragMoved = true;
    const x = e.touches[0].clientX - toggleDragOffset.x;
    const y = e.touches[0].clientY - toggleDragOffset.y;

    // 화면 범위 내로 제한
    const maxX = window.innerWidth - toggleElement.offsetWidth;
    const maxY = window.innerHeight - toggleElement.offsetHeight;

    toggleElement.style.left = `${Math.max(0, Math.min(x, maxX))}px`;
    toggleElement.style.top = `${Math.max(0, Math.min(y, maxY))}px`;
    toggleElement.style.right = 'auto';
    toggleElement.style.bottom = 'auto';

    e.preventDefault();
}

function endToggleDrag() {
    if (isToggleDragging) {
        isToggleDragging = false;
        toggleElement.style.transition = '';
        saveTogglePosition();

        // 드래그하지 않았으면 클릭으로 처리
        if (!toggleDragMoved) {
            toggleWidget();
        }
    }
}

// ===== 토글 버튼 위치 저장/복원 =====
function saveTogglePosition() {
    const rect = toggleElement.getBoundingClientRect();
    localStorage.setItem('ai-nav-toggle-position', JSON.stringify({
        left: rect.left,
        top: rect.top
    }));
}

function restoreTogglePosition() {
    try {
        const saved = localStorage.getItem('ai-nav-toggle-position');
        // 화면 범위 계산 (버튼 크기 56px)
        const maxX = window.innerWidth - 56;
        const maxY = window.innerHeight - 56;

        if (saved) {
            const pos = JSON.parse(saved);
            toggleElement.style.left = `${Math.max(0, Math.min(pos.left, maxX))}px`;
            toggleElement.style.top = `${Math.max(0, Math.min(pos.top, maxY))}px`;
        } else {
            // 기본 위치: 오른쪽 아래 (20px 여백)
            toggleElement.style.left = `${maxX - 20}px`;
            toggleElement.style.top = `${maxY - 20}px`;
        }
        toggleElement.style.right = 'auto';
        toggleElement.style.bottom = 'auto';
    } catch (e) {
        // 에러 시 기본 위치
        toggleElement.style.left = `${window.innerWidth - 76}px`;
        toggleElement.style.top = `${window.innerHeight - 76}px`;
        toggleElement.style.right = 'auto';
        toggleElement.style.bottom = 'auto';
    }
}

// ===== 초기화 =====
function initFloatingWidget() {
    // 시스템 페이지에서는 실행하지 않음
    if (window.location.protocol === 'chrome:' ||
        window.location.protocol === 'chrome-extension:') {
        return;
    }

    createToggleButton();

    // 처음에는 숨김 상태로 시작
    console.log('[AI Nav] 플로팅 위젯 준비됨. 🧭 버튼을 클릭하세요.');
}

// DOM 로드 후 초기화
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFloatingWidget);
} else {
    initFloatingWidget();
}
