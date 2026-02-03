/**
 * Placeholder data for development
 * TODO: Replace with actual data fetching from IndexedDB and backend
 */

import type { Chat, Message } from './types';

export const PLACEHOLDER_CHATS: Chat[] = [
  {
    id: '1',
    name: 'Team General',
    lastMessage: 'Hey everyone, how is the project going?',
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 5), // 5 minutes ago
    unreadCount: 3,
    isGroup: true,
  },
  {
    id: '2',
    name: 'Alice Johnson',
    lastMessage: 'Thanks for the help!',
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
    unreadCount: 0,
    isGroup: false,
  },
  {
    id: '3',
    name: 'Project Alpha',
    lastMessage: 'The deadline is next week',
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
    unreadCount: 1,
    isGroup: true,
  },
  {
    id: '4',
    name: 'Bob Smith',
    lastMessage: 'Can you review my PR?',
    lastMessageTime: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
    unreadCount: 0,
    isGroup: false,
  },
];

export const PLACEHOLDER_MESSAGES: Record<string, Message[]> = {
  '1': [
    {
      id: 'm1',
      chatId: '1',
      senderId: 'user-other-1',
      content: 'Good morning team! 👋',
      timestamp: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
      status: 'read',
      isOwn: false,
    },
    {
      id: 'm2',
      chatId: '1',
      senderId: 'current-user',
      content: 'Morning! Ready for the standup?',
      timestamp: new Date(Date.now() - 1000 * 60 * 55),
      status: 'read',
      isOwn: true,
    },
    {
      id: 'm3',
      chatId: '1',
      senderId: 'user-other-2',
      content: 'Yes, let me grab my coffee first ☕',
      timestamp: new Date(Date.now() - 1000 * 60 * 50),
      status: 'read',
      isOwn: false,
    },
    {
      id: 'm4',
      chatId: '1',
      senderId: 'user-other-1',
      content: 'Hey everyone, how is the project going?',
      timestamp: new Date(Date.now() - 1000 * 60 * 5),
      status: 'delivered',
      isOwn: false,
    },
  ],
  '2': [
    {
      id: 'm5',
      chatId: '2',
      senderId: 'current-user',
      content: 'Hi Alice, I finished reviewing the design docs',
      timestamp: new Date(Date.now() - 1000 * 60 * 45),
      status: 'read',
      isOwn: true,
    },
    {
      id: 'm6',
      chatId: '2',
      senderId: 'user-alice',
      content: 'Thanks for the help!',
      timestamp: new Date(Date.now() - 1000 * 60 * 30),
      status: 'read',
      isOwn: false,
    },
  ],
  '3': [
    {
      id: 'm7',
      chatId: '3',
      senderId: 'user-pm',
      content: 'Reminder: Sprint planning tomorrow at 10 AM',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3),
      status: 'read',
      isOwn: false,
    },
    {
      id: 'm8',
      chatId: '3',
      senderId: 'user-pm',
      content: 'The deadline is next week',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
      status: 'delivered',
      isOwn: false,
    },
  ],
  '4': [
    {
      id: 'm9',
      chatId: '4',
      senderId: 'user-bob',
      content: 'Hey, I just pushed some changes',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 25),
      status: 'read',
      isOwn: false,
    },
    {
      id: 'm10',
      chatId: '4',
      senderId: 'user-bob',
      content: 'Can you review my PR?',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
      status: 'read',
      isOwn: false,
    },
  ],
};

export const CURRENT_USER_ID = 'current-user';
