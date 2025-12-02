
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { ShieldCheck, ArrowRight, FileText, Lock, AlertCircle, Loader2, LogOut } from 'lucide-react';
import { verifyPassword } from '../utils/crypto';
import { supabase } from '../utils/supabase';

interface LoginProps {
  onLogin: (user: User) => void;
  users: User[];
}

export const Login: React.FC<LoginProps> = ({ onLogin, users }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  
  // Security State
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('');

  // Concurrent Login Handling
  const [showForceLogout, setShowForceLogout] = useState(false);
  const [pendingUser, setPendingUser] = useState<User | null>(null);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (lockoutUntil) return;
    setIsVerifying(true);
    setError('');
    setShowForceLogout(false);

    // Find user by email first
    const user = users.find(u => u.email === email && u.isActive);
    
    let isValid = false;

    if (user && user.password && user.salt) {
        // Securely verify password
        isValid = await verifyPassword(password, user.password, user.salt);
    }

    if (isValid && user) {
      // Success: Check if already logged in
      if (user.isLoggedIn) {
          setPendingUser(user);
          setShowForceLogout(true);
          setError("User already logged in on another device.");
      } else {
          // Reset security counters
          setFailedAttempts(0);
          setLockoutUntil(null);
          localStorage.removeItem('login_failed_attempts');
          localStorage.removeItem('login_lockout_until');
          onLogin(user);
      }
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
    setIsVerifying(false);
  };

  const handleForceLogout = async () => {
      if (!pendingUser) return;
      setIsVerifying(true);
      try {
          // 1. Force set is_logged_in to false in DB (Kick old session)
          await supabase.from('users').update({ is_logged_in: false }).eq('id', pendingUser.id);
          
          // 2. Proceed to Login IMMEDIATELY (Don't ask user to click Sign In again)
          // We manually reset the flag for the local object passed to onLogin
          const userToLogin = { ...pendingUser, isLoggedIn: false };
          
          setFailedAttempts(0);
          setLockoutUntil(null);
          localStorage.removeItem('login_failed_attempts');
          localStorage.removeItem('login_lockout_until');
          
          // Triggers App.tsx handleLogin, which sets is_logged_in = true for this new session
          onLogin(userToLogin);

      } catch (err) {
          console.error(err);
          setError("Failed to force logout. Please try again.");
          setIsVerifying(false); // Only stop loading if error
      }
  };

  const isLocked = !!lockoutUntil;

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-2xl shadow-xl w-full max-w-4xl flex overflow-hidden border border-gray-700">
        
        {/* Left Side: Form */}
        <div className="w-full md:w-1/2 p-10 flex flex-col justify-center relative bg-gray-800 z-10">
          
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
            <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center mb-4 border border-blue-500">
               <FileText className="text-white w-6 h-6" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">BJMP8 D.O.C.S</h1>
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
                disabled={isLocked || isVerifying}
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
                disabled={isLocked || isVerifying}
              />
            </div>

            {error && !isLocked && (
              <div className={`flex items-center space-x-2 text-sm p-3 rounded-lg border ${showForceLogout ? 'text-orange-400 bg-orange-900/20 border-orange-800' : 'text-red-400 bg-red-900/20 border-red-800'}`}>
                 <AlertCircle className="w-4 h-4 flex-shrink-0" />
                 <span>{error}</span>
              </div>
            )}

            {!showForceLogout ? (
                <button
                type="submit"
                disabled={isLocked || isVerifying}
                className="w-full bg-blue-600 hover:bg-blue-700 border border-blue-500 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center group disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-blue-600"
                >
                {isVerifying ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    <>
                        <span>Sign In</span>
                        <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </>
                )}
                </button>
            ) : (
                <button
                type="button"
                onClick={handleForceLogout}
                disabled={isVerifying}
                className="w-full bg-orange-600 hover:bg-orange-700 border border-orange-500 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center group disabled:opacity-50"
                >
                {isVerifying ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                    <>
                        <LogOut className="w-4 h-4 mr-2" />
                        <span>Force Logout Other Session</span>
                    </>
                )}
                </button>
            )}
          </form>
        </div>

        {/* Right Side: Visual (Abstract Shapes) */}
        <div className="hidden md:flex w-1/2 bg-blue-900/20 relative overflow-hidden flex-col justify-between p-10 text-white border-l border-gray-700">
          <div className="absolute inset-0 bg-blue-900 opacity-90"></div>
          <div className="absolute inset-0 opacity-20">
             <div className="absolute -right-10 -top-10 w-64 h-64 rounded-full border-4 border-blue-400"></div>
             <div className="absolute -left-10 bottom-10 w-32 h-32 rounded-full bg-blue-500"></div>
          </div>
          
          <div className="relative z-10 h-full flex flex-col justify-between">
            <div>
              <h2 className="text-3xl font-bold mb-4 drop-shadow-md">Streamline Your Document Workflow</h2>
              <p className="text-blue-100 leading-relaxed drop-shadow-sm font-medium">
                A simple Document Tracking System Developed by BJMPRO8 RICTMD TEAM.
              </p>
            </div>
            <div className="flex items-center space-x-2 text-sm text-blue-200 bg-blue-900/50 p-3 rounded-lg backdrop-blur-sm border border-blue-700 w-fit">
              <ShieldCheck className="w-5 h-5 text-blue-400" />
              <span>Enterprise Grade Security</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
