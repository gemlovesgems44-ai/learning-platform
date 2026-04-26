document.addEventListener('DOMContentLoaded', () => {
    const role = localStorage.getItem('role');
    if (role !== 'admin') {
        window.location.href = 'admin-login.html';
        return;
    }

    loadDashboardMetrics();
    loadActivityData();
});

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
}

async function loadDashboardMetrics() {
    try {
        const res = await fetch('/backend/api/admin-metrics.php');

        // Better debugging for 500 responses
        if (!res.ok) {
            const body = await res.text();
            throw new Error(`HTTP ${res.status}: ${body}`);
        }

        const data = await res.json();

        setText('total-users', data.totalUsers ?? 0);
        setText('total-completed', data.totalCompletedLessons ?? 0);
        setText('module-completion', `${data.moduleCompletionPercent ?? 0}%`);
        setText('most-popular-module', data.mostPopularModule ?? '-');
        setText('least-completed-module', data.leastCompletedModule ?? '-');
        setText('avg-confidence-improvement', data.averageConfidenceImprovement ?? 0);
        setText('practice-success-rate', `${data.practiceSuccessRate ?? 0}%`);
    } catch (error) {
        console.error('Error loading metrics:', error);
    }
}

async function loadActivityData() {
    try {
        const res = await fetch('/backend/api/admin-activity.php');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        const tbody = document.getElementById('activity-body');
        if (!tbody) return;

        tbody.innerHTML = '';
        (data || []).slice(0, 10).forEach(activity => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${activity.username ?? ''}</td>
                <td>${activity.action ?? ''}</td>
                <td>${activity.lesson_title || activity.module_title || ''}</td>
                <td>${activity.timestamp ? new Date(activity.timestamp).toLocaleString() : ''}</td>
            `;
            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Error loading activity:', error);
    }
}

function logout() {
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    window.location.href = 'index.html';
}