
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AuthState, Page, Role, User, DocumentTrack, Department, DocStatus, SystemSettings } from './types';
import { INITIAL_USERS } from './constants';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { UsersPage } from './pages/Users';
import { DocumentsPage } from './pages/Documents';
import { AccountPage } from './pages/Account';
import { SystemSettingsPage } from './pages/SystemSettings';
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
  const [systemSettings, setSystemSettings] = useState<SystemSettings>({
    id: 'default',
    orgName: 'BJMP8 D.O.C.S',
    appDescription: 'BJMP8 Document-On-Control-System A simple Document Tracking System Developed by BJMPRO8 RICTMD TEAM.',
    logoUrl: null
  });
  const [isLoading, setIsLoading] = useState(true);

  // Update Document Title whenever Org Name changes
  useEffect(() => {
    document.title = systemSettings.orgName;
  }, [systemSettings.orgName]);

  // Layout State
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Ref to track session
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

      // 2. Fetch System Settings (Use maybeSingle to avoid errors if empty)
      try {
          const { data: dbSettings } = await supabase.from('system_settings').select('*').maybeSingle();
          if (dbSettings) {
            setSystemSettings({
              id: dbSettings.id,
              orgName: dbSettings.org_name,
              appDescription: dbSettings.app_description,
              logoUrl: dbSettings.logo_url
            });
          }
      } catch (err) {
          console.error("Error fetching system settings:", err);
      }

      // 3. Fetch Users
      const { data: dbUsers } = await supabase.from('users').select('*');
      
      let appUsers: User[] = [];

      // Seed Users if empty
      if (!dbUsers || dbUsers.length === 0) {
        const seedUsers = await Promise.all(INITIAL_USERS.map(async (u) => {
          const salt = generateSalt();
          const hashedPassword = await hashPassword(u.password || 'user123', salt);
          return { ...u, id: uuid(), salt, password: hashedPassword };
        }));

        for (const u of seedUsers) {
          await supabase.from('users').insert(mapUserToDB(u));
        }
        appUsers = seedUsers;
      } else {
        appUsers = dbUsers.map(mapUserFromDB);
      }
      setUsers(appUsers);

      // 4. Fetch Departments
      const { data: dbDepts } = await supabase.from('departments').select('*').order('name');
      if (dbDepts) {
        setDepartments(dbDepts);
      }

      // 5. Fetch Documents & Logs
      const { data: dbDocs } = await supabase.from('documents').select(`*, logs:document_logs(*)`);

      if (dbDocs) {
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
    
    // Listen for ALL changes (Insert/Update) to settings
    const settingsSub = supabase
      .channel('realtime:settings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'system_settings' }, (payload) => {
          if (payload.new) {
              setSystemSettings({
                  id: payload.new.id,
                  orgName: payload.new.org_name,
                  appDescription: payload.new.app_description,
                  logoUrl: payload.new.logo_url
              });
          }
      })
      .subscribe();

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
              return { ...mapDocFromDB(payload.new, []), logs: doc.logs }; 
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
            return { ...doc, logs: [...doc.logs, newLog] };
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
          setUsers(prev => prev.some(u => u.id === newUser.id) ? prev : [...prev, newUser]);
        } else if (payload.eventType === 'UPDATE') {
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
      supabase.removeChannel(settingsSub);
      supabase.removeChannel(docSubscription);
      supabase.removeChannel(logSubscription);
      supabase.removeChannel(userSubscription);
      supabase.removeChannel(deptSubscription);
    };

  }, []);

  // Monitor Auth Changes for Force Logout
  useEffect(() => {
    if (isJustLoggedIn.current) return;
    if (auth.isAuthenticated && auth.currentUser) {
        const userInState = users.find(u => u.id === auth.currentUser!.id);
        if (userInState && userInState.isLoggedIn === false) {
            alert("You have been logged out remotely.");
            handleLogout(true); 
        }
    }
  }, [users, auth.isAuthenticated]);


  const handleLogin = async (user: User) => {
    isJustLoggedIn.current = true;
    setTimeout(() => { isJustLoggedIn.current = false; }, 2000);
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, isLoggedIn: true } : u));
    const userWithAuth = { ...user, isLoggedIn: true };
    setAuth({ isAuthenticated: true, currentUser: userWithAuth });
    setCurrentPage('DASHBOARD');
    localStorage.setItem('bjmp_docs_user', JSON.stringify(userWithAuth));
    await supabase.from('users').update({ is_logged_in: true }).eq('id', user.id);
  };

  const handleLogout = (skipDbUpdate: boolean = false) => {
    const userId = auth.currentUser?.id;
    if (userId) {
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, isLoggedIn: false } : u));
    }
    setAuth({ isAuthenticated: false, currentUser: null });
    setCurrentPage('LOGIN');
    localStorage.removeItem('bjmp_docs_user');
    if (!skipDbUpdate && userId) {
        supabase.from('users').update({ is_logged_in: false }).eq('id', userId).then(({ error }) => {
            if (error) console.error("Error logging out from DB:", error);
        });
    }
  };

  const handleNavigate = (page: Page) => {
    setCurrentPage(page);
    setIsMobileSidebarOpen(false);
  };

  const incomingCount = useMemo(() => {
    if (!auth.currentUser) return 0;
    return documents.filter(d => 
        d.assignedTo === auth.currentUser!.department && 
        d.status === DocStatus.INCOMING
    ).length;
  }, [documents, auth.currentUser]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">
        <div className="text-center">
            <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h2 className="text-xl font-bold">Initializing System...</h2>
            <p className="text-gray-400">Loading modules and security protocols</p>
        </div>
      </div>
    );
  }

  // Render Logic
  if (!auth.isAuthenticated || currentPage === 'LOGIN') {
    return <Login onLogin={handleLogin} users={users} systemSettings={systemSettings} />;
  }

  return (
    <div className="min-h-screen bg-gray-900 flex">
      {/* Sidebar Navigation */}
      <Sidebar 
        currentPage={currentPage} 
        user={auth.currentUser!} 
        onNavigate={handleNavigate} 
        onLogout={() => handleLogout()}
        isOpen={isMobileSidebarOpen}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        incomingCount={incomingCount}
        systemSettings={systemSettings}
      />

      {/* Main Content Area */}
      <main className={`flex-1 transition-all duration-300 ease-in-out h-screen overflow-hidden flex flex-col ${isSidebarCollapsed ? 'md:ml-20' : 'md:ml-64'}`}>
        {/* Mobile Header */}
        <div className="md:hidden bg-gray-800 p-4 border-b border-gray-700 flex items-center justify-between">
            <div className="flex items-center space-x-3">
                <button onClick={() => setIsMobileSidebarOpen(true)} className="text-gray-400 hover:text-white">
                    <Menu className="w-6 h-6" />
                </button>
                <span className="font-bold text-white text-lg flex items-center">
                    {systemSettings.logoUrl ? (
                        <img src={systemSettings.logoUrl} className="w-6 h-6 mr-2 object-contain" alt="" />
                    ) : (
                        <FileText className="w-5 h-5 mr-2 text-blue-500" />
                    )}
                    {systemSettings.orgName}
                </span>
            </div>
            {incomingCount > 0 && (
                 <span className="bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse">
                    {incomingCount} Incoming
                </span>
            )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-7xl mx-auto">
            {currentPage === 'DASHBOARD' && (
              <Dashboard documents={documents} setDocuments={setDocuments} users={users} setUsers={setUsers} departments={departments} currentUser={auth.currentUser!} />
            )}
            
            {currentPage === 'USERS' && (
               auth.currentUser?.role === Role.ADMIN ? (
                  <UsersPage users={users} setUsers={setUsers} currentUser={auth.currentUser!} departments={departments} />
               ) : (
                  <div className="text-center py-20 animate-fade-in">
                      <h2 className="text-2xl font-bold text-gray-500">Access Denied</h2>
                  </div>
               )
            )}
            
            {currentPage === 'DOCUMENTS' && (
              <DocumentsPage documents={documents} setDocuments={setDocuments} currentUser={auth.currentUser!} users={users} departments={departments} />
            )}

            {currentPage === 'ARCHIVES' && (
              <DocumentsPage documents={documents} setDocuments={setDocuments} currentUser={auth.currentUser!} users={users} departments={departments} isArchiveView={true} />
            )}

            {currentPage === 'ACCOUNT' && (
              <AccountPage users={users} setUsers={setUsers} currentUser={auth.currentUser!} />
            )}

            {currentPage === 'SYSTEM_SETTINGS' && (
               auth.currentUser?.role === Role.ADMIN ? (
                  <SystemSettingsPage settings={systemSettings} onUpdate={setSystemSettings} />
               ) : (
                  <div className="text-center py-20">
                      <h2 className="text-2xl font-bold text-gray-500">Access Denied</h2>
                  </div>
               )
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
