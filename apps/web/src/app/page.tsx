"use client";

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeft, MessageCircle, MoreVertical, RefreshCw, Search, Send, Smile } from 'lucide-react';

import AuthGuard from '@/components/auth-guard';
import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';
import { useWhatsappChat, type FilterType } from '@/hooks/use-whatsapp-chat';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

const filters: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'groups', label: 'Groups' },
];

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
});

const formatTime = (timestamp?: number) => (timestamp ? timeFormatter.format(new Date(timestamp)) : '');

const getInitials = (name: string) =>
  name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

export default function HomePage() {
  const { user } = useAuth();
  const toast = useToast();
  const [mobileView, setMobileView] = useState<'list' | 'chat'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [messageDraft, setMessageDraft] = useState('');
  const messageEndRef = useRef<HTMLDivElement | null>(null);

  const {
    status,
    chats,
    allChats,
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

  const connectionPill = useMemo(() => {
    const state = status?.status || 'disconnected';
    if (state === 'connected') return { label: 'Connected', className: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40' };
    if (state === 'qr_ready') return { label: 'Scan QR', className: 'bg-amber-500/15 text-amber-300 border-amber-500/40' };
    if (state === 'connecting') return { label: 'Connecting', className: 'bg-sky-500/15 text-sky-300 border-sky-500/40' };
    if (state === 'error') return { label: 'Error', className: 'bg-rose-500/15 text-rose-300 border-rose-500/40' };
    return { label: 'Disconnected', className: 'bg-slate-700/30 text-slate-200 border-slate-600/50' };
  }, [status?.status]);

  const filteredChats = chats.filter((chat) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return chat.name.toLowerCase().includes(term) || chat.lastMessage?.text?.toLowerCase().includes(term);
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
    <AuthGuard>
      <section className="flex h-[calc(100vh-180px)] flex-col overflow-hidden rounded-xl border bg-gradient-to-br from-slate-950/90 via-slate-900/80 to-slate-950/60 px-4 py-5 shadow-lg shadow-black/40 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/60 pb-3">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">WhatsApp</p>
            <h1 className="text-2xl font-semibold text-slate-50">WhatsApp Control Room</h1>
            <p className="text-sm text-muted-foreground">Monitor and reply WhatsApp messages via Baileys.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn('rounded-full border px-3 py-1 text-xs font-semibold', connectionPill.className)}>
              {connectionPill.label}
            </span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => startSession(false)} disabled={loadingStatus}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Start Session
              </Button>
              <Button size="sm" variant="ghost" onClick={() => resetSession()} disabled={loadingStatus}>
                Reset
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-1 min-h-0 gap-4">
          <aside
            className={cn(
              'rounded-lg border border-slate-800 bg-slate-950/70 shadow-sm transition-all duration-300',
              mobileView === 'list' ? 'flex w-full flex-col' : 'hidden',
              'md:flex md:w-[360px] md:flex-col',
            )}
          >
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Chats</p>
                <p className="text-xs text-muted-foreground">Linked with Baileys session</p>
              </div>
              <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-500">
                {isConnected ? 'Live' : 'Idle'}
              </span>
            </div>

            <div className="space-y-3 px-4 pb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <input
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search conversations"
                  className="w-full rounded-lg border border-border bg-background/80 px-10 py-2 text-sm outline-none ring-0 transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                {filters.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setFilter(item.key)}
                    className={cn(
                      'rounded-full border px-3 py-1 text-xs font-medium transition',
                      filter === item.key
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground',
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-4">
              {filteredChats.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border/60 px-4 py-10 text-center text-sm text-muted-foreground">
                  No conversations found.
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredChats.map((chat) => {
                    const isActive = chat.id === selectedChatId;
                    return (
                      <button
                        key={chat.id}
                        type="button"
                        onClick={() => handleSelectChat(chat.id)}
                        className={cn(
                          'group flex w-full items-center gap-3 rounded-lg px-3 py-3 text-left transition',
                          isActive ? 'bg-sky-500/10 ring-1 ring-sky-500/40' : 'hover:bg-muted/60',
                        )}
                      >
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                          {getInitials(chat.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold">{chat.name}</p>
                              <p className="truncate text-xs text-muted-foreground">{chat.lastMessage?.text || 'No messages yet'}</p>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1">
                              <span className="text-[11px] text-muted-foreground">
                                {chat.lastMessage?.timestamp ? formatTime(chat.lastMessage.timestamp) : ''}
                              </span>
                              {chat.unreadCount > 0 ? (
                                <span className="inline-flex min-w-[24px] justify-center rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
                                  {chat.unreadCount}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>

          <div
            className={cn(
              'flex flex-1 flex-col rounded-lg border border-slate-800 bg-slate-950/80 shadow-sm',
              mobileView === 'chat' ? 'flex' : 'hidden',
              'md:flex',
            )}
          >
            {showQR ? (
              <div className="flex flex-1 items-center justify-center px-6">
                <div className="flex w-full max-w-xl flex-col items-center gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 px-8 py-8 text-center shadow-sm backdrop-blur">
                  <div className="text-sm font-semibold text-slate-100">Scan to link WhatsApp</div>
                  <div className="overflow-hidden rounded-xl border border-slate-800 bg-black/20 shadow">
                    <Image src={status!.qrImage!} alt="WhatsApp QR" width={260} height={260} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Open WhatsApp on your phone → Linked devices → Link a device. Scan this QR to continue.
                  </p>
                  <Button variant="outline" onClick={() => startSession(true)} disabled={loadingStatus}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh QR
                  </Button>
                </div>
              </div>
            ) : status?.status !== 'connected' ? (
              <div className="flex flex-1 items-center justify-center px-6">
                <div className="flex max-w-md flex-col items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 px-8 py-10 text-center shadow-sm backdrop-blur">
                  <div className="rounded-full bg-primary/10 p-4 text-primary">
                    <MessageCircle size={36} />
                  </div>
                  <h2 className="text-xl font-semibold text-slate-50">Start WhatsApp Session</h2>
                  <p className="text-sm text-muted-foreground">
                    Initialize Baileys and scan the QR to sync messages to your control room.
                  </p>
                  {status?.status === 'error' && status.lastError ? (
                    <div className="flex items-center gap-2 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                      <AlertTriangle className="h-4 w-4" /> {status.lastError}
                    </div>
                  ) : null}
                  <Button onClick={() => startSession(false)} disabled={loadingStatus}>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Start Session
                  </Button>
                </div>
              </div>
            ) : !selectedChat ? (
              <div className="flex flex-1 items-center justify-center px-6">
                <div className="flex max-w-lg flex-col items-center gap-4 rounded-2xl border border-slate-800 bg-slate-900/70 px-10 py-12 text-center shadow-sm backdrop-blur">
                  <div className="rounded-full bg-primary/10 p-4 text-primary">
                    <MessageCircle size={42} />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-2xl font-semibold">Select a chat to start messaging</h2>
                    <p className="text-sm text-muted-foreground">
                      Pick a conversation from the left to view history and send replies.
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Authenticated as <span className="font-semibold text-foreground">{user?.email ?? 'unknown'}</span>
                    {user?.role ? ` (${user.role})` : null}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-950/80 px-6 py-4 backdrop-blur">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="md:hidden"
                      onClick={() => setMobileView('list')}
                    >
                      <ArrowLeft size={18} />
                    </Button>
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-base font-semibold text-primary">
                      {getInitials(selectedChat.name)}
                    </div>
                    <div>
                      <p className="text-lg font-semibold leading-tight text-slate-50">{selectedChat.name}</p>
                      <p className="text-xs text-muted-foreground">WhatsApp chat</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <button
                      type="button"
                      className="rounded-full p-2 transition hover:bg-muted hover:text-foreground"
                    >
                      <Search size={18} />
                    </button>
                    <button
                      type="button"
                      className="rounded-full p-2 transition hover:bg-muted hover:text-foreground"
                    >
                      <MoreVertical size={18} />
                    </button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-4">
                  <div className="flex flex-col space-y-2">
                    {messages.map((message) => {
                      const isMine = message.fromMe;
                      return (
                        <div key={message.id} className={cn('flex flex-col', isMine ? 'items-end' : 'items-start')}>
                          <div
                            className={cn(
                              'max-w-[70%] rounded-2xl px-4 py-2 text-sm shadow-sm transition',
                              isMine ? 'ml-auto bg-sky-500 text-slate-950' : 'bg-slate-800 text-slate-50',
                            )}
                          >
                            <p className="leading-relaxed">{message.text}</p>
                            <span className="mt-1 block text-[10px] text-slate-400">
                              {formatTime(message.timestamp)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messageEndRef} />
                  </div>
                </div>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSendMessage();
                  }}
                  className="border-t border-slate-800 bg-slate-950/95 px-4 py-3"
                >
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded-full p-2 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                    >
                      <Smile size={18} />
                    </button>
                    <textarea
                      value={messageDraft}
                      onChange={(e) => setMessageDraft(e.target.value)}
                      onKeyDown={handleKeyDown}
                      placeholder="Type a message"
                      rows={1}
                      className="min-h-[44px] max-h-28 flex-1 resize-none rounded-lg border border-border bg-background/80 px-3 py-2 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                    <Button type="submit" size="icon" className="h-11 w-11" disabled={!messageDraft.trim() || sending}>
                      <Send size={18} />
                    </Button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      </section>
    </AuthGuard>
  );
}
