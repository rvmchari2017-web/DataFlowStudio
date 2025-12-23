import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Activity, Lock, User, AlertCircle, ArrowRight } from 'lucide-react';
import { workflowAPI } from '../utils/api';

const LoginPage = () => {
  const navigate = useNavigate();
  const [isSignup, setIsSignup] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setIsLoading(true);

    try {
      if (isSignup) {
        await workflowAPI.signup({ username, password });
        setSuccessMsg("Account created! Please log in.");
        setIsSignup(false); // Switch to login view
      } else {
        const data = await workflowAPI.login({ username, password });
        localStorage.setItem('isAuthenticated', 'true');
        localStorage.setItem('userId', data.user_id); // Save User ID
        localStorage.setItem('username', data.username);
        navigate('/dashboard');
      }
    } catch (err: any) {
        const msg = err.response?.data?.detail || "Connection failed.";
        setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] flex items-center justify-center p-4">
      <div className="bg-[#1e293b] border border-gray-700 p-8 rounded-2xl shadow-2xl w-full max-w-md">
        
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="bg-blue-600/20 p-3 rounded-full">
              <Activity className="w-8 h-8 text-blue-500" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white">DataFlow Studio</h1>
          <p className="text-gray-400 text-sm mt-2">
            {isSignup ? "Create your account to start building" : "Welcome back, Analyst"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Username</label>
            <div className="relative">
              <User className="absolute left-3 top-3 text-gray-500" size={18} />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-[#020617] border border-gray-700 text-white rounded-lg py-2.5 pl-10 pr-4 focus:border-blue-500 outline-none transition-colors"
                placeholder="Enter username"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 text-gray-500" size={18} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#020617] border border-gray-700 text-white rounded-lg py-2.5 pl-10 pr-4 focus:border-blue-500 outline-none transition-colors"
                placeholder="••••••••"
                required
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-900/20 p-3 rounded border border-red-900/50">
              <AlertCircle size={16} /> <span>{error}</span>
            </div>
          )}
          
          {successMsg && (
            <div className="text-green-400 text-sm bg-green-900/20 p-3 rounded border border-green-900/50 text-center">
              {successMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isLoading ? 'Processing...' : (isSignup ? 'Create Account' : 'Login')}
            {!isLoading && <ArrowRight size={16} />}
          </button>
        </form>

        <div className="mt-6 text-center pt-6 border-t border-gray-700">
          <p className="text-sm text-gray-400">
            {isSignup ? "Already have an account? " : "Don't have an account? "}
            <button 
                onClick={() => { setIsSignup(!isSignup); setError(''); setSuccessMsg(''); }} 
                className="text-blue-400 hover:text-blue-300 font-bold hover:underline"
            >
                {isSignup ? "Login" : "Sign Up"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;