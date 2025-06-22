import React, { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useNavigate, Link } from 'react-router-dom';

// --- Reusable Modal Component ---
const MessageModal = ({ message, type, onClose }) => {
    if (!message) return null;

    // Define background and text colors based on message type
    let bgColor = '';
    let textColor = '';

    if (type === 'success') {
        bgColor = 'bg-white'; // Changed to white for success
        textColor = 'text-gray-800'; // Changed text to dark for white background
    } else { // type === 'error'
        bgColor = 'bg-red-500';
        textColor = 'text-white';
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
            <div className={`${bgColor} ${textColor} px-6 py-4 rounded-lg shadow-xl text-center max-w-sm w-full relative`}>
                <p className="font-medium">{message}</p>
                {/* Optional: Add a close button for errors, but typically modals close automatically */}
                {type === 'error' && (
                    <button
                        onClick={onClose}
                        className="absolute top-2 right-3 text-white text-xl font-bold"
                    >
                        &times;
                    </button>
                )}
            </div>
        </div>
    );
};

const SignUp = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);

    // State for modal messages (success/error)
    const [modalMessage, setModalMessage] = useState('');
    const [modalType, setModalType] = useState(''); // 'success' or 'error'

    // States for password strength feedback
    const [passwordLength, setPasswordLength] = useState(false);
    const [passwordLowercase, setPasswordLowercase] = useState(false);
    const [passwordUppercase, setPasswordUppercase] = useState(false);
    const [passwordNumber, setPasswordNumber] = useState(false);
    const [passwordSpecialChar, setPasswordSpecialChar] = useState(false);

    const navigate = useNavigate();

    // Effect to auto-close modals
    React.useEffect(() => {
        if (modalMessage) {
            const timer = setTimeout(() => {
                setModalMessage('');
                setModalType('');
            }, modalType === 'success' ? 2000 : 4000); // Shorter for success, longer for errors
            return () => clearTimeout(timer);
        }
    }, [modalMessage, modalType]);

    const handlePasswordChange = (e) => {
        const newPassword = e.target.value;
        setPassword(newPassword);

        // Update password strength feedback
      setPasswordLength(newPassword.length >= 8); // ✅ At least 8 characters
      setPasswordLowercase(/[a-z]/.test(newPassword)); // ✅ lowercase letter
      setPasswordUppercase(/[A-Z]/.test(newPassword)); // ✅ uppercase letter
      setPasswordNumber(/[0-9]/.test(newPassword));    // ✅ number
      setPasswordSpecialChar(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(password)); // ✅ special char

    };

    const isPasswordStrong = passwordLength && passwordLowercase && passwordUppercase && passwordNumber && passwordSpecialChar;

    const handleSignUp = async (e) => {
        e.preventDefault();
        setLoading(true);
        setModalMessage(''); // Clear previous messages

        if (!isPasswordStrong) {
            setModalMessage('Password does not meet all requirements.');
            setModalType('error');
            setLoading(false);
            return;
        }

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            await setDoc(doc(db, 'users', user.uid), { // Use user.uid instead of auth.currentUser.uid here
                email,
                createdAt: new Date()
            });

            setModalMessage('Account created successfully!');
            setModalType('success');
            setTimeout(() => {
                navigate('/'); // Redirect to login after successful signup
            }, 2000);
        } catch (error) {
            let errorMessage = "Sign up failed: " + error.message;
            if (error.code === 'email already in use') {
                errorMessage = 'The email address is already in use by another account.';
            } else if (error.code === 'invalid email') {
                errorMessage = 'The email address is not valid.';
            } else if (error.code === 'operation not allowed') {
                errorMessage = 'Email/password accounts are not enabled. Please contact support.';
            }
            setModalMessage(errorMessage);
            setModalType('error');
        } finally {
            setLoading(false);
        }
    };

    const getCheckIcon = (condition) => (
        condition
            ? <span className="text-green-500 mr-2">✅</span>
            : <span className="text-red-500 mr-2">❌</span>
    );

    return (
        <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-[#eef1f6] to-[#fefefe] px-4">
            <form
                onSubmit={handleSignUp}
                className="w-full max-w-sm bg-white p-10 rounded-xl shadow-2xl border border-gray-100 z-10"
            >
                <h2 className="text-2xl font-bold text-center text-[#3b0a34] mb-6">Create TaskHive Account</h2>

                <label className="block text-sm text-gray-700 mb-1">Email</label>
                <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="example@mail.com"
                    className="w-full px-4 py-2 mb-4 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3b0a34]"
                    required
                />

                <label className="block text-sm text-gray-700 mb-1">Password</label>
                <input
                    type="password"
                    value={password}
                    onChange={handlePasswordChange} // Use new handler
                    placeholder="Min 8 characters, with special chars"
                    className="w-full px-4 py-2 mb-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#3b0a34]"
                    required
                />

                {/* Password Strength Feedback */}
                <div className="text-xs text-gray-600 mb-4">
                    <p>{getCheckIcon(passwordLength)} At least 8 characters</p>
                    <p>{getCheckIcon(passwordLowercase)} Contains a lowercase letter</p>
                    <p>{getCheckIcon(passwordUppercase)} Contains an uppercase letter</p>
                    <p>{getCheckIcon(passwordNumber)} Contains a number</p>
                    <p>{getCheckIcon(passwordSpecialChar)} Contains a special character (!@#$%^&*_+-=)</p>
                </div>

                <button
                    type="submit"
                    disabled={loading || !isPasswordStrong} // Disable if password isn't strong
                    className={`w-full py-2 bg-[#3b0a34] text-white font-semibold rounded-md transition duration-200 ${
                        loading || !isPasswordStrong ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#5a134f]'
                    }`}
                >
                    {loading ? 'Creating...' : 'Sign Up'}
                </button>

                <p className="text-sm text-center text-gray-500 mt-4">
                    Already have an account?{' '}
                    <Link to="/" className="text-[#3b0a34] hover:underline font-medium">
                        Login
                    </Link>
                </p>
            </form>

            {/* Use the new MessageModal component */}
            <MessageModal
                message={modalMessage}
                type={modalType}
                onClose={() => { setModalMessage(''); setModalType(''); }}
            />
        </div>
    );
};

export default SignUp;