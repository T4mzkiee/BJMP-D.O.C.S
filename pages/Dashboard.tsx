
import React, { useState } from 'react';
import { DocumentTrack, DocStatus, User, Role } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { FileClock, CheckCircle, Inbox, Archive, Plus, FileText, ArrowUpRight, ArrowDownLeft, MousePointerClick, Send, CheckSquare, Undo2 } from 'lucide-react';
import { AddDocumentModal } from '../components/AddDocumentModal';
import { SuccessModal } from '../components/SuccessModal';
import { DocumentLogsModal } from '../components/DocumentLogsModal';
import { ReceiveConfirmationModal } from '../components/ReceiveConfirmationModal';
import { DocumentDetailModal } from '../components/DocumentDetailModal';
import { ForwardDocumentModal } from '../components/ForwardDocumentModal';
import { ReturnDocumentModal } from '../components/ReturnDocumentModal';

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

  // --- Admin View Logic ---
  
  // Helper to check if a document is currently in "Returned" state (for filtering Incoming bucket)
  const isDocCurrentlyReturned = (d: DocumentTrack) => {
    if (d.status !== DocStatus.INCOMING) return false;
    const lastLog = d.logs.length > 0 ? d.logs[d.logs.length - 1] : null;
    return lastLog && lastLog.action.includes('Returned');
  };

  // Modified: Count ANY document that has ever been returned (History check)
  // This ensures the count persists on the graph even after the document is completed.
  const returnedDocsCount = documents.filter(d => 
    d.logs.some(l => l.action.includes('Returned'))
  ).length;

  // Regular incoming are those that are INCOMING but NOT currently returned
  const regularIncomingCount = documents.filter(d => d.status === DocStatus.INCOMING && !isDocCurrentlyReturned(d)).length;

  const statusCounts = [
    { name: 'Incoming', value: regularIncomingCount, color: '#3B82F6' },
    { name: 'Returned', value: returnedDocsCount, color: '#EF4444' }, // Red for returned
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

  // --- User View Logic ---
  
  // Incoming: Assigned to ME or my DEPARTMENT
  // We strictly check the department now, ensuring any user in the department sees the doc.
  // Exclude COMPLETED and RETURNED docs from Incoming tab
  const incomingDocs = documents.filter(d => 
    d.assignedTo === currentUser.department &&
    d.status !== DocStatus.COMPLETED &&
    d.status !== DocStatus.RETURNED
  );

  // Outgoing: 
  // 1. Created by someone in MY DEPARTMENT
  // 2. OR Forwarded by someone in MY DEPARTMENT
  // 3. AND Not currently assigned to MY DEPARTMENT (It's with someone else)
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

  // Helper to display name (User Name if ID matches, otherwise assumes it is a Department Name)
  const resolveName = (idOrName: string) => {
    const user = users.find(u => u.id === idOrName);
    return user ? user.name : idOrName;
  };

  const handleAddDocument = (doc: DocumentTrack) => {
    setDocuments(prev => [doc, ...prev]);
    setIsModalOpen(false); // Close modal
    // Show success prompt
    setSuccessModal({
        isOpen: true,
        controlNumber: doc.referenceNumber,
        department: doc.assignedTo
    });
  };

  const handleDocClick = (doc: DocumentTrack) => {
      // If clicking the card body (not specific buttons)
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

  const handleConfirmReceive = () => {
      const docToReceive = receiveModal.doc;
      if (!docToReceive) return;

      // Check if this document was returned (Last action was "Returned")
      const lastLog = docToReceive.logs.length > 0 ? docToReceive.logs[docToReceive.logs.length - 1] : null;
      const isReturnedDoc = lastLog && lastLog.action.includes('Returned');

      setDocuments(prev => prev.map(d => {
          if (d.id === docToReceive.id) {
              // If returned, set status to RETURNED. Else, set to processing.
              const targetStatus = isReturnedDoc ? DocStatus.RETURNED : DocStatus.PROCESSING;
              const actionText = isReturnedDoc ? 'Received (Returned)' : 'Received Document';
              const remarksText = isReturnedDoc ? 'Document received back from return.' : 'Document physically received.';

              const newLog = {
                  id: Math.random().toString(36).substr(2, 9),
                  date: new Date().toISOString(),
                  action: actionText,
                  department: currentUser.department,
                  userName: currentUser.name,
                  status: targetStatus,
                  remarks: remarksText
              };

              return {
                  ...d,
                  status: targetStatus,
                  updatedAt: new Date().toISOString(),
                  logs: [...d.logs, newLog]
              };
          }
          return d;
      }));

      setReceiveModal({ isOpen: false, doc: null });
  };

  const handleUpdateRemarks = (docId: string, newRemarks: string) => {
      setDocuments(prev => prev.map(d => {
          if (d.id === docId) {
             const newLog = {
                  id: Math.random().toString(36).substr(2, 9),
                  date: new Date().toISOString(),
                  action: 'Remarks Updated',
                  department: currentUser.department,
                  userName: currentUser.name,
                  status: d.status,
                  remarks: `Notes updated: ${newRemarks}`
              };

              return {
                  ...d,
                  remarks: newRemarks,
                  updatedAt: new Date().toISOString(),
                  logs: [...d.logs, newLog]
              };
          }
          return d;
      }));
  };

  // --- Forward Logic ---
  const initiateForward = (e: React.MouseEvent, doc: DocumentTrack) => {
      e.stopPropagation(); // Prevent opening detail modal
      setForwardModal({ isOpen: true, doc });
  };

  const handleForward = (department: string, remarks: string) => {
      const docToForward = forwardModal.doc;
      if (!docToForward) return;

      setDocuments(prev => prev.map(d => {
          if (d.id === docToForward.id) {
               const newLog = {
                  id: Math.random().toString(36).substr(2, 9),
                  date: new Date().toISOString(),
                  action: `Forwarded to ${department}`,
                  department: currentUser.department,
                  userName: currentUser.name,
                  status: DocStatus.INCOMING, // Status becomes INCOMING for the next person
                  remarks: remarks || 'Forwarded for action'
              };

              return {
                  ...d,
                  assignedTo: department, // Reassign to new department
                  status: DocStatus.INCOMING, // Reset status to Incoming for the new department
                  updatedAt: new Date().toISOString(),
                  logs: [...d.logs, newLog]
              };
          }
          return d;
      }));
  };

  // --- Return Logic ---
  const initiateReturn = (e: React.MouseEvent, doc: DocumentTrack) => {
    e.stopPropagation();
    setReturnModal({ isOpen: true, doc });
  };

  const handleReturnDocument = (remarks: string) => {
    const docToReturn = returnModal.doc;
    if (!docToReturn) return;

    // Determine return destination:
    // Ideally, return to the Creator's Department.
    const creator = users.find(u => u.id === docToReturn.createdBy);
    const returnToDept = creator ? creator.department : 'Origin';

    setDocuments(prev => prev.map(d => {
        if (d.id === docToReturn.id) {
            const newLog = {
                id: Math.random().toString(36).substr(2, 9),
                date: new Date().toISOString(),
                action: `Returned to ${returnToDept}`,
                department: currentUser.department,
                userName: currentUser.name,
                status: DocStatus.INCOMING, 
                remarks: remarks
            };

            return {
                ...d,
                assignedTo: returnToDept, // Send back to origin
                status: DocStatus.INCOMING, // Set as Incoming for them
                remarks: remarks, // IMPORTANT: Update the main remarks to show the return reason
                updatedAt: new Date().toISOString(),
                logs: [...d.logs, newLog]
            };
        }
        return d;
    }));
  };

  // --- Done Logic ---
  const handleMarkAsDone = (e: React.MouseEvent, doc: DocumentTrack) => {
      e.stopPropagation();
      // REMOVED CONFIRMATION for instant action
      
      setDocuments(prev => prev.map(d => {
          if (d.id === doc.id) {
               const newLog = {
                  id: Math.random().toString(36).substr(2, 9),
                  date: new Date().toISOString(),
                  action: 'Process Completed',
                  department: currentUser.department,
                  userName: currentUser.name,
                  status: DocStatus.COMPLETED,
                  remarks: 'Transaction ended.'
              };

              return {
                  ...d,
                  status: DocStatus.COMPLETED,
                  updatedAt: new Date().toISOString(),
                  logs: [...d.logs, newLog]
              };
          }
          return d;
      }));
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
          <StatCard title="Incoming" value={statusCounts[0].value} icon={Inbox} color="bg-blue-500" />
          <StatCard title="Returned" value={statusCounts[1].value} icon={Undo2} color="bg-red-500" />
          <StatCard title="Processing" value={statusCounts[2].value} icon={FileClock} color="bg-yellow-500" />
          <StatCard title="Completed" value={statusCounts[3].value} icon={CheckCircle} color="bg-green-500" />
          <StatCard title="Archived" value={statusCounts[4].value} icon={Archive} color="bg-gray-500" />
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
                    // Check if the document was returned (current state)
                    const lastLog = doc.logs.length > 0 ? doc.logs[doc.logs.length - 1] : null;
                    const isReturned = lastLog && lastLog.action.includes('Returned') && doc.status === DocStatus.INCOMING;

                    // Check if document WAS returned in its history (for completed docs)
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
                                    
                                    {/* Additional RETURNED badge for completed documents that were returned */}
                                    {doc.status === DocStatus.COMPLETED && wasReturned && (
                                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-900/50 text-red-300 border border-red-800">
                                            RETURNED
                                        </span>
                                    )}

                                    <span className="text-xs text-gray-500">{new Date(doc.createdAt).toLocaleDateString()}</span>
                                </div>
                            </div>
                        </div>

                        {/* Right Side: Status or Actions */}
                        <div className="flex items-center space-x-2">
                            {/* Show Actions only for Incoming documents that are Processing */}
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

                            {/* Hide status for Outgoing tab if it is Incoming or Processing, as requested. 
                                BUT show if it is COMPLETED or RETURNED. */}
                            {!(activeTab === 'outgoing' && (doc.status === DocStatus.INCOMING || doc.status === DocStatus.PROCESSING || doc.status === DocStatus.OUTGOING)) && (
                                <span className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap border ${
                                    doc.status === DocStatus.COMPLETED ? 'bg-green-900/50 text-green-300 border-green-800' : 
                                    doc.status === DocStatus.RETURNED || isReturned ? 'bg-red-900/50 text-red-300 border-red-800' : // Red badge for returned
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