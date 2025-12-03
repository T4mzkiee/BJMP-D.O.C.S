
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
import { Menu, FileText } from 'lucide-react';

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

  // Layout State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Ref to track if we've already warned/logged out to prevent double-firing
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Ref to prevent race conditions during immediate login after force logout
  const isJustLoggedIn = useRef(false);

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
          // If the logged in user's isLoggedIn status changes to false, log them out locally
          // This handles the "Force Logout" scenario from another device
          const updatedUser = mapUserFromDB(payload.new);
          
          setUsers(prev => prev.map(u => u.id === payload.new.id ? updatedUser : u));
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

  // Monitor Auth Changes for Force Logout
  useEffect(() => {
    // IGNORE checks if we just logged in (Grace Period)
    if (isJustLoggedIn.current) return;

    if (auth.isAuthenticated && auth.currentUser) {
        // Find the most recent version of the current user in the user list
        // This is updated by the realtime listener above
        const userInState = users.find(u => u.id === auth.currentUser!.id);
        
        // Only trigger logout if we explicitly see isLoggedIn === false
        // The handleLogin function now pre-sets this to true to avoid initial race conditions
        if (userInState && userInState.isLoggedIn === false) {
            alert("You have been logged out remotely.");
            handleLogout(true); 
        }
    }
  }, [users, auth.isAuthenticated]);


  const handleLogin = async (user: User) => {
    // 1. Set Grace Period Flag to prevent the "Force Logout" signal from killing this session
    isJustLoggedIn.current = true;
    setTimeout(() => {
        isJustLoggedIn.current = false;
    }, 2000); // 2 seconds immunity

    // 2. Optimistically update local Users state to "Logged In"
    // This prevents the Security Monitor (useEffect above) from kicking us out immediately
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, isLoggedIn: true } : u));

    const userWithAuth = { ...user, isLoggedIn: true };
    setAuth({ isAuthenticated: true, currentUser: userWithAuth });
    setCurrentPage('DASHBOARD');
    localStorage.setItem('bjmp_docs_user', JSON.stringify(userWithAuth));
    
    // 3. Update DB to logged in
    await supabase.from('users').update({ is_logged_in: true }).eq('id', user.id);
  };

  const handleLogout = (skipDbUpdate: boolean = false) => {
    const userId = auth.currentUser?.id;

    // --- 1. IMMEDIATE UI LOGOUT (PRIORITY) ---
    // Optimistically update state
    if (userId) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, isLoggedIn: false } : u));
    }

    // Clear auth and redirect instantly
    setAuth({ isAuthenticated: false, currentUser: null });
    setCurrentPage('LOGIN');
    localStorage.removeItem('bjmp_docs_user');
    
    // Clear idle timers
    if (logoutTimerRef.current) {
        clearTimeout(logoutTimerRef.current);
    }

    // --- 2. BACKGROUND DB UPDATE (NON-BLOCKING) ---
    if (!skipDbUpdate && userId) {
        // Fire-and-forget Promise (no await, no UI blocking)
        supabase.from('users').update({ is_logged_in: false }).eq('id', userId)
        .catch(err => console.error("Background logout DB update failed:", err));
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
    <div className="min-h-screen bg-gray-900 flex flex-col md:flex-row">
      
      {/* Mobile Header */}
      <div className="md:hidden bg-gray-800 border-b border-gray-700 p-4 flex items-center justify-between sticky top-0 z-30 shadow-md">
        <div className="flex items-center space-x-2">
            <div className="bg-blue-600 p-1.5 rounded-lg">
                <FileText className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-white tracking-tight">BJMP8 D.O.C.S</span>
        </div>
        <button 
            onClick={() => setIsMobileSidebarOpen(true)}
            className="text-gray-300 hover:text-white focus:outline-none"
        >
            <Menu className="w-6 h-6" />
        </button>
      </div>

      {/* Sidebar Navigation */}
      <Sidebar 
        currentPage={currentPage} 
        user={auth.currentUser!} 
        onNavigate={handleNavigate} 
        onLogout={() => handleLogout()} // Normal logout triggers DB update
        isOpen={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />

      {/* Main Content Area */}
      <main 
        className={`flex-1 p-4 md:p-8 overflow-y-auto h-[calc(100vh-64px)] md:h-screen transition-all duration-300 ease-in-out
            ${isSidebarCollapsed ? 'md:ml-20' : 'md:ml-64'}
        `}
      >
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

          {currentPage === 'ARCHIVES' && (
            <DocumentsPage 
              documents={documents} 
              setDocuments={setDocuments} 
              currentUser={auth.currentUser!} 
              users={users}
              departments={departments}
              isArchiveView={true}
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