# Learning Platform

## Overview
Learning Platform is a full-stack web application for course-based learning. It provides lesson delivery, progress tracking, AI-assisted coaching, and an admin area for course management and analytics.

## Current Project Structure
```
learning-platform
├── backend
│   ├── api
│   │   ├── admin-activity.php
│   │   ├── admin-metrics.php
│   │   ├── ai_coach.php
│   │   ├── lessons.php
│   │   ├── login.php
│   │   ├── module-feedback.php
│   │   ├── modules.php
│   │   ├── progress.php
│   │   └── suggestions.php
│   └── config
│       └── database.php
├── database
│   └── schema.sql
├── public
│   ├── admin-analytics.html
│   ├── admin-courses.html
│   ├── admin-dashboard.html
│   ├── admin-login.html
│   ├── courses.html
│   ├── index.html
│   ├── lesson.html
│   ├── progress.html
│   ├── css
│   │   ├── admin-analytics.css
│   │   ├── admin-courses.css
│   │   ├── admin.css
│   │   ├── courses.css
│   │   ├── lesson.css
│   │   ├── login.css
│   │   ├── progress.css
│   │   └── style.css
│   └── js
│       ├── admin-analytics.js
│       ├── admin-courses.js
│       ├── admin-login.js
│       ├── admin.js
│       ├── courses.js
│       ├── index.js
│       ├── lesson.js
│       ├── main.js
│       └── progress.js
├── vendor/
├── .env
├── composer.json
├── composer.lock
└── README.md
```

## Setup
1. Install dependencies:
   ```bash
   composer install
   ```
2. Configure environment values in `.env` and/or update database settings in `backend/config/database.php`.
3. Create the database tables using `database/schema.sql`.
4. Set `OPENAI_API_KEY` in your environment (or `.env`) to enable AI coach responses.
5. Start a local server from the project root:
   ```bash
   php -S localhost:8000 -t public
   ```
6. Open `http://localhost:8000`.

## Main Frontend Pages
- `index.html`: Entry page and summary widgets.
- `courses.html`: Course/module catalogue.
- `lesson.html`: Lesson content and AI coach actions.
- `progress.html`: User progress and suggestions.
- `admin-login.html`: Admin authentication.
- `admin-dashboard.html`: Admin KPI overview and activity feed.
- `admin-courses.html`: Admin module/lesson management.
- `admin-analytics.html`: Admin analytics visualizations.

## API Endpoints
- `login.php`: User/admin login.
- `modules.php`: Read and manage modules.
- `lessons.php`: Read and manage lessons.
- `progress.php`: Read and update lesson progress.
- `suggestions.php`: Return next-learning suggestions.
- `module-feedback.php`: Persist module feedback from lesson flows.
- `ai_coach.php`: AI-powered coach responses using OpenAI.
- `admin-metrics.php`: Dashboard and analytics metrics.
- `admin-activity.php`: Recent platform activity feed.

## Database (Current schema.sql)
- `users`: Basic user records.
- `modules`: Course modules.
- `lessons`: Lessons linked to modules.
- `progress`: Per-user lesson status tracking.

## Technologies
- Frontend: HTML, CSS, vanilla JavaScript.
- Backend: PHP.
- Database: MySQL.
- Dependency management: Composer.
- AI integration: OpenAI API.

## Notes
- Logging statements (`console.*` and `error_log`) have been removed from the current codebase.
- Legacy folders previously mentioned in older docs (`backend/controllers`, `backend/models`) are not part of the current project structure.
