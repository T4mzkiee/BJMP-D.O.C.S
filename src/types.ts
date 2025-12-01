

export enum Role {
  ADMIN = 'ADMIN',
  USER = 'USER',
  MESSAGE_CENTER = 'MESSAGE CENTER'
}

export enum DocStatus {
  INCOMING = 'INCOMING',
  OUTGOING = 'OUTGOING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  ARCHIVED = 'ARCHIVED',
  RETURNED = 'RETURNED'
}

export interface Department {
  id: string;
  name: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  department: string;
  password?: string; // Hashed password
  salt?: string; // Unique salt per user
  avatarUrl?: string;
}

export interface DocumentLog {
  id: string;
  date: string;
  action: string; // e.g., "Created", "Forwarded", "Received", "Approved"
  department: string; // Department where action occurred
  userName: string; // Who performed the action
  status: DocStatus;
  remarks?: string;
}

export type DocClassification = 'Simple Transaction' | 'Complex Transaction' | 'Highly Technical Transaction';
export type DocCommunication = 'Urgent' | 'Priority' | 'Regular';

export interface DocumentTrack {
  id: string;
  title: string;
  referenceNumber: string;
  description: string;
  status: DocStatus;
  priority: DocClassification;
  communicationType?: DocCommunication; // Added field
  assignedTo: string; // User ID or Department Name
  createdBy: string; // User ID
  createdAt: string;
  updatedAt: string;
  summary?: string; // AI Generated
  remarks?: string; // Added remarks
  attachmentName?: string; // Added for file upload simulation
  fileUrl?: string;
  fileType?: string;
  logs: DocumentLog[]; // History of the document
}

export interface AuthState {
  isAuthenticated: boolean;
  currentUser: User | null;
}

export type Page = 'DASHBOARD' | 'USERS' | 'DOCUMENTS' | 'LOGIN' | 'ACCOUNT';