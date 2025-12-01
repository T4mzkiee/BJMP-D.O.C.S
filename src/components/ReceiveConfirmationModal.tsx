
import React from 'react';
import { DocumentTrack } from '../types';
import { AlertCircle, X, Check } from 'lucide-react';

interface ReceiveConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  document: DocumentTrack | null;
}

export const ReceiveConfirmationModal: React.FC<ReceiveConfirmationModalProps> = ({ isOpen, onClose, onConfirm, document }) => {
  if (!isOpen || !document) return null;

  // Check if it is a returned document
  const lastLog = document.logs.length > 0 ? document.logs[document.logs.length - 1] : null;
  const isReturned = lastLog && lastLog.action.includes('Returned');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-gray-800 rounded-xl shadow-xl w-full max-w-sm p-6 relative border border-gray-700">
        <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-500 hover:text-gray-300"
        >
            <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center text-center">
            <div className="w-16 h-16 bg-blue-900/30 rounded-full flex items-center justify-center mb-4 border border-blue-800">
                <AlertCircle className="w-8 h-8 text-blue-500" />
            </div>
            
            <h2 className="text-xl font-bold text-white mb-2">Receive Document?</h2>
            <p className="text-sm text-gray-400 mb-6">
                Are you sure you want to officially receive <br/>
                <span className="font-semibold text-gray-200">"{document.title}"</span>?
                <br/>
                {isReturned 
                    ? <span className="text-red-400 mt-2 block font-medium">Note: Since this is a returned document, receiving it will mark the status as RETURNED.</span>
                    : "This will update the status to Processing."
                }
            </p>

            <div className="flex space-x-3 w-full">
                <button
                    onClick={onClose}
                    className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 font-medium transition-colors"
                >
                    No, Cancel
                </button>
                <button
                    onClick={onConfirm}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center justify-center transition-colors"
                >
                    <Check className="w-4 h-4 mr-2" />
                    {isReturned ? 'Receive (Returned)' : 'Yes, Receive'}
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};
