import React, { useState } from 'react';
import { AuthState, Page, Role, User, DocumentTrack } from './types';
import { INITIAL_USERS, INITIAL_DOCUMENTS } from './constants';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { UsersPage } from './pages/Users';
import { DocumentsPage } from './pages/Documents';
import { AccountPage } from './pages/Account';
import { Sidebar } from './components/Sidebar';

const App: React.FC = () => {
  // State Management (Simulating Backend)
  const [auth, setAuth] = useState<AuthState>({
    isAuthenticated: false,
    currentUser: null
  });
  const [currentPage, setCurrentPage] = useState<Page>('LOGIN');
  const [users, setUsers] = useState<User[]>(INITIAL_USERS);
  const [documents, setDocuments] = useState<DocumentTrack[]>(INITIAL_DOCUMENTS);

  // Handlers
  const handleLogin = (user: User) => {
    setAuth({ isAuthenticated: true, currentUser: user });
    setCurrentPage('DASHBOARD');
  };

  const handleLogout = () => {
    setAuth({ isAuthenticated: false, currentUser: null });
    setCurrentPage('LOGIN');
  };

  const handleNavigate = (page: Page) => {
    setCurrentPage(page);
  };

  // Render Logic
  if (!auth.isAuthenticated || currentPage === 'LOGIN') {
    return <Login onLogin={handleLogin} users={users} />;
  }

  return (
    <div className="min-h-screen bg-gray-900 flex">
      {/* Sidebar Navigation */}
      <Sidebar 
        currentPage={currentPage} 
        user={auth.currentUser!} 
        onNavigate={handleNavigate} 
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <main className="flex-1 ml-64 p-8 overflow-y-auto h-screen">
        <div className="max-w-7xl mx-auto">
          {currentPage === 'DASHBOARD' && (
            <Dashboard 
              documents={documents} 
              setDocuments={setDocuments} 
              users={users} 
              setUsers={setUsers}
              currentUser={auth.currentUser!} 
            />
          )}
          
          {currentPage === 'USERS' && (
             // Role Guard: Only Admin can see this
             auth.currentUser?.role === Role.ADMIN ? (
                <UsersPage users={users} setUsers={setUsers} currentUser={auth.currentUser} />
             ) : (
                <div className="text-center py-20">
                    <h2 className="text-2xl font-bold text-gray-500">Access Denied</h2>
                    <p className="text-gray-600">You do not have permission to view this page.</p>
                </div>
             )
          )}
          
          {currentPage === 'DOCUMENTS' && (
            <DocumentsPage 
              documents={documents} 
              setDocuments={setDocuments} 
              currentUser={auth.currentUser!} 
              users={users}
            />
          )}

          {currentPage === 'ACCOUNT' && (
            <AccountPage 
              users={users} 
              setUsers={setUsers} 
              currentUser={auth.currentUser!} 
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default App;