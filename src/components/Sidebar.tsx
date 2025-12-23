
import React from 'react';
import { LayoutDashboard, Users, FileText, LogOut, ShieldCheck, Settings, ChevronLeft, ChevronRight, X, Archive, Laptop } from 'lucide-react';
import { Page, Role, User, SystemSettings } from '../types';

interface SidebarProps {
  currentPage: Page;
  user: User;
  onNavigate: (page: Page) => void;
  onLogout: () => void;
  isOpen: boolean; // Mobile open state
  isCollapsed: boolean; // Desktop collapsed state
  onToggleCollapse: () => void; // Toggle desktop collapse
  onCloseMobile: () => void; // Close mobile drawer
  incomingCount?: number; // New prop for notifications
  systemSettings: SystemSettings;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  currentPage, 
  user, 
  onNavigate, 
  onLogout,
  isOpen,
  isCollapsed,
  onToggleCollapse,
  onCloseMobile,
  incomingCount = 0,
  systemSettings
}) => {
  
  const navItemClass = (page: Page) =>
    `flex items-center ${isCollapsed ? 'justify-center px-2' : 'justify-start px-4'} py-3 rounded-lg transition-all duration-200 group relative ${
      currentPage === page
        ? 'bg-blue-600 text-white shadow-md'
        : 'text-gray-400 hover:bg-gray-800 hover:text-white'
    }`;

  // Base classes for the sidebar container
  const sidebarClasses = `
    fixed top-0 left-0 h-screen bg-gray-900 border-r border-gray-800 flex flex-col shadow-xl z-50
    transition-all duration-300 ease-in-out
    ${isOpen ? 'translate-x-0' : '-translate-x-full'} 
    md:translate-x-0 
    ${isCollapsed ? 'w-20' : 'w-64'}
  `;

  return (
    <>
      {/* Mobile Overlay Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 md:hidden backdrop-blur-sm"
          onClick={onCloseMobile}
        />
      )}

      <div className={sidebarClasses}>
        {/* Header */}
        <div className={`p-4 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} border-b border-gray-800 h-24`}>
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className={`${isCollapsed ? '' : 'bg-blue-600 p-2 rounded-xl'} flex-shrink-0 flex items-center justify-center`}>
              {systemSettings.logoUrl ? (
                <img src={systemSettings.logoUrl} className={`${isCollapsed ? 'w-14 h-14' : 'w-12 h-12'} object-contain`} alt="Logo" />
              ) : (
                <FileText className={`${isCollapsed ? 'w-10 h-10' : 'w-8 h-8'} text-white`} />
              )}
            </div>
            {!isCollapsed && (
              <span className="text-xl font-bold text-white tracking-tight whitespace-nowrap overflow-hidden text-ellipsis max-w-[120px]">
                {systemSettings.orgName}
              </span>
            )}
          </div>
          
          {/* Mobile Close Button */}
          <button onClick={onCloseMobile} className="md:hidden text-gray-400 hover:text-white">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2 mt-2 overflow-y-auto scrollbar-hide">
          <button 
            onClick={() => { onNavigate('DASHBOARD'); onCloseMobile(); }} 
            className={navItemClass('DASHBOARD')}
            title={isCollapsed ? "Dashboard" : ""}
          >
            <div className="relative">
                <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
                {isCollapsed && incomingCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-600 rounded-full border-2 border-gray-900"></span>
                )}
            </div>
            {!isCollapsed && (
                <>
                    <span className="ml-3 font-medium flex-1 text-left">Dashboard</span>
                    {incomingCount > 0 && (
                        <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
                            {incomingCount}
                        </span>
                    )}
                </>
            )}
          </button>

          <button 
            onClick={() => { onNavigate('DOCUMENTS'); onCloseMobile(); }} 
            className={navItemClass('DOCUMENTS')}
            title={isCollapsed ? "Documents" : ""}
          >
            <FileText className="w-5 h-5 flex-shrink-0" />
            {!isCollapsed && <span className="ml-3 font-medium">Documents</span>}
          </button>

          <button 
            onClick={() => { onNavigate('ARCHIVES'); onCloseMobile(); }} 
            className={navItemClass('ARCHIVES')}
            title={isCollapsed ? "Archives" : ""}
          >
            <Archive className="w-5 h-5 flex-shrink-0" />
            {!isCollapsed && <span className="ml-3 font-medium">Archives</span>}
          </button>

          <button 
            onClick={() => { onNavigate('ACCOUNT'); onCloseMobile(); }} 
            className={navItemClass('ACCOUNT')}
            title={isCollapsed ? "Account Settings" : ""}
          >
            <Settings className="w-5 h-5 flex-shrink-0" />
            {!isCollapsed && <span className="ml-3 font-medium">Account Settings</span>}
          </button>

          {user.role === Role.ADMIN && (
            <div className={`pt-4 mt-4 border-t border-gray-800 ${isCollapsed ? 'flex justify-center flex-col items-center space-y-4' : ''}`}>
              {!isCollapsed && (
                <p className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Admin</p>
              )}
              <button 
                onClick={() => { onNavigate('USERS'); onCloseMobile(); }} 
                className={navItemClass('USERS')}
                title={isCollapsed ? "User Management" : ""}
              >
                <Users className="w-5 h-5 flex-shrink-0" />
                {!isCollapsed && <span className="ml-3 font-medium">User Management</span>}
              </button>
              
              <button 
                onClick={() => { onNavigate('SYSTEM_SETTINGS'); onCloseMobile(); }} 
                className={navItemClass('SYSTEM_SETTINGS')}
                title={isCollapsed ? "System Settings" : ""}
              >
                <Laptop className="w-5 h-5 flex-shrink-0" />
                {!isCollapsed && <span className="ml-3 font-medium">System Settings</span>}
              </button>
            </div>
          )}
        </nav>

        {/* Desktop Collapse Toggle */}
        <button 
            onClick={onToggleCollapse}
            className="hidden md:flex absolute -right-3 top-24 bg-gray-800 text-gray-400 hover:text-white p-1 rounded-full border border-gray-700 shadow-md transition-colors"
        >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        {/* Footer / Profile */}
        <div className="p-4 border-t border-gray-800">
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-3'} mb-6 ${!isCollapsed ? 'px-2' : ''}`}>
            <img src={user.avatarUrl} alt="Profile" className="w-10 h-10 rounded-full border border-gray-700 flex-shrink-0" />
            {!isCollapsed && (
              <div className="overflow-hidden">
                <p className="text-sm font-semibold text-white truncate">{user.name}</p>
                <p className="text-xs text-gray-400 flex items-center">
                  {user.role === Role.ADMIN && <ShieldCheck className="w-3 h-3 mr-1 text-blue-400" />}
                  {user.role}
                </p>
              </div>
            )}
          </div>
          <button
            onClick={onLogout}
            className={`flex items-center ${isCollapsed ? 'justify-center' : 'space-x-2 w-full px-4'} py-2 text-red-400 hover:bg-red-900/20 hover:text-red-300 rounded-lg transition-colors text-sm font-medium`}
            title={isCollapsed ? "Sign Out" : ""}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            {!isCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </div>
    </>
  );
};
