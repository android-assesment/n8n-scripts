// IIFE (Immediately Invoked Function Expression) ka upyog, global scope ko pollute hone se bachane ke liye
(function() {
    // Jab tak document poori tarah load na ho jaye, tab tak intezaar karein
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeChat);
    } else {
        initializeChat();
    }

    function initializeChat() {
        class N8NChatEmbed {
            constructor() {
                this.config = this.getConfig();
                if (!this.config.hostname) {
                    console.error("N8N Chat Error: 'data-hostname' attribute script tag mein zaroori hai.");
                    return;
                }

                // Session ID ko session storage se lein ya naya banayein
                this.sessionId = sessionStorage.getItem('n8n-chat-session-id') || this.generateUUID();
                sessionStorage.setItem('n8n-chat-session-id', this.sessionId);

                this.isChatOpen = false;
                this.elements = {}; // UI elements ko store karne ke liye

                this.createUI();
                this.injectCSS();
                this.addEventListeners();
            }

            // Script tag se configuration ko padhein
            getConfig() {
                // Sabse pehle us script tag ko dhoondhein jismein 'data-hostname' attribute hai.
                // Yeh sabse aasaan tarika hai.
                const scriptTag = document.querySelector('script[data-hostname]');
                if (!scriptTag) {
                    console.error("N8N Chat Error: Script tag mein 'data-hostname' attribute nahi mil raha hai.");
                    return {}; // Khaali config return karein
                }

                return {
                    hostname: scriptTag.dataset.hostname,
                    label: scriptTag.dataset.label || 'Chat Karein',
                    placeholder: scriptTag.dataset.placeholder || 'Apna sandesh likhein...',
                    primaryColor: scriptTag.dataset.primaryColor || '#3b82f6',
                    textColor: scriptTag.dataset.textColor || '#ffffff',
                    botMessageColor: scriptTag.dataset.botMessageColor || '#f1f5f9',
                    botMessageTextColor: scriptTag.dataset.botMessageTextColor || '#1e293b',
                    initialMessage: scriptTag.dataset.initialMessage || 'Salaam! Main aapki kaise madad kar sakta hoon?',
                };
            }

            // Chat ka poora UI banayein
            createUI() {
                // Ek container banayein aur usmein shadow DOM attach karein
                const shadowHost = document.createElement('div');
                shadowHost.id = 'n8n-chat-widget-host';
                document.body.appendChild(shadowHost);
                const shadowRoot = shadowHost.attachShadow({ mode: 'open' });

                // Main container
                this.elements.container = document.createElement('div');
                this.elements.container.className = 'n8n-chat-container';
                shadowRoot.appendChild(this.elements.container);

                // Chat bubble (button)
                this.elements.bubble = document.createElement('button');
                this.elements.bubble.className = 'n8n-chat-bubble';
                this.elements.bubble.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                `;
                this.elements.container.appendChild(this.elements.bubble);

                // Chat window
                this.elements.window = document.createElement('div');
                this.elements.window.className = 'n8n-chat-window';
                this.elements.container.appendChild(this.elements.window);

                // Header
                const header = document.createElement('div');
                header.className = 'n8n-chat-header';
                header.innerHTML = `
                    <span>${this.config.label}</span>
                    <button class="n8n-close-button">&times;</button>
                `;
                this.elements.window.appendChild(header);

                // Messages area
                this.elements.messages = document.createElement('div');
                this.elements.messages.className = 'n8n-chat-messages';
                this.elements.window.appendChild(this.elements.messages);

                // Input form
                const form = document.createElement('form');
                form.className = 'n8n-chat-form';
                form.innerHTML = `
                    <input type="text" placeholder="${this.config.placeholder}" autocomplete="off">
                    <button type="submit">
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                    </button>
                `;
                this.elements.window.appendChild(form);

                this.elements.form = form;
                this.elements.input = form.querySelector('input');
                this.elements.closeButton = header.querySelector('.n8n-close-button');

                // Initial bot message
                this.addMessage(this.config.initialMessage, 'bot');
            }

            // CSS styles ko shadow DOM mein inject karein
            injectCSS() {
                const style = document.createElement('style');
                style.textContent = `
                    :host {
                        --primary-color: ${this.config.primaryColor};
                        --text-color: ${this.config.textColor};
                        --bot-message-color: ${this.config.botMessageColor};
                        --bot-message-text-color: ${this.config.botMessageTextColor};
                    }
                    .n8n-chat-container {
                        position: fixed;
                        bottom: 20px;
                        right: 20px;
                        z-index: 9999;
                    }
                    .n8n-chat-bubble {
                        background-color: var(--primary-color);
                        color: var(--text-color);
                        border: none;
                        width: 60px;
                        height: 60px;
                        border-radius: 50%;
                        cursor: pointer;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                        transition: transform 0.2s ease-in-out;
                    }
                    .n8n-chat-bubble:hover {
                        transform: scale(1.1);
                    }
                    .n8n-chat-window {
                        width: 350px;
                        height: 500px;
                        max-height: 80vh;
                        border-radius: 12px;
                        box-shadow: 0 8px 24px rgba(0,0,0,0.2);
                        overflow: hidden;
                        display: flex;
                        flex-direction: column;
                        background-color: white;
                        transform: scale(0.8) translateY(20px);
                        opacity: 0;
                        transition: transform 0.3s ease-out, opacity 0.3s ease-out;
                        transform-origin: bottom right;
                        visibility: hidden;
                    }
                    .n8n-chat-window.open {
                        visibility: visible;
                        opacity: 1;
                        transform: scale(1) translateY(0);
                    }
                    .n8n-chat-header {
                        background-color: var(--primary-color);
                        color: var(--text-color);
                        padding: 12px 16px;
                        font-weight: bold;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                    }
                    .n8n-close-button {
                        background: none;
                        border: none;
                        color: var(--text-color);
                        font-size: 24px;
                        cursor: pointer;
                        opacity: 0.8;
                    }
                    .n8n-close-button:hover {
                        opacity: 1;
                    }
                    .n8n-chat-messages {
                        flex-grow: 1;
                        padding: 16px;
                        overflow-y: auto;
                    }
                    .message {
                        margin-bottom: 12px;
                        max-width: 80%;
                        padding: 10px 14px;
                        border-radius: 18px;
                        line-height: 1.4;
                        word-wrap: break-word;
                    }
                    .user-message {
                        background-color: var(--primary-color);
                        color: var(--text-color);
                        border-bottom-right-radius: 4px;
                        margin-left: auto;
                    }
                    .bot-message {
                        background-color: var(--bot-message-color);
                        color: var(--bot-message-text-color);
                        border-bottom-left-radius: 4px;
                        margin-right: auto;
                    }
                    .typing-indicator {
                        display: flex;
                        align-items: center;
                    }
                    .typing-indicator span {
                        height: 8px;
                        width: 8px;
                        margin: 0 2px;
                        background-color: #9ca3af;
                        border-radius: 50%;
                        display: inline-block;
                        animation: bounce 1.4s infinite ease-in-out both;
                    }
                    .typing-indicator span:nth-of-type(1) { animation-delay: -0.32s; }
                    .typing-indicator span:nth-of-type(2) { animation-delay: -0.16s; }
                    @keyframes bounce { 0%, 80%, 100% { transform: scale(0); } 40% { transform: scale(1.0); } }
                    .n8n-chat-form {
                        display: flex;
                        padding: 10px;
                        border-top: 1px solid #e5e7eb;
                    }
                    .n8n-chat-form input {
                        flex-grow: 1;
                        border: none;
                        padding: 8px;
                        font-size: 14px;
                        outline: none;
                    }
                    .n8n-chat-form button {
                        background: none;
                        border: none;
                        cursor: pointer;
                        color: var(--primary-color);
                        padding: 8px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                    }
                    @media (max-width: 400px) {
                        .n8n-chat-window {
                            width: 100%;
                            height: 100%;
                            max-height: 100%;
                            position: fixed;
                            top: 0;
                            left: 0;
                            right: 0;
                            bottom: 0;
                            border-radius: 0;
                        }
                    }
                `;
                this.elements.container.parentNode.appendChild(style); // Append to shadow root
            }

            // Sabhi event listeners ko jodein
            addEventListeners() {
                this.elements.bubble.addEventListener('click', () => this.toggleChat());
                this.elements.closeButton.addEventListener('click', () => this.toggleChat());
                this.elements.form.addEventListener('submit', (e) => this.handleFormSubmit(e));
            }

            // Chat ko kholein ya band karein
            toggleChat() {
                this.isChatOpen = !this.isChatOpen;
                this.elements.window.classList.toggle('open');
                if (this.isChatOpen) {
                    this.elements.input.focus();
                }
            }

            // Form submit hone par message bhejein
            async handleFormSubmit(event) {
                event.preventDefault();
                const userMessage = this.elements.input.value.trim();
                if (!userMessage) return;

                this.addMessage(userMessage, 'user');
                this.elements.input.value = '';
                this.showTypingIndicator();

                try {
                    const response = await fetch(this.config.hostname, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            chatInput: userMessage,
                            sessionId: this.sessionId
                        }),
                    });

                    if (!response.ok) {
                        throw new Error(`Server Error: ${response.status}`);
                    }
                    
                    const data = await response.json();
                    const botReply = data.output || 'Maaf kijiye, kuch galat ho gaya.';
                    
                    this.hideTypingIndicator();
                    this.addMessage(botReply, 'bot');

                } catch (error) {
                    console.error("N8N Chat Error:", error);
                    this.hideTypingIndicator();
                    this.addMessage('Maaf kijiye, server se connect nahi ho pa raha hoon.', 'bot');
                }
            }

            // Chat window mein naya message jodein
            addMessage(text, sender) {
                const messageElement = document.createElement('div');
                messageElement.className = `message ${sender}-message`;
                messageElement.textContent = text;
                this.elements.messages.appendChild(messageElement);
                this.elements.messages.scrollTop = this.elements.messages.scrollHeight;
            }

            // Typing indicator dikhayein
            showTypingIndicator() {
                const indicator = document.createElement('div');
                indicator.className = 'message bot-message typing-indicator';
                indicator.id = 'typing-indicator';
                indicator.innerHTML = '<span></span><span></span><span></span>';
                this.elements.messages.appendChild(indicator);
                this.elements.messages.scrollTop = this.elements.messages.scrollHeight;
            }

            // Typing indicator hatayein
            hideTypingIndicator() {
                const indicator = this.elements.messages.querySelector('#typing-indicator');
                if (indicator) {
                    indicator.remove();
                }
            }
            
            // Unique ID generate karein
            generateUUID() {
                return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
                    return v.toString(16);
                });
            }
        }

        // Chat ko initialize karein
        new N8NChatEmbed();
    }
})();

