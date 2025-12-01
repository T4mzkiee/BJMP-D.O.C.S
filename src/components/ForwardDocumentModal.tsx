import React, { useState, useMemo, useEffect } from 'react';
import { DocumentTrack, User } from '../types';
import { X, Send, Building2 } from 'lucide-react';

interface ForwardDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onForward: (department: string, remarks: string) => void;
  document: DocumentTrack | null;
  users: User[];
  currentUser: User;
}

// List of BJMP Offices
const BJMP_OFFICES = [
  'ORD', 'ARDA', 'ARDO', 'RCDS', 'RPRMD', 'RHRDD', 'RLOGS', 'RSAO', 'ROPNS',
  'RHSD', 'RCOMP', 'RID', 'RIPD', 'LSD', 'DWD', 'RICTMD', 'RPDD', 'RSBAS',
  'RCRDS', 'FSS', 'ASS', 'CRS', 'CHP'
];

export const ForwardDocumentModal: React.FC<ForwardDocumentModalProps> = ({ isOpen, onClose, onForward, document, users, currentUser }) => {
  const [selectedDept, setSelectedDept] = useState('');
  const [remarks, setRemarks] = useState('');

  // Use the full list of offices, excluding the current user's department
  const departments = useMemo(() => {
    return BJMP_OFFICES.filter(d => d !== currentUser.department);
  }, [currentUser]);

  useEffect(() => {
    if (isOpen && departments.length > 0) {
        setSelectedDept(departments[0]);
        setRemarks('');
    }
  }, [isOpen, departments]);

  if (!isOpen || !document) return null;

  const handleConfirm = () => {
    if (!selectedDept) return;
    onForward(selectedDept, remarks);
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

        <h2 className="text-xl font-bold text-white mb-1">Forward Document</h2>
        <p className="text-sm text-gray-400 mb-6">Route <span className="font-semibold text-gray-200">{document.title}</span> to another office.</p>

        <div className="space-y-4">
            <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Destination Office</label>
                <div className="relative">
                    <Building2 className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                    <select
                        value={selectedDept}
                        onChange={(e) => setSelectedDept(e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-10 pr-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none appearance-none text-white"
                    >
                        {departments.map(dept => (
                            <option key={dept} value={dept}>{dept}</option>
                        ))}
                    </select>
                </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Remarks</label>
                <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none h-24 resize-none text-white placeholder-gray-500"
                    placeholder="Add instructions or notes..."
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
                onClick={handleConfirm}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center shadow-sm font-medium transition-colors"
            >
                <Send className="w-4 h-4 mr-2" />
                Forward Document
            </button>
        </div>
      </div>
    </div>
  );
};