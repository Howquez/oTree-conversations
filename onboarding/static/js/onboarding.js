// Onboarding steps configuration
const onboardingSteps = [
    {
        target: '#demo-pill',
        title: 'The Voice Recorder',
        content: 'This is your voice recorder. It stays at the bottom of the screen and lets you record and play back your audio responses.',
        highlightClass: 'onboarding-highlight-pill',
        position: 'top'
    },
    {
        target: '#record-toggle',
        title: 'Record Button',
        content: 'Tap this red button to start recording. It will turn into a stop button while recording. Tap again to stop.',
        highlightClass: 'onboarding-highlight',
        position: 'top'
    },
    {
        target: '#rerecord-btn',
        title: 'Re-record Button',
        content: 'Made a mistake? Use this button to discard your recording and start over.',
        highlightClass: 'onboarding-highlight',
        position: 'top'
    },
    {
        target: '#play-btn',
        title: 'Play Button',
        content: 'After recording, use this button to listen to your audio before submitting.',
        highlightClass: 'onboarding-highlight',
        position: 'top'
    },
    {
        target: '#test-phrase-card',
        title: 'Test Phrase',
        content: 'Now let\'s test your microphone! Read the phrase shown in the card aloud.',
        highlightClass: 'onboarding-highlight-card',
        position: 'bottom'
    },
    {
        target: '#record-toggle',
        title: 'Try It Now!',
        content: 'Press the record button, say "The cat is black", then press stop. After that, listen to your recording to check the audio quality.',
        highlightClass: 'onboarding-highlight',
        position: 'top'
    }
];

// State
let currentStep = 0;
let audioRecorder;
let audioChunks = [];
let isRecording = false;
let hasRecording = false;
let hasListened = false;
let audioBlob = null;

// Onboarding elements
const overlay = document.getElementById('onboarding-overlay');
const tooltip = document.getElementById('onboarding-tooltip');
const tooltipTitle = document.getElementById('tooltip-title');
const tooltipContent = document.getElementById('tooltip-content');
const currentStepSpan = document.getElementById('current-step');
const totalStepsSpan = document.getElementById('total-steps');
const prevBtn = document.getElementById('onboarding-prev');
const nextBtn = document.getElementById('onboarding-next');
const restartBtn = document.getElementById('restart-onboarding');
const continueBtn = document.getElementById('continue-btn');

// Recording elements
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

// Quality confirmation elements
const qualityCard = document.getElementById('quality-card');
const qualityConfirm = document.getElementById('quality-confirm');

// Test phrase and transcript elements
const testPhraseCard = document.getElementById('test-phrase-card');
const transcriptCard = document.getElementById('transcript-card');
const transcriptPlaceholder = document.getElementById('transcript-placeholder');
const transcriptText = document.getElementById('transcript-text');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    totalStepsSpan.textContent = onboardingSteps.length;
    showStep(0);

    prevBtn.addEventListener('click', previousStep);
    nextBtn.addEventListener('click', nextStep);
    restartBtn.addEventListener('click', restartOnboarding);
    qualityConfirm.addEventListener('change', onQualityConfirmChange);

    initializeRecorder();
});

// Initialize media recorder
function initializeRecorder() {
    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
        .then(stream => {
            const options = { mimeType: 'audio/webm; codecs=opus' };
            audioRecorder = new MediaRecorder(stream, options);

            audioRecorder.addEventListener('dataavailable', e => {
                audioChunks.push(e.data);
            });

            audioRecorder.addEventListener('stop', () => {
                audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                audioPlayback.src = URL.createObjectURL(audioBlob);
                hasRecording = true;
                hasListened = false;
                qualityConfirm.checked = false;
                qualityConfirm.disabled = true;
                updateContinueButton();

                // Send to server for transcription
                transcriptCard.style.display = 'block';
                transcriptPlaceholder.style.display = 'block';
                transcriptText.textContent = '';

                const reader = new FileReader();
                reader.onloadend = () => {
                    const base64 = reader.result.split(',')[1];
                    liveSend({ 'audio': base64 });
                };
                reader.readAsDataURL(audioBlob);
            });

        }).catch(err => {
            console.log('Error: ' + err);
            statusText.textContent = 'Mic access denied';
            recordToggle.disabled = true;
        });

    // Recording controls
    recordToggle.addEventListener('click', () => {
        if (!isRecording) {
            startRecording();
        } else {
            stopRecording();
        }
    });

    rerecordBtn.addEventListener('click', () => {
        if (audioPlayback.paused === false) {
            audioPlayback.pause();
            audioPlayback.currentTime = 0;
            showPlayIcon();
        }
        startRecording();
    });

    playBtn.addEventListener('click', () => {
        if (audioPlayback.paused) {
            audioPlayback.play();
            showPauseIcon();
            hasListened = true;
        } else {
            audioPlayback.pause();
            showPlayIcon();
        }
    });

    audioPlayback.addEventListener('ended', () => {
        showPlayIcon();
        // Enable quality confirmation after listening
        if (hasListened) {
            qualityCard.style.display = 'block';
            qualityConfirm.disabled = false;
        }
    });
}

function startRecording() {
    audioChunks = [];
    audioRecorder.start();
    isRecording = true;

    statusText.textContent = 'Recording...';
    indicator.classList.add('active');
    indicator.classList.remove('has-recording');
    micIcon.style.display = 'none';
    stopIcon.style.display = 'block';
    recordToggle.classList.add('recording');
    rerecordBtn.disabled = true;
    playBtn.disabled = true;

    // Hide quality confirmation when re-recording
    qualityCard.style.display = 'none';
    qualityConfirm.checked = false;
    qualityConfirm.disabled = true;
    updateContinueButton();
}

function stopRecording() {
    audioRecorder.stop();
    isRecording = false;

    statusText.textContent = 'Recording complete';
    indicator.classList.remove('active');
    indicator.classList.add('has-recording');
    micIcon.style.display = 'block';
    stopIcon.style.display = 'none';
    recordToggle.classList.remove('recording');
    rerecordBtn.disabled = false;
    playBtn.disabled = false;
}

function showPlayIcon() {
    playIcon.style.display = 'block';
    pauseIcon.style.display = 'none';
}

function showPauseIcon() {
    playIcon.style.display = 'none';
    pauseIcon.style.display = 'block';
}

function onQualityConfirmChange() {
    updateContinueButton();
}

function updateContinueButton() {
    continueBtn.disabled = !qualityConfirm.checked;
}

// Handle transcript from server
function liveRecv(data) {
    console.log("liveRecv data:", JSON.stringify(data));
    const transcript = data["text"];
    transcriptPlaceholder.style.display = 'none';
    if (transcript) {
        transcriptText.textContent = transcript;
    } else {
        transcriptText.textContent = 'Unable to transcribe audio.';
    }
}

// Onboarding step functions
function showStep(stepIndex) {
    document.querySelectorAll('.onboarding-highlight, .onboarding-highlight-pill, .onboarding-highlight-card').forEach(el => {
        el.classList.remove('onboarding-highlight', 'onboarding-highlight-pill', 'onboarding-highlight-card');
    });

    const step = onboardingSteps[stepIndex];
    const targetEl = document.querySelector(step.target);

    // Show test phrase card from step 5 onwards (index 4)
    if (stepIndex >= 4) {
        testPhraseCard.style.display = 'block';
    } else {
        testPhraseCard.style.display = 'none';
    }

    if (!targetEl) return;

    currentStepSpan.textContent = stepIndex + 1;
    tooltipTitle.textContent = step.title;
    tooltipContent.textContent = step.content;

    targetEl.classList.add(step.highlightClass);
    positionTooltip(targetEl, step.position);

    prevBtn.style.display = stepIndex === 0 ? 'none' : 'block';
    nextBtn.textContent = stepIndex === onboardingSteps.length - 1 ? 'Got it!' : 'Next';

    currentStep = stepIndex;
}

function positionTooltip(targetEl, position) {
    const targetRect = targetEl.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    tooltip.classList.remove('arrow-top', 'arrow-bottom');

    let top, left;

    if (position === 'top') {
        top = targetRect.top - tooltipRect.height - 20;
        left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
        tooltip.classList.add('arrow-bottom');
    } else {
        top = targetRect.bottom + 20;
        left = targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);
        tooltip.classList.add('arrow-top');
    }

    const padding = 16;
    if (left < padding) left = padding;
    if (left + tooltipRect.width > window.innerWidth - padding) {
        left = window.innerWidth - tooltipRect.width - padding;
    }
    if (top < padding) top = targetRect.bottom + 20;

    tooltip.style.top = `${top}px`;
    tooltip.style.left = `${left}px`;
}

function nextStep() {
    if (currentStep < onboardingSteps.length - 1) {
        showStep(currentStep + 1);
    } else {
        completeOnboarding();
    }
}

function previousStep() {
    if (currentStep > 0) {
        showStep(currentStep - 1);
    }
}

function completeOnboarding() {
    document.querySelectorAll('.onboarding-highlight, .onboarding-highlight-pill, .onboarding-highlight-card').forEach(el => {
        el.classList.remove('onboarding-highlight', 'onboarding-highlight-pill', 'onboarding-highlight-card');
    });

    overlay.classList.add('hidden');
    tooltip.classList.add('hidden');
    restartBtn.style.display = 'inline-block';
}

function restartOnboarding() {
    restartBtn.style.display = 'none';
    overlay.classList.remove('hidden');
    tooltip.classList.remove('hidden');
    showStep(0);
}
