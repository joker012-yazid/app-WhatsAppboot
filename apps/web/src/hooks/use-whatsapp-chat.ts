"use client";

import { useEffect, useState } from 'react';

export type FilterType = 'all' | 'unread' | 'favorites' | 'groups';

type ChatSummary = {
  id: string;
  name: string;
  lastMessage: string;
  lastMessageAt: number;
  unreadCount: number;
  isGroup?: boolean;
  isFavorite?: boolean;
};

type MessageItem = {
  id: string;
  chatId: string;
  fromMe: boolean;
  text: string;
  timestamp: number;
};

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:4000';

const seedTimestamp = (minutesAgo: number) => Date.now() - minutesAgo * 60 * 1000;

const mockMessages: MessageItem[] = [
  {
    id: 'm-1',
    chatId: 'chat-1',
    fromMe: false,
    text: 'Hey team, the POS sync finished for the morning batch.',
    timestamp: seedTimestamp(65),
  },
  {
    id: 'm-2',
    chatId: 'chat-1',
    fromMe: true,
    text: 'Nice, did any terminals report disconnects?',
    timestamp: seedTimestamp(62),
  },
  {
    id: 'm-3',
    chatId: 'chat-1',
    fromMe: false,
    text: 'Only kiosk-07 went offline once. Auto-recovered.',
    timestamp: seedTimestamp(59),
  },
  {
    id: 'm-4',
    chatId: 'chat-2',
    fromMe: false,
    text: 'Can we schedule a WhatsApp blast for VIP members this weekend?',
    timestamp: seedTimestamp(35),
  },
  {
    id: 'm-5',
    chatId: 'chat-2',
    fromMe: true,
    text: 'Yes, drafting the template now. Will share for approval.',
    timestamp: seedTimestamp(33),
  },
  {
    id: 'm-6',
    chatId: 'chat-3',
    fromMe: false,
    text: 'Reminder: Outlet 12 requested a new QR menu link.',
    timestamp: seedTimestamp(10),
  },
  {
    id: 'm-7',
    chatId: 'chat-4',
    fromMe: true,
    text: 'Welcome to the pilot! Reply here for support anytime.',
    timestamp: seedTimestamp(5),
  },
  {
    id: 'm-8',
    chatId: 'chat-4',
    fromMe: false,
    text: 'Got it, thanks for the quick onboarding.',
    timestamp: seedTimestamp(3),
  },
];

const mockChats: ChatSummary[] = [
  {
    id: 'chat-1',
    name: 'Ops Bridge',
    lastMessage: 'Only kiosk-07 went offline once. Auto-recovered.',
    lastMessageAt: seedTimestamp(59),
    unreadCount: 2,
    isGroup: true,
    isFavorite: true,
  },
  {
    id: 'chat-2',
    name: 'Marketing Squad',
    lastMessage: 'Yes, drafting the template now. Will share for approval.',
    lastMessageAt: seedTimestamp(33),
    unreadCount: 0,
    isGroup: true,
    isFavorite: false,
  },
  {
    id: 'chat-3',
    name: 'Outlet 12 Manager',
    lastMessage: 'Reminder: Outlet 12 requested a new QR menu link.',
    lastMessageAt: seedTimestamp(10),
    unreadCount: 1,
    isGroup: false,
    isFavorite: true,
  },
  {
    id: 'chat-4',
    name: 'Pilot Client - LaptopPro',
    lastMessage: 'Got it, thanks for the quick onboarding.',
    lastMessageAt: seedTimestamp(3),
    unreadCount: 0,
    isGroup: false,
    isFavorite: false,
  },
];

async function fetchChatsFromApi() {
  // TODO: integrate with real API, e.g. `${API_BASE}/whatsapp/chats`
  await Promise.resolve(API_BASE);
}

export function useWhatsappChat() {
  const [chats, setChats] = useState<ChatSummary[]>(mockChats);
  const [messages, setMessages] = useState<MessageItem[]>(mockMessages);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>('all');

  useEffect(() => {
    // Placeholder for future API hydration
    fetchChatsFromApi().catch(() => {
      // fall back to mock data silently
    });
  }, []);

  const selectChat = (chatId: string) => {
    setSelectedChatId(chatId);
    setChats((prev) =>
      prev.map((chat) => (chat.id === chatId ? { ...chat, unreadCount: 0 } : chat)),
    );
  };

  const sendMessage = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !selectedChatId) return false;

    const timestamp = Date.now();
    const newMessage: MessageItem = {
      id: `local-${timestamp}`,
      chatId: selectedChatId,
      fromMe: true,
      text: trimmed,
      timestamp,
    };

    setMessages((prev) => [...prev, newMessage]);
    setChats((prev) =>
      prev.map((chat) =>
        chat.id === selectedChatId
          ? {
              ...chat,
              lastMessage: trimmed,
              lastMessageAt: timestamp,
              unreadCount: chat.unreadCount,
            }
          : chat,
      ),
    );

    return true;
  };

  const selectedChat = chats.find((chat) => chat.id === selectedChatId) ?? null;
  const visibleChats = chats.filter((chat) => {
    if (filter === 'unread') return chat.unreadCount > 0;
    if (filter === 'favorites') return Boolean(chat.isFavorite);
    if (filter === 'groups') return Boolean(chat.isGroup);
    return true;
  });

  const selectedMessages = selectedChatId
    ? messages.filter((msg) => msg.chatId === selectedChatId)
    : [];

  return {
    chats: visibleChats,
    filter,
    messages: selectedMessages,
    selectedChat,
    selectedChatId,
    selectChat,
    sendMessage,
    setFilter,
  };
}
