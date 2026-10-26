/**
 * Voice Input Manager for Mutual Fund Assistant
 * Implements real-time speech recognition (Web Speech API)
 * with live real-time transcription directly into the prompt window (textarea)
 * and an Apple Intelligence-style subtle ambient card edge aura.
 * Dynamically adapts between English and Hindi on the fly without any manual button.
 */

export class VoiceInputManager {
    constructor({
        micBtn,
        micBtnIcon,
        inputForm,
        chatInput,
        sendBtn,
        normalToolsLeft,
        voiceStatusLeft,
        voiceCancelBtn,
        errorBanner,
        errorText,
        errorDismissBtn,
        onSendMessage,
        autoResizeTextarea,
        updateSendButtonState
    }) {
        this.micBtn = micBtn;
        this.micBtnIcon = micBtnIcon;
        this.inputForm = inputForm;
        this.chatInput = chatInput;
        this.sendBtn = sendBtn;
        this.normalToolsLeft = normalToolsLeft;
        this.voiceStatusLeft = voiceStatusLeft;
        this.voiceCancelBtn = voiceCancelBtn;
        this.errorBanner = errorBanner;
        this.errorText = errorText;
        this.errorDismissBtn = errorDismissBtn;
        this.onSendMessage = onSendMessage;
        this.autoResizeTextarea = autoResizeTextarea;
        this.updateSendButtonState = updateSendButtonState;

        // Dynamic Language State (persists preferred language across queries)
        let savedLang = 'en-IN';
        try {
            savedLang = localStorage.getItem('voice_input_lang') || 'en-IN';
        } catch (e) {}
        this.currentLang = savedLang;

        // State variables
        this.isActive = false;
        this.isUserAborted = false;
        this.confirmedTranscript = '';
        this.interimTranscript = '';
        this.prefixText = '';

        // Web Audio API & Ambient Aura
        this.audioContext = null;
        this.analyser = null;
        this.mediaStream = null;
        this.animFrameId = null;

        // Speech Recognition setup
        const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.speechSupported = Boolean(SpeechRecognitionClass);
        this.recognition = null;
        this.isRecognitionRunning = false;

        this.bindEvents();
    }

    /**
     * Bind click and keyboard events
     */
    bindEvents() {
        // Toggle mic on/off when clicked
        if (this.micBtn) {
            this.micBtn.addEventListener('click', () => {
                if (this.isActive) {
                    this.stopRecording({ discard: false });
                } else {
                    this.startRecording();
                }
            });
        }

        // Cancel voice input (X) button
        if (this.voiceCancelBtn) {
            this.voiceCancelBtn.addEventListener('click', () => {
                this.stopRecording({ discard: true });
            });
        }

        // Error banner dismiss
        if (this.errorDismissBtn) {
            this.errorDismissBtn.addEventListener('click', () => {
                this.hideError();
            });
        }

        // Escape key cancels voice input when active
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isActive) {
                this.stopRecording({ discard: true });
            }
        });
    }

    /**
     * Dynamically detect language from spoken interim or final words
     * @param {string} text
     * @returns {string|null} - 'hi-IN' or 'en-IN' or null
     */
    detectLanguage(text) {
        if (!text || typeof text !== 'string') return null;
        const trimmed = text.trim();
        if (!trimmed) return null;

        // 1. Devanagari script characters (Hindi speech)
        if (/[\u0900-\u097F]/.test(trimmed)) {
            return 'hi-IN';
        }

        // 2. Common Romanized Hindi keywords (Hinglish phonetics)
        const hindiRegex = /\b(kya|hai|hain|kaise|kare|karen|karna|karu|mujhe|batao|bataiye|chahiye|kitna|kitne|kitni|nivesh|paisa|paise|bachat|laabh|mera|meri|mere|aap|hum|kaun|kaunsa|kaunsi|kaha|kahan|kab|kyun|hota|hoti|hote|hoga|hogi|shuru|namaste|achha|theek|kripya|lagana|rakhna|nikalna|milta|milega|samjhao|bata|sakta|sakte|sakthi|bolo|sunao)\b/i;
        if (hindiRegex.test(trimmed)) {
            return 'hi-IN';
        }

        // 3. Common English keywords
        const englishRegex = /\b(what|which|where|when|why|how|tell|give|can|should|would|could|is|are|the|this|that|please|invest|investment|fund|funds|money|explain|suggest|minimum|maximum|returns|return|exit|load|expense|ratio|lock|in|portfolio|growth|equity|debt)\b/i;
        if (englishRegex.test(trimmed) && !hindiRegex.test(trimmed)) {
            return 'en-IN';
        }

        return null;
    }

    /**
     * Dynamically adapt recognition language on the fly
     * @param {string} newLang - 'en-IN' or 'hi-IN'
     */
    adaptLanguage(newLang) {
        if (!newLang || this.currentLang === newLang) return;
        this.currentLang = newLang;
        try {
            localStorage.setItem('voice_input_lang', newLang);
        } catch (e) {}

        if (this.recognition && this.isActive) {
            try {
                this.recognition.abort();
                this.recognition.lang = newLang;
                this.recognition.start();
            } catch (e) {
                // Ignore transient restart errors
            }
        }
    }

    /**
     * Start the voice input recording session
     */
    async startRecording() {
        this.hideError();

        if (!this.speechSupported) {
            this.showError('Voice transcription is not supported in this browser. Please use Chrome, Safari, or Edge.');
            return;
        }

        this.isActive = true;
        this.isUserAborted = false;
        this.confirmedTranscript = '';
        this.interimTranscript = '';
        this.prefixText = (this.chatInput ? this.chatInput.value : '').trim();

        // UI recording state
        if (this.inputForm) {
            this.inputForm.classList.add('is-recording');
        }
        if (this.normalToolsLeft) {
            this.normalToolsLeft.style.display = 'none';
        }
        if (this.voiceStatusLeft) {
            this.voiceStatusLeft.style.display = 'flex';
        }
        if (this.micBtnIcon) {
            this.micBtnIcon.textContent = 'stop';
        }
        if (this.micBtn) {
            this.micBtn.classList.add('is-active-recording');
            this.micBtn.title = 'Stop recording (keep text)';
            this.micBtn.setAttribute('aria-label', 'Stop voice recording');
        }

        // Set listening placeholder if input is empty
        if (this.chatInput && !this.prefixText) {
            this.chatInput.placeholder = 'Listening... Speak your query';
        }

        // Start subtle Apple Intelligence-style ambient edge aura
        await this.startAudioVisualizer();

        // Start real-time speech recognition
        this.startSpeechRecognition();
    }

    /**
     * Start or restart Web Speech Recognition
     */
    startSpeechRecognition() {
        if (!this.speechSupported) return;

        try {
            if (this.recognition) {
                try {
                    this.recognition.abort();
                } catch (e) {}
            }

            const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognitionClass();
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
            this.recognition.maxAlternatives = 1;
            this.recognition.lang = this.currentLang;

            this.recognition.onstart = () => {
                this.isRecognitionRunning = true;
            };

            this.recognition.onresult = (event) => {
                let currentFinal = '';
                let interim = '';

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const result = event.results[i];
                    if (result.isFinal) {
                        currentFinal += result[0].transcript + ' ';
                    } else {
                        interim += result[0].transcript;
                    }
                }

                if (currentFinal) {
                    this.confirmedTranscript += currentFinal;
                }
                this.interimTranscript = interim;

                // Real-time synchronization directly into prompt textarea as the user speaks
                this.syncTextToInput();

                // Dynamic language detection & adaptation
                const detected = this.detectLanguage(currentFinal || interim);
                if (detected && detected !== this.currentLang) {
                    this.adaptLanguage(detected);
                }
            };

            this.recognition.onerror = (event) => {
                console.warn('Speech recognition warning/error:', event.error);
                if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
                    this.showError('Microphone permission blocked. Please click the lock icon in your address bar to allow microphone access.');
                    this.stopRecording({ discard: false });
                } else if (event.error === 'network') {
                    this.showError('Speech recognition network error. Please check your internet connection.');
                    this.stopRecording({ discard: false });
                } else if (event.error === 'audio-capture') {
                    this.showError('Microphone not detected or in use by another application.');
                    this.stopRecording({ discard: false });
                } else if (event.error === 'no-speech') {
                    // Timeout with no speech detected; don't terminate abruptly
                }
            };

            this.recognition.onend = () => {
                this.isRecognitionRunning = false;
                // If user didn't abort and is still recording, restart recognition
                if (this.isActive && !this.isUserAborted) {
                    try {
                        this.recognition.start();
                    } catch (e) {
                        // Ignore already started errors
                    }
                }
            };

            this.recognition.start();
        } catch (err) {
            console.warn('Recognition start exception:', err);
        }
    }

    /**
     * Synchronize live speech text directly into the prompt textarea
     */
    syncTextToInput() {
        if (!this.chatInput) return;

        const spoken = (this.confirmedTranscript + this.interimTranscript).trim();
        let newContent = '';

        if (this.prefixText && spoken) {
            newContent = this.prefixText + ' ' + spoken;
        } else if (spoken) {
            newContent = spoken;
        } else {
            newContent = this.prefixText || '';
        }

        this.chatInput.value = newContent;

        if (this.autoResizeTextarea) {
            this.autoResizeTextarea();
        }
        if (this.updateSendButtonState) {
            this.updateSendButtonState();
        }

        // Scroll to show latest words
        this.chatInput.scrollTop = this.chatInput.scrollHeight;
    }

    /**
     * Stop the recording session
     * @param {Object} options - { discard: boolean }
     */
    stopRecording({ discard = false } = {}) {
        this.isActive = false;
        this.isUserAborted = true;

        if (this.recognition) {
            try {
                this.recognition.stop();
            } catch (e) {}
        }

        this.stopAudioVisualizer();

        // Restore prompt form UI
        if (this.inputForm) {
            this.inputForm.classList.remove('is-recording');
            this.inputForm.style.borderColor = '';
            this.inputForm.style.boxShadow = '';
        }
        if (this.normalToolsLeft) {
            this.normalToolsLeft.style.display = 'flex';
        }
        if (this.voiceStatusLeft) {
            this.voiceStatusLeft.style.display = 'none';
        }
        if (this.micBtnIcon) {
            this.micBtnIcon.textContent = 'mic';
        }
        if (this.micBtn) {
            this.micBtn.classList.remove('is-active-recording');
            this.micBtn.title = 'Start voice query';
            this.micBtn.setAttribute('aria-label', 'Start voice input');
        }

        if (this.chatInput) {
            this.chatInput.placeholder = 'Ask mutual fund assistant...';

            if (discard) {
                this.chatInput.value = this.prefixText || '';
            } else {
                // Ensure text is trimmed and updated
                const fullText = (this.prefixText ? this.prefixText + ' ' : '') + 
                                 (this.confirmedTranscript + ' ' + this.interimTranscript).trim();
                if (fullText.trim()) {
                    this.chatInput.value = fullText.trim();
                }
            }

            if (this.autoResizeTextarea) {
                this.autoResizeTextarea();
            }
            if (this.updateSendButtonState) {
                this.updateSendButtonState();
            }

            this.chatInput.focus();
            const textLen = this.chatInput.value.length;
            this.chatInput.setSelectionRange(textLen, textLen);
        }
    }

    /**
     * Web Audio API: Apple Intelligence-Style Subtle Ambient Card Edge Aura
     * Smooth, non-distracting organic glow modulation with spring damping
     */
    async startAudioVisualizer() {
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) return;

            this.audioContext = new AudioContextClass();
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 64; // 32 frequency bins
            this.analyser.smoothingTimeConstant = 0.75; // Organic decay
            this.analyser.minDecibels = -85;
            this.analyser.maxDecibels = -10;

            const source = this.audioContext.createMediaStreamSource(this.mediaStream);
            source.connect(this.analyser);

            const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
            let currentGlow = 0;

            const renderAura = () => {
                if (!this.isActive) return;

                this.analyser.getByteFrequencyData(dataArray);

                // Compute overall vocal energy
                let sum = 0;
                for (let i = 0; i < dataArray.length; i++) {
                    sum += dataArray[i];
                }
                const avgVolume = sum / dataArray.length;

                // Noise Gate: ambient background noise ignored
                const NOISE_THRESHOLD = 8;
                const isSpeaking = avgVolume > NOISE_THRESHOLD;

                // Subtle, non-distracting voice reactivity (capped and smooth)
                const targetGlow = isSpeaking ? Math.min(1, (avgVolume - NOISE_THRESHOLD) / 38) : 0;
                currentGlow += (targetGlow - currentGlow) * 0.16; // Organic spring damping

                if (this.inputForm) {
                    const blurSpread = (10 + currentGlow * 12).toFixed(1);
                    const outerAlpha = (0.16 + currentGlow * 0.16).toFixed(2);
                    const innerAlpha = (0.06 + currentGlow * 0.08).toFixed(2);
                    const borderAlpha = (0.40 + currentGlow * 0.25).toFixed(2);

                    this.inputForm.style.borderColor = `rgba(52, 211, 153, ${borderAlpha})`;
                    this.inputForm.style.boxShadow = `
                        0 0 ${blurSpread}px rgba(16, 185, 129, ${outerAlpha}),
                        0 0 ${(blurSpread * 1.6).toFixed(1)}px rgba(52, 211, 153, ${(outerAlpha * 0.55).toFixed(2)}),
                        inset 0 0 ${(blurSpread * 0.5).toFixed(1)}px rgba(52, 211, 153, ${innerAlpha}),
                        0 6px 24px rgba(0, 0, 0, 0.32)
                    `;
                }

                this.animFrameId = requestAnimationFrame(renderAura);
            };

            renderAura();
        } catch (err) {
            console.warn('Audio visualizer error:', err);
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                this.showError('Microphone permission was denied. Please allow mic access in your browser.');
                this.stopRecording({ discard: false });
            }
        }
    }

    /**
     * Stop Audio visualizer and release microphone tracks cleanly
     */
    stopAudioVisualizer() {
        if (this.animFrameId) {
            cancelAnimationFrame(this.animFrameId);
            this.animFrameId = null;
        }

        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => {
                try {
                    track.stop();
                } catch (e) {}
            });
            this.mediaStream = null;
        }

        if (this.audioContext && this.audioContext.state !== 'closed') {
            try {
                this.audioContext.close();
            } catch (e) {}
            this.audioContext = null;
        }

        if (this.inputForm) {
            this.inputForm.style.borderColor = '';
            this.inputForm.style.boxShadow = '';
        }
    }

    /**
     * Error notification management
     */
    showError(message) {
        if (this.errorText) {
            this.errorText.textContent = message;
        }
        if (this.errorBanner) {
            this.errorBanner.style.display = 'flex';
        }
    }

    hideError() {
        if (this.errorBanner) {
            this.errorBanner.style.display = 'none';
        }
    }
}
