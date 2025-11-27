import React, { useState, useEffect } from 'react';
import { DocumentTrack, DocStatus } from '../types';
import { X, Save, Calendar, User } from 'lucide-react';

interface DocumentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: DocumentTrack | null;
  onUpdateRemarks: (docId: string, newRemarks: string) => void;
  onOpenReader?: (doc: DocumentTrack) => void;
}

export const DocumentDetailModal: React.FC<DocumentDetailModalProps> = ({ isOpen, onClose, document, onUpdateRemarks }) => {
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    if (document) {
      setRemarks(document.remarks || '');
    }
  }, [document]);

  if (!isOpen || !document) return null;

  const handleSave = () => {
    onUpdateRemarks(document.id, remarks);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto relative flex flex-col border border-gray-700">
        {/* Header */}
        <div className="p-6 border-b border-gray-700 flex justify-between items-start bg-gray-900/30 sticky top-0 z-10">
          <div>
            <div className="flex items-center space-x-2 mb-1">
                 <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                    document.status === DocStatus.COMPLETED ? 'bg-green-900/50 text-green-300 border-green-800' :
                    document.status === DocStatus.PROCESSING ? 'bg-yellow-900/50 text-yellow-300 border-yellow-800' :
                    'bg-blue-900/50 text-blue-300 border-blue-800'
                }`}>
                    {document.status === DocStatus.COMPLETED ? 'DONE PROCESS' : document.status}
                </span>
                <span className="text-xs text-gray-500 font-mono">{document.referenceNumber}</span>
            </div>
            <h2 className="text-xl font-bold text-white">{document.title}</h2>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
            
            {/* Meta Data */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="flex items-center text-gray-400">
                    <User className="w-4 h-4 mr-2 text-gray-500" />
                    Created By: <span className="font-medium text-gray-200 ml-1">{document.createdBy}</span> 
                    {/* Note: In real app, map ID to Name here */}
                </div>
                <div className="flex items-center text-gray-400">
                    <Calendar className="w-4 h-4 mr-2 text-gray-500" />
                    Date: <span className="font-medium text-gray-200 ml-1">{new Date(document.createdAt).toLocaleDateString()}</span>
                </div>
            </div>

            {/* Description */}
            <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Description</label>
                <div className="bg-gray-700 p-4 rounded-lg border border-gray-600 text-gray-300 text-sm leading-relaxed">
                    {document.description}
                </div>
            </div>

            {/* Remarks (Editable) */}
            <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Remarks / Notes</label>
                <textarea 
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none h-24 text-sm text-white placeholder-gray-500"
                    placeholder="Add notes or updates regarding this document..."
                />
            </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 flex justify-end bg-gray-900/30 rounded-b-xl">
             <button
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center shadow-sm font-medium transition-colors"
            >
                <Save className="w-4 h-4 mr-2" />
                Update Remarks
            </button>
        </div>
      </div>
    </div>
  );
};