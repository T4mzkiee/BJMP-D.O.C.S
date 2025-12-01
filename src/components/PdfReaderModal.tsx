import React, { useState, useEffect } from 'react';
import { DocumentTrack } from '../types';
import { X, Save, Download, ZoomIn, ZoomOut, ChevronLeft, ChevronRight, FileText } from 'lucide-react';

interface PdfReaderModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: DocumentTrack | null;
  onUpdateRemarks: (docId: string, newRemarks: string) => void;
}

export const PdfReaderModal: React.FC<PdfReaderModalProps> = ({ isOpen, onClose, document, onUpdateRemarks }) => {
  const [remarks, setRemarks] = useState('');
  const [zoom, setZoom] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = 3; // Simulated

  useEffect(() => {
    if (document) {
      setRemarks(document.remarks || '');
    }
  }, [document]);

  if (!isOpen || !document) return null;

  const handleSave = () => {
    onUpdateRemarks(document.id, remarks);
    // Optional: Close modal or show success feedback
    // onClose(); 
    alert('Remarks updated successfully!');
  };

  const handleDownload = () => {
    alert(`Downloading ${document.attachmentName || 'document'}...`);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white w-full h-full max-w-7xl rounded-xl shadow-2xl overflow-hidden flex flex-col">
        
        {/* Header / Toolbar */}
        <div className="bg-gray-900 text-white p-3 flex justify-between items-center shadow-md z-10">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-blue-400" />
                <div className="flex flex-col">
                    <span className="font-semibold text-sm leading-tight">{document.title}</span>
                    <span className="text-xs text-gray-400 font-mono">{document.referenceNumber}</span>
                </div>
            </div>
            <div className="h-6 w-px bg-gray-700 mx-2"></div>
            <div className="flex items-center space-x-2 bg-gray-800 rounded-lg p-1">
                <button 
                    onClick={() => setZoom(z => Math.max(50, z - 10))}
                    className="p-1 hover:bg-gray-700 rounded transition-colors text-gray-300"
                >
                    <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono w-12 text-center">{zoom}%</span>
                <button 
                    onClick={() => setZoom(z => Math.min(200, z + 10))}
                    className="p-1 hover:bg-gray-700 rounded transition-colors text-gray-300"
                >
                    <ZoomIn className="w-4 h-4" />
                </button>
            </div>
          </div>

          <div className="flex items-center space-x-3">
             <div className="flex items-center space-x-2 bg-gray-800 rounded-lg p-1 mr-4">
                <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1 hover:bg-gray-700 rounded transition-colors text-gray-300 disabled:opacity-30"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-mono">Page {currentPage} of {totalPages}</span>
                <button 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1 hover:bg-gray-700 rounded transition-colors text-gray-300 disabled:opacity-30"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
             </div>

            <button 
              onClick={handleDownload}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center transition-colors"
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </button>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-lg text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
            
            {/* PDF Viewer Simulation (Left) */}
            <div className="flex-1 bg-gray-100 overflow-y-auto p-8 flex justify-center relative">
                <div 
                    className="bg-white shadow-lg transition-all duration-200 ease-in-out relative"
                    style={{ 
                        width: `${8.5 * (zoom / 100)}in`, 
                        minHeight: `${11 * (zoom / 100)}in`,
                        transformOrigin: 'top center'
                    }}
                >
                    {/* Simulated PDF Content */}
                    <div className="p-[1in] text-gray-800 text-xs sm:text-sm md:text-base selection:bg-blue-100">
                        <div className="border-b-2 border-gray-900 pb-4 mb-8 flex justify-between items-end">
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 uppercase tracking-wider">{document.assignedTo || 'Department'}</h1>
                                <p className="text-sm text-gray-500">Official Correspondence</p>
                            </div>
                            <div className="text-right">
                                <p className="font-mono text-sm font-bold">{document.referenceNumber}</p>
                                <p className="text-xs text-gray-500">{new Date(document.createdAt).toLocaleDateString()}</p>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div>
                                <p className="font-bold text-gray-900">SUBJECT: {document.title}</p>
                                <p className="text-gray-600 mt-1">To: {document.assignedTo}</p>
                                <p className="text-gray-600">From: {document.createdBy} (System User)</p>
                            </div>

                            <div className="h-px bg-gray-200"></div>

                            <div className="text-justify leading-relaxed space-y-4">
                                <p><strong>1. Introduction</strong></p>
                                <p>
                                    {document.description}
                                </p>
                                <p className="text-gray-400 italic">[Simulated PDF Content - Page {currentPage}]</p>
                                <p>
                                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 
                                    Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
                                </p>
                                <p>
                                    Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. 
                                    Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
                                </p>
                                <p><strong>2. Details</strong></p>
                                <p>
                                    Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, 
                                    eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.
                                </p>
                            </div>

                             <div className="mt-20 pt-10 border-t border-gray-300 flex justify-between">
                                <div>
                                    <div className="w-40 h-10 border-b border-gray-400 mb-2"></div>
                                    <p className="text-xs text-gray-500 uppercase">Approved By</p>
                                </div>
                                <div>
                                    <div className="w-40 h-10 border-b border-gray-400 mb-2"></div>
                                    <p className="text-xs text-gray-500 uppercase">Received By</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Action Panel (Right) */}
            <div className="w-80 bg-white border-l border-gray-200 flex flex-col shadow-xl z-20">
                <div className="p-4 border-b border-gray-200 bg-gray-50">
                    <h3 className="font-semibold text-gray-900">Document Actions</h3>
                </div>
                
                <div className="p-4 flex-1 overflow-y-auto space-y-6">
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                            Classification
                        </label>
                        <span className={`px-3 py-1 rounded-full text-xs font-medium inline-block ${
                            document.priority === 'Highly Technical Transaction' ? 'bg-red-100 text-red-700' : 
                            document.priority === 'Complex Transaction' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                        }`}>
                            {document.priority}
                        </span>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                            Summary (AI Generated)
                        </label>
                        <div className="bg-purple-50 p-3 rounded-lg border border-purple-100 text-xs text-purple-800 leading-relaxed">
                            {document.summary || "No summary available."}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                            Remarks / Notes
                        </label>
                        <textarea 
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none h-40 text-sm resize-none"
                            placeholder="Enter your notes here to update the document log..."
                        />
                         <p className="text-xs text-gray-400 mt-2">
                            Updating remarks will create a new entry in the transaction history.
                        </p>
                    </div>
                </div>

                <div className="p-4 border-t border-gray-200 bg-gray-50">
                     <button
                        onClick={handleSave}
                        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center justify-center shadow-sm font-medium transition-colors"
                    >
                        <Save className="w-4 h-4 mr-2" />
                        Save Remarks
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};