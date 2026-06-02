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
  persona: { id: 'store_manager', name: 'Store Manager', color: '#c97a7a' },

  // Tavus - multi-agent support
  tavusConversationUrl: null,
  tavusConversationId: null,
  callObject: null,
  tavusLoading: false,
  tavusError: null,
  tavusReplicaLabel: null,
  tavusAgentType: null,
  tavusAgentName: null,
  tavusSwitching: false,
  tavusIsSwitch: false,

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
  initTavus: async (agentType = 'diagnostics') => {
    console.log('[Store] initTavus called for agent:', agentType);
    set({ tavusLoading: true, tavusError: null });

    const Daily = (await import('@daily-co/daily-js')).default;
    await leaveConversation(Daily);
    set({ tavusConversationUrl: null, tavusConversationId: null, callObject: null });

    try {
      try {
        await fetch(`${API_BASE}/reset-tavus`, { method: 'POST' });
      } catch {
        /* backend may be down */
      }

      const response = await fetch(`${API_BASE}/api/tavus/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_type: agentType }),
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
          tavusReplicaLabel: data.replicaName || data.replica_name || null,
          tavusAgentType: data.agentType || agentType,
          tavusAgentName: data.agentName || null,
          tavusLoading: false,
          tavusError: null,
        });
        console.log('[Store] Tavus session:', {
          convId,
          agentType: data.agentType,
          agentName: data.agentName,
          personaId: data.personaId,
          replicaId: data.replicaId,
        });
      } else {
        throw new Error('No conversation returned from Tavus API');
      }
    } catch (error) {
      console.error('[Store] Tavus init error:', error);
      set({
        tavusLoading: false,
        tavusError: error.message || 'Failed to start Bealls Analyst session',
      });
    }
  },

  // Switch to a different Tavus agent
  switchTavusAgent: async (newAgentType) => {
    const { tavusConversationId, tavusAgentType } = get();

    if (newAgentType === tavusAgentType) {
      console.log('[Store] Already on agent:', newAgentType);
      return;
    }

    console.log('[Store] Switching Tavus agent from', tavusAgentType, 'to', newAgentType);
    set({ tavusSwitching: true, tavusError: null });

    const Daily = (await import('@daily-co/daily-js')).default;
    await leaveConversation(Daily);

    try {
      const response = await fetch(`${API_BASE}/api/tavus/switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_conversation_id: tavusConversationId,
          agent_type: newAgentType,
        }),
      });
      const data = await response.json();
      console.log('[Store] Tavus switch response:', data);

      if (!response.ok) {
        throw new Error(data.error || `Switch failed ${response.status}`);
      }

      const convId = data.conversationId || data.conversation_id;
      const convUrl = data.conversationUrl || data.conversation_url;

      if (convId && convUrl) {
        ensureConversation(convId);
        set({
          tavusConversationId: convId,
          tavusConversationUrl: convUrl,
          tavusReplicaLabel: data.replicaName || data.replica_name || null,
          tavusAgentType: data.agentType || newAgentType,
          tavusAgentName: data.agentName || null,
          tavusSwitching: false,
          tavusIsSwitch: true, // Flag to skip greeting on reconnect
          callObject: null,
        });
        console.log('[Store] Switched to agent:', data.agentType);
      } else {
        throw new Error('No conversation returned from switch');
      }
    } catch (error) {
      console.error('[Store] Tavus switch error:', error);
      set({
        tavusSwitching: false,
        tavusError: error.message || 'Failed to switch agent',
      });
    }
  },

  // End Tavus
  endTavus: async () => {
    const { tavusConversationId } = get();
    await get().interruptSpeech();

    const Daily = (await import('@daily-co/daily-js')).default;
    await leaveConversation(Daily);

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
      tavusAgentType: null,
      tavusAgentName: null,
      tavusSwitching: false,
      tavusIsSwitch: false,
      qaAnswer: null,
      showQRHighlight: false,
    });
  },

  /** Full orchestrator analysis — dashboard via REST; avatar speaks verdict via echo only */
  sendQuery: async (query, { fromVoice = false } = {}) => {
    const q = query.trim();
    if (!q) return;

    console.log('[Store] sendQuery (analysis):', q, fromVoice ? '(voice)' : '(typed)');
    set({ _lastUserQuery: q, _fromVoice: fromVoice, tavusError: null, qaAnswer: null, showQRHighlight: false });

    const call = get().callObject;
    if (call) get().bindCallFromStore(call);
    ensureConversation(get().tavusConversationId);

    if (!isCallJoined()) {
      set({ tavusError: 'Analyst is not connected (no LIVE). Click Start Analyst first.' });
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

  _fromVoice: false,

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

  // Process full response from REST API - SYNCED metrics and speech
  processFullResponse: async (data) => {
    const result = data.result || {};
    const resp = result.response || {};
    const dashboard = resp.dashboard || {};
    const reasoningTrace = resp.reasoning_trace || [];

    // Detect which agent was routed to
    const routedAgent = result.agent_id || data.result?.routing?.agent || result.routing?.agent;
    const currentAgent = get().tavusAgentType;
    const needsSwitch = routedAgent && routedAgent !== currentAgent && get().tavusConversationId;

    console.log('[Store] Processing response, agent:', routedAgent, 'current:', currentAgent);

    // STEP 1: Switch avatar FIRST if needed (before showing metrics)
    if (needsSwitch) {
      console.log('[Store] Switching avatar to match routed agent:', routedAgent);
      set({ loading: true }); // Keep loading state while switching
      await get().switchTavusAgent(routedAgent);
      // Wait for new avatar to connect
      await new Promise(resolve => setTimeout(resolve, 2500));
    }

    // STEP 2: Now show metrics and speak - SYNCED
    // First interrupt any existing speech
    get().sendInterrupt();

    // Add reasoning steps
    reasoningTrace.forEach((step) => {
      get().processStep({ action: step.action, status: 'done' });
    });

    // Populate all dashboard data
    set({
      loading: false,
      phase: PHASE.COMPLETE,
      agentId: routedAgent,
      agentName: result.agent_name,
      verdict: resp.verdict,
      findings: resp.findings,
      decomposition: resp.decomposition,
      drillDowns: resp.drill_downs,
      storeLabel: dashboard.store_label,
      tiles: {
        kpis: dashboard.kpis,
        alerts: dashboard.alerts,
        categories: dashboard.categories || null,
        waterfall: dashboard.waterfall || null,
        forecast: dashboard.forecast || null,
        peers: dashboard.peers || null,
      },
      _fromVoice: false,
    });

    // STEP 3: Speak AFTER metrics are rendered (small delay for render)
    if (resp.verdict) {
      await new Promise(resolve => setTimeout(resolve, 400));
      console.log('[Store] Speaking analysis (synced with visible metrics)');
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
