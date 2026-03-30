// This file manages the progress page, fetching and displaying user progress data.

document.addEventListener('DOMContentLoaded', function() {
    loadProgress();
    loadSuggestions();
});

// Helper function to safely format dates.
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
            return 'N/A';
        }
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } catch (e) {
        console.warn('Date format error:', dateString, e);
        return 'N/A';
    }
}

function loadProgress() {
    const userId = localStorage.getItem('userId') || 1;
    fetch(`/backend/api/progress.php?userId=${userId}`)
        .then(response => response.json())
        .then(data => {
            const progressList = document.getElementById('progress-list');
            console.log('Progress API response:', data); // DEBUG
            
            if (!data || data.length === 0) {
                progressList.innerHTML = '<p>No completed lessons yet. Start a course!</p>';
                return;
            }
            
            progressList.innerHTML = data.map((item, idx) => {
                // Support multiple field name variations
                const title = item.lessonTitle || item.lesson_title || item.title || `Lesson ${idx + 1}`;
                const dateField = item.completedAt || item.completed_at || item.dateCompleted || item.date_completed || new Date().toISOString();
                const formattedDate = formatDate(dateField);
                
                console.log(`Item ${idx}:`, { title, dateField, formattedDate }); // DEBUG
                
                return `
                    <div class="progress-item">
                        <span class="progress-item-title">${title}</span>
                        <span class="progress-item-status">Completed: ${formattedDate}</span>
                    </div>
                `;
            }).join('');
        })
        .catch(error => {
            console.error('Error loading progress:', error);
            document.getElementById('progress-list').innerHTML = '<p>Could not load progress data.</p>';
        });
}

function loadSuggestions() {
    // Get current user ID from localStorage (fallback to 1 for guest/default user).
    const userId = localStorage.getItem('userId') || 1;

    // Request suggested courses for this user from backend API.
    fetch(`/backend/api/suggestions.php?userId=${userId}`)
        .then(response => response.json()) // Parse JSON response body.
        .then(data => {
            // Get the UI container where suggestion cards will be rendered.
            const suggestions = document.getElementById('suggestions');
            console.log('Suggestions API response:', data); // DEBUG: inspect response shape.

            // If API returns no suggestions, show a friendly empty state message.
            if (!data || data.length === 0) {
                suggestions.innerHTML = '<p>No suggestions available yet.</p>';
                return;
            }

            // Render each suggestion as a card with title, description, and start link.
            // Fallback field names are included to handle backend naming differences.
            suggestions.innerHTML = data.map(item => `
                <div class="suggestion-card">
                    <h3>${item.title || item.courseName || 'Course'}</h3>
                    <p>${item.description || item.courseDescription || 'Explore this course'}</p>
                    <a href="lesson.html?courseId=${item.id || item.courseId}" class="btn btn-primary">Start</a>
                </div>
            `).join('');
        })
        .catch(error => {
            // Handle API/network errors and show a failure message in the UI.
            console.error('Error loading suggestions:', error);
            document.getElementById('suggestions').innerHTML = '<p>Could not load suggestions.</p>';
        });
}