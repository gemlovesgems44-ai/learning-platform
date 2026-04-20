// Stores module data returned from the API.
let MODULES = [];

// Stores all items shown in the left navigation.
let COURSE_ITEMS = [];

// Tracks the currently selected navigation item.
let currentItemKey = null;

// Tracks which lesson IDs have been opened by the user.
let completedLessonIds = new Set();

// Tracks which lesson practice questions were answered correctly.
let passedPracticeLessonIds = new Set();

// Stores coach interaction state.
const coachState = {
    stuckCount: 0,
    lastAction: null,
    wrongAttemptsByLesson: Object.create(null),
    lastMessage: ''
};

// Rule-based coach responses.
const TOPIC_RULES = {
    default: {
        explain: 'Simple version: focus on one idea, then take one small action.',
        example: 'Example: read one section, summarize it in one sentence, then do one practical task.',
        next: 'Next step: finish this section and complete one task before moving on.',
        stuck: 'If stuck, pause, identify the exact confusing step, and retry only that step.'
    }
};

// Read a query string value from the page URL.
function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
}

// Get the current module ID from the URL.
function getModuleId() {
    return Number(getQueryParam('moduleId')) || 0;
}

// Get the display title for the page.
function getModuleTitle() {
    return (
        MODULES[0]?.title ||
        decodeURIComponent(getQueryParam('moduleTitle') || '') ||
        decodeURIComponent(getQueryParam('courseTitle') || '') ||
        'Module Overview'
    );
}

// Load the selected module from the backend API.
async function fetchModules(moduleId) {
    const res = await fetch(`/backend/api/modules.php?moduleId=${encodeURIComponent(moduleId)}`);
    if (!res.ok) {
        const errText = await res.text();
        console.error('modules.php error:', errText);
        throw new Error('Failed to load modules');
    }

    const data = await res.json();
    return Array.isArray(data) ? data : [];
}

// Load lessons for the selected module from the backend API.
async function fetchLessons(moduleId) {
    const res = await fetch(`/backend/api/lessons.php?moduleId=${encodeURIComponent(moduleId)}`);
    const text = await res.text();

    if (!res.ok) {
        console.error('lessons.php error:', text);
        throw new Error(`Failed to load lessons (${res.status}): ${text}`);
    }

    try {
        const data = JSON.parse(text);
        return Array.isArray(data) ? data : [];
    } catch {
        throw new Error(`Invalid JSON from lessons.php: ${text}`);
    }
}

// Save lesson completion to the progress API.
async function saveLessonProgress(lessonId) {
    try {
        const userId = Number(localStorage.getItem('userId') || 1);
        const moduleId = getModuleId();

        await fetch('/backend/api/progress.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userId,
                lessonId,
                moduleId,
                completed: true
            })
        });
    } catch (error) {
        console.warn('Could not save lesson progress:', error);
    }
}

// Save practice progress to the progress API.
async function savePracticeProgress() {
    localStorage.setItem(
        getPracticeStorageKey(),
        JSON.stringify([...passedPracticeLessonIds])
    );
}

// Get the practice storage key.
function getPracticeStorageKey() {
    const userId = Number(localStorage.getItem('userId') || 1);
    return `lp_practice_passed_module_${getModuleId()}_user_${userId}`;
}

// Load practice progress.
function loadPracticeProgress() {
    try {
        const raw = localStorage.getItem(getPracticeStorageKey());
        const arr = raw ? JSON.parse(raw) : [];
        passedPracticeLessonIds = new Set(Array.isArray(arr) ? arr.map(Number) : []);
    } catch {
        passedPracticeLessonIds = new Set();
    }
}

// Get the practice lesson IDs.
function getPracticeLessonIds() {
    return COURSE_ITEMS
        .filter(item => item.key.startsWith('lesson-'))
        .filter(item => {
            const task = getTaskFromLesson(item);
            const hasQuestion = String(task.question || '').trim().length > 0;

            if (task.type === 'text') {
                return hasQuestion && (
                    (Array.isArray(task.acceptedAnswers) && task.acceptedAnswers.length > 0) ||
                    String(task.correctAnswer || '').trim().length > 0
                );
            }

            if (task.type === 'ordering') {
                const d = parseTaskData(item.task_data);
                return hasQuestion && Array.isArray(d.correctOrder) && d.correctOrder.length > 0;
            }

            return hasQuestion && Array.isArray(task.options) && task.options.length > 0;
        })
        .map(item => Number(item.lessonId || item.key.replace('lesson-', '')))
        .filter(id => !Number.isNaN(id));
}

// Build the full navigation list: intro, lessons, summary.
function buildCourseItems(modules, lessons) {
    const moduleTitle = getModuleTitle();

    const introContent = modules[0]?.description
        ? `<p>${modules[0].description}</p>`
        : `<p>Welcome to ${moduleTitle}. Work through the lessons in order.</p>`;

    const orderedLessons = [...lessons].sort((a, b) => {
        const aOrder = Number(a.order_index ?? a.position ?? a.sort_order ?? a.id ?? 0);
        const bOrder = Number(b.order_index ?? b.position ?? b.sort_order ?? b.id ?? 0);
        return aOrder - bOrder;
    });

    const lessonItems = orderedLessons.map((lesson) => ({
        key: `lesson-${lesson.id}`,
        lessonId: Number(lesson.id),
        label: lesson.title || 'Lesson',
        content: lesson.content || '<p>No lesson content available.</p>',
        module_id: lesson.module_id,
        task_type: lesson.task_type,
        task_data: lesson.task_data
    }));

    const summaryContent = lessonItems.length
        ? `<p>This module covered:</p><ul>${lessonItems.map(item => `<li>${item.label}</li>`).join('')}</ul>`
        : '<p>No lessons available for this module yet.</p>';

    return [
        { key: 'course-intro', label: 'Module overview', content: introContent },
        ...lessonItems,
        { key: 'course-summary', label: 'Module summary', content: summaryContent }
    ];
}

// Render the left-hand navigation.
function renderNav(activeKey) {
    const courseTitleEl = document.getElementById('course-title');
    const progressEl = document.getElementById('module-progress');
    const listEl = document.getElementById('module-nav-list');

    if (!courseTitleEl || !progressEl || !listEl) return;

    courseTitleEl.textContent = getModuleTitle();

    const totalLessons = COURSE_ITEMS.filter(item => item.key.startsWith('lesson-')).length;
    const completedLessons = completedLessonIds.size;
    progressEl.textContent = `${completedLessons}/${totalLessons} completed`;

    listEl.innerHTML = '';

    COURSE_ITEMS.forEach((item) => {
        const li = document.createElement('li');
        li.className = 'module-nav-item';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'module-nav-btn';
        btn.textContent = item.label;

        if (item.key === activeKey) {
            btn.classList.add('active');
        }

        btn.addEventListener('click', () => {
            setCurrentItem(item.key);
        });

        li.appendChild(btn);
        listEl.appendChild(li);
    });
}

// Parse lesson HTML into simpler structured sections.
function parseAndStructureContent(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html || '', 'text/html');

    let explanation = '';
    const firstP = doc.querySelector('p');
    if (firstP) {
        const text = firstP.textContent.trim().substring(0, 200);
        explanation = text ? (text.endsWith('.') ? text : `${text}.`) : '';
    }

    const keyPoints = [];
    doc.querySelectorAll('ul, ol').forEach(list => {
        list.querySelectorAll('li').forEach(item => {
            const text = item.textContent.trim();
            if (text) keyPoints.push(text);
        });
    });

    let visual = '';
    const firstImage = doc.querySelector('img');
    if (firstImage) {
        visual = firstImage.outerHTML;
    }

    let prompt = '';
    const noteEl = doc.querySelector('[class*="prompt"], [class*="question"], [class*="note"]');
    if (noteEl) {
        prompt = noteEl.textContent.trim();
    }

    return { explanation, keyPoints, visual, prompt };
}

// Render the selected item in the main content panel.
function renderCurrentItem(itemKey) {
    const lessonTitleEl = document.getElementById('lesson-title');
    const lessonBodyEl = document.getElementById('lesson-body');
    const item = COURSE_ITEMS.find(entry => entry.key === itemKey) || COURSE_ITEMS[0];

    if (!lessonTitleEl || !lessonBodyEl || !item) return;

    // Collapse sandbox when switching main content.
    setSandboxExpanded(false);

    lessonTitleEl.textContent = item.label;

    const structured = parseAndStructureContent(item.content);

    const currentIndex = COURSE_ITEMS.findIndex(entry => entry.key === itemKey);
    const hasNextItem = currentIndex >= 0 && currentIndex < COURSE_ITEMS.length - 1;
    const nextItemKey = hasNextItem ? COURSE_ITEMS[currentIndex + 1].key : null;

    const isLessonItem = item.key.startsWith('lesson-');
    const lessonId = isLessonItem ? Number(item.key.replace('lesson-', '')) : 0;

    const totalLessons = COURSE_ITEMS.filter(entry => entry.key.startsWith('lesson-')).length;
    const allLessonsCompleted = totalLessons > 0 && completedLessonIds.size >= totalLessons;

    const requiredPracticeIds = getPracticeLessonIds();
    const allPracticeCompleted = requiredPracticeIds.length > 0
        ? requiredPracticeIds.every(id => passedPracticeLessonIds.has(id))
        : allLessonsCompleted; // fallback if no practice questions configured

    const isCourseSummary = item.key === 'course-summary';
    const canCompleteCourse = isCourseSummary && allPracticeCompleted;

    lessonBodyEl.innerHTML = `
        <div class="lesson-structure">
            ${structured.explanation ? `
                <section class="lesson-section explanation-section">
                    <p class="explanation-text">${structured.explanation}</p>
                </section>
            ` : ''}

            ${structured.keyPoints.length > 0 ? `
                <section class="lesson-section key-points-section">
                    <h3 class="section-title">Key points</h3>
                    <ul class="key-points-list">
                        ${structured.keyPoints.map(point => `
                            <li class="key-point-item">
                                <span class="point-icon">•</span>
                                <span class="point-text">${point}</span>
                            </li>
                        `).join('')}
                    </ul>
                </section>
            ` : ''}

            ${structured.visual ? `
                <section class="lesson-section visual-section">
                    ${structured.visual}
                </section>
            ` : ''}

            ${structured.prompt ? `
                <section class="lesson-section prompt-section">
                    <div class="reflection-prompt">
                        <p><strong>✓ Try this:</strong> ${structured.prompt}</p>
                    </div>
                </section>
            ` : ''}

            <section class="lesson-section action-section">
                <button
                    type="button"
                    class="lesson-action-btn"
                    id="next-step-btn"
                    ${!hasNextItem && !isLessonItem && !canCompleteCourse ? 'disabled' : ''}
                >
                    ${isLessonItem
                        ? 'Open practice'
                        : hasNextItem
                            ? 'Next step'
                            : (canCompleteCourse ? 'Mark module done' : 'Complete all practice first')}
                </button>
            </section>
        </div>
    `;

    const actionBtn = document.getElementById('next-step-btn');
    if (!actionBtn) return;

    if (isLessonItem && lessonId > 0) {
        actionBtn.addEventListener('click', () => {
            renderPractice(item, nextItemKey, item.task_type);
            setSandboxExpanded(true);
        });
    } else if (hasNextItem) {
        actionBtn.addEventListener('click', () => setCurrentItem(nextItemKey));
    } else if (canCompleteCourse) {
        actionBtn.addEventListener('click', () => {
            const moduleId = getModuleId();
            window.location.href = `/public/progress.html?moduleId=${moduleId}&completed=1`;
        });
    }
}

// Update the selected item and mark lessons as completed.
function setCurrentItem(itemKey) {
    currentItemKey = itemKey;

    // Do not mark complete on open.
    // Completion should happen after correct practice answer.

    renderNav(currentItemKey);
    renderCurrentItem(currentItemKey);
}

function getCurrentItem() {
    return COURSE_ITEMS.find(entry => entry.key === currentItemKey) || null;
}

function getLessonContext() {
    const item = getCurrentItem();
    if (!item) return { title: 'this topic', explanation: '', keyPoints: [] };

    const structured = parseAndStructureContent(item.content || '');
    return {
        title: item.label || 'this topic',
        explanation: structured.explanation || '',
        keyPoints: structured.keyPoints || []
    };
}

function firstKeyPoint(ctx) {
    return ctx.keyPoints.length > 0 ? ctx.keyPoints[0] : null;
}

function buildCoachResponse(action) {
    const ctx = getLessonContext() || { title: 'this topic', explanation: '', keyPoints: [] };
    const firstPoint = ctx.keyPoints[0] || ctx.explanation || 'the core concept';
    const secondPoint = ctx.keyPoints[1] || 'the next key idea';
    const attempts = getWrongAttemptsCurrentLesson();

    coachState.lastAction = action;
    if (action === 'stuck') coachState.stuckCount += 1;
    else coachState.stuckCount = 0;

    if (action === 'explain') {
        if (attempts >= 2) {
            return `Simple version for "${ctx.title}": focus only on "${firstPoint}". Ignore extra detail until that is clear.`;
        }
        return `Simple version for "${ctx.title}": ${firstPoint}.`;
    }

    if (action === 'example') {
        if (attempts >= 2) {
            return `Worked example: apply "${firstPoint}" first, then check it against "${secondPoint}".`;
        }
        return `Example: use "${firstPoint}" in one real scenario, then write one short outcome.`;
    }

    if (action === 'next') {
        return getNextSuggestedStep();
    }

    // stuck
    if (coachState.stuckCount >= 3 || attempts >= 3) {
        return `You’re stuck on "${ctx.title}". Reset: 1) reread the question, 2) eliminate clearly wrong options, 3) choose the best remaining answer.`;
    }

    return `If stuck on "${ctx.title}", do one small step: start with "${firstPoint}", then retry.`;
}

function renderCoachActions() {
    const buttons = [...document.querySelectorAll('.coach-btn')];
    if (!buttons.length) return;

    const attempts = getWrongAttemptsCurrentLesson();
    const ctx = getLessonContext() || { title: 'this topic', keyPoints: [] };
    const shortPoint = (ctx.keyPoints[0] || 'core idea').slice(0, 28);

    const labels = {
        explain: attempts >= 2 ? `Simplify "${ctx.title}"` : `Explain simply`,
        example: attempts >= 2 ? `Show worked example` : `Give example`,
        next: 'What should I do next?',
        stuck: attempts >= 2 ? `I’m still stuck` : `I’m stuck`
    };

    buttons.forEach((btn) => {
        const action = btn.dataset.action;
        if (!action || !labels[action]) return;
        btn.textContent = labels[action];
        btn.title = `Help for: ${shortPoint}`;
    });
}

// Wire up the coach buttons.
function initCoach() {
    const output = document.getElementById('coach-response');
    if (!output) return;

    renderCoachActions();

    document.querySelectorAll('.coach-btn').forEach((btn) => {
        if (btn.dataset.bound === '1') return;
        btn.dataset.bound = '1';

        btn.addEventListener('click', () => {
            const action = btn.dataset.action || 'explain';
            typeText(output, buildCoachResponse(action));
            renderCoachActions();
        });
    });
}

// Cancelable coach typing controller
const coachTypingController = {
    runId: 0,
    timer: null
};

function cancelCoachTyping() {
    coachTypingController.runId += 1;
    if (coachTypingController.timer) {
        clearTimeout(coachTypingController.timer);
        coachTypingController.timer = null;
    }
}

// Replace your current typeText(...) with this version
function typeText(el, text, speed = 18) {
    if (!el) return;

    cancelCoachTyping();
    const myRunId = coachTypingController.runId;
    const full = String(text ?? '');
    let i = 0;

    el.textContent = '';

    const step = () => {
        if (myRunId !== coachTypingController.runId) return; // canceled by newer request

        if (i >= full.length) {
            coachTypingController.timer = null;
            return;
        }

        el.textContent += full.charAt(i++);
        coachTypingController.timer = setTimeout(step, speed);
    };

    step();
}

// Main page setup.
async function initLessonPage() {
    try {
        const moduleId = getModuleId();

        if (!moduleId) {
            const lessonTitleEl = document.getElementById('lesson-title');
            const lessonBodyEl = document.getElementById('lesson-body');
            if (lessonTitleEl) lessonTitleEl.textContent = 'No module selected';
            if (lessonBodyEl) lessonBodyEl.innerHTML = '<p>Please open this page from a module link.</p>';
            initCoach();
            return;
        }

        loadPracticeProgress(); // <- add this after moduleId is known

        const [modules, lessons] = await Promise.all([
            fetchModules(moduleId),
            fetchLessons(moduleId)
        ]);

        MODULES = modules;
        COURSE_ITEMS = buildCourseItems(modules, lessons);
        currentItemKey = 'course-intro';

        renderNav(currentItemKey);
        renderCurrentItem(currentItemKey);
    } catch (error) {
        console.error(error);

        const lessonTitleEl = document.getElementById('lesson-title');
        const lessonBodyEl = document.getElementById('lesson-body');

        if (lessonTitleEl) lessonTitleEl.textContent = 'Lesson unavailable';
        if (lessonBodyEl) {
            lessonBodyEl.innerHTML = `<p>${error?.message || 'Could not load lesson content.'}</p>`;
        }
    }

    initCoach();
}

document.addEventListener('DOMContentLoaded', initLessonPage);

function parseOptions(raw) {
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) return parsed;
        } catch (_) {}
        return raw.split('|').map(s => s.trim()).filter(Boolean);
    }
    return [];
}

function setSandboxExpanded(open) {
    const layout = document.getElementById('lesson-layout');
    if (!layout) return;
    layout.classList.toggle('sandbox-open', !!open);
}

function normalizeTaskTypeValue(rawType) {
    const t = String(rawType || '').trim().toLowerCase();
    if (t === 'muli-select' || t === 'multi-select' || t === 'multiselect' || t === 'multi select') return 'multi_select';
    if (t === 'password check' || t === 'password-check' || t === 'passwordcheck') return 'password_check';
    return t || 'mcq';
}

function parseTaskData(raw) {
    if (!raw) return {};
    if (typeof raw === 'object') return raw;
    if (typeof raw === 'string') {
        try { return JSON.parse(raw); } catch { return {}; }
    }
    return {};
}

function getTaskFromLesson(item) {
    const data = parseTaskData(item?.task_data);
    const type = normalizeTaskTypeValue(item?.task_type || data.type || 'mcq');

    return {
        type,
        question: data.question ?? data.prompt ?? '',
        options: Array.isArray(data.options) ? data.options : parseOptions(data.options),
        correctAnswer: data.correctAnswer ?? data.correctanswer ?? '',
        acceptedAnswers: Array.isArray(data.acceptedAnswers) ? data.acceptedAnswers : null,
        correctFeedback: data.correctFeedback ?? data.correctfeedback ?? 'Correct.',
        wrongFeedback: data.wrongFeedback ?? data.wrongfeedback ?? 'Try again.'
    };
}

function updateCoachFromPractice(isCorrect, task, lessonLabel) {
    const output = document.getElementById('coach-response');
    if (!output) return;

    const lessonKey = getCurrentLessonKey();
    if (lessonKey) {
        if (isCorrect) coachState.wrongAttemptsByLesson[lessonKey] = 0;
        else coachState.wrongAttemptsByLesson[lessonKey] = (coachState.wrongAttemptsByLesson[lessonKey] || 0) + 1;
    }

    const attempts = getWrongAttemptsCurrentLesson();

    const msg = isCorrect
        ? `Nice work on "${lessonLabel}". ${task.correctFeedback || 'Correct.'} ${getNextSuggestedStep()}`
        : attempts >= 3
            ? `${task.wrongFeedback || 'Try again.'} Let’s reset: remove wrong options first, then pick the strongest remaining answer.`
            : attempts === 2
                ? `${task.wrongFeedback || 'Try again.'} Hint: focus on key terms from this lesson and eliminate distractors.`
                : `Not quite for "${lessonLabel}". ${task.wrongFeedback || 'Try again.'}`;

    typeText(output, msg);
    renderCoachActions();
}

function renderPractice(item, nextItemKey, taskTypeOverride = null) {
    const box = document.getElementById('practice-content');
    if (!box) return;

    const task = getTaskFromLesson(item);
    const data = parseTaskData(item.task_data);
    const type = normalizeTaskTypeValue(taskTypeOverride || task.type || 'mcq');
    const question = task.question || data.prompt || 'Practice task';

    const checkBtn = document.getElementById('btn-check-answer');
    const nextBtn = document.getElementById('btn-next-task');
    const retryBtn = document.getElementById('btn-try-again');
    if (!checkBtn || !nextBtn || !retryBtn) return;

    let selectedSingle = null;
    let selectedMulti = new Set();
    let orderItems = Array.isArray(data.items) ? [...data.items] : [...(task.options || [])];

    // Normalize options so strings/objects both render correctly.
    const rawOptions = Array.isArray(task.options) ? task.options : [];
    const optionText = rawOptions.map((o) => {
        if (typeof o === 'string') return o;
        if (o && typeof o === 'object') return String(o.text ?? o.label ?? o.value ?? '');
        return String(o ?? '');
    });

    // Support correctIndexes OR options[].isCorrect OR correctAnswers[]
    const correctIdxFromData = Array.isArray(data.correctIndexes)
        ? data.correctIndexes.map(Number).sort((a, b) => a - b)
        : [];
    const correctIdxFromOptions = rawOptions
        .map((o, i) => (o && typeof o === 'object' && (o.isCorrect === true || o.correct === true) ? i : -1))
        .filter(i => i >= 0)
        .sort((a, b) => a - b);
    const correctAnswersText = Array.isArray(data.correctAnswers)
        ? data.correctAnswers.map(v => String(v).trim().toLowerCase()).sort()
        : [];

    const renderChoices = (options, multi = false) => {
        box.innerHTML = `
            <p><strong>${question}</strong></p>
            <div class="practice-options">
                ${options.map((o, i) => `<button type="button" class="practice-option-btn" data-i="${i}" data-v="${String(o).replace(/"/g, '&quot;')}">${String.fromCharCode(65 + i)}. ${o}</button>`).join('')}
            </div>
            <p id="practice-feedback"></p>
        `;
        const btns = box.querySelectorAll('.practice-option-btn');
        btns.forEach((b) => b.addEventListener('click', () => {
            const idx = Number(b.dataset.i);
            if (multi) {
                if (selectedMulti.has(idx)) {
                    selectedMulti.delete(idx);
                    b.classList.remove('selected');
                } else {
                    selectedMulti.add(idx);
                    b.classList.add('selected');
                }
            } else {
                btns.forEach(x => x.classList.remove('selected'));
                b.classList.add('selected');
                selectedSingle = b.dataset.v || '';
            }
        }));
    };

    const renderOrdering = () => {
        const draw = () => {
            box.innerHTML = `
                <p><strong>${question}</strong></p>
                <div class="practice-options">
                    ${orderItems.map((txt, i) => `
                        <div class="ordering-item">
                            <span>${i + 1}. ${txt}</span>
                            <div>
                                <button type="button" class="order-btn" data-dir="-1" data-i="${i}" ${i===0?'disabled':''}>↑</button>
                                <button type="button" class="order-btn" data-dir="1" data-i="${i}" ${i===orderItems.length-1?'disabled':''}>↓</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <p id="practice-feedback"></p>
            `;
            box.querySelectorAll('.order-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const i = Number(btn.dataset.i);
                    const d = Number(btn.dataset.dir);
                    const j = i + d;
                    if (j < 0 || j >= orderItems.length) return;
                    [orderItems[i], orderItems[j]] = [orderItems[j], orderItems[i]];
                    draw();
                });
            });
        };
        draw();
    };

    switch (type) {
        case 'multi_select':
        case 'multi-select':
        case 'muli-select':
            renderChoices(optionText, true);
            break;
        case 'ordering':
            renderOrdering();
            break;
        case 'scenario':
            box.innerHTML = `
                <p><strong>${question}</strong></p>
                ${data.context ? `<div class="scenario-context"><p>${data.context}</p></div>` : ''}
                <div class="practice-options">
                    ${(task.options || []).map((o, i) => `<button type="button" class="practice-option-btn" data-v="${String(o).replace(/"/g, '&quot;')}">${String.fromCharCode(65+i)}. ${o}</button>`).join('')}
                </div>
                <p id="practice-feedback"></p>
            `;
            box.querySelectorAll('.practice-option-btn').forEach(b => {
                b.addEventListener('click', () => {
                    box.querySelectorAll('.practice-option-btn').forEach(x => x.classList.remove('selected'));
                    b.classList.add('selected');
                    selectedSingle = b.dataset.v || '';
                });
            });
            break;
        case 'password_check':
            box.innerHTML = `
                <p><strong>${question}</strong></p>
                <input id="practice-password-answer" type="password" placeholder="Enter password" />
                <p id="practice-feedback"></p>
            `;
            break;
        case 'mcq':
        default:
            renderChoices(optionText, false);
            break;
    }

    nextBtn.disabled = true;

    const evaluate = () => {
        const correct = String(task.correctAnswer || '').trim().toLowerCase();

        if (type === 'password_check') {
            const v = String(document.getElementById('practice-password-answer')?.value || '').trim().toLowerCase();
            return v && v === correct;
        }

        if (type === 'multi_select' || type === 'multi-select' || type === 'muli-select') {
            const pickedIdx = [...selectedMulti].map(Number).sort((a, b) => a - b);

            // fallback sources
            const idxFromData = Array.isArray(data.correctIndexes) ? data.correctIndexes : [];
            const idxFromAlt = Array.isArray(data.correct_indices) ? data.correct_indices : [];
            const idxFromAnswer = String(data.correctAnswer || data.correctanswer || task.correctAnswer || '')
                .split(',')
                .map(s => s.trim())
                .filter(Boolean)
                .map(v => Number(v))
                .filter(n => Number.isFinite(n));

            // include options[].correct / options[].isCorrect
            const idxFromOptions = rawOptions
                .map((o, i) => (o && typeof o === 'object' && (o.isCorrect === true || o.correct === true) ? i : -1))
                .filter(i => i >= 0);

            let expectedIdx = [...idxFromData, ...idxFromAlt, ...idxFromAnswer, ...idxFromOptions]
                .map(Number)
                .filter(Number.isFinite)
                .sort((a, b) => a - b);

            // convert 1-based to 0-based if needed
            if (expectedIdx.length > 0 && expectedIdx.every(n => n >= 1) && Math.max(...expectedIdx) <= optionText.length) {
                expectedIdx = expectedIdx.map(n => n - 1);
            }

            if (expectedIdx.length > 0) {
                return JSON.stringify(expectedIdx) === JSON.stringify(pickedIdx);
            }

            // text-based fallback
            const expectedText = (
                Array.isArray(data.correctAnswers) ? data.correctAnswers : String(task.correctAnswer || '').split(',')
            )
                .map(v => String(v).trim().toLowerCase())
                .filter(Boolean)
                .sort();

            if (expectedText.length > 0) {
                const pickedText = pickedIdx
                    .map(i => String(optionText[i] || '').trim().toLowerCase())
                    .sort();
                return JSON.stringify(expectedText) === JSON.stringify(pickedText);
            }

            return false;
        }

        if (type === 'ordering') {
            const expected = Array.isArray(data.correctOrder) ? data.correctOrder.map(String) : [];
            return expected.length > 0 && JSON.stringify(orderItems.map(String)) === JSON.stringify(expected);
        }

        return String(selectedSingle || '').trim().toLowerCase() === correct;
    };

    checkBtn.onclick = () => {
        const ok = evaluate();
        const feedbackEl = document.getElementById('practice-feedback');
        if (!feedbackEl) return;

        feedbackEl.textContent = ok
            ? (task.correctFeedback || 'Correct.')
            : `${task.wrongFeedback || 'Try again.'} You must answer correctly to continue.`;
        feedbackEl.style.color = ok ? '#1b5e20' : '#b71c1c';

        nextBtn.disabled = !ok;
        updateCoachFromPractice(ok, task, item.label || 'lesson');

        if (ok) {
            const lessonId = Number(item.lessonId || String(item.key || '').replace('lesson-', ''));
            if (!Number.isNaN(lessonId)) {
                passedPracticeLessonIds.add(lessonId);
                completedLessonIds.add(lessonId);
                savePracticeProgress();
                saveLessonProgress(lessonId);
                renderNav(currentItemKey);
            }
        }
    };

    retryBtn.onclick = () => renderPractice(item, nextItemKey, type);
    nextBtn.onclick = () => {
        if (nextItemKey) setCurrentItem(nextItemKey);
    };
}

function getCurrentLessonKey() {
    return typeof currentItemKey === 'string' && currentItemKey.startsWith('lesson-')
        ? currentItemKey
        : null;
}

function getWrongAttemptsCurrentLesson() {
    const key = getCurrentLessonKey();
    return key ? (coachState.wrongAttemptsByLesson[key] || 0) : 0;
}

function getNextSuggestedStep() {
    const current = getCurrentItem();

    if (current?.key?.startsWith('lesson-')) {
        const lessonId = Number(current.lessonId || String(current.key).replace('lesson-', ''));
        if (!Number.isNaN(lessonId) && !passedPracticeLessonIds.has(lessonId)) {
            return `Complete practice for "${current.label}" to unlock progress.`;
        }
    }

    const nextUnpassed = COURSE_ITEMS.find((item) => {
        if (!item.key.startsWith('lesson-')) return false;
        const id = Number(item.lessonId || String(item.key).replace('lesson-', ''));
        return !Number.isNaN(id) && !passedPracticeLessonIds.has(id);
    });

    if (nextUnpassed) return `Go to "${nextUnpassed.label}" and complete its practice task.`;
    return 'Open Module summary, then mark the module as done.';
}