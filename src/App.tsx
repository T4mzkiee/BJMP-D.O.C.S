
import React, { useState, useEffect } from 'react';
import { AuthState, Page, Role, User, DocumentTrack } from './types';
import { INITIAL_USERS } from './constants';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { UsersPage } from './pages/Users';
import { DocumentsPage } from './pages/Documents';
import { AccountPage } from './pages/Account';
import { Sidebar } from './components/Sidebar';
import { generateSalt, hashPassword, uuid } from './utils/crypto';
import { supabase, mapUserFromDB, mapDocFromDB, mapUserToDB } from './utils/supabase';

const App: React.FC = () => {
  // State Management
  const [auth, setAuth] = useState<AuthState>({
    isAuthenticated: false,
    currentUser: null
  });
  const [currentPage, setCurrentPage] = useState<Page>('LOGIN');
  const [users, setUsers] = useState<User[]>([]);
  const [documents, setDocuments] = useState<DocumentTrack[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // --- DATA LOADING & AUTH RESTORATION ---
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      
      // 1. Restore Session from LocalStorage
      const storedUser = localStorage.getItem('bjmp_docs_user');
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          setAuth({ isAuthenticated: true, currentUser: parsedUser });
          // Ensure we stay on the requested page if possible, otherwise default to Dashboard
          setCurrentPage('DASHBOARD'); 
        } catch (e) {
          console.error("Failed to restore session", e);
          localStorage.removeItem('bjmp_docs_user');
        }
      }

      // 2. Fetch Users
      const { data: dbUsers, error: userError } = await supabase.from('users').select('*');
      
      if (userError) {
        console.error("Error loading users:", userError);
      }
      
      let appUsers: User[] = [];

      // Seed Users if empty
      if (!dbUsers || dbUsers.length === 0) {
        console.log("Seeding Initial Users...");
        const seedUsers = await Promise.all(INITIAL_USERS.map(async (u) => {
          const salt = generateSalt();
          const hashedPassword = await hashPassword(u.password || 'user123', salt);
          return {
            ...u,
            id: uuid(), // Generate proper UUID
            salt,
            password: hashedPassword
          };
        }));

        for (const u of seedUsers) {
          await supabase.from('users').insert(mapUserToDB(u));
        }
        appUsers = seedUsers;
      } else {
        appUsers = dbUsers.map(mapUserFromDB);
      }
      setUsers(appUsers);

      // 3. Fetch Documents & Logs
      const { data: dbDocs, error: docError } = await supabase
        .from('documents')
        .select(`*, logs:document_logs(*)`);

      if (docError) {
        console.error("Error loading documents:", docError);
      }

      if (dbDocs) {
        const appDocs = dbDocs.map((d: any) => mapDocFromDB(d, d.logs || []));
        setDocuments(appDocs);
      }

      setIsLoading(false);
    };

    loadData();
  }, []);

  // Handlers
  const handleLogin = (user: User) => {
    setAuth({ isAuthenticated: true, currentUser: user });
    setCurrentPage('DASHBOARD');
    // Save session to LocalStorage
    localStorage.setItem('bjmp_docs_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setAuth({ isAuthenticated: false, currentUser: null });
    setCurrentPage('LOGIN');
    // Clear session from LocalStorage
    localStorage.removeItem('bjmp_docs_user');
  };

  const handleNavigate = (page: Page) => {
    setCurrentPage(page);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
        <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h2 className="text-xl font-bold">Connecting to BJMP Cloud...</h2>
            <p className="text-gray-400">Syncing data from secure database</p>
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
      <main className="flex-1 ml-64 p-8 overflow-y-auto h-screen relative">
        <div className="relative z-10 max-w-7xl mx-auto">
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
