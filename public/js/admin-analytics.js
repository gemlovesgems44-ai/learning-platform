document.addEventListener('DOMContentLoaded', function() {
    const role = localStorage.getItem('role');
    if (role !== 'admin') {
        window.location.href = 'admin-login.html';
        return;
    }
    
    loadAnalytics();
});

function loadAnalytics() {
    loadActivityChart();
    loadCompletionChart();
    loadPopularCoursesChart();
    loadStats();
    loadEngagementTable();
}

function loadActivityChart() {
    const ctx = document.getElementById('activityChart').getContext('2d');
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{
                label: 'Active Users',
                data: [12, 19, 15, 25, 22, 30, 28],
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function loadCompletionChart() {
    const ctx = document.getElementById('completionChart').getContext('2d');
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Completed', 'In Progress', 'Not Started'],
            datasets: [{
                data: [65, 25, 10],
                backgroundColor: [
                    '#28a745',
                    '#ffc107',
                    '#dc3545'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

function loadPopularCoursesChart() {
    const ctx = document.getElementById('popularCoursesChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Employment', 'Digital Safety', 'Health Access', 'Tech Skills', 'Communication'],
            datasets: [{
                label: 'Enrollments',
                data: [145, 120, 98, 76, 54],
                backgroundColor: [
                    '#667eea',
                    '#764ba2',
                    '#f093fb',
                    '#4facfe',
                    '#00f2fe'
                ]
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function loadStats() {
    document.getElementById('avg-completion').textContent = '8.5 hours';
    document.getElementById('retention-rate').textContent = '78%';
    document.getElementById('active-week').textContent = '156';
    document.getElementById('total-usage').textContent = '1,234 hours';
}

function loadEngagementTable() {
    const tableBody = document.getElementById('engagement-table');
    const data = [
        { course: 'Employment Readiness', enrolled: 145, completed: 94, time: 7.5 },
        { course: 'Digital Safety & Confidence', enrolled: 120, completed: 85, time: 6.2 },
        { course: 'Health Access', enrolled: 98, completed: 62, time: 5.8 },
        { course: 'Tech Skills', enrolled: 76, completed: 45, time: 9.1 },
        { course: 'Communication', enrolled: 54, completed: 32, time: 4.3 }
    ];
    
    tableBody.innerHTML = '';
    data.forEach(item => {
        const completionRate = Math.round((item.completed / item.enrolled) * 100);
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${item.course}</td>
            <td>${item.enrolled}</td>
            <td>${item.completed}</td>
            <td>${completionRate}%</td>
            <td>${item.time}</td>
        `;
        tableBody.appendChild(row);
    });
}

function logout() {
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    window.location.href = 'index.html';
}