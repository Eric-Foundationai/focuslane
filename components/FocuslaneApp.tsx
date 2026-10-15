'use client';

import { useEffect, useMemo, useState } from 'react';
import { AppState, DailyPlan, FocusSession, Lane, Task, TaskPriority, TaskStatus } from '@/lib/types';
import { defaultState, getAppState, saveAppState } from '@/lib/storage';

const createId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 9)}`;

function Modal({ children, onClose, title }: { children: React.ReactNode; onClose: () => void; title?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="mx-4 max-w-2xl rounded-lg bg-white p-6 shadow-lg">
        {title && <h3 className="mb-3 text-lg font-semibold">{title}</h3>}
        <div>{children}</div>
        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className="rounded-full border border-slate-300 bg-white px-3 py-2 text-sm">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FocuslaneApp() {
  const [state, setState] = useState<AppState>(defaultState);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [clock, setClock] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [newTask, setNewTask] = useState({
    laneId: defaultState.lanes[0]?.id ?? '',
    title: '',
    description: '',
    estimateMinutes: 20,
    priority: 'medium' as TaskPriority,
  });
  const [reflection, setReflection] = useState('');
  const [showMorningModal, setShowMorningModal] = useState(false);
  const [activeSession, setActiveSession] = useState<FocusSession | null>(null);

  const selectedTask = useMemo(
    () => state.tasks.find((task) => task.id === selectedTaskId) ?? null,
    [selectedTaskId, state.tasks],
  );

  useEffect(() => {
    async function load() {
      const loaded = await getAppState();
      setState(loaded);
      setSelectedTaskId(loaded.tasks[0]?.id ?? null);
      setReflection(loaded.dailyPlan.reflection ?? '');

      // If daily plan is not for today, prompt morning planning
      const today = new Date().toISOString().slice(0, 10);
      if (!loaded.dailyPlan || loaded.dailyPlan.date !== today) {
        setShowMorningModal(true);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (!selectedTask) return;
    const totalSeconds = selectedTask.estimateMinutes * 60;
    setClock(totalSeconds);
  }, [selectedTaskId, selectedTask?.estimateMinutes]);

  useEffect(() => {
    if (!isRunning) return;

    const timer = window.setInterval(() => {
      setClock((current) => {
        if (current <= 1) {
          setIsRunning(false);
          // auto-finish the session
          handleFinishSession();
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [isRunning]);

  useEffect(() => {
    if (state.tasks.length > 0 && !selectedTaskId) {
      setSelectedTaskId(state.tasks[0].id);
    }
  }, [selectedTaskId, state.tasks]);

  useEffect(() => {
    saveAppState(state).catch(() => undefined);
  }, [state]);

  const todayTasks = state.tasks.filter((task) => task.status !== 'done').slice(0, 10);
  const laneMap = useMemo(
    () => Object.fromEntries(state.lanes.map((lane) => [lane.id, lane])),
    [state.lanes],
  );

  const addTask = () => {
    if (!newTask.title.trim()) return;

    const task: Task = {
      id: createId('task'),
      laneId: newTask.laneId,
      title: newTask.title.trim(),
      description: newTask.description.trim(),
      estimateMinutes: newTask.estimateMinutes,
      priority: newTask.priority,
      status: 'todo',
      createdAt: new Date().toISOString(),
    };

    setState((current) => ({
      ...current,
      tasks: [task, ...current.tasks],
    }));

    setNewTask({
      laneId: state.lanes[0]?.id ?? '',
      title: '',
      description: '',
      estimateMinutes: 20,
      priority: 'medium',
    });
    setSelectedTaskId(task.id);
  };

  const updateTaskStatus = (taskId: string, nextStatus: TaskStatus) => {
    setState((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        task.id === taskId ? { ...task, status: nextStatus } : task,
      ),
    }));
  };

  function startFocus() {
    if (!selectedTask) return;
    // create a session
    const session: FocusSession = {
      id: createId('session'),
      taskId: selectedTask.id,
      startTime: new Date().toISOString(),
      completed: false,
      interruptedCount: 0,
    };
    setActiveSession(session);
    setState((current) => ({ ...current, focusSessions: [session, ...current.focusSessions] }));
    setIsRunning(true);
  }

  function logInterruption() {
    if (!activeSession) return;
    setActiveSession((s) => {
      if (!s) return s;
      return { ...s, interruptedCount: s.interruptedCount + 1 };
    });
    // also update the stored session
    setState((current) => ({
      ...current,
      focusSessions: current.focusSessions.map((sess) =>
        sess.id === activeSession?.id ? { ...sess, interruptedCount: (sess.interruptedCount || 0) + 1 } : sess,
      ),
    }));
  }

  function handleFinishSession() {
    if (!activeSession) return;
    const updated: FocusSession = { ...activeSession, endTime: new Date().toISOString(), completed: true };
    setActiveSession(null);
    setState((current) => ({
      ...current,
      focusSessions: current.focusSessions.map((sess) => (sess.id === updated.id ? updated : sess)),
      tasks: current.tasks.map((t) => (t.id === updated.taskId ? { ...t, status: 'done' } : t)),
    }));
    setIsRunning(false);
    setClock(0);
  }

  const handleDailyPlanSave = (topThreeIds?: string[]) => {
    const top = topThreeIds ?? state.dailyPlan.topThree ?? [];
    const dailyPlan: DailyPlan = {
      date: new Date().toISOString().slice(0, 10),
      topThree: top.length > 0 ? top : [state.tasks[0]?.id ?? ''],
      reflection,
    };

    setState((current) => ({
      ...current,
      dailyPlan,
    }));
    setShowMorningModal(false);
  };

  const formatClock = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
      .toString()
      .padStart(2, '0');
    const secs = (seconds % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  };

  const setTopThreeBySelection = (ids: string[]) => {
    setState((current) => ({
      ...current,
      dailyPlan: { ...current.dailyPlan, topThree: ids },
    }));
  };

  const reviewsDue = state.tasks.filter((t) => t.nextReview && t.nextReview <= new Date().toISOString().slice(0, 10));

  const last7Days = () => {
    const now = new Date();
    const days: { date: string; completed: number; minutes: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const day = d.toISOString().slice(0, 10);
      const sessions = state.focusSessions.filter((s) => s.startTime.slice(0, 10) === day && s.completed);
      const completed = sessions.length;
      const minutes = sessions.reduce((sum, s) => {
        if (!s.endTime) return sum;
        const start = new Date(s.startTime).getTime();
        const end = new Date(s.endTime).getTime();
        return sum + Math.round((end - start) / 60000);
      }, 0);
      days.push({ date: day, completed, minutes });
    }
    return days;
  };

  return (
    <main className="min-h-screen p-6 text-slate-800">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex items-center justify-between rounded-2xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">Focuslane</p>
            <h1 className="mt-1 text-2xl font-bold">Learning plan</h1>
            <p className="text-sm text-slate-500">{state.dailyPlan.date} • Top 3: {state.dailyPlan.topThree.map((id) => state.tasks.find((t) => t.id === id)?.title ?? '').join(' • ')}</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => resetStatePrompt()}
              className="rounded-full border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              New day
            </button>
            <button
              onClick={() => void (async () => {
                await navigator.clipboard?.writeText(window.location.href);
                alert('Link copied');
              })()}
              className="rounded-full border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Share
            </button>
          </div>
        </header>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_1.4fr_1fr]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Today</h2>
              <span className="rounded-full bg-indigo-100 px-2 py-1 text-xs font-medium text-indigo-700">
                {state.dailyPlan.topThree.length} top
              </span>
            </div>

            <div className="space-y-3">
              {state.dailyPlan.topThree.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-500">No top priorities yet</p>
              ) : (
                state.dailyPlan.topThree.map((id) => {
                  const task = state.tasks.find((t) => t.id === id);
                  if (!task) return null;
                  return (
                    <button
                      key={task.id}
                      onClick={() => setSelectedTaskId(task.id)}
                      className={`w-full rounded-xl border p-3 text-left transition ${selectedTask?.id === task.id ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-slate-50 hover:border-slate-300'}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium">{task.title}</p>
                          <p className="text-xs text-slate-500">{laneMap[task.laneId]?.name ?? 'General'} • {task.estimateMinutes} min</p>
                        </div>
                        <span className="rounded-full bg-amber-100 px-2 py-1 text-[10px] font-semibold uppercase text-amber-700">{task.priority}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-sm font-medium text-slate-700">Daily check-in</p>
              <textarea value={reflection} onChange={(e) => setReflection(e.target.value)} placeholder="What did I finish? What felt hard?" className="min-h-[90px] w-full resize-none rounded-lg border border-slate-200 bg-white p-2 text-sm outline-none ring-0 placeholder:text-slate-400" />
              <div className="mt-3 flex gap-3">
                <button onClick={() => handleDailyPlanSave()} className="inline-flex rounded-full bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-indigo-500">Save plan</button>
                <button onClick={() => setShowMorningModal(true)} className="inline-flex rounded-full border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700">Edit top 3</button>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Focus</h2>
              {selectedTask && <span className="rounded-full bg-indigo-100 px-2 py-1 text-xs font-semibold text-indigo-700">{selectedTask.title}</span>}
            </div>

            <div className="rounded-2xl bg-slate-100 p-6 text-center">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Session timer</p>
              <div className="mt-4 text-5xl font-bold tabular-nums text-slate-800">{formatClock(clock)}</div>
              <div className="mt-5 flex justify-center gap-3">
                <button onClick={() => (isRunning ? setIsRunning(false) : startFocus())} className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500">{isRunning ? 'Pause' : activeSession ? 'Resume' : 'Start'}</button>
                <button onClick={() => { setIsRunning(false); setClock(selectedTask ? selectedTask.estimateMinutes * 60 : 0); }} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700">Reset</button>
              </div>
            </div>

            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-medium text-slate-700">Quick session actions</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button onClick={() => updateTaskStatus(selectedTask?.id ?? '', 'done')} className="rounded-full bg-emerald-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-400">Mark done</button>
                <button onClick={() => updateTaskStatus(selectedTask?.id ?? '', 'parked')} className="rounded-full border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700">Park task</button>
                <button onClick={() => handleFinishSession()} className="rounded-full border border-indigo-300 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-700">Finish session</button>
                <button onClick={() => logInterruption()} className="rounded-full border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700">Log interruption</button>
              </div>
            </div>

            <div className="mt-5">
              <p className="mb-2 text-sm font-medium text-slate-700">Add a task</p>
              <div className="space-y-3">
                <input value={newTask.title} onChange={(e) => setNewTask((current) => ({ ...current, title: e.target.value }))} placeholder="Task title" className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm outline-none focus:border-indigo-400" />
                <textarea value={newTask.description} onChange={(e) => setNewTask((current) => ({ ...current, description: e.target.value }))} placeholder="Short description" className="min-h-[70px] w-full resize-none rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm outline-none focus:border-indigo-400" />
                <div className="grid grid-cols-2 gap-3">
                  <select value={newTask.laneId} onChange={(e) => setNewTask((current) => ({ ...current, laneId: e.target.value }))} className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm outline-none focus:border-indigo-400">
                    {state.lanes.map((lane) => (
                      <option key={lane.id} value={lane.id}>{lane.name}</option>
                    ))}
                  </select>
                  <select value={newTask.priority} onChange={(e) => setNewTask((current) => ({ ...current, priority: e.target.value as TaskPriority }))} className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm outline-none focus:border-indigo-400">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <input type="number" min={5} value={newTask.estimateMinutes} onChange={(e) => setNewTask((current) => ({ ...current, estimateMinutes: Number(e.target.value) || 5 }))} className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-sm outline-none focus:border-indigo-400" />
                <button onClick={addTask} className="w-full rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800">Save task</button>
              </div>
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold">Lanes</h2>
              <div className="mt-4 space-y-3">
                {state.lanes.map((lane) => {
                  const laneTasks = state.tasks.filter((task) => task.laneId === lane.id);
                  return (
                    <div key={lane.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="h-3 w-3 rounded-full" style={{ background: lane.color }} />
                          <span className="font-medium text-slate-700">{lane.name}</span>
                        </div>
                        <span className="text-xs text-slate-500">{laneTasks.length}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-semibold">Progress</h2>
              <div className="mt-4 space-y-3">
                <div className="rounded-xl bg-indigo-50 p-3">
                  <p className="text-xs uppercase tracking-[0.15em] text-indigo-600">Completed</p>
                  <p className="mt-2 text-2xl font-bold text-indigo-700">{state.tasks.filter((task) => task.status === 'done').length}</p>
                </div>
                <div className="rounded-xl bg-emerald-50 p-3">
                  <p className="text-xs uppercase tracking-[0.15em] text-emerald-600">Active</p>
                  <p className="mt-2 text-2xl font-bold text-emerald-700">{state.tasks.filter((task) => task.status !== 'done' && task.status !== 'parked').length}</p>
                </div>
                <div className="rounded-xl bg-amber-50 p-3">
                  <p className="text-xs uppercase tracking-[0.15em] text-amber-600">Parked</p>
                  <p className="mt-2 text-2xl font-bold text-amber-700">{state.tasks.filter((task) => task.status === 'parked').length}</p>
                </div>
              </div>

              <div className="mt-4">
                <h3 className="text-sm font-semibold">Reviews due</h3>
                {reviewsDue.length === 0 ? (
                  <p className="text-sm text-slate-500">No reviews due</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {reviewsDue.map((r) => (
                      <li key={r.id} className="rounded-md bg-slate-50 p-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">{r.title}</p>
                            <p className="text-xs text-slate-500">{laneMap[r.laneId]?.name ?? ''}</p>
                          </div>
                          <button onClick={() => {
                            // mark review as done and schedule next
                            const next = new Date();
                            const days = r.reviewIntervalDays ?? 3;
                            next.setDate(next.getDate() + days);
                            setState((current) => ({
                              ...current,
                              tasks: current.tasks.map((t) => t.id === r.id ? { ...t, nextReview: next.toISOString().slice(0,10), reviewIntervalDays: days * 2 } : t),
                            }));
                          }} className="rounded-full bg-indigo-600 px-3 py-1 text-xs font-medium text-white">Reviewed</button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="mt-4">
                <h3 className="text-sm font-semibold">Last 7 days</h3>
                <div className="mt-2 space-y-2">
                  {last7Days().map((d) => (
                    <div key={d.date} className="flex items-center justify-between rounded-md bg-slate-50 p-2">
                      <div>
                        <p className="text-sm">{d.date}</p>
                        <p className="text-xs text-slate-500">{d.completed} sessions • {d.minutes} min</p>
                      </div>
                      <div className="text-sm font-semibold">{d.minutes}m</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {showMorningModal && (
        <Modal title="Morning planning" onClose={() => setShowMorningModal(false)}>
          <p className="mb-3 text-sm text-slate-600">Pick up to 3 priorities for today.</p>
          <div className="grid gap-2">
            {state.tasks.slice(0, 20).map((t) => {
              const checked = state.dailyPlan.topThree.includes(t.id);
              return (
                <label key={t.id} className="flex items-center gap-3 rounded-md border p-2">
                  <input type="checkbox" checked={checked} onChange={(e) => {
                    const next = e.target.checked ? [...state.dailyPlan.topThree, t.id] : state.dailyPlan.topThree.filter((id) => id !== t.id);
                    // limit to 3
                    const limited = next.slice(0, 3);
                    setTopThreeBySelection(limited);
                  }} />
                  <div>
                    <div className="font-medium">{t.title}</div>
                    <div className="text-xs text-slate-500">{laneMap[t.laneId]?.name}</div>
                  </div>
                </label>
              );
            })}
          </div>
          <div className="mt-4 flex justify-end">
            <button onClick={() => handleDailyPlanSave()} className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white">Save top 3</button>
          </div>
        </Modal>
      )}
    </main>
  );
}
