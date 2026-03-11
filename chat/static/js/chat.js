// State
let peerConnection = null;
let dataChannel = null;
let isConnected = false;
let chatHistory = [];
let currentBotMessage = null;
let mediaRecorder = null;
let recordingChunks = [];
let micStream = null;
let pendingUserMessage = null;
let audioContext = null;
let markerDestination = null;
let channelMerger = null;
let uploadUrlResolver = null; // resolved when backend sends presigned URL

// Elements (set after DOM ready)
let connectBtn, connectIcon, disconnectIcon, statusText, indicator;
let instructions;
let chatMessages, chatLogInput, submitButton;

document.addEventListener('DOMContentLoaded', () => {
    connectBtn = document.getElementById('connect-btn');
    connectIcon = document.getElementById('connect-icon');
    disconnectIcon = document.getElementById('disconnect-icon');
    statusText = document.getElementById('status-text');
    indicator = document.getElementById('recording-indicator');
    instructions = document.getElementById('instructions');
    chatMessages = document.getElementById('chat-messages');
    chatLogInput = document.getElementById('id_chat_log');
    submitButton = document.getElementById('submit_button');

    connectBtn.addEventListener('click', () => {
        if (!isConnected) {
            requestToken();
        } else {
            disconnect();
        }
    });

    // Auto-start from round 2 onwards
    if (typeof OTREE_ROUND !== 'undefined' && OTREE_ROUND > 1) {
        const productComparison = document.getElementById('product-comparison');
        if (productComparison) {
            productComparison.style.display = 'block';
            document.getElementById('image_shown').value = 1;
        }
        requestToken();
    }
});

// Request ephemeral token from backend
function requestToken() {
    statusText.textContent = 'Connecting...';
    connectBtn.disabled = true;
    liveSend({ type: 'token' });
}

// Handle messages from backend
function liveRecv(data) {
    if (data.type === 'upload_url') {
        console.log('[liveRecv] Presigned upload URL received for:', data.filename);
        if (uploadUrlResolver) {
            uploadUrlResolver(data.url);
            uploadUrlResolver = null;
        }
    } else if (data.type === 'token') {
        startWebRTC(data.token, data.model);
    } else if (data.type === 'error') {
        statusText.textContent = 'Ready';
        connectBtn.disabled = false;
        alert(data.message || 'Connection failed');
    }
}

// Establish WebRTC connection to OpenAI Realtime API
async function startWebRTC(ephemeralToken, model) {
    try {
        peerConnection = new RTCPeerConnection();

        // Set up Web Audio API graph for stereo recording:
        //   Left channel  = user mic + marker tone
        //   Right channel  = bot voice
        audioContext = new AudioContext();
        channelMerger = audioContext.createChannelMerger(2);
        markerDestination = audioContext.createMediaStreamDestination();
        channelMerger.connect(markerDestination);

        // Set up remote audio playback + route to right channel
        const audioEl = document.createElement('audio');
        audioEl.autoplay = true;
        peerConnection.ontrack = (event) => {
            audioEl.srcObject = event.streams[0];
            // Bot audio → right channel (input 1)
            const botSource = audioContext.createMediaStreamSource(event.streams[0]);
            botSource.connect(channelMerger, 0, 1);
            console.log('[recording] Bot audio connected to right channel');
        };

        // Add local microphone track
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStream.getTracks().forEach(track => peerConnection.addTrack(track, micStream));

        // Mic → left channel (input 0)
        const micSource = audioContext.createMediaStreamSource(micStream);
        micSource.connect(channelMerger, 0, 0);

        // Record stereo stream (left=user+marker, right=bot)
        recordingChunks = [];
        mediaRecorder = new MediaRecorder(markerDestination.stream, { mimeType: 'audio/webm; codecs=opus' });
        mediaRecorder.addEventListener('dataavailable', e => recordingChunks.push(e.data));
        mediaRecorder.start();

        // Create data channel for events
        dataChannel = peerConnection.createDataChannel('oai-events');
        dataChannel.onopen = onDataChannelOpen;
        dataChannel.onmessage = onDataChannelMessage;

        // Create and set local SDP offer
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        // Send offer to OpenAI and get answer
        const response = await fetch(
            `https://api.openai.com/v1/realtime?model=${model}`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${ephemeralToken}`,
                    'Content-Type': 'application/sdp',
                },
                body: offer.sdp,
            }
        );

        const answerSdp = await response.text();
        await peerConnection.setRemoteDescription({
            type: 'answer',
            sdp: answerSdp,
        });

        // Update UI
        isConnected = true;
        statusText.textContent = 'In conversation';
        indicator.classList.add('active');
        connectIcon.style.display = 'none';
        disconnectIcon.style.display = 'block';
        connectBtn.disabled = false;
        connectBtn.classList.add('active');
        submitButton.disabled = false;

        if (instructions) instructions.style.display = 'none';

    } catch (err) {
        console.error('WebRTC connection error:', err);
        statusText.textContent = 'Ready';
        connectBtn.disabled = false;
        alert('Failed to connect. Please check your microphone permissions.');
    }
}

function onDataChannelOpen() {
    console.log('Data channel open');
    dataChannel.send(JSON.stringify({
        type: 'session.update',
        session: {
            turn_detection: {
                type: 'server_vad',
                threshold: 0.6,
                silence_duration_ms: 1000,
            },
            input_audio_transcription: {
                model: 'whisper-1',
                language: 'en',
            },
            tools: [
                {
                    type: 'function',
                    name: 'show_product_comparison',
                    description: 'Displays the product comparison card with the two products side by side. Call this before asking the user about their preference.',
                    parameters: {
                        type: 'object',
                        properties: {},
                    },
                },
                {
                    type: 'function',
                    name: 'submit_page',
                    description: 'Advances to the next round. Call this only after the user has given a clear, complete preference for one of the two products — not during hedging or mid-sentence.',
                    parameters: {
                        type: 'object',
                        properties: {},
                    },
                },
            ],
        },
    }));

    // On rounds > 1 the bot starts the conversation immediately
    if (typeof OTREE_ROUND !== 'undefined' && OTREE_ROUND > 1) {
        dataChannel.send(JSON.stringify({ type: 'response.create' }));
    }
}

function onDataChannelMessage(event) {
    const msg = JSON.parse(event.data);

    switch (msg.type) {
        case 'input_audio_buffer.speech_started':
            indicator.classList.add('speaking');
            pendingUserMessage = addMessage('user', '...');
            pendingUserMessage.classList.add('pending');
            break;

        case 'input_audio_buffer.speech_stopped':
            indicator.classList.remove('speaking');
            break;

        case 'conversation.item.input_audio_transcription.completed':
            if (msg.transcript && msg.transcript.trim()) {
                if (pendingUserMessage) {
                    pendingUserMessage.textContent = msg.transcript.trim();
                    pendingUserMessage.classList.remove('pending');
                    saveToChatHistory('user', msg.transcript.trim());
                    pendingUserMessage = null;
                } else {
                    saveToChatHistory('user', msg.transcript.trim());
                }
            } else if (pendingUserMessage) {
                pendingUserMessage.parentElement.remove();
                pendingUserMessage = null;
            }
            break;

        case 'response.audio_transcript.delta':
            if (!currentBotMessage) {
                currentBotMessage = addMessage('bot', '');
                indicator.classList.add('speaking');
            }
            currentBotMessage.textContent += msg.delta || '';
            break;

        case 'response.audio_transcript.done':
            if (currentBotMessage) {
                const finalText = msg.transcript || currentBotMessage.textContent;
                currentBotMessage.textContent = finalText;
                saveToChatHistory('bot', finalText);
                currentBotMessage = null;
                indicator.classList.remove('speaking');
            }
            break;

        case 'response.function_call_arguments.done':
            console.log('[tool call]', msg.name, 'call_id:', msg.call_id);
            if (msg.name === 'submit_page') {
                // Acknowledge the tool call so the model can deliver its closing remark
                dataChannel.send(JSON.stringify({
                    type: 'conversation.item.create',
                    item: {
                        type: 'function_call_output',
                        call_id: msg.call_id,
                        output: JSON.stringify({ success: true }),
                    },
                }));
                dataChannel.send(JSON.stringify({ type: 'response.create' }));

                // Submit after a short delay to let the bot finish speaking
                setTimeout(() => {
                    submitButton.disabled = false;
                    submitButton.click();
                }, 3000);

            } else if (msg.name === 'show_product_comparison') {
                // Inject inaudible marker tone into the recording
                injectMarkerTone();

                // Reveal product comparison with fade-in
                const productComparison = document.getElementById('product-comparison');
                if (productComparison) {
                    const alreadyVisible = productComparison.style.display === 'block';
                    productComparison.style.display = 'block';
                    if (!alreadyVisible) productComparison.classList.add('fade-in');
                    document.getElementById('image_shown').value = 1;
                }

                // Send tool output back so the model continues
                dataChannel.send(JSON.stringify({
                    type: 'conversation.item.create',
                    item: {
                        type: 'function_call_output',
                        call_id: msg.call_id,
                        output: JSON.stringify({ success: true }),
                    },
                }));
                dataChannel.send(JSON.stringify({
                    type: 'response.create',
                }));
            }
            break;

        case 'error':
            console.error('Realtime API error:', msg.error);
            break;
    }
}

function addMessage(role, text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `chat-message chat-${role}`;

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    bubble.textContent = text;

    msgDiv.appendChild(bubble);
    chatMessages.appendChild(msgDiv);

    return bubble;
}

// Inject a short 18kHz tone into both channels as a timestamp marker.
// Inaudible during playback but visible on a spectrogram.
function injectMarkerTone() {
    if (!audioContext || !channelMerger) return;

    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.frequency.value = 18000; // 18kHz — above normal hearing range
    gain.gain.value = 0.15;             // low amplitude for clean detection

    oscillator.connect(gain);
    gain.connect(channelMerger, 0, 0);  // left channel (user side)
    gain.connect(channelMerger, 0, 1);  // right channel (bot side)

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.2); // 200ms burst

    console.log('Marker tone injected at', new Date().toISOString());
}

function saveToChatHistory(role, text) {
    chatHistory.push({ role, text });
    chatLogInput.value = JSON.stringify(chatHistory);
}

async function disconnect() {
    console.log('[disconnect] Starting disconnect...');

    // Stop background recording and upload directly to S3 via presigned URL
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        console.log('[disconnect] Stopping MediaRecorder, chunks:', recordingChunks.length);

        // Stop recording and get the blob
        const blob = await new Promise((resolve) => {
            mediaRecorder.addEventListener('stop', () => {
                resolve(new Blob(recordingChunks, { type: 'audio/webm' }));
            });
            mediaRecorder.stop();
        });
        mediaRecorder = null;
        console.log('[disconnect] Blob created, size:', blob.size, 'bytes');

        // Request a presigned upload URL from the backend
        const urlPromise = new Promise((resolve) => {
            uploadUrlResolver = resolve;
            setTimeout(() => {
                if (uploadUrlResolver) {
                    console.warn('[disconnect] Presigned URL timed out after 10s');
                    uploadUrlResolver = null;
                    resolve(null);
                }
            }, 10000);
        });
        console.log('[disconnect] Requesting presigned upload URL...');
        liveSend({ type: 'upload_url' });
        const presignedUrl = await urlPromise;

        // Upload directly to S3
        if (presignedUrl) {
            try {
                console.log('[disconnect] Uploading to S3...');
                const resp = await fetch(presignedUrl, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'audio/webm' },
                    body: blob,
                });
                console.log('[disconnect] S3 upload done, status:', resp.status);
            } catch (err) {
                console.error('[disconnect] S3 upload failed:', err);
            }
        } else {
            console.error('[disconnect] No presigned URL, audio not uploaded');
        }
    } else {
        console.log('[disconnect] No active MediaRecorder, skipping audio upload');
    }

    if (chatHistory.length > 0) {
        console.log('[disconnect] Sending chat log, entries:', chatHistory.length);
        liveSend({ type: 'chat_log', log: JSON.stringify(chatHistory) });
    }

    if (audioContext) {
        audioContext.close();
        audioContext = null;
        markerDestination = null;
        channelMerger = null;
    }
    if (dataChannel) {
        dataChannel.close();
        dataChannel = null;
    }
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }

    isConnected = false;
    currentBotMessage = null;

    statusText.textContent = 'Ended';
    indicator.classList.remove('active', 'speaking');
    connectIcon.style.display = 'block';
    disconnectIcon.style.display = 'none';
    connectBtn.classList.remove('active');
}

// Intercept form submit to ensure upload completes before page navigates
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (chatHistory.length > 0 && chatLogInput) {
                chatLogInput.value = JSON.stringify(chatHistory);
            }
            if (isConnected) {
                await disconnect();
            }
            form.submit();
        });
    }
});

window.addEventListener('beforeunload', () => {
    if (chatHistory.length > 0 && chatLogInput) {
        chatLogInput.value = JSON.stringify(chatHistory);
    }
});
