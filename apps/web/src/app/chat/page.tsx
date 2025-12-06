'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  AlertTriangle,
  ArrowLeft,
  MessageCircle,
  MoreVertical,
  RefreshCw,
  Search,
  Send,
  Smile,
  Phone,
  Video,
  Paperclip,
  Mic,
  CheckCheck,
  Clock,
  Wifi,
  WifiOff,
  QrCode,
  Users,
} from 'lucide-react';

import { AnimatedButton } from '@/components/ui/animated-button';
import { useWhatsappChat, type FilterType } from '@/hooks/use-whatsapp-chat';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

const filters: { key: FilterType; label: string; icon: React.ReactNode }[] = [
  { key: 'all', label: 'All', icon: <MessageCircle className="h-3.5 w-3.5" /> },
  { key: 'unread', label: 'Unread', icon: <Clock className="h-3.5 w-3.5" /> },
  { key: 'groups', label: 'Groups', icon: <Users className="h-3.5 w-3.5" /> },
];

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
});

const formatTime = (timestamp?: number) =>
  timestamp ? timeFormatter.format(new Date(timestamp)) : '';

const getInitials = (name: string) =>
  name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

export default function ChatPage() {
  const { user } = useAuth();
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [messageDraft, setMessageDraft] = useState('');
  const messageEndRef = useRef<HTMLDivElement | null>(null);

  const {
    status,
    chats,
    filter,
    messages,
    selectedChat,
    selectedChatId,
    selectChat,
    sendMessage,
    setFilter,
    startSession,
    resetSession,
    loadingStatus,
    sending,
  } = useWhatsappChat();

  const connectionStatus = useMemo(() => {
    const state = status?.status || 'disconnected';
    if (state === 'connected')
      return {
        label: 'Connected',
        color: 'bg-green-500',
        icon: <Wifi className="h-3.5 w-3.5" />,
      };
    if (state === 'qr_ready')
      return {
        label: 'Scan QR',
        color: 'bg-amber-500',
        icon: <QrCode className="h-3.5 w-3.5" />,
      };
    if (state === 'connecting')
      return {
        label: 'Connecting',
        color: 'bg-blue-500 animate-pulse',
        icon: <RefreshCw className="h-3.5 w-3.5 animate-spin" />,
      };
    if (state === 'error')
      return {
        label: 'Error',
        color: 'bg-red-500',
        icon: <AlertTriangle className="h-3.5 w-3.5" />,
      };
    return {
      label: 'Offline',
      color: 'bg-slate-500',
      icon: <WifiOff className="h-3.5 w-3.5" />,
    };
  }, [status?.status]);

  const filteredChats = chats.filter((chat) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      chat.name.toLowerCase().includes(term) ||
      chat.lastMessage?.text?.toLowerCase().includes(term)
    );
  });

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedChatId]);

  const handleSelectChat = (chatId: string) => {
    selectChat(chatId);
    setMobileView('chat');
  };

  const handleSendMessage = async () => {
    if (!selectedChatId) {
      toast.info('Select a chat to start messaging');
      return;
    }
    if (!messageDraft.trim()) return;

    try {
      const sent = await sendMessage(messageDraft);
      if (sent) {
        setMessageDraft('');
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to send message');
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  const showQR = status?.status === 'qr_ready' && status?.qrImage;
  const isConnected = status?.status === 'connected';

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold text-foreground">WhatsApp Chat</h1>
          <p className="text-sm text-muted-foreground">
            Monitor and reply to WhatsApp messages in real-time
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium text-white',
              connectionStatus.color
            )}
          >
            {connectionStatus.icon}
            {connectionStatus.label}
          </div>
          <AnimatedButton
            size="sm"
            variant="outline"
            onClick={() => startSession(false)}
            disabled={loadingStatus}
            leftIcon={
              <RefreshCw
                className={cn('h-4 w-4', loadingStatus && 'animate-spin')}
              />
            }
          >
            {isConnected ? 'Reconnect' : 'Start Session'}
          </AnimatedButton>
          <AnimatedButton
            size="sm"
            variant="ghost"
            onClick={() => resetSession()}
            disabled={loadingStatus}
          >
            Reset
          </AnimatedButton>
        </div>
      </motion.div>

      {/* Main Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-1 min-h-0 gap-4 rounded-xl border border-border bg-card/50 backdrop-blur overflow-hidden"
      >
        {/* Chat List Sidebar */}
        <aside
          className={cn(
            'flex flex-col border-r border-border bg-card/80',
            mobileView === 'list' ? 'flex w-full' : 'hidden',
            'md:flex md:w-[340px]'
          )}
        >
          <div className="border-b border-border p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-foreground">Conversations</h2>
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs font-medium',
                  isConnected
                    ? 'bg-green-500/10 text-green-500'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {isConnected ? 'Live' : 'Offline'}
              </span>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search conversations..."
                className="w-full rounded-lg border border-border bg-background pl-10 pr-4 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="flex gap-2 mt-3">
              {filters.map((item) => (
                <button
                  key={item.key}
                  onClick={() => setFilter(item.key)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all',
                    filter === item.key
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {filteredChats.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                <MessageCircle className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground">
                  No conversations found
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  {isConnected
                    ? 'Start chatting!'
                    : 'Connect WhatsApp to see chats'}
                </p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredChats.map((chat, index) => {
                  const isActive = chat.id === selectedChatId;
                  return (
                    <motion.button
                      key={chat.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                      onClick={() => handleSelectChat(chat.id)}
                      className={cn(
                        'w-full flex items-center gap-3 rounded-lg p-3 text-left transition-all',
                        isActive
                          ? 'bg-primary/10 border border-primary/30'
                          : 'hover:bg-muted/50'
                      )}
                    >
                      <div
                        className={cn(
                          'flex h-12 w-12 items-center justify-center rounded-full text-sm font-semibold',
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground'
                        )}
                      >
                        {getInitials(chat.name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p
                            className={cn(
                              'font-medium truncate',
                              isActive ? 'text-primary' : 'text-foreground'
                            )}
                          >
                            {chat.name}
                          </p>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {chat.lastMessage?.timestamp
                              ? formatTime(chat.lastMessage.timestamp)
                              : ''}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-2 mt-0.5">
                          <p className="text-xs text-muted-foreground truncate">
                            {chat.lastMessage?.text || 'No messages yet'}
                          </p>
                          {chat.unreadCount > 0 && (
                            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
                              {chat.unreadCount}
                            </span>
                          )}
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            )}
          </div>
        </aside>

        {/* Chat Area */}
        <div
          className={cn(
            'flex flex-1 flex-col',
            mobileView === 'chat' ? 'flex' : 'hidden',
            'md:flex'
          )}
        >
          {showQR ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-6 max-w-md text-center"
              >
                <div className="rounded-full bg-primary/10 p-4">
                  <QrCode className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-foreground mb-2">
                    Scan QR Code
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Open WhatsApp on your phone → Linked devices → Link a device
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-white p-4 shadow-lg">
                  <Image
                    src={status!.qrImage!}
                    alt="WhatsApp QR"
                    width={240}
                    height={240}
                  />
                </div>
                <AnimatedButton
                  variant="outline"
                  onClick={() => startSession(true)}
                  disabled={loadingStatus}
                  leftIcon={
                    <RefreshCw
                      className={cn('h-4 w-4', loadingStatus && 'animate-spin')}
                    />
                  }
                >
                  Refresh QR Code
                </AnimatedButton>
              </motion.div>
            </div>
          ) : status?.status !== 'connected' ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-6 max-w-md text-center"
              >
                <div className="rounded-full bg-primary/10 p-4">
                  <MessageCircle className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-foreground mb-2">
                    Start WhatsApp Session
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Connect your WhatsApp to start receiving and sending
                    messages
                  </p>
                </div>
                {status?.status === 'error' && status.lastError && (
                  <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400">
                    <AlertTriangle className="h-4 w-4" />
                    {status.lastError}
                  </div>
                )}
                <AnimatedButton
                  onClick={() => startSession(false)}
                  disabled={loadingStatus}
                  leftIcon={
                    <RefreshCw
                      className={cn('h-4 w-4', loadingStatus && 'animate-spin')}
                    />
                  }
                >
                  Start Session
                </AnimatedButton>
              </motion.div>
            </div>
          ) : !selectedChat ? (
            <div className="flex flex-1 items-center justify-center p-6">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-4 max-w-md text-center"
              >
                <div className="rounded-full bg-primary/10 p-6">
                  <MessageCircle className="h-12 w-12 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-foreground mb-2">
                    Select a conversation
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    Choose a chat from the list to view messages and start
                    replying
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Logged in as{' '}
                  <span className="font-medium text-foreground">
                    {user?.email}
                  </span>
                </p>
              </motion.div>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setMobileView('list')}
                    className="rounded-lg p-2 hover:bg-muted md:hidden"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                    {getInitials(selectedChat.name)}
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">
                      {selectedChat.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {isConnected ? 'Online' : 'Offline'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
                    <Phone className="h-5 w-5" />
                  </button>
                  <button className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
                    <Video className="h-5 w-5" />
                  </button>
                  <button className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
                    <MoreVertical className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <AnimatePresence>
                  {messages.map((message, index) => {
                    const isMine = message.fromMe;
                    return (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ delay: index * 0.02 }}
                        className={cn(
                          'flex',
                          isMine ? 'justify-end' : 'justify-start'
                        )}
                      >
                        <div
                          className={cn(
                            'max-w-[75%] rounded-2xl px-4 py-2 shadow-sm',
                            isMine
                              ? 'bg-primary text-primary-foreground rounded-br-md'
                              : 'bg-muted text-foreground rounded-bl-md'
                          )}
                        >
                          <p className="text-sm leading-relaxed whitespace-pre-wrap">
                            {message.text}
                          </p>
                          <div
                            className={cn(
                              'flex items-center justify-end gap-1 mt-1',
                              isMine
                                ? 'text-primary-foreground/70'
                                : 'text-muted-foreground'
                            )}
                          >
                            <span className="text-[10px]">
                              {formatTime(message.timestamp)}
                            </span>
                            {isMine && <CheckCheck className="h-3.5 w-3.5" />}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
                <div ref={messageEndRef} />
              </div>

              <div className="border-t border-border p-4">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="flex items-end gap-2"
                >
                  <button
                    type="button"
                    className="rounded-lg p-2.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Smile className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    className="rounded-lg p-2.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Paperclip className="h-5 w-5" />
                  </button>
                  <div className="flex-1">
                    <textarea
                      value={messageDraft}
                      onChange={(e) => setMessageDraft(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Type a message..."
                      rows={1}
                      className="w-full resize-none rounded-xl border border-border bg-background px-4 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20 max-h-32"
                    />
                  </div>
                  {messageDraft.trim() ? (
                    <AnimatedButton
                      type="submit"
                      size="icon"
                      className="h-10 w-10 rounded-xl"
                      disabled={sending}
                    >
                      <Send className="h-5 w-5" />
                    </AnimatedButton>
                  ) : (
                    <button
                      type="button"
                      className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"
                    >
                      <Mic className="h-5 w-5" />
                    </button>
                  )}
                </form>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
