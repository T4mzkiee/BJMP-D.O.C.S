import React, { useState, useMemo } from 'react';
import { DocumentTrack, DocStatus, User, Role } from '../types';
import { Plus, Search, FileText, MoreHorizontal, Sparkles, History } from 'lucide-react';
import { AddDocumentModal } from '../components/AddDocumentModal';
import { SuccessModal } from '../components/SuccessModal';
import { DocumentLogsModal } from '../components/DocumentLogsModal';

interface DocsProps {
  documents: DocumentTrack[];
  setDocuments: React.Dispatch<React.SetStateAction<DocumentTrack[]>>;
  currentUser: User;
  users: User[];
}

export const DocumentsPage: React.FC<DocsProps> = ({ documents, setDocuments, currentUser, users }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDoc, setSelectedDoc] = useState<DocumentTrack | null>(null);
  const [successModal, setSuccessModal] = useState<{ isOpen: boolean; controlNumber: string; department: string }>({
    isOpen: false,
    controlNumber: '',
    department: ''
  });

  const handleSave = (doc: DocumentTrack) => {
    setDocuments(prev => [doc, ...prev]);
    setIsModalOpen(false); // Close add modal
    // Show success prompt
    setSuccessModal({
        isOpen: true,
        controlNumber: doc.referenceNumber,
        department: doc.assignedTo
    });
  };

  const statusColor = (status: DocStatus) => {
    switch (status) {
      case DocStatus.INCOMING: return 'bg-blue-900/50 text-blue-300 border border-blue-800';
      case DocStatus.OUTGOING: return 'bg-orange-900/50 text-orange-300 border border-orange-800';
      case DocStatus.PROCESSING: return 'bg-yellow-900/50 text-yellow-300 border border-yellow-800';
      case DocStatus.COMPLETED: return 'bg-green-900/50 text-green-300 border border-green-800';
      default: return 'bg-gray-700 text-gray-300 border border-gray-600';
    }
  };

  // Filter documents based on User Permissions
  const relevantDocs = useMemo(() => {
    if (currentUser.role === Role.ADMIN) {
      return documents;
    }

    return documents.filter(doc => {
      // 1. Created by the current user
      const isCreator = doc.createdBy === currentUser.id;
      
      // 2. Currently assigned to the current user or their department
      const isAssigned = doc.assignedTo === currentUser.id || doc.assignedTo === currentUser.department;

      // 3. User has previously interacted with the document (found in logs)
      const hasHistory = doc.logs.some(log => log.userName === currentUser.name);

      return isCreator || isAssigned || hasHistory;
    });
  }, [documents, currentUser]);

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
              : "List of documents associated with your account."}
          </p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm"
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
            filteredDocs.map(doc => (
              <div 
                key={doc.id} 
                onClick={() => setSelectedDoc(doc)}
                className="p-4 hover:bg-gray-700 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer group"
              >
                <div className="flex items-start space-x-4">
                  <div className="p-3 bg-blue-900/30 rounded-lg hidden sm:block group-hover:bg-blue-900/50 transition-colors">
                    <FileText className="w-6 h-6 text-blue-400" />
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
                    </div>
                    <div className="flex items-center space-x-4 mt-2">
                      <span className="text-xs text-gray-500">Created: {new Date(doc.createdAt).toLocaleDateString()}</span>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                          doc.priority === 'Highly Technical Transaction' ? 'bg-red-900/50 text-red-300 border border-red-800' : 
                          doc.priority === 'Complex Transaction' ? 'bg-orange-900/50 text-orange-300 border border-orange-800' : 'bg-green-900/50 text-green-300 border border-green-800'
                      }`}>
                          {doc.priority}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor(doc.status)}`}>
                    {doc.status === DocStatus.COMPLETED ? 'DONE PROCESS' : doc.status}
                  </span>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setSelectedDoc(doc); }}
                    className="text-gray-400 hover:text-blue-400 p-1 rounded-full hover:bg-gray-600 transition-colors"
                    title="View History"
                  >
                    <History className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ))
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
    </div>
  );
};