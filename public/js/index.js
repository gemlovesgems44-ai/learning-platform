document.addEventListener('DOMContentLoaded', async () => {
    const userId = Number(localStorage.getItem('userId') || 1);

    try {
        const [progressRows, suggestions] = await Promise.all([
            fetchProgressData(userId),
            fetchSuggestionsData(userId)
        ]);

        renderProgressOverview(progressRows, suggestions);
    } catch (err) {
        console.error('Failed to load progress overview:', err);
        renderFallback();
    }
});

async function fetchProgressData(userId) {
    const res = await fetch(`/backend/api/progress.php?userId=${encodeURIComponent(userId)}`);
    if (!res.ok) throw new Error(`Progress API failed (${res.status})`);
    const data = await res.json();

    console.log('[index] progress raw payload:', data);

    // progress.php shape: { userId, progress: [...], overview: {...} }
    if (Array.isArray(data?.progress)) return data.progress;

    // fallback if endpoint ever returns array directly
    if (Array.isArray(data)) return data;

    return [];
}

async function fetchSuggestionsData(userId) {
    const res = await fetch(`/backend/api/suggestions.php?userId=${encodeURIComponent(userId)}`);
    if (!res.ok) return []; // keep overview working even if suggestions fail
    const data = await res.json();
    return Array.isArray(data) ? data : [];
}

function toNumber(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
}

function resolveModuleId(item) {
    return toNumber(
        item?.module_id ??
        item?.moduleId ??
        item?.id ??
        item?.courseId,
        0
    );
}

function isCompleted(row) {
    const completed = row?.completed;
    const status = String(row?.status || '').toLowerCase();
    return completed === 1 || completed === true || status === 'completed';
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const d = new Date(dateString);
    return Number.isNaN(d.getTime()) ? 'N/A' : d.toLocaleDateString();
}

function renderProgressOverview(progressRows, suggestions) {
    const completedLessons = progressRows.filter(isCompleted).length;

    const startedModules = new Set(
        progressRows
            .map(resolveModuleId)
            .filter((id) => id > 0)
    ).size;

    // If your API later adds duration_minutes per row, this will use it.
    const totalMinutes = progressRows.reduce((sum, row) => {
        return sum + toNumber(row.duration_minutes ?? row.lesson_duration_minutes ?? 0, 0);
    }, 0);
    const totalHours = totalMinutes > 0 ? (totalMinutes / 60).toFixed(1) : '0';

    const completedEl = document.getElementById('completed-lessons');
    const hoursEl = document.getElementById('total-hours');
    const startedEl = document.getElementById('courses-started');

    if (completedEl) completedEl.textContent = String(completedLessons);
    if (hoursEl) hoursEl.textContent = String(totalHours);
    if (startedEl) startedEl.textContent = String(startedModules);

    renderRecentLessons(progressRows);
    renderNextSuggestion(suggestions);
}

function renderRecentLessons(progressRows) {
    const host = document.getElementById('recent-lessons');
    if (!host) return;

    if (!progressRows.length) {
        host.innerHTML = '<p>No recent activity yet.</p>';
        return;
    }

    const recent = [...progressRows]
        .sort((a, b) => new Date(b.completed_at || 0) - new Date(a.completed_at || 0))
        .slice(0, 5);

    host.innerHTML = recent.map((row) => {
        const title = row.lesson_title || row.lessonTitle || 'Lesson';
        const when = formatDate(row.completed_at || row.completedAt);
        const state = isCompleted(row) ? 'Completed' : (row.status || 'In progress');
        return `<p>${title} — ${state} (${when})</p>`;
    }).join('');
}

function renderNextSuggestion(suggestions) {
    const host = document.getElementById('next-suggestion');
    if (!host) return;

    if (!suggestions.length) {
        host.innerHTML = '<p>No recommendation available yet. Continue your current module.</p>';
        return;
    }

    const item = suggestions[0];
    const moduleId = resolveModuleId(item);
    const title = item.title || item.courseName || 'Recommended module';
    const desc = item.description || 'Continue learning with this next module.';

    if (moduleId > 0) {
        host.innerHTML = `
            <p><strong>${title}</strong></p>
            <p>${desc}</p>
            <a class="btn" href="lesson.html?moduleId=${encodeURIComponent(moduleId)}">Start</a>
        `;
    } else {
        host.innerHTML = `<p><strong>${title}</strong></p><p>${desc}</p>`;
    }
}

function renderFallback() {
    const ids = ['completed-lessons', 'total-hours', 'courses-started'];
    ids.forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.textContent = '0';
    });

    const recent = document.getElementById('recent-lessons');
    const next = document.getElementById('next-suggestion');
    if (recent) recent.innerHTML = '<p>Could not load recent activity.</p>';
    if (next) next.innerHTML = '<p>Could not load recommendation.</p>';
}