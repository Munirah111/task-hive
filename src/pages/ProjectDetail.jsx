// src/pages/ProjectDetail.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase';
import {
  doc,
  getDoc,
  collection,
  getDocs,
  addDoc,
  Timestamp,
  updateDoc,
  arrayUnion,
  arrayRemove,
  deleteDoc // Import deleteDoc
} from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

// --- Reusable Notification Component ---
const Notification = ({ message, type, onClose }) => {
  if (!message) return null;
  const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500';
  return (
    <div
      className={`fixed top-24 right-5 z-50 p-4 rounded-lg shadow-xl flex items-center justify-between transition-all duration-300 transform ${bgColor} text-white`}
      style={{ minWidth: '250px' }}
    >
      <span className="font-semibold">{message}</span>
      <button onClick={onClose} className="ml-4 text-white font-bold text-lg leading-none">&times;</button>
    </div>
  );
};

// --- Reusable Header Component ---
const ProjectHeader = ({ roomTitle, onBack }) => {
  return (
    <header className="bg-purple-800 text-white shadow-lg p-6 flex justify-between items-center sticky top-0 z-40">
      <h1 className="text-3xl font-extrabold tracking-tight">{roomTitle || 'Project Details'}</h1>
      <button
        onClick={onBack}
        className="bg-purple-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition duration-300 shadow-md transform hover:scale-105"
      >
        &larr; Back to Room
      </button>
    </header>
  );
};

const ProjectDetail = () => {
  const navigate = useNavigate();
  const { roomId, projectId } = useParams();
  const [setUserRole] = useState(''); // This is the user's *global* role from /users collection

  const [hasAccess, setHasAccess] = useState(false);
  const [accessChecked, setAccessChecked] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // New loading state

  const [project, setProject] = useState(null); // This will contain project-specific data including 'role' and 'creatorEmail'
  const [tasks, setTasks] = useState([]);
  const [approvedProjectMembersForDropdown, setApprovedProjectMembersForDropdown] = useState([]); // For assignment dropdown
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    dueDate: '',
    priority: 'Medium',
    assignedTo: '',
  });
  const [comments, setComments] = useState({});
  const [currentUser, setCurrentUser] = useState(null); // The current authenticated user's email
  const [setRoomCreator] = useState(''); // This might still be useful for other room-level logic
  const [notification, setNotification] = useState({ message: '', type: '' });
  const [displayedAssignedTo, setDisplayedAssignedTo] = useState({});
  const [displayedStatus, setDisplayedStatus] = useState({});

  // New states for member management
  const [addMemberEmail, setAddMemberEmail] = useState('');
  const [addMemberModalOpen, setAddMemberModalOpen] = useState(false);
  // This state will now directly store the project's members including their status
  const [projectMembersList, setProjectMembersList] = useState([]);

  // New states for delete task confirmation
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState(null);

  useEffect(() => {
    if (notification.message) {
      const timer = setTimeout(() => setNotification({ message: '', type: '' }), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  const fetchProjectAndRoomData = async () => {
    try {
      const projectRef = doc(db, 'rooms', roomId, 'projects', projectId);
      const roomRef = doc(db, 'rooms', roomId); // Still fetch room data to get room creator if needed
      const taskRef = collection(db, 'rooms', roomId, 'projects', projectId, 'tasks');

      const [projectSnap, roomSnap, taskSnap] = await Promise.all([
        getDoc(projectRef),
        getDoc(roomRef),
        getDocs(taskRef)
      ]);

      if (projectSnap.exists()) {
        const projectData = projectSnap.data();
        setProject({ id: projectSnap.id, ...projectData });

        // Normalize project members for consistent display and logic
        const rawProjectMembers = Array.isArray(projectData.members) ? projectData.members : [];
        const normalizedProjectMembers = rawProjectMembers.map(member => {
            if (typeof member === 'string') {
                return { email: member, status: 'approved' }; // Assume old string members are approved
            }
            return member;
        });

        // Ensure the creator is always in the approved list, even if not explicitly in `members` array (for older projects)
        const projectCreatorEmail = projectData.creatorEmail;
        if (projectCreatorEmail && !normalizedProjectMembers.some(m => m.email === projectCreatorEmail)) {
            normalizedProjectMembers.push({ email: projectCreatorEmail, status: 'approved', isProjectLeader: true });
        } else if (projectCreatorEmail) { // If creator exists, make sure their 'isProjectLeader' is true if their role is leader
            const creatorEntry = normalizedProjectMembers.find(m => m.email === projectCreatorEmail);
            if (creatorEntry && projectData.role === 'leader') {
                creatorEntry.isProjectLeader = true;
            }
        }

        setProjectMembersList(normalizedProjectMembers);

        const currentApprovedMembers = normalizedProjectMembers
            .filter(member => member.status === 'approved')
            .map(member => member.email);
        setApprovedProjectMembersForDropdown(currentApprovedMembers);

        // Access check logic, now based on project members
        const isApprovedForProject = normalizedProjectMembers.some(
            (m) => m.email === currentUser && m.status === 'approved'
        );
        const isProjectCreator = projectData.creatorEmail === currentUser;

        setHasAccess(isApprovedForProject || isProjectCreator);
        setAccessChecked(true);

      } else {
        setNotification({ message: 'Project not found.', type: 'error' });
        navigate(`/room/${roomId}`);
        return;
      }

      if (roomSnap.exists()) {
        const roomData = roomSnap.data();
        setRoomCreator(roomData.createdBy || '');
      } else {
        // Room not found is a serious error here, as project is a subcollection of room
        console.error('Parent room not found for project:', roomId);
        setNotification({ message: 'Parent room not found.', type: 'error' });
        navigate('/'); // Redirect to dashboard or home
        return;
      }

      
      const taskList = [];
      const initialAssignedToMap = {};
      const initialStatusMap = {};

      for (const docSnap of taskSnap.docs) {
        const task = { id: docSnap.id, ...docSnap.data() };
       
        // Removed email sending logic for due reminders
        
        taskList.push(task);
        if (task.assignedTo) {
          initialAssignedToMap[task.id] = task.assignedTo;
        }
        initialStatusMap[task.id] = task.status;
      }
      setTasks(taskList.sort((a, b) => a.createdAt?.toDate() - b.createdAt?.toDate()));
      setDisplayedAssignedTo(initialAssignedToMap);
      setDisplayedStatus(initialStatusMap);
    } catch (error) {
      console.error("Error fetching data:", error);
      setNotification({ message: 'Failed to load project data.', type: 'error' });
    } finally {
      setIsLoading(false); // Set loading to false after fetch attempt
    }
  };

  useEffect(() => {
    const authUnsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user.email);
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists()) {
          setUserRole(userDoc.data().role || 'member');
        }
        fetchProjectAndRoomData(); // Call fetch only after currentUser is set
      } else {
        navigate('/login');
        setIsLoading(false); // If not logged in, stop loading and redirect
      }
    });

    return () => authUnsubscribe();
  }, [roomId, projectId, navigate, currentUser]); // Re-run if these change


  const refreshTaskList = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'rooms', roomId, 'projects', projectId, 'tasks'));
      const taskList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setTasks(taskList.sort((a, b) => a.createdAt?.toDate() - b.createdAt?.toDate()));

      const updatedAssignedToMap = {};
      const updatedStatusMap = {};
      taskList.forEach(task => {
        if (task.assignedTo) {
          updatedAssignedToMap[task.id] = task.assignedTo;
        }
        updatedStatusMap[task.id] = task.status;
      });
      setDisplayedAssignedTo(updatedAssignedToMap);
      setDisplayedStatus(updatedStatusMap);

    } catch (error) {
      console.error("Error refreshing tasks:", error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewTask(prev => ({ ...prev, [name]: value }));
  };

  const handleCommentChange = (taskId, value) => {
    setComments(prev => ({ ...prev, [taskId]: value }));
  };

  // Determine if the current user is the leader for THIS specific project
  // This uses the 'role' field and 'creatorEmail' from the project document.
  const isCurrentUserProjectLeader = project?.role === 'leader' && project?.creatorEmail === currentUser;

  // Determine if the current user is an approved member for task operations
  const isCurrentUserApprovedMember = projectMembersList.some(
    member => member.email === currentUser && member.status === 'approved'
  );
  // Or if they are the leader, they also have full privileges
  const canPerformTaskActions = isCurrentUserProjectLeader || isCurrentUserApprovedMember;


  const addTask = async () => {
    if (!canPerformTaskActions) {
      setNotification({ message: 'Only approved project members or the leader can add tasks.', type: 'error' });
      return;
    }

    if (!newTask.title.trim()) {
      setNotification({ message: 'Task title cannot be empty', type: 'error' });
      return;
    }
    if (!newTask.assignedTo) {
      setNotification({ message: 'Please assign this task to someone before creating it.', type: 'error' });
      return;
    }
    const taskData = {
      ...newTask,
      createdAt: Timestamp.now(),
      status: 'Not Started',
      comments: [],
      reminderSent: false
    };

    const taskRef = collection(db, 'rooms', roomId, 'projects', projectId, 'tasks');
    const docRef = await addDoc(taskRef, taskData);

    // Removed email sending for task assignment

    setDisplayedAssignedTo(prev => ({ ...prev, [docRef.id]: newTask.assignedTo }));
    setDisplayedStatus(prev => ({ ...prev, [docRef.id]: 'Not Started' }));

    refreshTaskList();
    setNewTask({ title: '', description: '', dueDate: '', priority: 'Medium', assignedTo: '' });
    setNotification({ message: 'Task added successfully!', type: 'success' });
  };

  const addComment = async (taskId) => {
    const text = comments[taskId]?.trim();
    if (!text) return;

    if (!canPerformTaskActions) {
      setNotification({ message: 'Only approved project members or the leader can add comments.', type: 'error' });
      return;
    }

    const taskRef = doc(db, 'rooms', roomId, 'projects', projectId, 'tasks', taskId);

    const taskSnap = await getDoc(taskRef);
    const task = taskSnap.exists() ? taskSnap.data() : null;

    if (!task) {
      console.error("Task not found");
      return;
    }

    await updateDoc(taskRef, {
      comments: arrayUnion({ text, author: currentUser, createdAt: Timestamp.now() })
    });

    // Removed email sending for comments

    setComments(prev => ({ ...prev, [taskId]: '' }));
    refreshTaskList();
  };

  const handleAssignmentChange = async (taskId, newEmail) => {
    if (!canPerformTaskActions) {
      setNotification({ message: 'Only approved project members or the leader can assign tasks.', type: 'error' });
      return;
    }

    const taskRef = doc(db, 'rooms', roomId, 'projects', projectId, 'tasks', taskId);
    await updateDoc(taskRef, { assignedTo: newEmail });
    setDisplayedAssignedTo(prev => ({ ...prev, [taskId]: newEmail }));
    refreshTaskList();
  };

  const handleStatusChange = async (taskId, newStatus) => {
    if (!canPerformTaskActions) {
      setNotification({ message: 'Only approved project members or the leader can change task status.', type: 'error' });
      return;
    }

    const taskRef = doc(db, 'rooms', roomId, 'projects', projectId, 'tasks', taskId);
    const taskSnap = await getDoc(taskRef);
    const task = taskSnap.exists() ? taskSnap.data() : null;

    if (!task) {
      console.error("Task not found for status update");
      return;
    }

    await updateDoc(taskRef, { status: newStatus });
    setDisplayedStatus(prev => ({ ...prev, [taskId]: newStatus }));
    refreshTaskList();

    // Removed email sending for status updates
  };

  const approveTask = (taskId) => handleStatusChange(taskId, 'Completed');
  const rejectTask = (taskId) => handleStatusChange(taskId, 'Redo'); // Changed from 'Needs Changes' to 'Redo'

  const formatTimestamp = (ts) => {
    if (!ts) return '';
    return ts.toDate().toLocaleString('en-MY', { dateStyle: 'medium', timeStyle: 'short' });
  };

  const priorityColor = {
    High: 'bg-red-500',
    Medium: 'bg-yellow-500',
    Low: 'bg-blue-500',
  };

  // --- Member Management Functions ---
  const openAddMemberModal = () => setAddMemberModalOpen(true);
  const closeAddMemberModal = () => {
    setAddMemberModalOpen(false);
    setAddMemberEmail(''); // Clear the input when closing
  };

  const handleAddMember = async () => {
    if (!addMemberEmail.trim()) {
      setNotification({ message: 'Please enter a valid email.', type: 'error' });
      return;
    }

    const memberToAdd = { email: addMemberEmail.trim(), status: 'pending' };

    // Check if the email (regardless of status) already exists in the projectMembersList
    const exists = projectMembersList.some(member => member.email === memberToAdd.email);
    if (exists) {
      setNotification({ message: `${addMemberEmail} is already listed for this project.`, type: 'error' });
      return;
    }

    try {
      const projectDocRef = doc(db, 'rooms', roomId, 'projects', projectId);
      // Always add as pending initially, leader will approve
      await updateDoc(projectDocRef, {
        members: arrayUnion(memberToAdd),
      });

      setNotification({ message: `Invitation sent to ${addMemberEmail}. Pending approval.`, type: 'success' });
      fetchProjectAndRoomData(); // Refresh the list to show the pending member
      closeAddMemberModal();
    } catch (error) {
      console.error("Error adding member:", error);
      setNotification({ message: 'Failed to add member.', type: 'error' });
    }
  };

  const handleMemberStatusChange = async (memberEmail, newStatus) => {
    if (!isCurrentUserProjectLeader) {
      setNotification({ message: 'Only the project leader can approve/reject members.', type: 'error' });
      return;
    }

    try {
      const projectDocRef = doc(db, 'rooms', roomId, 'projects', projectId);
      const currentProjectSnap = await getDoc(projectDocRef);
      const currentMembers = currentProjectSnap.data().members || [];

      const updatedMembers = currentMembers.map(member =>
        member.email === memberEmail ? { ...member, status: newStatus } : member
      );

      await updateDoc(projectDocRef, { members: updatedMembers });
      setNotification({ message: `Member ${memberEmail} status updated to ${newStatus}.`, type: 'success' });
      fetchProjectAndRoomData(); // Refresh the list
    } catch (error) {
      console.error("Error updating member status:", error);
      setNotification({ message: 'Failed to update member status.', type: 'error' });
    }
  };

  const handleRemoveMember = async (memberEmail) => {
    if (!isCurrentUserProjectLeader) {
      setNotification({ message: 'Only the project leader can remove members.', type: 'error' });
      return;
    }

    // Find the exact member object to remove (email and status)
    const memberToRemove = projectMembersList.find(member => member.email === memberEmail);

    if (!memberToRemove) {
      setNotification({ message: 'Member not found to remove.', type: 'error' });
      return;
    }

    // Leader cannot remove themselves
    if (memberEmail === project?.creatorEmail) {
      setNotification({ message: 'The project leader cannot remove themselves.', type: 'error' });
      return;
    }

    try {
      const projectDocRef = doc(db, 'rooms', roomId, 'projects', projectId);
      await updateDoc(projectDocRef, {
        // Use arrayRemove with the exact object to remove
        members: arrayRemove(memberToRemove),
      });

      setNotification({ message: `${memberEmail} removed from the project.`, type: 'success' });
      fetchProjectAndRoomData(); // Refresh the list
    } catch (error) {
      console.error("Error removing member:", error);
      setNotification({ message: 'Failed to remove member.', type: 'error' });
    }
  };

  // --- Delete Task Functions ---
  const handleOpenDeleteConfirm = (task) => {
    // Only project leader can delete tasks
    if (!isCurrentUserProjectLeader) {
      setNotification({ message: 'Only the project leader can delete tasks.', type: 'error' });
      return;
    }
    setTaskToDelete(task);
    setShowDeleteConfirmModal(true);
  };

  const handleDeleteTask = async () => {
    if (!taskToDelete) return;

    try {
      const taskRef = doc(db, 'rooms', roomId, 'projects', projectId, 'tasks', taskToDelete.id);
      await deleteDoc(taskRef);
      setNotification({ message: `Task "${taskToDelete.title}" deleted successfully!`, type: 'success' });
      setShowDeleteConfirmModal(false); // Close modal
      setTaskToDelete(null); // Clear selected task
      refreshTaskList(); // Refresh the list
    } catch (error) {
      console.error("Error deleting task:", error);
      setNotification({ message: 'Failed to delete task. Please try again.', type: 'error' });
    }
  };


  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans">
      <Notification
        message={notification.message}
        type={notification.type}
        onClose={() => setNotification({ message: '', type: '' })}
      />

      {/* Loading Spinner */}
      {isLoading && (
        <div className="fixed inset-0 bg-white bg-opacity-90 flex flex-col items-center justify-center z-50">
          <div className="loader ease-linear rounded-full border-8 border-t-8 border-gray-200 h-24 w-24 mb-4"></div>
          <p className="text-xl text-gray-700 font-semibold">Loading project details...</p>
        </div>
      )}

      {/* Access Denied / Main Content */}
      {!isLoading && accessChecked && !hasAccess && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-xl shadow-lg text-center w-full max-w-md mx-4">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h2>
            <p className="text-gray-700 mb-6">You are not an approved member of this project.</p>
            <button
              onClick={() => navigate('/dashboard')}
              className="bg-purple-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-purple-700 transition"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      )}
      {!isLoading && accessChecked && hasAccess && (
        <> {/* Correctly wrapped in a single fragment */}
          <ProjectHeader roomTitle={`Project: ${project?.title || 'Loading...'}`} onBack={() => navigate(`/room/${roomId}`)} />

          <main className="p-6 sm:p-10">
            {project && (
              <section className="bg-purple-50 rounded-2xl p-8 mb-12 shadow-inner border border-purple-100">
                <h2 className="text-4xl font-extrabold text-purple-800 tracking-tight mb-2"> {project.title}</h2>
                <p className="text-gray-700 text-lg">{project.description}</p>
                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <span className="bg-purple-200 text-purple-700 px-4 py-1 rounded-full text-sm font-semibold">
                    Logged in as: {currentUser}
                  </span>
                  {isCurrentUserProjectLeader ? (
                    <span className="bg-green-200 text-green-800 px-4 py-1 rounded-full text-sm font-semibold uppercase tracking-wider">
                      Project Leader
                    </span>
                  ) : (
                    <span className="bg-yellow-200 text-yellow-800 px-4 py-1 rounded-full text-sm font-semibold uppercase tracking-wider">
                      Your Role: {isCurrentUserApprovedMember ? 'Approved Member' : 'Pending Member'}
                    </span>
                  )}
                </div>
              </section>
            )}

            {/* Add New Member Section */}
            <section className="bg-white p-8 rounded-2xl shadow-xl border border-gray-200 mb-12">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-2xl text-gray-800">Project Members</h3>
                {isCurrentUserProjectLeader && (
                  <button
                    onClick={openAddMemberModal}
                    className="bg-indigo-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-indigo-700 transition duration-300 shadow-md transform hover:scale-105"
                  >
                    Add Member
                  </button>
                )}
              </div>

              {projectMembersList.length === 0 ? (
                <p className="text-gray-500 text-md text-center py-6 bg-gray-50 rounded-lg border">No members added to this project yet.</p>
              ) : (
                <div className="space-y-3">
                  {projectMembersList
                    .filter(member => member?.email) // Skip any malformed entries
                    .map((member, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-4 bg-gray-100 rounded-xl border border-gray-200 shadow-sm"
                      >
                        <div>
                          <p className="text-gray-800 font-semibold">
                            {member.email} {member.email === currentUser && <span className="text-purple-600">(You)</span>}
                          </p>
                          <span
                            className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                              member.status === 'approved' ? 'bg-green-200 text-green-700' : 'bg-yellow-200 text-yellow-700'
                            }`}
                          >
                            {member.status === 'approved' ? 'Approved' : 'Pending Approval'}
                            {member.isProjectLeader && <span className="ml-1 font-bold">(Leader)</span>} {/* Display Leader tag */}
                          </span>
                        </div>

                        {/* Only project leader can see and act on members (excluding themselves) */}
                        {isCurrentUserProjectLeader && member.email !== project?.creatorEmail && (
                          <div className="flex gap-2">
                            {member.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleMemberStatusChange(member.email, 'approved')}
                                  className="bg-green-500 text-white px-3 py-1 rounded-md text-sm hover:bg-green-600 transition"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleMemberStatusChange(member.email, 'rejected')}
                                  className="bg-red-500 text-white px-3 py-1 rounded-md text-sm hover:bg-red-600 transition"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            <button
                              onClick={() => handleRemoveMember(member.email)}
                              className="bg-red-700 text-white px-3 py-1 rounded-md text-sm hover:bg-red-800 transition"
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    ))}

                </div>
              )}
            </section>

            {/* Add Member Modal (Already exists in provided code) */}
            {addMemberModalOpen && (
              <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50">
                <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md mx-4 transform transition-all duration-300 scale-100">
                  <h3 className="text-2xl font-bold text-gray-800 mb-6">Add New Project Member</h3>
                  <input
                    type="email"
                    placeholder="Member's Email"
                    value={addMemberEmail}
                    onChange={(e) => setAddMemberEmail(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-300 rounded-lg px-4 py-2 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-purple-400 focus:border-purple-400 outline-none mb-4"
                  />
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={closeAddMemberModal}
                      className="bg-gray-300 text-gray-800 px-5 py-2 rounded-lg font-medium hover:bg-gray-400 transition duration-300"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddMember}
                      className="bg-purple-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-purple-700 transition duration-300"
                    >
                      Add Member
                    </button>
                  </div>
                </div>
              </div>
            )}


            <section className="bg-gradient-to-br from-purple-50 to-indigo-50 p-8 rounded-2xl shadow-xl border border-purple-200 mb-12">
              <h3 className="font-bold mb-6 text-2xl text-purple-800">Add a New Task</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <input type="text" name="title" placeholder="Task Title" value={newTask.title} onChange={handleInputChange} className="w-full bg-white border border-gray-300 rounded-xl px-5 py-3 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-purple-400 focus:border-purple-400 outline-none transition duration-200 text-lg shadow-sm" disabled={!canPerformTaskActions} />
                <input type="date" name="dueDate" value={newTask.dueDate} onChange={handleInputChange} className="w-full bg-white border border-gray-300 rounded-xl px-5 py-3 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-purple-400 focus:border-purple-400 outline-none transition duration-200 text-lg shadow-sm" disabled={!canPerformTaskActions} />
                <textarea name="description" placeholder="Description..." value={newTask.description} onChange={handleInputChange} className="w-full bg-white border border-gray-300 rounded-xl px-5 py-3 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-purple-400 focus:border-purple-400 outline-none transition duration-200 text-lg shadow-sm md:col-span-2" disabled={!canPerformTaskActions} />
                <select name="priority" value={newTask.priority} onChange={handleInputChange} className="w-full bg-white border border-gray-300 rounded-xl px-5 py-3 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-purple-400 focus:border-purple-400 outline-none transition duration-200 text-lg shadow-sm" disabled={!canPerformTaskActions}>
                  <option>Low</option>
                  <option>Medium</option>
                  <option>High</option>
                </select>
                <select name="assignedTo" value={newTask.assignedTo} onChange={handleInputChange} className="w-full bg-white border border-gray-300 rounded-xl px-5 py-3 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-purple-400 focus:border-purple-400 outline-none transition duration-200 text-lg shadow-sm" disabled={!canPerformTaskActions}>
                  <option value="">Choose...</option>
                  {approvedProjectMembersForDropdown.map(email => <option key={email} value={email}>{email === currentUser ? `${email} (You)` : email}</option>)}
                </select>
              </div>
              <button onClick={addTask} className="mt-6 w-full md:w-auto bg-purple-600 text-white px-8 py-3 rounded-xl font-semibold text-lg hover:bg-purple-700 transition duration-300 ease-in-out shadow-lg focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-opacity-75 transform hover:scale-105" disabled={!canPerformTaskActions}>➕ Add Task</button>
            </section>

            <section>
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-3xl font-bold text-purple-800">Task List</h3>
                <button onClick={() => navigate(`/room/${roomId}/project/${projectId}/taskboard`)} className="bg-indigo-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-indigo-700 transition duration-300 shadow-md transform hover:scale-105">
                  Go to Task Board
                </button>
              </div>
              {tasks.length === 0 ? (
                <p className="text-gray-500 text-lg text-center py-12 bg-gray-100 rounded-xl shadow-inner">No tasks found for this project yet.</p>
              ) : (
                <div className="space-y-6">
                  {tasks.map((task) => (
                    <div key={task.id} className="bg-white p-6 rounded-2xl shadow-lg border border-gray-200 transition-shadow hover:shadow-xl">
                      <div className="flex justify-between items-start">
                        <h4 className="text-xl font-bold text-gray-900">{task.title}</h4>
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${priorityColor[task.priority]}`}></div>
                          <span className="text-sm font-semibold">{task.priority}</span>
                        </div>
                      </div>
                      <p className="text-gray-600 mt-2 mb-4">{task.description}</p>

                      <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                        <p><b>Due Date:</b> {task.dueDate || 'Not set'}</p>
                        <p><b>Created:</b> {formatTimestamp(task.createdAt)}</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg border">
                        <div>
                          <label className="block text-sm font-medium mb-1">Assigned to:</label>
                          <select
                            value={displayedAssignedTo[task.id] || ''}
                            onChange={e => handleAssignmentChange(task.id, e.target.value)}
                            className="w-full border px-2 py-1.5 rounded-md shadow-sm"
                            disabled={!canPerformTaskActions}
                          >
                            <option value="">Choose...</option>
                            {approvedProjectMembersForDropdown.map((email) => <option key={email} value={email}>{email === currentUser ? `${email} (You)` : email}</option>)}
                          </select>
                          {displayedAssignedTo[task.id] && (
                            <p className="text-xs text-green-600 mt-1">Assigned to: {displayedAssignedTo[task.id]}</p>
                          )}
                        </div>
                        <div>
                          <label className="block text-sm font-medium mb-1">Status:</label>
                          {/* Display current status above the dropdown */}
                          {displayedStatus[task.id] && (
                            <p className="text-md font-semibold text-gray-700 mb-1">Current: {displayedStatus[task.id]}</p>
                          )}
                          <select
                            value={displayedStatus[task.id] || ''}
                            onChange={(e) => handleStatusChange(task.id, e.target.value)}
                            // Disable if status is 'Pending Review' for non-leaders, or if no task action permission
                            disabled={!canPerformTaskActions || task.status === 'Pending Review'}
                            className="w-full border px-2 py-1.5 rounded-md shadow-sm"
                          >
                            <option value="">Choose...</option>
                            <option>Not Started</option>
                            <option>In Progress</option>
                            <option>Pending Review</option>
                            <option>Completed</option>
                            <option>Redo</option> {/* Added Redo option to dropdown */}
                          </select>
                        </div>
                      </div>
                      {/* Approval/Rejection buttons for leader */}
                      {isCurrentUserProjectLeader && task.status === 'Pending Review' && (
                        <div className="mt-4 flex gap-3 justify-end">
                          <button
                            onClick={() => approveTask(task.id)}
                            className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 transition"
                          >
                            Approve Task
                          </button>
                          <button
                            onClick={() => rejectTask(task.id)}
                            className="bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 transition"
                          >
                            Reject Task
                          </button>
                        </div>
                      )}
                      {/* Delete Task Button */}
                      {isCurrentUserProjectLeader && (
                        <div className="mt-4 flex justify-end">
                          <button
                            onClick={() => handleOpenDeleteConfirm(task)}
                            className="bg-red-700 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-800 transition shadow-md"
                          >
                            Delete Task
                          </button>
                        </div>
                      )}

                      <div className="mt-6 border-t pt-4">
                        <h5 className="text-lg font-semibold text-gray-800 mb-3">Comments</h5>
                        {/* Add Array.isArray check here */}
                        {Array.isArray(task.comments) && task.comments.length > 0 ? (
                          <div className="space-y-3 max-h-40 overflow-y-auto pr-2">
                            {task.comments.map((comment, i) => (
                              <div key={i} className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                                <p className="text-gray-700">{comment.text}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                  By {comment.author} at {formatTimestamp(comment.createdAt)}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-gray-500 text-sm">No comments yet.</p>
                        )}
                        <div className="mt-4 flex gap-2">
                          <input
                            type="text"
                            placeholder="Add a comment..."
                            value={comments[task.id] || ''}
                            onChange={e => handleCommentChange(task.id, e.target.value)}
                            className="flex-grow bg-gray-50 border border-gray-300 rounded-lg px-4 py-2 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-purple-400 focus:border-purple-400 outline-none"
                            disabled={!canPerformTaskActions}
                          />
                          <button
                            onClick={() => addComment(task.id)}
                            className="bg-purple-600 text-white px-5 py-2 rounded-lg font-medium hover:bg-purple-700 transition duration-300"
                            disabled={!canPerformTaskActions}
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </main>
        </>
      )}

      {/* Delete Task Confirmation Modal */}
      {showDeleteConfirmModal && taskToDelete && (
        <div className="fixed inset-0 bg-gray-800 bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 shadow-xl max-w-md w-full m-4 text-center border-t-4 border-red-500">
            <h3 className="text-2xl font-bold mb-4 text-red-700">Confirm Deletion</h3>
            <p className="text-gray-700 mb-6">
              Are you sure you want to delete the task: <br />
              <span className="font-semibold text-lg">"{taskToDelete.title}"</span>?
              <br /> This action cannot be undone.
            </p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => setShowDeleteConfirmModal(false)}
                className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition-colors duration-200"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTask}
                className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition-colors duration-200"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

  );
};

export default ProjectDetail;