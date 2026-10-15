import localforage from 'localforage';
import { AppState, Lane, Task } from './types';

const STORAGE_KEY = 'focuslane-v1';

export const defaultLanes: Lane[] = [
  { id: 'lane-foundation', name: 'Foundation AI onboarding', color: '#4f46e5' },
  { id: 'lane-python', name: 'Python', color: '#10b981' },
  { id: 'lane-ml', name: 'ML fundamentals', color: '#f59e0b' },
  { id: 'lane-tools', name: 'Tools & infra', color: '#ef4444' },
  { id: 'lane-reading', name: 'Reading & research', color: '#8b5cf6' },
];

const defaultTasks: Task[] = [
  {
    id: 'task-1',
    laneId: 'lane-foundation',
    title: 'Read onboarding guide',
    description: 'Read the Foundation AI onboarding overview and note the main setup steps.',
    estimateMinutes: 20,
    priority: 'high',
    status: 'todo',
    createdAt: new Date().toISOString(),
    resource: 'internal docs',
  },
  {
    id: 'task-2',
    laneId: 'lane-python',
    title: 'Set up Python environment',
    description: 'Verify Python version, install dependencies, and run a simple script.',
    estimateMinutes: 30,
    priority: 'high',
    status: 'todo',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'task-3',
    laneId: 'lane-tools',
    title: 'Review developer setup checklist',
    description: 'Check accounts, environment variables, and required tools for local development.',
    estimateMinutes: 25,
    priority: 'medium',
    status: 'todo',
    createdAt: new Date().toISOString(),
  },
];

export const defaultState: AppState = {
  lanes: defaultLanes,
  tasks: defaultTasks,
  focusSessions: [],
  dailyPlan: {
    date: new Date().toISOString().slice(0, 10),
    topThree: ['Read onboarding guide', 'Set up Python environment', 'Review developer setup checklist'],
    reflection: '',
  },
};

localforage.config({
  name: 'Focuslane',
  storeName: 'focuslane-store',
});

export async function getAppState(): Promise<AppState> {
  const saved = await localforage.getItem<AppState>(STORAGE_KEY);
  return saved ?? defaultState;
}

export async function saveAppState(state: AppState) {
  await localforage.setItem(STORAGE_KEY, state);
}

export async function resetAppState() {
  await localforage.setItem(STORAGE_KEY, defaultState);
}
