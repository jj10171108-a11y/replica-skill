export type Priority = 0 | 1 | 2 | 3;
export type Repeat = 'none' | 'daily' | 'weekdays' | 'weekly' | 'monthly';

export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

export interface Task {
  id: string;
  title: string;
  note: string;
  projectId: string | null;
  goalId: string | null;
  /** YYYY-MM-DD */
  due: string | null;
  /** HH:mm */
  time: string | null;
  priority: Priority;
  repeat: Repeat;
  remind: boolean;
  notifId?: string | null;
  subtasks: Subtask[];
  done: boolean;
  doneAt: number | null;
  createdAt: number;
}

export interface Project {
  id: string;
  name: string;
  emoji: string;
  color: string;
  createdAt: number;
}

export interface Goal {
  id: string;
  title: string;
  emoji: string;
  /** YYYY-MM-DD */
  deadline: string | null;
  createdAt: number;
}

export interface Note {
  id: string;
  title: string;
  body: string;
  /** YYYY-MM-DD, links the note to a calendar day */
  date: string | null;
  color: string;
  pinned: boolean;
  updatedAt: number;
}

export type ThemeMode = 'system' | 'light' | 'dark';

export interface Settings {
  theme: ThemeMode;
  weekStart: 0 | 1;
  notifications: boolean;
  pinEnabled: boolean;
  defaultReminderMin: number;
}

export interface AppData {
  version: 1;
  tasks: Task[];
  projects: Project[];
  goals: Goal[];
  notes: Note[];
  settings: Settings;
}
