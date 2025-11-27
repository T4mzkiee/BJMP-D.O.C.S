
import { User, Role, DocumentTrack, DocStatus } from './types';

export const INITIAL_USERS: User[] = [
  {
    id: '0',
    name: 'Justin Benedict C Macuto',
    email: 'tamz.personal@gmail.com',
    role: Role.ADMIN,
    isActive: true,
    department: 'RICTMD',
    password: 'admin',
    avatarUrl: 'https://picsum.photos/200/200?random=0'
  },
  {
    id: '1',
    name: 'Admin User',
    email: 'admin@doctrack.com',
    role: Role.ADMIN,
    isActive: true,
    department: 'IT Administration',
    password: 'admin', // Default password
    avatarUrl: 'https://picsum.photos/200/200?random=1'
  },
  {
    id: '2',
    name: 'John Doe',
    email: 'john@doctrack.com',
    role: Role.USER,
    isActive: true,
    department: 'Human Resources',
    password: 'user123', // Default password
    avatarUrl: 'https://picsum.photos/200/200?random=2'
  },
  {
    id: '3',
    name: 'Jane Smith',
    email: 'jane@doctrack.com',
    role: Role.USER,
    isActive: false,
    department: 'Finance',
    password: 'user123', // Default password
    avatarUrl: 'https://picsum.photos/200/200?random=3'
  }
];

export const INITIAL_DOCUMENTS: DocumentTrack[] = [];
