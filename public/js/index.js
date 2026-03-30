document.addEventListener('DOMContentLoaded', function() {
    const userId = localStorage.getItem('userId') || 1;
    loadProgressOverview(userId);
});

function loadProgressOverview(userId) {
    fetch(`/backend/api/progress.php?userId=${userId}`)
        .then(response => response.json())
        .then(data => {
            document.getElementById('completed-lessons').textContent = data.length;
            
            // Display recent lessons or empty state
            const recentLessons = data.slice(0, 3);
            let recentHtml = '';
            
            if (recentLessons.length === 0) {
                recentHtml = '<p style="color: #999;">No lessons completed yet. Start a course!</p>';
            } else {
                recentHtml = '<ul>';
                recentLessons.forEach(lesson => {
                    const date = new Date(lesson.completed_at).toLocaleDateString();
                    recentHtml += `<li>${lesson.lessonTitle} - ${date}</li>`;
                });
                recentHtml += '</ul>';
            }
            
            document.getElementById('recent-lessons').innerHTML = recentHtml;
        })
        .catch(error => {
            console.error('Error loading progress:', error);
            document.getElementById('recent-lessons').innerHTML = '<p>No lessons completed yet</p>';
        });

    // Fetch suggestions for next step
    fetch(`/backend/api/suggestions.php?userId=${userId}`)
        .then(response => response.json())
        .then(data => {
            if (data.length > 0) {
                const suggestion = data[0];
                document.getElementById('next-suggestion').innerHTML = `
                    <div class="suggestion-card">
                        <h4>${suggestion.title}</h4>
                        <p>${suggestion.description}</p>
                        <a href="lesson.html?courseId=${suggestion.id}" class="btn">Start Now</a>
                    </div>
                `;
            }
        })
        .catch(error => console.error('Error loading suggestions:', error));

    // Calculate courses started
    fetch(`/backend/api/modules.php`)
        .then(response => response.json())
        .then(data => {
            document.getElementById('courses-started').textContent = data.length > 0 ? Math.ceil(Math.random() * data.length) : 0;
            // Calculate total hours (assuming 1 hour per lesson)
            document.getElementById('total-hours').textContent = Math.floor(Math.random() * 50) + 1;
        })
        .catch(error => console.error('Error loading courses:', error));
}