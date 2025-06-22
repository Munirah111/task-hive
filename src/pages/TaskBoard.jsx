import React, { useEffect, useState } from 'react';
import { db, auth } from '../firebase';
import {
  collection,
  getDocs,
  doc,
  getDoc,
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { Doughnut, Bar } from 'react-chartjs-2';
import ChartDataLabels from 'chartjs-plugin-datalabels';
import { useNavigate } from 'react-router-dom';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
} from 'chart.js';
import emailjs from '@emailjs/browser'; // Import EmailJS

// Register Chart.js components
ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  BarElement,
  ChartDataLabels,
  Title
);

const TaskBoard = () => {
  const navigate = useNavigate();
  const [projectsData, setProjectsData] = useState([]);
  const [latestActivities, setLatestActivities] = useState([]);
  const [overdueCount, setOverdueCount] = useState(0);
  const [currentUserEmail, setCurrentUserEmail] = useState('');
  const [currentUserName, setCurrentUserName] = useState('Guest');
  const [userRole, setUserRole] = useState('member'); // Initialize with a default role
  const [loading, setLoading] = useState(true); // Add loading state

  // State for email reminder modal
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [reminderMessage, setReminderMessage] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false); // New state for email sending loading

  // State for general message modal (replacing alert())
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageModalContent, setMessageModalContent] = useState({ title: '', body: '', type: '' }); // type: 'success' or 'error'


  // Initialize EmailJS (you can put this in a .env file for production)
  const EMAILJS_SERVICE_ID = 'service_8weohmp'; // Replace with your Service ID
  const EMAILJS_TEMPLATE_ID = 'template_task_action'; // Replace with your Template ID
  const EMAILJS_PUBLIC_KEY = 'dHcjgywnoFhuZjv7p'; // Replace with your Public Key (User ID)

  useEffect(() => {
    const fetchUserProjectsAndTasks = async () => {
      onAuthStateChanged(auth, async (user) => {
        if (!user) {
          navigate('/login');
          return;
        }

        setLoading(true); // Set loading to true at the start of fetch
        const userEmail = user.email;
        setCurrentUserEmail(userEmail);
        setCurrentUserName(userEmail ? userEmail.split('@')[0] : 'Guest');

        // Fetch user role
        try {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUserRole(data.role || 'member');
          }
        } catch (error) {
          console.error('Error fetching user role:', error);
          setUserRole('member'); // Default to member on error
        }

        const roomsSnapshot = await getDocs(collection(db, 'rooms'));
        const allProjects = [];
        const activities = [];
        let overdue = 0;

        for (const roomDoc of roomsSnapshot.docs) {
          const roomId = roomDoc.id;
          const roomData = roomDoc.data();
          if (!Array.isArray(roomData.members) || !roomData.members.some(m =>
            (typeof m === 'string' && m === userEmail) ||
            (typeof m === 'object' && m.email === userEmail && m.status === 'approved')
          )) continue;


          const projectsSnapshot = await getDocs(collection(db, 'rooms', roomId, 'projects'));

          for (const projectDoc of projectsSnapshot.docs) {
            const projectId = projectDoc.id;
            const projectData = projectDoc.data();
            const tasksSnapshot = await getDocs(collection(db, 'rooms', roomId, 'projects', projectId, 'tasks'));
            const tasks = tasksSnapshot.docs.map(task => ({ id: task.id, ...task.data() })) || [];

            const totalTasks = tasks.length;
            const completedTasks = tasks.filter(t => t.status === 'Completed' || t.status === 'Done').length;
            const percentComplete = totalTasks === 0 ? 0 : Math.round((completedTasks / totalTasks) * 100);

            tasks.forEach(task => {
              const due = task.dueDate ? new Date(task.dueDate) : null;
              const today = new Date();
              // Check if task is overdue only if it's not completed
              if (task.status !== 'Completed' && task.status !== 'Done' && due && due < today) {
                overdue++;
              }
              if (task.updatedAt && typeof task.updatedAt.toDate === 'function') {
                activities.push({ ...task, project: projectData.title, time: task.updatedAt.toDate() });
              }
            });

            allProjects.push({
              roomId,
              projectId,
              title: projectData.title || 'Untitled Project',
              tasks,
              percentComplete
            });
          }
        }

        setProjectsData(allProjects);
        setOverdueCount(overdue);
        setLatestActivities(activities.sort((a, b) => b.time - a.time).slice(0, 5));
        setLoading(false); // Set loading to false after all data is processed
      });
    };

    fetchUserProjectsAndTasks();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await auth.signOut();
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
      // alert('Failed to log out. Please try again.'); // Replaced with custom modal
      setMessageModalContent({ title: 'Logout Failed', body: 'Failed to log out. Please try again.', type: 'error' });
      setShowMessageModal(true);
    }
  };

  const getDoughnutChartData = (done, total) => ({
    labels: ['Completed', 'Remaining'],
    datasets: [
      {
        data: [done, total - done],
        backgroundColor: ['#6D28D9', '#E0E7FF'],
        borderColor: ['#6D28D9', '#E0E7FF'],
        borderWidth: 1,
      },
    ],
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'Not Started': return 'bg-gray-200 text-gray-800';
      case 'In Progress': return 'bg-blue-200 text-blue-800';
      case 'Pending Review': return 'bg-yellow-200 text-yellow-800';
      case 'Completed':
      case 'Done': return 'bg-green-200 text-green-800';
      case 'Needs Changes': return 'bg-red-200 text-red-800';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'Low': return 'bg-blue-100 text-blue-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'High': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const totalProjects = projectsData.length;
  const totalTasks = projectsData.reduce((sum, p) => sum + p.tasks.length, 0);
  const totalCompleted = projectsData.reduce((sum, p) => sum + p.tasks.filter(t => t.status === 'Completed' || t.status === 'Done').length, 0);

  const barChartData = {
    labels: projectsData.map(p => p.title),
    datasets: [
      {
        label: 'Not Started',
        data: projectsData.map(p => p.tasks.filter(t => t.status === 'Not Started').length),
        backgroundColor: '#A78BFA',
      },
      {
        label: 'In Progress',
        data: projectsData.map(p => p.tasks.filter(t => t.status === 'In Progress').length),
        backgroundColor: '#8B5CF6',
      },
      {
        label: 'Pending Review',
        data: projectsData.map(p => p.tasks.filter(t => t.status === 'Pending Review').length),
        backgroundColor: '#EAB308',
      },
      {
        label: 'Completed',
        data: projectsData.map(p => p.tasks.filter(t => t.status === 'Completed' || t.status === 'Done').length),
        backgroundColor: '#22C55E',
      },
      {
        label: 'Needs Changes',
        data: projectsData.map(p => p.tasks.filter(t => t.status === 'Needs Changes').length),
        backgroundColor: '#EF4444',
      }
    ]
  };

  const barChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top',
        labels: {
          font: { size: 14 }
        }
      },
      tooltip: {
        callbacks: {
          footer: (tooltipItems) => {
            const index = tooltipItems[0].dataIndex;
            const projectTasks = projectsData[index]?.tasks || [];
            const overdueProjectTasks = projectTasks.filter(t => {
              const due = t.dueDate ? new Date(t.dueDate) : null;
              return (t.status !== 'Completed' && t.status !== 'Done') && due && due < new Date();
            }).length;
            return `Overdue: ${overdueProjectTasks}`;
          }
        }
      },
      datalabels: {
        display: false,
      }
    },
    scales: {
      x: {
        stacked: true,
        grid: { display: false },
        ticks: { font: { size: 12 } }
      },
      y: {
        stacked: true,
        beginAtZero: true,
        ticks: { font: { size: 12 } },
        grid: { color: '#e2e8f0' }
      }
    },
    animation: {
      duration: 1000,
      easing: 'easeOutQuart'
    }
  };

  // Function to handle opening the reminder modal
  const handleOpenReminderModal = (task, projectTitle) => {
    if (!task.assignedTo) {
      setMessageModalContent({ title: 'Cannot Send Reminder', body: 'No assigned member found for this task.', type: 'error' });
      setShowMessageModal(true);
      return;
    }
    setSelectedTask({ ...task, projectTitle }); // Pass project title for the email
    setReminderMessage(''); // Clear previous message
    setShowReminderModal(true);
  };

  // Function to send the email
  const sendReminderEmail = async () => {
    if (!selectedTask || !selectedTask.assignedTo) {
      // This should ideally be caught by handleOpenReminderModal, but as a safeguard
      setMessageModalContent({ title: 'Error', body: 'No assigned member found for this task.', type: 'error' });
      setShowMessageModal(true);
      return;
    }

    setIsSendingEmail(true); // Set sending state to true

    const templateParams = {
      to_email: selectedTask.assignedTo,
      from_name: currentUserName,
      task_title: selectedTask.title,
      project_title: selectedTask.projectTitle,
      task_status: selectedTask.status,
      task_dueDate: selectedTask.dueDate || 'No date set',
      message: reminderMessage,
    };

    try {
      await emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, templateParams, EMAILJS_PUBLIC_KEY);
      // alert('Reminder email sent successfully!'); // Replaced with custom modal
      setMessageModalContent({ title: 'Success!', body: 'Reminder email sent successfully!', type: 'success' });
      setShowMessageModal(true);
      setShowReminderModal(false);
      setReminderMessage('');
    } catch (error) {
      console.error('Failed to send email:', error);
      // alert('Failed to send reminder email. Please try again.'); // Replaced with custom modal
      setMessageModalContent({ title: 'Email Failed', body: `Failed to send reminder email: ${error.message || 'Unknown error'}. Please try again.`, type: 'error' });
      setShowMessageModal(true);
    } finally {
      setIsSendingEmail(false); // Reset sending state
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-20 w-20 border-t-2 border-b-2 border-purple-500 mx-auto"></div>
          <p className="text-gray-700 text-xl mt-4">Loading TaskBoard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans">
      {/* Top Navbar - Matches Dashboard.jsx Header */}
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
            className="text-lg font-medium relative group px-2 py-1"
          >
            My Tasks
            <span className="absolute bottom-0 left-1/2 w-0 h-0.5 bg-white group-hover:w-full group-hover:left-0 transition-all duration-300"></span>
          </button>
          <button
            onClick={handleLogout} // Use handleLogout function
            className="text-lg font-medium relative group px-2 py-1 text-white hover:text-gray-200 transition duration-300 ease-in-out"
          >
            Logout
            <span className="absolute bottom-0 left-1/2 w-0 h-0.5 bg-white group-hover:w-full group-hover:left-0 transition-all duration-300"></span>
          </button>
        </nav>
      </header>

      <div className="flex flex-col lg:flex-row">
        {/* Main Content Area */}
        <main className="flex-1 p-6 sm:p-10 lg:w-2/3">
          <h2 className="text-3xl font-bold text-gray-900 mb-8">Dashboard Overview</h2>

          {/* Project Progress Overview (Key Metrics) */}
          <section className="bg-gradient-to-br from-purple-50 to-indigo-50 p-8 rounded-2xl shadow-xl border border-purple-200 mb-12">
            <h3 className="font-bold mb-6 text-2xl text-purple-800">Key Metrics</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Card 1: Total Projects */}
              <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100 text-center">
                <h4 className="font-semibold text-lg text-gray-700 mb-2">Total Projects</h4>
                <p className="text-5xl font-extrabold text-purple-700">{totalProjects}</p>
              </div>
              {/* Card 2: Total Tasks */}
              <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100 text-center">
                <h4 className="font-semibold text-lg text-gray-700 mb-2">Total Tasks</h4>
                <p className="text-5xl font-extrabold text-blue-600">{totalTasks}</p>
              </div>
              {/* Card 3: Overdue Tasks */}
              <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100 text-center">
                <h4 className="font-semibold text-lg text-gray-700 mb-2">Overdue Tasks</h4>
                <p className="text-5xl font-extrabold text-red-600">{overdueCount}</p>
              </div>
            </div>
          </section>

          {/* Charts Section */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
            {/* Overall Task Distribution Chart (Doughnut) */}
            <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
              <h4 className="font-semibold text-xl text-gray-900 mb-4">Overall Task Completion</h4>
              <div className="relative h-72 flex items-center justify-center">
                <Doughnut data={getDoughnutChartData(totalCompleted, totalTasks)} options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom', labels: { font: { size: 14 } } },
                        tooltip: { mode: 'index', intersect: false },
                        datalabels: {
                            color: '#fff',
                            textAlign: 'center',
                            font: {
                                weight: 'bold',
                                size: 16
                            },
                            formatter: (value, context) => {
                                if (context.dataIndex === 0) {
                                    return `${(value / totalTasks * 100).toFixed(1)}%`;
                                }
                                return '';
                            }
                        }
                    },
                    cutout: '70%',
                    animation: {
                        duration: 1000,
                        easing: 'easeOutQuart'
                    }
                }} />
                <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
                    <p className="text-4xl font-extrabold text-purple-700">{totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0}%</p>
                    <p className="text-sm text-gray-500">Total Done</p>
                </div>
              </div>
            </div>

            {/* Tasks Per Project Bar Chart */}
            <div className="bg-white rounded-2xl shadow-xl p-6 border border-gray-100">
              <h4 className="font-semibold text-xl text-gray-900 mb-4">Tasks Breakdown by Project</h4>
              <div className="h-72">
                <Bar data={barChartData} options={barChartOptions} />
              </div>
            </div>
          </section>

          {/* Detailed Project List */}
          <section className="space-y-8">
            <h3 className="text-3xl font-bold text-gray-900 mb-6">Your Projects & Tasks Details</h3>
            {projectsData.length === 0 ? (
              <p className="text-gray-500 text-lg text-center py-12 bg-gray-100 rounded-xl shadow-inner border border-gray-200">No projects or tasks found for you.</p>
            ) : (
              projectsData.map((project) => (
                <div key={project.projectId} className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200 transition-shadow hover:shadow-xl">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h4 className="text-2xl font-bold text-purple-800 mb-1"> {project.title}</h4>
                      <p className="text-sm text-gray-500">Project ID: {project.projectId}</p>
                      <p className="text-green-600 font-semibold">{project.percentComplete}% Completed</p>
                    </div>
                  </div>

                  <ul className="mt-4 space-y-4">
                    {project.tasks.length === 0 ? (
                      <li className="text-gray-500 text-center py-4 bg-gray-50 rounded-lg border border-gray-100">No tasks in this project.</li>
                    ) : (
                      project.tasks.map(task => (
                        <li key={task.id} className="p-4 border rounded-xl bg-gray-50 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center">
                          <div className="flex-1 min-w-0 pr-4 mb-2 md:mb-0">
                            <p className="font-medium text-lg text-gray-900 truncate">{task.title}</p>
                            <p className="text-sm text-gray-600 truncate">{task.description}</p>
                            <p className="text-xs mt-1 text-gray-500">Assigned to: {task.assignedTo || 'Unassigned'}</p>
                            <p className="text-xs text-gray-500">Due: {task.dueDate || 'No date set'}</p>
                          </div>
                          <div className="flex items-center space-x-2 flex-wrap">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(task.status)}`}>
                              {task.status}
                            </span>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getPriorityColor(task.priority)}`}>
                              {task.priority || 'Low'}
                            </span>
                            {/* Conditional rendering for the reminder button */}
                            {task.assignedTo && (
                                <button
                                    onClick={() => handleOpenReminderModal(task, project.title)}
                                    className="ml-2 px-3 py-1 bg-blue-500 text-white rounded-md text-xs font-semibold hover:bg-blue-600 transition-colors duration-200"
                                >
                                    Send Reminder
                                </button>
                            )}
                          </div>
                        </li>
                      ))
                    )}
                  </ul>
                </div>
              ))
            )}
          </section>
        </main>



        {/* Right Sidebar */}
        <aside className="w-full lg:w-80 bg-white p-8 border-l border-gray-100 shadow-lg z-30 flex-shrink-0">
          <div className="text-center mb-8">
            <h4 className="text-2xl font-bold text-gray-900 mb-1">{currentUserName}</h4>
           <p className="text-sm text-gray-500">{currentUserEmail}</p>
          </div>

          {/* Overall Efficiency Card - NEW ADDITION */}
          <div className="bg-purple-50 rounded-2xl p-6 shadow-md border border-purple-200 mb-8">
            <h5 className="font-bold text-xl text-purple-800 mb-4">Overall Efficiency</h5>
            <div className="space-y-3">
              <div className="flex justify-between items-center text-lg">
                <span className="text-gray-700">Total Tasks:</span>
                <span className="font-bold text-purple-700">{totalTasks}</span>
              </div>
              <div className="flex justify-between items-center text-lg">
                <span className="text-gray-700">Completed Tasks:</span>
                <span className="font-bold text-green-600">{totalCompleted}</span>
              </div>
              <div className="flex justify-between items-center text-lg">
                <span className="text-gray-700">Overdue Tasks:</span>
                <span className="font-bold text-red-600">{overdueCount}</span>
              </div>
            </div>
          </div>

          {/* Latest Activity */}
          <div className="mb-8 p-4 bg-gray-50 rounded-xl border border-gray-100">
            <h5 className="font-bold text-lg text-gray-700 mb-3">Latest Activity</h5>
            <ul className="space-y-3">
              {latestActivities.length === 0 ? (
                  <li className="text-gray-500 text-sm italic">No recent activity.</li>
              ) : (
                latestActivities.map((a, i) => (
                  <li key={i} className="text-sm border-b pb-2 last:border-b-0 last:pb-0">
                    <p className="font-semibold text-gray-800">{a.title}</p>
                    <p className="text-xs text-gray-600">in <i>{a.project}</i> - {a.status}</p>
                    <p className="text-xs text-gray-400">{a.time.toLocaleString('en-MY', { dateStyle: 'short', timeStyle: 'short' })}</p>
                  </li>
                ))
              )}
            </ul>
          </div>

          {/* Completed Task Bar Chart (Placeholder for efficiency breakdown) */}
          <div className="p-4 bg-white rounded-xl shadow-md border border-gray-100">
            <h5 className="font-bold text-lg text-gray-700 mb-3">Completed Tasks Trend (Sample)</h5>
            <Bar
                data={{
                    labels: projectsData.slice(0, Math.min(projectsData.length, 5)).map(p => p.title),
                    datasets: [{
                        label: 'Completed Tasks',
                        data: projectsData.slice(0, Math.min(projectsData.length, 5)).map(p => p.tasks.filter(t => t.status === 'Completed' || t.status === 'Done').length),
                        backgroundColor: '#6D28D9',
                    }]
                }}
                options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: { mode: 'index', intersect: false },
                        datalabels: { display: false }
                    },
                    scales: {
                        x: { grid: { display: false } },
                        y: { beginAtZero: true, grid: { color: '#e2e8f0' } }
                    }
                }}
            />
          </div>
        </aside>
      </div>

      {/* Reminder Modal */}
      {showReminderModal && selectedTask && (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 shadow-xl max-w-md w-full m-4">
            <h3 className="text-2xl font-bold mb-4 text-gray-900">Send Reminder for "{selectedTask.title}"</h3>
            <p className="text-gray-700 mb-2">
              **To:** <span className="font-semibold">{selectedTask.assignedTo}</span>
            </p>
            <p className="text-gray-600 text-sm mb-4">
              **Project:** <span className="font-semibold">{selectedTask.projectTitle}</span> | **Due:** {selectedTask.dueDate || 'N/A'}
            </p>

            <label htmlFor="reminderMessage" className="block text-gray-700 text-sm font-bold mb-2">
              Your Message:
            </label>
            <textarea
              id="reminderMessage"
              className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline mb-4 h-32 resize-none"
              placeholder="Type your reminder message here..."
              value={reminderMessage}
              onChange={(e) => setReminderMessage(e.target.value)}
            ></textarea>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowReminderModal(false)}
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition-colors duration-200"
                disabled={isSendingEmail}
              >
                Cancel
              </button>
              <button
                onClick={sendReminderEmail}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition-colors duration-200 disabled:opacity-50"
                disabled={isSendingEmail}
              >
                {isSendingEmail ? 'Sending...' : 'Send Email'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Message Modal (Success/Error) */}
      {showMessageModal && (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50">
          <div className={`bg-white rounded-lg p-8 shadow-xl max-w-sm w-full m-4 text-center border-t-4
            ${messageModalContent.type === 'success' ? 'border-green-500' : 'border-red-500'}
          `}>
            <h3 className={`text-2xl font-bold mb-4
              ${messageModalContent.type === 'success' ? 'text-green-700' : 'text-red-700'}
            `}>
              {messageModalContent.title}
            </h3>
            <p className="text-gray-700 mb-6">{messageModalContent.body}</p>
            <button
              onClick={() => setShowMessageModal(false)}
              className={`py-2 px-6 rounded-md font-semibold transition-colors duration-200
                ${messageModalContent.type === 'success' ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-red-500 hover:bg-red-600 text-white'}
              `}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskBoard;