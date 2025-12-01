import React, { useState, useEffect, useRef } from 'react';
import { AuthState, Page, Role, User, DocumentTrack, Department } from './types';
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
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Ref to track if we've already warned/logged out to prevent double-firing
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      const { data: dbUsers } = await supabase.from('users').select('*');
      
      let appUsers: User[] = [];

      // Seed Users if empty
      if (!dbUsers || dbUsers.length === 0) {
        console.log("Seeding Initial Users...");
        const seedUsers = await Promise.all(INITIAL_USERS.map(async (u) => {
          const salt = generateSalt();
          const hashedPassword = await hashPassword(u.password || 'user123', salt);
          return {
            ...u,
            id: uuid(),
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

      // 3. Fetch Departments
      const { data: dbDepts } = await supabase.from('departments').select('*').order('name');
      if (dbDepts) {
        setDepartments(dbDepts);
      }

      // 4. Fetch Documents & Logs
      const { data: dbDocs } = await supabase
        .from('documents')
        .select(`*, logs:document_logs(*)`);

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
    
    const docSubscription = supabase
      .channel('realtime:documents')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'documents' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newDoc = mapDocFromDB(payload.new, []);
          setDocuments(prev => {
            if (prev.some(d => d.id === newDoc.id)) return prev;
            return [newDoc, ...prev];
          });
        } else if (payload.eventType === 'UPDATE') {
          setDocuments(prev => prev.map(doc => {
            if (doc.id === payload.new.id) {
              return mapDocFromDB(payload.new, doc.logs); 
            }
            return doc;
          }));
        } else if (payload.eventType === 'DELETE') {
          setDocuments(prev => prev.filter(doc => doc.id !== payload.old.id));
        }
      })
      .subscribe();

    const logSubscription = supabase
      .channel('realtime:logs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'document_logs' }, (payload) => {
        const newLog = mapLogFromDB(payload.new);
        setDocuments(prev => prev.map(doc => {
          if (doc.id === payload.new.document_id) {
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

    const deptSubscription = supabase
      .channel('realtime:departments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'departments' }, (payload) => {
        if (payload.eventType === 'INSERT') {
            setDepartments(prev => [...prev, payload.new as Department].sort((a,b) => a.name.localeCompare(b.name)));
        } else if (payload.eventType === 'DELETE') {
            setDepartments(prev => prev.filter(d => d.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(docSubscription);
      supabase.removeChannel(logSubscription);
      supabase.removeChannel(userSubscription);
      supabase.removeChannel(deptSubscription);
    };

  }, []);

  const handleLogin = (user: User) => {
    setAuth({ isAuthenticated: true, currentUser: user });
    setCurrentPage('DASHBOARD');
    localStorage.setItem('bjmp_docs_user', JSON.stringify(user));
  };

  const handleLogout = () => {
    setAuth({ isAuthenticated: false, currentUser: null });
    setCurrentPage('LOGIN');
    localStorage.removeItem('bjmp_docs_user');
    // Clear any existing idle timers
    if (logoutTimerRef.current) {
        clearTimeout(logoutTimerRef.current);
    }
  };

  // --- IDLE TIMER LOGIC ---
  useEffect(() => {
    // Only activate if user is authenticated
    if (!auth.isAuthenticated) return;

    const IDLE_LIMIT = 5 * 60 * 1000; // 5 minutes in milliseconds

    const resetIdleTimer = () => {
      if (logoutTimerRef.current) {
        clearTimeout(logoutTimerRef.current);
      }

      logoutTimerRef.current = setTimeout(() => {
        alert("Session Expired: You have been logged out due to inactivity (5 minutes).");
        handleLogout();
      }, IDLE_LIMIT);
    };

    // Events to detect activity
    const activityEvents = [
      'mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart'
    ];

    // Attach listeners
    activityEvents.forEach(event => {
      window.addEventListener(event, resetIdleTimer);
    });

    // Start timer immediately
    resetIdleTimer();

    // Cleanup listeners on unmount or logout
    return () => {
      if (logoutTimerRef.current) {
        clearTimeout(logoutTimerRef.current);
      }
      activityEvents.forEach(event => {
        window.removeEventListener(event, resetIdleTimer);
      });
    };
  }, [auth.isAuthenticated]);

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

  if (!auth.isAuthenticated) {
    return <Login onLogin={handleLogin} users={users} />;
  }

  return (
    <div className="min-h-screen bg-gray-900 flex">
      <Sidebar 
        currentPage={currentPage} 
        user={auth.currentUser!} 
        onNavigate={handleNavigate} 
        onLogout={handleLogout}
      />

      <main className="flex-1 ml-64 p-8 overflow-y-auto h-screen relative">
        <div className="relative z-10 max-w-7xl mx-auto">
          {currentPage === 'DASHBOARD' && (
            <Dashboard 
              documents={documents} 
              setDocuments={setDocuments} 
              users={users} 
              setUsers={setUsers}
              departments={departments}
              currentUser={auth.currentUser!} 
            />
          )}
          
          {currentPage === 'USERS' && (
             auth.currentUser?.role === Role.ADMIN ? (
                <UsersPage users={users} setUsers={setUsers} departments={departments} currentUser={auth.currentUser} />
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
              departments={departments}
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