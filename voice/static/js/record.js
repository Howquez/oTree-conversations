// Elements
const recordToggle = document.getElementById('record-toggle');
const rerecordBtn = document.getElementById('rerecord-btn');
const playBtn = document.getElementById('play-btn');
const statusText = document.getElementById('status-text');
const indicator = document.getElementById('recording-indicator');
const micIcon = document.getElementById('mic-icon');
const stopIcon = document.getElementById('stop-icon');
const playIcon = document.getElementById('play-icon');
const pauseIcon = document.getElementById('pause-icon');
const audioPlayback = document.getElementById('audio-playback');
const transcriptDiv = document.getElementById('id_transcript');
const transcriptPlaceholder = document.getElementById('transcript-placeholder');
const contentPlaceholder = document.getElementById('content-placeholder');
const contentArea = document.getElementById('content-area');
const submitButton = document.getElementById('submit_button');

let audioRecorder;
let audioChunks = [];
let isRecording = false;
let hasRecording = false;
let audioBlob = null;

// Initialize media recorder
navigator.mediaDevices.getUserMedia({ audio: true, video: false })
    .then(stream => {
        const options = { mimeType: 'video/webm; codecs=opus' };
        audioRecorder = new MediaRecorder(stream, options);

        audioRecorder.addEventListener('dataavailable', e => {
            audioChunks.push(e.data);
        });

        audioRecorder.addEventListener('stop', () => {
            audioBlob = new Blob(audioChunks, { type: 'video/webm' });
            audioPlayback.src = URL.createObjectURL(audioBlob);

            // Convert to base64 and send
            const reader = new FileReader();
            reader.onloadend = () => {
                const base64 = reader.result.split(',')[1];
                liveSend({ 'text': base64 });
            };
            reader.readAsDataURL(audioBlob);
        });

    }).catch(err => {
        console.log('Error: ' + err);
        statusText.textContent = 'Mic access denied';
        recordToggle.disabled = true;
    });

// Record toggle
recordToggle.addEventListener('click', () => {
    if (!isRecording) {
        startRecording();
    } else {
        stopRecording();
    }
});

// Re-record
rerecordBtn.addEventListener('click', () => {
    if (audioPlayback.paused === false) {
        audioPlayback.pause();
        audioPlayback.currentTime = 0;
        showPlayIcon();
    }
    startRecording();
});

// Play/Pause
playBtn.addEventListener('click', () => {
    if (audioPlayback.paused) {
        audioPlayback.play();
        showPauseIcon();
    } else {
        audioPlayback.pause();
        showPlayIcon();
    }
});

audioPlayback.addEventListener('ended', () => {
    showPlayIcon();
});

function startRecording() {
    audioChunks = [];
    audioRecorder.start();
    isRecording = true;

    // Update UI
    statusText.textContent = 'Recording...';
    indicator.classList.add('active');
    indicator.classList.remove('has-recording');
    micIcon.style.display = 'none';
    stopIcon.style.display = 'block';
    recordToggle.classList.add('recording');
    rerecordBtn.disabled = true;
    playBtn.disabled = true;

    // Show placeholder, hide transcript
    transcriptPlaceholder.style.display = 'block';
    transcriptDiv.style.display = 'none';
    transcriptDiv.classList.remove('processing');
}

function stopRecording() {
    audioRecorder.stop();
    isRecording = false;
    hasRecording = true;

    // Update UI
    statusText.textContent = 'Processing...';
    indicator.classList.remove('active');
    indicator.classList.add('has-recording');
    micIcon.style.display = 'block';
    stopIcon.style.display = 'none';
    recordToggle.classList.remove('recording');
    rerecordBtn.disabled = false;
    playBtn.disabled = false;

    // Keep placeholder visible while processing
    transcriptPlaceholder.style.display = 'block';
    transcriptDiv.style.display = 'none';
}

function showPlayIcon() {
    playIcon.style.display = 'block';
    pauseIcon.style.display = 'none';
}

function showPauseIcon() {
    playIcon.style.display = 'none';
    pauseIcon.style.display = 'block';
}

// Handle transcript updates
function liveRecv(data) {
    const transcript = data["text"];
    if (transcript) {
        // Hide placeholder, show transcript
        transcriptPlaceholder.style.display = 'none';
        transcriptDiv.style.display = 'block';
        transcriptDiv.textContent = transcript;
        transcriptDiv.classList.remove('processing');
        statusText.textContent = 'Recording saved';

        // Enable the Next button
        submitButton.disabled = false;
    } else if (hasRecording) {
        // Keep showing placeholder while processing
        transcriptPlaceholder.style.display = 'block';
        transcriptDiv.style.display = 'none';
    }
}

// Helper functions for content placeholder area
function showContentPlaceholder() {
    contentPlaceholder.style.display = 'block';
    contentArea.style.display = 'none';
}

function hideContentPlaceholder() {
    contentPlaceholder.style.display = 'none';
    contentArea.style.display = 'block';
}

function setContent(html) {
    contentArea.innerHTML = html;
    hideContentPlaceholder();
}

document.addEventListener("DOMContentLoaded", function(event) {
    liveSend({});
});
