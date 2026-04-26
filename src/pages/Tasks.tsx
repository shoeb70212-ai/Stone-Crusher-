import React, { useState } from "react";
import { useErp } from "../context/ErpContext";
import { Plus, Check, Trash2, Clock, CheckCircle2, Circle } from "lucide-react";
import { format, parseISO } from "date-fns";

export function Tasks() {
  const { tasks, addTask, toggleTask, deleteTask } = useErp();
  const [newTaskTitle, setNewTaskTitle] = useState("");

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    
    addTask({
      id: Math.random().toString(36).substr(2, 9),
      title: newTaskTitle.trim(),
      completed: false,
      createdAt: new Date().toISOString()
    });
    setNewTaskTitle("");
  };

  const pendingTasks = tasks.filter(t => !t.completed).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const completedTasks = tasks.filter(t => t.completed).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h2 className="text-2xl font-bold text-zinc-900 dark:text-white font-display tracking-tight">Tasks</h2>
          <p className="text-zinc-500 dark:text-zinc-400 mt-1">Manage daily operational to-dos.</p>
        </div>
      </div>

      <div className="bg-white dark:bg-zinc-800 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-700 p-4 mb-6">
        <form onSubmit={handleAddTask} className="flex gap-3">
          <input
            type="text"
            placeholder="What needs to be done today?"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            className="flex-1 px-4 py-3 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none text-zinc-900 dark:text-zinc-100"
          />
          <button
            type="submit"
            disabled={!newTaskTitle.trim()}
            className="bg-primary-600 hover:bg-primary-700 disabled:bg-primary-300 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-medium flex items-center transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add Task
          </button>
        </form>
      </div>

      <div className="flex-1 overflow-y-auto space-y-6">
        {pendingTasks.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-3 px-1">To Do ({pendingTasks.length})</h3>
            <div className="space-y-2">
              {pendingTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between p-4 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-sm hover:border-zinc-300 dark:hover:border-zinc-600 transition-colors group">
                  <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={() => toggleTask(task.id)}>
                    <button className="text-zinc-400 hover:text-primary-500 transition-colors">
                      <Circle className="w-6 h-6" />
                    </button>
                    <div>
                      <p className="text-zinc-900 dark:text-white font-medium">{task.title}</p>
                      <p className="text-xs text-zinc-400 flex items-center mt-1">
                        <Clock className="w-3 h-3 mr-1" />
                        Added {format(parseISO(task.createdAt), "MMM d, h:mm a")}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => deleteTask(task.id)} className="text-zinc-400 hover:text-rose-500 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {completedTasks.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-3 px-1">Completed ({completedTasks.length})</h3>
            <div className="space-y-2">
              {completedTasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-100 dark:border-zinc-700/50 rounded-xl">
                  <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={() => toggleTask(task.id)}>
                    <button className="text-emerald-500 hover:text-emerald-600 transition-colors">
                      <CheckCircle2 className="w-6 h-6" />
                    </button>
                    <div>
                      <p className="text-zinc-500 dark:text-zinc-400 font-medium line-through">{task.title}</p>
                      <p className="text-xs text-zinc-400 flex items-center mt-1">
                        <Check className="w-3 h-3 mr-1" />
                        Completed
                      </p>
                    </div>
                  </div>
                  <button onClick={() => deleteTask(task.id)} className="text-zinc-400 hover:text-rose-500 p-2 transition-colors">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tasks.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 text-zinc-400">
            <CheckCircle2 className="w-12 h-12 mb-3 text-zinc-300 dark:text-zinc-600" />
            <p>You're all caught up! No tasks yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
