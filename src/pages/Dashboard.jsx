import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebase';
import {
    collection,
    getDocs,
    addDoc,
    updateDoc,
    doc,
    deleteDoc,
    getDoc,
    arrayUnion,
    collectionGroup, // Import collectionGroup
    query, // Import query
    where, // Import where
    Timestamp, // Import Timestamp for date handling
} from 'firebase/firestore';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';

// Simple Notification Component (no changes here)
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

// Edit Room Name Modal Component (no changes here)
const EditRoomNameModal = ({ room, onUpdate, onCancel, setNotification }) => {
    const [newName, setNewName] = useState(room.roomName);

    const handleUpdate = () => {
        if (!newName.trim()) {
            setNotification({ message: 'Room name cannot be empty', type: 'error' });
            return;
        }
        if (newName.trim() === room.roomName) {
            onCancel();
            return;
        }
        onUpdate(room.id, newName.trim());
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
            <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md mx-4">
                <h2 className="text-2xl font-bold text-purple-800 mb-6">Edit Room Name</h2>
                <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full bg-white border border-gray-300 rounded-xl px-5 py-3 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-purple-400 focus:border-purple-400 outline-none transition duration-200 text-lg shadow-sm mb-6"
                    placeholder="Enter new room name"
                />
                <div className="flex justify-end gap-4">
                    <button
                        onClick={onCancel}
                        className="px-6 py-2 rounded-lg text-sm font-medium bg-gray-200 text-gray-800 hover:bg-gray-300 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleUpdate}
                        className="px-6 py-2 rounded-lg text-sm font-medium bg-purple-600 text-white hover:bg-purple-700 transition-colors shadow-md"
                    >
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};

// Delete Confirmation Modal Component (no changes here)
const DeleteConfirmationModal = ({ onConfirm, onCancel }) => {
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50">
            <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md mx-4 text-center">
                <h2 className="text-2xl font-bold text-gray-800 mb-4">Confirm Deletion</h2>
                <p className="text-gray-600 mb-8">
                    Are you sure you want to delete this room? This action is permanent and cannot be undone.
                </p>
                <div className="flex justify-center gap-4">
                    <button
                        onClick={onCancel}
                        className="px-8 py-2 rounded-lg text-sm font-medium bg-gray-200 text-gray-800 hover:bg-gray-300 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-8 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors shadow-md focus:outline-none focus:ring-2 focus:ring-red-400"
                    >
                        Delete Room
                    </button>
                </div>
            </div>
        </div>
    );
};


export default function Dashboard() {
    const [user, setUser] = useState(null);
    const [rooms, setRooms] = useState([]);
    const [roomName, setRoomName] = useState('');
    const [roomId, setRoomId] = useState('');
    const [isLoadingCreate, setIsLoadingCreate] = useState(false);
    const [isLoadingJoin, setIsLoadingJoin] = useState(false);
    const [notification, setNotification] = useState({ message: '', type: '' });
    const [isLoading, setIsLoading] = useState(true);

    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [currentRoomToEdit, setCurrentRoomToEdit] = useState(null);

    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [roomToDelete, setRoomToDelete] = useState(null);

    // States for efficiency metrics
    const [totalTasks, setTotalTasks] = useState(0);
    const [completedTasks, setCompletedTasks] = useState(0);
    const [overdueTasks, setOverdueTasks] = useState(0);


    const navigate = useNavigate();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                setUser(user);
                await fetchRooms(user);
                // After rooms are fetched, fetch and calculate tasks
                await fetchTasksAndCalculateEfficiency(user);
                setIsLoading(false);
            } else {
                navigate('/login');
            }
        });
        return () => unsubscribe();
    }, [navigate]);

    useEffect(() => {
        if (notification.message) {
            const timer = setTimeout(() => {
                setNotification({ message: '', type: '' });
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    const fetchRooms = async (currentUser) => {
        try {
            const snapshot = await getDocs(collection(db, 'rooms'));
            const roomsData = snapshot.docs
                .map((doc) => ({ id: doc.id, ...doc.data() }))
                .filter((room) => {
                    // Check if currentUser.email is in the members array, regardless of format
                    return room.members?.some(member =>
                        typeof member === 'string' ? member === currentUser.email : member.email === currentUser.email
                    );
                });
            setRooms(roomsData);
            return roomsData; // Return rooms for further use
        } catch (error) {
            console.error('Error loading rooms:', error);
            return [];
        }
    };

    // Updated function to fetch tasks and calculate efficiency for the current user
    const fetchTasksAndCalculateEfficiency = async (currentUser) => {
        if (!currentUser) return;

        let total = 0;
        let completed = 0;
        let overdue = 0;
        const now = new Date();

        try {
            // Use collectionGroup to query tasks across all rooms
            const q = query(
                collectionGroup(db, 'tasks'),
                where("assignedTo", "==", currentUser.email)
            );
            const tasksSnapshot = await getDocs(q);

            tasksSnapshot.forEach(taskDoc => {
                const task = taskDoc.data();

                total++; // Counts all tasks assigned to the current user

                if (task.status === 'completed' || task.status === 'Done') {
                    completed++;
                }

                // Corrected overdue logic to explicitly exclude completed tasks, matching MyTasks.jsx
                // Ensure task.dueDate is a Firebase Timestamp and convert it to a JS Date
                const taskDueDate = task.dueDate instanceof Timestamp ? task.dueDate.toDate() : task.dueDate;

                if (taskDueDate && new Date(taskDueDate) < now &&
                    task.status !== 'completed' && task.status !== 'Done') {
                    overdue++;
                }
            });
        } catch (error) {
            console.error(`Error fetching tasks for current user:`, error);
        }
        setTotalTasks(total);
        setCompletedTasks(completed);
        setOverdueTasks(overdue);
    };


    const handleCreateRoom = async () => {
        if (!roomName.trim()) {
            setNotification({ message: 'Room name cannot be empty', type: 'error' });
            return;
        }
        setIsLoadingCreate(true);
        try {
            await addDoc(collection(db, 'rooms'), {
                roomName,
                createdBy: user.email,
                members: [user.email], // Ensure initial member is just the email string
            });
            setNotification({ message: 'Room created successfully!', type: 'success' });
            setRoomName('');
            await fetchRooms(user); // Re-fetch rooms
            await fetchTasksAndCalculateEfficiency(user); // Recalculate tasks
        } catch (error) {
            console.error('Error creating room:', error);
            setNotification({ message: 'Failed to create room.', type: 'error' });
        } finally {
            setIsLoadingCreate(false);
        }
    };

    const handleJoinRoom = async () => {
        if (!roomId.trim()) {
            setNotification({ message: 'Room ID cannot be empty', type: 'error' });
            return;
        }
        setIsLoadingJoin(true);
        try {
            const roomRef = doc(db, 'rooms', roomId);
            const roomSnap = await getDoc(roomRef);

            if (!roomSnap.exists()) {
                setNotification({ message: 'Room not found. Please check the ID.', type: 'error' });
                return;
            }

            // Check if the user is already a member, handling both string and object formats
            const isAlreadyMember = roomSnap.data().members?.some(member =>
                typeof member === 'string' ? member === user.email : member.email === user.email
            );

            if (isAlreadyMember) {
                setNotification({ message: 'You are already a member of this room.', type: 'error' });
                return;
            }

            // Add the new member as an object with 'email' and 'status'
            await updateDoc(roomRef, {
                members: arrayUnion({ email: user.email, status: 'approved' }),
            });
            setNotification({ message: 'Joined room successfully!', type: 'success' });
            setRoomId('');
            await fetchRooms(user); // Re-fetch rooms
            await fetchTasksAndCalculateEfficiency(user); // Recalculate tasks
        } catch (error) {
            console.error('Error joining room:', error);
            setNotification({ message: 'Failed to join room. An unexpected error occurred.', type: 'error' });
        } finally {
            setIsLoadingJoin(false);
        }
    };

    const handleEditRoomName = (room) => {
        setCurrentRoomToEdit(room);
        setIsEditModalOpen(true);
    };

    const handleUpdateRoomName = async (roomIdToEdit, newName) => {
        try {
            await updateDoc(doc(db, 'rooms', roomIdToEdit), {
                roomName: newName,
            });
            setNotification({ message: 'Room name updated.', type: 'success' });
            await fetchRooms(user); // Re-fetch rooms
            await fetchTasksAndCalculateEfficiency(user); // Recalculate tasks
        } catch (error) {
            console.error('Error updating room name:', error);
            setNotification({ message: 'Failed to update room name. Please try again.', type: 'error' });
        } finally {
            setIsEditModalOpen(false);
            setCurrentRoomToEdit(null);
        }
    };

    const handleDeleteRoom = (roomId) => {
        setRoomToDelete(roomId);
        setIsDeleteModalOpen(true);
    };

    const confirmDelete = async () => {
        if (!roomToDelete) return;
        try {
            await deleteDoc(doc(db, 'rooms', roomToDelete));
            setNotification({ message: 'Room deleted successfully!', type: 'success' });
            await fetchRooms(user); // Re-fetch rooms
            await fetchTasksAndCalculateEfficiency(user); // Recalculate tasks
        } catch (error) {
            console.error('Failed to delete room:', error);
            setNotification({ message: 'Failed to delete room. Please try again.', type: 'error' });
        } finally {
            setIsDeleteModalOpen(false);
            setRoomToDelete(null);
        }
    };

    const handleLogout = async () => {
        try {
            await signOut(auth);
            navigate('/login');
        } catch (error) {
            console.error('Error logging out:', error);
            alert('Failed to log out. Please try again.');
        }
    };

    // --- Loading Page Render ---
    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-white">
                <div className="flex flex-col items-center">
                    <svg className="animate-spin h-10 w-10 text-purple-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="text-lg font-semibold text-purple-600">Loading your dashboard...</p>
                </div>
            </div>
        );
    }

    // --- Main Dashboard Content Render ---
    return (
        <div className="min-h-screen bg-gray-100 text-gray-800 font-sans">
            {isEditModalOpen && currentRoomToEdit && (
                <EditRoomNameModal
                    room={currentRoomToEdit}
                    onUpdate={handleUpdateRoomName}
                    onCancel={() => setIsEditModalOpen(false)}
                    setNotification={setNotification}
                />
            )}

            {isDeleteModalOpen && (
                <DeleteConfirmationModal
                    onConfirm={confirmDelete}
                    onCancel={() => setIsDeleteModalOpen(false)}
                />
            )}

            <Notification
                message={notification.message}
                type={notification.type}
                onClose={() => setNotification({ message: '', type: '' })}
            />

            <header className="bg-purple-800 text-white shadow-lg p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-center sticky top-0 z-40">
                <div className="mb-4 sm:mb-0 text-center sm:text-left">
                    <h1 className="text-4xl font-extrabold tracking-tight">TaskHive</h1>
                    <p className="text-sm text-purple-200 mt-1">Your collaborative workspace</p>
                </div>
                <nav className="flex flex-wrap justify-center sm:justify-end gap-6 sm:gap-10">
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

            <main className="p-6 sm:p-10">
                <section className="bg-purple-50 rounded-2xl p-8 mb-12 shadow-inner border border-purple-100">
                    <p className="text-lg font-semibold text-gray-700 mb-1">Hello,</p>
                    <h2 className="text-4xl font-extrabold text-purple-800 tracking-tight mb-2">
                        {user?.displayName || (user?.email ? user.email.split('@')[0] : 'Guest')}
                    </h2>
                    <div className="flex items-center space-x-4">
                        <span className="text-gray-600 font-medium text-md">
                            {user?.email || 'No email available'}
                        </span>
                    </div>
                </section>

                {/* Overall Efficiency Section */}
                <section className="bg-gradient-to-br from-purple-50 to-indigo-50 p-8 rounded-2xl shadow-xl border border-purple-200 mb-12">
                    <h3 className="font-bold mb-6 text-2xl text-purple-800">MY TASK</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-lg font-medium">
                        <div className="bg-white p-4 rounded-xl shadow-md flex justify-between items-center">
                            <span>Total Tasks:</span>
                            <span className="text-purple-600 font-bold text-2xl">{totalTasks}</span>
                        </div>
                        <div className="bg-white p-4 rounded-xl shadow-md flex justify-between items-center">
                            <span>Completed Tasks:</span>
                            <span className="text-green-600 font-bold text-2xl">{completedTasks}</span>
                        </div>
                        <div className="bg-white p-4 rounded-xl shadow-md flex justify-between items-center">
                            <span>Overdue Tasks:</span>
                            <span className="text-red-600 font-bold text-2xl">{overdueTasks}</span>
                        </div>
                    </div>
                </section>


                <section className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                    <div className="bg-gradient-to-br from-purple-50 to-indigo-50 p-8 rounded-2xl shadow-xl border border-purple-200">
                        <h3 className="font-bold mb-6 text-2xl text-purple-800">Create New Room</h3>
                        <div className="space-y-5">
                            <input
                                type="text"
                                value={roomName}
                                onChange={(e) => setRoomName(e.target.value)}
                                className="w-full bg-white border border-gray-300 rounded-xl px-5 py-3 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-purple-400 focus:border-purple-400 outline-none transition duration-200 text-lg shadow-sm"
                                placeholder="e.g., Marketing Campaign Hub"
                                aria-label="Room name"
                            />
                            <button
                                onClick={handleCreateRoom}
                                disabled={isLoadingCreate}
                                className="w-full bg-purple-600 text-white py-3 rounded-xl font-semibold text-lg hover:bg-purple-700 transition duration-300 ease-in-out shadow-lg focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-opacity-75 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoadingCreate ? (
                                    <svg className="animate-spin h-5 w-5 text-white mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                ) : (
                                    <>
                                        <span className="mr-2"></span> Create Room
                                    </>
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-8 rounded-2xl shadow-xl border border-blue-200">
                        <h3 className="font-bold mb-6 text-2xl text-indigo-800">Join Existing Room</h3>
                        <div className="space-y-5">
                            <input
                                type="text"
                                value={roomId}
                                onChange={(e) => setRoomId(e.target.value)}
                                className="w-full bg-white border border-gray-300 rounded-xl px-5 py-3 text-gray-800 placeholder-gray-400 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none transition duration-200 text-lg shadow-sm"
                                placeholder="Enter Room ID to join"
                                aria-label="Room ID"
                            />
                            <button
                                onClick={handleJoinRoom}
                                disabled={isLoadingJoin}
                                className="w-full bg-indigo-600 text-white py-3 rounded-xl font-semibold text-lg hover:bg-indigo-700 transition duration-300 ease-in-out shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-opacity-75 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoadingJoin ? (
                                    <svg className="animate-spin h-5 w-5 text-white mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                ) : (
                                    <>
                                        <span className="mr-2"></span> Join Room
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </section>

                <section>
                    <h2 className="text-3xl font-bold mb-8 text-purple-800">My Rooms</h2>
                    {rooms.length === 0 ? (
                        <p className="text-gray-500 text-lg text-center py-12 bg-gray-50 rounded-xl shadow-inner border border-gray-200">
                            You haven't joined any rooms yet. Start by creating or joining one!
                        </p>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {rooms.map((room) => (
                                <div
                                    key={room.id}
                                    className="bg-white border border-purple-200 p-6 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-2 relative overflow-hidden group"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-br from-purple-50 to-indigo-50 opacity-0 group-hover:opacity-100 rounded-2xl transition-opacity duration-300 pointer-events-none"></div>
                                    <h3 className="text-2xl font-bold text-purple-700 mb-3 relative z-10">{room.roomName}</h3>
                                    <p className="text-sm text-gray-600 mb-2 relative z-10">
                                        <span className="font-semibold text-purple-600">Created by:</span> {room.createdBy}
                                    </p>
                                    <p className="text-sm text-gray-600 mb-4 relative z-10">
                                        <span className="font-semibold text-purple-600">Room ID:</span>{' '}
                                        <code className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-xs select-all font-mono">
                                            {room.id}
                                        </code>
                                    </p>
                                    <p className="text-xs text-gray-500 mb-5 truncate relative z-10">
                                        <span className="font-semibold text-purple-600">Members:</span>{' '}
                                        {room.members && room.members.length > 0
                                            ? room.members.map(member =>
                                                typeof member === 'string' ? member : member.email
                                            ).join(', ')
                                            : 'No members yet'}
                                    </p>
                                    <div className="flex flex-wrap gap-3 relative z-10">
                                        <button
                                            onClick={() => navigate(`/room/${room.id}`)}
                                            className="bg-purple-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-purple-700 transition duration-300 shadow-md transform hover:scale-105"
                                        >
                                            View Room
                                        </button>
                                        {room.createdBy === user?.email && (
                                            <>
                                                <button
                                                    onClick={() => handleEditRoomName(room)}
                                                    className="bg-yellow-500 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-yellow-600 transition duration-300 shadow-md transform hover:scale-105"
                                                >
                                                    Edit Name
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteRoom(room.id)}
                                                    className="bg-red-500 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-red-600 transition duration-300 shadow-md transform hover:scale-105"
                                                >
                                                    Delete
                                                </button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </main>
        </div>
    );
}