// This file manages the progress page, fetching and displaying user progress data.

document.addEventListener('DOMContentLoaded', async function () {
    const userId = Number(localStorage.getItem('userId') || 1);

    try {
        const [{ progressData }, { suggestions, aiSuggestion }, modulesData] = await Promise.all([
            fetchProgressData(userId),
            fetchSuggestionsData(userId),
            fetchModulesData()
        ]);

        console.log('[progress] progressData:', progressData);
        console.log('[progress] modulesData:', modulesData);
        console.log('[progress] confidence rows:', progressData.filter(p => p.confidence_before != null || p.confidence_after != null));

        renderProgress(progressData);
        const recommended = renderAdaptiveSuggestions(progressData, suggestions, modulesData);
        renderOverview(progressData, suggestions, modulesData, recommended, aiSuggestion);
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

    const payload = await res.json();
    console.log('[progress] raw payload:', payload);

    // IMPORTANT: progress.php returns { progress: [...], overview: {...} }
    const progressData = Array.isArray(payload?.progress) ? payload.progress : [];
    const overview = payload?.overview ?? {
        completedLessons: 0,
        practiceSuccessRate: 0,
        averageConfidenceImprovement: 0
    };

    return { progressData, overview };
}

async function fetchSuggestionsData(userId) {
    const res = await fetch(`/backend/api/suggestions.php?userId=${encodeURIComponent(userId)}`);
    if (!res.ok) throw new Error(`Suggestions API failed (${res.status})`);
    const data = await res.json();
    console.log('[suggestions] payload:', data);

    // normalize: now returns { suggestions: [...], aiSuggestion: {...}|null }
    const suggestions = Array.isArray(data?.suggestions) ? data.suggestions : (Array.isArray(data) ? data : []);
    const aiSuggestion = data?.aiSuggestion ?? null;

    return { suggestions, aiSuggestion };
}

async function fetchModulesData() {
    try {
        const res = await fetch('/backend/api/modules.php');
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
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

    const status = String(item.status ?? '').toLowerCase();
    if (status === 'completed' || status === 'complete' || status === 'passed') return true;

    if (item.completed_at || item.completedAt) return true;

    const lastScore = Number(item.last_score ?? item.lastScore ?? item.score ?? item.quiz_score);
    if (Number.isFinite(lastScore) && lastScore >= 100) return true;

    const pct = getCompletionPercent(item);
    return pct === 100;
}

let progressExpanded = false;

function renderProgress(data) {
    const progressList = document.getElementById('progress-list');
    if (!progressList) return;

    if (!Array.isArray(data) || data.length === 0) {
        progressList.innerHTML = '<p>No lesson activity yet. Start a course!</p>';
        return;
    }

    const visibleCount = progressExpanded ? data.length : 5;
    const visibleItems = data.slice(0, visibleCount);

    const rows = visibleItems.map((item, idx) => {
        const title = item.lessonTitle || item.lesson_title || item.title || `Lesson ${idx + 1}`;
        const dateField =
            item.completedAt ||
            item.completed_at ||
            item.updated_at ||
            item.dateCompleted ||
            item.date_completed ||
            null;

        const completed = isCompleted(item);
        const statusText = completed ? 'Completed' : 'Not completed';
        const tick = completed ? '✓' : '○';
        const tickClass = completed ? 'is-complete' : 'is-incomplete';

        return `
            <div class="progress-item">
                <div class="progress-item-row">
                    <span class="progress-item-title">${title}</span>
                    <span class="progress-complete-badge ${tickClass}" aria-label="${statusText}">
                        ${tick} ${statusText}
                    </span>
                </div>
                <span class="progress-item-status">Last activity: ${formatDate(dateField)}</span>
            </div>
        `;
    }).join('');

    const hasMore = data.length > 5;
    const toggleBtn = hasMore
        ? `
            <button id="progress-toggle-btn" type="button" class="btn btn-secondary">
                ${progressExpanded ? 'Show less' : `Show all (${data.length})`}
            </button>
          `
        : '';

    progressList.innerHTML = rows + toggleBtn;

    if (hasMore) {
        const btn = document.getElementById('progress-toggle-btn');
        btn?.addEventListener('click', () => {
            progressExpanded = !progressExpanded;
            renderProgress(data);
        });
    }
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

function tokenize(text) {
    return String(text || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter(Boolean)
        .filter(w => !['the', 'and', 'for', 'with', 'from', 'your', 'this', 'that', 'into'].includes(w));
}

function jaccard(aTokens, bTokens) {
    const a = new Set(aTokens);
    const b = new Set(bTokens);
    if (a.size === 0 || b.size === 0) return 0;

    let intersection = 0;
    a.forEach((t) => { if (b.has(t)) intersection += 1; });
    const union = new Set([...a, ...b]).size;
    return union ? (intersection / union) : 0;
}

function pickRandom(arr) {
    if (!arr.length) return null;
    return arr[Math.floor(Math.random() * arr.length)];
}

function renderAdaptiveSuggestions(progressData, suggestionsData, modulesData = []) {
    const suggestionsEl = document.getElementById('suggestions');
    if (!suggestionsEl) return;

    // Prefer full catalog; fallback to suggestions API data.
    const catalog = Array.isArray(modulesData) && modulesData.length ? modulesData : (Array.isArray(suggestionsData) ? suggestionsData : []);
    if (!catalog.length) {
        suggestionsEl.innerHTML = '<p>No suggestions available yet.</p>';
        return null;
    }

    const progressMap = buildModuleProgressMap(progressData);

    // Completion metadata (if suggestions endpoint provides it)
    const completionByModuleId = new Map();
    (Array.isArray(suggestionsData) ? suggestionsData : []).forEach((s) => {
        const id = resolveModuleId(s);
        if (!id) return;
        completionByModuleId.set(id, {
            completion: getCompletionPercent(s) ?? 0,
            completed: isCompleted(s)
        });
    });

    const normalized = catalog
        .map((m) => {
            const moduleId = resolveModuleId(m);
            if (!moduleId) return null;

            const compMeta = completionByModuleId.get(moduleId);
            const completion = compMeta ? compMeta.completion : (getCompletionPercent(m) ?? 0);
            const completed = compMeta ? compMeta.completed : isCompleted(m);
            const started = completion > 0 || progressMap.has(moduleId);

            return {
                moduleId,
                title: m.title || m.courseName || 'Course',
                description: m.description || m.courseDescription || '',
                completion,
                completed,
                started
            };
        })
        .filter(Boolean);

    if (!normalized.length) {
        suggestionsEl.innerHTML = '<p>No valid suggestions available yet.</p>';
        return null;
    }

    const completedModules = normalized.filter(m => m.completed || m.completion >= 100);
    const inProgressModules = normalized.filter(m => !m.completed && m.completion > 0 && m.completion < 100);
    const notStartedModules = normalized.filter(m => !m.completed && m.completion === 0 && !m.started);

    // Rule 1: all done
    if (completedModules.length === normalized.length) {
        suggestionsEl.innerHTML = `<p>You have completed all of the learning modules on this site, you can try the ones you've previously completed</p>`;
        return null;
    }

    let recommended = null;
    let reason = '';

    // Rule 2: if user has an unfinished module, recommend that first
    if (inProgressModules.length > 0) {
        recommended = [...inProgressModules].sort((a, b) => b.completion - a.completion)[0];
        reason = `Continue this module (${recommended.completion}% complete).`;
    }
    // Rule 3: user has done none -> random
    else if (completedModules.length === 0) {
        recommended = pickRandom(notStartedModules.length ? notStartedModules : normalized.filter(m => !m.completed));
        reason = 'Start here to begin your learning journey.';
    }
    // Rule 4: recommend most similar to completed modules
    else {
        const completedTokens = tokenize(
            completedModules.map(m => `${m.title} ${m.description}`).join(' ')
        );

        const candidates = normalized.filter(m => !m.completed);
        let best = null;
        let bestScore = -1;

        candidates.forEach((c) => {
            const score = jaccard(completedTokens, tokenize(`${c.title} ${c.description}`));
            if (score > bestScore) {
                bestScore = score;
                best = c;
            }
        });

        recommended = best || pickRandom(candidates);
        reason = 'Recommended because it is most similar to modules you completed.';
    }

    if (!recommended) {
        suggestionsEl.innerHTML = '<p>No valid suggestions available yet.</p>';
        return null;
    }

    suggestionsEl.innerHTML = `
        <div class="suggestion-card">
            <h3>${recommended.title}</h3>
            <p>${recommended.description || 'Recommended next learning module.'}</p>
            <p><strong>Why this recommendation:</strong> ${reason}</p>
            <a href="lesson.html?moduleId=${encodeURIComponent(recommended.moduleId)}" class="btn btn-primary">Start</a>
        </div>
    `;
    return recommended;
}

function normalizeConfidenceValue(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return null;
    if (n <= 5) return Math.round((n / 5) * 100); // 1-5 scale
    return Math.max(0, Math.min(100, Math.round(n))); // 0-100 scale
}

function renderConfidenceSummary(progressData) {
    const host = document.getElementById('ov-confidence');
    if (!host) {
        console.warn('[confidence] ov-confidence element not found');
        return;
    }

    const rows = progressData.filter(p =>
        p.confidence_before != null || p.confidence_after != null
    );

    console.log('[confidence] rows with data:', rows);

    if (!rows.length) {
        host.textContent = 'No confidence data yet.';
        return;
    }

    const withBoth = rows.find(p => p.confidence_before != null && p.confidence_after != null);
    const withBefore = rows.find(p => p.confidence_before != null);
    const withAfter = rows.find(p => p.confidence_after != null);

    const before = Number(withBoth?.confidence_before ?? withBefore?.confidence_before ?? NaN);
    const after = Number(withBoth?.confidence_after ?? withAfter?.confidence_after ?? NaN);

    const beforeText = Number.isFinite(before) ? `${before}/5` : 'N/A';
    const afterText = Number.isFinite(after) ? `${after}/5` : 'N/A';

    let changeHTML = '';
    if (Number.isFinite(before) && Number.isFinite(after)) {
        const diff = after - before;
        const sign = diff > 0 ? '+' : '';
        const colour = diff > 0 ? '#1b5e20' : diff < 0 ? '#b71c1c' : '#555';
        changeHTML = `<br><span style="color:${colour};font-weight:600;">Change: ${sign}${diff}</span>`;
    }

    host.innerHTML = `
        Confidence before: <strong>${beforeText}</strong><br>
        Confidence now: <strong>${afterText}</strong>
        ${changeHTML}
    `;
}

function getLatestRowsByLesson(progressData) {
    const byLesson = new Map();

    (Array.isArray(progressData) ? progressData : []).forEach((row) => {
        const lessonId = Number(row.lesson_id ?? row.lessonId ?? 0);
        if (!lessonId) return;

        const prev = byLesson.get(lessonId);
        if (!prev) {
            byLesson.set(lessonId, row);
            return;
        }

        const prevTime = new Date(prev.completed_at ?? prev.updated_at ?? prev.created_at ?? 0).getTime() || 0;
        const rowTime = new Date(row.completed_at ?? row.updated_at ?? row.created_at ?? 0).getTime() || 0;
        const prevId = Number(prev.id ?? 0);
        const rowId = Number(row.id ?? 0);

        if (rowTime > prevTime || (rowTime === prevTime && rowId > prevId)) {
            byLesson.set(lessonId, row);
        }
    });

    return [...byLesson.values()];
}

function getPracticeResultsSummary(progressData) {
    const rows = getLatestRowsByLesson(progressData);

    let attempted = 0;
    let passed = 0;
    const scores = [];

    rows.forEach((r) => {
        // Treat each lesson row as a practice attempt once it exists in progress
        attempted += 1;

        const score = Number(r.quiz_score ?? r.score ?? r.accuracy);
        if (Number.isFinite(score)) scores.push(score);

        const passFlag = r.passed ?? r.is_correct ?? r.correct ?? null;
        const status = String(r.status || '').toLowerCase();
        const completed = isCompleted(r);
        const scorePass = Number.isFinite(score) ? score >= 70 : false;

        if (
            passFlag === true || passFlag === 1 || passFlag === '1' || passFlag === 'true' ||
            completed || status === 'completed' || scorePass
        ) {
            passed += 1;
        }
    });

    const passRate = attempted > 0 ? Math.round((passed / attempted) * 100) : 0;
    const avgScore = scores.length
        ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
        : null;

    return { attempted, passed, passRate, avgScore };
}

function renderOverview(progressData, suggestionsData, modulesData, recommended, aiSuggestion) {
    const latestRows = getLatestRowsByLesson(progressData);
    const completedLessonRows = latestRows.filter(isCompleted);

    const completedLessons = completedLessonRows.length;
    const totalLessons = latestRows.length;

    const completedModuleIds = new Set(
        completedLessonRows
            .map(p => p.module_id ?? p.moduleId)
            .filter(Boolean)
    );

    const completedModules = completedModuleIds.size;

    const practice = getPracticeResultsSummary(progressData);
    const practiceText = practice.attempted === 0
        ? 'No practice attempts yet'
        : `${practice.passed}/${practice.attempted} passed (${practice.passRate}%)` +
          (practice.avgScore != null ? ` · Avg score ${practice.avgScore}%` : '');

    const allCompleted = totalLessons > 0 && completedLessons === totalLessons;
    const overallPct = allCompleted ? 100 : 0;

    const completedEl = document.getElementById('ov-completed');
    const practiceEl = document.getElementById('ov-practice');
    const nextEl = document.getElementById('ov-next');
    const barEl = document.getElementById('ov-progress-bar');
    const barTextEl = document.getElementById('ov-progress-text');

    if (completedEl) {
        completedEl.textContent = `${completedLessons}/${totalLessons} lessons · ${completedModules} modules`;
    }

    if (practiceEl) practiceEl.textContent = practiceText;

    if (nextEl) {
        if (recommended?.title) {
            const moduleId = recommended.moduleId;
            nextEl.innerHTML = moduleId
                ? `<a href="lesson.html?moduleId=${encodeURIComponent(moduleId)}">${recommended.title}</a>`
                : recommended.title;
        } else {
            const nextRow = latestRows.find(r => !isCompleted(r));
            nextEl.textContent = nextRow?.lesson_title || nextRow?.module_title || 'No recommendation yet';
        }
    }

    if (barEl) barEl.value = overallPct;
    if (barTextEl) {
        barTextEl.innerHTML = allCompleted
            ? '<span class="progress-complete-badge is-complete">✓ Completed</span>'
            : '<span class="progress-complete-badge is-incomplete">○ Not completed</span>';
    }

    renderConfidenceSummary(progressData);
}

function normalizeSuggestions(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.suggestions)) return payload.suggestions;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
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

function renderProgressOverview(progressRows, suggestions) {
    const ovNext = document.getElementById('ov-next');
    if (ovNext) {
        ovNext.textContent = getNextRecommended(progressRows, suggestions);
    }
}