// popup.js - Conversational AI Chat Interface

class ChatController {
  constructor() {
    this.conversationHistory = [];
    this.currentCandidate = null;
    this.isWaitingForConfirmation = false;

    this.initElements();
    this.bindEvents();
    this.loadSession();
  }

  initElements() {
    this.chatArea = document.getElementById('chatArea');
    this.actionArea = document.getElementById('actionArea');
    this.userInput = document.getElementById('userInput');
    this.sendBtn = document.getElementById('sendBtn');
    this.resetBtn = document.getElementById('resetBtn');
    this.confirmYes = document.getElementById('confirmYes');
    this.confirmNo = document.getElementById('confirmNo');
    this.loadingIndicator = document.getElementById('loadingIndicator');
  }

  bindEvents() {
    // Send message
    this.sendBtn.addEventListener('click', () => this.handleSend());
    this.userInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });

    // Confirmation buttons
    this.confirmYes.addEventListener('click', () => this.handleConfirmYes());
    this.confirmNo.addEventListener('click', () => this.handleConfirmNo());

    // Reset
    this.resetBtn.addEventListener('click', () => this.handleReset());

    // Background auto-guidance updates
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'AUTO_GUIDANCE' && message.response) {
        this.showActionButtons(false);
        this.handleAIResponse(message.response, { suppressActions: true });
        sendResponse({ success: true });
      }
    });
  }

  // ===== Message Display =====

  addMessage(content, isUser = false, extras = {}) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${isUser ? 'user-message' : 'ai-message'}`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = isUser ? '👤' : '🤖';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    // Main message
    if (typeof content === 'string') {
      const p = document.createElement('p');
      p.textContent = content;
      contentDiv.appendChild(p);
    } else if (Array.isArray(content)) {
      content.forEach(text => {
        const p = document.createElement('p');
        p.textContent = text;
        contentDiv.appendChild(p);
      });
    }

    // Highlight badge (for target element)
    if (extras.highlight) {
      const badge = document.createElement('span');
      badge.className = 'message-highlight';
      badge.textContent = `📍 ${extras.highlight}`;
      contentDiv.appendChild(badge);
    }

    // Search keyword badge
    if (extras.searchKeyword) {
      const badge = document.createElement('span');
      badge.className = 'message-search-keyword';
      badge.textContent = `🔍 검색어: ${extras.searchKeyword}`;
      contentDiv.appendChild(badge);
    }

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(contentDiv);
    this.chatArea.appendChild(messageDiv);

    // Scroll to bottom
    this.chatArea.scrollTop = this.chatArea.scrollHeight;

    // Save to history
    this.conversationHistory.push({
      role: isUser ? 'user' : 'assistant',
      content: typeof content === 'string' ? content : content.join(' '),
      extras
    });
  }

  showLoading(show) {
    if (show) {
      this.loadingIndicator.classList.remove('hidden');
      this.sendBtn.disabled = true;
    } else {
      this.loadingIndicator.classList.add('hidden');
      this.sendBtn.disabled = false;
    }
  }

  showActionButtons(show) {
    if (show) {
      this.actionArea.classList.remove('hidden');
    } else {
      this.actionArea.classList.add('hidden');
    }
    this.isWaitingForConfirmation = show;
  }

  // ===== User Actions =====

  async handleSend() {
    const text = this.userInput.value.trim();
    if (!text) return;

    // Clear input
    this.userInput.value = '';

    // Add user message
    this.addMessage(text, true);

    // Hide action buttons if visible
    this.showActionButtons(false);

    // Show loading
    this.showLoading(true);

    try {
      // Send to background
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

    // Add AI message with extras
    const extras = {};
    if (target && target.text) {
      extras.highlight = target.text;
    }
    if (searchKeyword) {
      extras.searchKeyword = searchKeyword;
    }

    this.addMessage(message, false, extras);

    // Handle based on status
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
        this.currentSearchKeyword = searchKeyword;  // 검색어 저장
        if (target && !suppressActions) {
          this.showActionButtons(true);
        }
        break;

      case 'NEED_MORE_INFO':
        // Just wait for user input
        this.userInput.focus();
        break;

      case 'NOT_FOUND':
        // Suggest alternatives
        this.userInput.focus();
        break;
    }
  }

  async handleConfirmYes() {
    this.showActionButtons(false);

    if (!this.currentCandidate) {
      this.addMessage('표시할 요소를 찾지 못했어요.');
      return;
    }

    // Add user confirmation
    this.addMessage('네, 맞아요', true);

    try {
      // Check if this is a search action
      if (this.currentSearchKeyword && this.currentCandidate.isSearchInput) {
        // Auto-fill search input
        const fillResponse = await chrome.runtime.sendMessage({
          type: 'FILL_SEARCH',
          searchInputId: this.currentCandidate.id,
          keyword: this.currentSearchKeyword
        });

        if (fillResponse.success) {
          this.addMessage([
            `검색창에 '${this.currentSearchKeyword}'를 입력했어요! 🔍`,
            '이제 검색 버튼을 클릭해 주세요.'
          ]);

          // If search button found, highlight it
          if (fillResponse.searchButton) {
            await chrome.runtime.sendMessage({
              type: 'HIGHLIGHT_ELEMENT',
              target: fillResponse.searchButton
            });
          }
        } else {
          this.addMessage('검색창을 찾을 수 없어요.');
        }
        return;
      }

      // Regular highlight
      const response = await chrome.runtime.sendMessage({
        type: 'HIGHLIGHT_ELEMENT',
        target: this.currentCandidate
      });

      if (response.success) {
        this.addMessage([
          '화면에 표시해 드렸어요! 👆',
          '노란색으로 표시된 곳을 클릭해 주세요.'
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

    // Add user response
    this.addMessage('아니에요', true);

    // Clear highlight
    await chrome.runtime.sendMessage({ type: 'CLEAR_HIGHLIGHT' });

    // Ask for more info
    this.addMessage('그렇군요. 조금 더 자세히 말씀해 주시겠어요? 무엇을 찾고 계신지 다른 방식으로 설명해 주세요.');

    this.userInput.focus();
  }

  async handleReset() {
    // Clear UI
    this.chatArea.innerHTML = '';
    this.conversationHistory = [];
    this.currentCandidate = null;
    this.showActionButtons(false);

    // Clear session in background
    await chrome.runtime.sendMessage({ type: 'CLEAR_SESSION' });
    await chrome.runtime.sendMessage({ type: 'CLEAR_HIGHLIGHT' });

    // Add welcome message
    this.addMessage([
      '안녕하세요! 무엇을 도와드릴까요?',
    ], false, {});

    this.userInput.focus();
  }

  async loadSession() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_SESSION' });

      if (response.hasActiveSession && response.conversationHistory) {
        // Restore conversation
        response.conversationHistory.forEach(msg => {
          this.addMessage(msg.content, msg.role === 'user', msg.extras || {});
        });
      }
    } catch (error) {
      console.log('No active session');
    }
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  new ChatController();
});
