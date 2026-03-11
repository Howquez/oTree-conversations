document.addEventListener('DOMContentLoaded', function () {
    const audio             = document.getElementById('audioPlayer');
    const playPauseBtn      = document.getElementById('playPauseBtn');
    const playIcon          = document.getElementById('playIcon');
    const pauseIcon         = document.getElementById('pauseIcon');
    const progressContainer = document.getElementById('progressContainer');
    const progressBar       = document.getElementById('progressBar');
    const timeDisplay       = document.getElementById('timeDisplay');
    const replayBtn         = document.getElementById('replayBtn');
    const listeningIndicator = document.getElementById('listeningIndicator');
    const textareaSection   = document.getElementById('textareaSection');
    const nextSection       = document.getElementById('nextSection');
    const textarea          = document.getElementById('control_question');
    const errorMessage      = document.getElementById('clientErrorMessage');
    const hasListenedField  = document.getElementById('id_has_listened');

    const CORRECT_ANSWER    = 'cat';

    let hasFinishedListening = false;
    let minimumListenTime    = 0;

    // Play / pause
    playPauseBtn.addEventListener('click', () => {
        audio.paused ? audio.play() : audio.pause();
    });

    audio.addEventListener('play', () => {
        playIcon.style.display  = 'none';
        pauseIcon.style.display = 'block';
        if (hasListenedField) hasListenedField.value = 'True';
    });

    audio.addEventListener('pause', () => {
        playIcon.style.display  = 'block';
        pauseIcon.style.display = 'none';
    });

    audio.addEventListener('ended', () => {
        playIcon.style.display  = 'block';
        pauseIcon.style.display = 'none';
        handleListeningComplete();
    });

    audio.addEventListener('loadedmetadata', () => {
        updateTimeDisplay();
        minimumListenTime = Math.max(audio.duration * 0.8, Math.min(5, audio.duration));
    });

    audio.addEventListener('timeupdate', () => {
        if (audio.duration) {
            progressBar.style.width = (audio.currentTime / audio.duration * 100) + '%';
            updateTimeDisplay();
            if (!hasFinishedListening && audio.currentTime >= minimumListenTime) {
                handleListeningComplete();
            }
        }
    });

    progressContainer.addEventListener('click', (e) => {
        if (audio.duration) {
            const rect = progressContainer.getBoundingClientRect();
            audio.currentTime = ((e.clientX - rect.left) / rect.width) * audio.duration;
        }
    });

    replayBtn.addEventListener('click', () => {
        audio.currentTime = 0;
        audio.play();
    });

    textarea.addEventListener('input', function () {
        const val = this.value.trim().toLowerCase();
        textarea.classList.remove('is-valid', 'is-invalid');

        if (val.length === 0) {
            hideNextSection();
            errorMessage.style.display = 'none';
        } else if (val === CORRECT_ANSWER) {
            textarea.classList.add('is-valid');
            errorMessage.style.display = 'none';
            showNextSection();
        } else {
            textarea.classList.add('is-invalid');
            errorMessage.textContent   = 'Please listen to the audio carefully and type the correct word.';
            errorMessage.style.display = 'block';
            hideNextSection();
        }
    });

    // Space bar toggles play/pause when textarea not focused
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && document.activeElement.tagName !== 'TEXTAREA') {
            e.preventDefault();
            playPauseBtn.click();
        }
    });

    function handleListeningComplete() {
        if (hasFinishedListening) return;
        hasFinishedListening = true;
        listeningIndicator.classList.add('active');
        setTimeout(() => {
            textareaSection.style.display = 'block';
            setTimeout(() => {
                textareaSection.classList.add('show');
                setTimeout(() => textarea.focus(), 400);
            }, 50);
        }, 800);
    }

    function showNextSection() {
        nextSection.style.display = 'block';
        setTimeout(() => nextSection.classList.add('show'), 50);
    }

    function hideNextSection() {
        nextSection.classList.remove('show');
        setTimeout(() => {
            if (!nextSection.classList.contains('show')) nextSection.style.display = 'none';
        }, 400);
    }

    function updateTimeDisplay() {
        timeDisplay.textContent = formatTime(audio.currentTime || 0) + ' / ' + formatTime(audio.duration || 0);
    }

    function formatTime(s) {
        return Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
    }
});
