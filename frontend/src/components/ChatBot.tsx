// src/components/ChatbotWidget.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  MessageCircle, X, Send, Loader2, Bot, User,
  ChevronDown, RotateCcw,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Message {
  id:        string;
  role:      'user' | 'assistant';
  content:   string;
  timestamp: Date;
  error?:    boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const uid = () => Math.random().toString(36).slice(2, 9);

const formatTime = (d: Date) =>
  d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// Light markdown → JSX (bold, inline code, bullet points, line breaks)
const renderContent = (text: string) => {
  const lines = text.split('\n');
  return lines.map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    const formatted = parts.map((part, j) => {
      if (part.startsWith('**') && part.endsWith('**'))
        return <strong key={j}>{part.slice(2, -2)}</strong>;
      if (part.startsWith('`') && part.endsWith('`'))
        return (
          <code key={j} className="px-1 py-0.5 bg-muted rounded text-[11px] font-mono">
            {part.slice(1, -1)}
          </code>
        );
      return <span key={j}>{part}</span>;
    });

    const isBullet = line.trimStart().startsWith('- ') || line.trimStart().startsWith('• ');
    if (isBullet) {
      return (
        <div key={i} className="flex gap-2 items-start my-0.5">
          <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
          <span className="flex-1">
            {formatted.map((p, j) => {
              if (React.isValidElement(p)) return p;
              const s = String((p as any)?.props?.children ?? p);
              return <span key={j}>{s.replace(/^[-•]\s*/, '')}</span>;
            })}
          </span>
        </div>
      );
    }

    return (
      <div key={i} className={i < lines.length - 1 ? 'mb-1' : ''}>
        {formatted}
      </div>
    );
  });
};

// ─── Suggested questions ──────────────────────────────────────────────────────

const SUGGESTIONS_BY_ROLE: Record<string, string[]> = {
  employe: [
    'Quelles sont mes dernières demandes ?',
    'Quel est le statut de ma demande #1 ?',
    'Quels produits sont disponibles en stock ?',
    'Comment créer une nouvelle demande ?',
    'Comment modifier ou supprimer une demande ?',
    "Que faire si ma demande est refusée ?",
  ],
  'responsable departement': [
    'Combien de demandes en attente dans mon département ?',
    'Liste des demandes en attente de validation',
    'Statistiques de mon département',
    'Comment approuver ou refuser une demande ?',
    'Comment créer ma propre demande ?',
    'Quels produits sont en stock limité ?',
  ],
  'responsable stock': [
    'Combien de demandes attendent ma validation ?',
    'Quels produits sont en alerte de stock ?',
    'Derniers mouvements de stock',
    'Statistiques du stock actuel',
    'Comment valider une demande ?',
    'Comment enregistrer une entrée de stock ?',
  ],
  admin: [
    'Combien de demandes par département ?',
    'Vue globale de la plateforme',
    "Dernières actions dans l'historique",
    'Quels produits sont en alerte ?',
    "Combien d'utilisateurs actifs ?",
    'Toutes les demandes en attente',
  ],
};

const getSuggestions = (role?: string): string[] => {
  if (!role) return SUGGESTIONS_BY_ROLE['employe'];
  const normalized = role.toLowerCase().trim();
  return SUGGESTIONS_BY_ROLE[normalized] ?? SUGGESTIONS_BY_ROLE['employe'];
};

// ─── Message bubble ───────────────────────────────────────────────────────────

const MessageBubble: React.FC<{ msg: Message }> = ({ msg }) => {
  const isUser = msg.role === 'user';
  return (
    <div className={`flex gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5
        ${isUser ? 'bg-primary' : 'bg-muted border border-border'}`}>
        {isUser
          ? <User className="w-3.5 h-3.5 text-primary-foreground" />
          : <Bot className="w-3.5 h-3.5 text-muted-foreground" />}
      </div>
      <div className={`max-w-[78%] flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed
          ${isUser
            ? 'bg-primary text-primary-foreground rounded-tr-sm'
            : msg.error
              ? 'bg-red-50 border border-red-200 text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-400 rounded-tl-sm'
              : 'bg-muted border border-border text-foreground rounded-tl-sm'}`}>
          <div className="space-y-0.5">
            {renderContent(msg.content)}
          </div>
        </div>
        <span className="text-[10px] text-muted-foreground px-1">
          {formatTime(msg.timestamp)}
        </span>
      </div>
    </div>
  );
};

// ─── Typing indicator ─────────────────────────────────────────────────────────

const TypingIndicator: React.FC = () => (
  <div className="flex gap-2.5">
    <div className="w-7 h-7 rounded-full bg-muted border border-border flex items-center justify-center shrink-0">
      <Bot className="w-3.5 h-3.5 text-muted-foreground" />
    </div>
    <div className="bg-muted border border-border rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1.5">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  </div>
);

// ─── Main Widget ──────────────────────────────────────────────────────────────

const ChatbotWidget: React.FC = () => {
  const { currentUser } = useAuth();
  const userRole = currentUser?.role_nom ?? '';
  const [open, setOpen]         = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [unread, setUnread]     = useState(0);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── Scroll ────────────────────────────────────────────────────────────────

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  useEffect(() => {
    if (open) {
      scrollToBottom(false);
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open, scrollToBottom]);

  useEffect(() => {
    if (open) scrollToBottom();
  }, [messages, loading, open, scrollToBottom]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 80);
  };

  // ── Welcome message ───────────────────────────────────────────────────────

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{
        id:        uid(),
        role:      'assistant',
        content:   'Bonjour ! 👋 Je suis votre assistant pour cette plateforme de gestion de stock.\n\nComment puis-je vous aider aujourd\'hui ?',
        timestamp: new Date(),
      }]);
    }
  }, []);

  // ── Send message ──────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    const userMsg: Message = {
      id: uid(), role: 'user', content: trimmed, timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    if (!open) setUnread(n => n + 1);

    // Build history — only clean user/assistant text messages
    // (no error messages, no tool messages — backend handles those internally)
    const history = messages
      .filter(m => !m.error && typeof m.content === 'string' && m.content.trim() !== '')
      .slice(-10)
      .map(m => ({ role: m.role, content: m.content }));

    try {
      const res = await api.post('/chatbot/message', {
        message: trimmed,
        history,
      });

      setMessages(prev => [...prev, {
        id:        uid(),
        role:      'assistant',
        content:   res.data.reply,
        timestamp: new Date(),
      }]);

      if (!open) setUnread(n => n + 1);

    } catch (err: any) {
      setMessages(prev => [...prev, {
        id:        uid(),
        role:      'assistant',
        content:   err.response?.data?.message ?? 'Une erreur est survenue. Veuillez réessayer.',
        timestamp: new Date(),
        error:     true,
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [loading, messages, open]);

  // ── Keyboard handler ──────────────────────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // ── Reset ─────────────────────────────────────────────────────────────────

  const resetConversation = () => {
    setMessages([{
      id:        uid(),
      role:      'assistant',
      content:   'Conversation réinitialisée. Comment puis-je vous aider ?',
      timestamp: new Date(),
    }]);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Chat panel ── */}
      <div
        className={`
          fixed bottom-24 right-6 z-50
          w-[380px] max-w-[calc(100vw-2rem)]
          bg-card border border-border rounded-2xl shadow-2xl
          flex flex-col overflow-hidden
          transition-all duration-300 ease-out
          ${open
            ? 'opacity-100 translate-y-0 pointer-events-auto'
            : 'opacity-0 translate-y-4 pointer-events-none'}
        `}
        style={{ height: '520px' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border bg-card shrink-0">
          <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
            <Bot className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">Assistant</p>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <p className="text-xs text-muted-foreground">En ligne</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={resetConversation}
              title="Réinitialiser la conversation"
              className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setOpen(false)}
              className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center transition-colors text-muted-foreground hover:text-foreground"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scroll-smooth"
        >
          {messages.map(msg => (
            <MessageBubble key={msg.id} msg={msg} />
          ))}

          {loading && <TypingIndicator />}

          {/* FAQ suggestions — only on fresh conversation */}
          {messages.length === 1 && !loading && (
            <div className="space-y-2 pt-1">
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-1">
                Questions fréquentes
              </p>
              {getSuggestions(userRole).map((s, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(s)}
                  className="w-full text-left text-xs px-3 py-2 rounded-xl border border-border hover:border-primary/40 hover:bg-primary/5 text-foreground transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Scroll-to-bottom button */}
        {showScrollBtn && (
          <button
            onClick={() => scrollToBottom()}
            className="absolute bottom-20 right-4 w-8 h-8 rounded-full bg-card border border-border shadow-md flex items-center justify-center hover:bg-muted transition-colors z-10"
          >
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </button>
        )}

        {/* Input */}
        <div className="px-4 py-3 border-t border-border bg-card shrink-0">
          <div className="flex items-end gap-2 bg-muted rounded-xl px-3 py-2 border border-transparent focus-within:border-primary focus-within:bg-card transition-colors">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Posez votre question…"
              rows={1}
              disabled={loading}
              className="flex-1 text-sm bg-transparent resize-none outline-none text-foreground placeholder:text-muted-foreground max-h-28 leading-relaxed disabled:opacity-50"
              style={{ minHeight: '24px' }}
              onInput={e => {
                const t = e.currentTarget;
                t.style.height = 'auto';
                t.style.height = Math.min(t.scrollHeight, 112) + 'px';
              }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
              className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 hover:bg-primary-hover transition-colors shrink-0 mb-0.5"
            >
              {loading
                ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                : <Send className="w-3.5 h-3.5" />}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-1.5">
            Entrée pour envoyer · Maj+Entrée pour nouvelle ligne
          </p>
        </div>
      </div>

      {/* ── Floating bubble ── */}
      <button
        onClick={() => { setOpen(v => !v); setUnread(0); }}
        className={`
          fixed bottom-6 right-6 z-50
          w-14 h-14 rounded-full shadow-xl
          flex items-center justify-center
          transition-all duration-300
          ${open
            ? 'bg-muted border border-border text-foreground'
            : 'bg-primary text-primary-foreground hover:scale-110'}
        `}
      >
        {open
          ? <X className="w-5 h-5" />
          : <MessageCircle className="w-6 h-6" />}

        {/* Unread badge */}
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    </>
  );
};

export default ChatbotWidget;