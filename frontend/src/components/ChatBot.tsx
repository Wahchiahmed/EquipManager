import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { mockDemandes, mockProduits } from '@/data/mockData';
import { useAuth } from '@/context/AuthContext';

interface Message {
  id: number;
  role: 'user' | 'bot';
  text: string;
  timestamp: string;
}

const getBotResponse = (input: string, userId?: number): string => {
  const lower = input.toLowerCase();

  if (lower.includes('statut') || lower.includes('demande') || lower.includes('status')) {
    if (userId) {
      const myRequests = mockDemandes.filter(d => d.id_demandeur === userId);
      if (myRequests.length === 0) return "Vous n'avez aucune demande en cours.";
      const latest = myRequests[0];
      const statusLabels: Record<string, string> = {
        EN_ATTENTE_DEPT: '🟡 En attente de validation par le département',
        EN_ATTENTE_STOCK: '🟣 En attente de validation par le stock',
        VALIDEE: '✅ Validée',
        LIVREE: '📦 Livrée',
        REFUSEE_DEPT: '❌ Refusée par le département',
        REFUSEE_STOCK: '❌ Refusée par le stock',
      };
      return `Votre dernière demande (#${latest.id_demande}) est actuellement : ${statusLabels[latest.statut] || latest.statut}`;
    }
    return "Je n'ai pas pu identifier votre compte pour récupérer vos demandes.";
  }

  if (lower.includes('laptop') || lower.includes('ordinateur') || lower.includes('dell') || lower.includes('pc')) {
    const laptop = mockProduits.find(p => p.nom_produit.toLowerCase().includes('laptop'));
    return laptop ? `💻 Il y a actuellement **${laptop.quantite} unités** de "${laptop.nom_produit}" en stock. Référence: ${laptop.reference}` : "Aucun laptop trouvé dans le catalogue.";
  }

  if (lower.includes('stock') || lower.includes('quantité') || lower.includes('inventaire')) {
    const alerts = mockProduits.filter(p => p.quantite <= p.seuil_alerte);
    const total = mockProduits.reduce((s, p) => s + p.quantite, 0);
    return `📊 Stock total: **${total} unités** sur ${mockProduits.length} produits. ${alerts.length > 0 ? `⚠️ ${alerts.length} produit(s) en alerte: ${alerts.map(p => p.nom_produit).join(', ')}` : '✅ Aucune alerte de stock.'}`;
  }

  if (lower.includes('produit') || lower.includes('catalogue') || lower.includes('article')) {
    return `📦 Le catalogue contient **${mockProduits.length} produits** répartis en 4 catégories. Souhaitez-vous des informations sur un produit spécifique?`;
  }

  if (lower.includes('aide') || lower.includes('help') || lower.includes('comment')) {
    return `🤖 Je peux vous aider avec:\n• "Statut de ma demande"\n• "Combien de laptops en stock ?"\n• "Inventaire total"\n• "Produits en alerte"\n\nQuelle information souhaitez-vous?`;
  }

  if (lower.includes('bonjour') || lower.includes('salut') || lower.includes('hello')) {
    return "👋 Bonjour! Je suis l'assistant EquipManager. Comment puis-je vous aider? Demandez-moi le statut de vos demandes, les niveaux de stock, etc.";
  }

  return "Je n'ai pas compris votre question. Essayez: \"statut de ma demande\", \"stock des laptops\", ou tapez \"aide\" pour voir ce que je peux faire.";
};

const ChatBot: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, role: 'bot', text: '👋 Bonjour! Je suis l\'assistant EquipManager. Comment puis-je vous aider?', timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const { currentUser } = useAuth();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    const userMsg: Message = {
      id: messages.length + 1,
      role: 'user',
      text: input.trim(),
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    };
    setMessages(prev => [...prev, userMsg]);
    const userInput = input.trim();
    setInput('');
    setTyping(true);

    await new Promise(r => setTimeout(r, 800 + Math.random() * 600));

    const botMsg: Message = {
      id: messages.length + 2,
      role: 'bot',
      text: getBotResponse(userInput, currentUser?.id_utilisateur),
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    };
    setTyping(false);
    setMessages(prev => [...prev, botMsg]);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const quickReplies = ['Statut de ma demande', 'Stock des laptops', 'Inventaire total'];

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'fixed bottom-6 right-6 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-brand flex items-center justify-center hover:scale-110 transition-all z-50',
          open && 'rotate-90'
        )}
      >
        {open ? <X className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
        {!open && messages.filter(m => m.role === 'bot').length > 1 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-status-rejected text-white text-[10px] font-bold rounded-full flex items-center justify-center" />
        )}
      </button>

      {/* Chat window */}
      {open && (
        <div className="fixed bottom-24 right-6 w-80 bg-card rounded-2xl shadow-lg border border-border z-50 overflow-hidden animate-bounce-in flex flex-col" style={{ height: '460px' }}>
          {/* Header */}
          <div className="bg-primary px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary-foreground/20 flex items-center justify-center">
              <Bot className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <p className="text-primary-foreground font-semibold text-sm">Assistant EquipManager</p>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse-dot" />
                <span className="text-primary-foreground/70 text-xs">En ligne</span>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-3">
            {messages.map(m => (
              <div key={m.id} className={cn('flex gap-2', m.role === 'user' && 'flex-row-reverse')}>
                <div className={cn('w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-1', m.role === 'bot' ? 'bg-primary/10' : 'bg-secondary')}>
                  {m.role === 'bot' ? <Bot className="w-3.5 h-3.5 text-primary" /> : <User className="w-3.5 h-3.5 text-muted-foreground" />}
                </div>
                <div className={cn('max-w-[75%] rounded-2xl px-3 py-2 text-xs leading-relaxed', m.role === 'bot' ? 'bg-muted text-foreground rounded-tl-none' : 'bg-primary text-primary-foreground rounded-tr-none')}>
                  <p className="whitespace-pre-line">{m.text}</p>
                  <p className={cn('text-[10px] mt-1 opacity-60', m.role === 'bot' ? 'text-muted-foreground' : 'text-primary-foreground')}>{m.timestamp}</p>
                </div>
              </div>
            ))}
            {typing && (
              <div className="flex gap-2">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                  <Bot className="w-3.5 h-3.5 text-primary" />
                </div>
                <div className="bg-muted rounded-2xl rounded-tl-none px-4 py-3 flex gap-1 items-center">
                  {[0, 1, 2].map(i => (
                    <span key={i} className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-pulse-dot" style={{ animationDelay: `${i * 0.2}s` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Quick replies */}
          {messages.length <= 2 && (
            <div className="px-3 pb-2 flex flex-wrap gap-1.5">
              {quickReplies.map(q => (
                <button
                  key={q}
                  onClick={() => { setInput(q); }}
                  className="text-[11px] px-2.5 py-1.5 bg-primary/10 text-primary rounded-full hover:bg-primary/20 transition-colors font-medium"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="px-3 py-3 border-t border-border flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Posez votre question..."
              className="flex-1 text-xs px-3 py-2 bg-muted rounded-lg border border-transparent focus:border-primary focus:ring-2 focus:ring-primary/20 focus:outline-none"
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary-hover transition-colors disabled:opacity-50 shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatBot;
