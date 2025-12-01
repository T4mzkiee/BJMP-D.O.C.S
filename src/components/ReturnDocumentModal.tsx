
import React, { useState } from 'react';
import { DocumentTrack } from '../types';
import { X, Undo2, AlertCircle } from 'lucide-react';

interface ReturnDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (remarks: string) => void;
  document: DocumentTrack | null;
}

export const ReturnDocumentModal: React.FC<ReturnDocumentModalProps> = ({ isOpen, onClose, onConfirm, document }) => {
  const [remarks, setRemarks] = useState('');

  if (!isOpen || !document) return null;

  const handleSubmit = () => {
    if (!remarks.trim()) {
      alert("Please provide a reason for returning the document.");
      return;
    }
    onConfirm(remarks);
    setRemarks('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-6 relative border border-gray-700">
        <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-500 hover:text-gray-300"
        >
            <X className="w-5 h-5" />
        </button>

        <div className="flex items-center space-x-3 mb-4 text-red-400">
            <div className="bg-red-900/30 p-2 rounded-full border border-red-800">
                <Undo2 className="w-6 h-6" />
            </div>
            <h2 className="text-xl font-bold text-white">Return Document</h2>
        </div>

        <div className="mb-4">
            <p className="text-sm text-gray-400">
                You are about to return <span className="font-semibold text-gray-200">"{document.title}"</span> to its originating department.
            </p>
        </div>

        <div className="space-y-4">
            <div className="bg-red-900/10 border border-red-900/30 rounded-lg p-3 flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-red-300">
                    This action will remove the document from your incoming list and send it back to the creator.
                </p>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Reason for Return (Remarks)</label>
                <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-red-500 outline-none h-24 resize-none text-white placeholder-gray-500"
                    placeholder="E.g., Missing signature, Incorrect attachment..."
                />
            </div>
        </div>

        <div className="flex justify-end space-x-3 mt-6">
            <button
                onClick={onClose}
                className="px-4 py-2 text-gray-400 hover:bg-gray-700 rounded-lg font-medium"
            >
                Cancel
            </button>
            <button
                onClick={handleSubmit}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center shadow-sm font-medium transition-colors"
            >
                <Undo2 className="w-4 h-4 mr-2" />
                Return Document
            </button>
        </div>
      </div>
    </div>
  );
};
