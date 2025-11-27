import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { ShieldCheck, ArrowRight, FileText, Lock, AlertCircle } from 'lucide-react';

interface LoginProps {
  onLogin: (user: User) => void;
  users: User[];
}

export const Login: React.FC<LoginProps> = ({ onLogin, users }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  
  // Security State
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('');

  // Initialize state from local storage on load
  useEffect(() => {
    const storedAttempts = localStorage.getItem('login_failed_attempts');
    const storedLockout = localStorage.getItem('login_lockout_until');

    if (storedAttempts) {
      setFailedAttempts(parseInt(storedAttempts, 10));
    }

    if (storedLockout) {
      const lockoutTime = parseInt(storedLockout, 10);
      if (lockoutTime > Date.now()) {
        setLockoutUntil(lockoutTime);
        setError('Access restricted due to multiple failed attempts.');
      } else {
        // Clear expired lockout
        localStorage.removeItem('login_lockout_until');
        localStorage.removeItem('login_failed_attempts');
        setFailedAttempts(0);
      }
    }
  }, []);

  // Timer for countdown
  useEffect(() => {
    let interval: number;
    if (lockoutUntil) {
      interval = window.setInterval(() => {
        const now = Date.now();
        const diff = lockoutUntil - now;

        if (diff <= 0) {
          // Lockout finished
          setLockoutUntil(null);
          setFailedAttempts(0);
          setError('');
          setTimeLeft('');
          localStorage.removeItem('login_lockout_until');
          localStorage.removeItem('login_failed_attempts');
        } else {
          // Update timer string
          const minutes = Math.floor(diff / 60000);
          const seconds = Math.floor((diff % 60000) / 1000);
          setTimeLeft(`${minutes}:${seconds.toString().padStart(2, '0')}`);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [lockoutUntil]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (lockoutUntil) return;

    // Find user matching email, password, and active status
    const user = users.find(u => 
      u.email === email && 
      u.password === password && 
      u.isActive
    );
    
    if (user) {
      // Success: Reset security counters
      setFailedAttempts(0);
      setLockoutUntil(null);
      localStorage.removeItem('login_failed_attempts');
      localStorage.removeItem('login_lockout_until');
      onLogin(user);
    } else {
      // Failed Attempt
      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      localStorage.setItem('login_failed_attempts', newAttempts.toString());

      if (newAttempts >= 3) {
        // Trigger 5-minute lockout
        const lockoutTime = Date.now() + 5 * 60 * 1000; // 5 minutes in ms
        setLockoutUntil(lockoutTime);
        localStorage.setItem('login_lockout_until', lockoutTime.toString());
        setError('Too many failed attempts.');
      } else {
        setError(`Invalid email or password. ${3 - newAttempts} attempt(s) remaining.`);
      }
    }
  };

  const isLocked = !!lockoutUntil;

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-2xl shadow-xl w-full max-w-4xl flex overflow-hidden border border-gray-700">
        
        {/* Left Side: Form */}
        <div className="w-full md:w-1/2 p-10 flex flex-col justify-center relative">
          
          {/* Lockout Overlay */}
          {isLocked && (
             <div className="absolute inset-0 bg-gray-800/90 z-20 flex flex-col items-center justify-center p-8 text-center backdrop-blur-sm">
                <div className="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center mb-4 border border-red-800 animate-pulse">
                    <Lock className="w-8 h-8 text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Login Restricted</h3>
                <p className="text-gray-400 text-sm mb-6">
                    Too many consecutive failed attempts. For security reasons, please wait before trying again.
                </p>
                <div className="text-2xl font-mono font-bold text-red-400 bg-gray-900 px-6 py-2 rounded-lg border border-gray-700">
                    {timeLeft}
                </div>
             </div>
          )}

          <div className="mb-8">
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-4">
               <FileText className="text-white w-6 h-6" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Welcome Back</h1>
            <p className="text-gray-400">Please enter your details to sign in.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-white placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="admin@doctrack.com"
                required
                disabled={isLocked}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-white placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed"
                placeholder="••••••••"
                required
                disabled={isLocked}
              />
            </div>

            {error && !isLocked && (
              <div className="flex items-center space-x-2 text-red-400 text-sm bg-red-900/20 p-3 rounded-lg border border-red-800">
                 <AlertCircle className="w-4 h-4 flex-shrink-0" />
                 <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLocked}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
            >
              <span>Sign In</span>
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
            </button>
          </form>
        </div>

        {/* Right Side: Visual */}
        <div className="hidden md:block w-1/2 bg-blue-900 relative overflow-hidden p-10 text-white">
          <div className="absolute inset-0 bg-blue-900 opacity-90"></div>
          <div className="absolute inset-0 opacity-20">
             <div className="absolute -right-10 -top-10 w-64 h-64 rounded-full border-4 border-white/20"></div>
             <div className="absolute -left-10 bottom-10 w-32 h-32 rounded-full bg-white/10"></div>
          </div>
          <div className="relative z-10 h-full flex flex-col justify-between">
            <div>
              <h2 className="text-3xl font-bold mb-4">Streamline Your Document Workflow</h2>
              <p className="text-blue-100 leading-relaxed">
                A simple Document Tracking System Developed by MACS.
              </p>
            </div>
            <div className="flex items-center space-x-2 text-sm text-blue-200">
              <ShieldCheck className="w-5 h-5" />
              <span>Enterprise Grade Security</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};