import { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Plus, Trash2, ChevronDown, Bot, User as UserIcon } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  role: 'user' | 'bot';
  text: string;
  time: string;
}

interface QAEntry {
  id: string;
  question: string;
  answer: string;
}

// ── Built-in FAQ knowledge base ───────────────────────────────────────────────
const BUILTIN_FAQ: QAEntry[] = [
  {
    id: 'b1',
    question: 'how to create a ta da bill',
    answer: 'To create a TA/DA bill, go to "Create TA/DA Bill" from the sidebar. You will go through 9 steps: Profile, Assignment Details, Leave Dates, DA Eligibility, Accommodation, Flight/Train, Travel Bills, Hotel Bills, and Advance Taken. Fill each step and submit.',
  },
  {
    id: 'b2',
    question: 'what is da eligibility',
    answer: 'DA (Daily Allowance) eligibility is calculated in Step 4 based on your assignment dates, leave dates, and batch type (FMAT/ILT). ILO/Online batches are not eligible for DA. The system auto-calculates day-wise DA amounts.',
  },
  {
    id: 'b3',
    question: 'how to add travel bills',
    answer: 'In Step 7 (Travel Bills), click "Add Journey". Select the Journey Type (e.g., Home→Venue, Venue→Airport) and the From/To locations are auto-filled based on your assignment and accommodation data. Enter the amount and attach receipts.',
  },
  {
    id: 'b4',
    question: 'what is advance taken',
    answer: 'Step 9 shows advances already paid to you by Koenig for the selected date range. These are fetched from PMS and shown automatically. The total advance is deducted from your final claim amount.',
  },
  {
    id: 'b5',
    question: 'how to mark leave dates',
    answer: 'In Step 3, leave dates are auto-fetched from Koenig PMS and shown in orange on the calendar. Cancelled/rejected leaves appear in grey. You can also manually toggle dates by clicking on calendar cells.',
  },
  {
    id: 'b6',
    question: 'what batch types are supported',
    answer: 'The portal supports FMAT (Offline) and ILT (Offline) batches. ILO (Online) batches are hidden from assignment details and DA eligibility as they are not eligible for TA/DA claims.',
  },
  {
    id: 'b7',
    question: 'how to add accommodation',
    answer: 'Step 5 (Accommodation/Lodging) lets you add hotel stay details. Enter check-in/check-out dates, hotel name, city, and amount. This data is used to auto-fill hotel address in Step 7 travel bills.',
  },
  {
    id: 'b8',
    question: 'how to submit the bill',
    answer: 'After completing all 9 steps, click "Submit Bill" on the final step. The bill is submitted for HR/Finance review. You can track its status under "My Bills" in the sidebar.',
  },
  {
    id: 'b9',
    question: 'what is my bills',
    answer: '"My Bills" in the sidebar shows all your submitted TA/DA claims with their current status: Draft, Submitted, Under Review, Approved, or Paid. You can click any bill to view details.',
  },
  {
    id: 'b10',
    question: 'how to view profile',
    answer: 'Click "My Profile" in the sidebar to view your Koenig profile fetched from PMS. It shows your employee code, department, designation, home city, and contact details.',
  },
  {
    id: 'b11',
    question: 'what is flight train step',
    answer: 'Step 6 (Flight/Train) lets you add air or rail travel details fetched from PMS. It shows your booked flights/trains for the assignment period. You can add additional journeys manually.',
  },
  {
    id: 'b12',
    question: 'how does journey auto fill work',
    answer: 'When you select a Journey Type in Step 7, the From and To locations are automatically filled: Home city comes from your Profile, Venue from Assignment details, Accommodation from Step 5, and Airport from Step 6 flight data.',
  },
  {
    id: 'b13',
    question: 'what is hotel bills step',
    answer: 'Step 8 (Hotel Bills) is for uploading hotel invoices and entering hotel bill amounts. This is separate from the accommodation stay dates in Step 5.',
  },
  {
    id: 'b14',
    question: 'how to logout',
    answer: 'Click the "Logout" button in the top-right corner of the header to log out of the portal.',
  },
];

// ── localStorage helpers ───────────────────────────────────────────────────────
const LS_KEY = 'chatbot_custom_qa';

function loadCustomQA(): QAEntry[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveCustomQA(entries: QAEntry[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(entries));
}

// ── Keyword matcher ───────────────────────────────────────────────────────────
function findAnswer(query: string, customQA: QAEntry[]): string {
  const q = query.toLowerCase().trim();
  const allEntries = [...customQA, ...BUILTIN_FAQ];

  // Exact or contains match on question
  for (const entry of allEntries) {
    if (entry.question.toLowerCase().includes(q) || q.includes(entry.question.toLowerCase())) {
      return entry.answer;
    }
  }

  // Keyword scoring
  const queryWords = q.split(/\s+/).filter(w => w.length > 2);
  let bestScore = 0;
  let bestAnswer = '';

  for (const entry of allEntries) {
    const entryWords = entry.question.toLowerCase().split(/\s+/);
    const score = queryWords.filter(w => entryWords.some(ew => ew.includes(w) || w.includes(ew))).length;
    if (score > bestScore) {
      bestScore = score;
      bestAnswer = entry.answer;
    }
  }

  if (bestScore >= 1) return bestAnswer;

  return "I'm sorry, I don't have information on that yet. You can add it using the \"Feed Data\" tab above, or ask your HR team for assistance.";
}

// ── Time formatter ─────────────────────────────────────────────────────────────
function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ── Main ChatBot component ─────────────────────────────────────────────────────
export default function ChatBot() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'chat' | 'feed'>('chat');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'bot',
      text: 'Hi! I\'m your TA/DA assistant. Ask me anything about creating bills, DA eligibility, travel steps, and more.',
      time: nowTime(),
    },
  ]);
  const [input, setInput] = useState('');
  const [customQA, setCustomQA] = useState<QAEntry[]>(loadCustomQA);
  const [newQ, setNewQ] = useState('');
  const [newA, setNewA] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: text.trim(), time: nowTime() };
    const botAnswer = findAnswer(text, customQA);
    const botMsg: Message = { id: Date.now().toString() + '_b', role: 'bot', text: botAnswer, time: nowTime() };
    setMessages(prev => [...prev, userMsg, botMsg]);
    setInput('');
    setShowSuggestions(false);
  };

  const addCustomQA = () => {
    if (!newQ.trim() || !newA.trim()) return;
    const entry: QAEntry = { id: Date.now().toString(), question: newQ.trim(), answer: newA.trim() };
    const updated = [entry, ...customQA];
    setCustomQA(updated);
    saveCustomQA(updated);
    setNewQ('');
    setNewA('');
  };

  const deleteCustomQA = (id: string) => {
    const updated = customQA.filter(e => e.id !== id);
    setCustomQA(updated);
    saveCustomQA(updated);
  };

  const suggestions = [
    'How to create a TA/DA bill?',
    'What is DA eligibility?',
    'How to add travel bills?',
    'What batch types are supported?',
    'How to mark leave dates?',
  ];

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
        style={{ background: 'linear-gradient(135deg, #1f7cc9, #0f5a9a)' }}
        aria-label="Open chat assistant"
      >
        {open ? <X size={22} color="white" /> : <MessageCircle size={22} color="white" />}
        {!open && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-green-500 border-2 border-white" />
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-24 right-6 z-50 flex flex-col rounded-2xl shadow-2xl overflow-hidden"
          style={{ width: 360, height: 520, background: '#ffffff', border: '1px solid #e2e8f0' }}
        >
          {/* Header */}
          <div
            className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #1f7cc9, #0f5a9a)' }}
          >
            <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
              <Bot size={18} color="white" />
            </div>
            <div className="flex-1">
              <div className="text-white font-semibold text-sm">TA/DA Assistant</div>
              <div className="text-blue-200 text-xs flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
                Online
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white transition-colors">
              <ChevronDown size={20} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-100 flex-shrink-0">
            {(['chat', 'feed'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                  tab === t ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-400 hover:text-gray-600'
                }`}
              >
                {t === 'chat' ? '💬 Chat' : '📥 Feed Data'}
              </button>
            ))}
          </div>

          {/* Chat tab */}
          {tab === 'chat' && (
            <>
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3" style={{ background: '#f8fafc' }}>
                {messages.map(msg => (
                  <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div
                      className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5"
                      style={{ background: msg.role === 'bot' ? '#1f7cc9' : '#e2e8f0' }}
                    >
                      {msg.role === 'bot'
                        ? <Bot size={12} color="white" />
                        : <UserIcon size={12} color="#64748b" />
                      }
                    </div>
                    <div className={`max-w-[80%] ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                      <div
                        className="px-3 py-2 rounded-2xl text-xs leading-relaxed"
                        style={
                          msg.role === 'bot'
                            ? { background: '#ffffff', border: '1px solid #e2e8f0', color: '#1e293b', borderRadius: '4px 14px 14px 14px' }
                            : { background: '#1f7cc9', color: '#ffffff', borderRadius: '14px 4px 14px 14px' }
                        }
                      >
                        {msg.text}
                      </div>
                      <span className="text-[10px] text-gray-400 px-1">{msg.time}</span>
                    </div>
                  </div>
                ))}

                {/* Quick suggestions */}
                {showSuggestions && messages.length === 1 && (
                  <div className="pt-1">
                    <p className="text-[10px] text-gray-400 mb-2">Suggested questions:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {suggestions.map(s => (
                        <button
                          key={s}
                          onClick={() => sendMessage(s)}
                          className="px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700"
                          style={{ borderColor: '#d1d5db', color: '#374151', background: '#ffffff' }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div ref={bottomRef} />
              </div>

              {/* Input */}
              <div className="flex items-center gap-2 px-3 py-3 border-t border-gray-100 flex-shrink-0" style={{ background: '#ffffff' }}>
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
                  placeholder="Ask a question..."
                  className="flex-1 px-3 py-2 rounded-full text-xs border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 bg-gray-50"
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim()}
                  className="w-8 h-8 rounded-full flex items-center justify-center transition-all hover:scale-105 disabled:opacity-40"
                  style={{ background: '#1f7cc9' }}
                >
                  <Send size={14} color="white" />
                </button>
              </div>
            </>
          )}

          {/* Feed Data tab */}
          {tab === 'feed' && (
            <div className="flex-1 overflow-y-auto flex flex-col" style={{ background: '#f8fafc' }}>
              {/* Add new Q&A */}
              <div className="px-4 py-3 border-b border-gray-100" style={{ background: '#ffffff' }}>
                <p className="text-xs font-semibold text-gray-600 mb-2">Add Custom Q&A</p>
                <input
                  type="text"
                  value={newQ}
                  onChange={e => setNewQ(e.target.value)}
                  placeholder="Question (keyword-based matching)"
                  className="w-full px-3 py-2 mb-2 rounded-lg text-xs border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-gray-50"
                />
                <textarea
                  value={newA}
                  onChange={e => setNewA(e.target.value)}
                  placeholder="Answer"
                  rows={3}
                  className="w-full px-3 py-2 mb-2 rounded-lg text-xs border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-300 bg-gray-50 resize-none"
                />
                <button
                  onClick={addCustomQA}
                  disabled={!newQ.trim() || !newA.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-40 transition-all hover:opacity-90"
                  style={{ background: '#1f7cc9' }}
                >
                  <Plus size={13} /> Add Entry
                </button>
              </div>

              {/* Custom entries */}
              <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
                {customQA.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">No custom entries yet. Add one above.</p>
                ) : (
                  customQA.map(entry => (
                    <div key={entry.id} className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-xs font-semibold text-blue-700 flex-1">{entry.question}</p>
                        <button
                          onClick={() => deleteCustomQA(entry.id)}
                          className="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed">{entry.answer}</p>
                    </div>
                  ))
                )}

                {/* Built-in entries (read-only) */}
                <div className="pt-2">
                  <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide mb-2">Built-in Knowledge ({BUILTIN_FAQ.length})</p>
                  {BUILTIN_FAQ.map(entry => (
                    <div key={entry.id} className="bg-blue-50 rounded-xl p-3 border border-blue-100 mb-2 opacity-70">
                      <p className="text-xs font-semibold text-blue-700">{entry.question}</p>
                      <p className="text-xs text-gray-500 mt-1 leading-relaxed line-clamp-2">{entry.answer}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
