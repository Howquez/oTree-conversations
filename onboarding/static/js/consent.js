const micToggle = document.getElementById('micPermission');
const micStatus = document.getElementById('mic-status');
const micIcon = document.getElementById('mic-icon');

// Check existing permission status on load
if (navigator.permissions && navigator.permissions.query) {
    navigator.permissions.query({ name: 'microphone' }).then(result => {
        updatePermissionStatus(result.state);
        result.onchange = () => updatePermissionStatus(result.state);
    }).catch(() => {
        // Permissions API not supported, wait for user action
    });
}

micToggle.addEventListener('change', async function() {
    if (this.checked) {
        try {
            micStatus.textContent = 'Requesting access...';
            micIcon.textContent = '';
            micIcon.className = 'ms-2 pending';

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Permission granted - stop the stream immediately (we just needed permission)
            stream.getTracks().forEach(track => track.stop());

            updatePermissionStatus('granted');
        } catch (err) {
            console.log('Microphone permission denied:', err);
            updatePermissionStatus('denied');
            this.checked = false;
        }
    }
});

function updatePermissionStatus(state) {
    micIcon.className = 'ms-2 ' + state;

    if (state === 'granted') {
        micStatus.textContent = 'Microphone access granted';
        micIcon.textContent = '\u2713';
        micToggle.checked = true;
        micToggle.disabled = true;
    } else if (state === 'denied') {
        micStatus.textContent = 'Microphone access denied - please enable in browser settings';
        micIcon.textContent = '\u2717';
        micToggle.checked = false;
    } else {
        micStatus.textContent = 'Click to enable microphone access';
        micIcon.textContent = '';
    }
}
