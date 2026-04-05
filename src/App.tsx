/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect, ChangeEvent } from 'react';
import { Send, Bot, User, Loader2, Sparkles, Trash2, Copy, Check, Mic, MicOff, Volume2, GraduationCap, Pause, Play, Square, VolumeX, Plus, X, MoreVertical, Search, MapPin, FileText, Upload, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Modality, ThinkingLevel, Type } from '@google/genai';
import * as pdfjsLib from 'pdfjs-dist';

// Initialize Gemini with support for both AI Studio and Vercel/Vite environments
const getApiKey = () => {
  // In Vite/Vercel, we use import.meta.env.VITE_
  let viteKey = undefined;
  try {
    viteKey = (import.meta as any).env?.VITE_GEMINI_API_KEY;
  } catch (e) {}

  // In AI Studio preview, we use process.env
  let processKey = undefined;
  try {
    processKey = (window as any).process?.env?.GEMINI_API_KEY || (process as any)?.env?.GEMINI_API_KEY;
  } catch (e) {}
  
  return viteKey || processKey || '';
};

interface Message {
  role: 'user' | 'model';
  content: string;
  timestamp: Date;
  image?: string;
  groundingChunks?: any[];
}

interface QuizViewProps {
  pdfContent: string | null;
  pdfFileName: string | null;
  setPdfContent: (content: string | null) => void;
  setPdfFileName: (name: string | null) => void;
  isExtractingPdf: boolean;
  handleFileUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  setError: (error: string | null) => void;
  setView: (view: 'chat' | 'quiz') => void;
}

function QuizView({ 
  pdfContent, 
  pdfFileName, 
  setPdfContent, 
  setPdfFileName, 
  isExtractingPdf, 
  handleFileUpload, 
  setError,
  setView
}: QuizViewProps) {
  const [quizTopic, setQuizTopic] = useState('');
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showCorrection, setShowCorrection] = useState(false);

  const generateQuiz = async () => {
    const topic = quizTopic.trim() || pdfContent;
    if (!topic) return;
    setIsGenerating(true);
    setQuestions([]);
    setCurrentIndex(0);
    setScore(0);
    setIsFinished(false);

    try {
      const apiKey = getApiKey();
      const ai = new GoogleGenAI({ apiKey });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: pdfContent 
          ? `Buatkan kuis pilihan ganda berdasarkan materi PDF berikut: \n\n${pdfContent}\n\nBerikan jumlah pertanyaan yang sesuai dengan kedalaman materi (antara 5 sampai 15 pertanyaan) yang menantang dan edukatif.`
          : `Buatkan kuis pilihan ganda tentang materi: ${quizTopic}. Berikan 10 pertanyaan yang menantang dan edukatif.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                options: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                correctIndex: { type: Type.INTEGER },
                explanation: { type: Type.STRING }
              },
              required: ["question", "options", "correctIndex", "explanation"]
            }
          }
        }
      });

      const data = JSON.parse(response.text || '[]');
      setQuestions(data);
      // Clear PDF after generating quiz
      setPdfContent(null);
      setPdfFileName(null);
    } catch (err) {
      console.error(err);
      setError("Gagal membuat kuis. Coba lagi ya!");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAnswer = (idx: number) => {
    if (showCorrection) return;
    setSelectedAnswer(idx);
    setShowCorrection(true);
    if (idx === questions[currentIndex].correctIndex) {
      setScore(prev => prev + 1);
    }
  };

  const nextQuestion = () => {
    setSelectedAnswer(null);
    setShowCorrection(false);
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setIsFinished(true);
    }
  };

  return (
    <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50 dark:bg-slate-950">
      <div className="max-w-2xl mx-auto">
        {!questions.length && !isGenerating && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-800 text-center space-y-6"
          >
            <div className="w-20 h-20 bg-indigo-100 dark:bg-indigo-900/30 rounded-3xl flex items-center justify-center mx-auto">
              <GraduationCap className="w-10 h-10 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-slate-800 dark:text-white">Mode Kuis AI R.G</h2>
              <p className="text-slate-500 dark:text-slate-400 font-medium">Masukkan materi pelajaran yang mau kamu uji pemahamannya.</p>
            </div>
              <div className="space-y-4">
                {pdfFileName ? (
                  <div className="p-5 bg-indigo-50 dark:bg-indigo-900/20 border-2 border-indigo-500 border-dashed rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-3 overflow-hidden">
                      <FileText className="w-6 h-6 text-indigo-600 flex-shrink-0" />
                      <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{pdfFileName}</span>
                    </div>
                    <button 
                      onClick={() => { setPdfContent(null); setPdfFileName(null); }}
                      className="p-1 hover:bg-indigo-100 dark:hover:bg-indigo-800 rounded-lg text-indigo-600"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <input 
                    type="text" 
                    value={quizTopic}
                    onChange={(e) => setQuizTopic(e.target.value)}
                    placeholder="Contoh: Fotosintesis, Sejarah Indonesia, Aljabar..."
                    className="w-full p-5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-bold text-slate-800 dark:text-white"
                  />
                )}

                <div className="flex gap-3">
                  <label className="flex-1">
                    <input 
                      type="file" 
                      accept="application/pdf" 
                      className="hidden" 
                      onChange={handleFileUpload}
                    />
                    <div className="w-full py-5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-2 border-slate-200 dark:border-slate-700 rounded-2xl font-black uppercase tracking-widest flex items-center justify-center gap-3 cursor-pointer hover:border-indigo-500 hover:text-indigo-600 transition-all">
                      <Upload className="w-5 h-5" />
                      Upload PDF
                    </div>
                  </label>
                  <button 
                    onClick={generateQuiz}
                    disabled={(!quizTopic.trim() && !pdfContent) || isExtractingPdf}
                    className="flex-[2] py-5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-indigo-200 dark:shadow-none transition-all flex items-center justify-center gap-3"
                  >
                    {isExtractingPdf ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                    Buat Kuis Sekarang
                  </button>
                </div>
              </div>
          </motion.div>
        )}

        {isGenerating && (
          <div className="flex flex-col items-center justify-center h-64 space-y-4">
            <Loader2 className="w-12 h-12 text-indigo-600 animate-spin" />
            <p className="text-slate-500 dark:text-slate-400 font-black uppercase tracking-widest text-xs">AI R.G sedang meracik kuis untukmu...</p>
          </div>
        )}

        {questions.length > 0 && !isFinished && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Pertanyaan {currentIndex + 1} dari {questions.length}</span>
              <div className="h-2 w-32 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-600 transition-all duration-500" 
                  style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
                />
              </div>
            </div>

            <motion.div 
              key={currentIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-800 space-y-8"
            >
              <h3 className="text-xl md:text-2xl font-black text-slate-800 dark:text-white leading-tight">
                {questions[currentIndex].question}
              </h3>

              <div className="grid grid-cols-1 gap-3">
                {questions[currentIndex].options.map((opt: string, i: number) => {
                  let btnClass = "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300";
                  if (showCorrection) {
                    if (i === questions[currentIndex].correctIndex) {
                      btnClass = "bg-green-50 dark:bg-green-900/20 border-green-500 text-green-700 dark:text-green-400";
                    } else if (i === selectedAnswer) {
                      btnClass = "bg-red-50 dark:bg-red-900/20 border-red-500 text-red-700 dark:text-red-400";
                    }
                  } else if (selectedAnswer === i) {
                    btnClass = "bg-indigo-50 dark:bg-indigo-900/20 border-indigo-500 text-indigo-700 dark:text-indigo-400";
                  }

                  return (
                    <button
                      key={i}
                      onClick={() => handleAnswer(i)}
                      disabled={showCorrection}
                      className={`p-5 text-left rounded-2xl border-2 font-bold transition-all flex items-center justify-between gap-4 ${btnClass}`}
                    >
                      <div className="flex items-center gap-4">
                        <span className="w-8 h-8 rounded-lg bg-white dark:bg-slate-700 flex items-center justify-center text-xs shadow-sm border border-slate-100 dark:border-slate-600">
                          {String.fromCharCode(65 + i)}
                        </span>
                        {opt}
                      </div>
                      {showCorrection && (
                        <div className="flex-shrink-0">
                          {i === questions[currentIndex].correctIndex ? (
                            <Check className="w-6 h-6 text-green-500" />
                          ) : i === selectedAnswer ? (
                            <X className="w-6 h-6 text-red-500" />
                          ) : null}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {showCorrection && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-6 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-800 space-y-2"
                >
                  <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-black text-xs uppercase tracking-widest">
                    <Bot className="w-4 h-4" />
                    Penjelasan
                  </div>
                  <p className="text-slate-700 dark:text-slate-300 text-sm leading-relaxed font-medium">
                    {questions[currentIndex].explanation}
                  </p>
                  <button 
                    onClick={nextQuestion}
                    className="mt-4 w-full py-4 bg-indigo-600 text-white rounded-xl font-black uppercase tracking-widest text-xs shadow-lg shadow-indigo-200 dark:shadow-none"
                  >
                    {currentIndex === questions.length - 1 ? 'Lihat Hasil' : 'Pertanyaan Selanjutnya'}
                  </button>
                </motion.div>
              )}
            </motion.div>
          </div>
        )}

        {isFinished && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-slate-900 p-10 rounded-[2.5rem] shadow-xl border border-slate-100 dark:border-slate-800 text-center space-y-8"
          >
            <div className="w-24 h-24 bg-indigo-600 rounded-full flex items-center justify-center mx-auto shadow-2xl shadow-indigo-200 dark:shadow-none">
              <Check className="w-12 h-12 text-white" />
            </div>
            <div className="space-y-2">
              <h2 className="text-3xl font-black text-slate-800 dark:text-white">Kuis Selesai!</h2>
              <p className="text-slate-500 dark:text-slate-400 font-medium">Kamu berhasil menyelesaikan kuis.</p>
            </div>
            <div className="p-8 bg-slate-50 dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700">
              <div className="text-5xl font-black text-indigo-600 dark:text-indigo-400">{score} / {questions.length}</div>
              <div className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mt-2">Skor Kamu</div>
            </div>
            <div className="flex flex-col gap-3">
              <button 
                onClick={() => { setQuestions([]); setIsFinished(false); setQuizTopic(''); }}
                className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-widest shadow-lg shadow-indigo-200 dark:shadow-none"
              >
                Coba Materi Lain
              </button>
              <button 
                onClick={() => setView('chat')}
                className="w-full py-5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-2xl font-black uppercase tracking-widest"
              >
                Kembali ke Chat
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </main>
  );
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [isLiveActive, setIsLiveActive] = useState(false);
  const [isLiveListening, setIsLiveListening] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [view, setView] = useState<'chat' | 'quiz'>('chat');
  const [mode, setMode] = useState<'chat' | 'study'>('chat');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [micVolume, setMicVolume] = useState(0);
  const [pdfContent, setPdfContent] = useState<string | null>(null);
  const [pdfFileName, setPdfFileName] = useState<string | null>(null);
  const [isExtractingPdf, setIsExtractingPdf] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  useEffect(() => {
    // Set worker for pdfjs
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
  }, []);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const liveSessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const micContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

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
        handleSendRef.current(transcript, true);
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

  const stopSpeaking = () => {
    if (audioSourceRef.current) {
      try {
        audioSourceRef.current.stop();
      } catch (e) {}
      audioSourceRef.current = null;
    }
    nextStartTimeRef.current = 0;
    setIsSpeaking(false);
  };

  const stopLiveMic = () => {
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }
    if (micProcessorRef.current) {
      micProcessorRef.current.disconnect();
      micProcessorRef.current = null;
    }
    if (micContextRef.current) {
      micContextRef.current.close();
      micContextRef.current = null;
    }
    setMicVolume(0);
  };

  const toggleLiveMode = async () => {
    if (isLiveActive) {
      if (liveSessionRef.current) {
        try {
          liveSessionRef.current.close();
        } catch (e) {}
        liveSessionRef.current = null;
      }
      stopLiveMic();
      setIsLiveActive(false);
      setIsLiveListening(false);
      stopSpeaking();
      return;
    }

    setIsLiveActive(true);
    setError(null);
    nextStartTimeRef.current = 0;

    try {
      const apiKey = getApiKey();
      const aiLive = new GoogleGenAI({ apiKey });
      
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      const session = await aiLive.live.connect({
        model: "gemini-3.1-flash-live-preview",
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: "Anda adalah AI R.G. MODE LIVE: JAWAB INSTAN & SANGAT SINGKAT. Gunakan bahasa gaul Jakarta (gue, lo, nih, deh). JANGAN MIKIR. Langsung nyaut aja. Maksimal 10 kata per jawaban. Fokus pada kecepatan, bukan kelengkapan.",
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }
          }
        },
        callbacks: {
          onopen: async () => {
            console.log('Live session opened');
            setIsLiveListening(true);
            
            // Start Mic ONLY after connection is open
            try {
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
              micStreamRef.current = stream;
              
              const micCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
              micContextRef.current = micCtx;
              
              const source = micCtx.createMediaStreamSource(stream);
              const processor = micCtx.createScriptProcessor(1024, 1, 1); // Further reduced buffer size for lower latency
              micProcessorRef.current = processor;

              const analyser = micCtx.createAnalyser();
              analyser.fftSize = 256;
              analyserRef.current = analyser;
              source.connect(analyser);

              source.connect(processor);
              processor.connect(micCtx.destination);

              const dataArray = new Uint8Array(analyser.frequencyBinCount);
              const updateVolume = () => {
                if (!isLiveActive || !analyserRef.current) return;
                analyserRef.current.getByteFrequencyData(dataArray);
                const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
                setMicVolume(average / 128); // Normalize to 0-1
                requestAnimationFrame(updateVolume);
              };
              updateVolume();

              processor.onaudioprocess = (e) => {
                if (!liveSessionRef.current) return;

                const inputData = e.inputBuffer.getChannelData(0);
                const pcmData = new Int16Array(inputData.length);
                for (let i = 0; i < inputData.length; i++) {
                  pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
                }

                const bytes = new Uint8Array(pcmData.buffer);
                let binary = '';
                for (let i = 0; i < bytes.byteLength; i++) {
                  binary += String.fromCharCode(bytes[i]);
                }
                const base64Data = btoa(binary);

                liveSessionRef.current.sendRealtimeInput({
                  audio: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
                });
              };
            } catch (micErr) {
              console.error('Mic Error:', micErr);
              setError("Gagal akses mic. Cek izin browser lo ya!");
              toggleLiveMode(); // Close session
            }
          },
          onmessage: async (message) => {
            const parts = message.serverContent?.modelTurn?.parts;
            if (parts) {
              for (const part of parts) {
                if (part.inlineData?.data) {
                  playRawAudio(part.inlineData.data);
                }
              }
            }
            
            if (message.serverContent?.interrupted) {
              stopSpeaking();
            }
          },
          onclose: () => {
            setIsLiveActive(false);
            setIsLiveListening(false);
            setIsSpeaking(false);
            stopLiveMic();
          },
          onerror: (err) => {
            console.error('Live Error:', err);
            setError("Koneksi Live putus nih. Coba lagi ya!");
            setIsLiveActive(false);
            setIsLiveListening(false);
            stopLiveMic();
          }
        }
      });

      liveSessionRef.current = session;

    } catch (err) {
      console.error('Live Setup Error:', err);
      setError("Gagal nyambung ke Live Mode. Cek koneksi internet lo!");
      setIsLiveActive(false);
      setIsLiveListening(false);
    }
  };

  const playRawAudio = async (base64Audio: string) => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    const binaryString = atob(base64Audio);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const float32Data = new Float32Array(bytes.length / 2);
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < float32Data.length; i++) {
      float32Data[i] = view.getInt16(i * 2, true) / 32768.0;
    }

    const buffer = audioContextRef.current.createBuffer(1, float32Data.length, 24000);
    buffer.getChannelData(0).set(float32Data);
    
    const source = audioContextRef.current.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = 1.0; // Normal speed as requested
    source.connect(audioContextRef.current.destination);
    
    const currentTime = audioContextRef.current.currentTime;
    // Add a small 50ms lookahead to prevent choppiness/gaps
    const startTime = Math.max(currentTime + 0.05, nextStartTimeRef.current);
    
    source.start(startTime);
    nextStartTimeRef.current = startTime + buffer.duration;
    
    setIsSpeaking(true);
    audioSourceRef.current = source;
    
    source.onended = () => {
      if (audioContextRef.current && audioContextRef.current.currentTime >= nextStartTimeRef.current - 0.1) {
        setIsSpeaking(false);
      }
    };
  };

  const speakText = async (text: string) => {
    if (!text.trim() || isAudioLoading) return;

    // Stop previous audio
    stopSpeaking();
    setIsAudioLoading(true);

    try {
      const apiKey = getApiKey();
      const aiTts = new GoogleGenAI({ apiKey });
      
      // Clean text for TTS
      const cleanText = text
        .replace(/[*#_~`>]/g, '')
        .replace(/\[.*?\]\(.*?\)/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      const response = await aiTts.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: `Gaya asik: ${cleanText}` }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: 'Zephyr' }, // Zephyr is clear and helpful
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      
      if (base64Audio) {
        // Play PCM Audio (24000Hz)
        const binaryString = atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Convert 16-bit PCM to Float32
        const float32Data = new Float32Array(bytes.length / 2);
        const view = new DataView(bytes.buffer);
        for (let i = 0; i < float32Data.length; i++) {
          float32Data[i] = view.getInt16(i * 2, true) / 32768.0;
        }

        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        
        const buffer = audioContextRef.current.createBuffer(1, float32Data.length, 24000);
        buffer.getChannelData(0).set(float32Data);
        
        const source = audioContextRef.current.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = 1.0; // Normal speed
        source.connect(audioContextRef.current.destination);
        
        source.onended = () => {
          setIsSpeaking(false);
          audioSourceRef.current = null;
        };

        audioSourceRef.current = source;
        source.start();
        setIsSpeaking(true);
      }
    } catch (err) {
      console.error('TTS Error:', err);
    } finally {
      setIsAudioLoading(false);
    }
  };

  const toggleListening = () => {
    if (!recognitionRef.current) {
      setError("Browser lo nggak dukung fitur suara nih, atau izin mic-nya belum dikasih.");
      return;
    }

    try {
      if (isListening) {
        recognitionRef.current.stop();
      } else {
        recognitionRef.current.start();
        setIsListening(true);
      }
    } catch (err) {
      console.error('Speech start error:', err);
      setIsListening(false);
    }
  };

  const abortControllerRef = useRef<AbortController | null>(null);

  const extractPdfText = async (file: File) => {
    setIsExtractingPdf(true);
    setError(null);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += pageText + '\n';
      }
      setPdfContent(fullText);
      setPdfFileName(file.name);
    } catch (err) {
      console.error('PDF Extraction Error:', err);
      setError('Gagal membaca file PDF. Pastikan file tidak rusak.');
    } finally {
      setIsExtractingPdf(false);
    }
  };

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      extractPdfText(file);
    } else if (file) {
      setError('Hanya file PDF yang didukung untuk saat ini.');
    }
  };

  const getCurrentLocation = (): Promise<{ lat: number; lng: number } | null> => {
    setIsLocating(true);
    setLocationError(null);
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        console.warn('Geolocation is not supported by your browser');
        setLocationError('Browser lo gak dukung GPS nih.');
        setIsLocating(false);
        resolve(null);
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setUserLocation(loc);
          setIsLocating(false);
          resolve(loc);
        },
        (error) => {
          console.error('Geolocation error:', error);
          let msg = 'Gagal ambil lokasi.';
          if (error.code === 1) msg = 'Izin lokasi ditolak. Aktifin di browser ya!';
          else if (error.code === 2) msg = 'Lokasi gak ketemu. Cek GPS lo!';
          else if (error.code === 3) msg = 'Waktu habis pas cari lokasi.';
          
          setLocationError(msg);
          setIsLocating(false);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  };

  const handleSend = async (textOverride?: string, isVoice: boolean = false) => {
    const messageText = textOverride || input;
    if ((!messageText.trim() && !pdfContent) || isLoading) return;

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
      content: pdfContent ? `[File: ${pdfFileName}]\n\n${messageText}` : messageText,
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

      // Detect location/weather intent
      const lowerText = messageText.toLowerCase();
      const isLocationQuery = /lokasi|tempat|kafe|restoran|dekat|di mana|maps|rute|jarak|makan|minum|kopi|warung|toko|apotek|spbu|bensin|mall|atm|bank|sekarang/.test(lowerText);
      const isWeatherQuery = /cuaca|hujan|panas|dingin|suhu|ramalan/.test(lowerText);
      
      let locationContext = "";
      let currentCoords = userLocation;

      if (isLocationQuery || isWeatherQuery) {
        // Use cached location if available to avoid delay
        if (userLocation) {
          currentCoords = userLocation;
          locationContext = `LOKASI USER SAAT INI (SANGAT PENTING): Latitude ${userLocation.lat}, Longitude ${userLocation.lng}. 
          Gunakan koordinat ini sebagai titik pusat (0,0) untuk semua pencarian "dekat saya" atau "di sekitar sini". 
          WAJIB berikan hasil yang berada dalam radius maksimal 2-5km dari titik ini. 
          Jika tidak ada hasil di radius tersebut, beri tahu user bahwa tidak ada yang sangat dekat, jangan asal kasih lokasi di kota lain.`;
        } else {
          // Add a temporary system message to show we are getting location
          const locId = Date.now();
          setMessages(prev => [...prev, {
            role: 'model',
            content: '📍 Sebentar ya, gue cek lokasi lo dulu biar akurat...',
            timestamp: new Date(),
            id: locId
          } as any]);

          const loc = await getCurrentLocation();
          
          // Remove the temporary message
          setMessages(prev => prev.filter((m: any) => m.id !== locId));

          if (loc) {
            currentCoords = loc;
            locationContext = `LOKASI USER SAAT INI (SANGAT PENTING): Latitude ${loc.lat}, Longitude ${loc.lng}. 
            Gunakan koordinat ini sebagai titik pusat (0,0) untuk semua pencarian "dekat saya" atau "di sekitar sini". 
            WAJIB berikan hasil yang berada dalam radius maksimal 2-5km dari titik ini. 
            Jika tidak ada hasil di radius tersebut, beri tahu user bahwa tidak ada yang sangat dekat, jangan asal kasih lokasi di kota lain.`;
          } else {
            console.warn("Could not get location, proceeding without it.");
            locationContext = "PERINGATAN: Gagal mendapatkan lokasi GPS pengguna. Beritahu pengguna bahwa lo gak tau lokasi mereka sekarang dan minta mereka aktifin GPS atau sebutin nama daerahnya.";
          }
        }
      }

      const finalPrompt = pdfContent 
        ? `Gunakan materi PDF berikut sebagai referensi untuk menjawab pertanyaan saya: \n\n--- MATERI PDF ---\n${pdfContent}\n--- AKHIR MATERI ---\n\nPertanyaan saya: ${messageText}${locationContext ? `\n\n[${locationContext}]` : ''}`
        : locationContext 
          ? `[KONTEKS LOKASI: ${locationContext}]\n\nPertanyaan: ${messageText}`
          : messageText;

      // Clear PDF after sending
      setPdfContent(null);
      setPdfFileName(null);

      // Use streaming for faster perceived response
      let result;
      const baseSystemInstruction = mode === 'study' 
        ? `Anda adalah AI R.G dalam MODE BELAJAR. Fokus pada penjelasan materi pendidikan yang mendalam, langkah demi langkah, dan edukatif.
           Waktu saat ini: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'full', timeStyle: 'long' })}.
           Karakter: Sabar, cerdas, ramah, dan sangat membantu dalam memahami konsep sulit.
           Gunakan bahasa Indonesia yang baik namun tetap akrab.
           Gunakan Google Search untuk memberikan data dan fakta terbaru.`
        : `Anda adalah AI R.G dalam MODE NGOBROL. JAWAB SINGKAT & INSTAN.
           Waktu saat ini: ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', dateStyle: 'full', timeStyle: 'long' })}.
           Karakter: Cerdas, ramah, gaul Jakarta (gue, lo, nih, deh). 
           Berikan jawaban 1-2 kalimat saja agar cepat. Langsung ke intinya.
           Gunakan Google Search untuk memberikan informasi terbaru dan akurat jika diperlukan.`;

      const locationInstruction = currentCoords 
        ? `\n\n[SANGAT PENTING - INSTRUKSI LOKASI]
           User berada di koordinat Latitude: ${currentCoords.lat}, Longitude: ${currentCoords.lng}.
           Gunakan data ini sebagai TITIK PUSAT pencarian di Google Maps.
           WAJIB prioritaskan hasil yang PALING DEKAT secara geografis (radius < 2km).
           Jika user tanya "kafe terdekat", berikan yang benar-benar paling dekat dari koordinat tersebut.
           Jangan memberikan lokasi di kota lain atau yang jauh kecuali user minta secara spesifik.
           Sebutkan nama jalan atau daerahnya agar user yakin itu akurat.`
        : "";

      const systemInstruction = baseSystemInstruction + locationInstruction;

      try {
        // Use Google Maps for location queries, Google Search for others
        const tools: any[] = isLocationQuery ? [{ googleMaps: {} }] : [{ googleSearch: {} }];
        const toolConfig = currentCoords ? {
          retrievalConfig: {
            latLng: {
              latitude: currentCoords.lat,
              longitude: currentCoords.lng
            }
          }
        } : undefined;

        result = await ai.models.generateContentStream({
          model: "gemini-3-flash-preview",
          contents: [...history, { role: 'user', parts: [{ text: finalPrompt }] }],
          config: {
            tools,
            toolConfig,
            systemInstruction,
          }
        });
      } catch (modelErr: any) {
        console.warn('Primary model failed, falling back to lite:', modelErr);
        // Fallback to lite if 3-flash is not available
        result = await ai.models.generateContentStream({
          model: "gemini-3.1-flash-lite-preview",
          contents: [...history, { role: 'user', parts: [{ text: finalPrompt }] }],
          config: {
            systemInstruction,
          }
        });
      }

      let fullText = '';
      let firstSentenceSpoken = false;
      let groundingChunks: any[] = [];
      const aiMessage: Message = {
        role: 'model',
        content: '',
        timestamp: new Date(),
      };

      // Add placeholder message
      setMessages(prev => [...prev, aiMessage]);

      for await (const chunk of result) {
        if (currentAbortController.signal.aborted) return;
        const chunkText = chunk.text;
        
        // Collect grounding metadata if available
        const metadata = (chunk as any).candidates?.[0]?.groundingMetadata;
        if (metadata?.groundingChunks) {
          groundingChunks = [...groundingChunks, ...metadata.groundingChunks];
        }

        if (chunkText) {
          fullText += chunkText;
          
          // Optimization: Start speaking as soon as the first sentence is ready
          if (isVoice && !firstSentenceSpoken && /[.!?]\s$/.test(fullText)) {
            firstSentenceSpoken = true;
            speakText(fullText.trim());
          }

          setMessages(prev => {
            const newMessages = [...prev];
            const lastMsg = newMessages[newMessages.length - 1];
            if (lastMsg && lastMsg.role === 'model') {
              lastMsg.content = fullText;
              lastMsg.groundingChunks = groundingChunks.length > 0 ? groundingChunks : undefined;
            }
            return newMessages;
          });
        }
      }

      if (currentAbortController.signal.aborted) return;

      // If the response was too short to have a sentence end, or it didn't trigger yet
      if (isVoice && !firstSentenceSpoken && fullText) {
        speakText(fullText);
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

  // Use a ref to always have the latest handleSend for speech callbacks
  const handleSendRef = useRef(handleSend);
  useEffect(() => {
    handleSendRef.current = handleSend;
  }, [handleSend]);

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
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950 font-sans text-slate-900 dark:text-slate-100 transition-colors duration-300 overflow-hidden">
      {/* PDF Extraction Loading Overlay */}
      <AnimatePresence>
        {isExtractingPdf && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-white/80 dark:bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center"
          >
            <div className="relative">
              <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center shadow-2xl animate-bounce">
                <FileText className="w-10 h-10 text-white" />
              </div>
              <div className="absolute -bottom-2 -right-2 bg-white dark:bg-slate-900 p-2 rounded-full shadow-lg">
                <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
              </div>
            </div>
            <h2 className="mt-8 text-xl font-black text-slate-800 dark:text-white uppercase tracking-tighter">Membaca File PDF...</h2>
            <p className="mt-2 text-slate-500 dark:text-slate-400 font-medium max-w-xs">AI R.G sedang mengekstrak materi dari file kamu. Tunggu sebentar ya!</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Gemini Live Style Overlay */}
      <AnimatePresence>
        {isLiveActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-slate-950 flex flex-col items-center justify-center p-8 text-center"
          >
            <div className="absolute inset-0 overflow-hidden opacity-20">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 blur-3xl animate-pulse" />
            </div>

            <motion.div
              animate={{ 
                scale: isSpeaking || isLiveListening ? [1, 1.05 + (micVolume * 0.2), 1] : 1,
                rotate: isSpeaking || isLiveListening ? [0, 2, -2, 0] : 0
              }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="relative z-10 mb-12"
            >
              <div className="w-32 h-32 bg-indigo-600 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(79,70,229,0.5)] relative overflow-hidden">
                <Bot className="w-16 h-16 text-white relative z-10" />
                {/* Dynamic Background based on volume */}
                <motion.div 
                  animate={{ scale: 1 + micVolume }}
                  className="absolute inset-0 bg-indigo-500 opacity-50 rounded-full"
                />
              </div>
              {(isSpeaking || isLiveListening) && (
                <motion.div 
                  animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                  transition={{ repeat: Infinity, duration: 1 }}
                  className="absolute inset-0 -m-4 border-4 border-indigo-500/30 rounded-full" 
                />
              )}
            </motion.div>

            <div className="relative z-10 space-y-4">
              <h2 className="text-3xl font-black text-white tracking-tighter uppercase">AI R.G LIVE</h2>
              <p className="text-indigo-300 font-bold tracking-widest text-sm uppercase">
                {isSpeaking ? 'AI R.G Sedang Bicara...' : (isLiveListening ? 'Mendengarkan lo...' : 'Menghubungkan...')}
              </p>
              
              <div className="flex justify-center gap-2 h-16 items-center">
                {[...Array(9)].map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{ 
                      height: isSpeaking || isLiveListening ? [10, 10 + (micVolume * 60 * Math.random()), 10] : 10,
                      opacity: isSpeaking || isLiveListening ? 1 : 0.3
                    }}
                    transition={{ 
                      repeat: Infinity, 
                      duration: 0.2, 
                      delay: i * 0.05 
                    }}
                    className="w-2 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                  />
                ))}
              </div>
            </div>

            <button
              onClick={toggleLiveMode}
              className="absolute bottom-12 p-6 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-2xl transition-all active:scale-90 z-10"
            >
              <Square className="w-8 h-8 fill-current" />
            </button>
            
            <p className="absolute bottom-4 text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">
              Klik kotak merah untuk berhenti
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600 rounded-xl shadow-indigo-200 dark:shadow-none shadow-lg">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <div className="hidden sm:block">
            <h1 className="text-xl font-black tracking-tighter text-slate-800 dark:text-white uppercase">AI R.G</h1>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest">Asisten Kelas Aktif</span>
            </div>
          </div>
        </div>

        {pdfFileName && (
          <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-full">
            <FileText className="w-3 h-3 text-orange-600" />
            <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest truncate max-w-[100px]">{pdfFileName}</span>
          </div>
        )}

        {/* Mode Toggle */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl border border-slate-200 dark:border-slate-700">
          <button
            onClick={() => setMode('chat')}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
              mode === 'chat' 
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            <Volume2 className="w-3.5 h-3.5" />
            Ngobrol
          </button>
          <button
            onClick={() => setMode('study')}
            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
              mode === 'study' 
                ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-sm' 
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
            }`}
          >
            <GraduationCap className="w-3.5 h-3.5" />
            Belajar
          </button>
        </div>

        <div className="flex items-center gap-2">
          {userLocation ? (
            <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30 rounded-full">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-black text-green-600 dark:text-green-400 uppercase tracking-widest">GPS Aktif</span>
            </div>
          ) : (
            <button
              onClick={() => getCurrentLocation()}
              disabled={isLocating}
              className={`hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all ${
                isLocating 
                  ? 'bg-slate-50 border-slate-200 text-slate-400 dark:bg-slate-800 dark:border-slate-700' 
                  : 'bg-indigo-50 border-indigo-100 text-indigo-600 hover:bg-indigo-100 dark:bg-indigo-900/20 dark:border-indigo-800 dark:text-indigo-400'
              }`}
            >
              {isLocating ? <Loader2 className="w-3 h-3 animate-spin" /> : <MapPin className="w-3 h-3" />}
              <span className="text-[10px] font-black uppercase tracking-widest">Cek Lokasi</span>
            </button>
          )}

          <button
            onClick={() => setView(view === 'chat' ? 'quiz' : 'chat')}
            className={`p-2 rounded-xl transition-all flex items-center gap-2 font-black text-[10px] uppercase tracking-wider ${
              view === 'quiz'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200 dark:shadow-none'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600'
            }`}
          >
            {view === 'chat' ? (
              <>
                <Plus className="w-4 h-4" />
                Mode Kuis
              </>
            ) : (
              <>
                <Bot className="w-4 h-4" />
                Kembali Chat
              </>
            )}
          </button>
          <button 
            onClick={clearChat}
            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
            title="Hapus Percakapan"
          >
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </header>

      {locationError && (
        <div className="max-w-2xl mx-auto mb-4 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-100 dark:border-orange-900/50 text-orange-600 dark:text-orange-400 rounded-2xl text-sm text-center font-bold flex items-center justify-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {locationError}
          <button onClick={() => setLocationError(null)} className="ml-2 p-1 hover:bg-orange-100 dark:hover:bg-orange-800 rounded-full">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {error && (
        <div className="max-w-2xl mx-auto mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50 text-red-600 dark:text-red-400 rounded-2xl text-sm text-center font-bold">
          {error}
        </div>
      )}

      {/* Chat Area */}
      {view === 'chat' ? (
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
                      {msg.role === 'model' && msg.groundingChunks && msg.groundingChunks.some(c => c.maps) && (
                        <div className="flex items-center gap-1.5 mb-3 px-2 py-1 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30 rounded-xl w-fit">
                          <MapPin className="w-3 h-3 text-green-600 dark:text-green-400" />
                          <span className="text-[10px] font-black text-green-600 dark:text-green-400 uppercase tracking-wider">Lokasi Akurat</span>
                        </div>
                      )}
                      <p className="whitespace-pre-wrap leading-relaxed text-sm md:text-base font-medium">{msg.content}</p>
                      
                      {msg.groundingChunks && msg.groundingChunks.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700/50 space-y-2">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-2">Sumber & Lokasi:</p>
                          <div className="flex flex-wrap gap-2">
                            {msg.groundingChunks.map((chunk, cIdx) => {
                              const title = chunk.web?.title || chunk.maps?.title || 'Lihat Detail';
                              const uri = chunk.web?.uri || chunk.maps?.uri;
                              if (!uri) return null;
                              return (
                                <a
                                  key={cIdx}
                                  href={uri}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-slate-900/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 border border-slate-100 dark:border-slate-700 rounded-xl text-xs font-bold text-indigo-600 dark:text-indigo-400 transition-all group/link"
                                >
                                  {chunk.maps ? <MapPin className="w-3 h-3" /> : <Search className="w-3 h-3" />}
                                  <span className="truncate max-w-[150px]">{title}</span>
                                </a>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {msg.image && (
                        <motion.div 
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="mt-4 rounded-2xl overflow-hidden border border-white/20 shadow-xl"
                        >
                          <img 
                            src={msg.image} 
                            alt="Generated AI" 
                            className="w-full h-auto object-cover max-h-[400px]"
                            referrerPolicy="no-referrer"
                          />
                        </motion.div>
                      )}
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
                          disabled={isAudioLoading}
                          className={`p-2 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-100 dark:border-slate-700 ${isAudioLoading ? 'animate-pulse' : ''}`}
                          title="Dengarkan Suara Gemini"
                        >
                          {isAudioLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Volume2 className="w-4 h-4" />}
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
                <span className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                  AI R.G sedang menganalisis...
                </span>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />

          {/* Location Footer - Gemini Style */}
          <div className="mt-8 mb-4 flex flex-col items-center justify-center gap-2 opacity-60 hover:opacity-100 transition-opacity">
            <div className="flex items-center gap-2 px-4 py-2 bg-white/50 dark:bg-slate-900/50 rounded-full border border-slate-100 dark:border-slate-800 shadow-sm">
              <div className={`w-1.5 h-1.5 rounded-full ${userLocation ? 'bg-green-500 animate-pulse' : 'bg-slate-300 dark:bg-slate-700'}`} />
              <span className="text-[9px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em]">
                {userLocation ? `Berdasarkan lokasi lo: ${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}` : 'Lokasi lo belum kebaca nih'}
              </span>
              <button 
                onClick={() => getCurrentLocation()}
                disabled={isLocating}
                className="ml-2 text-[9px] font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-widest hover:text-indigo-700 transition-colors disabled:opacity-50"
              >
                {isLocating ? 'Mencari...' : (userLocation ? 'Perbarui' : 'Aktifkan')}
              </button>
            </div>
            <p className="text-[8px] text-slate-400 dark:text-slate-600 font-bold uppercase tracking-widest">
              AI R.G menggunakan GPS untuk jawaban yang lebih akurat
            </p>
          </div>
        </main>
      ) : (
        <QuizView 
          pdfContent={pdfContent}
          pdfFileName={pdfFileName}
          setPdfContent={setPdfContent}
          setPdfFileName={setPdfFileName}
          isExtractingPdf={isExtractingPdf}
          handleFileUpload={handleFileUpload}
          setError={setError}
          setView={setView}
        />
      )}

      {/* Voice Controls Floating Bar */}
      <AnimatePresence>
        {(isSpeaking || isLiveActive) && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 p-2 rounded-2xl shadow-2xl border ${
              isLiveActive ? 'bg-red-600 border-red-500' : 'bg-indigo-600 border-indigo-500'
            }`}
          >
              <div className="flex items-center gap-3 px-3">
                <div className="flex gap-1">
                  <div className={`w-1 h-4 bg-white/40 rounded-full ${isLiveActive || isSpeaking ? 'animate-bounce' : ''}`} />
                  <div className={`w-1 h-6 bg-white rounded-full ${isLiveActive || isSpeaking ? 'animate-bounce [animation-delay:0.1s]' : ''}`} />
                  <div className={`w-1 h-3 bg-white/60 rounded-full ${isLiveActive || isSpeaking ? 'animate-bounce [animation-delay:0.2s]' : ''}`} />
                </div>
                <span className="text-xs font-black text-white uppercase tracking-widest">
                  {isLiveActive 
                    ? (isLiveListening ? 'AI R.G Mendengarkan...' : 'AI R.G Menghubungkan...') 
                    : 'AI R.G Sedang Bicara'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={isLiveActive ? toggleLiveMode : stopSpeaking}
                  className="p-2 bg-white/20 hover:bg-white/30 text-white rounded-xl transition-all"
                  title="Berhenti"
                >
                  <VolumeX className="w-4 h-4" />
                </button>
              </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input Area */}
      {view === 'chat' && (
        <footer className="p-4 md:p-6 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
          <div className="max-w-4xl mx-auto relative">
            {/* Magic Menu Popover */}
            <AnimatePresence>
              {isMenuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute bottom-full left-0 mb-4 p-2 bg-white dark:bg-slate-800 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-700 flex gap-2 z-30"
                >
                  <button
                    onClick={() => { toggleLiveMode(); setIsMenuOpen(false); }}
                    className={`p-4 rounded-2xl transition-all flex flex-col items-center justify-center gap-1 min-w-[70px] ${
                      isLiveActive 
                        ? 'bg-red-600 text-white animate-pulse' 
                        : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600'
                    }`}
                  >
                    <Bot className="w-6 h-6" />
                    <span className="text-[10px] font-black uppercase">Live</span>
                  </button>

                  <button
                    onClick={() => {
                      setInput('cari info tentang ');
                      setIsMenuOpen(false);
                      const textarea = document.querySelector('textarea');
                      if (textarea) textarea.focus();
                    }}
                    className="p-4 rounded-2xl transition-all flex flex-col items-center justify-center gap-1 min-w-[70px] bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-600"
                  >
                    <Search className="w-6 h-6" />
                    <span className="text-[10px] font-black uppercase">Cari</span>
                  </button>

                  <button
                    onClick={() => {
                      setInput('lokasi terdekat ');
                      setIsMenuOpen(false);
                      const textarea = document.querySelector('textarea');
                      if (textarea) textarea.focus();
                    }}
                    className="p-4 rounded-2xl transition-all flex flex-col items-center justify-center gap-1 min-w-[70px] bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-green-50 dark:hover:bg-green-900/20 hover:text-green-600"
                  >
                    <MapPin className="w-6 h-6" />
                    <span className="text-[10px] font-black uppercase">Lokasi</span>
                  </button>

                  <button
                    onClick={() => { toggleListening(); setIsMenuOpen(false); }}
                    className={`p-4 rounded-2xl transition-all flex flex-col items-center justify-center gap-1 min-w-[70px] ${
                      isListening 
                        ? 'bg-red-500 text-white animate-pulse' 
                        : 'bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-600'
                    }`}
                  >
                    {isListening ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                    <span className="text-[10px] font-black uppercase">Mic</span>
                  </button>

                  <label className="p-4 rounded-2xl transition-all flex flex-col items-center justify-center gap-1 min-w-[70px] bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-orange-50 dark:hover:bg-orange-900/20 hover:text-orange-600 cursor-pointer">
                    <input 
                      type="file" 
                      accept="application/pdf" 
                      className="hidden" 
                      onChange={(e) => { handleFileUpload(e); setIsMenuOpen(false); }}
                    />
                    <FileText className="w-6 h-6" />
                    <span className="text-[10px] font-black uppercase">PDF</span>
                  </label>
                </motion.div>
              )}
            </AnimatePresence>

            {/* PDF Preview */}
            {pdfFileName && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between p-3 mb-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 rounded-xl"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="p-2 bg-indigo-600 rounded-lg">
                    <FileText className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex flex-col truncate">
                    <span className="text-xs font-black text-slate-800 dark:text-slate-200 truncate">{pdfFileName}</span>
                    <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-widest">Materi Siap Dikirim</span>
                  </div>
                </div>
                <button 
                  onClick={() => { setPdfContent(null); setPdfFileName(null); }}
                  className="p-2 hover:bg-indigo-100 dark:hover:bg-indigo-800 rounded-lg text-indigo-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            )}

            {/* Quick Action Chips */}
            {!input && !isLoading && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-2 mb-3 overflow-x-auto pb-1 no-scrollbar"
              >
                {[
                  { label: 'Cari di Internet 🌐', text: 'cari info tentang ' },
                  { label: 'Cari Lokasi 📍', text: 'lokasi terdekat ' },
                  { label: 'Tanya Tugas 📚', text: 'jelasin tentang ' },
                  { label: 'Ngobrol Santai 💬', text: 'halo rg, apa kabar?' },
                  { label: 'Cek Cuaca 🌤️', text: 'cuaca hari ini gimana?' }
                ].map((chip, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setInput(chip.text);
                      const textarea = document.querySelector('textarea');
                      if (textarea) textarea.focus();
                    }}
                    className="whitespace-nowrap px-4 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/30 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-full text-xs font-bold transition-all border border-transparent hover:border-indigo-200 dark:hover:border-indigo-800"
                  >
                    {chip.label}
                  </button>
                ))}
              </motion.div>
            )}

            <div className="flex gap-3 items-end">
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className={`p-4 rounded-2xl transition-all shadow-lg flex items-center justify-center ${
                  isMenuOpen 
                    ? 'bg-slate-800 dark:bg-white text-white dark:text-slate-900 rotate-45' 
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                <Plus className="w-6 h-6" />
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
          </div>
          <p className="text-[10px] text-center text-slate-400 dark:text-slate-500 mt-3 font-bold uppercase tracking-widest">
            AI R.G • Sahabat Belajar Siswa Masa Depan
          </p>
        </footer>
      )}
    </div>
  );
}
