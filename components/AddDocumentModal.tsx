import React, { useState, useMemo, useEffect } from 'react';
import { DocumentTrack, DocStatus, User } from '../types';
import { Sparkles, Loader2, X } from 'lucide-react';
import { analyzeDocument } from '../services/geminiService';

interface AddDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (doc: DocumentTrack) => void;
  currentUser: User;
  users: User[];
  documents: DocumentTrack[];
}

export const AddDocumentModal: React.FC<AddDocumentModalProps> = ({ isOpen, onClose, onSave, currentUser, users, documents }) => {
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [newDoc, setNewDoc] = useState<Partial<DocumentTrack>>({
    title: '',
    description: '',
    status: DocStatus.INCOMING,
    priority: 'Simple Transaction',
    assignedTo: '', // Now stores Department Name
    summary: '',
    remarks: ''
  });

  // Extract unique departments from users list, excluding current user's department
  const departments = useMemo(() => {
    const depts = users
      .map(u => u.department)
      .filter(d => d && d !== currentUser.department); // Filter out own department
    return Array.from(new Set(depts));
  }, [users, currentUser]);

  // Set default department if not set
  useEffect(() => {
    if (isOpen) {
        // Reset assignedTo if it's invalid or empty, picking the first valid option
        if ((!newDoc.assignedTo || !departments.includes(newDoc.assignedTo)) && departments.length > 0) {
            setNewDoc(prev => ({ ...prev, assignedTo: departments[0] }));
        }
    }
  }, [isOpen, departments, newDoc.assignedTo]);

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

  const generateControlNumber = (dept: string) => {
    const now = new Date();
    // Get last 2 digits of the year (e.g. 2025 -> 25, 2026 -> 26)
    const year = now.getFullYear().toString().slice(-2);
    const month = (now.getMonth() + 1).toString().padStart(2, '0');
    
    // Pattern: "DEPARTMENT YY-MM-"
    // e.g. "ICT 25-11-" or "ICT 26-01-"
    // We strictly look for this prefix. 
    // If the month OR year changes, no documents will match this prefix, 
    // causing maxSeries to start at 0, effectively resetting the counter.
    const prefix = `${dept} ${year}-${month}-`;
    
    // Filter documents that start with exactly "DEPARTMENT YY-MM-"
    const monthlyDocs = documents.filter(d => d.referenceNumber.startsWith(prefix));
    
    let maxSeries = 0;
    
    monthlyDocs.forEach(d => {
        // Extract the series part (everything after the prefix)
        // e.g. "ICT 25-11-001" -> "001"
        const seriesPart = d.referenceNumber.slice(prefix.length);
        const seriesNum = parseInt(seriesPart, 10);
        
        if (!isNaN(seriesNum) && seriesNum > maxSeries) {
            maxSeries = seriesNum;
        }
    });

    // Increment the series and pad to 3 digits
    const nextSeries = (maxSeries + 1).toString().padStart(3, '0'); // 3 digits: 001, 002...
    
    // Format: DEPARTMENT YY-MM-SERIES
    return `${prefix}${nextSeries}`;
  };

  const handleSend = () => {
    // RECIPIENT Department
    const recipientDept = newDoc.assignedTo || departments[0] || 'General';
    
    // ORIGIN Department (For Control Number)
    const originDept = currentUser.department || 'General';

    // Generate Control Number based on ORIGIN
    const controlNum = generateControlNumber(originDept);
    
    const timestamp = new Date().toISOString();

    const doc: DocumentTrack = {
      id: Math.random().toString(36).substr(2, 9),
      createdBy: currentUser.id,
      createdAt: timestamp,
      updatedAt: timestamp,
      assignedTo: recipientDept, // Assigned to Recipient
      title: newDoc.title || 'Untitled',
      referenceNumber: controlNum,
      description: newDoc.description || '',
      status: newDoc.status || DocStatus.INCOMING,
      priority: newDoc.priority || 'Simple Transaction',
      summary: newDoc.summary,
      remarks: newDoc.remarks,
      logs: [
          {
              id: Math.random().toString(36).substr(2, 9),
              date: timestamp,
              action: 'Document Created',
              department: currentUser.department,
              userName: currentUser.name,
              status: DocStatus.OUTGOING, // Initially Outgoing for the creator
              remarks: 'Initial document creation'
          },
          {
              id: Math.random().toString(36).substr(2, 9),
              date: new Date(Date.now() + 1000).toISOString(), // Add slight delay for ordering
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
        assignedTo: departments[0] || '',
        summary: '',
        remarks: ''
    });
    
    // Close modal immediately
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4 animate-fade-in">
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
            <label className="block text-sm font-medium text-gray-400 mb-1">Title</label>
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
                <button 
                    onClick={handleAnalyze}
                    disabled={!newDoc.title || !newDoc.description || isAnalyzing}
                    className="text-xs text-purple-400 hover:text-purple-300 flex items-center font-medium disabled:opacity-50"
                >
                    {isAnalyzing ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
                    AI Auto-Fill
                </button>
            </div>
            <textarea
              value={newDoc.description}
              onChange={e => setNewDoc({ ...newDoc, description: e.target.value })}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none h-24 text-white placeholder-gray-500"
              placeholder="Enter document details..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-400 mb-1">Remarks</label>
            <textarea
              value={newDoc.remarks}
              onChange={e => setNewDoc({ ...newDoc, remarks: e.target.value })}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none h-16 text-white placeholder-gray-500"
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

          <div className="grid grid-cols-2 gap-4">
               <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Sent To (Department)</label>
                <select
                    value={newDoc.assignedTo}
                    onChange={e => setNewDoc({ ...newDoc, assignedTo: e.target.value })}
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 outline-none text-white"
                >
                    {departments.length > 0 ? (
                        departments.map(dept => (
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
            disabled={departments.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Send Document
          </button>
        </div>
      </div>
    </div>
  );
};