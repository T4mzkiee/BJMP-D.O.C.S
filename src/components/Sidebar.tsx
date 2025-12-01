
import React from 'react';
import { LayoutDashboard, Users, FileText, LogOut, ShieldCheck, Settings } from 'lucide-react';
import { Page, Role, User } from '../types';

interface SidebarProps {
  currentPage: Page;
  user: User;
  onNavigate: (page: Page) => void;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentPage, user, onNavigate, onLogout }) => {
  const navItemClass = (page: Page) =>
    `flex items-center space-x-3 w-full px-4 py-3 rounded-lg transition-colors duration-200 ${
      currentPage === page
        ? 'bg-blue-600 text-white shadow-md'
        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
    }`;

  return (
    <div className="w-64 bg-gray-900 h-screen border-r border-gray-800 flex flex-col shadow-sm fixed left-0 top-0 z-50">
      <div className="p-6 flex items-center space-x-3 border-b border-gray-800">
        <div className="bg-blue-600 p-2 rounded-lg">
          <FileText className="w-6 h-6 text-white" />
        </div>
        <span className="text-xl font-bold text-white tracking-tight">BJMP8 D.O.C.S</span>
      </div>

      <nav className="flex-1 p-4 space-y-2 mt-4">
        <button onClick={() => onNavigate('DASHBOARD')} className={navItemClass('DASHBOARD')}>
          <LayoutDashboard className="w-5 h-5" />
          <span className="font-medium">Dashboard</span>
        </button>

        <button onClick={() => onNavigate('DOCUMENTS')} className={navItemClass('DOCUMENTS')}>
          <FileText className="w-5 h-5" />
          <span className="font-medium">Documents</span>
        </button>

        <button onClick={() => onNavigate('ACCOUNT')} className={navItemClass('ACCOUNT')}>
          <Settings className="w-5 h-5" />
          <span className="font-medium">Account Settings</span>
        </button>

        {user.role === Role.ADMIN && (
          <div className="pt-4 mt-4 border-t border-gray-800">
            <p className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Admin</p>
            <button onClick={() => onNavigate('USERS')} className={navItemClass('USERS')}>
              <Users className="w-5 h-5" />
              <span className="font-medium">User Management</span>
            </button>
          </div>
        )}
      </nav>

      <div className="p-4 border-t border-gray-800">
        <div className="flex items-center space-x-3 mb-6 px-4">
          <img src={user.avatarUrl} alt="Profile" className="w-10 h-10 rounded-full border border-gray-700" />
          <div className="overflow-hidden">
            <p className="text-sm font-semibold text-white truncate">{user.name}</p>
            <p className="text-xs text-gray-400 flex items-center">
              {user.role === Role.ADMIN && <ShieldCheck className="w-3 h-3 mr-1 text-blue-400" />}
              {user.role}
            </p>
          </div>
        </div>
        <button
          onClick={onLogout}
          className="flex items-center space-x-2 w-full px-4 py-2 text-red-400 hover:bg-red-900/20 hover:text-red-300 rounded-lg transition-colors text-sm font-medium"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );
};
