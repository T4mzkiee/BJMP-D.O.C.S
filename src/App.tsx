
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
import { supabase, mapUserFromDB, mapDocFromDB, mapUserToDB, mapLogFromDB } from './utils/supabase';

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
        // Sort documents by createdAt descending (newest first)
        const sortedDocs = dbDocs.sort((a: any, b: any) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        const appDocs = sortedDocs.map((d: any) => mapDocFromDB(d, d.logs || []));
        setDocuments(appDocs);
      }

      setIsLoading(false);
    };

    loadData();

    // --- REALTIME SUBSCRIPTIONS ---
    
    // 1. Listen for Document Changes (Insert/Update/Delete)
    const docSubscription = supabase
      .channel('realtime:documents')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, (payload) => {
        
        if (payload.eventType === 'INSERT') {
          // New document created by someone else
          const newDoc = mapDocFromDB(payload.new, []);
          setDocuments(prev => {
            // Prevent duplicates from optimistic updates
            if (prev.some(d => d.id === newDoc.id)) return prev;
            return [newDoc, ...prev];
          });
        } 
        else if (payload.eventType === 'UPDATE') {
          // Document status/details updated
          setDocuments(prev => prev.map(doc => {
            if (doc.id === payload.new.id) {
              // Preserve existing logs from state, update document fields
              return mapDocFromDB(payload.new, doc.logs); 
            }
            return doc;
          }));
        } 
        else if (payload.eventType === 'DELETE') {
          setDocuments(prev => prev.filter(doc => doc.id !== payload.old.id));
        }
      })
      .subscribe();

    // 2. Listen for Log Entries (History/Movement)
    // This is crucial for showing "Forwarded", "Returned", "Received" updates instantly
    const logSubscription = supabase
      .channel('realtime:logs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'document_logs' }, (payload) => {
        const newLog = mapLogFromDB(payload.new);
        
        setDocuments(prev => prev.map(doc => {
          if (doc.id === payload.new.document_id) {
            // Check if log already exists to prevent duplicates
            if (doc.logs.some(l => l.id === newLog.id)) return doc;
            
            return {
              ...doc,
              logs: [...doc.logs, newLog]
            };
          }
          return doc;
        }));
      })
      .subscribe();

    // 3. Listen for User Changes
    const userSubscription = supabase
      .channel('realtime:users')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newUser = mapUserFromDB(payload.new);
          setUsers(prev => {
             if (prev.some(u => u.id === newUser.id)) return prev;
             return [...prev, newUser];
          });
        } else if (payload.eventType === 'UPDATE') {
          setUsers(prev => prev.map(u => u.id === payload.new.id ? mapUserFromDB(payload.new) : u));
        } else if (payload.eventType === 'DELETE') {
          setUsers(prev => prev.filter(u => u.id !== payload.old.id));
        }
      })
      .subscribe();

    // Cleanup subscriptions on unmount
    return () => {
      supabase.removeChannel(docSubscription);
      supabase.removeChannel(logSubscription);
      supabase.removeChannel(userSubscription);
    };

  }, []);

  // Handlers
  const handleLogin = (user: User) => {
    setAuth({ isAuthenticated: true, currentUser: user });
    setCurrentPage('DASHBOARD');
    localStorage.setItem('bjmp_docs_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setAuth({ isAuthenticated: false, currentUser: null });
    setCurrentPage('LOGIN');
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
