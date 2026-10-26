// DOM Elements
const app = document.getElementById('app');
const chatContainer = document.getElementById('chat-container');
const chatHistory = document.getElementById('chat-history');
const welcomeMsg = document.getElementById('welcome-message');
const welcomeTitle = document.getElementById('welcome-title');
const welcomeSubtitle = document.getElementById('welcome-subtitle');
const suggestionsContainer = document.getElementById('suggestions-container');

// Chat Input Form, Blocks & Slots
const chatInputBlock = document.getElementById('chat-input-block');
const chatInputForm = document.getElementById('chat-input-form');
const centerInputSlot = document.getElementById('center-input-slot');
const bottomInputSlot = document.getElementById('bottom-input-slot');
const bottomInputArea = document.getElementById('bottom-input-area');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');

// Disclaimer Elements
const permanentDisclaimer = document.getElementById('permanent-disclaimer');
const disclaimerBackdrop = document.getElementById('disclaimer-backdrop');
const btnGotIt = document.getElementById('btn-got-it');

// Conversation State
let isChatActive = false;

// ==============================================================
// Placement Management: Desktop Centered vs Bottom Docked
// ==============================================================
function updateInputPlacement() {
    const isDesktop = window.innerWidth > 768;
    
    if (isChatActive) {
        app.classList.remove('state-initial');
        app.classList.add('state-chat-active');
    } else {
        app.classList.remove('state-chat-active');
        app.classList.add('state-initial');
    }

    if (isDesktop && !isChatActive) {
        if (centerInputSlot && chatInputBlock && chatInputBlock.parentElement !== centerInputSlot) {
            centerInputSlot.appendChild(chatInputBlock);
        }
    } else {
        if (bottomInputSlot && chatInputBlock && chatInputBlock.parentElement !== bottomInputSlot) {
            bottomInputSlot.appendChild(chatInputBlock);
        }
    }

    // Disclaimer only visible once conversation starts
    if (permanentDisclaimer) {
        permanentDisclaimer.style.display = isChatActive ? 'block' : 'none';
    }

    updatePlaceholder();
}

function updatePlaceholder() {
    if (chatInput) {
        chatInput.placeholder = isChatActive ? "Reply..." : "Ask mutual fund assistant...";
    }
}

updateInputPlacement();
window.addEventListener('resize', updateInputPlacement);

// ==============================================================
// Auto-expanding Multi-line Textarea (Like ChatGPT)
// ==============================================================
function autoResizeTextarea() {
    chatInput.style.height = 'auto';
    const newHeight = Math.min(chatInput.scrollHeight, 160);
    chatInput.style.height = `${Math.max(newHeight, 24)}px`;
    chatInput.style.overflowY = chatInput.scrollHeight > 160 ? 'auto' : 'hidden';
    if (chatInputForm) {
        chatInputForm.classList.toggle('is-multiline', newHeight > 30);
    }
}

// Initial sizing on load
autoResizeTextarea();

chatInput.addEventListener('input', () => {
    autoResizeTextarea();
    updateSendButtonState();
});

// Keydown handler: Enter to send, Shift+Enter for new line
chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (!sendBtn.disabled) {
            sendMessage();
        }
    }
});

// ==============================================================
// Handoff AI Dynamic Welcome & Curated Questions with Icons
// ==============================================================
const welcomeGreetings = [
    "How can I help you?",
    "How can I assist you today?",
    "What would you like to explore?",
    "Ask about Axis Mutual Funds",
    "Welcome to Mutual Fund Assistant"
];

const welcomeSubtitles = [
    "What's on your mind today?",
    "What would you like to explore today?",
    "How can I assist your mutual fund journey?",
    "Ask any question about official Axis MF schemes.",
    "Looking for scheme facts or regulatory guidelines?",
    "What scheme information are you curious about today?"
];

// Curated pool of verified Axis Mutual Fund questions with contextual Material Symbols
const questionPool = [
    { text: "How to download capital gains statement?", icon: "bookmark" },
    { text: "What is exit load and why it's important?", icon: "trending_up" },
    { text: "What is minimum lock-in for ELSS?", icon: "lock_clock" },
    { text: "What is the benchmark for Axis Large Cap Fund?", icon: "bar_chart" },
    { text: "What are the six riskometer levels defined by SEBI?", icon: "speed" },
    { text: "What is the asset allocation for Axis Flexi Cap Fund?", icon: "pie_chart" },
    { text: "What is the exit load structure for Axis Liquid Fund?", icon: "water_drop" },
    { text: "Can an ELSS fund be redeemed before 3 years?", icon: "schedule" },
    { text: "Who are the fund managers of Axis Small Cap Fund?", icon: "badge" },
    { text: "Where can I check the official Total Expense Ratio (TER)?", icon: "analytics" },
    { text: "What are the tax benefits under Section 80C for ELSS?", icon: "savings" },
    { text: "What is the minimum SIP amount for Axis Large Cap Fund?", icon: "payments" },
    { text: "What is the investment objective of Axis Bluechip Fund?", icon: "flag" },
    { text: "How does a Systematic Withdrawal Plan (SWP) work?", icon: "currency_exchange" },
    { text: "What is NAV and how often is it calculated?", icon: "calculate" },
    { text: "What is the portfolio turnover ratio of Axis Midcap Fund?", icon: "sync" },
    { text: "What is the minimum lump sum for Axis Growth Opportunities Fund?", icon: "account_balance_wallet" },
    { text: "How is capital gains tax calculated on equity mutual funds?", icon: "receipt_long" }
];

// Fisher-Yates uniform random shuffle to select 3 distinct new questions on every refresh
function getRandomSuggestions(count = 3) {
    const pool = [...questionPool];
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, count);
}

function initRandomWelcome() {
    if (welcomeTitle) {
        welcomeTitle.textContent = welcomeGreetings[Math.floor(Math.random() * welcomeGreetings.length)];
    }

    if (welcomeSubtitle) {
        welcomeSubtitle.textContent = welcomeSubtitles[Math.floor(Math.random() * welcomeSubtitles.length)];
    }

    if (suggestionsContainer) {
        suggestionsContainer.innerHTML = '';
        // 3 Fresh, randomized valid questions on every refresh
        const selectedQuestions = getRandomSuggestions(3);

        selectedQuestions.forEach(item => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'suggestion-item';
            btn.setAttribute('aria-label', item.text);
            btn.innerHTML = `
                <span class="material-symbols-outlined suggestion-icon" aria-hidden="true">${item.icon}</span>
                <span class="suggestion-text">${item.text}</span>
                <span class="material-symbols-outlined suggestion-arrow" aria-hidden="true">chevron_right</span>
            `;
            btn.addEventListener('click', () => sendMessage(item.text));
            suggestionsContainer.appendChild(btn);
        });
    }
}

initRandomWelcome();

// ==============================================================
// Disclaimer Modal & Bottom Sheet Handlers
// ==============================================================
const DISCLAIMER_STORAGE_KEY = 'mfa_disclaimer_accepted_v3';

function openDisclaimer() {
    if (disclaimerBackdrop) {
        disclaimerBackdrop.classList.add('active');
        disclaimerBackdrop.setAttribute('aria-hidden', 'false');
    }
}
window.openDisclaimer = openDisclaimer;

function closeDisclaimer() {
    if (disclaimerBackdrop) {
        disclaimerBackdrop.classList.remove('active');
        disclaimerBackdrop.setAttribute('aria-hidden', 'true');
    }
    try {
        localStorage.setItem(DISCLAIMER_STORAGE_KEY, 'true');
    } catch (e) {
        // Fallback
    }
}

document.addEventListener('DOMContentLoaded', () => {
    try {
        const alreadyAccepted = localStorage.getItem(DISCLAIMER_STORAGE_KEY);
        if (!alreadyAccepted) {
            openDisclaimer();
        }
    } catch (e) {
        openDisclaimer();
    }
});

if (btnGotIt) {
    btnGotIt.addEventListener('click', closeDisclaimer);
}

if (disclaimerBackdrop) {
    disclaimerBackdrop.addEventListener('click', (e) => {
        if (e.target === disclaimerBackdrop) {
            closeDisclaimer();
        }
    });
}

window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && disclaimerBackdrop && disclaimerBackdrop.classList.contains('active')) {
        closeDisclaimer();
    }
});

// ==============================================================
// Mobile Keyboard & Blank-Screen Optimization
// ==============================================================
function setupMobileKeyboardHandler() {
    const forceNoWindowScroll = () => {
        if (window.scrollY !== 0 || window.scrollX !== 0) {
            window.scrollTo(0, 0);
        }
        if (document.documentElement.scrollTop !== 0) {
            document.documentElement.scrollTop = 0;
        }
        if (document.body.scrollTop !== 0) {
            document.body.scrollTop = 0;
        }
    };

    const scrollToLatestIfNeeded = () => {
        const hasMessages = document.querySelectorAll('.message').length > 0;
        if (hasMessages && chatContainer) {
            requestAnimationFrame(() => {
                chatContainer.scrollTop = chatContainer.scrollHeight;
            });
        }
    };

    if (window.visualViewport) {
        const handleViewportChange = () => {
            const vv = window.visualViewport;
            if (!vv || !app) return;

            app.style.height = `${vv.height}px`;
            app.style.top = `${vv.offsetTop}px`;

            forceNoWindowScroll();
            scrollToLatestIfNeeded();
        };

        window.visualViewport.addEventListener('resize', handleViewportChange);
        window.visualViewport.addEventListener('scroll', forceNoWindowScroll);
    }

    window.addEventListener('scroll', forceNoWindowScroll);

    chatInput.addEventListener('focus', () => {
        setTimeout(() => {
            forceNoWindowScroll();
            scrollToLatestIfNeeded();
        }, 120);
    });

    chatInput.addEventListener('blur', () => {
        setTimeout(() => {
            forceNoWindowScroll();
        }, 120);
    });
}

setupMobileKeyboardHandler();

// ==============================================================
// Input State & Chat Logic
// ==============================================================
function updateSendButtonState() {
    const text = (chatInput.value || '').trim();
    sendBtn.disabled = text.length === 0;
}

chatInput.addEventListener('input', updateSendButtonState);

function showTypingIndicator() {
    const typingBubble = document.createElement('div');
    typingBubble.className = 'typing-bubble';
    typingBubble.id = 'typing-indicator';
    typingBubble.innerHTML = `
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
        <div class="typing-dot"></div>
    `;
    chatHistory.appendChild(typingBubble);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    return typingBubble;
}

function hideTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) {
        indicator.remove();
    }
}

function formatResponse(text) {
    if (!text) return '';
    let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    formatted = formatted.replace(/^\* (.*$)/gim, '<li>$1</li>');
    formatted = formatted.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
    formatted = formatted.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer"><span class="material-symbols-outlined" style="font-size: 15px; vertical-align: middle;">open_in_new</span> <span>$1</span></a>');
    formatted = formatted.replace(/\n\n/g, '</p><p>');
    return `<p>${formatted}</p>`;
}

async function sendMessage(text) {
    const query = (text || chatInput.value || '').trim();
    if (!query) return;

    if (!isChatActive) {
        isChatActive = true;
        if (welcomeMsg) {
            welcomeMsg.style.display = 'none';
        }
        updateInputPlacement();
    }

    const userMsg = document.createElement('div');
    userMsg.className = 'message user';
    userMsg.textContent = query;
    chatHistory.appendChild(userMsg);

    chatInput.value = '';
    chatInput.style.height = '24px';
    chatInput.style.overflowY = 'hidden';
    if (chatInputForm) {
        chatInputForm.classList.remove('is-multiline');
    }
    updateSendButtonState();
    chatInput.disabled = true;
    sendBtn.disabled = true;

    chatContainer.scrollTop = chatContainer.scrollHeight;
    showTypingIndicator();

    try {
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: query })
        });

        if (!response.ok) {
            throw new Error(`HTTP error ${response.status}`);
        }

        const data = await response.json();
        hideTypingIndicator();

        const botMsg = document.createElement('div');
        botMsg.className = 'message bot';
        botMsg.innerHTML = formatResponse(data.reply);
        chatHistory.appendChild(botMsg);
    } catch (err) {
        hideTypingIndicator();
        const errorMsg = document.createElement('div');
        errorMsg.className = 'message bot';
        errorMsg.innerHTML = `<span style="color: #ef4444;">Unable to connect to assistant server. Please verify your connection.</span>`;
        chatHistory.appendChild(errorMsg);
    } finally {
        chatInput.disabled = false;
        updateSendButtonState();
        chatInput.focus();
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
}

chatInputForm.addEventListener('submit', (e) => {
    e.preventDefault();
    sendMessage();
});

sendBtn.addEventListener('click', () => {
    sendMessage();
});

