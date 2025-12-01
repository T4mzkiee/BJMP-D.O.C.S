
import React, { useState, useMemo } from 'react';
import { DocumentTrack, DocStatus, User, Role, Department } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { FileClock, CheckCircle, Inbox, Archive, Plus, FileText, ArrowUpRight, ArrowDownLeft, MousePointerClick, Send, CheckSquare, Undo2, Trash2, AlertTriangle, X, ShieldAlert, Building2, Download } from 'lucide-react';
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
  departments: Department[];
  currentUser: User;
}

export const Dashboard: React.FC<DashboardProps> = ({ documents, setDocuments, users, setUsers, departments, currentUser }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'incoming' | 'outgoing'>('incoming');
  const [successModal, setSuccessModal] = useState<{ isOpen: boolean; controlNumber: string; department: string }>({
    isOpen: false,
    controlNumber: '',
    department: ''
  });
  
  // Modal States
  const [selectedDocForLogs, setSelectedDocForLogs] = useState<DocumentTrack | null>(null);
  const [receiveModal, setReceiveModal] = useState<{ isOpen: boolean; doc: DocumentTrack | null }>({ isOpen: false, doc: null });
  const [detailModal, setDetailModal] = useState<{ isOpen: boolean; doc: DocumentTrack | null }>({ isOpen: false, doc: null });
  const [forwardModal, setForwardModal] = useState<{ isOpen: boolean; doc: DocumentTrack | null }>({ isOpen: false, doc: null });
  const [returnModal, setReturnModal] = useState<{ isOpen: boolean; doc: DocumentTrack | null }>({ isOpen: false, doc: null });

  // Clear Data States
  const [clearDataModal, setClearDataModal] = useState(false);
  const [clearConfirmationText, setClearConfirmationText] = useState('');
  const [isClearing, setIsClearing] = useState(false);

  // Department Management States
  const [deptModalOpen, setDeptModalOpen] = useState(false);
  const [newDeptName, setNewDeptName] = useState('');
  const [isAddingDept, setIsAddingDept] = useState(false);

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
    { name: 'Incoming', value: regularIncomingCount, color: '#3B82F6' },
    { name: 'Returned', value: returnedDocsCount, color: '#EF4444' },
    { name: 'Processing', value: documents.filter(d => d.status === DocStatus.PROCESSING).length, color: '#F59E0B' },
    { name: 'Completed', value: documents.filter(d => d.status === DocStatus.COMPLETED).length, color: '#10B981' },
    { name: 'Archived', value: documents.filter(d => d.status === DocStatus.ARCHIVED).length, color: '#6B7280' },
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

  // --- Department Logic ---
  const handleAddDepartment = async () => {
    if (!newDeptName.trim()) return;
    setIsAddingDept(true);
    try {
        const { error } = await supabase.from('departments').insert({ name: newDeptName.toUpperCase().trim() });
        if (error) throw error;
        setNewDeptName('');
    } catch (error) {
        console.error('Error adding department:', error);
        alert('Failed to add department. It might already exist.');
    } finally {
        setIsAddingDept(false);
    }
  };

  const handleDeleteDepartment = async (id: string) => {
    if(!confirm("Are you sure you want to delete this department?")) return;
    try {
        await supabase.from('departments').delete().eq('id', id);
    } catch (error) {
        console.error('Error deleting department:', error);
    }
  };

  // --- Export Logic ---
  const handleExportData = () => {
    const headers = [
      "Control Number",
      "Subject",
      "Description",
      "Status",
      "Priority",
      "Communication Type",
      "Assigned To",
      "Date Created",
      "Last Updated"
    ];

    const csvRows = [headers.join(',')];

    documents.forEach(doc => {
      const row = [
        doc.referenceNumber,
        `"${doc.title.replace(/"/g, '""')}"`, // Escape quotes
        `"${doc.description.replace(/"/g, '""').replace(/\n/g, ' ')}"`, // Escape quotes and newlines
        doc.status,
        doc.priority,
        doc.communicationType || 'Regular',
        doc.assignedTo,
        new Date(doc.createdAt).toLocaleDateString(),
        new Date(doc.updatedAt).toLocaleDateString()
      ];
      csvRows.push(row.join(','));
    });

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BJMP_Docs_Export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // --- User View Logic ---
  
  // SORTING FUNCTION
  const sortDocuments = (docs: DocumentTrack[]) => {
    const typeWeight: Record<string, number> = {
      'Urgent': 3,
      'Priority': 2,
      'Regular': 1
    };

    return [...docs].sort((a, b) => {
      const weightA = typeWeight[a.communicationType || 'Regular'] || 1;
      const weightB = typeWeight[b.communicationType || 'Regular'] || 1;

      if (weightA !== weightB) {
        return weightB - weightA;
      }

      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      
      if (isNaN(dateA)) return 1;
      if (isNaN(dateB)) return -1;

      return dateB - dateA;
    });
  };

  const incomingDocs = useMemo(() => {
    const filtered = documents.filter(d => 
      d.assignedTo === currentUser.department &&
      d.status !== DocStatus.COMPLETED &&
      d.status !== DocStatus.RETURNED
    );
    return sortDocuments(filtered);
  }, [documents, currentUser.department]);

  const outgoingDocs = useMemo(() => {
    const filtered = documents.filter(d => {
      const creator = users.find(u => u.id === d.createdBy);
      const createdByMyDept = creator?.department === currentUser.department;
      
      const forwardedByMyDept = d.logs.some(log => 
          log.department === currentUser.department && log.action.includes('Forwarded')
      );

      const currentlyWithMyDept = d.assignedTo === currentUser.department;

      return (createdByMyDept || forwardedByMyDept) && !currentlyWithMyDept;
    });
    return sortDocuments(filtered);
  }, [documents, currentUser.department, users]);

  const displayDocs = activeTab === 'incoming' ? incomingDocs : outgoingDocs;

  const resolveName = (idOrName: string) => {
    const user = users.find(u => u.id === idOrName);
    return user ? user.name : idOrName;
  };

  const handleAddDocument = async (doc: DocumentTrack) => {
    setDocuments(prev => [doc, ...prev]);
    setIsModalOpen(false);
    setSuccessModal({
        isOpen: true,
        controlNumber: doc.referenceNumber,
        department: doc.assignedTo
    });

    try {
      const { error: docError } = await supabase.from('documents').insert(mapDocToDB(doc));
      if (docError) throw docError;
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

      setDocuments(prev => prev.map(d => d.id === docToReceive.id ? updatedDoc : d));
      setReceiveModal({ isOpen: false, doc: null });

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
        const { error } = await supabase.from('documents').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        if (error) throw error;
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
          <div>
            <h1 className="text-2xl font-bold text-white">System Overview</h1>
            <p className="text-sm text-gray-400">Welcome back, Admin.</p>
          </div>
          <div className="flex space-x-2">
            <button 
                onClick={handleExportData}
                className="bg-gray-800 border border-gray-700 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center transition-colors"
            >
                <Download className="w-4 h-4 mr-2 text-green-400" />
                Extract Data
            </button>
            <button 
                onClick={() => setDeptModalOpen(true)}
                className="bg-gray-800 border border-gray-700 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center transition-colors"
            >
                <Building2 className="w-4 h-4 mr-2 text-blue-400" />
                Manage Departments
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <StatCard title="Incoming" value={statusCounts[0].value} icon={Inbox} color="bg-blue-600" />
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
                  <Tooltip cursor={{fill: '#374151'}} contentStyle={{borderRadius: '8px', backgroundColor: '#1F2937', border: '1px solid #374151', color: '#F3F4F6'}} />
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

        {/* Department Management Modal */}
        {deptModalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4 animate-fade-in">
                <div className="bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6 relative border border-gray-700 h-[80vh] flex flex-col">
                    <button 
                        onClick={() => setDeptModalOpen(false)}
                        className="absolute top-4 right-4 text-gray-500 hover:text-gray-300"
                    >
                        <X className="w-5 h-5" />
                    </button>
                    
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                        <Building2 className="w-5 h-5 mr-2 text-blue-500" />
                        Manage Departments
                    </h2>

                    <div className="flex space-x-2 mb-4">
                        <input 
                            type="text" 
                            placeholder="New Department Name" 
                            value={newDeptName}
                            onChange={(e) => setNewDeptName(e.target.value)}
                            className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                        <button 
                            onClick={handleAddDepartment}
                            disabled={!newDeptName.trim() || isAddingDept}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
                        >
                            Add
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                        {departments.map(dept => (
                            <div key={dept.id} className="flex justify-between items-center bg-gray-700/50 p-3 rounded-lg border border-gray-700 group hover:border-gray-600">
                                <span className="text-gray-200 font-medium text-sm">{dept.name}</span>
                                <button 
                                    onClick={() => handleDeleteDepartment(dept.id)}
                                    className="text-gray-500 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        )}

        {/* Clear Data Modal */}
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

  // USER & MESSAGE CENTER DASHBOARD
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
           <h1 className="text-2xl font-bold text-white">
             {currentUser.role === Role.MESSAGE_CENTER ? 'Message Center Dispatch' : 'My Workspace'}
           </h1>
           <p className="text-sm text-gray-400">Manage your incoming and outgoing documents.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm"
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
                    ? 'border-blue-500 text-blue-400 bg-gray-700/50' 
                    : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-700'
                }`}
            >
                <ArrowDownLeft className="w-4 h-4" />
                <span>Incoming ({incomingDocs.length})</span>
            </button>
            <button
                onClick={() => setActiveTab('outgoing')}
                className={`flex-1 py-4 text-sm font-medium flex items-center justify-center space-x-2 border-b-2 transition-colors ${
                    activeTab === 'outgoing' 
                    ? 'border-blue-500 text-blue-400 bg-gray-700/50' 
                    : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-700'
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
                            <div className={`p-3 rounded-lg hidden sm:block ${activeTab === 'incoming' ? 'bg-blue-900/30 text-blue-400' : 'bg-orange-900/30 text-orange-400'}`}>
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

                                    {/* Communication Type Badge with Effects */}
                                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                                        doc.communicationType === 'Urgent' ? 'bg-red-600 text-white border border-red-400 animate-pulse font-bold shadow-red-500/50 shadow-lg' : 
                                        doc.communicationType === 'Priority' ? 'bg-yellow-900/50 text-yellow-300 border border-yellow-800 animate-pulse' : 
                                        'bg-gray-700/50 text-gray-300 border border-gray-600'
                                    }`}>
                                        {doc.communicationType || 'Regular'}
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
                                        className="flex items-center space-x-1 px-3 py-1.5 bg-indigo-900/40 text-indigo-300 hover:bg-indigo-900/60 border border-indigo-800/50 rounded text-xs font-medium transition-colors"
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
                                    'bg-blue-900/50 text-blue-300 border-blue-800'
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
        departments={departments}
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
        departments={departments}
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
