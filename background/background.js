// background.js - Service Worker for Chrome Extension (Conversational Mode)

// ========== API Configuration ==========
const CLAUDE_API_KEY = '__CLAUDE_API_KEY__'; // Injected by build script - do not commit real key here
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-sonnet-4-5';

// ========== System Prompt ==========
const SYSTEM_PROMPT = `# Role
당신은 디지털 소외계층(고령층, 장애인 등)이 웹사이트를 쉽게 이용할 수 있도록 돕는 '따라온나' AI입니다. 
사용자와 친근하게 대화하면서 원하는 기능을 찾아 안내해 주세요.

# 대화 스타일
- 친근하고 따뜻한 말투를 사용하세요 (예: "~해 드릴게요", "~하시면 돼요")
- 한 번에 하나씩 단계별로 안내하세요
- 어르신들이 이해하기 쉽게 간단명료하게 설명하세요

# Input Data
1. user_message: 사용자가 입력한 메시지
2. dom_elements: 현재 웹페이지의 클릭 가능한 요소들 (JSON 배열)
3. search_inputs: 페이지의 검색창 정보 (있으면)

# 요소 선택 전략

## 우선순위 1 - 최종 목표 (GOAL_REACHED)
"발급하기", "신청하기", "조회하기", "출력", "교부 신청" 등 목표를 직접 달성하는 버튼

## 우선순위 2 - 직접 관련 메뉴
목표와 직접 관련된 메뉴/링크

## 우선순위 3 - 상위 카테고리
목표로 이동할 수 있는 상위 메뉴 (교육, 민원, 증명서 등)

## 우선순위 4 - 검색창 활용 (USE_SEARCH)
위에서 찾지 못하면 검색창을 사용하도록 안내하세요.
검색창이 있다면 적절한 검색어를 제안해 주세요.

# Output Format (JSON만 출력)

{
  "status": "GOAL_REACHED" | "NAVIGATING" | "USE_SEARCH" | "NEED_MORE_INFO" | "NOT_FOUND",
  "message": "사용자에게 보여줄 친근한 대화 메시지",
  "target_id": "클릭할 요소의 ID (있으면)",
  "target_text": "클릭할 요소의 텍스트 (있으면)",
  "search_keyword": "검색창에 입력할 키워드 (USE_SEARCH일 때)",
  "search_input_id": "검색창 요소 ID (USE_SEARCH일 때)"
}

# 상태별 응답 예시

## GOAL_REACHED (최종 목표 도달)
{
  "status": "GOAL_REACHED",
  "message": "찾으셨어요! '학교생활기록부 발급' 버튼이에요. 여기를 클릭하시면 됩니다!",
  "target_id": "nav-5",
  "target_text": "학교생활기록부 발급"
}

## NAVIGATING (중간 단계)
{
  "status": "NAVIGATING",
  "message": "먼저 '교육' 메뉴를 클릭해 주세요. 거기서 생활기록부를 찾을 수 있어요.",
  "target_id": "nav-2",
  "target_text": "교육"
}

## USE_SEARCH (검색 필요)
{
  "status": "USE_SEARCH",
  "message": "이 페이지에서 바로 찾기 어려워요. 검색창에 '생활기록부'를 입력해 보시겠어요?",
  "search_keyword": "생활기록부",
  "search_input_id": "search-1",
  "target_id": "search-1",
  "target_text": "검색"
}

## NEED_MORE_INFO (추가 정보 필요)
{
  "status": "NEED_MORE_INFO",
  "message": "어떤 서류를 발급받으시려는 건가요? 조금 더 자세히 말씀해 주시면 찾아드릴게요."
}

## NOT_FOUND (찾을 수 없음)
{
  "status": "NOT_FOUND",
  "message": "죄송해요, 이 페이지에서는 찾기 어려워요. 혹시 다른 사이트에 있는 건 아닐까요?"
}

# 중요 규칙
1. 항상 JSON 형식으로만 응답하세요.
2. 검색창이 있고 직접 찾기 어려우면 USE_SEARCH를 사용하세요.
3. 사용자가 "생기부", "등본" 같은 줄임말을 사용하면 정확한 검색어로 변환해 주세요.
4. 대화가 자연스럽게 이어지도록 메시지를 작성하세요.
5. 사용자가 특정 민원/업무 탭에 진입해 발급(신청) 흐름을 시작했다면,
   추가 안내 링크(예: 처리기간 계산 방법, 다른 민원 안내, 부가 정보 페이지)를
   더 이상 권유하거나 표시하지 말고, 해당 업무의 완료 단계로만 안내하세요.
6. 다른 링크로 페이지가 이동되었을 때마다 현재 업무 진행에 필요한 이동인지 판단해
   계속 안내하거나, 필요 없으면 안내를 종료하세요.
7. ⚠️ JSON 외 어떤 문자도 출력하지 마세요.`;

// ========== Session State ==========
let session = {
    active: false,
    tabId: null,
    conversationHistory: [],
    lastUserMessage: null,
    lastAutoUrl: null,
    lastAutoAt: 0,
    currentTarget: null,
    isHighlighted: false
};

// ========== Message Handler ==========
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender).then(sendResponse);
    return true;
});

async function handleMessage(message, sender) {
    switch (message.type) {
        case 'CHAT_MESSAGE':
            return await handleChatMessage(message.message, message.history);

        case 'HIGHLIGHT_ELEMENT':
            return await handleHighlightElement(message.target);

        case 'CLEAR_HIGHLIGHT':
            return await handleClearHighlight();

        case 'CLEAR_SESSION':
            return handleClearSession();

        case 'GET_SESSION':
            return getSessionState();

        case 'CHECK_SESSION_FOR_PAGE':
            return checkSessionForPage(sender.tab?.id);

        case 'FILL_SEARCH':
            return await handleFillSearch(message.searchInputId, message.keyword);

        case 'PAGE_NAVIGATED':
            return await handleAutoContinue(sender.tab?.id, sender.tab?.url);

        default:
            return { success: false, error: 'Unknown message type' };
    }
}

// ========== Fill Search Handler ==========
async function handleFillSearch(searchInputId, keyword) {
    try {
        const tabId = session.tabId || (await getCurrentTabId());

        const response = await chrome.tabs.sendMessage(tabId, {
            type: 'FILL_SEARCH',
            searchInputId: searchInputId,
            keyword: keyword
        });

        return response;

    } catch (error) {
        console.error('Fill search error:', error);
        return { success: false, error: '검색어를 입력할 수 없어요.' };
    }
}

// ========== DOM Extraction Helper ==========
async function getElementsAndInputs(tabId) {
    let elements, searchInputs;

    try {
        console.log('Content script에 메시지 전송...');
        const response = await chrome.tabs.sendMessage(tabId, { type: 'GET_DOM_ELEMENTS' });
        elements = response.elements;
        searchInputs = response.searchInputs || [];
        console.log('DOM 요소 수:', elements?.length, '검색창 수:', searchInputs?.length);
    } catch (error) {
        console.log('Content script 로드 안됨, 주입 시도...', error.message);
        await chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ['content/content.js']
        });
        await chrome.scripting.insertCSS({
            target: { tabId: tabId },
            files: ['content/content.css']
        });

        await new Promise(resolve => setTimeout(resolve, 200));
        const response = await chrome.tabs.sendMessage(tabId, { type: 'GET_DOM_ELEMENTS' });
        elements = response.elements;
        searchInputs = response.searchInputs || [];
        console.log('주입 후 DOM 요소 수:', elements?.length);
    }

    return { elements, searchInputs };
}

function buildTargetFromResult(result, elements, searchInputs) {
    let target = null;
    const targetId = result.target_id || result.search_input_id;

    if (targetId) {
        const targetElement = elements.find(el => el.id === targetId);
        if (targetElement) {
            target = {
                ...targetElement,
                id: targetId,
                text: result.target_text || targetElement.text
            };
        } else if (searchInputs) {
            const searchInput = searchInputs.find(s => s.id === targetId);
            if (searchInput) {
                target = {
                    ...searchInput,
                    id: targetId,
                    text: result.target_text || '검색창',
                    isSearchInput: true
                };
            }
        }
    }

    return target;
}

function buildAssistantHistoryEntry(result, target, searchKeyword) {
    const extras = {};
    if (target && target.text) {
        extras.highlight = target.text;
    }
    if (searchKeyword) {
        extras.searchKeyword = searchKeyword;
    }

    return {
        role: 'assistant',
        content: result.message,
        extras
    };
}

// ========== Auto-continue on Navigation ==========
async function handleAutoContinue(tabId, url) {
    if (!session.active || !tabId || session.tabId !== tabId || !session.lastUserMessage) {
        return { success: false, error: 'No active session to continue' };
    }

    const now = Date.now();
    if (session.lastAutoUrl === url && now - session.lastAutoAt < 1500) {
        return { success: false, error: 'Duplicate navigation event' };
    }

    session.lastAutoUrl = url || session.lastAutoUrl;
    session.lastAutoAt = now;

    let thinkingShown = false;
    try {
        const { elements, searchInputs } = await getElementsAndInputs(tabId);
        await setThinkingState(tabId, true, '잠시만 기다려 주세요. 생각 중이에요...');
        thinkingShown = true;

        const autoMessage = '페이지가 이동되었습니다. 이전 대화를 참고해 계속 안내가 필요한지 판단해 주세요. ' +
            '필요하면 다음 단계로 안내하고, 필요 없으면 status를 NOT_FOUND로 응답하며 안내를 종료해 주세요.';

        const history = Array.isArray(session.conversationHistory) ? session.conversationHistory : [];
        const result = await analyzeWithClaude(autoMessage, elements, searchInputs, history);

        let target = buildTargetFromResult(result, elements, searchInputs);

        if (result.status === 'USE_SEARCH' && result.search_keyword) {
            const searchInputId = result.search_input_id || target?.id;
            if (searchInputId) {
                const fillResponse = await handleFillSearch(searchInputId, result.search_keyword);
                if (fillResponse?.success) {
                    if (fillResponse.searchButton) {
                        target = fillResponse.searchButton;
                    }
                }
            }
        }

        session.currentTarget = target;

        const assistantEntry = buildAssistantHistoryEntry(result, target, result.search_keyword);
        session.conversationHistory.push(assistantEntry);

        if (result.status === 'NOT_FOUND') {
            session.active = false;
            session.currentTarget = null;
            session.isHighlighted = false;
        } else if (target) {
            await handleHighlightElement(target);
        }

        const response = {
            success: true,
            status: result.status,
            message: result.message,
            target: target,
            searchKeyword: result.search_keyword
        };

        try {
            chrome.runtime.sendMessage({ type: 'AUTO_GUIDANCE', response });
        } catch (error) {
            console.log('Popup not available for AUTO_GUIDANCE');
        }

        return response;
    } catch (error) {
        console.error('Auto-continue error:', error);
        return { success: false, error: '자동 안내 중 오류가 발생했어요.' };
    } finally {
        if (thinkingShown) {
            await setThinkingState(tabId, false);
        }
    }
}

// ========== Chat Message Handler ==========
async function handleChatMessage(userMessage, history = []) {
    console.log('=== handleChatMessage 시작 ===');
    console.log('userMessage:', userMessage);

    try {
        // Get current active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        console.log('현재 탭:', tab?.id, tab?.url);

        if (!tab) {
            console.log('ERROR: 탭을 찾을 수 없음');
            return {
                success: false,
                status: 'ERROR',
                error: '활성 탭을 찾을 수 없어요.'
            };
        }

        session.tabId = tab.id;
        session.active = true;
        session.lastUserMessage = userMessage;
        session.conversationHistory = Array.isArray(history) ? history.slice() : [];

        const { elements, searchInputs } = await getElementsAndInputs(tab.id);

        // Call Claude API
        console.log('Claude API 호출 시작...');
        const result = await analyzeWithClaude(userMessage, elements, searchInputs, history);
        console.log('Claude API 결과:', result);

        const target = buildTargetFromResult(result, elements, searchInputs);

        session.currentTarget = target;
        const assistantEntry = buildAssistantHistoryEntry(result, target, result.search_keyword);
        session.conversationHistory.push(assistantEntry);

        return {
            success: true,
            status: result.status,
            message: result.message,
            target: target,
            searchKeyword: result.search_keyword
        };

    } catch (error) {
        console.error('Chat error:', error);
        return {
            success: false,
            status: 'ERROR',
            error: '죄송해요, 오류가 발생했어요. 다시 시도해 주세요.'
        };
    }
}

// ========== Claude API Integration ==========
async function analyzeWithClaude(userMessage, elements, searchInputs, history) {
    console.log('=== analyzeWithClaude 시작 ===');
    console.log('elements 수:', elements?.length);
    console.log('searchInputs 수:', searchInputs?.length);

    // Prepare element list
    const limitedElements = elements.slice(0, 1000).map(el => ({
        id: el.id,
        tag: el.tag.toUpperCase(),
        text: el.text,
        type: el.type
    }));

    // Prepare search inputs
    const searchInfo = searchInputs.map(s => ({
        id: s.id,
        placeholder: s.placeholder || '검색'
    }));

    const userPrompt = `사용자 메시지: "${userMessage}"

현재 페이지 요소:
${JSON.stringify(limitedElements, null, 2)}

검색창 정보:
${searchInfo.length > 0 ? JSON.stringify(searchInfo, null, 2) : '검색창 없음'}`;

    // Build messages with history
    const messages = [];

    // Add recent history (last 6 messages)
    const recentHistory = history.slice(-6);
    recentHistory.forEach(msg => {
        if (msg.role === 'user') {
            messages.push({ role: 'user', content: msg.content });
        } else {
            messages.push({ role: 'assistant', content: msg.content });
        }
    });

    // Add current message
    messages.push({ role: 'user', content: userPrompt });

    console.log('API 요청 준비 완료, 메시지 수:', messages.length);

    try {
        console.log('fetch 시작...');
        const response = await fetch(CLAUDE_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': CLAUDE_API_KEY,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
            body: JSON.stringify({
                model: CLAUDE_MODEL,
                max_tokens: 1024,
                system: SYSTEM_PROMPT,
                messages: messages
            })
        });

        console.log('fetch 완료, status:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Claude API error:', response.status, errorText);
            throw new Error(`API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        console.log('API 응답 data:', data);

        const content = data.content[0]?.text;
        console.log('content:', content);

        if (!content) {
            throw new Error('Empty response from Claude');
        }

        // Parse JSON from response
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            console.error('JSON 파싱 실패, raw content:', content);
            throw new Error('Could not parse JSON from response');
        }

        const result = JSON.parse(jsonMatch[0]);
        console.log('파싱된 결과:', result);

        return result;

    } catch (error) {
        console.error('Claude API call failed:', error);
        throw error;
    }
}

// ========== Highlight Handler ==========
async function handleHighlightElement(target) {
    try {
        const tabId = session.tabId || (await getCurrentTabId());

        await chrome.tabs.sendMessage(tabId, {
            type: 'HIGHLIGHT',
            target: target,
            tooltip: '여기를 클릭하세요'
        });

        session.isHighlighted = true;
        session.currentTarget = target;

        return { success: true };

    } catch (error) {
        console.error('Highlight error:', error);
        return { success: false, error: '요소를 표시할 수 없어요.' };
    }
}

// ========== Clear Highlight ==========
async function handleClearHighlight() {
    try {
        const tabId = session.tabId || (await getCurrentTabId());
        await chrome.tabs.sendMessage(tabId, { type: 'CLEAR_HIGHLIGHT' });
        session.isHighlighted = false;
        return { success: true };
    } catch (error) {
        return { success: true };
    }
}

// ========== Clear Session ==========
function handleClearSession() {
    session = {
        active: false,
        tabId: null,
        conversationHistory: [],
        lastUserMessage: null,
        lastAutoUrl: null,
        lastAutoAt: 0,
        currentTarget: null,
        isHighlighted: false
    };
    return { success: true };
}

// ========== Get Session State ==========
function getSessionState() {
    return {
        hasActiveSession: session.active,
        conversationHistory: session.conversationHistory,
        isHighlighted: session.isHighlighted
    };
}

// ========== Check Session for Page ==========
function checkSessionForPage(tabId) {
    if (session.active && session.tabId === tabId && session.isHighlighted && session.currentTarget) {
        return {
            shouldHighlight: true,
            target: session.currentTarget
        };
    }
    return { shouldHighlight: false };
}

// ========== Utility ==========
async function getCurrentTabId() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab?.id;
}

async function setThinkingState(tabId, show, text) {
    try {
        await chrome.tabs.sendMessage(tabId, {
            type: show ? 'SHOW_THINKING' : 'HIDE_THINKING',
            text: text
        });
    } catch (error) {
        console.log('Thinking toast not available');
    }
}

// ========== Tab Update Listener ==========
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && session.active && session.tabId === tabId) {
        console.log('AI Web Guide: Page updated, session active');
        await handleAutoContinue(tabId, tab?.url);
    }
});

// ========== Extension Icon Click Handler ==========
chrome.action.onClicked.addListener(async (tab) => {
    try {
        // Send toggle message to content script
        await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_CHAT' });
    } catch (error) {
        // Content script not loaded, inject it first
        console.log('Content script not loaded, injecting...');
        await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content/content.js']
        });
        await chrome.scripting.insertCSS({
            target: { tabId: tab.id },
            files: ['content/content.css']
        });

        // Wait a bit and then toggle
        setTimeout(async () => {
            try {
                await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_CHAT' });
            } catch (e) {
                console.error('Failed to toggle chat:', e);
            }
        }, 300);
    }
});
