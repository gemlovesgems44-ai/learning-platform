// This file manages the progress page, fetching and displaying user progress data.

document.addEventListener('DOMContentLoaded', async function () {
    const userId = Number(localStorage.getItem('userId') || 1);

    try {
        const [progressData, suggestionsData] = await Promise.all([
            fetchProgressData(userId),
            fetchSuggestionsData(userId)
        ]);

        renderProgress(progressData);
        renderAdaptiveSuggestions(progressData, suggestionsData);
    } catch (error) {
        console.error('Error loading progress page:', error);
        const progressList = document.getElementById('progress-list');
        const suggestions = document.getElementById('suggestions');
        if (progressList) progressList.innerHTML = '<p>Could not load progress data.</p>';
        if (suggestions) suggestions.innerHTML = '<p>Could not load suggestions.</p>';
    }
});

// Helper function to safely format dates.
function formatDate(dateString) {
    if (!dateString) return 'N/A';

    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'N/A';
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } catch {
        return 'N/A';
    }
}

function normalizeId(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
}

async function fetchProgressData(userId) {
    const res = await fetch(`/backend/api/progress.php?userId=${encodeURIComponent(userId)}`);
    if (!res.ok) throw new Error(`Progress API failed (${res.status})`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
}

async function fetchSuggestionsData(userId) {
    const res = await fetch(`/backend/api/suggestions.php?userId=${encodeURIComponent(userId)}`);
    if (!res.ok) throw new Error(`Suggestions API failed (${res.status})`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
}

function getCompletionPercent(item) {
    const raw =
        item.completionPercent ??
        item.completion_percent ??
        item.progress ??
        item.percent_complete ??
        null;

    const n = Number(raw);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.min(100, Math.round(n)));
}

function isCompleted(item) {
    const flag = item.completed ?? item.is_completed ?? item.isCompleted ?? null;
    if (typeof flag === 'boolean') return flag;
    if (flag === 1 || flag === '1' || flag === 'true') return true;

    const pct = getCompletionPercent(item);
    return pct === 100;
}

function renderProgress(data) {
    const progressList = document.getElementById('progress-list');
    if (!progressList) return;

    if (!Array.isArray(data) || data.length === 0) {
        progressList.innerHTML = '<p>No lesson activity yet. Start a course!</p>';
        return;
    }

    progressList.innerHTML = data.map((item, idx) => {
        const title = item.lessonTitle || item.lesson_title || item.title || `Lesson ${idx + 1}`;
        const dateField =
            item.completedAt ||
            item.completed_at ||
            item.updated_at ||
            item.dateCompleted ||
            item.date_completed ||
            null;

        const pct = getCompletionPercent(item);
        const completed = isCompleted(item);
        const statusText = completed ? 'Completed' : 'In progress';
        const pctText = pct !== null ? `${pct}%` : (completed ? '100%' : '0%');

        return `
            <div class="progress-item">
                <span class="progress-item-title">${title}</span>
                <span class="progress-item-status">${statusText} · ${pctText}</span>
                <span class="progress-item-status">Last activity: ${formatDate(dateField)}</span>
            </div>
        `;
    }).join('');
}

function buildModuleProgressMap(progressData) {
    const map = new Map();

    progressData.forEach((p) => {
        const moduleId = normalizeId(p.moduleId ?? p.module_id ?? p.id);
        if (moduleId == null) return;

        if (!map.has(moduleId)) {
            map.set(moduleId, {
                completedCount: 0,
                wrongAttempts: 0,
                accuracy: null
            });
        }

        const row = map.get(moduleId);
        row.completedCount += 1;

        const wrongAttempts = Number(p.wrongAttempts ?? p.wrong_attempts ?? p.mistakes ?? 0);
        if (Number.isFinite(wrongAttempts)) row.wrongAttempts += wrongAttempts;

        const acc = Number(p.accuracy ?? p.score ?? p.avg_score);
        if (Number.isFinite(acc)) row.accuracy = acc;
    });

    return map;
}

function resolveModuleId(item) {
    const raw =
        item?.moduleId ??
        item?.module_id ??
        item?.moduleid ??
        item?.id ??
        item?.courseId ??
        item?.course_id ??
        null;

    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : null;
}

function renderAdaptiveSuggestions(progressData, suggestionsData) {
    const suggestionsEl = document.getElementById('suggestions');
    if (!suggestionsEl) return;

    if (!Array.isArray(suggestionsData) || suggestionsData.length === 0) {
        suggestionsEl.innerHTML = '<p>No suggestions available yet.</p>';
        return;
    }

    const top = suggestionsData.slice(0, 3);
    const cards = top
        .map((item) => {
            const moduleId = resolveModuleId(item);
            if (!moduleId) return '';

            return `
                <div class="suggestion-card">
                    <h3>${item.title || item.courseName || 'Course'}</h3>
                    <p>${item.description || item.courseDescription || 'Recommended next step based on your progress.'}</p>
                    <a href="lesson.html?moduleId=${encodeURIComponent(moduleId)}" class="btn btn-primary">Start</a>
                </div>
            `;
        })
        .filter(Boolean)
        .join('');

    suggestionsEl.innerHTML = cards || '<p>No valid suggestions available yet.</p>';
}