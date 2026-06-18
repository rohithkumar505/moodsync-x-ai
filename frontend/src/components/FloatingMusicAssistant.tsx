import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Music, Mic, MicOff, RotateCcw, Send, Sparkles, User, X } from 'lucide-react';
import api, { getApiErrorMessage } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useMusicAssistant } from '../context/MusicAssistantContext';
import { useMusicPlayer } from '../context/MusicPlayerContext';
import { useMobileShellInsets } from '../hooks/useMobileShellInsets';
import { useIsMobileViewport } from '../hooks/useIsMobileViewport';
import {
  QUICK_PROMPTS,
  type AssistantResponse,
} from '../lib/assistantApi';
import type { Song } from '../types/music';

interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  start: () => void;
  stop: () => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  time: string;
  mood?: string | null;
  moodEmoji?: string | null;
  songs?: Song[];
}

function nowLabel() {
  return new Date().toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function welcomeMessage(name: string): ChatMessage {
  return {
    id: 'welcome',
    role: 'assistant',
    time: nowLabel(),
    text:
      `Hey ${name}! I'm MoodBuddy, your music wellness friend.\n\n` +
      "Chat naturally — share your mood, ask for suggestions, or request singers & movies. I'll listen and play music for you.",
  };
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-1 py-2">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-violet-300/80 animate-bounce"
          style={{ animationDelay: `${i * 0.15}s` }}
        />
      ))}
    </div>
  );
}

function SongCard({ song, onPlay }: { song: Song; onPlay: () => void }) {
  return (
    <button
      type="button"
      onClick={onPlay}
      className="w-full flex items-center gap-2 p-2 rounded-lg bg-white/5 border border-white/10 active:bg-violet-500/15 transition text-left"
    >
      {song.imageUrl ? (
        <img src={song.imageUrl} alt="" className="w-9 h-9 rounded-md object-cover shrink-0" />
      ) : (
        <div className="w-9 h-9 rounded-md bg-violet-500/20 flex items-center justify-center shrink-0">
          <Music size={14} className="text-violet-300" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium truncate">{song.songName}</p>
        <p className="text-[10px] text-white/45 truncate">{song.artist}</p>
      </div>
      <span className="text-[10px] text-violet-300 shrink-0">Play</span>
    </button>
  );
}

function AssistantHeader({ onClear, onClose, mobile }: { onClear: () => void; onClose: () => void; mobile?: boolean }) {
  return (
    <header className="flex flex-col shrink-0 border-b border-white/10 bg-gradient-to-r from-violet-600/30 via-fuchsia-600/20 to-pink-600/20">
      {mobile ? (
        <div className="flex justify-center pt-2 pb-1">
          <span className="w-10 h-1 rounded-full bg-white/25" aria-hidden />
        </div>
      ) : null}
      <div className="flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="relative shrink-0">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-400 to-pink-500 flex items-center justify-center shadow-lg shadow-violet-900/40">
            <Sparkles size={18} className="text-white" />
          </div>
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-900" />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-sm">MoodBuddy</p>
          <p className="text-[10px] text-emerald-300/80 truncate">Online · music wellness AI</p>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onClear}
          className="p-2 rounded-lg hover:bg-white/10 active:bg-white/15 text-white/45"
          aria-label="Clear chat"
        >
          <RotateCcw size={14} />
        </button>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-white/10 active:bg-white/15 text-white/60"
          aria-label="Close assistant"
        >
          <X size={18} />
        </button>
      </div>
      </div>
    </header>
  );
}

function ChatMessages({
  messages,
  loading,
  listRef,
  onPlaySong,
  onPlayQueue,
}: {
  messages: ChatMessage[];
  loading: boolean;
  listRef: React.RefObject<HTMLDivElement | null>;
  onPlaySong: (song: Song) => void;
  onPlayQueue: (songs: Song[]) => void;
}) {
  return (
    <div ref={listRef} className="mobile-assistant-messages p-3 space-y-3 bg-gradient-to-b from-black/30 to-black/10">
      {messages.map((m) => (
        <div key={m.id} className={`flex gap-2 ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
          <div
            className={`w-7 h-7 rounded-full shrink-0 flex items-center justify-center mt-0.5 ${
              m.role === 'user'
                ? 'bg-violet-500/30 border border-violet-400/30'
                : 'bg-gradient-to-br from-violet-500/40 to-pink-500/40 border border-white/15'
            }`}
          >
            {m.role === 'user' ? (
              <User size={12} className="text-violet-200" />
            ) : (
              <Sparkles size={12} className="text-pink-100" />
            )}
          </div>

          <div className={`max-w-[min(78%,17.5rem)] sm:max-w-[min(80%,18.5rem)] min-w-0 ${m.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
            <div
              className={`text-sm px-3.5 py-2.5 rounded-2xl whitespace-pre-wrap break-words leading-relaxed shadow-sm max-w-full ${
                m.role === 'user'
                  ? 'bg-gradient-to-br from-violet-600/50 to-violet-500/35 border border-violet-400/25 text-violet-50 rounded-br-sm'
                  : 'bg-white/10 border border-white/12 text-white/92 rounded-bl-sm backdrop-blur-sm'
              }`}
            >
              {m.moodEmoji && m.role === 'assistant' ? (
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide text-violet-200/80 mb-1.5 font-medium">
                  {m.moodEmoji} {m.mood?.toLowerCase()} mood
                </span>
              ) : null}
              {m.moodEmoji && m.role === 'assistant' ? <br /> : null}
              {m.text}
            </div>

            {m.songs && m.songs.length > 0 ? (
              <div className="w-full max-w-full min-w-0 space-y-1.5 mt-0.5">
                <p className="text-[10px] text-white/40 px-1">Suggested for you</p>
                {m.songs.slice(0, 4).map((song) => (
                  <SongCard key={song.id} song={song} onPlay={() => onPlaySong(song)} />
                ))}
                {m.songs.length > 4 ? (
                  <button
                    type="button"
                    onClick={() => onPlayQueue(m.songs!)}
                    className="w-full text-[10px] py-1.5 text-violet-300 active:text-violet-200"
                  >
                    Play all {m.songs.length} songs →
                  </button>
                ) : null}
              </div>
            ) : null}

            <span className="text-[9px] text-white/30 px-1">{m.time}</span>
          </div>
        </div>
      ))}

      {loading ? (
        <div className="flex gap-2 items-center">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500/40 to-pink-500/40 flex items-center justify-center">
            <Sparkles size={12} className="text-pink-100 animate-pulse" />
          </div>
          <div className="bg-white/8 border border-white/10 rounded-2xl rounded-bl-sm px-3 py-1">
            <TypingDots />
          </div>
        </div>
      ) : null}
    </div>
  );
}

function AssistantComposer({
  input,
  loading,
  listening,
  inputRef,
  onInputChange,
  onSubmit,
  onToggleListen,
}: {
  input: string;
  loading: boolean;
  listening: boolean;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onInputChange: (v: string) => void;
  onSubmit: () => void;
  onToggleListen: () => void;
}) {
  return (
    <form
      className="p-3 flex gap-2 border-t border-white/10 bg-black/25 shrink-0 min-w-0 pb-[max(0.75rem,var(--mobile-safe-bottom))] lg:pb-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <input
        ref={inputRef}
        className="glass-input flex-1 text-base sm:text-sm py-2.5 min-w-0"
        placeholder="How do you feel? What should I play?"
        value={input}
        onChange={(e) => onInputChange(e.target.value)}
        disabled={loading}
        enterKeyHint="send"
      />
      <button
        type="button"
        onClick={onToggleListen}
        className={`p-2.5 rounded-xl border shrink-0 transition min-w-[2.75rem] min-h-[2.75rem] flex items-center justify-center ${
          listening
            ? 'bg-red-500/20 border-red-400/40 text-red-300'
            : 'bg-white/5 border-white/15 text-white/60 active:bg-white/10'
        }`}
        aria-label={listening ? 'Stop listening' : 'Voice input'}
      >
        {listening ? <MicOff size={18} /> : <Mic size={18} />}
      </button>
      <button
        type="submit"
        disabled={loading || !input.trim()}
        className="p-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-pink-500 border border-white/20 active:opacity-90 disabled:opacity-40 shadow-md shadow-violet-900/30 transition min-w-[2.75rem] min-h-[2.75rem] flex items-center justify-center"
        aria-label="Send message"
      >
        <Send size={18} className="text-white" />
      </button>
    </form>
  );
}

export default function FloatingMusicAssistant() {
  const { user } = useAuth();
  const { playQueue, playSong, current, playerBarVisible } = useMusicPlayer();
  const { open, closeAssistant, toggleAssistant } = useMusicAssistant();
  const isMobile = useIsMobileViewport();
  const { fabClass } = useMobileShellInsets(Boolean(current), playerBarVisible);
  const firstName = user?.name?.split(/\s+/)[0] || 'friend';
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(() => [welcomeMessage(firstName)]);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  useEffect(() => {
    setMessages((prev) => {
      if (prev.length === 1 && prev[0]?.id === 'welcome') {
        return [welcomeMessage(firstName)];
      }
      return prev;
    });
  }, [firstName]);

  useEffect(() => {
    document.body.classList.toggle('assistant-sheet-open', open);
    return () => document.body.classList.remove('assistant-sheet-open');
  }, [open]);

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const clearChat = () => setMessages([welcomeMessage(firstName)]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;

      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        text: trimmed,
        time: nowLabel(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setLoading(true);

      const history = [...messagesRef.current, userMsg]
        .filter((m) => m.id !== 'welcome')
        .slice(-12)
        .map((m) => ({ role: m.role, content: m.text }));

      try {
        const { data } = await api.post<AssistantResponse>('/api/assistant/chat', {
          message: trimmed,
          history,
        });

        const assistantMsg: ChatMessage = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: data.reply,
          time: nowLabel(),
          mood: data.detectedMood,
          moodEmoji: data.moodEmoji,
          songs: data.songs?.length ? data.songs : undefined,
        };

        setMessages((prev) => [...prev, assistantMsg]);

        if (data.songs?.length && data.playNow !== false) {
          playQueue(data.songs as Song[], 0);
        }
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            id: `e-${Date.now()}`,
            role: 'assistant',
            text: getApiErrorMessage(err, "I'm sorry — I couldn't respond right now. Please try again."),
            time: nowLabel(),
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [loading, playQueue],
  );

  const toggleListen = () => {
    const win = window as Window & {
      SpeechRecognition?: new () => SpeechRecognitionInstance;
      webkitSpeechRecognition?: new () => SpeechRecognitionInstance;
    };
    const SpeechRecognitionCtor = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setMessages((prev) => [
        ...prev,
        {
          id: `v-${Date.now()}`,
          role: 'assistant',
          time: nowLabel(),
          text: "Voice isn't supported here — type your message and I'll still chat with you!",
        },
      ]);
      return;
    }

    if (listening && recognitionRef.current) {
      recognitionRef.current.stop();
      setListening(false);
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = 'en-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognitionRef.current = recognition;

    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) void sendMessage(transcript);
    };

    recognition.start();
  };

  const quickPrompts = (
    <div className="px-3 py-2 border-t border-white/10 bg-black/15 shrink-0 min-w-0">
      <p className="text-[9px] text-white/35 mb-1.5">Quick prompts</p>
      <div className="assistant-quick-scroll lg:flex lg:flex-wrap lg:gap-1.5 lg:max-h-[4.5rem] lg:overflow-y-auto">
        {QUICK_PROMPTS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => sendMessage(p.text)}
            disabled={loading}
            className="text-[10px] px-2.5 py-1.5 rounded-full bg-white/6 border border-white/10 text-white/55 active:bg-violet-500/20 shrink-0 whitespace-nowrap disabled:opacity-40 transition"
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );

  const composer = (
    <AssistantComposer
      input={input}
      loading={loading}
      listening={listening}
      inputRef={inputRef}
      onInputChange={setInput}
      onSubmit={() => void sendMessage(input)}
      onToggleListen={toggleListen}
    />
  );

  const panelBody = (
    <>
      <AssistantHeader onClear={clearChat} onClose={closeAssistant} />
      <ChatMessages
        messages={messages}
        loading={loading}
        listRef={listRef}
        onPlaySong={playSong}
        onPlayQueue={(songs) => playQueue(songs, 0)}
      />
      {quickPrompts}
      {composer}
    </>
  );

  if (isMobile) {
    return createPortal(
      <>
        {open ? (
          <button
            type="button"
            className="mobile-assistant-backdrop"
            aria-label="Close MoodBuddy"
            onClick={closeAssistant}
          />
        ) : null}
        <div className={`mobile-assistant-fab ${fabClass}`}>
          {open ? (
            <div className="pointer-events-auto assistant-panel w-full overflow-hidden flex flex-col max-h-[min(50dvh,28rem)] mb-3">
              {panelBody}
            </div>
          ) : null}
          <button
            type="button"
            onClick={toggleAssistant}
            className="pointer-events-auto assistant-float w-14 h-14 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 border-2 border-white/30 shadow-xl shadow-violet-900/50 flex items-center justify-center active:scale-95 transition-transform"
            aria-label={open ? 'Close MoodBuddy' : 'Open MoodBuddy'}
          >
            {open ? <X size={22} className="text-white" /> : <Sparkles size={22} className="text-white" />}
          </button>
        </div>
      </>,
      document.body,
    );
  }

  return (
    <div
      className={`fixed right-4 z-[45] flex flex-col items-end pointer-events-none w-[min(100vw-2rem,22rem)] max-w-[22rem] ${
        current && playerBarVisible ? 'bottom-36' : current ? 'bottom-20' : 'bottom-4'
      }`}
    >
      {open ? (
        <div className="pointer-events-auto assistant-panel w-full overflow-hidden flex flex-col max-h-[min(32rem,70vh)] mb-3">
          {panelBody}
        </div>
      ) : null}

      <button
        type="button"
        onClick={toggleAssistant}
        className="pointer-events-auto assistant-float w-14 h-14 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 border-2 border-white/30 shadow-xl shadow-violet-900/50 flex items-center justify-center hover:scale-105 active:scale-95 transition-transform ml-auto"
        aria-label={open ? 'Close MoodBuddy' : 'Open MoodBuddy'}
      >
        {open ? <X size={22} className="text-white" /> : <Sparkles size={22} className="text-white" />}
      </button>
    </div>
  );
}
