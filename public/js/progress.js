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
    const userId = localStorage.getItem('userId') || 1;
    fetch(`/backend/api/suggestions.php?userId=${userId}`)
        .then(response => response.json())
        .then(data => {
            const suggestions = document.getElementById('suggestions');
            console.log('Suggestions API response:', data); // DEBUG
            
            if (!data || data.length === 0) {
                suggestions.innerHTML = '<p>No suggestions available yet.</p>';
                return;
            }
            
            suggestions.innerHTML = data.map(item => `
                <div class="suggestion-card">
                    <h3>${item.title || item.courseName || 'Course'}</h3>
                    <p>${item.description || item.courseDescription || 'Explore this course'}</p>
                    <a href="lesson.html?courseId=${item.id || item.courseId}" class="btn btn-primary">Start</a>
                </div>
            `).join('');
        })
        .catch(error => {
            console.error('Error loading suggestions:', error);
            document.getElementById('suggestions').innerHTML = '<p>Could not load suggestions.</p>';
        });
}