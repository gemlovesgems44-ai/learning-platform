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
            document.getElementById('courses-container').innerHTML = '<p>Error loading courses</p>';
        });
}

function displayCourses(courses) {
    const container = document.getElementById('courses-container');

    if (!courses || courses.length === 0) {
        container.innerHTML = '<p>No courses available</p>';
        return;
    }

    container.innerHTML = `
        <div class="courses-carousel">
            <button class="carousel-btn prev" id="carousel-prev" aria-label="Previous courses">‹</button>

            <div class="carousel-viewport" id="courses-viewport">
                <div class="carousel-track">
                    ${courses.map(course => `
                        <article class="course-card">
                            <h3>${course.title || 'Course'}</h3>
                            <p>${course.description || ''}</p>
                            <a href="lesson.html?moduleId=${course.id}" class="btn">Start Course</a>
                        </article>
                    `).join('')}
                </div>
            </div>

            <button class="carousel-btn next" id="carousel-next" aria-label="Next courses">›</button>
        </div>
    `;

    const viewport = document.getElementById('courses-viewport');
    document.getElementById('carousel-prev')?.addEventListener('click', () => {
        viewport.scrollBy({ left: -viewport.clientWidth, behavior: 'smooth' });
    });
    document.getElementById('carousel-next')?.addEventListener('click', () => {
        viewport.scrollBy({ left: viewport.clientWidth, behavior: 'smooth' });
    });
}