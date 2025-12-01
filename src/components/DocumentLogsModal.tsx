import React from 'react';
import { DocumentTrack, DocStatus } from '../types';
import { X, Calendar, User as UserIcon, Building2, CircleDot, ArrowDown } from 'lucide-react';

interface DocumentLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  document: DocumentTrack | null;
}

export const DocumentLogsModal: React.FC<DocumentLogsModalProps> = ({ isOpen, onClose, document }) => {
  if (!isOpen || !document) return null;

  // Sort logs by date (newest first for display, or oldest first for timeline flow)
  // Let's do oldest first to show the flow "from office to office"
  const sortedLogs = [...(document.logs || [])].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-70 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border border-gray-700">
        {/* Header */}
        <div className="p-6 border-b border-gray-700 flex justify-between items-start bg-gray-900/30">
          <div>
            <h2 className="text-xl font-bold text-white">{document.title}</h2>
            <p className="text-sm text-gray-400 font-mono mt-1">{document.referenceNumber}</p>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-gray-200 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Timeline Body */}
        <div className="p-6 overflow-y-auto flex-1">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-6">Transaction History</h3>
          
          <div className="relative border-l-2 border-gray-700 ml-3 space-y-8">
            {sortedLogs.length > 0 ? (
                sortedLogs.map((log, index) => (
                <div key={log.id} className="relative pl-8">
                    {/* Timeline Dot */}
                    <div className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full border-2 border-gray-800 shadow-sm ${
                        index === sortedLogs.length - 1 ? 'bg-green-500' : 'bg-blue-500'
                    }`}></div>

                    {/* Card */}
                    <div className="bg-gray-700 rounded-lg border border-gray-600 p-4 shadow-sm hover:border-gray-500 transition-colors">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-2">
                            <span className="font-semibold text-gray-200 text-sm flex items-center">
                                {log.action}
                            </span>
                            <div className="flex items-center text-xs text-gray-400">
                                <Calendar className="w-3 h-3 mr-1" />
                                {new Date(log.date).toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                            <div className="flex items-center text-gray-300">
                                <Building2 className="w-3 h-3 mr-2 text-gray-500" />
                                {log.department}
                            </div>
                            <div className="flex items-center text-gray-300">
                                <UserIcon className="w-3 h-3 mr-2 text-gray-500" />
                                {log.userName}
                            </div>
                        </div>

                        {log.remarks && (
                            <div className="mt-3 text-xs bg-gray-800 p-2 rounded text-gray-400 italic border border-gray-600">
                                " {log.remarks} "
                            </div>
                        )}
                        
                        <div className="mt-3">
                             <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                                log.status === DocStatus.COMPLETED ? 'bg-green-900/50 text-green-300 border-green-800' :
                                log.status === DocStatus.RETURNED ? 'bg-red-900/50 text-red-300 border-red-800' :
                                log.status === DocStatus.PROCESSING ? 'bg-yellow-900/50 text-yellow-300 border-yellow-800' :
                                log.status === DocStatus.OUTGOING ? 'bg-orange-900/50 text-orange-300 border-orange-800' :
                                'bg-blue-900/50 text-blue-300 border-blue-800'
                            }`}>
                                {log.status === DocStatus.COMPLETED ? 'DONE PROCESS' : (log.status === DocStatus.RETURNED ? 'RETURNED' : log.status)}
                            </span>
                        </div>
                    </div>
                </div>
                ))
            ) : (
                <div className="pl-8 text-sm text-gray-500">No logs available for this document.</div>
            )}
          </div>
          
          {document.status === DocStatus.COMPLETED && (
             <div className="flex items-center justify-center mt-8 text-green-400 font-medium text-sm">
                 <CircleDot className="w-4 h-4 mr-2" />
                 Transaction Completed
             </div>
          )}
        </div>
      </div>
    </div>
  );
};