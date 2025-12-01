import React from 'react';
import { CheckCircle, X } from 'lucide-react';

interface ProcessEndedModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProcessEndedModal: React.FC<ProcessEndedModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm p-8 text-center relative">
        <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
            <X className="w-5 h-5" />
        </button>

        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-green-600" />
        </div>
        
        <h2 className="text-xl font-bold text-gray-900 mb-2">Success</h2>
        <p className="text-lg text-gray-700 font-medium">Document Process ended!</p>
        <p className="text-sm text-gray-500 mt-2">The transaction has been completed and archived.</p>

        <button
            onClick={onClose}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-colors mt-6"
        >
            Okay
        </button>
      </div>
    </div>
  );
};