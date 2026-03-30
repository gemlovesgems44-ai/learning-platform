// This file contains the logic for the practice area, including exercises and user interactions.

document.addEventListener('DOMContentLoaded', function() {
    const params = new URLSearchParams(window.location.search);
    const lessonId = params.get('lessonId');
    
    loadPractice(lessonId);
    
    document.getElementById('ask-coach-btn').addEventListener('click', function() {
        askCoach(lessonId);
    });
});

function loadPractice(lessonId) {
    fetch(`/backend/api/practice.php?lessonId=${lessonId}`)
        .then(response => response.json())
        .then(data => {
            const practiceContent = document.getElementById('practice-content');
            practiceContent.innerHTML = `
                <div class="exercise">
                    <h3>${data.title}</h3>
                    <p>${data.task}</p>
                </div>
            `;
        })
        .catch(error => console.error('Error loading practice:', error));
}

function askCoach(lessonId) {
    const question = document.getElementById('question-input').value;
    const userId = localStorage.getItem('userId') || 1;
    
    if (!question.trim()) {
        alert('Please enter a question');
        return;
    }
    
    fetch('/backend/api/coach.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userId, lessonId: lessonId, question: question })
    })
    .then(response => response.json())
    .then(data => {
        document.getElementById('coach-response').innerHTML = `<p><strong>Coach:</strong> ${data.response}</p>`;
        document.getElementById('question-input').value = '';
    })
    .catch(error => console.error('Error asking coach:', error));
}