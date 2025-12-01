import React, { useState, useEffect } from 'react';
import { AuthState, Page, Role, User, DocumentTrack } from './types';
import { INITIAL_USERS, INITIAL_DOCUMENTS } from './constants';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { UsersPage } from './pages/Users';
import { DocumentsPage } from './pages/Documents';
import { AccountPage } from './pages/Account';
import { Sidebar } from './components/Sidebar';
import { generateSalt, hashPassword } from './utils/crypto';

const App: React.FC = () => {
  // --- STATE INITIALIZATION WITH PERSISTENCE ---
  
  // Load Users from LocalStorage or fallback to INITIAL_USERS
  const [users, setUsers] = useState<User[]>(() => {
    const savedUsers = localStorage.getItem('bjmp_users_data');
    return savedUsers ? JSON.parse(savedUsers) : INITIAL_USERS;
  });

  // Load Documents from LocalStorage or fallback to INITIAL_DOCUMENTS
  const [documents, setDocuments] = useState<DocumentTrack[]>(() => {
    const savedDocs = localStorage.getItem('bjmp_documents_data');
    return savedDocs ? JSON.parse(savedDocs) : INITIAL_DOCUMENTS;
  });

  const [auth, setAuth] = useState<AuthState>(() => {
     // Optional: Persist login session (Caution: simplified for demo)
     const savedSession = localStorage.getItem('bjmp_auth_session');
     return savedSession ? JSON.parse(savedSession) : { isAuthenticated: false, currentUser: null };
  });

  const [currentPage, setCurrentPage] = useState<Page>('DASHBOARD');
  const [isMigrating, setIsMigrating] = useState(true);

  // --- PERSISTENCE EFFECTS ---

  // Save Users whenever they change
  useEffect(() => {
    localStorage.setItem('bjmp_users_data', JSON.stringify(users));
  }, [users]);

  // Save Documents whenever they change
  useEffect(() => {
    localStorage.setItem('bjmp_documents_data', JSON.stringify(documents));
  }, [documents]);

  // Save Auth Session whenever it changes
  useEffect(() => {
    localStorage.setItem('bjmp_auth_session', JSON.stringify(auth));
  }, [auth]);


  // --- SECURITY MIGRATION ---
  // On startup, check if users have salts. If not, hash their plain-text passwords.
  useEffect(() => {
    const migratePasswords = async () => {
      let hasChanges = false;
      const migratedUsers = await Promise.all(users.map(async (user) => {
        // If user already has a salt, assume they are already hashed
        if (user.salt) return user;

        // If no salt, generate one and hash the existing plain-text password
        hasChanges = true;
        const salt = generateSalt();
        const hashedPassword = await hashPassword(user.password || '', salt);
        
        return {
          ...user,
          salt: salt,
          password: hashedPassword
        };
      }));

      if (hasChanges) {
        setUsers(migratedUsers);
        console.log("Security Migration: All passwords have been hashed and salted.");
      }
      setIsMigrating(false);
    };

    migratePasswords();
  }, []); // Run once on mount

  // Handlers
  const handleLogin = (user: User) => {
    setAuth({ isAuthenticated: true, currentUser: user });
    setCurrentPage('DASHBOARD');
  };

  const handleLogout = () => {
    setAuth({ isAuthenticated: false, currentUser: null });
    setCurrentPage('LOGIN');
    localStorage.removeItem('bjmp_auth_session'); // Clear session on logout
  };

  const handleNavigate = (page: Page) => {
    setCurrentPage(page);
  };

  if (isMigrating) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
        <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h2 className="text-xl font-bold">Securing System...</h2>
            <p className="text-gray-400">Encrypting database credentials</p>
        </div>
      </div>
    );
  }

  // Render Logic
  if (!auth.isAuthenticated) {
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