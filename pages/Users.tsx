
import React, { useState, useRef } from 'react';
import { User, Role } from '../types';
import { Plus, Edit2, Trash2, Ban, CheckCircle, Search, Key, AlertTriangle, X, Upload, Camera } from 'lucide-react';

interface UsersProps {
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  currentUser: User;
}

export const UsersPage: React.FC<UsersProps> = ({ users, setUsers, currentUser }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{ isOpen: boolean; user: User | null; type: 'toggle' | 'delete' }>({ 
    isOpen: false, 
    user: null,
    type: 'toggle' 
  });

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
        department: '',
        role: Role.USER,
        isActive: true,
        password: '',
        avatarUrl: `https://picsum.photos/200/200?random=${Math.floor(Math.random() * 1000)}` // Default random if none provided
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

  const handleSave = () => {
    if (!formData.name || !formData.email || !formData.password) {
      alert("Please fill in all required fields (Name, Email, Password)");
      return;
    }

    if (editingUser) {
      setUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, ...formData } as User : u));
    } else {
      const newUser: User = {
        id: Math.random().toString(36).substr(2, 9),
        ...formData
      } as User;
      setUsers(prev => [...prev, newUser]);
    }
    setIsModalOpen(false);
  };

  const initiateDelete = (user: User) => {
     setConfirmModal({ isOpen: true, user, type: 'delete' });
  };

  const initiateToggle = (user: User) => {
     setConfirmModal({ isOpen: true, user, type: 'toggle' });
  };

  const handleConfirmAction = () => {
    const { user, type } = confirmModal;
    if (!user) return;

    if (type === 'delete') {
         setUsers(prev => prev.filter(u => u.id !== user.id));
    } else if (type === 'toggle') {
         setUsers(prev => prev.map(u => u.id === user.id ? { ...u, isActive: !u.isActive } : u));
    }
    setConfirmModal({ isOpen: false, user: null, type: 'toggle' });
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
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm"
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
                      user.role === Role.ADMIN ? 'bg-purple-900/50 text-purple-300 border border-purple-800' : 'bg-blue-900/50 text-blue-300 border border-blue-800'
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
                    <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-gray-600 group-hover:border-blue-500 transition-colors">
                        <img 
                            src={formData.avatarUrl || `https://ui-avatars.com/api/?name=${formData.name || 'User'}`} 
                            alt="Profile" 
                            className="w-full h-full object-cover"
                        />
                    </div>
                    <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <Camera className="w-8 h-8 text-white" />
                    </div>
                    <div className="absolute bottom-0 right-0 bg-blue-600 rounded-full p-1.5 border-2 border-gray-800">
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
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({ ...formData, email: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1 flex items-center">
                    <Key className="w-3 h-3 mr-1 text-gray-500" />
                    Password
                </label>
                <input
                  type="text"
                  value={formData.password}
                  onChange={e => setFormData({ ...formData, password: e.target.value })}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none font-mono text-sm text-white"
                  placeholder="Set login password"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Department</label>
                    <input
                    type="text"
                    value={formData.department}
                    onChange={e => setFormData({ ...formData, department: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Role</label>
                    <select
                    value={formData.role}
                    onChange={e => setFormData({ ...formData, role: e.target.value as Role })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-white"
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
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
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
                                confirmModal.type === 'delete' ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'
                            }`}
                        >
                            Confirm
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
