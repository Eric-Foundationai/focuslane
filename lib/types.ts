export type Lane = {
  id: string;
  name: string;
  color: string;
};

export type TaskStatus = 'todo' | 'in-progress' | 'done' | 'parked';
export type TaskPriority = 'low' | 'medium' | 'high';

export type Task = {
  id: string;
  laneId: string;
  title: string;
  description: string;
  estimateMinutes: number;
  priority: TaskPriority;
  status: TaskStatus;
  createdAt: string;
  dueDate?: string;
  resource?: string;
};

export type FocusSession = {
  id: string;
  taskId: string;
  startTime: string;
  endTime: string;
  completed: boolean;
  interrupted: boolean;
  notes?: string;
};

export type DailyPlan = {
  date: string;
  topThree: string[];
  reflection: string;
};

export type AppState = {
  lanes: Lane[];
  tasks: Task[];
  focusSessions: FocusSession[];
  dailyPlan: DailyPlan;
};
