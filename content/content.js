// content.js - Floating Chat UI & DOM Analysis

class AIWebGuide {
    constructor() {
        this.highlightedElement = null;
        this.highlightedTarget = null;
        this.highlightFollowRaf = null;
        this.lastHighlightRect = null;
        this.lastResolveAt = 0;
        this.highlightClickHandler = null;
        this.tooltip = null;
        this.overlay = null;
        this.wrongBtn = null;
        this.closeBtn = null;
        this.thinkingToast = null;
        this.thinkingOverlay = null;
        this.elementMap = new Map();

        // Floating Chat UI
        this.chatContainer = null;
        this.chatToggleBtn = null;
        this.isChatOpen = false;
        this.conversationHistory = [];
        this.currentCandidate = null;
        this.currentSearchKeyword = null;
        this.isWaitingForConfirmation = false;

        this.init();
    }

    init() {
        // Create floating UI
        this.createFloatingUI();

        // Listen for messages from background
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sendResponse);
            return true;
        });

        // Check for active session on page load
        this.checkSession();
    }

    // ===== Floating Chat UI =====

    createFloatingUI() {
        // Create toggle button
        this.chatToggleBtn = document.createElement('button');
        this.chatToggleBtn.className = 'ai-guide-toggle-btn';
        this.chatToggleBtn.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 6C13.66 6 15 7.34 15 9C15 10.66 13.66 12 12 12C10.34 12 9 10.66 9 9C9 7.34 10.34 6 12 6ZM12 19.2C9.5 19.2 7.29 17.92 6 15.98C6.03 13.99 10 12.9 12 12.9C13.99 12.9 17.97 13.99 18 15.98C16.71 17.92 14.5 19.2 12 19.2Z" fill="currentColor"/>
            </svg>
        `;
        this.chatToggleBtn.addEventListener('click', () => this.toggleChat());
        document.body.appendChild(this.chatToggleBtn);

        // Create chat container
        this.chatContainer = document.createElement('div');
        this.chatContainer.className = 'ai-guide-chat-container';
        this.chatContainer.innerHTML = `
            <div class="ai-guide-chat-header">
                <div class="ai-guide-chat-title">
                    <span class="ai-guide-chat-logo">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </span>
                    <span>따라온나</span>
                </div>
                <div class="ai-guide-chat-header-btns">
                    <button class="ai-guide-chat-reset-btn" title="대화 초기화">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path d="M23 4V10H17M1 20V14H7M3.51 9C4.02 7.57 4.88 6.29 6.02 5.28C7.16 4.27 8.55 3.56 10.05 3.22C11.56 2.88 13.13 2.92 14.64 3.33C16.14 3.74 17.52 4.52 18.65 5.58L23 10M1 14L5.35 18.42C6.48 19.48 7.86 20.26 9.36 20.67C10.87 21.08 12.44 21.12 13.95 20.78C15.45 20.44 16.84 19.73 17.98 18.72C19.12 17.71 19.98 16.43 20.49 15" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                    <button class="ai-guide-chat-close-btn" title="닫기">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                            <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="ai-guide-chat-messages">
                <div class="ai-guide-message ai-guide-message-ai">
                    <div class="ai-guide-message-avatar">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 6C13.66 6 15 7.34 15 9C15 10.66 13.66 12 12 12C10.34 12 9 10.66 9 9C9 7.34 10.34 6 12 6ZM12 19.2C9.5 19.2 7.29 17.92 6 15.98C6.03 13.99 10 12.9 12 12.9C13.99 12.9 17.97 13.99 18 15.98C16.71 17.92 14.5 19.2 12 19.2Z" fill="white"/>
                        </svg>
                    </div>
                    <div class="ai-guide-message-content">
                        <p>안녕하세요! 무엇을 도와드릴까요?</p>
                        <p class="ai-guide-message-hint">예: "주민등록등본 발급하고 싶어요"</p>
                    </div>
                </div>
            </div>
            <div class="ai-guide-chat-actions ai-guide-hidden">
                <button class="ai-guide-action-btn ai-guide-action-yes">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    네, 맞아요
                </button>
                <button class="ai-guide-action-btn ai-guide-action-no">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    아니에요
                </button>
            </div>
            <div class="ai-guide-chat-input-area">
                <div class="ai-guide-chat-input-wrapper">
                    <textarea class="ai-guide-chat-input" placeholder="무엇을 찾으시나요?" rows="1"></textarea>
                    <button class="ai-guide-chat-send-btn" title="보내기">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                            <path d="M22 2L11 13M22 2L15 22L11 13M11 13L2 9L22 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="ai-guide-chat-loading ai-guide-hidden">
                <div class="ai-guide-loading-dots"><span></span><span></span><span></span></div>
                <span>확인 중...</span>
            </div>
        `;
        document.body.appendChild(this.chatContainer);

        // Bind events
        this.bindChatEvents();

        // Load previous session
        this.loadSession();
    }

    bindChatEvents() {
        const closeBtn = this.chatContainer.querySelector('.ai-guide-chat-close-btn');
        const resetBtn = this.chatContainer.querySelector('.ai-guide-chat-reset-btn');
        const sendBtn = this.chatContainer.querySelector('.ai-guide-chat-send-btn');
        const input = this.chatContainer.querySelector('.ai-guide-chat-input');
        const yesBtn = this.chatContainer.querySelector('.ai-guide-action-yes');
        const noBtn = this.chatContainer.querySelector('.ai-guide-action-no');

        closeBtn.addEventListener('click', () => this.toggleChat());
        resetBtn.addEventListener('click', () => this.handleReset());
        sendBtn.addEventListener('click', () => this.handleSend());

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSend();
            }
        });

        // Auto-resize textarea
        input.addEventListener('input', () => {
            input.style.height = 'auto';
            input.style.height = Math.min(input.scrollHeight, 80) + 'px';
        });

        yesBtn.addEventListener('click', () => this.handleConfirmYes());
        noBtn.addEventListener('click', () => this.handleConfirmNo());

        // Background auto-guidance updates
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            if (message.type === 'AUTO_GUIDANCE' && message.response) {
                this.showActionButtons(false);
                this.handleAIResponse(message.response, { suppressActions: true });
                sendResponse({ success: true });
            }
        });
    }

    toggleChat() {
        this.isChatOpen = !this.isChatOpen;
        this.chatContainer.classList.toggle('ai-guide-chat-open', this.isChatOpen);
        this.chatToggleBtn.classList.toggle('ai-guide-toggle-active', this.isChatOpen);

        if (this.isChatOpen) {
            const input = this.chatContainer.querySelector('.ai-guide-chat-input');
            setTimeout(() => input.focus(), 100);
        }
    }

    hideChatUI() {
        // Hide chat container and toggle button during highlight
        if (this.chatContainer) {
            this.chatContainer.classList.add('ai-guide-chat-hidden');
        }
        if (this.chatToggleBtn) {
            this.chatToggleBtn.classList.add('ai-guide-chat-hidden');
        }
    }

    showChatUI() {
        // Show chat container and toggle button after highlight is cleared
        if (this.chatContainer) {
            this.chatContainer.classList.remove('ai-guide-chat-hidden');
        }
        if (this.chatToggleBtn) {
            this.chatToggleBtn.classList.remove('ai-guide-chat-hidden');
        }
    }

    addMessage(content, isUser = false, extras = {}) {
        const messagesArea = this.chatContainer.querySelector('.ai-guide-chat-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `ai-guide-message ${isUser ? 'ai-guide-message-user' : 'ai-guide-message-ai'}`;

        let html = '';
        if (!isUser) {
            html += `
                <div class="ai-guide-message-avatar">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                        <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 6C13.66 6 15 7.34 15 9C15 10.66 13.66 12 12 12C10.34 12 9 10.66 9 9C9 7.34 10.34 6 12 6ZM12 19.2C9.5 19.2 7.29 17.92 6 15.98C6.03 13.99 10 12.9 12 12.9C13.99 12.9 17.97 13.99 18 15.98C16.71 17.92 14.5 19.2 12 19.2Z" fill="white"/>
                    </svg>
                </div>
            `;
        }

        html += '<div class="ai-guide-message-content">';
        if (typeof content === 'string') {
            html += `<p>${this.escapeHtml(content)}</p>`;
        } else if (Array.isArray(content)) {
            content.forEach(text => {
                html += `<p>${this.escapeHtml(text)}</p>`;
            });
        }

        if (extras.highlight) {
            html += `<span class="ai-guide-message-highlight">📍 ${this.escapeHtml(extras.highlight)}</span>`;
        }
        if (extras.searchKeyword) {
            html += `<span class="ai-guide-message-keyword">🔍 검색어: ${this.escapeHtml(extras.searchKeyword)}</span>`;
        }

        html += '</div>';
        messageDiv.innerHTML = html;
        messagesArea.appendChild(messageDiv);
        messagesArea.scrollTop = messagesArea.scrollHeight;

        this.conversationHistory.push({
            role: isUser ? 'user' : 'assistant',
            content: typeof content === 'string' ? content : content.join(' '),
            extras
        });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showLoading(show) {
        const loading = this.chatContainer.querySelector('.ai-guide-chat-loading');
        const sendBtn = this.chatContainer.querySelector('.ai-guide-chat-send-btn');
        loading.classList.toggle('ai-guide-hidden', !show);
        sendBtn.disabled = show;
    }

    showActionButtons(show) {
        const actions = this.chatContainer.querySelector('.ai-guide-chat-actions');
        actions.classList.toggle('ai-guide-hidden', !show);
        this.isWaitingForConfirmation = show;
    }

    async handleSend() {
        const input = this.chatContainer.querySelector('.ai-guide-chat-input');
        const text = input.value.trim();
        if (!text) return;

        input.value = '';
        input.style.height = 'auto';
        this.addMessage(text, true);
        this.showActionButtons(false);
        this.showLoading(true);

        try {
            const response = await chrome.runtime.sendMessage({
                type: 'CHAT_MESSAGE',
                message: text,
                history: this.conversationHistory
            });

            this.showLoading(false);
            this.handleAIResponse(response);
        } catch (error) {
            this.showLoading(false);
            this.addMessage('죄송해요, 오류가 발생했어요. 다시 시도해 주세요.');
            console.error('Chat error:', error);
        }
    }

    handleAIResponse(response, options = {}) {
        if (!response.success) {
            this.addMessage(response.error || '죄송해요, 문제가 발생했어요.');
            return;
        }

        const { suppressActions = false } = options;
        const { status, message, target, searchKeyword } = response;

        const extras = {};
        if (target && target.text) {
            extras.highlight = target.text;
        }
        if (searchKeyword) {
            extras.searchKeyword = searchKeyword;
        }

        this.addMessage(message, false, extras);

        switch (status) {
            case 'GOAL_REACHED':
            case 'NAVIGATING':
                this.currentCandidate = target;
                this.currentSearchKeyword = null;
                if (!suppressActions) {
                    this.showActionButtons(true);
                }
                break;

            case 'USE_SEARCH':
                this.currentCandidate = target;
                this.currentSearchKeyword = searchKeyword;
                if (target && !suppressActions) {
                    this.showActionButtons(true);
                }
                break;

            case 'NEED_MORE_INFO':
            case 'NOT_FOUND':
                const input = this.chatContainer.querySelector('.ai-guide-chat-input');
                input.focus();
                break;
        }
    }

    async handleConfirmYes() {
        this.showActionButtons(false);

        if (!this.currentCandidate) {
            this.addMessage('표시할 요소를 찾지 못했어요.');
            return;
        }

        this.addMessage('네, 맞아요', true);

        try {
            if (this.currentSearchKeyword && this.currentCandidate.isSearchInput) {
                const fillResult = this.fillSearchInput(this.currentCandidate.id, this.currentSearchKeyword);

                if (fillResult.success) {
                    this.addMessage([
                        `검색창에 '${this.currentSearchKeyword}'를 입력했어요! 🔍`,
                        '이제 검색 버튼을 클릭해 주세요.'
                    ]);

                    if (fillResult.searchButton) {
                        this.highlightElement(fillResult.searchButton, '여기를 클릭하세요');
                    }
                } else {
                    this.addMessage('검색창을 찾을 수 없어요.');
                }
                return;
            }

            const success = this.highlightElement(this.currentCandidate, '여기를 클릭하세요');

            if (success) {
                this.addMessage([
                    '화면에 표시해 드렸어요! 👆',
                    '주황색으로 표시된 곳을 클릭해 주세요.'
                ]);
            } else {
                this.addMessage('요소를 찾을 수 없어요. 페이지가 변경되었을 수 있습니다.');
            }
        } catch (error) {
            this.addMessage('오류가 발생했어요.');
            console.error('Highlight error:', error);
        }
    }

    async handleConfirmNo() {
        this.showActionButtons(false);
        this.addMessage('아니에요', true);
        this.clearHighlight();
        this.addMessage('그렇군요. 조금 더 자세히 말씀해 주시겠어요? 무엇을 찾고 계신지 다른 방식으로 설명해 주세요.');
        const input = this.chatContainer.querySelector('.ai-guide-chat-input');
        input.focus();
    }

    async handleReset() {
        const messagesArea = this.chatContainer.querySelector('.ai-guide-chat-messages');
        messagesArea.innerHTML = '';
        this.conversationHistory = [];
        this.currentCandidate = null;
        this.showActionButtons(false);

        await chrome.runtime.sendMessage({ type: 'CLEAR_SESSION' });
        this.clearHighlight();

        this.addMessage('안녕하세요! 무엇을 도와드릴까요?');

        const input = this.chatContainer.querySelector('.ai-guide-chat-input');
        input.focus();
    }

    async loadSession() {
        try {
            const response = await chrome.runtime.sendMessage({ type: 'GET_SESSION' });

            if (response.hasActiveSession && response.conversationHistory) {
                const messagesArea = this.chatContainer.querySelector('.ai-guide-chat-messages');
                messagesArea.innerHTML = '';

                response.conversationHistory.forEach(msg => {
                    this.addMessage(msg.content, msg.role === 'user', msg.extras || {});
                });
            }
        } catch (error) {
            console.log('No active session');
        }
    }

    handleMessage(message, sendResponse) {
        switch (message.type) {
            case 'GET_DOM_ELEMENTS':
                const elements = this.extractClickableElements();
                const searchInputs = this.extractSearchInputs();
                sendResponse({ success: true, elements: elements, searchInputs: searchInputs });
                break;

            case 'HIGHLIGHT':
                this.highlightElement(message.target, message.tooltip);
                sendResponse({ success: true });
                break;

            case 'CLEAR_HIGHLIGHT':
                this.clearHighlight();
                sendResponse({ success: true });
                break;

            case 'PING':
                sendResponse({ success: true, ready: true });
                break;

            case 'SESSION_CONTINUE':
                this.handleSessionContinue(message.query);
                sendResponse({ success: true });
                break;

            case 'FILL_SEARCH':
                const fillResult = this.fillSearchInput(message.searchInputId, message.keyword);
                sendResponse(fillResult);
                break;

            case 'SHOW_THINKING':
                this.showThinkingToast(message.text);
                sendResponse({ success: true });
                break;

            case 'HIDE_THINKING':
                this.hideThinkingToast();
                sendResponse({ success: true });
                break;

            case 'TOGGLE_CHAT':
                this.toggleChat();
                sendResponse({ success: true });
                break;

            case 'AUTO_GUIDANCE':
                if (message.response) {
                    this.showActionButtons(false);
                    this.handleAIResponse(message.response, { suppressActions: true });
                }
                sendResponse({ success: true });
                break;

            default:
                sendResponse({ success: false, error: 'Unknown message type' });
        }
    }

    fillSearchInput(searchInputId, keyword) {
        console.log('검색창 자동 입력:', searchInputId, keyword);

        // Find the search input element
        let searchInput = this.elementMap.get(searchInputId);

        if (!searchInput) {
            // Try to find by re-extracting
            this.extractSearchInputs();
            searchInput = this.elementMap.get(searchInputId);
        }

        if (!searchInput) {
            console.error('검색창을 찾을 수 없음:', searchInputId);
            return { success: false, error: '검색창을 찾을 수 없어요.' };
        }

        // Fill in the keyword
        searchInput.value = keyword;
        searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        searchInput.dispatchEvent(new Event('change', { bubbles: true }));

        // Focus on the input
        searchInput.focus();

        // Find and highlight the search button
        const searchButton = this.findSearchButton(searchInput);

        return {
            success: true,
            searchButton: searchButton ? {
                id: 'search-btn',
                text: searchButton.innerText || '검색'
            } : null
        };
    }

    findSearchButton(searchInput) {
        // Look for search button near the input
        const parent = searchInput.closest('form') || searchInput.parentElement?.parentElement;

        if (parent) {
            // Find button or submit input
            const button = parent.querySelector('button[type="submit"], input[type="submit"], button:not([type]), .search-btn, [class*="search"]');
            if (button) {
                const id = 'search-btn';
                this.elementMap.set(id, button);
                return button;
            }
        }

        return null;
    }

    findSearchInputByTarget(target) {
        const placeholder = (target?.placeholder || '').toLowerCase().trim();
        const name = (target?.name || '').toLowerCase().trim();
        const inputs = document.querySelectorAll('input[type="search"], input[type="text"]');

        let fallback = null;
        inputs.forEach((input) => {
            const inputPlaceholder = (input.getAttribute('placeholder') || '').toLowerCase().trim();
            const inputName = (input.getAttribute('name') || '').toLowerCase().trim();

            if (placeholder && inputPlaceholder === placeholder) {
                fallback = input;
            } else if (name && inputName === name) {
                fallback = input;
            } else if (!fallback && placeholder && inputPlaceholder.includes(placeholder)) {
                fallback = input;
            }
        });

        return fallback;
    }

    isElementTextMatch(element, targetText) {
        if (!targetText) return true;
        const normalizedTarget = targetText.toLowerCase().trim();
        if (!normalizedTarget) return true;

        const elementText = this.getElementText(element).toLowerCase();
        if (!elementText) return false;

        return elementText.includes(normalizedTarget) || normalizedTarget.includes(elementText);
    }

    resolveTargetElement(target, refreshIfMissing = false) {
        if (!target) return null;

        const tryResolve = () => {
            let element = null;

            if (target.id && this.elementMap.has(target.id)) {
                const candidate = this.elementMap.get(target.id);
                if (candidate && this.isElementTextMatch(candidate, target.text)) {
                    element = candidate;
                }
            }

            if (!element && target.selector) {
                element = document.querySelector(target.selector);
            }

            if (
                !element &&
                (target.isSearchInput || target.type === 'search' || target.placeholder || target.name)
            ) {
                element = this.findSearchInputByTarget(target);
            }

            if (!element && target.text) {
                element = this.findElementByText(target.text);
            }

            return element;
        };

        let element = tryResolve();

        if (!element && refreshIfMissing) {
            this.extractClickableElements();
            this.extractSearchInputs();
            element = tryResolve();
        }

        return element;
    }

    async handleSessionContinue(query) {
        console.log('AI Web Guide: Continuing session on new page');

        // Wait for page to stabilize
        await new Promise(resolve => setTimeout(resolve, 500));

        // Re-extract elements for the new page
        this.extractClickableElements();

        // Check with background if we should highlight something
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'PAGE_NAVIGATED'
            });

            if (response && response.found && response.candidate) {
                // Show confirmation tooltip or directly highlight
                this.highlightElement(response.candidate, response.confirmationMessage || '여기를 클릭하세요');
            }
        } catch (error) {
            console.log('AI Web Guide: Error continuing session', error);
        }
    }

    extractClickableElements() {
        const selectors = [
            'button',
            'a[href]',
            'input[type="submit"]',
            'input[type="button"]',
            '[role="button"]',
            '[role="link"]',
            '[onclick]',
            '[tabindex="0"]',
            '.btn',
            '.button'
        ];

        const elements = document.querySelectorAll(selectors.join(', '));
        const elementData = [];
        this.elementMap.clear();

        let index = 0;
        elements.forEach((el) => {
            // Skip hidden or very small elements
            const rect = el.getBoundingClientRect();
            if (rect.width < 10 || rect.height < 10) return;

            const styles = window.getComputedStyle(el);
            if (styles.display === 'none' || styles.visibility === 'hidden' || styles.opacity === '0') return;

            const id = `ai-nav-${index}`;
            const text = this.getElementText(el);

            // Skip elements with no text
            if (!text) return;

            const data = {
                id: id,
                tag: el.tagName.toLowerCase(),
                text: text,
                type: this.getElementType(el),
                href: el.getAttribute('href') || '',
                ariaLabel: el.getAttribute('aria-label') || '',
                title: el.getAttribute('title') || '',
                className: el.className || '',
                rect: {
                    top: rect.top + window.scrollY,
                    left: rect.left + window.scrollX,
                    width: rect.width,
                    height: rect.height
                }
            };

            this.elementMap.set(id, el);
            elementData.push(data);
            index++;
        });

        return elementData;
    }

    extractSearchInputs() {
        const selectors = [
            'input[type="search"]',
            'input[type="text"][name*="search"]',
            'input[type="text"][id*="search"]',
            'input[type="text"][class*="search"]',
            'input[type="text"][placeholder*="검색"]',
            'input[type="text"][placeholder*="찾기"]',
            'input[type="text"][placeholder*="Search"]',
            'input[name="query"]',
            'input[name="q"]',
            'input[name="keyword"]'
        ];

        const inputs = document.querySelectorAll(selectors.join(', '));
        const searchInputData = [];

        let searchIndex = 0;
        inputs.forEach((el) => {
            const rect = el.getBoundingClientRect();
            if (rect.width < 50 || rect.height < 10) return;

            const styles = window.getComputedStyle(el);
            if (styles.display === 'none' || styles.visibility === 'hidden') return;

            const id = `search-${searchIndex}`;
            const data = {
                id: id,
                tag: 'input',
                type: 'search',
                placeholder: el.getAttribute('placeholder') || '검색',
                name: el.getAttribute('name') || '',
                rect: {
                    top: rect.top + window.scrollY,
                    left: rect.left + window.scrollX,
                    width: rect.width,
                    height: rect.height
                }
            };

            this.elementMap.set(id, el);
            searchInputData.push(data);
            searchIndex++;
        });

        return searchInputData;
    }

    getElementText(el) {
        // Try various sources for element text
        let text = el.innerText?.trim() ||
            el.textContent?.trim() ||
            el.getAttribute('aria-label') ||
            el.getAttribute('title') ||
            el.getAttribute('alt') ||
            el.getAttribute('placeholder') ||
            el.getAttribute('value') ||
            '';

        // Limit text length
        if (text.length > 100) {
            text = text.substring(0, 100) + '...';
        }

        return text;
    }

    getElementType(el) {
        const tag = el.tagName.toLowerCase();
        const role = el.getAttribute('role');
        const type = el.getAttribute('type');

        if (role) return role;
        if (tag === 'a') return 'link';
        if (tag === 'button') return 'button';
        if (tag === 'input') return type || 'input';
        return 'clickable';
    }

    highlightElement(target, tooltipText = '여기를 클릭하세요') {
        // Clear any existing highlight
        this.clearHighlight();
        this.hideThinkingToast();

        const element = this.resolveTargetElement(target, true);

        if (!element) {
            console.error('AI Web Guide: Element not found', target);
            return false;
        }

        // Store reference
        this.highlightedElement = element;
        this.highlightedTarget = target;
        this.lastHighlightRect = null;

        // Hide chat UI during highlight
        this.hideChatUI();

        // Scroll element into view
        this.scrollToElement(element);

        // Add overlay
        this.createOverlay();

        // Add highlight class
        element.classList.add('ai-guide-highlight-outline');

        // Create tooltip
        this.createTooltip(element, tooltipText);

        // Create wrong button
        this.createWrongButton();

        // Create close button
        this.createCloseButton();

        // Clear highlight on user click once
        this.registerHighlightClickHandler();

        // Start following the component in real time
        this.startHighlightTracking();

        // Notify background that element is highlighted
        chrome.runtime.sendMessage({
            type: 'ELEMENT_HIGHLIGHTED',
            target: target
        });

        return true;
    }

    registerHighlightClickHandler() {
        if (this.highlightClickHandler) {
            document.removeEventListener('click', this.highlightClickHandler, true);
        }

        this.highlightClickHandler = (event) => {
            const element = this.highlightedElement;
            if (!element) return;
            if (element.contains(event.target)) {
                this.clearHighlight();
                chrome.runtime.sendMessage({ type: 'CLEAR_HIGHLIGHT' });
            }
        };

        document.addEventListener('click', this.highlightClickHandler, true);
    }

    findElementByText(text) {
        if (!text) return null;

        const normalizedText = text.toLowerCase().trim();

        for (const [id, el] of this.elementMap) {
            const elText = this.getElementText(el).toLowerCase();
            if (elText.includes(normalizedText) || normalizedText.includes(elText)) {
                return el;
            }
        }

        return null;
    }

    showThinkingToast(text = '잠시만 기다려 주세요. 생각 중이에요...') {
        if (!this.thinkingToast) {
            this.thinkingToast = document.createElement('div');
            this.thinkingToast.className = 'ai-guide-thinking-toast';
            document.body.appendChild(this.thinkingToast);
        }

        if (!this.thinkingOverlay) {
            this.thinkingOverlay = document.createElement('div');
            this.thinkingOverlay.className = 'ai-guide-thinking-overlay';
            document.body.appendChild(this.thinkingOverlay);
        }

        this.thinkingToast.textContent = text;
    }

    hideThinkingToast() {
        if (this.thinkingOverlay) {
            this.thinkingOverlay.remove();
            this.thinkingOverlay = null;
        }
        if (this.thinkingToast) {
            this.thinkingToast.remove();
            this.thinkingToast = null;
        }
    }

    startHighlightTracking() {
        this.stopHighlightTracking();

        const track = () => {
            if (!this.highlightedTarget) {
                this.highlightFollowRaf = null;
                return;
            }

            let element = this.highlightedElement;
            if (!element || !element.isConnected) {
                const now = Date.now();
                if (!this.lastResolveAt || now - this.lastResolveAt > 500) {
                    this.lastResolveAt = now;
                    const resolved = this.resolveTargetElement(this.highlightedTarget, true);
                    if (resolved && resolved !== this.highlightedElement) {
                        if (this.highlightedElement && this.highlightedElement.isConnected) {
                            this.highlightedElement.classList.remove('ai-guide-highlight-outline');
                        }
                        this.highlightedElement = resolved;
                        resolved.classList.add('ai-guide-highlight-outline');
                    } else if (!resolved) {
                        this.highlightedElement = null;
                    }
                }
                element = this.highlightedElement;
            }

            if (element && element.isConnected) {
                const rect = element.getBoundingClientRect();
                const last = this.lastHighlightRect;
                const moved = !last ||
                    rect.top !== last.top ||
                    rect.left !== last.left ||
                    rect.width !== last.width ||
                    rect.height !== last.height;

                if (moved) {
                    this.lastHighlightRect = {
                        top: rect.top,
                        left: rect.left,
                        width: rect.width,
                        height: rect.height
                    };
                    if (this.tooltip) {
                        this.positionTooltip(element);
                    }
                }
            }

            this.highlightFollowRaf = requestAnimationFrame(track);
        };

        this.highlightFollowRaf = requestAnimationFrame(track);
    }

    stopHighlightTracking() {
        if (this.highlightFollowRaf) {
            cancelAnimationFrame(this.highlightFollowRaf);
            this.highlightFollowRaf = null;
        }
        this.lastHighlightRect = null;
        this.lastResolveAt = 0;
    }

    scrollToElement(element) {
        const rect = element.getBoundingClientRect();
        const isInViewport = (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );

        if (!isInViewport) {
            element.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'center'
            });
        }
    }

    createOverlay() {
        this.overlay = document.createElement('div');
        this.overlay.className = 'ai-guide-overlay';
        document.body.appendChild(this.overlay);
    }

    createTooltip(element, text) {
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'ai-guide-tooltip';

        this.tooltip.innerHTML = `
      <span class="ai-guide-tooltip-icon">👆</span>
      <span class="ai-guide-tooltip-text">${text}</span>
      <span class="ai-guide-tooltip-subtext">노란색으로 표시된 곳을 클릭하세요</span>
    `;

        document.body.appendChild(this.tooltip);

        // Position tooltip
        this.positionTooltip(element);

        // Reposition on scroll/resize
        this.repositionHandler = () => this.positionTooltip(this.highlightedElement || element);
        window.addEventListener('scroll', this.repositionHandler);
        window.addEventListener('resize', this.repositionHandler);
    }

    positionTooltip(element) {
        if (!this.tooltip || !element) return;

        const rect = element.getBoundingClientRect();
        const tooltipRect = this.tooltip.getBoundingClientRect();

        // Default: position above element
        let top = rect.top - tooltipRect.height - 20;
        let left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);

        // If not enough space above, position below
        if (top < 10) {
            top = rect.bottom + 20;
            this.tooltip.classList.remove('tooltip-top');
            this.tooltip.classList.add('tooltip-bottom');
        } else {
            this.tooltip.classList.add('tooltip-top');
            this.tooltip.classList.remove('tooltip-bottom');
        }

        // Keep within viewport horizontally
        if (left < 10) left = 10;
        if (left + tooltipRect.width > window.innerWidth - 10) {
            left = window.innerWidth - tooltipRect.width - 10;
        }

        this.tooltip.style.top = `${top}px`;
        this.tooltip.style.left = `${left}px`;
    }

    createWrongButton() {
        this.wrongBtn = document.createElement('button');
        this.wrongBtn.className = 'ai-guide-wrong-btn';
        this.wrongBtn.innerHTML = '🔄 이게 아니에요';

        this.wrongBtn.addEventListener('click', () => {
            chrome.runtime.sendMessage({ type: 'WRONG_ELEMENT' });
        });

        document.body.appendChild(this.wrongBtn);
    }

    createCloseButton() {
        this.closeBtn = document.createElement('button');
        this.closeBtn.className = 'ai-guide-close-btn';
        this.closeBtn.innerHTML = '✕';
        this.closeBtn.title = '닫기';

        this.closeBtn.addEventListener('click', () => {
            this.clearHighlight();
            chrome.runtime.sendMessage({ type: 'CLEAR_SESSION' });
        });

        document.body.appendChild(this.closeBtn);
    }

    clearHighlight() {
        this.stopHighlightTracking();
        this.highlightedTarget = null;

        // Remove highlight class
        if (this.highlightedElement) {
            this.highlightedElement.classList.remove('ai-guide-highlight-outline');
            this.highlightedElement = null;
        }

        // Remove tooltip
        if (this.tooltip) {
            this.tooltip.remove();
            this.tooltip = null;
        }

        // Remove overlay
        if (this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }

        // Remove wrong button
        if (this.wrongBtn) {
            this.wrongBtn.remove();
            this.wrongBtn = null;
        }

        // Remove close button
        if (this.closeBtn) {
            this.closeBtn.remove();
            this.closeBtn = null;
        }

        // Remove event listeners
        if (this.highlightClickHandler) {
            document.removeEventListener('click', this.highlightClickHandler, true);
            this.highlightClickHandler = null;
        }
        if (this.repositionHandler) {
            window.removeEventListener('scroll', this.repositionHandler);
            window.removeEventListener('resize', this.repositionHandler);
            this.repositionHandler = null;
        }

        // Show chat UI again after highlight is cleared
        this.showChatUI();
    }

    async checkSession() {
        try {
            // Page 이동 시 자동 하이라이트는 하지 않음 (AI 판단 이후에만 처리)
            await chrome.runtime.sendMessage({ type: 'CHECK_SESSION_FOR_PAGE' });
        } catch (error) {
            // No active session, that's fine
            console.log('AI Web Guide: No active session');
        }
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new AIWebGuide());
} else {
    new AIWebGuide();
}
