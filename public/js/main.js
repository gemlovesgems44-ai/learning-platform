// This file contains the main functionality for the application.

document.addEventListener('DOMContentLoaded', function() {
    // Get user ID from localStorage if it exists (for progress tracking)
    const userId = localStorage.getItem('userId') || 1;
});

function logout() {
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    window.location.href = 'admin-login.html';
}