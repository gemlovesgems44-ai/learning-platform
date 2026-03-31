// Stores module data returned from the API.
let MODULES = [];

// Stores all items shown in the left navigation.
let COURSE_ITEMS = [];

// Tracks the currently selected navigation item.
let currentItemKey = null;

// Tracks which lesson IDs have been opened by the user.
let completedLessonIds = new Set();

// Stores coach interaction state.
const coachState = { stuckCount: 0, lastAction: null };

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
    if (!res.ok) {
        const errText = await res.text();
        console.error('lessons.php error:', errText);
        throw new Error('Failed to load lessons');
    }

    const data = await res.json();
    return Array.isArray(data) ? data : [];
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
        label: lesson.title || 'Lesson',
        content: lesson.content || '<p>No lesson content available.</p>',
        module_id: lesson.module_id
    }));

    const summaryContent = lessonItems.length
        ? `<p>This module covered:</p><ul>${lessonItems.map(item => `<li>${item.label}</li>`).join('')}</ul>`
        : '<p>No lessons available for this module yet.</p>';

    return [
        {
            key: 'course-intro',
            label: 'Module overview',
            content: introContent
        },
        ...lessonItems,
        {
            key: 'course-summary',
            label: 'Module summary',
            content: summaryContent
        }
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

    // DEBUG: remove after checking
    console.log('parseAndStructureContent result:', {
        explanation,
        keyPoints,
        visual,
        prompt,
        rawHtml: html
    });

    return { explanation, keyPoints, visual, prompt };
}

// Render the selected item in the main content panel.
function renderCurrentItem(itemKey) {
    const lessonTitleEl = document.getElementById('lesson-title');
    const lessonBodyEl = document.getElementById('lesson-body');
    const item = COURSE_ITEMS.find(entry => entry.key === itemKey) || COURSE_ITEMS[0];

    if (!lessonTitleEl || !lessonBodyEl || !item) return;

    lessonTitleEl.textContent = item.label;

    const structured = parseAndStructureContent(item.content);

    const currentIndex = COURSE_ITEMS.findIndex(entry => entry.key === itemKey);
    const hasNextItem = currentIndex >= 0 && currentIndex < COURSE_ITEMS.length - 1;
    const nextItemKey = hasNextItem ? COURSE_ITEMS[currentIndex + 1].key : null;

    const totalLessons = COURSE_ITEMS.filter(entry => entry.key.startsWith('lesson-')).length;
    const allLessonsCompleted = totalLessons > 0 && completedLessonIds.size >= totalLessons;
    const isCourseSummary = item.key === 'course-summary';
    const canCompleteCourse = isCourseSummary && allLessonsCompleted;

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
                    ${!hasNextItem && !canCompleteCourse ? 'disabled' : ''}
                >
                    ${hasNextItem ? 'Next step' : (canCompleteCourse ? 'Module complete' : 'Complete all lessons first')}
                </button>
            </section>
        </div>
    `;

    const actionBtn = document.getElementById('next-step-btn');
    if (!actionBtn) return;

    if (hasNextItem) {
        actionBtn.addEventListener('click', () => {
            setCurrentItem(nextItemKey);
        });
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

    if (itemKey.startsWith('lesson-')) {
        const lessonId = Number(itemKey.replace('lesson-', ''));
        if (!Number.isNaN(lessonId) && !completedLessonIds.has(lessonId)) {
            completedLessonIds.add(lessonId);
            saveLessonProgress(lessonId);
        }
    }

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
    if (action === 'stuck') coachState.stuckCount += 1;
    else coachState.stuckCount = 0;

    coachState.lastAction = action;

    const ctx = getLessonContext();
    const kp = firstKeyPoint(ctx);

    if (action === 'explain') {
        return kp
            ? `In "${ctx.title}", the main idea is: ${kp}. Focus on that first.`
            : `In "${ctx.title}", start with this core idea: ${ctx.explanation || 'read the first section and summarize it in one sentence.'}`;
    }

    if (action === 'example') {
        return kp
            ? `Example for "${ctx.title}": apply "${kp}" to a small real case you know, then note one outcome.`
            : `Example for "${ctx.title}": pick one concept and show how you would use it in practice.`;
    }

    if (action === 'next') {
        if (ctx.keyPoints.length >= 2) {
            return `Next: complete one task for "${ctx.keyPoints[0]}", then move to "${ctx.keyPoints[1]}".`;
        }
        return `Next: finish this section of "${ctx.title}" and complete one quick practice step.`;
    }

    // stuck
    let msg = kp
        ? `If stuck on "${ctx.title}", isolate this point: "${kp}", and try only that step first.`
        : `If stuck on "${ctx.title}", break it into one tiny step and retry.`;

    if (coachState.stuckCount > 1) {
        msg += ' Then write one question about exactly what is unclear.';
    }
    return msg;
}

// Show text with a simple typing effect.
function typeText(element, text, speed = 16) {
    if (!element) return;

    element.textContent = '';
    let index = 0;

    const timer = setInterval(() => {
        element.textContent += text.charAt(index);
        index += 1;

        if (index >= text.length) {
            clearInterval(timer);
        }
    }, speed);
}

// Wire up the coach buttons.
function initCoach() {
    const output = document.getElementById('coach-response');
    if (!output) return;

    document.querySelectorAll('.coach-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            typeText(output, buildCoachResponse(action));
        });
    });
}

// Main page setup.
async function initLessonPage() {
    try {
        const moduleId = getModuleId();

        if (!moduleId) {
            throw new Error('Missing moduleId in URL');
        }

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
        if (lessonBodyEl) lessonBodyEl.innerHTML = '<p>Could not load lesson content from the database.</p>';
    }

    initCoach();
}

document.addEventListener('DOMContentLoaded', initLessonPage);