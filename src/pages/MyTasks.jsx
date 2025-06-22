import React, { useEffect, useState } from 'react';
import { db, auth } from '../firebase';
import { collectionGroup, query, where, onSnapshot } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
 

// Helper functions for styling (can be centralized if used across multiple components)
const getStatusColor = (status) => {
  switch (status) {
    case 'Not Started': return 'bg-gray-200 text-gray-800';
    case 'In Progress': return 'bg-blue-200 text-blue-800';
    case 'Pending Review': return 'bg-yellow-200 text-yellow-800';
    case 'Completed':
    case 'Done': return 'bg-green-200 text-green-800'; // Both Completed and Done
    case 'Needs Changes': return 'bg-red-200 text-red-800';
    default: return 'bg-gray-100 text-gray-600';
  }
};

const getPriorityColor = (priority) => {
  switch (priority) {
    case 'High': return 'bg-red-100 text-red-700';
    case 'Medium': return 'bg-yellow-100 text-yellow-800';
    case 'Low': return 'bg-blue-100 text-blue-700';
    default: return 'bg-gray-100 text-gray-600';
  }
};

const MyTasks = () => {
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

      const q = query(
        collectionGroup(db, 'tasks'),
        where("assignedTo", "==", user.email)
      );

      const unsubTasks = onSnapshot(q, (snapshot) => {
        const taskList = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        // Sort tasks by due date, pushing tasks without due dates to the end
        taskList.sort((a, b) => {
          const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
          const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
          return dateA - dateB;
        });
        setTasks(taskList);
        setLoading(false);
      }, (error) => {
        console.error("Firestore error fetching tasks:", error.message);
        setLoading(false);
        // Implement a user-facing notification here if needed
      });

      return () => unsubTasks();
    });

    return () => unsubscribeAuth();
  }, [navigate]);


  // Loading spinner and message
  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-20 w-20 border-t-2 border-b-2 border-purple-500 mx-auto"></div>
          <p className="text-gray-700 text-xl mt-4">Loading your tasks...</p>
        </div>
      </div>
    );
  }

  const filteredTasks = tasks.filter((task) =>
    task.title?.toLowerCase().includes(search.toLowerCase()) ||
    task.description?.toLowerCase().includes(search.toLowerCase()) ||
    task.project?.toLowerCase().includes(search.toLowerCase()) // Assuming task might have a project field
  );

  // Group tasks by status for columnar display
  const grouped = filteredTasks.reduce((acc, task) => {
    const status = task.status || 'Not Started';
    acc[status] = acc[status] || [];
    acc[status].push(task);
    return acc;
  }, {});

  // Define the desired order of status columns
  const statusOrder = [
    'Not Started',
    'In Progress',
    'Pending Review',
    'Needs Changes',
    'Completed',
    'Done'
  ];

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
            className="text-lg font-medium relative group px-2 py-1"
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
            className="text-lg font-medium relative group px-2 py-1 border-b-2 border-white" // Highlight My Tasks
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

      <main className="flex-1 p-6 sm:p-10 w-full max-w-7xl mx-auto">
        <h2 className="text-4xl font-extrabold text-gray-900 mb-8">Your Assigned Tasks</h2>

        {/* Search Input */}
        <div className="mb-10 relative shadow-lg rounded-xl">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Search tasks by title, description, or project..."
            className="w-full pl-14 pr-6 py-4 bg-white border border-gray-200 rounded-xl focus:ring-4 focus:ring-purple-300 focus:border-purple-500 outline-none transition duration-300 text-lg placeholder-gray-500"
          />
          <div className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {/* Task Columns / Kanban Board */}
        {filteredTasks.length === 0 && !loading ? (
          <div className="bg-white rounded-2xl p-16 text-center shadow-xl border border-gray-200 flex flex-col items-center justify-center min-h-[400px]">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-32 w-32 text-purple-400 mb-8 animate-bounce-slow" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            <p className="text-2xl text-gray-700 font-semibold mb-4">No tasks match your criteria.</p>
            <p className="text-lg text-gray-500">Try adjusting your search or check back later!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 overflow-x-auto pb-4">
            {statusOrder.map((status) => {
              const taskGroup = grouped[status] || [];
              return (
                <div key={status} className="flex flex-col bg-white rounded-2xl shadow-xl border border-gray-200 min-w-[280px] max-w-[350px]">
                  <div className="bg-gradient-to-r from-purple-700 to-indigo-700 text-white p-5 rounded-t-2xl shadow-md flex justify-between items-center">
                    <h3 className="text-xl font-bold">{status}</h3>
                    <span className="bg-purple-500 text-sm font-semibold px-4 py-1 rounded-full">{taskGroup.length}</span>
                  </div>
                  <ul className="p-4 space-y-4 flex-grow overflow-y-auto custom-scrollbar" style={{ maxHeight: 'calc(100vh - 350px)' }}> {/* Custom scrollbar class */}
                    {taskGroup.length === 0 ? (
                      <li className="text-gray-500 text-center italic py-6">No tasks in this status.</li>
                    ) : (
                      taskGroup.map((task) => {
                        const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'Completed' && task.status !== 'Done';
                        return (
                          <li
                            key={task.id}
                            className="bg-white p-5 rounded-xl shadow-md border border-gray-100 cursor-pointer transition-all duration-300 hover:shadow-xl hover:border-purple-400 transform hover:-translate-y-1"
                            onClick={() => console.log('Task clicked:', task.id)} // Placeholder for task detail view
                          >
                            <h4 className="text-lg font-bold text-gray-900 mb-2 leading-tight">{task.title}</h4>
                            <p className="text-sm text-gray-700 mb-3 line-clamp-3">{task.description || 'No description provided.'}</p>
                            <div className="flex justify-between items-center text-xs text-gray-500 mb-3">
                                <span>
                                    <span className="font-semibold">Project:</span> {task.project || 'N/A'}
                                </span>
                            </div>
                            <p className="text-sm text-gray-600 mb-3 flex items-center"> {/* Added flex and items-center */}
                              <span className="font-semibold">Due:</span>{' '}
                              {task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-MY', { year: 'numeric', month: 'short', day: 'numeric' }) : 'No Date'}
                              {isOverdue && (
                                <span className="ml-2 px-2.5 py-1 rounded-full bg-red-600 text-white text-xs font-bold shadow-md inline-flex items-center"> {/* Inline flex for alignment */}
                                  OVERDUE
                                </span>
                              )}
                            </p>
                            <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                              <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${getStatusColor(task.status)}`}>
                                {task.status || 'Not Started'}
                              </span>
                              <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${getPriorityColor(task.priority)}`}>
                                Priority: {task.priority || 'Low'}
                              </span>
                            </div>
                          </li>
                        );
                      })
                    )}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default MyTasks;