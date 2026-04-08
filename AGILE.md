# Agile Artifacts

## 1. Product Backlog
| ID | User Story | Priority | Estimate (Points) |
|----|------------|----------|-------------------|
| US1 | As a student, I want to add a task with a deadline so I don't forget it. | High | 3 |
| US2 | As a student, I want to see my tasks in a dashboard so I can track progress. | High | 5 |
| US3 | As a student, I want to filter tasks by category so I can focus on one subject. | Medium | 2 |
| US4 | As a student, I want to see tasks on a calendar for visual planning. | Medium | 8 |
| US5 | As a student, I want to receive notifications for upcoming deadlines. | High | 5 |
| US6 | As a student, I want smart suggestions for task categories based on keywords. | Low | 3 |
| US7 | As a student, I want to register and login securely to keep my tasks private. | High | 5 |
| US8 | As a student, I want to reset my password if I forget it. | Medium | 3 |

## 2. Sprint Planning

### Sprint 1: Foundation (Days 1-5)
- **Goal**: Functional CRUD and Basic UI.
- **Tasks**:
  - Setup Express server and MongoDB models.
  - Implement Task creation API.
  - Build Task List UI with Tailwind.
  - Implement "Mark as Complete" logic.

### Sprint 2: Enhancement (Days 6-10)
- **Goal**: Dashboard and Filtering.
- **Tasks**:
  - Build Dashboard stats (Total/Pending/Done).
  - Implement Search and Category filters.
  - Add Framer Motion animations.
  - Setup Jest testing environment.

### Sprint 3: Advanced Features (Days 11-15)
- **Goal**: Calendar and Notifications.
- **Tasks**:
  - Integrate React Calendar.
  - Implement Browser Notification API.
  - Add "Smart Category" keyword logic.
  - Finalize documentation and CI/CD.

## 3. Daily Standup Samples

### Day 3 (Sprint 1)
- **Yesterday**: Finished Backend MVC structure and Task model.
- **Today**: Working on the Task creation form and validation.
- **Blockers**: None.

### Day 8 (Sprint 2)
- **Yesterday**: Completed Dashboard stats logic.
- **Today**: Implementing the search bar and category pills.
- **Blockers**: Had some issues with Tailwind responsive breakpoints, now resolved.

### Day 13 (Sprint 3)
- **Yesterday**: Integrated the calendar view.
- **Today**: Adding the smart category detection logic and deadline warnings.
- **Blockers**: Notification permissions in iframe (noted for demo).

## 4. Retrospective (Sprint 2)
- **What went well**: UI design is very polished; team velocity is high.
- **What could be improved**: More unit tests for the filter logic.
- **Action Items**: Dedicate Day 10 to writing Jest tests.

## 5. Git Commit History Simulation
1. `feat: initial project structure and dependencies`
2. `feat: setup express server with mvc pattern`
3. `feat: add task model and mongoose connection`
4. `feat: implement task crud api endpoints`
5. `feat: build basic task list ui`
6. `feat: add task creation form with validation`
7. `feat: implement dashboard statistics`
8. `feat: add search and category filtering`
9. `style: apply gen-z dark mode aesthetic`
10. `feat: integrate calendar view`
11. `feat: add smart category detection logic`
12. `feat: implement deadline warning system`
13. `test: add jest unit tests for controllers`
14. `docs: complete agile artifacts and report`
15. `chore: setup github actions ci pipeline`
