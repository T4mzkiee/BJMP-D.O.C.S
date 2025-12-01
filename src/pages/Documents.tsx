
import React, { useState, useMemo } from 'react';
import { DocumentTrack, DocStatus, User, Role, Department } from '../types';
import { Plus, Search, FileText, MoreHorizontal, Sparkles, History, Trash2, AlertTriangle, X } from 'lucide-react';
import { AddDocumentModal } from '../components/AddDocumentModal';
import { SuccessModal } from '../components/SuccessModal';
import { DocumentLogsModal } from '../components/DocumentLogsModal';
import { supabase } from '../utils/supabase';

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

  const statusColor = (status: DocStatus, isReturned: boolean) => {
    if (status === DocStatus.RETURNED || isReturned) return 'bg-red-900/50 text-red-300 border border-red-800';
    switch (status) {
      case DocStatus.INCOMING: return 'bg-blue-900/50 text-blue-300 border border-blue-800';
      case DocStatus.OUTGOING: return 'bg-orange-900/50 text-orange-300 border border-orange-800';
      case DocStatus.PROCESSING: return 'bg-yellow-900/50 text-yellow-300 border border-yellow-800';
      case DocStatus.COMPLETED: return 'bg-green-900/50 text-green-300 border border-green-800';
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
      // Get weights (default to 1 if undefined)
      const weightA = typeWeight[a.communicationType || 'Regular'] || 1;
      const weightB = typeWeight[b.communicationType || 'Regular'] || 1;

      // Primary Sort: Communication Type (Highest weight first)
      if (weightA !== weightB) {
        return weightB - weightA;
      }

      // Secondary Sort: Date Created (Newest first)
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return dateB - dateA;
    });

  }, [documents, currentUser, users]);

  const filteredDocs = relevantDocs.filter(d => 
    d.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
    d.referenceNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-white">Documents</h1>
          <p className="text-sm text-gray-400">
            {currentUser.role === Role.ADMIN 
              ? "Master list of all tracked files in the system." 
              : `Viewing documents associated with ${currentUser.department}.`}
          </p>
        </div>
        {/* Re-enable New Document button for easier access, styled Grey */}
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center space-x-2 bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors shadow-sm border border-gray-600"
        >
          <Plus className="w-4 h-4" />
          <span>New Document</span>
        </button>
      </div>

      <div className="bg-gray-800 rounded-xl shadow-sm border border-gray-700 overflow-hidden">
         <div className="p-4 border-b border-gray-700 bg-gray-900/30 flex items-center space-x-3">
            <Search className="w-4 h-4 text-gray-400" />
            <input 
                type="text" 
                placeholder="Search by title or reference ID..." 
                className="bg-transparent border-none outline-none text-sm w-full text-white placeholder-gray-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
        <div className="divide-y divide-gray-700">
          {filteredDocs.length > 0 ? (
            filteredDocs.map(doc => {
              const lastLog = doc.logs.length > 0 ? doc.logs[doc.logs.length - 1] : null;
              const isReturned = lastLog && lastLog.action.includes('Returned') && doc.status === DocStatus.INCOMING;
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
                    {searchTerm ? "No results match your search." : "You don't have any associated documents yet."}
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
    </div>
  );
};
