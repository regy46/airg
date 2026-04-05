/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, Sparkles, Trash2, Copy, Check, Mic, MicOff, Volume2, GraduationCap, Pause, Play, Square } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from '@google/genai';

// Initialize Gemini with support for both AI Studio and Vercel/Vite environments
const getApiKey = () => {
  // In Vite/Vercel, we use import.meta.env.VITE_
  const viteKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
  // In AI Studio preview, we use process.env
  let processKey = undefined;
  try {
    processKey = (window as any).process?.env?.GEMINI_API_KEY || (process as any)?.env?.GEMINI_API_KEY;
  } catch (e) {
    // process is not defined in some browser environments
  }
  
  return viteKey || processKey || '';
};

interface Message {
  role: 'user' | 'model';
  content: string;
  timestamp: Date;
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [isListening, setIsListening] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'id-ID';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        handleSend(transcript, true);
        setIsListening(false);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
  }, []);

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    const handleVoicesChanged = () => {
      window.speechSynthesis.getVoices();
    };
    window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      recognitionRef.current?.start();
      setIsListening(true);
    }
  };

  const speakText = (text: string) => {
    // 1. Bersihkan teks dari simbol Markdown (*, #, _, etc.) agar tidak dibaca kaku
    const cleanText = text
      .replace(/[*#_~`>]/g, '') // Hapus simbol Markdown
      .replace(/\[.*?\]\(.*?\)/g, '') // Hapus link Markdown
      .replace(/\s+/g, ' ') // Rapikan spasi
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // 2. Deteksi Bahasa (Sederhana)
    // Cek apakah teks mengandung kata-kata umum bahasa Inggris
    const englishWords = /\b(the|and|is|in|it|you|that|was|for|on|are|with|as|at|be|this|have|from|or|one|had|by|word|but|not|what|all|were|we|when|your|can|said|there|use|an|each|which|she|do|how|their|if|will|up|other|about|out|many|then|them|these|so|some|her|would|make|like|him|into|time|has|look|two|more|write|go|see|number|no|way|could|people|my|than|first|water|been|called|who|oil|its|now|find|long|down|day|did|get|come|made|may|part)\b/gi;
    const englishMatches = cleanText.match(englishWords);
    
    // Jika lebih dari 15% kata adalah kata Inggris umum, anggap bahasa Inggris
    const wordCount = cleanText.split(/\s+/).length;
    const isEnglish = englishMatches && (englishMatches.length / wordCount > 0.15 || englishMatches.length > 5);

    const voices = window.speechSynthesis.getVoices();
    let selectedVoice = null;

    if (isEnglish) {
      utterance.lang = 'en-US';
      const enVoices = voices.filter(v => v.lang.startsWith('en'));
      // Prioritaskan suara laki-laki
      selectedVoice = enVoices.find(v => 
        (v.name.toLowerCase().includes('male') || v.name.toLowerCase().includes('david') || v.name.toLowerCase().includes('google') || v.name.toLowerCase().includes('microsoft')) &&
        !v.name.toLowerCase().includes('female') && !v.name.toLowerCase().includes('zira')
      ) || enVoices[0];
    } else {
      utterance.lang = 'id-ID';
      const idVoices = voices.filter(v => v.lang.startsWith('id'));
      selectedVoice = idVoices.find(v => 
        v.name.toLowerCase().includes('male') || 
        v.name.toLowerCase().includes('david') || 
        v.name.toLowerCase().includes('google') || 
        v.name.toLowerCase().includes('microsoft')
      ) || idVoices[0];
    }
    
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }
    
    // 3. Atur agar tidak kaku (robotik)
    utterance.pitch = 0.85; // Lebih rendah lagi biar kerasa cowok
    utterance.rate = 1.0;  // Kecepatan normal
    utterance.volume = 1.0;

    utterance.onstart = () => {
      setIsSpeaking(true);
      setIsPaused(false);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };

    // Hentikan suara sebelumnya jika ada yang sedang bicara
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const togglePause = () => {
    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    } else {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
  };

  const abortControllerRef = useRef<AbortController | null>(null);

  const handleSend = async (textOverride?: string, isVoice: boolean = false) => {
    const messageText = textOverride || input;
    if (!messageText.trim() || isLoading) return;

    // Stop speaking if AI is currently talking
    stopSpeaking();

    // Cancel previous request if any
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    const currentAbortController = abortControllerRef.current;

    const userMessage: Message = {
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      const apiKey = getApiKey();
      if (!apiKey || apiKey === 'undefined' || apiKey === '') {
        throw new Error('API Key Gemini belum diset. Kalo lo di Vercel, tambahin VITE_GEMINI_API_KEY di Environment Variables.');
      }

      const ai = new GoogleGenAI({ apiKey });
      const history = messages.map(msg => ({
        role: msg.role,
        parts: [{ text: msg.content }]
      }));

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: [...history, { role: 'user', parts: [{ text: messageText }] }],
        config: {
          systemInstruction: `Anda adalah AI R.G, asisten pendidikan super cerdas yang dirancang khusus untuk membantu murid-murid di kelas. 
          Karakter Anda:
          1. Sangat cerdas, berwawasan luas, namun ramah dan sabar.
          2. Mampu menjelaskan konsep rumit (Sains, Matematika, Sejarah, dll.) dengan bahasa yang mudah dimengerti siswa.
          3. Gunakan gaya bahasa "Bahasa Gaul Jakarta" yang sopan namun asik (seperti menggunakan kata "gue", "lo", "banget", "nih", "deh", "kok", dll.) agar terasa seperti teman belajar yang keren.
          4. Selalu mendorong siswa untuk berpikir kritis, bukan sekadar memberi jawaban langsung.
          5. Sangat ahli dalam Bahasa Indonesia dan memahami konteks budaya lokal.
          6. Jika ada typo, Anda tetap mengerti maksud siswa dan memperbaikinya secara halus dalam penjelasan Anda.
          7. Gunakan analogi yang menarik untuk menjelaskan materi pelajaran.`,
        }
      });

      if (currentAbortController.signal.aborted) return;

      const aiContent = response.text || 'Maaf, AI R.G tidak mendapatkan respon.';
      const aiMessage: Message = {
        role: 'model',
        content: aiContent,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, aiMessage]);

      // Auto-speak if it was a voice input
      if (isVoice) {
        speakText(aiContent);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('Gemini Error:', err);
      // Detailed error message for debugging
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(`Koneksi Gagal: ${errorMsg}. Coba refresh halaman atau cek API Key.`);
    } finally {
      if (!currentAbortController.signal.aborted) {
        setIsLoading(false);
      }
    }
  };

  const copyToClipboard = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const clearChat = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setMessages([]);
    setError(null);
    setIsLoading(false);
    stopSpeaking();
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-xl shadow-indigo-200 dark:shadow-none shadow-lg">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tighter text-slate-800 dark:text-white uppercase">AI R.G</h1>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">Asisten Kelas Aktif</span>
            </div>
          </div>
        </div>
        <button 
          onClick={clearChat}
          className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
          title="Hapus Percakapan"
        >
          <Trash2 className="w-5 h-5" />
        </button>
      </header>

      {/* Chat Area */}
      <main className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scroll-smooth">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-8 max-w-md mx-auto">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="p-8 bg-indigo-50 dark:bg-indigo-900/20 rounded-[2.5rem] relative"
            >
              <Bot className="w-20 h-20 text-indigo-600 dark:text-indigo-400" />
              <div className="absolute -top-2 -right-2 bg-indigo-600 text-white p-2 rounded-full shadow-lg">
                <Sparkles className="w-4 h-4" />
              </div>
            </motion.div>
            <div className="space-y-3">
              <h2 className="text-3xl font-black text-slate-800 dark:text-white tracking-tight">Halo, Pelajar!</h2>
              <p className="text-slate-500 dark:text-slate-400 font-medium">
                Saya <span className="text-indigo-600 dark:text-indigo-400 font-bold">AI R.G</span>. Siap membantu belajarmu hari ini. Mau tanya PR apa?
              </p>
            </div>
            <div className="grid grid-cols-1 gap-3 w-full">
              {['Jelaskan teori gravitasi', 'Bantu PR Matematika', 'Cara buat esai yang bagus'].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => { setInput(suggestion); }}
                  className="p-4 text-sm font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl hover:border-indigo-300 dark:hover:border-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all text-left shadow-sm"
                >
                  "{suggestion}"
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex gap-3 max-w-[92%] md:max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`flex-shrink-0 w-9 h-9 rounded-2xl flex items-center justify-center shadow-md ${
                  msg.role === 'user' ? 'bg-indigo-600' : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700'
                }`}>
                  {msg.role === 'user' ? <User className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />}
                </div>
                <div className="group relative">
                  <div className={`p-5 rounded-3xl shadow-sm ${
                    msg.role === 'user' 
                      ? 'bg-indigo-600 text-white rounded-tr-none' 
                      : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-100 dark:border-slate-700 rounded-tl-none'
                  }`}>
                    <p className="whitespace-pre-wrap leading-relaxed text-sm md:text-base font-medium">{msg.content}</p>
                    <div className={`flex items-center gap-3 mt-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <span className={`text-[10px] font-bold uppercase tracking-tighter opacity-60 ${msg.role === 'user' ? 'text-indigo-100' : 'text-slate-400 dark:text-slate-500'}`}>
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                  
                  {msg.role === 'model' && (
                    <div className="absolute -right-12 top-0 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-all">
                      <button
                        onClick={() => copyToClipboard(msg.content, idx)}
                        className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700"
                        title="Salin"
                      >
                        {copiedId === idx ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => speakText(msg.content)}
                        className="p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700"
                        title="Dengarkan"
                      >
                        <Volume2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="flex gap-4 items-center bg-white dark:bg-slate-800 p-5 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm">
              <div className="flex space-x-1.5">
                <div className="w-2.5 h-2.5 bg-indigo-600 dark:bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                <div className="w-2.5 h-2.5 bg-indigo-600 dark:bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                <div className="w-2.5 h-2.5 bg-indigo-600 dark:bg-indigo-400 rounded-full animate-bounce" />
              </div>
              <span className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">AI R.G sedang menganalisis...</span>
            </div>
          </motion.div>
        )}

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 text-red-600 dark:text-red-400 rounded-2xl text-sm text-center font-bold">
            {error}
          </div>
        )}
        <div ref={messagesEndRef} />
      </main>

      {/* Voice Controls Floating Bar */}
      <AnimatePresence>
        {isSpeaking && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 p-2 bg-indigo-600 rounded-2xl shadow-2xl border border-indigo-500"
          >
            <div className="flex items-center gap-3 px-3">
              <div className="flex gap-1">
                <div className="w-1 h-4 bg-white/40 rounded-full animate-bounce" />
                <div className="w-1 h-6 bg-white rounded-full animate-bounce [animation-delay:0.1s]" />
                <div className="w-1 h-3 bg-white/60 rounded-full animate-bounce [animation-delay:0.2s]" />
              </div>
              <span className="text-xs font-black text-white uppercase tracking-widest">AI R.G Sedang Bicara</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={togglePause}
                className="p-2 bg-white/20 hover:bg-white/30 text-white rounded-xl transition-all"
                title={isPaused ? "Lanjutkan" : "Jeda"}
              >
                {isPaused ? <Play className="w-4 h-4 fill-current" /> : <Pause className="w-4 h-4 fill-current" />}
              </button>
              <button
                onClick={stopSpeaking}
                className="p-2 bg-white/20 hover:bg-white/30 text-white rounded-xl transition-all"
                title="Berhenti"
              >
                <Square className="w-4 h-4 fill-current" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Area */}
      <footer className="p-4 md:p-6 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
        <div className="max-w-4xl mx-auto flex gap-3 items-end">
          <button
            onClick={toggleListening}
            className={`p-4 rounded-2xl transition-all shadow-md ${
              isListening 
                ? 'bg-red-500 text-white animate-pulse' 
                : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600'
            }`}
            title={isListening ? "Berhenti Mendengarkan" : "Gunakan Suara"}
          >
            {isListening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
          </button>
          
          <div className="flex-1 relative">
            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Tanyakan PR atau materi pelajaran..."
              className="w-full p-4 pr-14 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 dark:focus:border-indigo-400 transition-all resize-none max-h-32 shadow-inner font-medium text-slate-800 dark:text-slate-100"
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
              className={`absolute right-2 bottom-2 p-2.5 rounded-xl transition-all ${
                !input.trim() || isLoading 
                  ? 'text-slate-300 dark:text-slate-600 bg-slate-100 dark:bg-slate-700' 
                  : 'text-white bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-100 dark:shadow-none active:scale-95'
              }`}
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
        <p className="text-[10px] text-center text-slate-400 dark:text-slate-500 mt-3 font-bold uppercase tracking-widest">
          AI R.G • Sahabat Belajar Siswa Masa Depan
        </p>
      </footer>
    </div>
  );
}
