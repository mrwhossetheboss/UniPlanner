export interface User {
  id: string;
  email: string;
  name?: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  deadline: string;
  category: string;
  reminderValue?: string;
  reminderUnit?: string;
  completed: boolean;
  createdAt: string;
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
