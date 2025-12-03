
import React, { useState, useMemo } from 'react';
import { DocumentTrack, DocStatus, User, Role, Department } from '../types';
import { Plus, Search, FileText, MoreHorizontal, Sparkles, History, Trash2, AlertTriangle, X, ShieldAlert, Loader2, Filter, Archive } from 'lucide-react';
import { AddDocumentModal } from '../components/AddDocumentModal';
import { SuccessModal } from '../components/SuccessModal';
import { DocumentLogsModal } from '../components/DocumentLogsModal';
import { supabase, mapDocFromDB, mapLogToDB } from '../utils/supabase';
import { uuid } from '../utils/crypto';

interface DocsProps {
  documents: DocumentTrack[];
  setDocuments: React.Dispatch<React.SetStateAction<DocumentTrack[]>>;
  currentUser: User;
  users: User[];
  departments: Department[];
  isArchiveView?: boolean; // NEW: Prop to toggle Archive mode
}

export const DocumentsPage: React.FC<DocsProps> = ({ documents, setDocuments, currentUser, users, departments, isArchiveView = false }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  // If isArchiveView is true, force default filter to ARCHIVED
  const [statusFilter, setStatusFilter] = useState<string>(isArchiveView ? DocStatus.ARCHIVED : 'ALL'); 
  const [selectedDoc, setSelectedDoc] = useState<DocumentTrack | null>(null);
  const [successModal, setSuccessModal] = useState<{ isOpen: boolean; controlNumber: string; department: string }>({
    isOpen: false,
    controlNumber: '',
    department: ''
  });
  
  // Delete Modal State
  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; doc: DocumentTrack | null }>({
    isOpen: false,
    doc: null
  });

  // Clear Data Modal State
  const [clearModal, setClearModal] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [clearConfirmText, setClearConfirmText] = useState('');

  const handleSave = (doc: DocumentTrack) => {
    setDocuments(prev => [doc, ...prev]);
    setIsModalOpen(false);
    setSuccessModal({
        isOpen: true,
        controlNumber: doc.referenceNumber,
        department: doc.assignedTo
    });
  };

  const handleDeleteClick = (e: React.MouseEvent, doc: DocumentTrack) => {
    e.stopPropagation();
    setDeleteModal({ isOpen: true, doc });
  };

  const handleArchive = async (e: React.MouseEvent, doc: DocumentTrack) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to archive this document?")) return;

    const newLog = {
      id: uuid(),
      date: new Date().toISOString(),
      action: 'Document Archived',
      department: currentUser.department,
      userName: currentUser.name,
      status: DocStatus.ARCHIVED,
      remarks: 'Document moved to archive.'
    };

    const updatedDoc = {
      ...doc,
      status: DocStatus.ARCHIVED,
      updatedAt: new Date().toISOString(),
      logs: [...doc.logs, newLog]
    };

    setDocuments(prev => prev.map(d => d.id === doc.id ? updatedDoc : d));

    try {
      await supabase.from('documents').update({ 
        status: DocStatus.ARCHIVED,
        updated_at: updatedDoc.updatedAt
      }).eq('id', doc.id);
      await supabase.from('document_logs').insert(mapLogToDB(newLog, doc.id));
    } catch (err) {
      console.error(err);
    }
  };

  const confirmDelete = async () => {
    if (deleteModal.doc) {
        setDocuments(prev => prev.filter(d => d.id !== deleteModal.doc!.id));
        
        // Sync Supabase
        await supabase.from('documents').delete().eq('id', deleteModal.doc.id);

        setDeleteModal({ isOpen: false, doc: null });
    }
  };

  const handleSmartClearData = async () => {
    if (clearConfirmText !== 'CONFIRM') return;
    
    setIsClearing(true);
    try {
        // 1. Identify "Keepers" (Latest document for each series) to preserve control numbers
        const prefixMap = new Map<string, { id: string, series: number }>();

        documents.forEach(doc => {
            // Check if it's already a checkpoint
            if (doc.title === '_SYSTEM_CHECKPOINT_') return;

            // Logic matches GenerateControlNumber: Ends in 3 digits
            const len = doc.referenceNumber.length;
            if (len > 3) {
                const prefix = doc.referenceNumber.slice(0, -3);
                const seriesStr = doc.referenceNumber.slice(-3);
                const series = parseInt(seriesStr, 10);
                
                if (!isNaN(series)) {
                    if (!prefixMap.has(prefix) || series > prefixMap.get(prefix)!.series) {
                        prefixMap.set(prefix, { id: doc.id, series });
                    }
                }
            }
        });

        const idsToKeep = Array.from(prefixMap.values()).map(x => x.id);

        // 2. Wipe ALL Logs
        await supabase.from('document_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');

        // 3. Wipe Documents (Except Keepers AND Existing Checkpoints)
        if (idsToKeep.length > 0) {
            // Delete everything NOT in the keep list AND NOT an existing checkpoint
            await supabase.from('documents').delete()
                .neq('title', '_SYSTEM_CHECKPOINT_')
                .not('id', 'in', `(${idsToKeep.join(',')})`);
            
            // Convert Keepers into "System Checkpoints"
            // We strip them of sensitive info but keep the ID and Reference Number
            await supabase.from('documents').update({
                title: '_SYSTEM_CHECKPOINT_',
                description: 'Hidden system record to maintain control number continuity.',
                status: DocStatus.ARCHIVED,
                assigned_to: 'SYSTEM',
                summary: '',
                remarks: '',
                priority: 'Simple Transaction',
                communication_type: 'Regular'
            }).in('id', idsToKeep);
        } else {
            // If no NEW documents exist to keep, just wipe everything EXCEPT existing checkpoints
            await supabase.from('documents').delete().neq('title', '_SYSTEM_CHECKPOINT_');
        }

        // 4. Refresh State
        const { data } = await supabase.from('documents').select(`*, logs:document_logs(*)`);
        if (data) {
            // Re-map and update state
            const appDocs = data.map((d: any) => mapDocFromDB(d, d.logs || []));
            setDocuments(appDocs);
        } else {
            setDocuments([]);
        }

        setClearModal(false);
        setClearConfirmText('');
        alert("Data cleared successfully. Control number series have been preserved.");

    } catch (error) {
        console.error("Error clearing data:", error);
        alert("An error occurred while clearing data.");
    } finally {
        setIsClearing(false);
    }
  };

  const statusColor = (status: DocStatus, isReturned: boolean) => {
    if (status === DocStatus.RETURNED || isReturned) return 'bg-red-900/50 text-red-300 border border-red-800';
    switch (status) {
      case DocStatus.INCOMING: return 'bg-blue-900/50 text-blue-300 border border-blue-800';
      case DocStatus.OUTGOING: return 'bg-orange-900/50 text-orange-300 border border-orange-800';
      case DocStatus.PROCESSING: return 'bg-yellow-900/50 text-yellow-300 border border-yellow-800';
      case DocStatus.COMPLETED: return 'bg-green-900/50 text-green-300 border border-green-800';
      case DocStatus.ARCHIVED: return 'bg-gray-700 text-gray-400 border border-gray-600';
      default: return 'bg-gray-700 text-gray-300 border border-gray-600';
    }
  };

  const relevantDocs = useMemo(() => {
    // Create a copy to avoid mutating state
    if (currentUser.role === Role.ADMIN) {
      return [...documents];
    } 
    
    // Strict Filter: Only show documents where the Originating Department matches the Current User's Department
    return documents.filter(doc => {
      // 1. Identify Originating Department
      let originDept = '';
      
      // Try getting from Creator ID
      const creator = users.find(u => u.id === doc.createdBy);
      if (creator) {
          originDept = creator.department;
      } else {
          // Fallback: If creator not found in active list, deduce from logs (first entry)
          if (doc.logs && doc.logs.length > 0) {
              const sortedLogs = [...doc.logs].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
              originDept = sortedLogs[0]?.department || '';
          }
      }

      // 2. Check match
      return originDept === currentUser.department;
    });

  }, [documents, currentUser, users]);

  // --- SORTING LOGIC ---
  // 1. Communication Type Hierarchy: Urgent > Priority > Regular
  // 2. Date Created: Newest First
  const sortedDocs = useMemo(() => {
    const typeWeight: Record<string, number> = {
      'Urgent': 3,
      'Priority': 2,
      'Regular': 1
    };

    return [...relevantDocs].sort((a, b) => {
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
  }, [relevantDocs]);

  // Combined Filter: Search Term + Status Filter + Hide System Checkpoints
  const filteredDocs = sortedDocs.filter(d => {
    const matchesSearch = d.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          d.referenceNumber.toLowerCase().includes(searchTerm.toLowerCase());
    
    const isNotCheckpoint = d.title !== '_SYSTEM_CHECKPOINT_';

    let matchesStatus = true;
    
    if (isArchiveView) {
        // In Archive View, STRICTLY show only ARCHIVED
        matchesStatus = d.status === DocStatus.ARCHIVED;
    } else {
        // In Normal Document View
        if (statusFilter === 'ALL') {
            // Show everything EXCEPT Archived (and check points)
            matchesStatus = d.status !== DocStatus.ARCHIVED;
        } else {
            // Show specific selected status
            matchesStatus = d.status === statusFilter;
        }
    }

    return matchesSearch && matchesStatus && isNotCheckpoint;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {isArchiveView ? 'Archived Documents' : 'Documents'}
          </h1>
          <p className="text-sm text-gray-400">
            {isArchiveView 
                ? "History of all closed and archived transactions."
                : currentUser.role === Role.ADMIN 
                    ? "Master list of all tracked files in the system." 
                    : `Viewing documents originating from ${currentUser.department}.`
            }
          </p>
        </div>
        <div className="flex space-x-3 w-full sm:w-auto">
            {!isArchiveView && currentUser.role === Role.ADMIN && (
                <button
                    onClick={() => setClearModal(true)}
                    className="flex items-center space-x-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-800/50 px-4 py-2 rounded-lg transition-colors shadow-sm text-sm"
                >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Clear Data</span>
                </button>
            )}
            {!isArchiveView && (
                <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm w-full sm:w-auto text-sm font-medium"
                >
                <Plus className="w-4 h-4" />
                <span>New Document</span>
                </button>
            )}
        </div>
      </div>

      <div className="bg-gray-800 rounded-xl shadow-sm border border-gray-700 overflow-hidden">
         <div className="p-4 border-b border-gray-700 bg-gray-900/30 flex flex-col sm:flex-row items-center gap-4">
            {/* Search Bar */}
            <div className="flex items-center space-x-3 bg-gray-700/50 rounded-lg px-3 py-2 flex-1 w-full border border-gray-600">
                <Search className="w-4 h-4 text-gray-400" />
                <input 
                    type="text" 
                    placeholder="Search by title or reference ID..." 
                    className="bg-transparent border-none outline-none text-sm w-full text-white placeholder-gray-500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Status Filter Dropdown - Only show if NOT in Archive View */}
            {!isArchiveView && (
                <div className="flex items-center space-x-2 w-full sm:w-auto">
                    <Filter className="w-4 h-4 text-gray-400 hidden sm:block" />
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-48"
                    >
                        <option value="ALL">All Statuses</option>
                        <option value={DocStatus.INCOMING}>Incoming</option>
                        {/* Removed Outgoing from filter list as requested */}
                        <option value={DocStatus.PROCESSING}>Processing</option>
                        <option value={DocStatus.RETURNED}>Returned</option>
                        <option value={DocStatus.COMPLETED}>Completed</option>
                    </select>
                </div>
            )}
        </div>
        <div className="divide-y divide-gray-700">
          {filteredDocs.length > 0 ? (
            filteredDocs.map(doc => {
              const lastLog = doc.logs.length > 0 ? doc.logs[doc.logs.length - 1] : null;
              const isReturned = lastLog && lastLog.action.includes('Returned') && doc.status === DocStatus.INCOMING;
              const wasReturned = doc.logs.some(l => l.action.toLowerCase().includes('returned'));

              // Determine Archive Permission:
              // 1. Must be COMPLETED
              // 2. Must be the Originator (Creator's department == User's department) OR Admin
              const creator = users.find(u => u.id === doc.createdBy);
              const isOriginatingDept = creator && currentUser.department === creator.department;
              const canArchive = doc.status === DocStatus.COMPLETED && (isOriginatingDept || currentUser.role === Role.ADMIN);

              return (
              <div 
                key={doc.id} 
                onClick={() => setSelectedDoc(doc)}
                className="p-4 hover:bg-gray-700 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer group"
              >
                <div className="flex items-start space-x-4">
                  <div className={`p-3 rounded-lg hidden sm:block group-hover:bg-opacity-80 transition-colors ${
                      doc.status === DocStatus.ARCHIVED ? 'bg-gray-700 text-gray-400' :
                      doc.status === DocStatus.RETURNED || isReturned ? 'bg-red-900/30 text-red-400' : 
                      'bg-blue-900/30 text-blue-400'
                    }`}>
                    {doc.status === DocStatus.ARCHIVED ? <Archive className="w-6 h-6" /> : <FileText className="w-6 h-6" />}
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-sm font-semibold text-gray-100 group-hover:text-blue-400 transition-colors break-all">{doc.title}</h3>
                      <span className="text-xs text-gray-500 font-mono whitespace-nowrap">{doc.referenceNumber}</span>
                    </div>
                    <p className="text-sm text-gray-400 mt-1 line-clamp-1 break-all text-justify">{doc.description}</p>
                    <div className="flex flex-col gap-1 mt-1">
                        {doc.summary && (
                            <p className="text-xs text-purple-400 flex items-center">
                                <Sparkles className="w-3 h-3 mr-1" />
                                AI Summary: {doc.summary}
                            </p>
                        )}
                        {(doc.status === DocStatus.RETURNED || isReturned) && (
                           <p className="text-xs text-red-400 font-medium mt-1">
                             Return Reason: {doc.remarks}
                           </p>
                        )}
                    </div>
                    <div className="flex items-center space-x-4 mt-2">
                      <span className="text-xs text-gray-500">Created: {new Date(doc.createdAt).toLocaleDateString()}</span>
                      
                      <span className={`text-xs font-medium ${
                          doc.priority === 'Highly Technical Transaction' ? 'text-red-400' : 
                          doc.priority === 'Complex Transaction' ? 'text-orange-400' : 'text-green-400'
                      }`}>
                          {doc.priority}
                      </span>

                      <span className={`text-xs font-bold uppercase ${
                          doc.communicationType === 'Urgent' ? 'text-red-500 animate-pulse' : 
                          doc.communicationType === 'Priority' ? 'text-yellow-500 animate-pulse' : 
                          'text-gray-500'
                      }`}>
                          {doc.communicationType || 'Regular'}
                      </span>

                      {doc.status === DocStatus.COMPLETED && wasReturned && (
                          <span className="text-[10px] font-medium p-2 rounded-lg bg-red-900/50 text-red-300 border border-red-800">
                              RETURNED
                          </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor(doc.status, !!isReturned)}`}>
                    {doc.status === DocStatus.COMPLETED ? 'DONE PROCESS' : (doc.status === DocStatus.RETURNED || isReturned ? 'RETURNED' : doc.status)}
                  </span>
                  <div className="flex items-center space-x-2">
                    <button 
                        onClick={(e) => { e.stopPropagation(); setSelectedDoc(doc); }}
                        className="text-gray-400 hover:text-blue-400 p-1 rounded-full hover:bg-gray-600 transition-colors"
                        title="View History"
                    >
                        <History className="w-5 h-5" />
                    </button>
                    {/* Archive Action - Only for Completed Docs, Originating Dept, and NOT already in Archive View */}
                    {!isArchiveView && canArchive && (
                        <button
                            onClick={(e) => handleArchive(e, doc)}
                            className="text-gray-400 hover:text-green-400 p-1 rounded-full hover:bg-gray-600 transition-colors"
                            title="Archive Document"
                        >
                            <Archive className="w-5 h-5" />
                        </button>
                    )}
                    {currentUser.role === Role.ADMIN && (
                        <button
                            onClick={(e) => handleDeleteClick(e, doc)}
                            className="text-gray-400 hover:text-red-400 p-1 rounded-full hover:bg-gray-600 transition-colors"
                            title="Delete Document"
                        >
                            <Trash2 className="w-5 h-5" />
                        </button>
                    )}
                  </div>
                </div>
              </div>
            )})
          ) : (
              <div className="p-20 text-center">
                  <div className="bg-gray-700 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                      {isArchiveView ? <Archive className="w-8 h-8 text-gray-500" /> : <FileText className="w-8 h-8 text-gray-500" />}
                  </div>
                  <h3 className="text-gray-200 font-medium">No documents found</h3>
                  <p className="text-gray-500 text-sm mt-1">
                    {searchTerm ? "No results match your search." : 
                     isArchiveView ? "No archived documents found." :
                     statusFilter !== 'ALL' ? `No ${statusFilter.toLowerCase()} documents found.` :
                     "You don't have any associated documents yet."}
                  </p>
              </div>
          )}
        </div>
      </div>

      <AddDocumentModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSave={handleSave}
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
        isOpen={!!selectedDoc}
        onClose={() => setSelectedDoc(null)}
        document={selectedDoc}
      />

      {/* Delete Confirmation Modal */}
      {deleteModal.isOpen && deleteModal.doc && (
        <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-gray-800 rounded-xl shadow-xl w-full max-w-sm p-6 relative border border-gray-700">
                 <button 
                    onClick={() => setDeleteModal({ isOpen: false, doc: null })}
                    className="absolute top-4 right-4 text-gray-500 hover:text-gray-300"
                >
                    <X className="w-5 h-5" />
                </button>
                <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 bg-red-900/30 rounded-full flex items-center justify-center mb-4 text-red-500">
                        <AlertTriangle className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-white mb-2">Delete Document?</h3>
                    <p className="text-sm text-gray-400 mb-6">
                        Are you sure you want to permanently delete <br/>
                        <span className="font-semibold text-gray-200">"{deleteModal.doc.title}"</span>? 
                        <br/>
                        This action cannot be undone.
                    </p>
                    <div className="flex space-x-3 w-full">
                        <button
                            onClick={() => setDeleteModal({ isOpen: false, doc: null })}
                            className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={confirmDelete}
                            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium"
                        >
                            Delete
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* Clear Data Modal */}
      {clearModal && (
        <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6 relative border border-red-800/50">
                <button 
                    onClick={() => { setClearModal(false); setClearConfirmText(''); }}
                    className="absolute top-4 right-4 text-gray-500 hover:text-gray-300"
                >
                    <X className="w-5 h-5" />
                </button>
                
                <div className="flex flex-col items-center text-center">
                    <div className="w-16 h-16 bg-red-900/30 rounded-full flex items-center justify-center mb-4 border border-red-700 animate-pulse">
                        <ShieldAlert className="w-8 h-8 text-red-500" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Smart Wipe Data</h3>
                    <div className="text-sm text-gray-400 mb-6 space-y-2">
                        <p>This action is <span className="font-bold text-red-400">IRREVERSIBLE</span>.</p>
                        <ul className="text-left bg-gray-900/50 p-3 rounded-lg border border-gray-700/50 text-xs space-y-1">
                            <li className="flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-2"></span>Deletes ALL Transaction Logs</li>
                            <li className="flex items-center"><span className="w-1.5 h-1.5 rounded-full bg-red-500 mr-2"></span>Deletes ALL Visible Documents</li>
                            <li className="flex items-center text-green-400"><span className="w-1.5 h-1.5 rounded-full bg-green-500 mr-2"></span><strong>Preserves</strong> Control Number Series Continuity</li>
                        </ul>
                    </div>
                    
                    <div className="w-full mb-6 text-left">
                        <label className="block text-xs font-medium text-gray-500 mb-1 uppercase">Type "CONFIRM" to proceed</label>
                        <input 
                            type="text" 
                            value={clearConfirmText}
                            onChange={(e) => setClearConfirmText(e.target.value)}
                            className="w-full bg-gray-900 border border-red-900/50 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-red-500 placeholder-gray-600"
                            placeholder="CONFIRM"
                        />
                    </div>

                    <div className="flex space-x-3 w-full">
                        <button
                            onClick={() => { setClearModal(false); setClearConfirmText(''); }}
                            className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSmartClearData}
                            disabled={clearConfirmText !== 'CONFIRM' || isClearing}
                            className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                        >
                            {isClearing ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Wipe Data'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
