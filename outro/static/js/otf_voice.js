// ── State ─────────────────────────────────────────────────────────────────────
let peerConnection = null;
let dataChannel    = null;
let isConnected    = false;

// ── Elements ──────────────────────────────────────────────────────────────────
let connectBtn, statusText, indicator;
let otfField, modeField, submitVoiceBtn, previewBox, previewText;

document.addEventListener('DOMContentLoaded', () => {
    connectBtn     = document.getElementById('connect-btn');
    statusText     = document.getElementById('status-text');
    indicator      = document.getElementById('recording-indicator');
    otfField       = document.getElementById('id_OTF');
    modeField      = document.getElementById('id_OTF_input_mode');
    submitVoiceBtn = document.getElementById('submitButton-voice');
    previewBox     = document.getElementById('otf-preview-box');
    previewText    = document.getElementById('otf-transcript-preview');

    const btnText  = document.getElementById('btn-text-mode');
    const btnVoice = document.getElementById('btn-voice-mode');
    const textSec  = document.getElementById('otf-text-section');
    const voiceSec = document.getElementById('otf-voice-section');
    const voicePill = document.getElementById('voice-pill');
    const pillSpacer = document.getElementById('pill-spacer');

    btnText.addEventListener('click', () => {
        btnText.classList.add('active');
        btnVoice.classList.remove('active');
        textSec.style.display = '';
        voiceSec.style.display = 'none';
        voicePill.style.display = 'none';
        pillSpacer.style.display = 'none';
        modeField.value = 'text';
    });

    btnVoice.addEventListener('click', () => {
        btnVoice.classList.add('active');
        btnText.classList.remove('active');
        textSec.style.display = 'none';
        voiceSec.style.display = '';
        voicePill.style.display = 'flex';
        pillSpacer.style.display = '';
        modeField.value = 'voice';
    });

    connectBtn.addEventListener('click', () => {
        if (!isConnected) requestToken();
        else disconnect();
    });
});

// ── oTree live channel ────────────────────────────────────────────────────────
function requestToken() {
    statusText.textContent = 'Connecting…';
    connectBtn.disabled = true;
    liveSend({ type: 'otf_token' });
}

function liveRecv(data) {
    if (data.type === 'token') {
        setupWebRTC(data.token);
    } else if (data.type === 'error') {
        statusText.textContent = 'Error — please type instead.';
        connectBtn.disabled = false;
    }
}

// ── WebRTC ────────────────────────────────────────────────────────────────────
async function setupWebRTC(token) {
    peerConnection = new RTCPeerConnection();

    const audioEl = document.createElement('audio');
    audioEl.autoplay = true;
    peerConnection.ontrack = e => { audioEl.srcObject = e.streams[0]; };

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach(t => peerConnection.addTrack(t, stream));

    dataChannel = peerConnection.createDataChannel('oai-events');
    dataChannel.onopen    = onDataChannelOpen;
    dataChannel.onmessage = onDataChannelMessage;

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    const resp = await fetch('https://api.openai.com/v1/realtime?model=gpt-realtime-1.5', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/sdp',
        },
        body: offer.sdp,
    });

    const sdp = await resp.text();
    await peerConnection.setRemoteDescription({ type: 'answer', sdp });

    isConnected = true;
    connectBtn.disabled = false;
    connectBtn.classList.add('active');
    indicator.classList.add('active');
    statusText.textContent = 'Connected';
}

function onDataChannelOpen() {
    dataChannel.send(JSON.stringify({
        type: 'session.update',
        session: {
            turn_detection: {
                type: 'server_vad',
                threshold: 0.75,
                silence_duration_ms: 1500,
            },
            input_audio_transcription: {
                model: 'whisper-1',
                language: 'en',
            },
        },
    }));
    dataChannel.send(JSON.stringify({ type: 'response.create' }));
}

function onDataChannelMessage(event) {
    const msg = JSON.parse(event.data);

    if (msg.type === 'input_audio_buffer.speech_started') {
        indicator.classList.add('speaking');
        statusText.textContent = 'Listening…';
    }
    if (msg.type === 'input_audio_buffer.speech_stopped') {
        indicator.classList.remove('speaking');
        statusText.textContent = 'Processing…';
    }
    if (msg.type === 'response.audio_transcript.delta') {
        statusText.textContent = 'Speaking…';
    }
    if (msg.type === 'response.audio.done') {
        statusText.textContent = 'Listening…';
    }

    if (msg.type === 'response.function_call_arguments.done' && msg.name === 'submit_feedback') {
        const args = JSON.parse(msg.arguments);
        const transcript = (args.transcript || '').trim();

        // Fill OTF textarea and show preview
        otfField.value = transcript;
        previewText.textContent = transcript;
        previewBox.style.display = 'block';

        // Enable submit
        submitVoiceBtn.disabled = false;
        statusText.textContent = 'Done ✓';
        indicator.classList.remove('active', 'speaking');

        // Acknowledge tool call
        dataChannel.send(JSON.stringify({
            type: 'conversation.item.create',
            item: {
                type: 'function_call_output',
                call_id: msg.call_id,
                output: '{"ok": true}',
            },
        }));

        disconnect();
    }
}

function disconnect() {
    if (peerConnection) { peerConnection.close(); peerConnection = null; }
    isConnected = false;
    connectBtn.classList.remove('active');
}
