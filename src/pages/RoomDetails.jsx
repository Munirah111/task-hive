import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import {
    doc,
    getDoc,
    updateDoc,
    collection,
    addDoc,
    getDocs,
    Timestamp
} from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';

// Simple Notification Component (can be extracted to a separate file later)
const Notification = ({ message, type, onClose }) => {
    if (!message) return null;

    const bgColor = type === 'success' ? 'bg-green-500' : 'bg-red-500';
    const textColor = 'text-white';

    return (
        <div
            className={`fixed top-5 right-5 z-50 p-4 rounded-lg shadow-xl flex items-center justify-between transition-all duration-300 transform ${bgColor} ${textColor}`}
            style={{ minWidth: '250px' }}
        >
            <span className="font-semibold">{message}</span>
            <button onClick={onClose} className="ml-4 text-white font-bold text-lg leading-none">
                &times;
            </button>
        </div>
    );
};

// Confirmation Modal Component
const ConfirmationModal = ({ isOpen, message, onConfirm, onCancel }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-lg shadow-xl max-w-sm w-full mx-4">
                <h3 className="text-xl font-bold mb-4 text-gray-800">Confirm Action</h3>
                <p className="text-gray-700 mb-6">{message}</p>
                <div className="flex justify-end gap-4">
                    <button
                        onClick={onCancel}
                        className="px-5 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-100 transition duration-300"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-5 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition duration-300"
                    >
                        Confirm
                    </button>
                </div>
            </div>
        </div>
    );
};

// Restricted Access Modal Component
const RestrictedAccessModal = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded-lg shadow-xl max-w-sm w-full mx-4 text-center">
                <h3 className="text-xl font-bold mb-4 text-red-600">Access Restricted</h3>
                <p className="text-gray-700 mb-6">
                    You do not have the necessary permissions to view this project's tasks. Please
                    wait for approval or contact the project leader.
                </p>
                <button
                    onClick={onClose}
                    className="px-6 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition duration-300"
                >
                    Got It
                </button>
            </div>
        </div>
    );
};

const RoomDetails = () => {
    const { roomId } = useParams();
    const navigate = useNavigate();

    const [room, setRoom] = useState(null);
    const [newMember, setNewMember] = useState('');
    const [projects, setProjects] = useState([]);
    const [projectTitle, setProjectTitle] = useState('');
    const [projectDescription, setProjectDescription] = useState('');
    const [isProjectLeader, setIsProjectLeader] = useState(false); // State for project leader checkbox

    const [currentUserRole, setCurrentUserRole] = useState(''); // This is the user's global role (e.g., 'admin', 'member')
    const [currentUserEmail, setCurrentUserEmail] = useState('');
    const [isLoadingRole, setIsLoadingRole] = useState(true); // State for role loading

    // Loading and Notification states
    const [isLoadingMemberAdd, setIsLoadingMemberAdd] = useState(false);
    const [isLoadingProjectCreate, setIsLoadingProjectCreate] = useState(false);
    const [notification, setNotification] = useState({ message: '', type: '' });

    // Modal states
    const [showJoinConfirmation, setShowJoinConfirmation] = useState(false);
    const [projectToJoin, setProjectToJoin] = useState(null);
    const [showRestrictedModal, setShowRestrictedModal] = useState(false);

    // Use useCallback to memoize fetchProjects, so it doesn't cause infinite loops in useEffect
    const fetchProjects = useCallback(async () => {
        if (!roomId) return;
        try {
            const projectRef = collection(db, 'rooms', roomId, 'projects');
            const snapshot = await getDocs(projectRef);
            const projectList = snapshot.docs.map(doc => {
                const data = doc.data();
                // Ensure 'members' array exists and process it
                const members = data.members ? data.members.map(member => {
                    if (typeof member === 'string') {
                        // Assuming old string members are 'approved' if you have them
                        return { email: member, status: 'approved' };
                    }
                    return member;
                }) : [];

                return {
                    id: doc.id,
                    ...data,
                    members: members, // Assign the processed members
                    createdAt: data.createdAt?.toDate().toLocaleString(),
                };
            });
            setProjects(projectList);
        } catch (error) {
            console.error("Error fetching projects:", error);
            setNotification({ message: 'Failed to load projects.', type: 'error' });
        }
    }, [roomId]); // Dependency array: fetchProjects changes only if roomId changes

    // Fetch current user details on auth state change
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setCurrentUserEmail(user.email);
                setIsLoadingRole(true); // Start loading role
                try {
                    const userDoc = await getDoc(doc(db, 'users', user.uid));
                    if (userDoc.exists()) {
                        setCurrentUserRole(userDoc.data().role);
                    } else {
                        setCurrentUserRole('member'); // Default to member if user doc not found
                    }
                } catch (error) {
                    console.error("Error fetching user role:", error);
                    setNotification({ message: 'Failed to fetch user role. Defaulting to member.', type: 'error' });
                    setCurrentUserRole('member'); // Default to member on error
                } finally {
                    setIsLoadingRole(false); // Done loading role
                }
            } else {
                navigate('/login');
                setIsLoadingRole(false); // Not logged in, so not loading
            }
        });
        return () => unsubscribe();
    }, [navigate]);

    // Fetch room details
    useEffect(() => {
        const fetchRoom = async () => {
            if (!roomId) return;
            const docRef = doc(db, 'rooms', roomId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                // Ensure members are consistently handled:
                // Convert any string members to objects for consistent rendering
                const roomData = docSnap.data();
                const processedMembers = roomData.members ? roomData.members.map(member => {
                    if (typeof member === 'string') {
                        return { email: member, status: 'approved' }; // Assume existing string members are approved
                    }
                    return member;
                }) : []; // Ensure members is an array, even if undefined in DB
                setRoom({ id: docSnap.id, ...roomData, members: processedMembers });
            } else {
                setNotification({ message: 'Room not found!', type: 'error' });
                navigate('/dashboard');
            }
        };
        fetchRoom();
    }, [roomId, navigate]);

    // Fetch projects when roomId or fetchProjects function changes
    useEffect(() => {
        fetchProjects();
    }, [fetchProjects]); // Now depends on the memoized fetchProjects

    // Effect to hide notification after some time
    useEffect(() => {
        if (notification.message) {
            const timer = setTimeout(() => {
                setNotification({ message: '', type: '' });
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    const addMember = async () => {
        if (!newMember.trim()) {
            setNotification({ message: 'Member email cannot be empty.', type: 'error' });
            return;
        }
        setIsLoadingMemberAdd(true);
        try {
            const members = room.members || [];
            // Check if member (by email) already exists, regardless of current status
            if (members.some(m => m.email === newMember.trim())) {
                setNotification({ message: "User is already a member or pending.", type: 'error' });
                return;
            }
            // Always add new members as objects, default to 'approved' if no explicit status is needed
            // Based on the request, we are removing the 'approved' tag from display and simplifying logic.
            const updated = [...members, { email: newMember.trim(), status: 'approved' }];
            await updateDoc(doc(db, 'rooms', roomId), { members: updated });
            setRoom({ ...room, members: updated });
            setNewMember('');
            setNotification({ message: "Member added successfully!", type: 'success' });
        } catch (error) {
            console.error("Error adding member:", error);
            setNotification({ message: "Failed to add member.", type: 'error' });
        } finally {
            setIsLoadingMemberAdd(false);
        }
    };

    const createProject = async () => {
        if (!projectTitle.trim()) {
            setNotification({ message: 'Project title cannot be empty.', type: 'error' });
            return;
        }
        setIsLoadingProjectCreate(true);
        try {
            const projectRef = collection(db, 'rooms', roomId, 'projects');
            await addDoc(projectRef, {
                title: projectTitle,
                description: projectDescription,
                createdAt: Timestamp.now(),
                creatorEmail: currentUserEmail, // The email of the user who created this project
                // NEW FIELD (formerly creatorInitialRole), now simply 'role'
                // This field indicates if the creator is 'leader' or 'member' for THIS project
                role: isProjectLeader ? 'leader' : 'member',
                members: [{ email: currentUserEmail, status: 'approved' }] // Creator is automatically an approved member
            });
            setProjectTitle('');
            setProjectDescription('');
            setIsProjectLeader(false); // Reset the checkbox
            await fetchProjects();
            setNotification({ message: 'Project added successfully!', type: 'success' });
        } catch (error) {
            console.error("Error creating project:", error);
            setNotification({ message: "Failed to create project.", type: 'error' });
        } finally {
            setIsLoadingProjectCreate(false);
        }
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
            navigate('/login');
        } catch (error) {
            console.error('Error logging out:', error);
            setNotification({ message: 'Failed to log out. Please try again.', type: 'error' });
        }
    };

    // Determine if the current user is the room owner for UI permissions
    const isCurrentUserRoomOwner = room?.owner === currentUserEmail;

    // --- New Project Join Logic ---

    const handleJoinProjectClick = (project) => {
        setProjectToJoin(project);
        setShowJoinConfirmation(true);
    };

    const confirmJoinProject = async () => {
        if (!projectToJoin || !currentUserEmail) {
            setNotification({ message: 'Error: Project or user information missing.', type: 'error' });
            setShowJoinConfirmation(false);
            return;
        }

        setShowJoinConfirmation(false); // Close the confirmation modal
        try {
            const projectDocRef = doc(db, 'rooms', roomId, 'projects', projectToJoin.id);
            const projectSnap = await getDoc(projectDocRef);

            if (projectSnap.exists()) {
                const projectData = projectSnap.data();
                const currentMembers = projectData.members || [];

                // Check if user is already a member (approved or pending)
                const isAlreadyMember = currentMembers.some(
                    (member) => member.email === currentUserEmail
                );

                if (isAlreadyMember) {
                    setNotification({ message: 'You are already a member or pending for this project.', type: 'error' });
                    return;
                }

                const updatedMembers = [...currentMembers, { email: currentUserEmail, status: 'pending' }];
                await updateDoc(projectDocRef, { members: updatedMembers });
                setNotification({ message: `Join request for "${projectToJoin.title}" sent. Awaiting leader approval.`, type: 'success' });
                await fetchProjects(); // Re-fetch projects to update UI
            } else {
                setNotification({ message: 'Project not found.', type: 'error' });
            }
        } catch (error) {
            console.error("Error joining project:", error);
            setNotification({ message: "Failed to send join request. Please try again.", type: 'error' });
        } finally {
            setProjectToJoin(null);
        }
    };

    const handleViewProjectTasks = (project) => {
        const isCreator = project.creatorEmail === currentUserEmail;
        const isLeader = project.role === 'leader' && isCreator; // Creator is leader of their project
        
        // Check if current user is an approved member of this project
        const isApprovedMember = project.members && project.members.some(
            (member) => member.email === currentUserEmail && member.status === 'approved'
        );

        if (isCreator || isApprovedMember) {
            navigate(`/room/${roomId}/project/${project.id}`);
        } else {
            setShowRestrictedModal(true);
        }
    };

    if (!room) {
        return (
            <div className="min-h-screen bg-white text-gray-800 font-sans flex items-center justify-center">
                <svg className="animate-spin h-8 w-8 text-purple-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <p className="ml-3 text-lg">Loading room details...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white text-gray-800 font-sans">
            {/* Notification Component */}
            <Notification
                message={notification.message}
                type={notification.type}
                onClose={() => setNotification({ message: '', type: '' })}
            />

            {/* Confirmation Modal */}
            <ConfirmationModal
                isOpen={showJoinConfirmation}
                message={`Are you sure you want to send a join request to project "${projectToJoin?.title}"?`}
                onConfirm={confirmJoinProject}
                onCancel={() => {
                    setShowJoinConfirmation(false);
                    setProjectToJoin(null);
                }}
            />

            {/* Restricted Access Modal */}
            <RestrictedAccessModal
                isOpen={showRestrictedModal}
                onClose={() => setShowRestrictedModal(false)}
            />

            {/* Header and Navigation (Consistent with Dashboard) */}
            <header className="bg-purple-800 text-white shadow-lg p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-center sticky top-0 z-50">
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
                        onClick={handleLogout}
                        className="text-lg font-medium relative group px-2 py-1 text-white hover:text-gray-200 transition duration-300 ease-in-out"
                    >
                        Logout
                        <span className="absolute bottom-0 left-1/2 w-0 h-0.5 bg-white group-hover:w-full group-hover:left-0 transition-all duration-300"></span>
                    </button>
                </nav>
            </header>

            <main className="p-6 sm:p-10 max-w-6xl mx-auto">
                {/* User Info & Room Header Section */}
                <section className="bg-purple-50 rounded-2xl p-8 mb-12 shadow-inner border border-purple-100 flex flex-col md:flex-row justify-between items-start md:items-center">
                    <div>
                        <p className="text-lg font-semibold text-gray-700 mb-1">Room Overview</p>
                        <h2 className="text-4xl font-extrabold text-purple-800 tracking-tight mb-2">
                             {room?.roomName}
                        </h2>
                        <p className="text-md text-gray-600">
                            <span className="font-semibold text-purple-700">Room ID:</span>{' '}
                            <code className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-sm select-all font-mono">
                                {roomId}
                            </code>
                        </p>
                    </div>
                    <div className="mt-6 md:mt-0 md:ml-auto text-right">
                        <p className="text-sm text-gray-700">Logged in as:</p>
                        <p className="text-xl font-bold text-purple-800">{currentUserEmail}</p>
                        {isLoadingRole ? (
                            <span className="bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mt-1 inline-block">
                                Loading Role...
                            </span>
                        ) : (
                            <span className="bg-purple-200 text-purple-700 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mt-1 inline-block">
                                {currentUserRole}
                            </span>
                        )}
                        {isCurrentUserRoomOwner && (
                            <span className="bg-blue-200 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider mt-1 ml-2 inline-block">
                                Room Owner
                            </span>
                        )}
                    </div>
                </section>

                {/* Member Management Section */}
                <section className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                    {/* Only room owner can invite new members */}
                    {isCurrentUserRoomOwner && (
                        <div className="bg-gradient-to-br from-purple-50 to-indigo-50 p-8 rounded-2xl shadow-xl border border-purple-200">
                            <h3 className="font-bold mb-6 text-2xl text-purple-800">Add New Member</h3>
                            <div className="flex flex-col sm:flex-row gap-4 items-center">
                                <input
                                    type="email"
                                    value={newMember}
                                    onChange={(e) => setNewMember(e.target.value)}
                                    placeholder="Enter member email"
                                    className="flex-grow border border-gray-300 rounded-xl px-5 py-3 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-purple-400 focus:border-purple-400 outline-none transition duration-200 text-lg shadow-sm"
                                    aria-label="New member email"
                                />
                                <button
                                    onClick={addMember}
                                    disabled={isLoadingMemberAdd}
                                    className="bg-purple-600 text-white px-6 py-3 rounded-xl font-semibold text-lg hover:bg-purple-700 transition duration-300 ease-in-out shadow-lg focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-opacity-75 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
                                >
                                    {isLoadingMemberAdd ? (
                                        <svg className="animate-spin h-5 w-5 text-white mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                    ) : (
                                        <>
                                            <span className="mr-2"></span> Invite
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-8 rounded-2xl shadow-xl border border-blue-200">
                        <h3 className="font-bold mb-6 text-2xl text-indigo-800">Current Members</h3>
                        <div className="space-y-4 max-h-60 overflow-y-auto custom-scrollbar pr-4"> {/* Added max-h and overflow-y-auto for scrollability */}
                            {room?.members?.length === 0 ? (
                                <p className="text-gray-500 italic">No members in this room yet.</p>
                            ) : (
                                <ul className="divide-y divide-gray-200">
                                    {room?.members?.map((m, idx) => {
                                        const memberEmail = typeof m === 'string' ? m : m.email;
                                        // const memberStatus = typeof m === 'string' ? 'approved' : m.status; // No longer needed for display

                                        return (
                                            <li key={memberEmail || idx} className="py-3 flex justify-between items-center">
                                                <span className="text-gray-700 font-medium">
                                                    {memberEmail}
                                                </span>
                                                {/* Removed the status tag and action buttons */}
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                    </div>
                </section>

                {/* Project Section */}
                <section className="mb-12">
                    <h3 className="text-3xl font-bold mb-6 text-purple-800">Projects</h3>
                    {projects.length === 0 ? (
                        <p className="text-gray-500 text-lg text-center py-12 bg-gray-50 rounded-xl shadow-inner border border-gray-200">
                            No projects in this room yet. Create one to get started!
                        </p>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {projects.map(project => {
                                // Determine if the current user is the creator or an approved member of THIS project
                                const isCreator = project.creatorEmail === currentUserEmail;
                                const isApprovedMember = project.members && project.members.some(
                                    (member) => member.email === currentUserEmail && member.status === 'approved'
                                );
                                const isPendingMember = project.members && project.members.some(
                                    (member) => member.email === currentUserEmail && member.status === 'pending'
                                );
                                const isAlreadyMemberOrPending = isCreator || isApprovedMember || isPendingMember;

                                return (
                                    <div
                                        key={project.id}
                                        className="bg-white border border-purple-200 p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 relative overflow-hidden group"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-br from-purple-50 to-indigo-50 opacity-0 group-hover:opacity-100 rounded-2xl transition-opacity duration-300 pointer-events-none"></div>
                                        <h4 className="text-xl font-bold text-purple-700 mb-2 relative z-10">{project.title}</h4>
                                        {/* UPDATED: Display Creator's Role on Project */}
                                        {project.creatorEmail && project.role && (
                                            <p className="text-sm text-gray-600 mb-1 relative z-10">
                                                Created by: <span className="font-semibold">{project.creatorEmail === currentUserEmail ? "You" : project.creatorEmail}</span>
                                                <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold uppercase ${
                                                    project.role === 'leader' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                                                }`}>
                                                    {project.role}
                                                </span>
                                            </p>
                                        )}
                                        <p className="text-sm text-gray-600 mb-3 relative z-10">{project.description}</p>
                                        <p className="text-xs text-gray-500 italic mb-4 relative z-10">
                                            Created: {project.createdAt}
                                        </p>
                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => handleViewProjectTasks(project)}
                                                className="bg-purple-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition duration-300 shadow-md transform hover:scale-105 relative z-10"
                                            >
                                                View Project Tasks
                                            </button>
                                            {!isAlreadyMemberOrPending && (
                                                <button
                                                    onClick={() => handleJoinProjectClick(project)}
                                                    className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition duration-300 shadow-md transform hover:scale-105 relative z-10"
                                                >
                                                    Join Project
                                                </button>
                                            )}
                                            {isPendingMember && (
                                                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800 flex items-center justify-center relative z-10">
                                                    Pending Approval
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                {/* Add Project Form (Any approved room member can create a project) */}
                <section className="bg-gradient-to-br from-purple-50 to-indigo-50 p-8 rounded-2xl shadow-xl border border-purple-200">
                    <h3 className="font-bold mb-6 text-2xl text-purple-800">Add New Project</h3>
                    <div className="space-y-4">
                        <input
                            type="text"
                            placeholder="Project Title"
                            value={projectTitle}
                            onChange={(e) => setProjectTitle(e.target.value)}
                            className="w-full bg-white border border-gray-300 rounded-xl px-5 py-3 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-purple-400 focus:border-purple-400 outline-none transition duration-200 text-lg shadow-sm"
                            aria-label="Project Title"
                        />
                        <textarea
                            placeholder="Project Description"
                            value={projectDescription}
                            onChange={(e) => setProjectDescription(e.target.value)}
                            rows="4"
                            className="w-full bg-white border border-gray-300 rounded-xl px-5 py-3 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-purple-400 focus:border-purple-400 outline-none transition duration-200 text-lg shadow-sm resize-y"
                            aria-label="Project Description"
                        ></textarea>

                        {/* Project Leader Option */}
                        <div className="flex items-center mt-4">
                            <input
                                type="checkbox"
                                id="isProjectLeader"
                                checked={isProjectLeader}
                                onChange={(e) => setIsProjectLeader(e.target.checked)}
                                className="h-5 w-5 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                            />
                            <label htmlFor="isProjectLeader" className="ml-2 block text-md text-gray-700">
                                I am the leader for this project
                            </label>
                        </div>

                        <button
                            onClick={createProject}
                            disabled={isLoadingProjectCreate}
                            className="w-full bg-purple-600 text-white py-3 rounded-xl font-semibold text-lg hover:bg-purple-700 transition duration-300 ease-in-out shadow-lg focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-opacity-75 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isLoadingProjectCreate ? (
                                <svg className="animate-spin h-5 w-5 text-white mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            ) : (
                                <>
                                    <span className="mr-2"></span> Create Project
                                </>
                            )}
                        </button>
                    </div>
                </section>
            </main>
        </div>
    );
};

export default RoomDetails;