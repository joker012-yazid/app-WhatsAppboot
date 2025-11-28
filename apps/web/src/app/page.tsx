"use client";

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, MessageCircle, MoreVertical, Search, Send, Smile } from 'lucide-react';

import AuthGuard from '@/components/auth-guard';
import { useToast } from '@/components/toast-provider';
import { Button } from '@/components/ui/button';
import { useWhatsappChat, type FilterType } from '@/hooks/use-whatsapp-chat';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';

const filters: { key: FilterType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'favorites', label: 'Favorites' },
  { key: 'groups', label: 'Groups' },
];

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
});

const formatTime = (timestamp: number) => timeFormatter.format(new Date(timestamp));

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

  const { chats, filter, messages, selectedChat, selectedChatId, selectChat, sendMessage, setFilter } =
    useWhatsappChat();

  const filteredChats = chats.filter((chat) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      chat.name.toLowerCase().includes(term) ||
      chat.lastMessage.toLowerCase().includes(term)
    );
  });

  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, selectedChatId]);

  const handleSelectChat = (chatId: string) => {
    selectChat(chatId);
    setMobileView('chat');
  };

  const handleSendMessage = () => {
    if (!selectedChatId) {
      toast.info('Select a chat to start messaging');
      return;
    }
    const sent = sendMessage(messageDraft);
    if (sent) {
      setMessageDraft('');
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <AuthGuard>
      <section className="overflow-hidden rounded-xl border bg-card/60 shadow-sm backdrop-blur flex flex-col h-[calc(100vh-180px)]">
        <div className="flex items-start justify-between gap-4 border-b bg-background/60 px-6 py-4">
          <div className="space-y-1">
            <p className="text-xs uppercase tracking-[0.35em] text-muted-foreground">Control</p>
            <h1 className="text-2xl font-semibold">WhatsApp Chat Workspace</h1>
            <p className="text-sm text-muted-foreground">
              Monitor and respond to WhatsApp threads powered by Baileys.
            </p>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            Authenticated as{' '}
            <span className="font-semibold text-foreground">{user?.email ?? 'unknown'}</span>
            {user?.role ? ` (${user.role})` : null}
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <aside
            className={cn(
              'border-r bg-background/80 transition-all duration-300',
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
                Live
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
                          isActive
                            ? 'bg-primary/10 ring-1 ring-primary/30'
                            : 'hover:bg-muted/60',
                        )}
                      >
                        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                          {getInitials(chat.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold">{chat.name}</p>
                              <p className="truncate text-xs text-muted-foreground">{chat.lastMessage}</p>
                            </div>
                            <div className="flex shrink-0 flex-col items-end gap-1">
                              <span className="text-[11px] text-muted-foreground">
                                {formatTime(chat.lastMessageAt)}
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
              'flex flex-1 flex-col bg-gradient-to-b from-background to-background/80',
              mobileView === 'chat' ? 'flex' : 'hidden',
              'md:flex',
            )}
          >
            {!selectedChat ? (
              <div className="flex flex-1 items-center justify-center px-6">
                <div className="flex max-w-lg flex-col items-center gap-4 rounded-2xl border bg-background/60 px-10 py-12 text-center shadow-sm backdrop-blur">
                  <div className="rounded-full bg-primary/10 p-4 text-primary">
                    <MessageCircle size={42} />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-2xl font-semibold">WhatsApp Bot for LaptopPro</h2>
                    <p className="text-sm text-muted-foreground">
                      Use this control room to monitor and reply WhatsApp messages powered by Baileys.
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Authenticated as{' '}
                    <span className="font-semibold text-foreground">{user?.email ?? 'unknown'}</span>
                    {user?.role ? ` (${user.role})` : null}
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b bg-background/80 px-6 py-4 backdrop-blur">
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
                      <p className="text-lg font-semibold leading-tight">{selectedChat.name}</p>
                      <p className="text-xs text-muted-foreground">
                        last seen today at {formatTime(selectedChat.lastMessageAt)}
                      </p>
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
                              isMine
                                ? 'ml-auto bg-primary text-primary-foreground'
                                : 'bg-muted text-foreground',
                            )}
                          >
                            <p className="leading-relaxed">{message.text}</p>
                            <span
                              className={cn(
                                'mt-1 block text-[11px]',
                                isMine ? 'text-primary-foreground/70' : 'text-muted-foreground',
                              )}
                            >
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
                  className="border-t bg-background/95 px-4 py-3"
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
                    <Button type="submit" size="icon" className="h-11 w-11">
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
