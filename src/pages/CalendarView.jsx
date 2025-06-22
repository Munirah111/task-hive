import React, { useEffect, useState } from 'react';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css'; // Default react-calendar styles
import './calendar-styles.css'; // Import custom calendar styles for overriding defaults

import { db, auth } from '../firebase';
import {
  collectionGroup,
  onSnapshot
} from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';

// Helper functions for styling (can be centralized in a utilities file)
const getPriorityColorBadge = (priority) => {
  switch (priority) {
    case 'High': return 'bg-red-100 text-red-700';
    case 'Medium': return 'bg-yellow-100 text-yellow-800';
    case 'Low': return 'bg-blue-100 text-blue-700';
    default: return 'bg-gray-100 text-gray-600';
  }
};

const CalendarView = () => {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [tasks, setTasks] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribeAuth = auth.onAuthStateChanged((user) => {
      if (!user) {
        setTasks([]);
        setLoading(false);
        navigate('/login');
        return;
      }

      const unsub = onSnapshot(collectionGroup(db, 'tasks'), (snapshot) => {
        const allTasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setTasks(allTasks);
        setLoading(false);
      }, (error) => {
        console.error("Firestore error fetching tasks:", error.message);
        setLoading(false);
      });

      return () => unsub();
    });

    return () => unsubscribeAuth();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  const formatDateForComparison = (date) => {
    return date.toISOString().split('T')[0];
  };

  const getTasksForDate = (date) => {
    const targetDate = formatDateForComparison(date);
    return tasks.filter(t => t.dueDate === targetDate);
  };

  const tileContent = ({ date, view }) => {
    if (view === 'month') {
      const taskList = getTasksForDate(date);
      if (taskList.length === 0) return null;

      // Determine highest priority for the dot color
      const priorities = taskList.map(t => t.priority);
      const hasHigh = priorities.includes('High');
      const hasMedium = priorities.includes('Medium');

      return (
        <div className="flex justify-center mt-1">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              hasHigh ? 'bg-red-500' : hasMedium ? 'bg-yellow-400' : 'bg-green-500'
            }`}
          ></span>
        </div>
      );
    }
    return null;
  };

  const tileClassName = ({ date, view }) => {
    const classes = [];

    if (view === 'month') {
      const today = new Date();
      if (date.toDateString() === today.toDateString()) {
        classes.push('react-calendar__tile--today-fancy'); // Custom class for today
      }

      // Add class for weekends
      if (date.getDay() === 0 || date.getDay() === 6) { // Sunday (0) or Saturday (6)
        classes.push('react-calendar__tile--weekend-fancy');
      }

      // Add class for days with tasks
      const hasTasks = getTasksForDate(date).length > 0;
      if (hasTasks) {
        classes.push('react-calendar__tile--has-tasks-fancy');
      }
    }

    return classes.join(' ');
  };

  const tasksForSelected = getTasksForDate(selectedDate);
  const filteredTasksForSelected = tasksForSelected.filter(task =>
    task.title?.toLowerCase().includes(search.toLowerCase()) ||
    task.description?.toLowerCase().includes(search.toLowerCase()) ||
    task.project?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-20 w-20 border-t-2 border-b-2 border-purple-500 mx-auto"></div>
          <p className="text-gray-700 text-xl mt-4">Loading calendar data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 font-sans flex flex-col">
      {/* Header - Consistent with Dashboard and TaskBoard */}
      <header className="bg-purple-800 text-white shadow-lg p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-center sticky top-0 z-40">
        <div className="mb-4 sm:mb-0 text-center sm:text-left">
          <h1 className="text-4xl font-extrabold tracking-tight">TaskHive</h1>
          <p className="text-sm text-purple-200 mt-1">Your collaborative workspace</p>
        </div>
        <nav className="flex flex-wrap justify-center sm:justify-end gap-6 sm:gap-10">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-lg font-medium relative group px-2 py-1"
          >
            Dashboard
            <span className="absolute bottom-0 left-1/2 w-0 h-0.5 bg-white group-hover:w-full group-hover:left-0 transition-all duration-300"></span>
          </button>
          <button
            onClick={() => navigate('/calendar')}
            className="text-lg font-medium relative group px-2 py-1 border-b-2 border-white" // Highlight Calendar
          >
            Calendar
            <span className="absolute bottom-0 left-1/2 w-0 h-0.5 bg-white group-hover:w-full group-hover:left-0 transition-all duration-300"></span>
          </button>
          <button
            onClick={() => navigate('/taskboard')}
            className="text-lg font-medium relative group px-2 py-1"
          >
            TaskBoard
            <span className="absolute bottom-0 left-1/2 w-0 h-0.5 bg-white group-hover:w-full group-hover:left-0 transition-all duration-300"></span>
          </button>
          <button
            onClick={() => navigate('/mytasks')}
            className="text-lg font-medium relative group px-2 py-1"
          >
            My Tasks
            <span className="absolute bottom-0 left-1/2 w-0 h-0.5 bg-white group-hover:w-full group-hover:left-0 transition-all duration-300"></span>
          </button>
          <button
            onClick={() => navigate('/login')}
            className="text-lg font-medium relative group px-2 py-1 text-white hover:text-gray-200 transition duration-300 ease-in-out"
          >
            Logout
            <span className="absolute bottom-0 left-1/2 w-0 h-0.5 bg-white group-hover:w-full group-hover:left-0 transition-all duration-300"></span>
          </button>
        </nav>
      </header>

      <main className="flex-1 p-6 sm:p-10 w-full max-w-7xl mx-auto flex flex-col lg:flex-row gap-8">
        {/* Left Section: Calendar and Legend */}
        <div className="lg:w-2/3 xl:w-3/5 flex flex-col items-center">
          <h2 className="text-4xl font-extrabold text-gray-900 mb-6 w-full text-center lg:text-left">📅 Task Calendar</h2>

          {/* Priority Legend */}
          <div className="flex flex-wrap justify-center sm:justify-start gap-x-6 gap-y-2 text-md mb-6 p-4 bg-white rounded-xl shadow-md border border-gray-200 w-full">
            <span className="font-semibold text-gray-700">Priority Legend:</span>
            <div className="flex items-center gap-1">
              <span className="w-3.5 h-3.5 rounded-full bg-red-500 inline-block shadow-sm"></span> High Priority
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3.5 h-3.5 rounded-full bg-yellow-400 inline-block shadow-sm"></span> Medium Priority
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3.5 h-3.5 rounded-full bg-green-500 inline-block shadow-sm"></span> Low Priority
            </div>
          </div>

          <div className="w-full react-calendar-wrapper">
            <Calendar
              onChange={setSelectedDate}
              value={selectedDate}
              tileContent={tileContent}
              tileClassName={tileClassName} /* Apply dynamic classes here */
              className="w-full"
            />
          </div>
        </div>

        {/* Right Section: Tasks for Selected Date */}
        <div className="lg:w-1/3 xl:w-2/5 flex flex-col bg-white p-6 rounded-2xl shadow-xl border border-gray-200">
          <h3 className="text-2xl font-bold text-gray-900 mb-4 border-b pb-3 border-purple-200">
            Tasks on {selectedDate.toLocaleDateString('en-MY', { year: 'numeric', month: 'long', day: 'numeric' })}:
          </h3>

          {/* Task count summary */}
          <div className="text-md text-gray-700 mb-4 flex items-center gap-2">
            <span className="text-purple-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
            </span>
            <span className="font-semibold">{tasksForSelected.length}</span> task{tasksForSelected.length !== 1 ? 's' : ''} scheduled for this day.
          </div>

          {/* Search bar for tasks on selected date */}
          <div className="mb-6 relative shadow-sm rounded-lg">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="🔍 Search tasks..."
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-300 focus:border-purple-400 outline-none transition duration-200 text-base placeholder-gray-500"
            />
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>

          <ul className="space-y-4 flex-grow overflow-y-auto pb-2">
            {filteredTasksForSelected.length === 0 ? (
              <li className="text-gray-500 text-center italic py-6 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                No tasks found for this date.
              </li>
            ) : (
              filteredTasksForSelected.map((task) => {
                const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'Completed' && task.status !== 'Done';
                return (
                  <li
                    key={task.id}
                    className="p-4 border border-gray-200 rounded-xl bg-white shadow-sm transition-all duration-200 hover:shadow-md hover:border-purple-300 cursor-pointer"
                    onClick={() => console.log('Task clicked:', task.id)}
                  >
                    <h4 className="font-bold text-lg text-gray-900 mb-1">{task.title}</h4>
                    <p className="text-sm text-gray-700 mb-2 line-clamp-2">{task.description || 'No description provided.'}</p>
                    <p className="text-xs text-gray-500 mb-2">
                      <span className="font-semibold">Project:</span> {task.project || 'N/A'}
                    </p>
                    <div className="flex items-center text-sm text-gray-600 mb-3">
                      <span className="font-semibold">Due:</span>{' '}
                      {task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-MY', { year: 'numeric', month: 'short', day: 'numeric' }) : 'No Date'}
                      {isOverdue && (
                        <span className="ml-2 px-2 py-0.5 rounded-full bg-red-600 text-white text-xs font-bold shadow-sm">
                          OVERDUE
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getPriorityColorBadge(task.priority)}`}>
                        Priority: {task.priority || 'Low'}
                      </span>
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-700">
                        Assigned to: {task.assignedTo?.split('@')[0] || 'N/A'}
                      </span>
                    </div>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      </main>
    </div>
  );
};

export default CalendarView;