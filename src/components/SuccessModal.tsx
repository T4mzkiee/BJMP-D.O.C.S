import React from 'react';
import { CheckCircle, Copy, X } from 'lucide-react';

interface SuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  controlNumber: string;
  department: string;
}

export const SuccessModal: React.FC<SuccessModalProps> = ({ isOpen, onClose, controlNumber, department }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-gray-800 rounded-xl shadow-xl w-full max-w-md p-8 text-center relative border border-gray-700">
        <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-500 hover:text-gray-300"
        >
            <X className="w-5 h-5" />
        </button>

        <div className="w-16 h-16 bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-800">
            <CheckCircle className="w-8 h-8 text-green-500" />
        </div>
        
        <h2 className="text-2xl font-bold text-white mb-2">Document Sent!</h2>
        <p className="text-gray-400 mb-6">Your document has been successfully registered and routed to the <strong>{department}</strong> department.</p>
        
        <div className="bg-gray-700 border border-gray-600 rounded-lg p-4 mb-8">
            <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold mb-1">Control Number</p>
            <div className="flex items-center justify-center space-x-2">
                <span className="text-xl font-mono font-bold text-blue-400 tracking-tight break-all">{controlNumber}</span>
                <button 
                    onClick={() => navigator.clipboard.writeText(controlNumber)}
                    className="text-gray-400 hover:text-gray-200 p-1"
                    title="Copy to clipboard"
                >
                    <Copy className="w-4 h-4" />
                </button>
            </div>
        </div>

        <button
            onClick={onClose}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 rounded-lg transition-colors"
        >
            Done
        </button>
      </div>
    </div>
  );
};