document.addEventListener('DOMContentLoaded', function() {
    // Check if user is admin
    const role = localStorage.getItem('role');
    if (role !== 'admin') {
        window.location.href = 'admin-login.html';
        return;
    }
    
    loadCourses();
    setupModalHandlers();
});

let currentCourseId = null;
let currentLessonId = null;

function loadCourses() {
    fetch('/backend/api/modules.php')
        .then(response => response.json())
        .then(data => {
            displayCourses(data);
        })
            .catch(() => {});
}

function displayCourses(courses) {
    const coursesList = document.getElementById('coursesList');
    coursesList.innerHTML = '';
    
    courses.forEach(course => {
        const courseCard = document.createElement('div');
        courseCard.className = 'course-card';
        courseCard.innerHTML = `
            <h3>${course.title}</h3>
            <p>${course.description}</p>
            <div class="course-actions">
                <button class="btn btn-add" onclick="openLessonModal(${course.id})">+ Add Lesson</button>
                <button class="btn btn-edit" onclick="editCourse(${course.id})">Edit</button>
                <button class="btn btn-delete" onclick="deleteCourse(${course.id})">Delete</button>
            </div>
            <div class="lessons-section" id="lessons-${course.id}">
                <h4>Lessons</h4>
                <div class="lessons-list" id="lessons-list-${course.id}"></div>
            </div>
        `;
        coursesList.appendChild(courseCard);
        
        // Load lessons for this course
        loadLessons(course.id);
    });
}

function loadLessons(courseId) {
    fetch(`/backend/api/lessons.php?courseId=${courseId}`)
        .then(response => response.json())
        .then(data => {
            displayLessons(courseId, data);
        })
            .catch(() => {});
}

function displayLessons(courseId, lessons) {
    const lessonsList = document.getElementById(`lessons-list-${courseId}`);
    lessonsList.innerHTML = '';
    
    if (lessons.length === 0) {
        lessonsList.innerHTML = '<p style="color: #999;">No lessons yet</p>';
        return;
    }
    
    lessons.forEach(lesson => {
        const lessonItem = document.createElement('div');
        lessonItem.className = 'lesson-item';
        lessonItem.innerHTML = `
            <h4>${lesson.title}</h4>
            <p>${lesson.content ? lesson.content.substring(0, 100) + '...' : 'No content'}</p>
            <div class="lesson-actions">
                <button class="btn btn-edit" onclick="editLesson(${lesson.id}, ${courseId})">Edit</button>
                <button class="btn btn-delete" onclick="deleteLesson(${lesson.id})">Delete</button>
            </div>
        `;
        lessonsList.appendChild(lessonItem);
    });
}

function openLessonModal(courseId) {
    currentCourseId = courseId;
    currentLessonId = null;
    document.getElementById('lessonForm').reset();
    document.getElementById('lessonModal').style.display = 'block';
    document.querySelector('#lessonModal h2').textContent = 'Add New Lesson';
}

function editLesson(lessonId, courseId) {
    currentCourseId = courseId;
    currentLessonId = lessonId;
    
    // For now, just open modal. In production, fetch lesson data
    document.getElementById('lessonForm').reset();
    document.getElementById('lessonModal').style.display = 'block';
    document.querySelector('#lessonModal h2').textContent = 'Edit Lesson';
}

function closeLessonModal() {
    document.getElementById('lessonModal').style.display = 'none';
    document.getElementById('lessonForm').reset();
    currentLessonId = null;
    currentCourseId = null;
}

function editCourse(courseId) {
    alert('Edit course functionality - coming soon');
}

function deleteCourse(courseId) {
    if (confirm('Are you sure you want to delete this course?')) {
        fetch(`/backend/api/modules.php?id=${courseId}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            alert('Course deleted');
            loadCourses();
        })
            .catch(() => {});
    }
}

function deleteLesson(lessonId) {
    if (confirm('Are you sure you want to delete this lesson?')) {
        fetch(`/backend/api/lessons.php?id=${lessonId}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            alert('Lesson deleted');
            loadCourses();
        })
            .catch(() => {});
    }
}

function setupModalHandlers() {
    document.getElementById('lessonForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const lessonData = {
            courseId: currentCourseId,
            title: document.getElementById('lessonTitle').value,
            content: document.getElementById('lessonContent').value
        };
        
        const endpoint = currentLessonId ? 
            `/backend/api/lessons.php?id=${currentLessonId}` : 
            '/backend/api/lessons.php';
        
        const method = currentLessonId ? 'PUT' : 'POST';
        
        fetch(endpoint, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(lessonData)
        })
        .then(response => response.json())
        .then(data => {
            alert(currentLessonId ? 'Lesson updated' : 'Lesson added');
            closeLessonModal();
            loadCourses();
        })
        .catch(error => {
            alert('Error saving lesson');
        });
    });
    
    // Close modal when clicking outside
    window.onclick = function(event) {
        const modal = document.getElementById('lessonModal');
        if (event.target === modal) {
            closeLessonModal();
        }
    }
}

function logout() {
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    localStorage.removeItem('role');
    window.location.href = 'index.html';
}