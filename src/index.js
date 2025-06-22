import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import SignUp from './pages/SignUp';
import TaskBoard from './pages/TaskBoard';
import RoomDetails from './pages/RoomDetails';
import MyTasks from './pages/MyTasks';
import CalendarView from './pages/CalendarView';
import ProjectDetail from './pages/ProjectDetail';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/room/:roomId" element={<RoomDetails />} />
        <Route path="/roomdetails/:roomId" element={<RoomDetails />} />
        <Route path="/mytasks" element={<MyTasks />} />
        <Route path="/calendar" element={<CalendarView />} />
        <Route path="/room/:roomId/project/:projectId" element={<ProjectDetail />} />
        <Route path="/room/:roomId/project/:projectId/taskboard" element={<TaskBoard />} />
        <Route path="/taskboard" element={<TaskBoard />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
