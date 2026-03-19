// Seat map config
const ROWS = Array.from({ length: 10 }, (_, i) => 45 + i); // 45-54
const EXIT_ROW = 45;
// 2-4-2 layout: null = aisle gap
const COLS = ['A', 'B', null, 'C', 'D', 'E', 'F', null, 'G', 'H'];

// State
let peerConnection = null;
let dataChannel = null;
let isConnected = false;
let chatHistory = [];
let currentBotMessage = null;
let mediaRecorder = null;
let recordingChunks = [];
let micStream = null;
let audioContext = null;
let markerDestination = null;
let channelMerger = null;
let uploadUrlResolver = null;
let pendingUserMessage = null;
let submitConfirmed = false;
let pendingSubmit = false;        // true once submit_page has been called
let postSubmitResponseCount = 0; // counts response.done events after submit_page
let botAnalyser = null;          // detects when bot audio goes silent

// Paradata
const pageLoadTime = Date.now();
let seatMapShownAt = null;
let firstSpeechAt = null;
let speechSegmentStart = null;
let totalSpeechMs = 0;

// Elements
let connectBtn, statusText, indicator;
let instructions;
let chatMessages, chatLogInput, submitButton;

document.addEventListener('DOMContentLoaded', () => {
    connectBtn = document.getElementById('connect-btn');

    statusText = document.getElementById('status-text');
    indicator = document.getElementById('recording-indicator');
    instructions = document.getElementById('instructions');
    chatMessages = document.getElementById('chat-messages');
    chatLogInput = document.getElementById('id_chat_log');
    submitButton = document.getElementById('submit_button');

    // Popover warning on manual submit
    const submitPopover = new bootstrap.Popover(submitButton, {
        html: true,
        trigger: 'manual',
        placement: 'top',
        content: `
            <p class="mb-2 small">Only use this if the conversation seems stuck.</p>
            <button class="btn btn-sm btn-danger w-100" id="confirm-submit">Proceed anyway</button>
        `,
    });

    submitButton.addEventListener('click', (e) => {
        if (!submitConfirmed) {
            e.preventDefault();
            e.stopImmediatePropagation();
            submitPopover.show();
        }
    });

    document.addEventListener('click', (e) => {
        if (e.target.id === 'confirm-submit') {
            submitPopover.hide();
            submitConfirmed = true;
            autoSubmit();
        } else if (!submitButton.contains(e.target) && !e.target.closest('.popover')) {
            submitPopover.hide();
        }
    });

    buildSeatMap();

    connectBtn.addEventListener('click', () => {
        if (!isConnected) {
            requestToken();
        } else {
            disconnect();
        }
    });

    // Always auto-start
    requestToken();
});

// ── Seat map ─────────────────────────────────────────────────────────────────

function buildSeatMap() {
    const map = document.getElementById('seat-map');

    // Bathroom indicator row (sits above the exit row)
    const facRow = document.createElement('div');
    facRow.className = 'sm-row sm-facility-row';
    facRow.appendChild(makeRowLabel(''));
    const bar = document.createElement('div');
    bar.className = 'sm-facilities-bar';
    ['WC', 'WC', 'WC'].forEach(() => {
        const wc = document.createElement('span');
        wc.className = 'sm-wc';
        wc.textContent = 'WC';
        bar.appendChild(wc);
    });
    facRow.appendChild(bar);
    facRow.appendChild(makeRowLabel(''));
    map.appendChild(facRow);

    // Seat rows
    ROWS.forEach(row => {
        const rowEl = document.createElement('div');
        rowEl.className = 'sm-row' + (row === EXIT_ROW ? ' sm-exit-row' : '');

        // Left side
        if (row === EXIT_ROW) rowEl.appendChild(makeExitSign());
        else rowEl.appendChild(makeRowLabel(row));

        COLS.forEach(col => {
            if (col === null) {
                const aisle = document.createElement('div');
                aisle.className = 'sm-aisle';
                rowEl.appendChild(aisle);
            } else {
                const seatId = `${row}${col}`;
                const seat = document.createElement('div');
                seat.className = 'sm-seat';
                seat.id = `seat-${seatId}`;
                if (seatId === SEAT_A) { seat.classList.add('option-a'); seat.textContent = 'A'; }
                else if (seatId === SEAT_B) { seat.classList.add('option-b'); seat.textContent = 'B'; }
                if ((DISCOUNT_SEAT === 'seat_A' && seatId === SEAT_A) ||
                    (DISCOUNT_SEAT === 'seat_B' && seatId === SEAT_B)) {
                    seat.classList.add('discounted');
                    const badge = document.createElement('span');
                    badge.className = 'discount-badge';
                    badge.textContent = `-$${DISCOUNT_AMOUNT}`;
                    seat.appendChild(badge);
                }
                rowEl.appendChild(seat);
            }
        });

        // Right side
        if (row === EXIT_ROW) rowEl.appendChild(makeExitSign());
        else rowEl.appendChild(makeRowLabel(''));

        map.appendChild(rowEl);
    });
}

function makeExitSign() {
    const el = document.createElement('div');
    el.className = 'sm-exit-sign';
    el.title = 'Emergency exit';
    el.textContent = 'EXIT';
    return el;
}

function makeRowLabel(text) {
    const el = document.createElement('div');
    el.className = 'sm-row-label';
    el.textContent = text;
    return el;
}

function injectMarkerTone() {
    if (!audioContext || !channelMerger) return;
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.frequency.value = 18000;
    gain.gain.value = 0.15;
    osc.connect(gain);
    gain.connect(channelMerger, 0, 0);
    gain.connect(channelMerger, 0, 1);
    osc.start();
    osc.stop(audioContext.currentTime + 0.2);
}

function showSeatMap() {
    const wrapper = document.getElementById('seat-map-wrapper');
    if (wrapper && wrapper.style.display === 'none') {
        const placeholder = document.getElementById('seat-map-placeholder');
        if (placeholder) placeholder.style.display = 'none';

        document.getElementById('page-title').style.visibility = 'visible';
        wrapper.style.display = 'block';
        wrapper.classList.add('fade-in');
        document.getElementById('seat_map_shown').value = 1;
        seatMapShownAt = Date.now();

        // Scroll highlighted seats into view
        const seatEl = document.getElementById(`seat-${SEAT_A}`);
        if (seatEl) seatEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// ── WebRTC / OpenAI Realtime ──────────────────────────────────────────────────

function requestToken() {
    statusText.textContent = 'Connecting...';
    connectBtn.disabled = true;
    liveSend({ type: 'token' });
}

function liveRecv(data) {
    if (data.type === 'upload_url') {
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

async function startWebRTC(ephemeralToken, model) {
    try {
        peerConnection = new RTCPeerConnection();

        audioContext = new AudioContext();
        channelMerger = audioContext.createChannelMerger(2);
        markerDestination = audioContext.createMediaStreamDestination();
        channelMerger.connect(markerDestination);

        const audioEl = document.createElement('audio');
        audioEl.autoplay = true;
        peerConnection.ontrack = (event) => {
            audioEl.srcObject = event.streams[0];
            const botSource = audioContext.createMediaStreamSource(event.streams[0]);
            botSource.connect(channelMerger, 0, 1);
            botAnalyser = audioContext.createAnalyser();
            botAnalyser.fftSize = 512;
            botSource.connect(botAnalyser);
        };

        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        micStream.getTracks().forEach(track => peerConnection.addTrack(track, micStream));
        const micSource = audioContext.createMediaStreamSource(micStream);
        micSource.connect(channelMerger, 0, 0);

        recordingChunks = [];
        mediaRecorder = new MediaRecorder(markerDestination.stream, { mimeType: 'audio/webm; codecs=opus' });
        mediaRecorder.addEventListener('dataavailable', e => recordingChunks.push(e.data));
        mediaRecorder.start();

        dataChannel = peerConnection.createDataChannel('oai-events');
        dataChannel.onopen = onDataChannelOpen;
        dataChannel.onmessage = onDataChannelMessage;

        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

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
        await peerConnection.setRemoteDescription({ type: 'answer', sdp: answerSdp });

        isConnected = true;
        statusText.textContent = 'In conversation';
        indicator.classList.add('active');
        connectBtn.disabled = true;
        connectBtn.classList.add('active');
        if (instructions) instructions.style.display = 'none';

    } catch (err) {
        console.error('WebRTC error:', err);
        statusText.textContent = 'Ready';
        connectBtn.disabled = false;
        alert('Failed to connect. Please check your microphone permissions.');
    }
}

function onDataChannelOpen() {
    dataChannel.send(JSON.stringify({
        type: 'session.update',
        session: {
            turn_detection: {
                type: 'server_vad',
                threshold: 0.75,
                silence_duration_ms: 1000,
            },
            input_audio_transcription: {
                model: 'whisper-1',
                language: 'en',
            },
            tools: [
                {
                    type: 'function',
                    name: 'show_seat_map',
                    description: 'Displays the seat map highlighting the two seats being compared. Call this immediately after asking the preference question.',
                    parameters: { type: 'object', properties: {} },
                },
                {
                    type: 'function',
                    name: 'submit_page',
                    description: 'Advances to the next round. Call this only after the user has given a clear, definitive preference for one of the two seats.',
                    parameters: {
                        type: 'object',
                        properties: {
                            choice: {
                                type: 'string',
                                enum: ['seat_A', 'seat_B'],
                                description: 'Which seat the participant chose.',
                            },
                        },
                        required: ['choice'],
                    },
                },
            ],
        },
    }));

    // Seat map is shown via show_seat_map tool call
    // Fallback: show map after 5 s if the tool call never arrives
    setTimeout(() => showSeatMap(), 5000);

    // Always trigger agent to start speaking immediately
    dataChannel.send(JSON.stringify({ type: 'response.create' }));
}

function onDataChannelMessage(event) {
    const msg = JSON.parse(event.data);

    switch (msg.type) {
        case 'input_audio_buffer.speech_started':
            indicator.classList.add('speaking');
            pendingUserMessage = addMessage('user', '...');
            pendingUserMessage.classList.add('pending');
            speechSegmentStart = Date.now();
            if (firstSpeechAt === null) {
                firstSpeechAt = Date.now();
                if (seatMapShownAt !== null) {
                    document.getElementById('response_onset_ms').value = firstSpeechAt - seatMapShownAt;
                }
            }
            break;

        case 'input_audio_buffer.speech_stopped':
            indicator.classList.remove('speaking');
            if (speechSegmentStart !== null) {
                totalSpeechMs += Date.now() - speechSegmentStart;
                speechSegmentStart = null;
                document.getElementById('response_duration_ms').value = totalSpeechMs;
            }
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
            if (msg.name === 'show_seat_map') {
                injectMarkerTone();
                showSeatMap();
                dataChannel.send(JSON.stringify({
                    type: 'conversation.item.create',
                    item: {
                        type: 'function_call_output',
                        call_id: msg.call_id,
                        output: JSON.stringify({ success: true }),
                    },
                }));
                // Map is shown — just wait for participant, no response needed

            } else if (msg.name === 'submit_page') {
                pendingSubmit = true;
                postSubmitResponseCount = 0;
                submitButton.disabled = false;
                const args = msg.arguments ? JSON.parse(msg.arguments) : {};
                if (args.choice) {
                    const choiceInput = document.getElementById('id_choice');
                    if (choiceInput) choiceInput.value = args.choice;
                    // Highlight chosen seat, dim the other
                    const chosenId = args.choice === 'seat_A' ? SEAT_A : SEAT_B;
                    const otherId  = args.choice === 'seat_A' ? SEAT_B : SEAT_A;
                    const chosenEl = document.getElementById(`seat-${chosenId}`);
                    const otherEl  = document.getElementById(`seat-${otherId}`);
                    if (chosenEl) chosenEl.classList.add('chosen');
                    if (otherEl)  otherEl.classList.add('not-chosen');
                }
                dataChannel.send(JSON.stringify({
                    type: 'conversation.item.create',
                    item: {
                        type: 'function_call_output',
                        call_id: msg.call_id,
                        output: JSON.stringify({ success: true }),
                    },
                }));
                dataChannel.send(JSON.stringify({ type: 'response.create' }));
            }
            break;

        case 'response.done':
            if (pendingSubmit) {
                postSubmitResponseCount++;
                if (postSubmitResponseCount === 2) {
                    // 2nd response.done = bridge speech response complete.
                    // Wait for the bot's audio to actually go silent before submitting.
                    pendingSubmit = false;
                    waitForSilenceThenSubmit();
                }
            } else if (seatMapShownAt === null) {
                // Wait for bot audio to finish, then force turn 2 to call show_seat_map
                waitForBotSilenceThen(() => {
                    dataChannel.send(JSON.stringify({
                        type: 'response.create',
                        response: {
                            tool_choice: { type: 'function', function: { name: 'show_seat_map' } },
                        },
                    }));
                });
            }
            break;

        case 'error':
            console.error('Realtime API error:', msg.error);
            break;
    }
}

// ── Silence detection & auto-submit ──────────────────────────────────────────

function autoSubmit() {
    submitConfirmed = true;
    submitButton.click();
}

function waitForBotSilenceThen(fn, silenceDuration = 500, safetyTimeout = 8000) {
    const SILENCE_THRESHOLD = 8;

    if (!botAnalyser) { fn(); return; }

    const buf = new Uint8Array(botAnalyser.frequencyBinCount);
    let silenceStart = null;
    const safety = setTimeout(() => fn(), safetyTimeout);

    function poll() {
        botAnalyser.getByteFrequencyData(buf);
        const peak = Math.max(...buf);
        if (peak < SILENCE_THRESHOLD) {
            if (silenceStart === null) silenceStart = performance.now();
            if (performance.now() - silenceStart >= silenceDuration) {
                clearTimeout(safety);
                fn();
                return;
            }
        } else {
            silenceStart = null;
        }
        requestAnimationFrame(poll);
    }
    poll();
}

function waitForSilenceThenSubmit() {
    waitForBotSilenceThen(autoSubmit, 700, 10000);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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


function saveToChatHistory(role, text) {
    chatHistory.push({ role, text });
    chatLogInput.value = JSON.stringify(chatHistory);
}

async function disconnect() {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        const blob = await new Promise((resolve) => {
            mediaRecorder.addEventListener('stop', () => {
                resolve(new Blob(recordingChunks, { type: 'audio/webm' }));
            });
            mediaRecorder.stop();
        });
        mediaRecorder = null;

        const urlPromise = new Promise((resolve) => {
            uploadUrlResolver = resolve;
            setTimeout(() => {
                if (uploadUrlResolver) { uploadUrlResolver(null); uploadUrlResolver = null; }
            }, 10000);
        });
        liveSend({ type: 'upload_url' });
        const presignedUrl = await urlPromise;

        if (presignedUrl) {
            try {
                await fetch(presignedUrl, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'audio/webm' },
                    body: blob,
                });
            } catch (err) {
                console.error('[disconnect] S3 upload failed:', err);
            }
        }
    }

    if (chatHistory.length > 0) {
        liveSend({ type: 'chat_log', log: JSON.stringify(chatHistory) });
    }

    // Collect WebRTC stats before closing
    if (peerConnection) {
        try {
            const stats = await peerConnection.getStats();
            const out = {};
            stats.forEach(report => {
                if (report.type === 'candidate-pair' && report.nominated) {
                    out.rtt_ms = report.currentRoundTripTime != null
                        ? Math.round(report.currentRoundTripTime * 1000) : null;
                    out.available_outgoing_bitrate = report.availableOutgoingBitrate ?? null;
                }
                if (report.type === 'inbound-rtp' && report.kind === 'audio') {
                    out.packets_received = report.packetsReceived ?? null;
                    out.packets_lost    = report.packetsLost ?? null;
                    out.jitter_ms       = report.jitter != null ? Math.round(report.jitter * 1000) : null;
                }
            });
            document.getElementById('webrtc_stats').value = JSON.stringify(out);
        } catch (e) {
            console.warn('[webrtc stats]', e);
        }
    }

    document.getElementById('time_on_page_ms').value = Date.now() - pageLoadTime;

    if (audioContext) { audioContext.close(); audioContext = null; markerDestination = null; channelMerger = null; }
    if (dataChannel) { dataChannel.close(); dataChannel = null; }
    if (peerConnection) { peerConnection.close(); peerConnection = null; }

    isConnected = false;
    currentBotMessage = null;
    statusText.textContent = 'Ended';
    indicator.classList.remove('active', 'speaking');
    connectBtn.disabled = false;
    connectBtn.classList.remove('active');
    connectBtn.classList.remove('active');
}

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (chatHistory.length > 0 && chatLogInput) {
                chatLogInput.value = JSON.stringify(chatHistory);
            }
            if (isConnected) await disconnect();
            form.submit();
        });
    }
});

window.addEventListener('beforeunload', () => {
    if (chatHistory.length > 0 && chatLogInput) {
        chatLogInput.value = JSON.stringify(chatHistory);
    }
    document.getElementById('time_on_page_ms').value = Date.now() - pageLoadTime;
});
