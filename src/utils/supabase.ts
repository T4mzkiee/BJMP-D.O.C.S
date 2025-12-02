

import { createClient } from '@supabase/supabase-js';
import { User, DocumentTrack, DocumentLog, Role, DocStatus, DocCommunication } from '../types';

// Credentials provided by the user
const supabaseUrl = 'https://vpjzqalmonzqjiprichk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZwanpxYWxtb256cWppcHJpY2hrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ1NjE1MzUsImV4cCI6MjA4MDEzNzUzNX0.YKM4Jjzk6nYi0lPdyxGWEjMXSpxr-myaj3eQDp1BWfU';

export const supabase = createClient(supabaseUrl, supabaseKey);

// --- STORAGE HELPER ---
export const uploadFile = async (file: File, bucket: string = 'avatars'): Promise<string | null> => {
  try {
    // Create a unique file name: timestamp_sanitized-name
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
    const filePath = `${fileName}`;

    // Upload to Supabase
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file);

    if (uploadError) {
      console.error('Error uploading file:', uploadError);
      return null;
    }

    // Get Public URL
    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return data.publicUrl;
  } catch (error) {
    console.error('Upload failed:', error);
    return null;
  }
};

// --- MAPPERS ---
// These functions convert between the Application's Data Structure (CamelCase)
// and the Database's Data Structure (snake_case)

export const mapUserFromDB = (u: any): User => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role as Role,
  isActive: u.is_active,
  department: u.department,
  password: u.password,
  salt: u.salt,
  avatarUrl: u.avatar_url,
  isLoggedIn: u.is_logged_in // Map from DB
});

export const mapUserToDB = (u: Partial<User>) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  is_active: u.isActive,
  department: u.department,
  password: u.password,
  salt: u.salt,
  avatar_url: u.avatarUrl,
  is_logged_in: u.isLoggedIn // Map to DB
});

export const mapDocFromDB = (d: any, logs: any[]): DocumentTrack => ({
  id: d.id,
  title: d.title,
  referenceNumber: d.reference_number,
  description: d.description,
  status: d.status as DocStatus,
  priority: d.priority,
  communicationType: d.communication_type as DocCommunication || 'Regular', 
  assignedTo: d.assigned_to,
  createdBy: d.created_by,
  createdAt: d.created_at || new Date().toISOString(),
  updatedAt: d.updated_at || new Date().toISOString(),
  summary: d.summary,
  remarks: d.remarks,
  logs: logs.map(mapLogFromDB)
});

export const mapDocToDB = (d: Partial<DocumentTrack>) => ({
  id: d.id,
  title: d.title,
  reference_number: d.referenceNumber,
  description: d.description,
  status: d.status,
  priority: d.priority,
  communication_type: d.communicationType,
  assigned_to: d.assignedTo,
  created_by: d.createdBy,
  created_at: d.createdAt,
  updated_at: d.updatedAt,
  summary: d.summary,
  remarks: d.remarks
});

export const mapLogFromDB = (l: any): DocumentLog => ({
  id: l.id,
  date: l.created_at || l.date || new Date().toISOString(),
  action: l.action,
  department: l.department,
  userName: l.user_name,
  status: l.status as DocStatus,
  remarks: l.remarks
});

export const mapLogToDB = (l: DocumentLog, docId: string) => ({
  id: l.id,
  document_id: docId,
  action: l.action,
  department: l.department,
  user_name: l.userName,
  status: l.status,
  remarks: l.remarks,
  created_at: l.date
});