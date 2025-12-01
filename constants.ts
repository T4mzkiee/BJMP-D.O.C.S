
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
    name: 'JO1 De Ocampo',
    email: 'ord@bjmp.com',
    role: Role.USER,
    isActive: true,
    department: 'ORD',
    password: 'user123',
    avatarUrl: 'https://picsum.photos/200/200?random=2'
  },
  {
    id: '3',
    name: 'JO1 Naputo',
    email: 'arda@bjmp.com',
    role: Role.USER,
    isActive: true,
    department: 'ARDA',
    password: 'user123',
    avatarUrl: 'https://picsum.photos/200/200?random=3'
  },
  {
    id: '4',
    name: 'JO1 Palita',
    email: 'ardo@bjmp.com',
    role: Role.USER,
    isActive: true,
    department: 'ARDO',
    password: 'user123',
    avatarUrl: 'https://picsum.photos/200/200?random=4'
  },
  {
    id: '5',
    name: 'JO1 Palita',
    email: 'rcds@bjmp.com',
    role: Role.USER,
    isActive: true,
    department: 'RCDS',
    password: 'user123',
    avatarUrl: 'https://picsum.photos/200/200?random=5'
  },
  {
    id: '6',
    name: 'JO1 Quejada',
    email: 'rictmd@bjmp.com',
    role: Role.USER,
    isActive: true,
    department: 'RICTMD',
    password: 'user123',
    avatarUrl: 'https://picsum.photos/200/200?random=6'
  },
  {
    id: '7',
    name: 'JO2 Derecho',
    email: 'rprmd@bjmp.com',
    role: Role.USER,
    isActive: true,
    department: 'RPRMD',
    password: 'user123',
    avatarUrl: 'https://picsum.photos/200/200?random=7'
  }
];

export const INITIAL_DOCUMENTS: DocumentTrack[] = [];
