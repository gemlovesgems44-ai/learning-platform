document.getElementById('login-form').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    fetch('/backend/api/login.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username, password: password })
    })
    .then(response => response.json())
    .then(data => {
        if (data.userId) {
            if (data.role === 'admin') {
                localStorage.setItem('userId', data.userId);
                localStorage.setItem('username', data.username);
                localStorage.setItem('role', data.role);
                window.location.href = 'admin-dashboard.html';
            } else {
                document.getElementById('error-message').textContent = 'Only admins can access this area';
            }
        } else {
            document.getElementById('error-message').textContent = data.message;
        }
    })
    .catch(error => {
        document.getElementById('error-message').textContent = 'Login failed';
        console.error('Error:', error);
    });
});