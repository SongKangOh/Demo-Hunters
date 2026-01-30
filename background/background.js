// ===== Background Service Worker - LLM API 연동 =====

// Claude API 설정
const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-sonnet-4-20250514';

// ===== 메시지 리스너 =====
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'ANALYZE_QUERY') {
        handleAnalyzeQuery(message)
            .then(sendResponse)
            .catch(error => {
                console.error('[AI Nav] API Error:', error);
                sendResponse({ error: error.message || '분석 중 오류가 발생했습니다.' });
            });
        return true; // 비동기 응답
    }

    if (message.type === 'ANALYZE_DEEP_QUERY') {
        handleDeepAnalyzeQuery(message)
            .then(sendResponse)
            .catch(error => {
                console.error('[AI Nav] Deep API Error:', error);
                sendResponse({ error: error.message || '딥 분석 중 오류가 발생했습니다.' });
            });
        return true;
    }
});

// ===== LLM 분석 요청 처리 =====
async function handleAnalyzeQuery({ query, elements, apiKey }) {
    if (!apiKey) {
        throw new Error('API 키가 설정되지 않았습니다.');
    }

    if (!elements || elements.length === 0) {
        throw new Error('분석할 요소가 없습니다.');
    }

    console.log(`[AI Nav] 쿼리 분석 시작: "${query}"`);
    console.log(`[AI Nav] 분석 대상 요소: ${elements.length}개`);

    // 요소 목록을 축약 (토큰 절약)
    const elementSummary = elements.map(el => ({
        id: el.id,
        text: el.text,
        type: el.type
    }));

    // 프롬프트 구성
    const systemPrompt = `당신은 웹사이트 네비게이션을 도와주는 AI 어시스턴트입니다.
사용자가 원하는 작업을 수행하기 위해 클릭해야 할 버튼이나 링크를 찾아주세요.

중요 규칙:
1. 반드시 JSON 형식으로만 응답하세요.
2. 사용자가 원하는 정확한 기능이 현재 페이지에 있으면 해당 요소를 반환하세요.
3. 정확한 기능이 없지만, 그 기능으로 갈 수 있는 상위 메뉴/카테고리가 있으면 그것을 반환하세요.
   - 예: "주민등록등본 발급"을 찾는데 없으면 → "민원서비스", "증명서 발급", "주민등록" 등 관련 메뉴를 안내
4. isIntermediate 필드로 중간 단계인지 표시하세요:
   - true: 이것을 클릭하면 원하는 기능으로 가는 페이지로 이동
   - false: 이것이 바로 원하는 기능
5. confidence는 0~1 사이의 숫자입니다.
6. 가장 적합한 요소 1~3개를 confidence 순으로 정렬하여 반환하세요.

응답 형식:
{
  "candidates": [
    {
      "target": "nav-0",
      "text": "요소의 텍스트",
      "confidence": 0.95,
      "isIntermediate": false,
      "message": "사용자에게 보여줄 안내 메시지"
    }
  ]
}`;

    const userPrompt = `사용자가 "${query}"을(를) 하려고 합니다.

현재 페이지에서 클릭 가능한 요소들:

${JSON.stringify(elementSummary, null, 2)}

위 요소들 중에서:
1. 사용자가 원하는 기능이 직접 있으면 그것을 반환
2. 없으면 그 기능이 있을 것 같은 상위 메뉴/카테고리를 반환 (isIntermediate: true)

JSON으로 응답하세요.`;

    // Claude API 호출
    const response = await fetch(CLAUDE_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
            model: CLAUDE_MODEL,
            max_tokens: 1024,
            messages: [
                {
                    role: 'user',
                    content: userPrompt
                }
            ],
            system: systemPrompt
        })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[AI Nav] API Error Response:', errorData);
        console.error('[AI Nav] Status:', response.status);
        console.error('[AI Nav] API Key (first 10 chars):', apiKey?.substring(0, 10) + '...');

        if (response.status === 401) {
            throw new Error('API 키가 유효하지 않습니다. 키를 다시 확인해주세요. (sk-ant-로 시작해야 합니다)');
        }
        if (response.status === 400) {
            throw new Error(`요청 오류: ${errorData.error?.message || '잘못된 요청입니다.'}`);
        }
        if (response.status === 429) {
            throw new Error('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');
        }
        throw new Error(`API 오류: ${response.status} - ${errorData.error?.message || '알 수 없는 오류'}`);
    }

    const data = await response.json();
    console.log('[AI Nav] API Response:', data);

    // 응답 파싱
    const content = data.content?.[0]?.text;
    if (!content) {
        throw new Error('AI 응답을 받지 못했습니다.');
    }

    // JSON 추출 및 파싱
    const result = parseJsonResponse(content);

    // 결과에 원본 요소 정보 추가
    if (result.candidates) {
        result.candidates = result.candidates.map(candidate => {
            const originalElement = elements.find(el => el.id === candidate.target);
            return {
                ...candidate,
                text: candidate.text || originalElement?.text || '',
                originalElement
            };
        });
    }

    console.log('[AI Nav] Parsed Result:', result);
    return result;
}

// JSON 응답 파싱
function parseJsonResponse(content) {
    // JSON 블록 추출 시도
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) ||
        content.match(/```\s*([\s\S]*?)\s*```/) ||
        content.match(/\{[\s\S]*\}/);

    let jsonStr = jsonMatch ? jsonMatch[1] || jsonMatch[0] : content;

    // 정리
    jsonStr = jsonStr.trim();
    if (!jsonStr.startsWith('{')) {
        jsonStr = '{' + jsonStr.split('{').slice(1).join('{');
    }

    try {
        return JSON.parse(jsonStr);
    } catch (e) {
        console.error('[AI Nav] JSON Parse Error:', e, jsonStr);

        // 단순 매칭 시도
        const targetMatch = jsonStr.match(/"target"\s*:\s*"([^"]+)"/);
        const textMatch = jsonStr.match(/"text"\s*:\s*"([^"]+)"/);
        const messageMatch = jsonStr.match(/"message"\s*:\s*"([^"]+)"/);

        if (targetMatch) {
            return {
                candidates: [{
                    target: targetMatch[1],
                    text: textMatch?.[1] || '',
                    confidence: 0.7,
                    message: messageMatch?.[1] || '여기를 클릭해보세요'
                }]
            };
        }

        throw new Error('AI 응답을 해석할 수 없습니다.');
    }
}

// ===== 딥 크롤링 LLM 분석 =====
async function handleDeepAnalyzeQuery({ query, elements, apiKey }) {
    if (!apiKey) {
        throw new Error('API 키가 설정되지 않았습니다.');
    }

    console.log(`[AI Nav] 딥 분석 시작: "${query}"`);
    console.log(`[AI Nav] 전체 요소 수: ${elements.length}개`);

    // 요소 목록을 축약 (경로 정보 포함)
    const elementSummary = elements.slice(0, 200).map(el => ({
        id: el.id,
        text: el.text,
        type: el.type,
        pageUrl: el.pageUrl,
        navigationPath: el.navigationPath,
        depth: el.depth
    }));

    // 기존과 동일한 형식으로 응답받도록 프롬프트 수정
    const systemPrompt = `당신은 웹사이트 네비게이션을 도와주는 AI 어시스턴트입니다.
사용자가 원하는 작업을 수행하기 위해 클릭해야 할 버튼이나 링크를 찾아주세요.

중요 규칙:
1. 반드시 JSON 형식으로만 응답하세요.
2. 요소들은 여러 페이지에서 수집된 것입니다. pageUrl, navigationPath, depth를 참고하세요.
3. depth가 0인 요소는 현재 페이지, depth가 1 이상인 요소는 링크를 클릭해야 접근 가능합니다.
4. 현재 페이지(depth: 0)에서 클릭할 수 있는 요소를 우선 찾으세요.
5. 현재 페이지에 원하는 기능이 없으면, 관련 메뉴로 이동하는 링크를 찾아 isIntermediate: true로 표시하세요.
6. confidence는 0~1 사이의 숫자입니다.

응답 형식:
{
  "candidates": [
    {
      "target": "nav-0",
      "text": "요소의 텍스트",
      "confidence": 0.95,
      "isIntermediate": false,
      "message": "사용자에게 보여줄 안내 메시지",
      "pageUrl": "해당 요소가 있는 페이지 URL",
      "depth": 0
    }
  ]
}`;

    const userPrompt = `사용자가 "${query}"을(를) 하려고 합니다.

아래는 사이트의 여러 페이지에서 수집한 클릭 가능한 요소들입니다:

${JSON.stringify(elementSummary, null, 2)}

위 요소들 중에서 사용자의 의도에 가장 적합한 요소를 찾아 JSON으로 응답하세요.
현재 페이지(depth: 0)의 요소를 우선적으로 찾고, 없으면 관련 메뉴 링크를 찾아주세요.`;

    const response = await fetch(CLAUDE_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true'
        },
        body: JSON.stringify({
            model: CLAUDE_MODEL,
            max_tokens: 2048,
            messages: [{ role: 'user', content: userPrompt }],
            system: systemPrompt
        })
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`API 오류: ${response.status} - ${errorData.error?.message || '알 수 없는 오류'}`);
    }

    const data = await response.json();
    const content = data.content?.[0]?.text;

    if (!content) {
        throw new Error('AI 응답을 받지 못했습니다.');
    }

    const result = parseJsonResponse(content);
    console.log('[AI Nav] Deep Parsed Result:', result);
    return result;
}

// ===== Extension 설치/업데이트 시 =====
chrome.runtime.onInstalled.addListener((details) => {
    console.log('[AI 웹 네비게이션 가이드] Extension 설치/업데이트됨:', details.reason);
});

console.log('[AI 웹 네비게이션 가이드] Background Service Worker 시작됨');
