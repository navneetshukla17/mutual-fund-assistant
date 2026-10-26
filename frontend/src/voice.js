/**
 * Voice Input Manager for Mutual Fund Assistant
 * Implements real-time speech recognition (Web Speech API)
 * with live real-time transcription directly into the prompt window (textarea)
 * and an Apple Intelligence-style subtle ambient card edge aura.
 * 
 * Supports both Desktop and Mobile devices seamlessly:
 * - On Mobile: avoids microphone resource contention with AudioContext/getUserMedia,
 *   synchronously activates speech recognition to preserve mobile user gestures,
 *   and handles Android Chrome utterance boundaries with seamless auto-restart.
 * - On Desktop: combines Web Speech API with Web Audio API FFT visualizer.
 * - Universal Fallback: MediaRecorder + Gemini multimodal speech-to-text (/api/transcribe)
 *   for browsers without native Web Speech API (iOS Chrome, Firefox, etc.).
 * - Dynamically adapts between English, Hindi, and Hinglish.
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
        this.restartTimer = null;
        this.isMobile = this.checkIsMobile();

        // Web Audio API & Ambient Aura (Desktop only to prevent mobile mic lock)
        this.audioContext = null;
        this.analyser = null;
        this.mediaStream = null;
        this.animFrameId = null;

        // MediaRecorder Fallback State (for browsers without Web Speech API)
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.recordedMimeType = '';
        this.isUsingMediaRecorderFallback = false;

        // Speech Recognition setup
        const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.speechSupported = Boolean(SpeechRecognitionClass);
        this.recognition = null;
        this.isRecognitionRunning = false;

        this.bindEvents();
    }

    /**
     * Check if device is a mobile or touch-enabled phone/tablet
     */
    checkIsMobile() {
        if (typeof navigator === 'undefined') return false;
        const ua = navigator.userAgent || '';
        return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua) ||
               (navigator.maxTouchPoints > 1 && !window.MSStream);
    }

    /**
     * Bind click and keyboard events
     */
    bindEvents() {
        // Toggle mic on/off when clicked
        if (this.micBtn) {
            this.micBtn.addEventListener('click', (e) => {
                e.preventDefault();
                if (this.isActive) {
                    this.stopRecording({ discard: false });
                } else {
                    this.startRecording();
                }
            });
        }

        // Cancel voice input (X) button
        if (this.voiceCancelBtn) {
            this.voiceCancelBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.stopRecording({ discard: true });
            });
        }

        // Error banner dismiss
        if (this.errorDismissBtn) {
            this.errorDismissBtn.addEventListener('click', (e) => {
                e.preventDefault();
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
     * Dynamically adapt recognition language on the fly without interrupting ongoing speech
     * @param {string} newLang - 'en-IN' or 'hi-IN'
     */
    adaptLanguage(newLang) {
        if (!newLang || this.currentLang === newLang) return;
        this.currentLang = newLang;
        try {
            localStorage.setItem('voice_input_lang', newLang);
        } catch (e) {}

        if (this.recognition) {
            this.recognition.lang = newLang;
        }
    }

    /**
     * Start the voice input recording session
     */
    startRecording() {
        this.hideError();
        this.isMobile = this.checkIsMobile();

        const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
        this.speechSupported = Boolean(SpeechRecognitionClass);

        const hasMediaRecorder = Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);

        if (!this.speechSupported && !hasMediaRecorder) {
            this.showError('Voice transcription is not supported in this browser. Please use Chrome, Safari, or Edge.');
            return;
        }

        this.isActive = true;
        this.isUserAborted = false;
        this.confirmedTranscript = '';
        this.interimTranscript = '';
        this.prefixText = (this.chatInput ? this.chatInput.value : '').trim();
        this.isUsingMediaRecorderFallback = false;

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

        // IMPORTANT MOBILE AUDIO ARCHITECTURE:
        // 1. On Android/iOS Mobile: Opening getUserMedia locks the hardware microphone interface
        //    exclusively, which starves Web Speech API (Google Speech Services) of audio.
        //    Therefore on mobile, we DO NOT open getUserMedia for visualizer. Instead, the CSS
        //    ambientAuraPulse keyframe provides a 60fps Apple Intelligence glow without mic lock!
        // 2. On Desktop: macOS and Windows audio servers multiplex microphone capture cleanly,
        //    so we can run Web Speech API and the Web Audio API visualizer simultaneously.
        // 3. User Activation: startSpeechRecognition() is called synchronously right now
        //    during the click event, preserving the transient user gesture on mobile Chrome.

        if (this.speechSupported) {
            this.startSpeechRecognition();
            if (!this.isMobile) {
                this.startAudioVisualizer();
            }
        } else {
            this.startMediaRecorderFallback();
        }
    }

    /**
     * Start Web Speech Recognition with mobile-friendly configuration
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
            
            // On mobile devices, continuous = true breaks Google Speech Services and prevents interimResults.
            // Setting continuous = false on mobile with seamless restart on 'onend' ensures 100% reliability.
            this.recognition.continuous = !this.isMobile;
            this.recognition.interimResults = true;
            this.recognition.maxAlternatives = 1;
            this.recognition.lang = this.currentLang || 'en-IN';

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
                    this.showError('Microphone permission blocked. Please allow microphone access in your browser settings.');
                    this.stopRecording({ discard: false });
                } else if (event.error === 'network') {
                    if (!this.confirmedTranscript && !this.interimTranscript) {
                        console.warn('Speech recognition network error; switching to MediaRecorder fallback.');
                        this.startMediaRecorderFallback();
                    }
                } else if (event.error === 'audio-capture') {
                    this.showError('Microphone not detected or in use by another application.');
                    this.stopRecording({ discard: false });
                } else if (event.error === 'no-speech') {
                    // Timeout with no speech detected; keep session alive if still active
                }
            };

            this.recognition.onend = () => {
                this.isRecognitionRunning = false;
                // If user didn't abort and is still recording, restart recognition cleanly
                if (this.isActive && !this.isUserAborted) {
                    if (this.restartTimer) {
                        clearTimeout(this.restartTimer);
                    }
                    this.restartTimer = setTimeout(() => {
                        if (this.isActive && !this.isUserAborted && !this.isRecognitionRunning) {
                            try {
                                if (this.recognition) {
                                    this.recognition.lang = this.currentLang || 'en-IN';
                                    this.recognition.start();
                                }
                            } catch (e) {
                                // Ignore already started or aborting errors
                            }
                        }
                    }, 50);
                }
            };

            this.recognition.start();
        } catch (err) {
            console.warn('Recognition start exception:', err);
            if (this.isActive) {
                this.startMediaRecorderFallback();
            }
        }
    }

    /**
     * MediaRecorder Fallback (Universal audio recording + Gemini speech-to-text API)
     * Used for browsers without native Web Speech API (iOS Chrome, Firefox, etc.)
     */
    async startMediaRecorderFallback() {
        this.isUsingMediaRecorderFallback = true;
        try {
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) {
                this.showError('Microphone access is not supported in this browser.');
                this.stopRecording({ discard: false });
                return;
            }

            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });

            // Detect supported container & codec
            let mimeType = 'audio/webm';
            if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
                mimeType = 'audio/webm;codecs=opus';
            } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
                mimeType = 'audio/mp4';
            } else if (MediaRecorder.isTypeSupported('audio/aac')) {
                mimeType = 'audio/aac';
            } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
                mimeType = 'audio/ogg';
            }

            this.recordedMimeType = mimeType;
            this.audioChunks = [];
            this.mediaRecorder = new MediaRecorder(this.mediaStream, mimeType ? { mimeType } : {});

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            this.mediaRecorder.start(250);

            if (!this.isMobile) {
                this.startAudioVisualizer(this.mediaStream);
            }
        } catch (err) {
            console.warn('MediaRecorder fallback exception:', err);
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                this.showError('Microphone permission was denied. Please allow mic access in your browser.');
            } else {
                this.showError('Unable to access microphone. Please check your browser permissions.');
            }
            this.stopRecording({ discard: false });
        }
    }

    /**
     * Send recorded audio chunks to Gemini /api/transcribe endpoint
     */
    async transcribeAudioChunks() {
        if (!this.audioChunks || this.audioChunks.length === 0) return '';
        try {
            const blob = new Blob(this.audioChunks, { type: this.recordedMimeType || 'audio/webm' });
            if (blob.size < 100) return '';

            const response = await fetch('/api/transcribe', {
                method: 'POST',
                headers: {
                    'Content-Type': blob.type || 'audio/webm'
                },
                body: blob
            });

            if (!response.ok) {
                return '';
            }

            const data = await response.json();
            return (data.transcript || '').trim();
        } catch (e) {
            console.warn('Transcription API error:', e);
            return '';
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
    async stopRecording({ discard = false } = {}) {
        this.isActive = false;
        this.isUserAborted = true;

        if (this.restartTimer) {
            clearTimeout(this.restartTimer);
            this.restartTimer = null;
        }

        if (this.recognition) {
            try {
                this.recognition.stop();
            } catch (e) {}
        }

        let pendingTranscription = null;
        if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
            try {
                this.mediaRecorder.stop();
            } catch (e) {}

            if (!discard && (!this.confirmedTranscript && !this.interimTranscript)) {
                pendingTranscription = this.transcribeAudioChunks();
            }
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

        // If server transcription is pending from MediaRecorder fallback, await and sync it
        if (pendingTranscription) {
            if (this.chatInput && !this.chatInput.value.trim()) {
                this.chatInput.placeholder = 'Transcribing voice audio...';
            }
            try {
                const serverTranscript = await pendingTranscription;
                if (serverTranscript && !discard) {
                    const fullText = (this.prefixText ? this.prefixText + ' ' : '') + serverTranscript;
                    if (this.chatInput) {
                        this.chatInput.value = fullText.trim();
                        this.chatInput.placeholder = 'Ask mutual fund assistant...';
                        if (this.autoResizeTextarea) this.autoResizeTextarea();
                        if (this.updateSendButtonState) this.updateSendButtonState();
                        this.chatInput.focus();
                        const len = this.chatInput.value.length;
                        this.chatInput.setSelectionRange(len, len);
                    }
                }
            } catch (err) {
                console.warn('Server transcription completion error:', err);
            } finally {
                if (this.chatInput) {
                    this.chatInput.placeholder = 'Ask mutual fund assistant...';
                }
            }
        }
    }

    /**
     * Web Audio API: Apple Intelligence-Style Subtle Ambient Card Edge Aura
     * Smooth, non-distracting organic glow modulation with spring damping (Desktop)
     */
    async startAudioVisualizer(existingStream = null) {
        try {
            const AudioContextClass = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextClass) return;

            if (!this.audioContext || this.audioContext.state === 'closed') {
                this.audioContext = new AudioContextClass();
            }
            if (this.audioContext.state === 'suspended') {
                await this.audioContext.resume();
            }

            if (existingStream) {
                this.mediaStream = existingStream;
            } else if (!this.mediaStream) {
                this.mediaStream = await navigator.mediaDevices.getUserMedia({
                    audio: {
                        echoCancellation: true,
                        noiseSuppression: true,
                        autoGainControl: true
                    }
                });
            }

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
