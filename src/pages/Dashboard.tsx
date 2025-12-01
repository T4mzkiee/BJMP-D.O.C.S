
import React, { useState } from 'react';
import { DocumentTrack, DocStatus, User, Role } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { FileClock, CheckCircle, Inbox, Archive, Plus, FileText, ArrowUpRight, ArrowDownLeft, MousePointerClick, Send, CheckSquare, Undo2, Trash2, AlertTriangle, X, ShieldAlert } from 'lucide-react';
import { AddDocumentModal } from '../components/AddDocumentModal';
import { SuccessModal } from '../components/SuccessModal';
import { DocumentLogsModal } from '../components/DocumentLogsModal';
import { ReceiveConfirmationModal } from '../components/ReceiveConfirmationModal';
import { DocumentDetailModal } from '../components/DocumentDetailModal';
import { ForwardDocumentModal } from '../components/ForwardDocumentModal';
import { ReturnDocumentModal } from '../components/ReturnDocumentModal';
import { supabase, mapDocToDB, mapLogToDB } from '../utils/supabase';
import { uuid } from '../utils/crypto';

interface DashboardProps {
  documents: DocumentTrack[];
  setDocuments: React.Dispatch<React.SetStateAction<DocumentTrack[]>>;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  currentUser: User;
}

export const Dashboard: React.FC<DashboardProps> = ({ documents, setDocuments, users, setUsers, currentUser }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'incoming' | 'outgoing'>('incoming');
  const [successModal, setSuccessModal] = useState<{ isOpen: boolean; controlNumber: string; department: string }>({
    isOpen: false,
    controlNumber: '',
    department: ''
  });
  
  // Modal States for Actions
  const [selectedDocForLogs, setSelectedDocForLogs] = useState<DocumentTrack | null>(null);
  const [receiveModal, setReceiveModal] = useState<{ isOpen: boolean; doc: DocumentTrack | null }>({ isOpen: false, doc: null });
  const [detailModal, setDetailModal] = useState<{ isOpen: boolean; doc: DocumentTrack | null }>({ isOpen: false, doc: null });
  const [forwardModal, setForwardModal] = useState<{ isOpen: boolean; doc: DocumentTrack | null }>({ isOpen: false, doc: null });
  const [returnModal, setReturnModal] = useState<{ isOpen: boolean; doc: DocumentTrack | null }>({ isOpen: false, doc: null });

  // Clear Data States
  const [clearDataModal, setClearDataModal] = useState(false);
  const [clearConfirmationText, setClearConfirmationText] = useState('');
  const [isClearing, setIsClearing] = useState(false);

  // --- Admin View Logic ---
  
  const isDocCurrentlyReturned = (d: DocumentTrack) => {
    if (d.status !== DocStatus.INCOMING) return false;
    const lastLog = d.logs.length > 0 ? d.logs[d.logs.length - 1] : null;
    return lastLog && lastLog.action.includes('Returned');
  };

  const returnedDocsCount = documents.filter(d => 
    d.logs.some(l => l.action.includes('Returned'))
  ).length;

  const regularIncomingCount = documents.filter(d => d.status === DocStatus.INCOMING && !isDocCurrentlyReturned(d)).length;

  const statusCounts = [
    { name: 'Incoming', value: regularIncomingCount, color: '#6B7280' }, // Grey for Incoming (Neutral)
    { name: 'Returned', value: returnedDocsCount, color: '#EF4444' }, // Keep Red for critical
    { name: 'Processing', value: documents.filter(d => d.status === DocStatus.PROCESSING).length, color: '#F59E0B' }, // Keep Yellow
    { name: 'Completed', value: documents.filter(d => d.status === DocStatus.COMPLETED).length, color: '#10B981' }, // Keep Green
    { name: 'Archived', value: documents.filter(d => d.status === DocStatus.ARCHIVED).length, color: '#374151' }, // Darker Grey
  ];

  const priorityData = [
    { name: 'Highly Technical', value: documents.filter(d => d.priority === 'Highly Technical Transaction').length },
    { name: 'Complex', value: documents.filter(d => d.priority === 'Complex Transaction').length },
    { name: 'Simple', value: documents.filter(d => d.priority === 'Simple Transaction').length },
  ];

  const StatCard = ({ title, value, icon: Icon, color }: any) => (
    <div className="bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-700 flex items-center justify-between">
      <div>
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{title}</p>
        <p className="text-2xl font-bold text-white mt-1">{value}</p>
      </div>
      <div className={`p-3 rounded-full ${color} bg-opacity-20`}>
        <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
      </div>
    </div>
  );

  // --- User View Logic ---
  const incomingDocs = documents.filter(d => 
    d.assignedTo === currentUser.department &&
    d.status !== DocStatus.COMPLETED &&
    d.status !== DocStatus.RETURNED
  );

  const outgoingDocs = documents.filter(d => {
    const creator = users.find(u => u.id === d.createdBy);
    const createdByMyDept = creator?.department === currentUser.department;
    
    const forwardedByMyDept = d.logs.some(log => 
        log.department === currentUser.department && log.action.includes('Forwarded')
    );

    const currentlyWithMyDept = d.assignedTo === currentUser.department;

    return (createdByMyDept || forwardedByMyDept) && !currentlyWithMyDept;
  });

  const displayDocs = activeTab === 'incoming' ? incomingDocs : outgoingDocs;

  const resolveName = (idOrName: string) => {
    const user = users.find(u => u.id === idOrName);
    return user ? user.name : idOrName;
  };

  const handleAddDocument = async (doc: DocumentTrack) => {
    // 1. Optimistic Update
    setDocuments(prev => [doc, ...prev]);
    setIsModalOpen(false);
    setSuccessModal({
        isOpen: true,
        controlNumber: doc.referenceNumber,
        department: doc.assignedTo
    });

    // 2. Sync to Supabase
    try {
      // Insert Document
      const { error: docError } = await supabase.from('documents').insert(mapDocToDB(doc));
      if (docError) throw docError;

      // Insert Initial Logs
      for (const log of doc.logs) {
        await supabase.from('document_logs').insert(mapLogToDB(log, doc.id));
      }
    } catch (error) {
      console.error("Failed to sync new document:", error);
      alert("Error syncing document to database. Check console.");
    }
  };

  const handleDocClick = (doc: DocumentTrack) => {
      if (activeTab === 'outgoing') {
          setSelectedDocForLogs(doc);
      } else if (activeTab === 'incoming') {
          if (doc.status === DocStatus.INCOMING) {
              setReceiveModal({ isOpen: true, doc });
          } else {
              setDetailModal({ isOpen: true, doc });
          }
      }
  };

  const handleConfirmReceive = async () => {
      const docToReceive = receiveModal.doc;
      if (!docToReceive) return;

      const lastLog = docToReceive.logs.length > 0 ? docToReceive.logs[docToReceive.logs.length - 1] : null;
      const isReturnedDoc = lastLog && lastLog.action.includes('Returned');

      const targetStatus = isReturnedDoc ? DocStatus.RETURNED : DocStatus.PROCESSING;
      const actionText = isReturnedDoc ? 'Received (Returned)' : 'Received Document';
      const remarksText = isReturnedDoc ? 'Document received back from return.' : 'Document physically received.';

      const newLog = {
          id: uuid(),
          date: new Date().toISOString(),
          action: actionText,
          department: currentUser.department,
          userName: currentUser.name,
          status: targetStatus,
          remarks: remarksText
      };

      const updatedDoc = {
          ...docToReceive,
          status: targetStatus,
          updatedAt: new Date().toISOString(),
          logs: [...docToReceive.logs, newLog]
      };

      // Optimistic Update
      setDocuments(prev => prev.map(d => d.id === docToReceive.id ? updatedDoc : d));
      setReceiveModal({ isOpen: false, doc: null });

      // Sync Supabase
      try {
        await supabase.from('documents').update({ status: targetStatus, updated_at: updatedDoc.updatedAt }).eq('id', docToReceive.id);
        await supabase.from('document_logs').insert(mapLogToDB(newLog, docToReceive.id));
      } catch (err) { console.error(err); }
  };

  const handleUpdateRemarks = async (docId: string, newRemarks: string) => {
      const currentDoc = documents.find(d => d.id === docId);
      if (!currentDoc) return;

      const newLog = {
          id: uuid(),
          date: new Date().toISOString(),
          action: 'Remarks Updated',
          department: currentUser.department,
          userName: currentUser.name,
          status: currentDoc.status,
          remarks: `Notes updated: ${newRemarks}`
      };

      const updatedDoc = {
        ...currentDoc,
        remarks: newRemarks,
        updatedAt: new Date().toISOString(),
        logs: [...currentDoc.logs, newLog]
      };

      setDocuments(prev => prev.map(d => d.id === docId ? updatedDoc : d));

      // Sync Supabase
      try {
        await supabase.from('documents').update({ remarks: newRemarks, updated_at: updatedDoc.updatedAt }).eq('id', docId);
        await supabase.from('document_logs').insert(mapLogToDB(newLog, docId));
      } catch (err) { console.error(err); }
  };

  const initiateForward = (e: React.MouseEvent, doc: DocumentTrack) => {
    e.stopPropagation();
    setForwardModal({ isOpen: true, doc });
  };

  const initiateReturn = (e: React.MouseEvent, doc: DocumentTrack) => {
    e.stopPropagation();
    setReturnModal({ isOpen: true, doc });
  };

  const handleForward = async (department: string, remarks: string) => {
      const docToForward = forwardModal.doc;
      if (!docToForward) return;

      const newLog = {
          id: uuid(),
          date: new Date().toISOString(),
          action: `Forwarded to ${department}`,
          department: currentUser.department,
          userName: currentUser.name,
          status: DocStatus.INCOMING,
          remarks: remarks || 'Forwarded for action'
      };

      const updatedDoc = {
          ...docToForward,
          assignedTo: department,
          status: DocStatus.INCOMING,
          updatedAt: new Date().toISOString(),
          logs: [...docToForward.logs, newLog]
      };

      setDocuments(prev => prev.map(d => d.id === docToForward.id ? updatedDoc : d));

      // Sync Supabase
      try {
        await supabase.from('documents').update({ 
            assigned_to: department, 
            status: DocStatus.INCOMING,
            updated_at: updatedDoc.updatedAt 
        }).eq('id', docToForward.id);
        await supabase.from('document_logs').insert(mapLogToDB(newLog, docToForward.id));
      } catch (err) { console.error(err); }
  };

  const handleReturnDocument = async (remarks: string) => {
    const docToReturn = returnModal.doc;
    if (!docToReturn) return;

    const creator = users.find(u => u.id === docToReturn.createdBy);
    const returnToDept = creator ? creator.department : 'Origin';

    const newLog = {
        id: uuid(),
        date: new Date().toISOString(),
        action: `Returned to ${returnToDept}`,
        department: currentUser.department,
        userName: currentUser.name,
        status: DocStatus.INCOMING, 
        remarks: remarks
    };

    const updatedDoc = {
        ...docToReturn,
        assignedTo: returnToDept,
        status: DocStatus.INCOMING,
        remarks: remarks,
        updatedAt: new Date().toISOString(),
        logs: [...docToReturn.logs, newLog]
    };

    setDocuments(prev => prev.map(d => d.id === docToReturn.id ? updatedDoc : d));

    // Sync Supabase
    try {
        await supabase.from('documents').update({ 
            assigned_to: returnToDept, 
            status: DocStatus.INCOMING,
            remarks: remarks,
            updated_at: updatedDoc.updatedAt 
        }).eq('id', docToReturn.id);
        await supabase.from('document_logs').insert(mapLogToDB(newLog, docToReturn.id));
    } catch (err) { console.error(err); }
  };

  const handleMarkAsDone = async (e: React.MouseEvent, doc: DocumentTrack) => {
      e.stopPropagation();
      
      const newLog = {
          id: uuid(),
          date: new Date().toISOString(),
          action: 'Process Completed',
          department: currentUser.department,
          userName: currentUser.name,
          status: DocStatus.COMPLETED,
          remarks: 'Transaction ended.'
      };

      const updatedDoc = {
          ...doc,
          status: DocStatus.COMPLETED,
          updatedAt: new Date().toISOString(),
          logs: [...doc.logs, newLog]
      };

      setDocuments(prev => prev.map(d => d.id === doc.id ? updatedDoc : d));

      // Sync Supabase
      try {
        await supabase.from('documents').update({ 
            status: DocStatus.COMPLETED,
            updated_at: updatedDoc.updatedAt 
        }).eq('id', doc.id);
        await supabase.from('document_logs').insert(mapLogToDB(newLog, doc.id));
      } catch (err) { console.error(err); }
  };

  const handleClearSystemData = async () => {
    if (clearConfirmationText !== 'DELETE') {
        return;
    }
    setIsClearing(true);
    try {
        // Delete all rows from documents. 
        // This works because we use 'neq' (not equal) a dummy ID to select all rows.
        // Cascade delete will automatically remove entries in document_logs.
        const { error } = await supabase.from('documents').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        if (error) throw error;

        // Reset local state
        setDocuments([]);
        setClearDataModal(false);
        setClearConfirmationText('');
        alert("System data has been successfully wiped.");
    } catch (error) {
        console.error("Error clearing data:", error);
        alert("Failed to clear data. Please check console.");
    } finally {
        setIsClearing(false);
    }
  };

  // --- Render ---

  // ADMIN DASHBOARD
  if (currentUser.role === Role.ADMIN) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-white">System Overview</h1>
          <p className="text-sm text-gray-400">Welcome back, Admin.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <StatCard title="Incoming" value={statusCounts[0].value} icon={Inbox} color="bg-gray-600" />
          <StatCard title="Returned" value={statusCounts[1].value} icon={Undo2} color="bg-red-500" />
          <StatCard title="Processing" value={statusCounts[2].value} icon={FileClock} color="bg-yellow-500" />
          <StatCard title="Completed" value={statusCounts[3].value} icon={CheckCircle} color="bg-green-500" />
          <StatCard title="Archived" value={statusCounts[4].value} icon={Archive} color="bg-gray-700" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-700 lg:col-span-2">
            <h3 className="text-lg font-bold text-white mb-4">Document Status Distribution</h3>
            <div className="h-64" style={{ minHeight: '250px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={statusCounts}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" />
                  <XAxis dataKey="name" tick={{fontSize: 12, fill: '#9CA3AF'}} stroke="#4B5563" />
                  <YAxis tick={{fontSize: 12, fill: '#9CA3AF'}} stroke="#4B5563" />
                  <Tooltip 
                    cursor={{fill: '#374151'}} 
                    contentStyle={{borderRadius: '8px', backgroundColor: '#1F2937', border: '1px solid #374151', color: '#F3F4F6'}} 
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={50}>
                    {statusCounts.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-gray-800 p-6 rounded-xl shadow-sm border border-gray-700 flex flex-col">
            <h3 className="text-lg font-bold text-white mb-4">Classification Breakdown</h3>
            <div className="flex-1 flex flex-col">
                <div className="h-48 w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                    <Pie
                        data={priorityData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                    >
                        {priorityData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? '#EF4444' : index === 1 ? '#F59E0B' : '#10B981'} />
                        ))}
                    </Pie>
                    <Tooltip contentStyle={{borderRadius: '8px', backgroundColor: '#1F2937', border: '1px solid #374151', color: '#F3F4F6'}} />
                    </PieChart>
                </ResponsiveContainer>
                </div>
                <div className="flex flex-col justify-center space-y-2 mt-4">
                    <div className="flex items-center text-xs text-gray-400"><div className="w-2 h-2 rounded-full bg-red-500 mr-2"></div> Highly Technical</div>
                    <div className="flex items-center text-xs text-gray-400"><div className="w-2 h-2 rounded-full bg-yellow-500 mr-2"></div> Complex</div>
                    <div className="flex items-center text-xs text-gray-400"><div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div> Simple</div>
                </div>
            </div>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-red-900/10 border border-red-900/50 p-6 rounded-xl flex items-center justify-between">
            <div>
                <h3 className="text-lg font-bold text-red-500 flex items-center">
                    <ShieldAlert className="w-5 h-5 mr-2" />
                    Danger Zone
                </h3>
                <p className="text-sm text-red-400 mt-1">
                    Perform system-wide maintenance.
                </p>
            </div>
            <button 
                onClick={() => setClearDataModal(true)}
                className="bg-red-900/30 hover:bg-red-900/50 text-red-400 hover:text-red-300 border border-red-800 px-4 py-2 rounded-lg transition-colors text-sm font-medium flex items-center"
            >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear All System Data
            </button>
        </div>

        {/* Clear Data Confirmation Modal */}
        {clearDataModal && (
            <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4 animate-fade-in">
                <div className="bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6 relative border border-red-800/50">
                    <button 
                        onClick={() => { setClearDataModal(false); setClearConfirmationText(''); }}
                        className="absolute top-4 right-4 text-gray-500 hover:text-gray-300"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    
                    <div className="flex flex-col items-center text-center">
                        <div className="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center mb-4 border border-red-700 animate-pulse">
                            <AlertTriangle className="w-8 h-8 text-red-500" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Wipe All Data?</h3>
                        <p className="text-sm text-gray-400 mb-6">
                            This action is <span className="font-bold text-red-400">IRREVERSIBLE</span>. It will permanently delete:
                            <br/>• All Documents (Incoming, Processing, Completed)
                            <br/>• All Transaction Logs
                            <br/>• All Control Numbers (Reset to 001)
                        </p>
                        
                        <div className="w-full mb-6 text-left">
                            <label className="block text-xs font-medium text-gray-500 mb-1 uppercase">Type "DELETE" to confirm</label>
                            <input 
                                type="text" 
                                value={clearConfirmationText}
                                onChange={(e) => setClearConfirmationText(e.target.value)}
                                className="w-full bg-gray-900 border border-red-900/50 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-red-500 placeholder-gray-600"
                                placeholder="DELETE"
                            />
                        </div>

                        <div className="flex space-x-3 w-full">
                            <button
                                onClick={() => { setClearDataModal(false); setClearConfirmationText(''); }}
                                className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleClearSystemData}
                                disabled={clearConfirmationText !== 'DELETE' || isClearing}
                                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isClearing ? 'Wiping...' : 'Confirm Wipe'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        )}

      </div>
    );
  }

  // USER DASHBOARD
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
           <h1 className="text-2xl font-bold text-white">My Workspace</h1>
           <p className="text-sm text-gray-400">Manage your incoming and outgoing documents.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center space-x-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors shadow-sm border border-gray-600"
        >
          <Plus className="w-4 h-4" />
          <span>New Document</span>
        </button>
      </div>

      <div className="bg-gray-800 rounded-xl shadow-sm border border-gray-700 overflow-hidden min-h-[500px]">
        {/* Tabs */}
        <div className="flex border-b border-gray-700">
            <button
                onClick={() => setActiveTab('incoming')}
                className={`flex-1 py-4 text-sm font-medium flex items-center justify-center space-x-2 border-b-2 transition-colors ${
                    activeTab === 'incoming' 
                    ? 'border-gray-500 text-gray-200 bg-gray-700/50' 
                    : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-gray-800'
                }`}
            >
                <ArrowDownLeft className="w-4 h-4" />
                <span>Incoming ({incomingDocs.length})</span>
            </button>
            <button
                onClick={() => setActiveTab('outgoing')}
                className={`flex-1 py-4 text-sm font-medium flex items-center justify-center space-x-2 border-b-2 transition-colors ${
                    activeTab === 'outgoing' 
                    ? 'border-gray-500 text-gray-200 bg-gray-700/50' 
                    : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-gray-800'
                }`}
            >
                <ArrowUpRight className="w-4 h-4" />
                <span>Outgoing ({outgoingDocs.length})</span>
            </button>
        </div>

        {/* List Content */}
        <div className="divide-y divide-gray-700">
            {displayDocs.length > 0 ? (
                displayDocs.map(doc => {
                    const lastLog = doc.logs.length > 0 ? doc.logs[doc.logs.length - 1] : null;
                    const isReturned = lastLog && lastLog.action.includes('Returned') && doc.status === DocStatus.INCOMING;
                    const wasReturned = doc.logs.some(l => l.action.toLowerCase().includes('returned'));

                    return (
                    <div 
                        key={doc.id} 
                        onClick={() => handleDocClick(doc)}
                        className={`p-4 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-gray-700 active:bg-gray-600`}
                    >
                        <div className="flex items-start space-x-4 flex-1">
                            <div className={`p-3 rounded-lg hidden sm:block ${activeTab === 'incoming' ? 'bg-gray-700 text-gray-300' : 'bg-gray-700/50 text-gray-400'}`}>
                                <FileText className="w-6 h-6" />
                            </div>
                            <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                    <h3 className="text-sm font-semibold text-gray-100 flex items-center gap-2">
                                        {doc.title}
                                        <MousePointerClick className="w-3 h-3 text-gray-500 opacity-50" />
                                    </h3>
                                    <span className="text-xs text-gray-500 font-mono">{doc.referenceNumber}</span>
                                </div>
                                <p className="text-sm text-gray-400 mt-1 line-clamp-1">{doc.description}</p>
                                <div className="flex flex-col sm:flex-row sm:items-center space-y-1 sm:space-y-0 sm:space-x-4 mt-2">
                                    {doc.remarks && (
                                    <p className={`text-xs italic ${isReturned ? 'text-red-400 font-medium' : 'text-gray-500'}`}>
                                        {isReturned ? 'Return Reason: ' : 'Note: '} {doc.remarks}
                                    </p>
                                    )}
                                </div>
                                <div className="flex items-center space-x-4 mt-2">
                                    <span className="text-xs text-gray-500">
                                        {activeTab === 'incoming' ? 'From: ' : 'To: '} 
                                        <span className="font-medium text-gray-300">
                                            {activeTab === 'incoming' ? resolveName(doc.createdBy) : resolveName(doc.assignedTo)}
                                        </span>
                                    </span>
                                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                                        doc.priority === 'Highly Technical Transaction' ? 'bg-red-900/50 text-red-300 border border-red-800' : 
                                        doc.priority === 'Complex Transaction' ? 'bg-orange-900/50 text-orange-300 border border-orange-800' : 'bg-green-900/50 text-green-300 border border-green-800'
                                    }`}>
                                        {doc.priority}
                                    </span>
                                    
                                    {doc.status === DocStatus.COMPLETED && wasReturned && (
                                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-900/50 text-red-300 border border-red-800">
                                            RETURNED
                                        </span>
                                    )}

                                    <span className="text-xs text-gray-500">{new Date(doc.createdAt).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center space-x-2">
                            {activeTab === 'incoming' && doc.status === DocStatus.PROCESSING && (
                                <div className="flex space-x-2 mr-2">
                                    <button 
                                        onClick={(e) => initiateReturn(e, doc)}
                                        className="flex items-center space-x-1 px-3 py-1.5 bg-red-900/40 text-red-300 hover:bg-red-900/60 border border-red-800/50 rounded text-xs font-medium transition-colors"
                                        title="Return to originating department"
                                    >
                                        <Undo2 className="w-3 h-3" />
                                        <span>Return</span>
                                    </button>
                                    <button 
                                        onClick={(e) => initiateForward(e, doc)}
                                        className="flex items-center space-x-1 px-3 py-1.5 bg-gray-700 text-gray-300 hover:bg-gray-600 border border-gray-600 rounded text-xs font-medium transition-colors"
                                        title="Forward to another office"
                                    >
                                        <Send className="w-3 h-3" />
                                        <span>Forward</span>
                                    </button>
                                    <button 
                                        onClick={(e) => handleMarkAsDone(e, doc)}
                                        className="flex items-center space-x-1 px-3 py-1.5 bg-green-900/40 text-green-300 hover:bg-green-900/60 border border-green-800/50 rounded text-xs font-medium transition-colors"
                                        title="Mark as Completed"
                                    >
                                        <CheckSquare className="w-3 h-3" />
                                        <span>Done</span>
                                    </button>
                                </div>
                            )}

                            {!(activeTab === 'outgoing' && (doc.status === DocStatus.INCOMING || doc.status === DocStatus.PROCESSING || doc.status === DocStatus.OUTGOING)) && (
                                <span className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap border ${
                                    doc.status === DocStatus.COMPLETED ? 'bg-green-900/50 text-green-300 border-green-800' : 
                                    doc.status === DocStatus.RETURNED || isReturned ? 'bg-red-900/50 text-red-300 border-red-800' : 
                                    doc.status === DocStatus.PROCESSING ? 'bg-yellow-900/50 text-yellow-300 border-yellow-800' : 
                                    doc.status === DocStatus.OUTGOING ? 'bg-orange-900/50 text-orange-300 border-orange-800' : 
                                    'bg-gray-700 text-gray-300 border-gray-600'
                                }`}>
                                    {doc.status === DocStatus.COMPLETED ? 'DONE PROCESS' : (doc.status === DocStatus.RETURNED || isReturned ? 'RETURNED' : doc.status)}
                                </span>
                            )}
                        </div>
                    </div>
                )})
            ) : (
                <div className="py-20 text-center">
                    <div className="bg-gray-700 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                        <Inbox className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-gray-200 font-medium">No documents found</h3>
                    <p className="text-gray-500 text-sm mt-1">You have no {activeTab} documents at the moment.</p>
                </div>
            )}
        </div>
      </div>

      <AddDocumentModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={handleAddDocument}
        currentUser={currentUser}
        users={users}
        documents={documents}
      />
      
      <SuccessModal 
        isOpen={successModal.isOpen} 
        onClose={() => setSuccessModal(prev => ({ ...prev, isOpen: false }))}
        controlNumber={successModal.controlNumber}
        department={successModal.department}
      />

      <DocumentLogsModal 
        isOpen={!!selectedDocForLogs}
        onClose={() => setSelectedDocForLogs(null)}
        document={selectedDocForLogs}
      />

      <ReceiveConfirmationModal 
        isOpen={receiveModal.isOpen}
        onClose={() => setReceiveModal({ isOpen: false, doc: null })}
        onConfirm={handleConfirmReceive}
        document={receiveModal.doc}
      />

      <DocumentDetailModal 
        isOpen={detailModal.isOpen}
        onClose={() => setDetailModal({ isOpen: false, doc: null })}
        document={detailModal.doc}
        onUpdateRemarks={handleUpdateRemarks}
      />

      <ForwardDocumentModal
        isOpen={forwardModal.isOpen}
        onClose={() => setForwardModal({ isOpen: false, doc: null })}
        onForward={handleForward}
        document={forwardModal.doc}
        users={users}
        currentUser={currentUser}
      />

      <ReturnDocumentModal
        isOpen={returnModal.isOpen}
        onClose={() => setReturnModal({ isOpen: false, doc: null })}
        onConfirm={handleReturnDocument}
        document={returnModal.doc}
      />
    </div>
  );
};
