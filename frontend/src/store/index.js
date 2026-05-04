import { create } from 'zustand';

export const PHASE = {
  LANDING: 'landing',
  IDLE: 'idle',
  RUNNING: 'running',
  COMPLETE: 'complete',
};

const DEFLECT_SCRIPT =
  "Good question. Let me grab my notes. Actually — let's set up a real conversation. Scan the QR code and we'll dig in.";

const initialState = {
  phase: PHASE.LANDING,
  sessionId: null,
  socket: null,

  // Tavus
  tavusConversationUrl: null,
  tavusConversationId: null,
  callObject: null,        // Daily.js call object — set by TavusAvatar

  // Speech queue — narrations play in order, never overlap
  speechQueue: [],
  isSpeaking: false,

  // Reasoning trace
  traceLines: [],

  // Dashboard tiles
  tiles: {
    borrower: null,
    credit: null,
    industry: null,
    cashflow: null,
    collateral: null,
    risks: [],
  },

  // Memo
  memoText: '',

  // Stopwatch
  agentElapsed: 0,
  humanStopwatchRunning: false,

  // Post-completion
  memoComplete: false,
  activeScenario: null,

  // Q&A
  qaAnswer: null,
  showQRHighlight: false,

  // UI
  muted: false,
  micEnabled: false,
};

export const useStore = create((set, get) => ({
  ...initialState,

  // ── Connection ──────────────────────────────────────────────────────────────
  setSocket: (socket) => set({ socket }),
  setSessionId: (sessionId) => set({ sessionId }),

  // ── Tavus session ───────────────────────────────────────────────────────────
  setTavusSession: (conversationId, conversationUrl) =>
    set({ tavusConversationId: conversationId, tavusConversationUrl: conversationUrl }),

  // Set by TavusAvatar once the Daily call object is joined and ready
  setCallObject: (callObject) => set({ callObject }),

  // ── Low-level Tavus interactions ────────────────────────────────────────────

  // Speak exact text verbatim — bypasses LLM
  _echoNow: (text) => {
    const { callObject, tavusConversationId } = get();
    if (!callObject || !text) return;
    callObject.sendAppMessage({
      message_type: 'conversation',
      event_type: 'conversation.echo',
      conversation_id: tavusConversationId,
      properties: { text },
    });
  },

  // Stop avatar speech immediately
  sendInterrupt: () => {
    const { callObject, tavusConversationId } = get();
    if (!callObject) return;
    callObject.sendAppMessage({
      message_type: 'conversation',
      event_type: 'conversation.interrupt',
      conversation_id: tavusConversationId,
      properties: {},
    });
  },

  // Route text through the Tavus LLM (uses RAG docs + context) — for freeform
  sendRespond: (text) => {
    const { callObject, tavusConversationId } = get();
    if (!callObject || !text) return;
    callObject.sendAppMessage({
      message_type: 'conversation',
      event_type: 'conversation.respond',
      conversation_id: tavusConversationId,
      properties: { text },
    });
  },

  // ── Speech queue ────────────────────────────────────────────────────────────

  // Add narration to queue — plays when avatar finishes the previous one
  addToSpeechQueue: (text) => {
    if (!text) return;
    const { isSpeaking } = get();
    set((state) => ({ speechQueue: [...state.speechQueue, text] }));
    if (!isSpeaking) {
      get()._drainQueue();
    }
  },

  _drainQueue: () => {
    const { speechQueue } = get();
    if (speechQueue.length === 0) return;
    const [next, ...rest] = speechQueue;
    set({ speechQueue: rest, isSpeaking: true });
    get()._echoNow(next);
  },

  // Called by TavusAvatar when avatar stops speaking — advances the queue
  onAvatarStoppedSpeaking: () => {
    set({ isSpeaking: false });
    get()._drainQueue();
  },

  // Interrupt speech, wipe the queue, then say something immediately
  sendInterruptAndClear: (text) => {
    get().sendInterrupt();
    set({ speechQueue: [], isSpeaking: false });
    if (text) {
      // Small gap so the interrupt registers before the echo fires
      setTimeout(() => {
        set({ isSpeaking: true });
        get()._echoNow(text);
      }, 300);
    }
  },

  // ── Start conversation (landing → idle, triggers Tavus session creation) ────
  startConversation: () => {
    const { socket } = get();
    if (socket) socket.emit('init_tavus');
    set({ phase: PHASE.IDLE });
  },

  // ── Start demo ──────────────────────────────────────────────────────────────
  startDemo: () => {
    const { socket } = get();
    if (!socket) return;
    set({
      phase: PHASE.RUNNING,
      traceLines: [],
      tiles: { borrower: null, credit: null, industry: null, cashflow: null, collateral: null, risks: [] },
      memoText: '',
      agentElapsed: 0,
      memoComplete: false,
      activeScenario: null,
      qaAnswer: null,
      showQRHighlight: false,
      humanStopwatchRunning: true,
      speechQueue: [],
      isSpeaking: false,
    });
    socket.emit('start');
  },

  // ── Process incoming step ───────────────────────────────────────────────────
  processStep: (frame) => {
    const { stepIndex, traceText, tileKey, memoChunk, data } = frame;

    set((state) => {
      const lines = state.traceLines.map((l) =>
        l.status === 'active' ? { ...l, status: 'done' } : l
      );
      lines.push({ text: traceText, status: 'active', index: stepIndex });
      return { traceLines: lines };
    });

    if (tileKey && tileKey !== 'complete' && data) {
      const updates = {};

      if (tileKey === 'borrower') {
        updates.tiles = {
          ...get().tiles,
          borrower: {
            name: data.borrower.legalName,
            owner: data.borrower.owner,
            years: data.borrower.yearsInBusiness,
            veteran: data.borrower.ownerVeteran,
            employees: data.borrower.employees,
            locations: data.borrower.currentLocations,
          },
        };
      } else if (tileKey === 'credit') {
        updates.tiles = {
          ...get().tiles,
          credit: {
            fico: data.credit.personalFico,
            paydex: data.credit.businessPaydex,
            intelliscore: data.credit.businessIntelliscore,
          },
        };
      } else if (tileKey === 'industry') {
        updates.tiles = {
          ...get().tiles,
          industry: {
            naics: data.borrower.naics,
            cagr: data.industry.fiveYearCagr,
            outlook: data.industry.outlook,
          },
        };
      } else if (tileKey === 'cashflow') {
        updates.tiles = {
          ...get().tiles,
          cashflow: {
            dscr: data.financials.dscr,
            floor: data.financials.dscrBankFloor,
            revenue: data.financials.revenue2024,
            ebitda: data.financials.ebitda2024,
          },
        };
      } else if (tileKey === 'collateral') {
        updates.tiles = {
          ...get().tiles,
          collateral: {
            coverage: data.collateral.loanCoverageRatio,
            total: data.collateral.totalAdvanceValue,
            loan: data.loan.amount,
          },
        };
      } else if (['risk_concentration', 'risk_tariff', 'risk_collateral'].includes(tileKey)) {
        const riskMap = { risk_concentration: 0, risk_tariff: 1, risk_collateral: 2 };
        const newRisks = [...get().tiles.risks];
        newRisks.push(data.risks[riskMap[tileKey]]);
        updates.tiles = { ...get().tiles, risks: newRisks };
      }

      if (Object.keys(updates).length > 0) set(updates);
    }

    if (memoChunk) {
      set((state) => ({ memoText: state.memoText + memoChunk }));
    }

    if (tileKey === 'complete') {
      set((state) => ({
        traceLines: state.traceLines.map((l) =>
          l.status === 'active' ? { ...l, status: 'done' } : l
        ),
      }));
    }
  },

  // ── Memo complete ───────────────────────────────────────────────────────────
  setMemoComplete: () => set({ memoComplete: true, phase: PHASE.COMPLETE }),

  // ── Scenario ────────────────────────────────────────────────────────────────
  applyScenario: (scenario) => set({ activeScenario: scenario, qaAnswer: null }),

  runScenario: (scenarioId) => {
    const { socket } = get();
    if (socket) socket.emit('scenario', { scenarioId });
  },

  // ── Q&A ─────────────────────────────────────────────────────────────────────
  setQAAnswer: (questionId, answer) => set({ qaAnswer: { questionId, answer } }),

  askQA: (questionId) => {
    const { socket } = get();
    if (socket) socket.emit('qa', { questionId });
  },

  // ── Freeform ────────────────────────────────────────────────────────────────
  showDeflect: () => set({ showQRHighlight: true }),

  askFreeform: (text) => {
    const { socket } = get();
    if (socket) socket.emit('freeform', { text });
  },

  // ── Reset ───────────────────────────────────────────────────────────────────
  reset: () => {
    const { socket, muted, callObject, tavusConversationUrl, tavusConversationId } = get();
    if (socket) socket.emit('reset');
    if (callObject && tavusConversationId) {
      callObject.sendAppMessage({
        message_type: 'conversation',
        event_type: 'conversation.interrupt',
        conversation_id: tavusConversationId,
        properties: {},
      });
    }
    // Mic off on reset
    if (callObject) callObject.setLocalAudio(false);
    // Preserve the live Tavus session — avatar stays connected for next run
    set({
      ...initialState,
      phase: PHASE.IDLE,
      socket,
      muted,
      callObject,
      tavusConversationUrl,
      tavusConversationId,
    });
  },

  // ── Mute ────────────────────────────────────────────────────────────────────
  toggleMute: () => set((state) => ({ muted: !state.muted })),

  // ── Mic ─────────────────────────────────────────────────────────────────────
  toggleMic: () => {
    const { callObject, micEnabled } = get();
    const next = !micEnabled;
    set({ micEnabled: next });
    if (callObject) callObject.setLocalAudio(next);
  },

  // ── Stopwatch ───────────────────────────────────────────────────────────────
  tickAgent: () => set((state) => ({ agentElapsed: state.agentElapsed + 1 })),

  // ── Internal deflect text (used by websocket hook) ──────────────────────────
  DEFLECT_SCRIPT,
}));
