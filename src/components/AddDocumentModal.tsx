
import React, { useState, useMemo, useEffect } from 'react';
import { DocumentTrack, DocStatus, User, Department, Role, DocCommunication } from '../types';
import { Sparkles, Loader2, X } from 'lucide-react';
import { analyzeDocument } from '../services/geminiService';
import { uuid } from '../utils/crypto';

interface AddDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (doc: DocumentTrack) => void;
  currentUser: User;
  users: User[];
  documents: DocumentTrack[];
  departments: Department[];
}

export const AddDocumentModal: React.FC<AddDocumentModalProps> = ({ isOpen, onClose, onSave, currentUser, users, documents, departments }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [newDoc, setNewDoc] = useState<Partial<DocumentTrack>>({
    title: '',
    description: '',
    status: DocStatus.INCOMING,
    priority: 'Simple Transaction',
    communicationType: 'Regular',
    assignedTo: '', // Now stores Department Name
    summary: '',
    remarks: ''
  });

  const MAX_DESC_LENGTH = 200;
  const MAX_REMARKS_LENGTH = 100;

  // Use the passed list of offices, excluding the current user's department
  const availableDepartments = useMemo(() => {
    return departments.filter(d => d.name !== currentUser.department).map(d => d.name);
  }, [currentUser, departments]);

  // Set default department if not set
  useEffect(() => {
    if (isOpen) {
        // Reset assignedTo if it's invalid or empty, picking the first valid option
        if ((!newDoc.assignedTo || !availableDepartments.includes(newDoc.assignedTo)) && availableDepartments.length > 0) {
            setNewDoc(prev => ({ ...prev, assignedTo: availableDepartments[0] }));
        }
    }
  }, [isOpen, availableDepartments, newDoc.assignedTo]);

  if (!isOpen) return null;

  const handleAnalyze = async () => {
    if (!newDoc.title || !newDoc.description) return;
    setIsAnalyzing(true);
    const result = await analyzeDocument(newDoc.title, newDoc.description);
    setNewDoc(prev => ({
      ...prev,
      summary: result.summary,
      priority: result.priority
    }));
    setIsAnalyzing(false);
  };

  const generateControlNumber = (dept: string, isMessageCenter: boolean) => {
    const now = new Date();
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    
    let prefix = '';

    if (isMessageCenter) {
        // Message Center Format: "TO_DEPT-YY-MM-"
        // Example: RICTMD-25-12-001
        prefix = `${dept}-${year}-${month}-`;
    } else {
        // Standard User Format: "FROM_DEPT YYMM"
        // Example: RICTMD 2512001
        prefix = `${dept} ${year}${month}`;
    }
    
    // Filter documents that start with the prefix
    const monthlyDocs = documents.filter(d => d.referenceNumber.startsWith(prefix));
    
    let maxSeries = 0;
    
    monthlyDocs.forEach(d => {
        // Extract the series part (everything after the prefix)
        const seriesPart = d.referenceNumber.slice(prefix.length);
        const seriesNum = parseInt(seriesPart, 10);
        
        if (!isNaN(seriesNum) && seriesNum > maxSeries) {
            maxSeries = seriesNum;
        }
    });

    // Increment the series and pad to 3 digits
    const nextSeries = (maxSeries + 1).toString().padStart(3, '0'); 
    
    // Combine
    return `${prefix}${nextSeries}`;
  };

  const handleSend = () => {
    // RECIPIENT Department
    const recipientDept = newDoc.assignedTo || availableDepartments[0] || 'General';
    
    // ORIGIN Department (For Control Number context)
    const originDept = currentUser.department || 'General';

    let controlNum = '';

    // LOGIC SWITCH:
    // If Message Center: Use Recipient Dept + Hyphenated Format
    // If Regular User: Use Origin Dept + Compact Format
    if (currentUser.role === Role.MESSAGE_CENTER) {
        controlNum = generateControlNumber(recipientDept, true);
    } else {
        controlNum = generateControlNumber(originDept, false);
    }
    
    const timestamp = new Date().toISOString();

    const doc: DocumentTrack = {
      id: uuid(), 
      createdBy: currentUser.id,
      createdAt: timestamp,
      updatedAt: timestamp,
      assignedTo: recipientDept, // Assigned to Recipient
      title: newDoc.title || 'Untitled',
      referenceNumber: controlNum,
      description: newDoc.description || '',
      status: newDoc.status || DocStatus.INCOMING,
      priority: newDoc.priority || 'Simple Transaction',
      communicationType: newDoc.communicationType || 'Regular',
      summary: newDoc.summary,
      remarks: newDoc.remarks,
      logs: [
          {
              id: uuid(),
              date: timestamp,
              action: 'Document Created',
              department: currentUser.department,
              userName: currentUser.name,
              status: DocStatus.OUTGOING,
              remarks: 'Initial document creation'
          },
          {
              id: uuid(),
              date: new Date(Date.now() + 1000).toISOString(),
              action: `Forwarded to ${recipientDept}`,
              department: currentUser.department,
              userName: currentUser.name,
              status: DocStatus.INCOMING, // Becomes Incoming for the recipient
              remarks: newDoc.remarks
          }
      ]
    };

    onSave(doc);
    
    // Reset form
    setNewDoc({
        title: '',
        description: '',
        status: DocStatus.INCOMING,
        priority: 'Simple Transaction',
        communicationType: 'Regular',
        assignedTo: availableDepartments[0] || '',
        summary: '',
        remarks: ''
    });
    
    // Close modal immediately
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-[60] flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-gray-800 rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto relative border border-gray-700">
        <button 
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-500 hover:text-gray-300"
        >
            <X className="w-5 h-5" />
        </button>
        
        <h2 className="text-xl font-bold mb-4 text-white">New Document</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Subject</label>
            <input
            type="text"
            value={newDoc.title}
            onChange={e => setNewDoc({ ...newDoc, title: e.target.value })}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-white placeholder-gray-500"
            placeholder="e.g., Annual Budget Report"
            />
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-gray-400">Description</label>
                <div className="flex items-center space-x-3">
                    <span className={`text-xs ${(newDoc.description?.length || 0) >= MAX_DESC_LENGTH ? 'text-red-400 font-bold' : 'text-gray-500'}`}>
                        {newDoc.description?.length || 0}/{MAX_DESC_LENGTH}
                    </span>
                    <button 
                        onClick={handleAnalyze}
                        disabled={!newDoc.title || !newDoc.description || isAnalyzing}
                        className="text-xs text-purple-400 hover:text-purple-300 flex items-center font-medium disabled:opacity-50"
                    >
                        {isAnalyzing ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
                        AI Auto-Fill
                    </button>
                </div>
            </div>
            <textarea
              value={newDoc.description}
              onChange={e => setNewDoc({ ...newDoc, description: e.target.value })}
              maxLength={MAX_DESC_LENGTH}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none h-24 text-white placeholder-gray-500 resize-none"
              placeholder="Enter document details..."
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-gray-400">Remarks</label>
                <span className={`text-xs ${(newDoc.remarks?.length || 0) >= MAX_REMARKS_LENGTH ? 'text-red-400 font-bold' : 'text-gray-500'}`}>
                    {newDoc.remarks?.length || 0}/{MAX_REMARKS_LENGTH}
                </span>
            </div>
            <textarea
              value={newDoc.remarks}
              onChange={e => setNewDoc({ ...newDoc, remarks: e.target.value })}
              maxLength={MAX_REMARKS_LENGTH}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none h-16 text-white placeholder-gray-500 resize-none"
              placeholder="Any additional notes..."
            />
          </div>

          {newDoc.summary && (
              <div className="bg-purple-900/30 p-3 rounded-lg border border-purple-800">
                  <p className="text-xs font-bold text-purple-300 mb-1 flex items-center">
                      <Sparkles className="w-3 h-3 mr-1" />
                      AI Suggestions
                  </p>
                  <p className="text-xs text-purple-200 italic">"{newDoc.summary}"</p>
                  <p className="text-xs text-purple-300 mt-1">Suggested Classification: <strong>{newDoc.priority}</strong></p>
              </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Sent To (Department)</label>
                <select
                    value={newDoc.assignedTo}
                    onChange={e => setNewDoc({ ...newDoc, assignedTo: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 outline-none text-white"
                >
                    {availableDepartments.length > 0 ? (
                        availableDepartments.map(dept => (
                            <option key={dept} value={dept}>
                                {dept}              
                            </option>
                        ))
                    ) : (
                        <option value="" disabled>No other departments available</option>
                    )}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Communication Type</label>
                <select
                    value={newDoc.communicationType}
                    onChange={e => setNewDoc({ ...newDoc, communicationType: e.target.value as DocCommunication })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 outline-none text-white"
                >
                    <option value="Regular">Regular</option>
                    <option value="Priority">Priority</option>
                    <option value="Urgent">Urgent</option>
                </select>
              </div>

              <div className="col-span-1 sm:col-span-2">
                <label className="block text-sm font-medium text-gray-400 mb-1">Document Classification</label>
                <select
                    value={newDoc.priority}
                    onChange={e => setNewDoc({ ...newDoc, priority: e.target.value as any })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 outline-none text-white"
                >
                    <option value="Simple Transaction">Simple Transaction</option>
                    <option value="Complex Transaction">Complex Transaction</option>
                    <option value="Highly Technical Transaction">Highly Technical Transaction</option>
                </select>
              </div>
          </div>
        </div>
        
        <div className="flex justify-end space-x-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:bg-gray-700 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={availableDepartments.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send Document
          </button>
        </div>
      </div>
    </div>
  );
};
