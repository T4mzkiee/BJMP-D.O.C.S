import React, { useState } from 'react';
import { User } from '../types';
import { User as UserIcon, Key, Save } from 'lucide-react';
import { generateSalt, hashPassword, verifyPassword } from '../utils/crypto';
import { supabase } from '../utils/supabase';

interface AccountProps {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  currentUser: User;
}

export const AccountPage: React.FC<AccountProps> = ({ users, setUsers, currentUser }) => {
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const handleUpdatePassword = async () => {
    // 1. Get the latest user object
    const freshUser = users.find(u => u.id === currentUser.id);
    if (!freshUser || !freshUser.password || !freshUser.salt) {
        alert("Error retrieving user security details.");
        return;
    }

    // 2. Validate inputs
    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
        alert("Please fill in all fields.");
        return;
    }

    // Verify current password securely
    const isCurrentValid = await verifyPassword(passwordData.currentPassword, freshUser.password, freshUser.salt);
    if (!isCurrentValid) {
        alert("Incorrect current password.");
        return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
        alert("New passwords do not match.");
        return;
    }

    if (passwordData.newPassword.length < 6) {
        alert("New password must be at least 6 characters long.");
        return;
    }

    // 3. Update User with new Hash and Salt
    const newSalt = generateSalt();
    const newHash = await hashPassword(passwordData.newPassword, newSalt);

    setUsers(prev => prev.map(u => 
        u.id === currentUser.id ? { ...u, password: newHash, salt: newSalt } : u
    ));
    
    // Sync Supabase
    await supabase.from('users').update({ password: newHash, salt: newSalt }).eq('id', currentUser.id);

    alert("Password updated successfully!");
    setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Account Settings</h1>
        <p className="text-sm text-gray-400">Manage your profile details and security.</p>
      </div>

      <div className="bg-gray-800 rounded-xl shadow-sm border border-gray-700 overflow-hidden">
        <div className="p-8 max-w-2xl">
            <div className="space-y-8">
                {/* Profile Summary */}
                <div className="bg-gray-700/50 rounded-lg p-6 flex items-center space-x-6 border border-gray-600">
                    <div className="w-20 h-20 rounded-full bg-gray-600 flex items-center justify-center overflow-hidden border-2 border-gray-500">
                        <img src={currentUser.avatarUrl} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-white">{currentUser.name}</h3>
                        <p className="text-gray-400 flex items-center mt-1">
                            <UserIcon className="w-4 h-4 mr-1" />
                            {currentUser.role}
                        </p>
                        <div className="mt-3 inline-flex px-3 py-1 bg-blue-900/40 text-blue-300 rounded border border-blue-800 text-sm">
                            {currentUser.department}
                        </div>
                    </div>
                </div>

                {/* Password Change Form */}
                <div className="bg-gray-700/30 rounded-lg p-6 border border-gray-600">
                    <div className="flex items-center space-x-2 mb-6 border-b border-gray-600 pb-4">
                        <Key className="w-5 h-5 text-yellow-500" />
                        <h3 className="text-lg font-bold text-white">Change Password</h3>
                    </div>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Current Password</label>
                            <input
                                type="password"
                                value={passwordData.currentPassword}
                                onChange={e => setPasswordData({...passwordData, currentPassword: e.target.value})}
                                className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                placeholder="Enter current password"
                            />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">New Password</label>
                                <input
                                    type="password"
                                    value={passwordData.newPassword}
                                    onChange={e => setPasswordData({...passwordData, newPassword: e.target.value})}
                                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="New password"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Confirm New Password</label>
                                <input
                                    type="password"
                                    value={passwordData.confirmPassword}
                                    onChange={e => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                                    className="w-full bg-gray-800 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="Confirm new password"
                                />
                            </div>
                        </div>
                        
                        <div className="pt-4 flex justify-end">
                            <button
                                onClick={handleUpdatePassword}
                                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center transition-colors"
                            >
                                <Save className="w-4 h-4 mr-2" />
                                Update Password
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};