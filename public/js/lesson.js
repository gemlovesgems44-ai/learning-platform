// Stores module data if needed later.
let MODULES = [];

// Stores all items shown in the course navigation:
// course intro, lessons, and course summary.
let COURSE_ITEMS = [];

// Tracks the currently selected navigation item.
let currentItemKey = null;

// Tracks which lesson IDs have been opened by the user.
let completedLessonIds = new Set();

// Stores coach interaction state so responses can adapt slightly.
const coachState = { stuckCount: 0, lastAction: null };

// Rule-based coach responses for each support button.
const TOPIC_RULES = {
    default: {
        explain: 'Simple version: focus on one idea, then take one small action.',
        example: 'Example: read one section, summarize it in one sentence, then do one practical task.',
        next: 'Next step: finish this section and complete one task before moving on.',
        stuck: 'If stuck, pause, identify the exact confusing step, and retry only that step.'
    }
};

// Reads a query string value from the page URL.
// Example: lesson.html?courseId=1
function getQueryParam(name) {
    return new URLSearchParams(window.location.search).get(name);
}

// Gets the current course ID from the URL.
// Falls back to course 1 if none is provided.
function getCourseId() {
    return Number(getQueryParam('courseId')) || 1;
}

// Loads modules for the selected course from the backend API.
async function fetchModules(courseId) {
    const res = await fetch(`/backend/api/modules.php?courseId=${encodeURIComponent(courseId)}`);
    if (!res.ok) throw new Error('Failed to load modules');
    const data = await res.json();
    return Array.isArray(data) ? data : [];
}

// Loads lessons for the selected course from the backend API.
async function fetchLessons(courseId) {
    const res = await fetch(`/backend/api/lessons.php?courseId=${encodeURIComponent(courseId)}`);
    if (!res.ok) throw new Error('Failed to load lessons');
    const data = await res.json();
    return Array.isArray(data) ? data : [];
}

// Builds the full list of items shown in the left navigation.
// This includes:
// 1. Course introduction
// 2. All lessons from the database
// 3. A course summary
function buildCourseItems(modules, lessons) {
    const courseTitle = decodeURIComponent(getQueryParam('courseTitle') || 'Course');

    // Use the first module description as the course introduction if available.
    const introHtml = modules[0]?.description
        ? `<p>${modules[0].description}</p>`
        : `<p>Welcome to ${courseTitle}. Work through the lessons in order.</p>`;

    // Sort lessons into a predictable order.
    const orderedLessons = [...lessons].sort((a, b) => {
        const aOrder = Number(a.order_index ?? a.position ?? a.sort_order ?? a.id ?? 0);
        const bOrder = Number(b.order_index ?? b.position ?? b.sort_order ?? b.id ?? 0);
        return aOrder - bOrder;
    });

    // Convert lesson rows into navigation/content items.
    const lessonItems = orderedLessons.map((lesson) => ({
        key: `lesson-${lesson.id}`,
        label: lesson.title || 'Lesson',
        content: lesson.content || '<p>No lesson content available.</p>'
    }));

    // Build a simple summary using the lesson titles.
    const summaryHtml = lessonItems.length
        ? `<p>This course covered:</p><ul>${lessonItems.map(item => `<li>${item.label}</li>`).join('')}</ul>`
        : '<p>No summary available yet.</p>';

    return [
        {
            key: 'course-intro',
            label: 'Introduction to the course',
            content: introHtml
        },
        ...lessonItems,
        {
            key: 'course-summary',
            label: 'Course summary',
            content: summaryHtml
        }
    ];
}

// Renders the left-hand navigation panel.
// Also updates the course title and completion progress.
function renderNav(activeKey) {
    const courseTitleEl = document.getElementById('course-title');
    const progressEl = document.getElementById('module-progress');
    const listEl = document.getElementById('module-nav-list');

    if (!courseTitleEl || !progressEl || !listEl) return;

    courseTitleEl.textContent = decodeURIComponent(getQueryParam('courseTitle') || 'Course Overview');

    // Count how many lesson items exist and how many have been visited.
    const totalLessons = COURSE_ITEMS.filter(item => item.key.startsWith('lesson-')).length;
    const completedLessons = [...completedLessonIds].length;
    progressEl.textContent = `${completedLessons}/${totalLessons} completed`;

    // Clear and rebuild the nav list.
    listEl.innerHTML = '';

    COURSE_ITEMS.forEach((item) => {
        const li = document.createElement('li');
        li.className = 'module-nav-item';

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'module-nav-btn';
        btn.textContent = item.label;

        // Highlight the current active item.
        if (item.key === activeKey) {
            btn.classList.add('active');
        }

        // Clicking a nav item loads that item into the main content area.
        btn.addEventListener('click', () => {
            setCurrentItem(item.key);
        });

        li.appendChild(btn);
        listEl.appendChild(li);
    });
}

// Parses HTML lesson content and extracts structured sections.
// Returns: { explanation, keyPoints, visual, prompt }
function parseAndStructureContent(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Extract first paragraph as explanation (first 2-4 lines).
    let explanation = '';
    const firstP = doc.querySelector('p');
    if (firstP) {
        const text = firstP.textContent.substring(0, 200); // limit to ~200 chars
        explanation = text.endsWith('.') ? text : text + '.';
    }

    // Extract list items as key points.
    const keyPoints = [];
    const lists = doc.querySelectorAll('ul, ol');
    lists.forEach(list => {
        list.querySelectorAll('li').forEach(item => {
            keyPoints.push(item.textContent.trim());
        });
    });

    // Extract images or visual sections.
    let visual = '';
    const images = doc.querySelectorAll('img');
    if (images.length > 0) {
        visual = images[0].outerHTML; // Take first image.
    }

    // Extract optional reflection prompt (if wrapped in a note/highlight div).
    let prompt = '';
    const noteEl = doc.querySelector('[class*="prompt"], [class*="question"], [class*="note"]');
    if (noteEl) {
        prompt = noteEl.textContent.trim();
    }

    return { explanation, keyPoints, visual, prompt };
}

// Renders the selected item in the main lesson content panel.
// Structures content for low cognitive load: title, explanation, key points, action.
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

    const totalLessons = COURSE_ITEMS.filter(item => item.key.startsWith('lesson-')).length;
    const allLessonsCompleted = completedLessonIds.size >= totalLessons;

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
                    ${hasNextItem ? 'Next step' : (canCompleteCourse ? 'Course complete' : 'Complete all lessons first')}
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
        actionBtn.addEventListener('click', async () => {
            try {
                const courseId = getCourseId();
                const userId = localStorage.getItem('userId') || 1;

                await fetch('/backend/api/modules.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ courseId, userId })
                });

                window.location.href = `public/progress.html`;
            } catch (error) {
                console.error(error);
                alert('Error saving completion.');
            }
        });
    }
}

// Updates the selected item.
// If the item is a lesson, it is also marked as completed locally.
function setCurrentItem(itemKey) {
    currentItemKey = itemKey;

    if (itemKey.startsWith('lesson-')) {
        const lessonId = Number(itemKey.replace('lesson-', ''));
        if (!Number.isNaN(lessonId)) {
            completedLessonIds.add(lessonId);
        }
    }

    renderNav(currentItemKey);
    renderCurrentItem(currentItemKey);
}

// Returns a rule-based coach response based on the clicked action.
function buildCoachResponse(action) {
    if (action === 'stuck') coachState.stuckCount += 1;
    else coachState.stuckCount = 0;

    let text = TOPIC_RULES.default[action] || TOPIC_RULES.default.explain;

    // Adds extra guidance if the learner says they are stuck repeatedly.
    if (action === 'stuck' && coachState.stuckCount > 1) {
        text += ' Try one small next step only.';
    }

    return text;
}

// Creates a simple typing effect for coach responses.
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

// Wires up the coach buttons at the bottom of the lesson page.
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

// Main page setup:
// - load modules and lessons from the database
// - build course items
// - render the first item
// - initialise the coach
async function initLessonPage() {
    try {
        const courseId = getCourseId();
        const [modules, lessons] = await Promise.all([
            fetchModules(courseId),
            fetchLessons(courseId)
        ]);

        COURSE_ITEMS = buildCourseItems(modules, lessons);
        currentItemKey = COURSE_ITEMS[0]?.key || null;

        if (currentItemKey) {
            renderNav(currentItemKey);
            renderCurrentItem(currentItemKey);
        }
    } catch (error) {
        // Show a fallback message if lesson data cannot be loaded.
        console.error(error);
        const lessonTitleEl = document.getElementById('lesson-title');
        const lessonBodyEl = document.getElementById('lesson-body');

        if (lessonTitleEl) lessonTitleEl.textContent = 'Lesson unavailable';
        if (lessonBodyEl) lessonBodyEl.innerHTML = '<p>Could not load lesson content from the database.</p>';
    }

    initCoach();
}

async function fetchModules(courseId) {
    const res = await fetch(`/backend/api/modules.php?courseId=${encodeURIComponent(courseId)}`);
    if (!res.ok) {
        const errText = await res.text();
        console.error('modules.php error:', errText);
        throw new Error('Failed to load modules');
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
}

// Start the page logic once the HTML has finished loading.
document.addEventListener('DOMContentLoaded', initLessonPage);