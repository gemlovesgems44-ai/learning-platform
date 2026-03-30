// This file handles the functionality specific to the courses page, including fetching and displaying course data.
document.addEventListener('DOMContentLoaded', function() {
    fetchCourses();
});

function fetchCourses() {
    fetch('/backend/api/modules.php')
        .then(response => response.json())
        .then(data => {
            displayCourses(data);
        })
        .catch(error => {
            console.error('Error fetching courses:', error);
            document.getElementById('courses-container').innerHTML = '<p>Error loading courses</p>';
        });
}

function displayCourses(courses) {
    const container = document.getElementById('courses-container');
    
    if (courses.length === 0) {
        container.innerHTML = '<p>No courses available</p>';
        return;
    }
    
    let html = '<div class="courses-grid">';
    
    courses.forEach(course => {
        html += `
            <div class="course-card">
                <h3>${course.title}</h3>
                <p>${course.description}</p>
                <a href="lesson.html?courseId=${course.id}" class="btn">Start Course</a>
            </div>
        `;
    });
    
    html += '</div>';
    container.innerHTML = html;
}