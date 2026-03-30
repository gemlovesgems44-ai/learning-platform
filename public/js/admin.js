document.addEventListener('DOMContentLoaded', function() {
    // Check if user is admin
    const role = localStorage.getItem('role');
    if (role !== 'admin') {
        window.location.href = 'admin-login.html';
        return;
    }
    
    loadDashboardMetrics();
    loadActivityData();
});

function loadDashboardMetrics() {
    fetch('/backend/api/admin-metrics.php')
        .then(response => response.json())
        .then(data => {
            document.getElementById('total-users').textContent = data.totalUsers;
            document.getElementById('active-users').textContent = data.activeUsers;
            document.getElementById('total-completed').textContent = data.totalCompleted;
            document.getElementById('efficiency').textContent = data.efficiency + '%';
        })
        .catch(error => console.error('Error loading metrics:', error));
}

function loadActivityData() {
    fetch('/backend/api/admin-activity.php')
        .then(response => response.json())
        .then(data => {
            const tbody = document.getElementById('activity-body');
            tbody.innerHTML = '';
            data.slice(0, 10).forEach(activity => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${activity.username}</td>
                    <td>${activity.action}</td>
                    <td>${activity.lesson_title || activity.module_title}</td>
                    <td>${new Date(activity.timestamp).toLocaleString()}</td>
                `;
                tbody.appendChild(row);
            });
        })
        .catch(error => console.error('Error loading activity:', error));
}

function logout() {
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    window.location.href = 'index.html';
}