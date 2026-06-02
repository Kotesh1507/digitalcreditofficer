import { useEffect, useCallback, useState } from 'react';
import { io } from 'socket.io-client';
import {
  Building2,
  RotateCcw,
  Send,
} from 'lucide-react';

import { useStore, PHASE } from './store/index.js';
import TavusAvatar from './components/TavusAvatar';
import IdleScreen from './components/IdleScreen';
import Dashboard from './components/Dashboard';
import ReasoningTrace from './components/ReasoningTrace';
import MemoColumn from './components/MemoColumn';
import MayaQAPanel from './components/MayaQAPanel';
import './index.css';
import { API_BASE, DEFLECT_SCRIPT } from './config.js';

const BACKEND_URL = API_BASE || window.location.origin;

// Persist socket across React StrictMode remounts
let sharedSocket = null;

const PERSONAS = [
  { id: 'store_manager', name: 'Store Manager', color: '#c97a7a' },
  { id: 'merchandiser', name: 'Merchandiser', color: '#7a9de0' },
  { id: 'regional_vp', name: 'Regional VP', color: '#52b8a8' },
];

function App() {
  const [query, setQuery] = useState('');
  const draftPrompt = useCallback((text) => setQuery(text), []);
  const [showPersonaMenu, setShowPersonaMenu] = useState(false);
  const [avatarStatus, setAvatarStatus] = useState('idle');

  // Store state
  const phase = useStore((s) => s.phase);
  const socket = useStore((s) => s.socket);
  const sessionId = useStore((s) => s.sessionId);
  const persona = useStore((s) => s.persona);
  const loading = useStore((s) => s.loading);
  const tavusUrl = useStore((s) => s.tavusConversationUrl);
  const tavusConversationId = useStore((s) => s.tavusConversationId);
  const tavusLoading = useStore((s) => s.tavusLoading);
  const tavusError = useStore((s) => s.tavusError);
  const tavusReplicaLabel = useStore((s) => s.tavusReplicaLabel);
  const tavusAgentType = useStore((s) => s.tavusAgentType);
  const tavusAgentName = useStore((s) => s.tavusAgentName);
  const tavusSwitching = useStore((s) => s.tavusSwitching);
  const tavusIsSwitch = useStore((s) => s.tavusIsSwitch);
  const suggestedPrompts = useStore((s) => s.suggestedPrompts);

  // Store actions
  const setSocket = useStore((s) => s.setSocket);
  const setSessionId = useStore((s) => s.setSessionId);
  const setPersona = useStore((s) => s.setPersona);
  const setSuggestedPrompts = useStore((s) => s.setSuggestedPrompts);
  const setTavusSession = useStore((s) => s.setTavusSession);
  const setTavusLoading = useStore((s) => s.setTavusLoading);
  const setCallObject = useStore((s) => s.setCallObject);
  const processRouting = useStore((s) => s.processRouting);
  const processStep = useStore((s) => s.processStep);
  const processResponse = useStore((s) => s.processResponse);
  const initTavus = useStore((s) => s.initTavus);
  const endTavus = useStore((s) => s.endTavus);
  const sendQuery = useStore((s) => s.sendQuery);
  const askQA = useStore((s) => s.askQA);
  const askFreeform = useStore((s) => s.askFreeform);
  const setQAAnswer = useStore((s) => s.setQAAnswer);
  const showDeflect = useStore((s) => s.showDeflect);
  const sendInterruptAndClear = useStore((s) => s.sendInterruptAndClear);
  const reset = useStore((s) => s.reset);
  const addToSpeechQueue = useStore((s) => s.addToSpeechQueue);
  const onAvatarStoppedSpeaking = useStore((s) => s.onAvatarStoppedSpeaking);

  // Initialize socket connection (singleton — avoids StrictMode disconnect ending sessions)
  useEffect(() => {
    if (!sharedSocket) {
      sharedSocket = io(BACKEND_URL, {
        transports: ['polling', 'websocket'],
        upgrade: true,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      sharedSocket.on('connect', () => {
        console.log('[Socket] Connected, id:', sharedSocket.id);
      });

      sharedSocket.on('connect_error', (err) => {
        console.error('[Socket] Connection error:', err);
      });

      sharedSocket.on('connected', (data) => {
        setSessionId(data.session_id);
        console.log('[Socket] Session ID set:', data.session_id);
      });

      sharedSocket.on('tavus_session', (data) => {
        console.log('[App] Tavus session received:', data);
        setTavusSession(data.conversationId, data.conversationUrl);
      });

      sharedSocket.on('tavus_fallback', (data) => {
        console.log('[App] Tavus fallback:', data);
        setTavusLoading(false);
      });

      sharedSocket.on('tavus_error', (data) => {
        console.log('[App] Tavus error:', data);
        setTavusLoading(false);
      });

      sharedSocket.on('routing', (data) => {
        console.log('Routing:', data);
        processRouting(data);
      });

      sharedSocket.on('reasoning_step', (step) => {
        processStep(step);
      });

      sharedSocket.on('error', (data) => {
        console.error('Socket error:', data);
        if (data?.message) {
          useStore.setState({ loading: false, phase: PHASE.IDLE });
        }
      });

      sharedSocket.on('qa_answer', (data) => {
        console.log('[Socket] qa_answer:', data.questionId);
        setQAAnswer(data.questionId, data.answer);
        sendInterruptAndClear(data.script);
      });

      sharedSocket.on('freeform_deflect', () => {
        console.log('[Socket] freeform_deflect');
        showDeflect();
        sendInterruptAndClear(DEFLECT_SCRIPT);
      });
    }

    setSocket(sharedSocket);
  }, []);

  useEffect(() => {
    if (!tavusUrl) setAvatarStatus('idle');
  }, [tavusUrl]);

  // Fetch suggested prompts when persona changes
  useEffect(() => {
    fetch(`${BACKEND_URL}/api/suggested-prompts?persona=${persona.id}`)
      .then((res) => res.json())
      .then((data) => setSuggestedPrompts(data.prompts || []))
      .catch(console.error);
  }, [persona.id]);

  // Handle call ready - greet user
  const bindCallFromStore = useStore((s) => s.bindCallFromStore);

  // Clear switch flag after use
  const clearSwitchFlag = useCallback(() => {
    useStore.setState({ tavusIsSwitch: false });
  }, []);

  const handleCallReady = useCallback((call) => {
    console.log('[App] Call object ready, agent:', tavusAgentType, 'isSwitch:', tavusIsSwitch);
    setCallObject(call);
    bindCallFromStore(call);

    // Skip greeting if this is a switch (avatar will speak the verdict instead)
    if (tavusIsSwitch) {
      console.log('[App] Skipping greeting - this is an agent switch');
      clearSwitchFlag();
      return;
    }

    // Agent-specific greetings for initial connection
    const greetings = {
      diagnostics: "Hi, I'm your Diagnostics Analyst. I help you understand why stores are underperforming. " +
        "Ask me about traffic drops, conversion issues, or category performance — I'll break down exactly what's driving your variance.",
      forecast: "Hello, I'm your Forecast Analyst. I specialize in projecting sales and identifying demand drivers. " +
        "Ask me about upcoming trends, seasonal projections, or what-if scenarios for your categories.",
      store_comparison: "Hi there, I'm your Store Comparison Analyst. I help you benchmark stores against their peers. " +
        "Ask me how any store stacks up in its cluster, or why certain locations outperform others.",
    };

    const greeting = greetings[tavusAgentType] || greetings.diagnostics;

    setTimeout(() => {
      addToSpeechQueue(greeting);
    }, 2000);
  }, [addToSpeechQueue, setCallObject, bindCallFromStore, tavusAgentType, tavusIsSwitch, clearSwitchFlag]);

  const handleSessionEnded = useCallback(() => {
    console.warn('[App] Tavus session ended — resetting');
    endTavus();
  }, [endTavus]);

  // Handle user voice query from Tavus - route to backend for analysis
  // IMPORTANT: Interrupt Tavus auto-response immediately, let our backend handle it
  const sendInterrupt = useStore((s) => s.sendInterrupt);

  const handleUserUtterance = useCallback((text) => {
    if (!text?.trim()) return;
    console.log('[App] User voice query received:', text.slice(0, 80));

    // Immediately interrupt Tavus auto-response - we'll handle this ourselves
    sendInterrupt();

    // Route voice query to backend - it will return analysis with synced metrics
    sendQuery(text.trim(), { fromVoice: false }); // fromVoice: false so we DO echo our response
  }, [sendQuery, sendInterrupt]);

  // Handle submit
  const handleSubmit = (e) => {
    e.preventDefault();
    if (query.trim()) {
      askFreeform(query.trim());
      setQuery('');
    }
  };

  const PROMPT_TO_QA = {
    'Why is Store 0214 down?': 'store_0214_down',
    'What is the 12-week Apparel forecast?': 'apparel_forecast',
    'How does Store 0142 stack up against its peers?': 'store_0142_peers',
  };

  const isWorkspace = phase === PHASE.RUNNING || phase === PHASE.COMPLETE;

  return (
    <div className="app">
      {/* Navbar */}
      <nav className="app-nav">
        <div className="app-logo">
          Bealls <span>Sales Command Center</span>
        </div>
        <div className="nav-divider" />
        <div className="nav-store">
          <Building2 size={12} />
          500 stores · F64 Fabric
        </div>
        <div className="nav-right">
          <div
            className="nav-persona"
            onClick={() => setShowPersonaMenu(!showPersonaMenu)}
          >
            <div className="nav-persona-dot" style={{ background: persona.color }} />
            {persona.name}
            {showPersonaMenu && (
              <div className="persona-selector">
                {PERSONAS.map((p) => (
                  <div
                    key={p.id}
                    className={`persona-option ${p.id === persona.id ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setPersona(p);
                      setShowPersonaMenu(false);
                    }}
                  >
                    <div className="nav-persona-dot" style={{ background: p.color }} />
                    {p.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          {isWorkspace && (
            <button className="reset-btn" onClick={reset}>
              <RotateCcw size={14} />
              Reset
            </button>
          )}

          <div className="timer-chip">
            <span className="timer-live">●</span>
            LIVE
          </div>
        </div>
      </nav>

      {/* Main Body */}
      <div className="app-body">
        {/* Left Panel - Always visible (Avatar) */}
        <div className="left-panel">
          <div className="avatar-wrap">
            <TavusAvatar
              key={tavusConversationId || 'idle'}
              conversationUrl={tavusUrl}
              conversationId={tavusConversationId}
              replicaLabel={tavusReplicaLabel}
              onCallReady={handleCallReady}
              onSpeakingDone={onAvatarStoppedSpeaking}
              onStatusChange={setAvatarStatus}
              onSessionEnded={handleSessionEnded}
              onUserUtterance={handleUserUtterance}
            />
          </div>

          {/* Tavus Controls */}
          <div className="tavus-controls">
            {tavusError && (
              <p className="tavus-error" style={{ fontSize: 10, color: 'var(--red)', marginBottom: 6 }}>
                {tavusError}
              </p>
            )}
            {tavusSwitching && (
              <p style={{ fontSize: 10, color: 'var(--blue)', marginBottom: 6 }}>
                Switching to {tavusAgentName || 'new agent'}...
              </p>
            )}
            {tavusAgentName && avatarStatus === 'live' && (
              <p style={{ fontSize: 10, color: 'var(--green)', marginBottom: 6 }}>
                Active: {tavusAgentName}
              </p>
            )}
            {!tavusUrl ? (
              <button
                className="tavus-btn active"
                onClick={() => {
                  console.log('[App] Start Bealls Analyst clicked');
                  initTavus('diagnostics');
                }}
                disabled={tavusLoading}
              >
                {tavusLoading ? 'Starting...' : 'Start Analyst'}
              </button>
            ) : avatarStatus !== 'live' ? (
              <button className="tavus-btn" disabled>
                {avatarStatus === 'error' ? 'Connection failed' : 'Connecting to analyst...'}
              </button>
            ) : (
              <button className="tavus-btn end" onClick={endTavus} disabled={tavusSwitching}>
                End Session
              </button>
            )}
          </div>

          {/* Reasoning Trace - only in workspace */}
          {isWorkspace && <ReasoningTrace />}
        </div>

        {/* Right area - Idle or Workspace */}
        <div className="main-area">
          {phase === PHASE.IDLE ? (
            <IdleScreen onDraftPrompt={draftPrompt} />
          ) : (
            <div className="workspace">
              {/* Center - Dashboard */}
              <div className="center-panel">
                <Dashboard />
              </div>

              {/* Right - Memo/Findings */}
              <div className="right-panel">
                <MemoColumn />
              </div>
            </div>
          )}

          {/* Chat Input - always at bottom */}
          <div className="chat-input-wrap">
            <MayaQAPanel />
            <form className="chat-input" onSubmit={handleSubmit}>
              <input
                type="text"
                placeholder="Ask the analyst anything (pilot QR)..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                disabled={loading}
              />
              <button type="submit" disabled={loading || !query.trim()}>
                {loading ? <div className="loading-spinner" /> : <Send size={14} />}
              </button>
            </form>
            {phase === PHASE.IDLE && suggestedPrompts.length > 0 && (
              <div className="suggested-prompts">
                {suggestedPrompts.slice(0, 3).map((prompt, i) => (
                  <button
                    key={i}
                    className="suggested-prompt"
                    onClick={() => {
                      const qaId = PROMPT_TO_QA[prompt.text];
                      if (qaId) askQA(qaId);
                      else sendQuery(prompt.text);
                    }}
                  >
                    {prompt.text}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
