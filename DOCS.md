# Agile Student Reminder - Documentation

## 1. Introduction
The Agile Student Reminder is a comprehensive task management system designed for modern students. It leverages Agile Modeling (AM) and Extreme Programming (XP) principles to deliver a high-quality, iterative solution for managing academic deadlines.

## 2. Problem Statement
Students often struggle with multiple deadlines across different subjects. Traditional to-do lists lack the visual urgency and smart categorization needed to prioritize effectively, leading to missed assignments and increased stress.

## 3. Objectives
- Provide a centralized dashboard for all academic tasks.
- Implement smart deadline warnings and priority-based visualization.
- Enable real-time filtering and search.
- Provide a calendar view for better time management.
- Demonstrate a rigorous Agile development process.

## 4. System Architecture
The application follows a modern Serverless architecture:
- **Frontend**: React.js (SPA) with Tailwind CSS for styling and Framer Motion for animations.
- **Backend/Database**: Firebase (Firestore) for real-time data storage and Firebase Authentication for user management.
- **Hosting**: Deployed via Cloud Run (or similar) with an Express server serving the static files.

## 5. Feature Mapping (R1-R5)
- **R1 (Basic Reminder)**: CRUD operations for tasks with title, description, deadline, category, and reminder settings.
- **R2 (Edit + Notifications)**: Task editing and browser-based notification system (5 mins before + custom reminders).
- **R3 (Dashboard + Categories)**: Statistical overview and advanced filtering/search.
- **R4 (Calendar)**: Integrated calendar view showing task distribution with oversized typography.
- **R5 (Advanced Features)**: Smart category suggestion and deadline-based auto-sorting.

## 6. Agile Process Explanation
We utilized a 3-sprint approach:
- **Sprint 1**: Core CRUD and Database setup.
- **Sprint 2**: Dashboard, Filtering, and UI Polish.
- **Sprint 3**: Calendar, Notifications, and Advanced AI logic.

## 7. Deployment Guide
### Frontend (Netlify)
1. Connect GitHub repository.
2. Set build command: `npm run build`.
3. Set publish directory: `dist`.
4. Add environment variables.

### Backend (Render)
1. Create a new Web Service.
2. Connect GitHub repository.
3. Set start command: `node server.ts` (or compiled version).
4. Add `MONGODB_URI` and other secrets.

## 8. Conclusion
This project demonstrates how Agile methodologies can be applied to build a user-centric application that solves real-world student problems while maintaining high code quality and process transparency.
