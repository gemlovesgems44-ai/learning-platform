# Learning Platform

## Overview
The Learning Platform is a web application designed to provide users with access to various courses, lessons, and practice areas. It tracks user progress and offers support through a coaching feature.

## Project Structure
```
learning-platform
├── public
│   ├── index.html          # Landing page
│   ├── courses.html        # Course list page
│   ├── lesson.html         # Lesson/module page
│   ├── practice.html       # Practice area
│   ├── progress.html       # User progress page
│   ├── css
│   │   ├── style.css       # General styles
│   │   ├── courses.css     # Styles for courses page
│   │   ├── lesson.css      # Styles for lesson page
│   │   ├── practice.css    # Styles for practice area
│   │   └── progress.css    # Styles for progress page
│   └── js
│       ├── main.js         # Main JavaScript functionality
│       ├── courses.js      # JavaScript for courses page
│       ├── lesson.js       # JavaScript for lesson page
│       ├── practice.js     # JavaScript for practice area
│       └── progress.js     # JavaScript for progress page
├── backend
│   ├── config
│   │   └── database.php    # Database connection settings
│   ├── api
│   │   ├── modules.php     # API for module data
│   │   ├── progress.php    # API for user progress
│   │   ├── lessons.php     # API for lesson data
│   │   └── coach.php       # API for coach help
│   ├── controllers
│   │   ├── ModuleController.php  # Controller for module requests
│   │   ├── ProgressController.php # Controller for progress management
│   │   └── CoachController.php    # Controller for coach-related requests
│   └── models
│       ├── Module.php      # Module data model
│       ├── Progress.php    # Progress data model
│       ├── Lesson.php      # Lesson data model
│       └── User.php        # User data model
├── database
│   └── schema.sql          # SQL schema for database tables
└── README.md               # Project documentation
```

## Setup Instructions
1. Clone the repository to your local machine.
2. Navigate to the `backend/config` directory and update the `database.php` file with your database credentials.
3. Run the SQL commands in `database/schema.sql` to set up the database tables.
4. Open the `public/index.html` file in your web browser to access the application.

## Features
- **Course List**: Users can view available courses and select them to see more details.
- **Lesson Content**: Each course contains lessons that users can access for learning.
- **Practice Area**: Users can engage with exercises related to their lessons.
- **Progress Tracking**: The application tracks user progress across courses and lessons.
- **Coach Help**: Users can access support and resources from coaches.

## Technologies Used
- HTML, CSS, JavaScript for the frontend
- PHP for the backend
- MySQL for the database

## Contributing
Contributions are welcome! Please submit a pull request or open an issue for any enhancements or bug fixes.