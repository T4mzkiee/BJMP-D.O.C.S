
import React, { useState, useMemo } from 'react';
import { DocumentTrack, DocStatus, User, Role, Department } from '../types';
import { Plus, Search, FileText, MoreHorizontal, Sparkles, History, Trash2, AlertTriangle, X, ShieldAlert, Loader2, Filter } from 'lucide-react';
import { AddDocumentModal } from '../components/AddDocumentModal';
import { SuccessModal } from '../components/SuccessModal';
import { DocumentLogsModal } from '../components/DocumentLogsModal';
import { supabase, mapDocFromDB } from '../utils/supabase';

interface DocsProps {
  documents: DocumentTrack[];
  setDocuments: React.Dispatch<React.SetStateAction<DocumentTrack[]>>;
  currentUser: User;
  users: User[];
  departments: Department[];
}

export const DocumentsPage: React.FC<DocsProps> = ({ documents, setDocuments, currentUser, users, departments }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL'); // NEW: Status Filter State
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

        // 3. Wipe Documents (Except Keepers)
        if (idsToKeep.length > 0) {
            // Delete everything NOT in the keep list
            await supabase.from('documents').delete().not('id', 'in', `(${idsToKeep.join(',')})`);
            
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
            // If no valid documents exist to keep, just wipe everything
            await supabase.from('documents').delete().neq('id', '00000000-0000-0000-0000-000000000000');
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
    let filtered: DocumentTrack[] = [];
    
    // Create a copy to avoid mutating state
    if (currentUser.role === Role.ADMIN) {
      filtered = [...documents];
    } else {
      filtered = documents.filter(doc => {
        const creator = users.find(u => u.id === doc.createdBy);
        const isCreatedByMyDept = creator && creator.department === currentUser.department;
        const isAssigned = doc.assignedTo === currentUser.id || doc.assignedTo === currentUser.department;
        const hasHistory = doc.logs.some(log => log.userName === currentUser.name);

        return isCreatedByMyDept || isAssigned || hasHistory;
      });
    }

    // --- SORTING LOGIC ---
    // 1. Communication Type Hierarchy: Urgent > Priority > Regular
    // 2. Date Created: Newest First
    const typeWeight: Record<string, number> = {
      'Urgent': 3,
      'Priority': 2,
      'Regular': 1
    };

    return filtered.sort((a, b) => {
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

  }, [documents, currentUser, users]);

  // Combined Filter: Search Term + Status Filter + Hide System Checkpoints
  const filteredDocs = relevantDocs.filter(d => {
    const matchesSearch = d.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          d.referenceNumber.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' ? true : d.status === statusFilter;
    const isNotCheckpoint = d.title !== '_SYSTEM_CHECKPOINT_';

    return matchesSearch && matchesStatus && isNotCheckpoint;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Documents</h1>
          <p className="text-sm text-gray-400">
            {currentUser.role === Role.ADMIN 
              ? "Master list of all tracked files in the system." 
              : `Viewing documents associated with ${currentUser.department}.`}
          </p>
        </div>
        <div className="flex space-x-3 w-full sm:w-auto">
            {currentUser.role === Role.ADMIN && (
                <button
                    onClick={() => setClearModal(true)}
                    className="flex items-center space-x-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-800/50 px-4 py-2 rounded-lg transition-colors shadow-sm text-sm"
                >
                    <Trash2 className="w-4 h-4" />
                    <span className="hidden sm:inline">Clear Data</span>
                </button>
            )}
            <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center justify-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm w-full sm:w-auto text-sm font-medium"
            >
            <Plus className="w-4 h-4" />
            <span>New Document</span>
            </button>
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

            {/* Status Filter Dropdown */}
            <div className="flex items-center space-x-2 w-full sm:w-auto">
                <Filter className="w-4 h-4 text-gray-400 hidden sm:block" />
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-48"
                >
                    <option value="ALL">All Statuses</option>
                    <option value={DocStatus.INCOMING}>Incoming</option>
                    <option value={DocStatus.OUTGOING}>Outgoing</option>
                    <option value={DocStatus.PROCESSING}>Processing</option>
                    <option value={DocStatus.RETURNED}>Returned</option>
                    <option value={DocStatus.COMPLETED}>Completed</option>
                    <option value={DocStatus.ARCHIVED}>Archived</option>
                </select>
            </div>
        </div>

        <div className="divide-y divide-gray-700">
          {filteredDocs.length > 0 ? (
            filteredDocs.map(doc => {
              // Check if the document was returned
              const lastLog = doc.logs.length > 0 ? doc.logs[doc.logs.length - 1] : null;
              const isReturned = lastLog && lastLog.action.includes('Returned') && doc.status === DocStatus.INCOMING;

              // Check if document WAS returned in its history (for completed docs)
              const wasReturned = doc.logs.some(l => l.action.toLowerCase().includes('returned'));

              return (
              <div 
                key={doc.id} 
                onClick={() => setSelectedDoc(doc)}
                className="p-4 hover:bg-gray-700 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer group"
              >
                <div className="flex items-start space-x-4">
                  <div className={`p-3 rounded-lg hidden sm:block group-hover:bg-opacity-80 transition-colors ${doc.status === DocStatus.RETURNED || isReturned ? 'bg-red-900/30 text-red-400' : 'bg-blue-900/30 text-blue-400'}`}>
                    <FileText className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2">
                      <h3 className="text-sm font-semibold text-gray-100 group-hover:text-blue-400 transition-colors">{doc.title}</h3>
                      <span className="text-xs text-gray-500 font-mono">{doc.referenceNumber}</span>
                    </div>
                    <p className="text-sm text-gray-400 mt-1 line-clamp-1">{doc.description}</p>
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

                      {/* Additional RETURNED badge for completed documents that were returned */}
                      {doc.status === DocStatus.COMPLETED && wasReturned && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-900/50 text-red-300 border border-red-800">
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
                      <FileText className="w-8 h-8 text-gray-500" />
                  </div>
                  <h3 className="text-gray-200 font-medium">No documents found</h3>
                  <p className="text-gray-500 text-sm mt-1">
                    {searchTerm ? "No results match your search." : 
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
