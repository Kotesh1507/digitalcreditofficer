import { create } from 'zustand';
import {
  sendEchoMessage,
  sendInterruptMessage,
  isCallJoined,
  leaveConversation,
  ensureConversation,
  bindCall,
} from '../lib/tavusClient';
import { API_BASE } from '../config';
import { createSpeechActions } from './speechQueue.js';

export const PHASE = {
  LANDING: 'landing',
  IDLE: 'idle',
  RUNNING: 'running',
  COMPLETE: 'complete',
};

const initialTiles = {
  kpis: null,
  alerts: null,
  categories: null,
  waterfall: null,
  forecast: null,
  peers: null,
};

const initialState = {
  phase: PHASE.IDLE,
  sessionId: null,
  socket: null,
  persona: { id: 'store_manager', name: 'Store Manager', color: '#f05252' },

  // Tavus
  tavusConversationUrl: null,
  tavusConversationId: null,
  callObject: null,
  tavusLoading: false,
  tavusError: null,

  // Speech queue
  speechQueue: [],
  isSpeaking: false,

  // Reasoning trace
  traceLines: [],

  // Dashboard tiles - populated progressively
  tiles: { ...initialTiles },
  storeLabel: null,

  // Agent response
  agentId: null,
  agentName: null,
  verdict: null,
  findings: null,
  decomposition: null,
  drillDowns: null,

  // Suggested prompts
  suggestedPrompts: [],

  // Q&A (echo-only chips + freeform deflect)
  qaAnswer: null,
  showQRHighlight: false,

  // Loading
  loading: false,
};

export const useStore = create((set, get) => ({
  ...initialState,

  // Connection
  setSocket: (socket) => set({ socket }),
  setSessionId: (sessionId) => set({ sessionId }),
  setPersona: (persona) => set({ persona }),
  setSuggestedPrompts: (prompts) => set({ suggestedPrompts: prompts }),

  // Tavus session
  setTavusSession: (conversationId, conversationUrl) =>
    set({
      tavusConversationId: conversationId,
      tavusConversationUrl: conversationUrl,
      tavusLoading: false,
    }),
  setTavusLoading: (loading) => set({ tavusLoading: loading }),
  setCallObject: (callObject) => set({ callObject }),

  ...createSpeechActions(get, set, {
    sendEchoMessage,
    sendInterruptMessage,
    isCallJoined,
    ensureConversation,
    bindCall,
  }),

  _lastUserQuery: '',

  sendInterrupt: () => {
    get().interruptSpeech();
  },

  setQAAnswer: (questionId, answer) => set({ qaAnswer: { questionId, answer } }),
  showDeflect: () => set({ showQRHighlight: true }),

  askQA: (questionId) => {
    const { socket } = get();
    if (!socket) {
      set({ tavusError: 'Not connected to server. Refresh the page.' });
      return;
    }
    set({ qaAnswer: null, showQRHighlight: false, tavusError: null });
    socket.emit('qa', { questionId });
  },

  askFreeform: (text) => {
    const { socket } = get();
    if (!socket) {
      set({ tavusError: 'Not connected to server. Refresh the page.' });
      return;
    }
    set({ showQRHighlight: false, tavusError: null });
    socket.emit('freeform', { text: text?.trim() });
  },

  // Start Tavus - using REST API for reliability
  initTavus: async () => {
    console.log('[Store] initTavus called');
    set({ tavusLoading: true, tavusError: null });

    try {
      const response = await fetch(`${API_BASE}/api/tavus/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await response.json();
      console.log('[Store] Tavus init response:', data);

      const convId = data.conversationId || data.conversation_id;
      const convUrl = data.conversationUrl || data.conversation_url;

      if (!response.ok) {
        throw new Error(data.error || `Server error ${response.status}`);
      }

      if (convId && convUrl) {
        ensureConversation(convId);
        set({
          tavusConversationId: convId,
          tavusConversationUrl: convUrl,
          tavusLoading: false,
          tavusError: null,
        });
        console.log('[Store] Tavus session set:', convUrl);
      } else {
        throw new Error('No conversation returned from Tavus API');
      }
    } catch (error) {
      console.error('[Store] Tavus init error:', error);
      set({
        tavusLoading: false,
        tavusError: error.message || 'Failed to start Maya session',
      });
    }
  },

  // End Tavus
  endTavus: async () => {
    const { tavusConversationId } = get();
    await get().interruptSpeech();

    await leaveConversation();

    if (tavusConversationId) {
      try {
        await fetch(`${API_BASE}/api/tavus/end`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ conversation_id: tavusConversationId }),
        });
      } catch (err) {
        console.error('Tavus end error:', err);
      }
    }
    set({
      tavusConversationUrl: null,
      tavusConversationId: null,
      callObject: null,
      speechQueue: [],
      isSpeaking: false,
      tavusError: null,
      qaAnswer: null,
      showQRHighlight: false,
    });
  },

  /** Full orchestrator analysis — dashboard via REST; avatar speaks verdict via echo only */
  sendQuery: async (query) => {
    const q = query.trim();
    if (!q) return;

    console.log('[Store] sendQuery (analysis):', q);
    set({ _lastUserQuery: q, tavusError: null, qaAnswer: null, showQRHighlight: false });

    const call = get().callObject;
    if (call) get().bindCallFromStore(call);
    ensureConversation(get().tavusConversationId);

    if (!isCallJoined()) {
      set({ tavusError: 'Maya is not connected (no LIVE). Click Start Maya first.' });
    }

    set({
      phase: PHASE.RUNNING,
      loading: true,
      tiles: { ...initialTiles },
      traceLines: [],
      verdict: null,
      findings: null,
      decomposition: null,
      drillDowns: null,
      storeLabel: null,
    });

    const queryId = Date.now();
    get()._activeQueryId = queryId;
    await get()._sendQueryRest(q, queryId);
  },

  _activeQueryId: null,

  _sendQueryRest: async (query, queryId) => {
    const { sessionId, persona } = get();
    try {
      const response = await fetch(`${API_BASE}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          query,
          persona: persona.id,
        }),
      });
      const data = await response.json();
      if (get()._activeQueryId !== queryId) return;

      if (data.error) {
        set({ loading: false, phase: PHASE.IDLE });
        return;
      }
      get().processFullResponse(data);
    } catch (error) {
      console.error('[Store] Query REST error:', error);
      if (get()._activeQueryId === queryId) {
        set({ loading: false, phase: PHASE.IDLE });
      }
    }
  },

  // Process full response from REST API
  processFullResponse: (data) => {
    const result = data.result || {};
    const resp = result.response || {};
    const dashboard = resp.dashboard || {};
    const reasoningTrace = resp.reasoning_trace || [];

    console.log('[Store] Processing response, verdict:', resp.verdict);

    // Build narration from the response
    const narrations = [];

    // Add step narrations
    reasoningTrace.forEach((step, i) => {
      get().processStep({ action: step.action, status: 'done' });
    });

    // Update state
    set({
      loading: false,
      phase: PHASE.COMPLETE,
      agentId: result.agent_id || data.result?.routing?.agent,
      agentName: result.agent_name,
      verdict: resp.verdict,
      findings: resp.findings,
      decomposition: resp.decomposition,
      drillDowns: resp.drill_downs,
      storeLabel: dashboard.store_label,
      tiles: {
        kpis: dashboard.kpis,
        alerts: dashboard.alerts,
        categories: null,
        waterfall: null,
        forecast: null,
        peers: null,
      },
    });

    if (resp.verdict) {
      get().sendInterruptAndClear(resp.verdict);
    }
  },

  // Process routing info
  processRouting: (data) => {
    set({ agentId: data.agent, agentName: data.agent });
  },

  // Process reasoning step with progressive tile reveal
  processStep: (step) => {
    set((state) => {
      const lines = state.traceLines.map((l) =>
        l.status === 'active' ? { ...l, status: 'done' } : l
      );
      lines.push({ text: step.action, status: 'active' });
      return { traceLines: lines };
    });

    // Queue narration if present
    if (step.tavusNarration) {
      /* Socket steps disabled — verdict narrated once after REST */
    }

    // Populate tile if step has tile data
    if (step.tileKey && step.tileData) {
      set((state) => ({
        tiles: {
          ...state.tiles,
          [step.tileKey]: step.tileData,
        },
      }));
    }
  },

  // Process full response
  processResponse: (data) => {
    const resp = data.response || {};
    const dashboard = resp.dashboard || {};

    set((state) => ({
      loading: false,
      phase: PHASE.COMPLETE,
      agentId: data.agent_id,
      agentName: data.agent_name,
      verdict: resp.verdict,
      findings: resp.findings,
      decomposition: resp.decomposition,
      drillDowns: resp.drill_downs,
      storeLabel: dashboard.store_label,
      traceLines: state.traceLines.map((l) =>
        l.status === 'active' ? { ...l, status: 'done' } : l
      ),
      // If no progressive tiles were sent, fall back to full dashboard
      tiles: {
        kpis: state.tiles.kpis || dashboard.kpis,
        alerts: state.tiles.alerts || dashboard.alerts,
        categories: state.tiles.categories,
        waterfall: state.tiles.waterfall,
        forecast: state.tiles.forecast,
        peers: state.tiles.peers,
      },
    }));

    if (resp.verdict) {
      get().sendInterruptAndClear(resp.verdict);
    }
  },

  // Reset to idle
  reset: () => {
    const { socket, tavusConversationUrl, tavusConversationId, callObject, persona, sessionId, suggestedPrompts } = get();
    if (callObject && tavusConversationId) {
      get().sendInterrupt();
    }
    set({
      ...initialState,
      phase: PHASE.IDLE,
      socket,
      sessionId,
      persona,
      suggestedPrompts,
      tavusConversationUrl,
      tavusConversationId,
      callObject,
      qaAnswer: null,
      showQRHighlight: false,
    });
  },
}));
