// This file contains the main functionality for the application.

document.addEventListener('DOMContentLoaded', function() {
    // Get user ID from localStorage if it exists (for progress tracking)
    const userId = localStorage.getItem('userId') || 1;
});

function logout() {
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    window.location.href = 'admin-login.html';
}

(function trackPlatformTime() {
    const userId = localStorage.getItem('userId') || 1;
    const storageKey = `lp_time_seconds_user_${userId}`;

    let lastTick = Date.now();
    let timer = null;

    function addElapsed() {
        const now = Date.now();
        const elapsedSec = Math.max(0, Math.floor((now - lastTick) / 1000));
        if (elapsedSec > 0) {
            const current = Number(localStorage.getItem(storageKey) || 0);
            localStorage.setItem(storageKey, String(current + elapsedSec));
        }
        lastTick = now;
    }

    function start() {
        if (timer) return;
        lastTick = Date.now();
        timer = setInterval(() => {
            if (document.visibilityState === 'visible') addElapsed();
        }, 1000);
    }

    function stop() {
        if (!timer) return;
        addElapsed();
        clearInterval(timer);
        timer = null;
    }

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') start();
        else stop();
    });

    window.addEventListener('beforeunload', addElapsed);

    start();
})();