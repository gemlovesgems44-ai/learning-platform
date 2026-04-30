let charts = {
    volume: null,
    rates: null,
    confidence: null,
    moduleHighlights: null
};

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

function destroyCharts() {
    Object.keys(charts).forEach((k) => {
        if (charts[k]) charts[k].destroy();
        charts[k] = null;
    });
}

function buildCharts(data) {
    destroyCharts();

    // 1) Core volume metrics
    const volumeCtx = document.getElementById('volumeChart');
    if (volumeCtx) {
        charts.volume = new Chart(volumeCtx, {
            type: 'bar',
            data: {
                labels: ['Total Users', 'Completed Lessons'],
                datasets: [{
                    label: 'Count',
                    data: [data.totalUsers || 0, data.totalCompletedLessons || 0]
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    // 2) Rates
    const ratesCtx = document.getElementById('ratesChart');
    if (ratesCtx) {
        charts.rates = new Chart(ratesCtx, {
            type: 'doughnut',
            data: {
                labels: ['Module Completion %', 'Practice Success %'],
                datasets: [{
                    data: [data.moduleCompletionPercent || 0, data.practiceSuccessRate || 0]
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }

    // 3) Confidence
    const confidenceCtx = document.getElementById('confidenceChart');
    if (confidenceCtx) {
        charts.confidence = new Chart(confidenceCtx, {
            type: 'bar',
            data: {
                labels: ['Avg Confidence Improvement'],
                datasets: [{
                    label: 'Points',
                    data: [data.averageConfidenceImprovement || 0]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true } }
            }
        });
    }

    // 4) Module highlights (uses counts if provided)
    const moduleCtx = document.getElementById('moduleHighlightsChart');
    if (moduleCtx) {
        const breakdown = Array.isArray(data.moduleBreakdown) ? data.moduleBreakdown : [];
        const labels = breakdown.map(m => m.title || `Module ${m.id}`);
        const values = breakdown.map(m => Number(m.completed_count || 0));

        charts.moduleHighlights = new Chart(moduleCtx, {
            type: 'bar',
            data: {
                labels: labels.length ? labels : [
                    data.mostPopularModule || 'Most Popular',
                    data.leastCompletedModule || 'Least Completed'
                ],
                datasets: [{
                    label: 'Completed lessons',
                    data: values.length ? values : [
                        data.mostPopularModuleCount || 0,
                        data.leastCompletedModuleCount || 0
                    ]
                }]
            },
            options: { responsive: true, maintainAspectRatio: false }
        });
    }
}

function markUpdated() {
    setText('last-updated', `Last updated: ${new Date().toLocaleTimeString()}`);
}

function bindInteractions() {
    const refreshBtn = document.getElementById('refresh-metrics-btn');
    if (refreshBtn) refreshBtn.addEventListener('click', loadAnalyticsMetrics);

    const toggleBtn = document.getElementById('toggle-chart-type-btn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', async () => {
            // Toggle logic if you want
            await loadAnalyticsMetrics();
        });
    }

    document.querySelectorAll('.stat-box[data-chart-target]').forEach(card => {
        card.addEventListener('click', () => {
            const target = card.dataset.chartTarget;
            const canvas = document.getElementById(target);
            if (!canvas) return;
            const section = canvas.closest('.chart-section');
            if (section) section.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
    });
}

async function loadAnalyticsMetrics() {
    try {
        const res = await fetch('/backend/api/admin-metrics.php?include=lessonPerformance');
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);

        const data = await res.json();

        setText('total-users', data.totalUsers ?? 0);
        setText('total-completed', data.totalCompletedLessons ?? 0);
        setText('module-completion', `${data.moduleCompletionPercent ?? 0}%`);
        setText('practice-success-rate', `${data.practiceSuccessRate ?? 0}%`);
        setText('avg-confidence-improvement', data.averageConfidenceImprovement ?? 0);
        setText('most-popular-module', data.mostPopularModule ?? '-');
        setText('least-completed-module', data.leastCompletedModule ?? '-');

        buildCharts(data);
        markUpdated();

        // Render lesson performance table from same endpoint
        if (data.lessonPerformance && Array.isArray(data.lessonPerformance)) {
            const tbody = document.getElementById('lesson-performance-body');
            if (tbody) {
                tbody.innerHTML = '';
                data.lessonPerformance.forEach((r) => {
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${r.username ?? ''}</td>
                        <td>${r.lesson_title ?? ''}</td>
                        <td>${r.lesson_score ?? 0}</td>
                        <td>${r.attempts ?? 0}</td>
                        <td>${r.pass_fail ?? 'Fail'}</td>
                        <td>${r.retry_count ?? 0}</td>
                        <td>${r.last_attempt_at ? new Date(r.last_attempt_at).toLocaleString() : '-'}</td>
                    `;
                    tbody.appendChild(tr);
                });
            }
        }
    } catch (error) {
        console.error('Error loading analytics metrics:', error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    bindInteractions();
    loadAnalyticsMetrics();
    setInterval(loadAnalyticsMetrics, 30000); // auto-refresh every 30s
});

function logout() {
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    window.location.href = 'index.html';
}