import React, { useState } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth'; // Import sendPasswordResetEmail
import { auth, db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false); // New state for forgot password form
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState(''); // New state for forgot password email input
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      // const uid = userCredential.user.uid; // Not directly used after login, but kept if you need it later
      // const userDoc = await getDoc(doc(db, 'users', uid)); // Not directly used after login, but kept if you need it later
      // const userData = userDoc.data(); // Not directly used after login, but kept if you need it later
      setModalMessage('Login successful!');
      setShowModal(true);
      setTimeout(() => {
        setShowModal(false);
        navigate('/dashboard');
      }, 1500);
    } catch (error) {
      setModalMessage('Login failed: ' + error.message);
      setShowModal(true);
      setTimeout(() => setShowModal(false), 3000);
    } finally {
      setLoading(false);
    }
  };

  // --- New Function: Handle Forgot Password ---
  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setLoading(true); // Set loading for the password reset process
    try {
      await sendPasswordResetEmail(auth, forgotPasswordEmail);
      setModalMessage('Password reset email sent! Check your inbox.');
      setShowModal(true);
      setShowForgotPassword(false); // Hide the forgot password form
      setForgotPasswordEmail(''); // Clear the email input
      setTimeout(() => setShowModal(false), 3000);
    } catch (error) {
      setModalMessage('Failed to send reset email: ' + error.message);
      setShowModal(true);
      setTimeout(() => setShowModal(false), 3000);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-[#eef1f6] to-[#fefefe] px-4 relative">
      {/* Modal */}
      {showModal && (
        <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-black bg-opacity-40 z-50">
          <div className="bg-white px-6 py-4 rounded-lg shadow-xl text-center max-w-sm w-full">
            <p className="text-gray-800 font-medium">{modalMessage}</p>
          </div>
        </div>
      )}
      {/* Login Form */}
      {!showForgotPassword ? ( // Conditionally render login form or forgot password form
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm bg-white p-10 rounded-xl shadow-2xl border border-gray-100 z-10"
        >
          <h2 className="text-2xl font-bold text-center text-[#3b0a34] mb-6">TaskHive Login</h2>
          <label className="block text-sm text-gray-700 mb-1">Email</label>
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full px-4 py-2 mb-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3b0a34]"
            required
          />
          <label className="block text-sm text-gray-700 mb-1">Password</label>
          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full px-4 py-2 mb-6 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3b0a34]"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2 bg-[#3b0a34] text-white font-semibold rounded-md transition duration-200 ${
              loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#5a134f]'
            }`}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>
          <p className="text-sm text-center text-gray-500 mt-4">
            <button
              type="button" // Important: set type="button" to prevent form submission
              onClick={() => setShowForgotPassword(true)}
              className="text-[#3b0a34] hover:underline font-medium"
            >
              Forgot Password?
            </button>
          </p>
          <p className="text-sm text-center text-gray-500 mt-2">
            Don’t have an account?{' '}
            <Link to="/signup" className="text-[#3b0a34] hover:underline font-medium">
              Sign up
            </Link>
          </p>
        </form>
      ) : (
        // --- Forgot Password Form ---
        <form
          onSubmit={handleForgotPassword}
          className="w-full max-w-sm bg-white p-10 rounded-xl shadow-2xl border border-gray-100 z-10"
        >
          <h2 className="text-2xl font-bold text-center text-[#3b0a34] mb-6">Reset Password</h2>
          <label className="block text-sm text-gray-700 mb-1">Enter your email</label>
          <input
            type="email"
            placeholder="Email address"
            value={forgotPasswordEmail}
            onChange={e => setForgotPasswordEmail(e.target.value)}
            className="w-full px-4 py-2 mb-6 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3b0a34]"
            required
          />
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2 bg-[#3b0a34] text-white font-semibold rounded-md transition duration-200 ${
              loading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#5a134f]'
            }`}
          >
            {loading ? 'Sending...' : 'Send Reset Email'}
          </button>
          <p className="text-sm text-center text-gray-500 mt-4">
            <button
              type="button"
              onClick={() => setShowForgotPassword(false)}
              className="text-[#3b0a34] hover:underline font-medium"
            >
              Back to Login
            </button>
          </p>
        </form>
      )}
    </div>
  );
};

export default Login;