
import React, { useState, useRef } from 'react';
import { User, Role } from '../types';
import { Plus, Edit2, Trash2, Ban, CheckCircle, Search, Key, AlertTriangle, X, Upload, Camera, Lock, Save } from 'lucide-react';
import { generateSalt, hashPassword, uuid } from '../utils/crypto';
import { supabase, mapUserToDB } from '../utils/supabase';

interface UsersProps {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  currentUser: User;
}

const BJMP_OFFICES = [
  'ORD', 'ARDA', 'ARDO', 'RCDS', 'RPRMD', 'RHRDD', 'RLOGS', 'RSAO', 'ROPNS',
  'RHSD', 'RCOMP', 'RID', 'RIPD', 'LSD', 'DWD', 'RICTMD', 'RPDD', 'RSBAS',
  'RCRDS', 'FSS', 'ASS', 'CRS', 'CHP'
];

export const UsersPage: React.FC<UsersProps> = ({ users, setUsers, currentUser }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; user: User | null; type: 'toggle' | 'delete' }>({ 
    isOpen: false, 
    user: null,
    type: 'toggle' 
  });

  const [passwordModal, setPasswordModal] = useState<{ isOpen: boolean; user: User | null }>({
    isOpen: false,
    user: null
  });
  const [passwordForm, setPasswordForm] = useState({ newPassword: '', confirmPassword: '' });

  const [formData, setFormData] = useState<Partial<User>>({
    name: '',
    email: '',
    department: '',
    role: Role.USER,
    isActive: true,
    password: '',
    avatarUrl: ''
  });

  const handleOpenModal = (user?: User) => {
    if (user) {
      setEditingUser(user);
      setFormData(user);
    } else {
      setEditingUser(null);
      setFormData({
        name: '',
        email: '',
        department: BJMP_OFFICES[0], 
        role: Role.USER,
        isActive: true,
        password: '',
        avatarUrl: `https://picsum.photos/200/200?random=${Math.floor(Math.random() * 1000)}` 
      });
    }
    setIsModalOpen(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const imageUrl = URL.createObjectURL(file);
      setFormData(prev => ({ ...prev, avatarUrl: imageUrl }));
    }
  };

  const handleSave = async () => {
    if (!editingUser && !formData.password) {
        alert("Password is required for new users.");
        return;
    }

    if (!formData.name || !formData.email) {
      alert("Please fill in required fields (Name, Email)");
      return;
    }

    if (editingUser) {
      const updatedUser = { ...editingUser, ...formData } as User;
      setUsers(prev => prev.map(u => u.id === editingUser.id ? updatedUser : u));
      
      // Sync Supabase
      await supabase.from('users').update(mapUserToDB(updatedUser)).eq('id', editingUser.id);

    } else {
      const salt = generateSalt();
      const hashedPassword = await hashPassword(formData.password!, salt);

      const newUser: User = {
        id: uuid(),
        ...formData,
        password: hashedPassword,
        salt: salt
      } as User;
      
      setUsers(prev => [...prev, newUser]);
      
      // Sync Supabase
      await supabase.from('users').insert(mapUserToDB(newUser));
    }
    setIsModalOpen(false);
  };

  const initiateDelete = (user: User) => {
     setConfirmModal({ isOpen: true, user, type: 'delete' });
  };

  const initiateToggle = (user: User) => {
     setConfirmModal({ isOpen: true, user, type: 'toggle' });
  };

  const handleConfirmAction = async () => {
    const { user, type } = confirmModal;
    if (!user) return;

    if (type === 'delete') {
         setUsers(prev => prev.filter(u => u.id !== user.id));
         await supabase.from('users').delete().eq('id', user.id);
    } else if (type === 'toggle') {
         setUsers(prev => prev.map(u => u.id === user.id ? { ...u, isActive: !u.isActive } : u));
         await supabase.from('users').update({ is_active: !user.isActive }).eq('id', user.id);
    }
    setConfirmModal({ isOpen: false, user: null, type: 'toggle' });
  };

  const openPasswordModal = (user: User) => {
      setPasswordModal({ isOpen: true, user });
      setPasswordForm({ newPassword: '', confirmPassword: '' });
  };

  const handleSavePassword = async () => {
      if (!passwordForm.newPassword || !passwordForm.confirmPassword) {
          alert("Please fill in both fields.");
          return;
      }
      if (passwordForm.newPassword !== passwordForm.confirmPassword) {
          alert("Passwords do not match.");
          return;
      }
      
      if (passwordModal.user) {
          const salt = generateSalt(); 
          const hashedPassword = await hashPassword(passwordForm.newPassword, salt);

          setUsers(prev => prev.map(u => 
              u.id === passwordModal.user!.id ? { ...u, password: hashedPassword, salt: salt } : u
          ));

          await supabase.from('users').update({ password: hashedPassword, salt: salt }).eq('id', passwordModal.user.id);

          alert(`Password for ${passwordModal.user.name} updated successfully.`);
          setPasswordModal({ isOpen: false, user: null });
      }
  };

  const filteredUsers = users.filter(u => 
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">User Management</h1>
          <p className="text-sm text-gray-400">Manage system access and roles.</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="flex items-center space-x-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors shadow-sm border border-gray-600"
        >
          <Plus className="w-4 h-4" />
          <span>Add New User</span>
        </button>
      </div>

      <div className="bg-gray-800 rounded-xl shadow-sm border border-gray-700 overflow-hidden">
        <div className="p-4 border-b border-gray-700 bg-gray-900/30 flex items-center space-x-3">
            <Search className="w-4 h-4 text-gray-400" />
            <input 
                type="text" 
                placeholder="Search users..." 
                className="bg-transparent border-none outline-none text-sm w-full text-white placeholder-gray-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-700/50 text-gray-400 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">User</th>
                <th className="px-6 py-4 font-semibold">Role</th>
                <th className="px-6 py-4 font-semibold">Department</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filteredUsers.map(user => (
                <tr key={user.id} className="hover:bg-gray-700 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center space-x-3">
                      <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full bg-gray-600 object-cover" />
                      <div>
                        <p className="text-sm font-medium text-gray-100">{user.name}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      user.role === Role.ADMIN ? 'bg-gray-700 text-gray-300 border border-gray-600' : 'bg-gray-800 text-gray-400 border border-gray-700'
                    }`}>
                      {user.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300">{user.department}</td>
                  <td className="px-6 py-4">
                     <span className={`inline-flex items-center space-x-1 text-xs font-medium px-2 py-1 rounded-md border ${
                         user.isActive ? 'border-green-800 bg-green-900/50 text-green-300' : 'border-red-800 bg-red-900/50 text-red-300'
                     }`}>
                         {user.isActive ? <CheckCircle className="w-3 h-3"/> : <Ban className="w-3 h-3"/>}
                         <span>{user.isActive ? 'Active' : 'Inactive'}</span>
                     </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end space-x-2">
                       <button 
                        onClick={() => openPasswordModal(user)}
                        className="text-gray-400 hover:text-yellow-400 transition-colors p-1 rounded hover:bg-gray-600"
                        title="Change Password"
                      >
                        <Lock className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => initiateToggle(user)} 
                        disabled={user.id === currentUser.id}
                        className={`transition-colors p-1 rounded hover:bg-gray-600 ${user.isActive ? 'text-gray-400 hover:text-orange-400' : 'text-gray-400 hover:text-green-400'} ${user.id === currentUser.id ? 'opacity-30 cursor-not-allowed' : ''}`}
                        title={user.isActive ? "Deactivate Account" : "Activate Account"}
                      >
                         {user.isActive ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                      </button>
                      <button onClick={() => handleOpenModal(user)} className="text-gray-400 hover:text-blue-400 transition-colors p-1 rounded hover:bg-gray-600" title="Edit User">
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => initiateDelete(user)} 
                        disabled={user.id === currentUser.id}
                        className={`transition-colors p-1 rounded hover:bg-gray-600 ${user.id === currentUser.id ? 'text-gray-600 cursor-not-allowed' : 'text-gray-400 hover:text-red-400'}`}
                        title="Delete User"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit/Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6 border border-gray-700 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4 text-white">{editingUser ? 'Edit User' : 'Add New User'}</h2>
            
            <div className="flex justify-center mb-6">
                <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                    <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-gray-600 group-hover:border-gray-500 transition-colors">
                        <img 
                            src={formData.avatarUrl || `https://ui-avatars.com/api/?name=${formData.name || 'User'}`} 
                            alt="Profile" 
                            className="w-full h-full object-cover"
                        />
                    </div>
                    <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Camera className="w-8 h-8 text-white" />
                    </div>
                    <div className="absolute bottom-0 right-0 bg-gray-600 rounded-full p-1.5 border-2 border-gray-800">
                        <Upload className="w-3 h-3 text-white" />
                    </div>
                </div>
                <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleFileChange} 
                    className="hidden" 
                    accept="image/*"
                />
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Full Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none text-white"
                />
              </div>
              {!editingUser && (
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1 flex items-center">
                        <Key className="w-3 h-3 mr-1 text-gray-500" />
                        Initial Password
                    </label>
                    <input
                      type="text"
                      value={formData.password}
                      onChange={e => setFormData({ ...formData, password: e.target.value })}
                      className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none font-mono text-sm text-white"
                      placeholder="Set login password"
                    />
                  </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Department</label>
                    <select
                        value={formData.department}
                        onChange={e => setFormData({ ...formData, department: e.target.value })}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none text-white appearance-none"
                    >
                        {BJMP_OFFICES.map(office => (
                            <option key={office} value={office}>{office}</option>
                        ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Role</label>
                    <select
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value as Role })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-500 focus:border-gray-500 outline-none text-white"
                    >
                        <option value={Role.USER}>User</option>
                        <option value={Role.ADMIN}>Admin</option>
                    </select>
                  </div>
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-gray-400 hover:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 border border-gray-600"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmModal.isOpen && confirmModal.user && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-gray-800 rounded-xl shadow-xl w-full max-w-sm p-6 relative border border-gray-700">
                 <button 
                    onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                    className="absolute top-4 right-4 text-gray-500 hover:text-gray-300"
                >
                    <X className="w-5 h-5" />
                </button>
                <div className="flex flex-col items-center text-center">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${confirmModal.type === 'delete' ? 'bg-red-900/30 text-red-500' : 'bg-orange-900/30 text-orange-500'}`}>
                        <AlertTriangle className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">
                        {confirmModal.type === 'delete' ? 'Delete User?' : 
                         confirmModal.user.isActive ? 'Deactivate Account?' : 'Activate Account?'}
                    </h3>
                    <p className="text-sm text-gray-400 mb-6">
                        {confirmModal.type === 'delete' 
                            ? `Are you sure you want to permanently delete ${confirmModal.user.name}? This action cannot be undone.`
                            : `Are you sure you want to ${confirmModal.user.isActive ? 'deactivate' : 'activate'} access for ${confirmModal.user.name}?`
                        }
                    </p>
                    <div className="flex space-x-3 w-full">
                        <button
                            onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
                            className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirmAction}
                            className={`flex-1 px-4 py-2 text-white rounded-lg font-medium ${
                                confirmModal.type === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-600 hover:bg-gray-500'
                            }`}
                        >
                            Confirm
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Change Password Modal */}
      {passwordModal.isOpen && passwordModal.user && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-gray-800 rounded-xl shadow-xl w-full max-w-sm p-6 relative border border-gray-700">
                 <button 
                    onClick={() => setPasswordModal({ isOpen: false, user: null })}
                    className="absolute top-4 right-4 text-gray-500 hover:text-gray-300"
                >
                    <X className="w-5 h-5" />
                </button>
                <div className="flex items-center space-x-3 mb-6">
                    <div className="bg-yellow-900/30 p-3 rounded-full border border-yellow-800">
                        <Key className="w-6 h-6 text-yellow-500" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white">Change Password</h3>
                        <p className="text-xs text-gray-400">For user: {passwordModal.user.name}</p>
                    </div>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">New Password</label>
                        <input
                            type="password"
                            value={passwordForm.newPassword}
                            onChange={e => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-500 outline-none text-white"
                            placeholder="Enter new password"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">Confirm Password</label>
                        <input
                            type="password"
                            value={passwordForm.confirmPassword}
                            onChange={e => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-gray-500 outline-none text-white"
                            placeholder="Confirm new password"
                        />
                    </div>
                </div>

                <div className="flex space-x-3 w-full mt-6">
                    <button
                        onClick={() => setPasswordModal({ isOpen: false, user: null })}
                        className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 font-medium"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSavePassword}
                        className="flex-1 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 font-medium flex items-center justify-center border border-gray-600"
                    >
                        <Save className="w-4 h-4 mr-2" />
                        Update
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
