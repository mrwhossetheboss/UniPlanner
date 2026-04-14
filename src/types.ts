export interface User {
  id: string;
  email: string;
  name?: string;
  role?: 'student' | 'faculty';
  sections?: string[];
  onboarded?: boolean;
  subject?: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  deadline: string;
  category: string;
  completed: boolean;
  createdAt: string;
  userId: string;
  createdBy?: string;
  creatorName?: string;
  creatorSubject?: string;
  targetSections?: string[];
  remindersSent?: string[];
  hiddenBy?: string[];
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  timestamp: string;
  read: boolean;
  type: 'reminder' | 'system' | 'success';
}

export interface Stats {
  total: number;
  completed: number;
  pending: number;
}
