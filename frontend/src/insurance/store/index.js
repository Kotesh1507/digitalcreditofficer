import { create } from 'zustand';

export const PHASE = {
  LANDING: 'landing',
  IDLE:    'idle',
  RUNNING: 'running',
  COMPLETE: 'complete',
};

// Human underwriter pre-seeded at 6h 44m 12s = 24252 seconds
export const HUMAN_SEED = 6 * 3600 + 44 * 60 + 12;

const DEFLECT_SCRIPT =
  "Good question. For a deeper conversation, let's set this up properly — scan the QR code and we'll look at your submission together.";

const initialState = {
  phase: PHASE.LANDING,
  sessionId: null,
  socket: null,

  // Tavus
  tavusConversationUrl: null,
  tavusConversationId: null,
  callObject: null,

  // Speech queue
  speechQueue: [],
  isSpeaking: false,

  // Reasoning trace
  traceLines: [],

  // Dashboard tiles — insurance-specific keys
  tiles: {
    insured:    null,
    lossRatio:  null,
    catPml:     null,
    premium:    null,
    isoClass:   null,
    compliance: null,
    risks:      [],
  },

  // Memo
  memoText: '',

  // Stopwatch
  agentElapsed: 0,

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

export const useInsuranceStore = create((set, get) => ({
  ...initialState,

  // ── Connection ──────────────────────────────────────────────────────────────
  setSocket:    (socket)    => set({ socket }),
  setSessionId: (sessionId) => set({ sessionId }),

  // ── Tavus session ───────────────────────────────────────────────────────────
  setTavusSession: (conversationId, conversationUrl) =>
    set({ tavusConversationId: conversationId, tavusConversationUrl: conversationUrl }),

  setCallObject: (callObject) => set({ callObject }),

  // ── Low-level Tavus interactions ────────────────────────────────────────────
  _echoNow: (text) => {
    const { callObject, tavusConversationId } = get();
    if (!callObject || !text) return;
    // Guard: only send if Daily call is actually in joined state
    if (!window.__ariaJoined) {
      console.warn('[Store] _echoNow skipped — call not yet joined');
      return;
    }
    try {
      callObject.sendAppMessage({
        message_type:    'conversation',
        event_type:      'conversation.echo',
        conversation_id: tavusConversationId,
        properties:      { text },
      });
    } catch (e) {
      console.warn('[Store] sendAppMessage failed:', e.message);
    }
  },

  sendInterrupt: () => {
    const { callObject, tavusConversationId } = get();
    if (!callObject || !window.__ariaJoined) return;
    callObject.sendAppMessage({
      message_type:    'conversation',
      event_type:      'conversation.interrupt',
      conversation_id: tavusConversationId,
      properties:      {},
    });
  },

  sendRespond: (text) => {
    const { callObject, tavusConversationId } = get();
    if (!callObject || !text || !window.__ariaJoined) return;
    try { callObject.sendAppMessage({
      message_type:    'conversation',
      event_type:      'conversation.respond',
      conversation_id: tavusConversationId,
      properties:      { text },
    }); } catch (e) { console.warn('[Store] sendRespond failed:', e.message); }
  },

  // ── Speech queue ─────────────────────────────────────────────────────────────
  addToSpeechQueue: (text) => {
    if (!text) return;
    const { isSpeaking } = get();
    set((state) => ({ speechQueue: [...state.speechQueue, text] }));
    if (!isSpeaking) get()._drainQueue();
  },

  _drainQueue: () => {
    const { speechQueue } = get();
    if (speechQueue.length === 0) return;
    const [next, ...rest] = speechQueue;
    set({ speechQueue: rest, isSpeaking: true });
    get()._echoNow(next);
  },

  onAvatarStoppedSpeaking: () => {
    set({ isSpeaking: false });
    get()._drainQueue();
  },

  sendInterruptAndClear: (text) => {
    get().sendInterrupt();
    set({ speechQueue: [], isSpeaking: false });
    if (text) {
      setTimeout(() => {
        set({ isSpeaking: true });
        get()._echoNow(text);
      }, 300);
    }
  },

  // ── Start conversation (landing → idle) ─────────────────────────────────────
  // NOTE: do NOT emit init_tavus here — Tavus session is already created on
  // socket connect. Emitting again causes a second tavus_session event which
  // triggers a duplicate DailyIframe createCallObject error.
  startConversation: () => {
    set({ phase: PHASE.IDLE });
  },

  // ── Start demo ───────────────────────────────────────────────────────────────
  startDemo: () => {
    const { socket } = get();
    if (!socket?.connected) {
      console.warn('[Store] startDemo called but socket not connected');
      return;
    }
    set({
      phase: PHASE.RUNNING,
      traceLines: [],
      tiles: { insured: null, lossRatio: null, catPml: null, premium: null, isoClass: null, compliance: null, risks: [] },
      memoText: '',
      agentElapsed: 0,
      memoComplete: false,
      activeScenario: null,
      qaAnswer: null,
      showQRHighlight: false,
      speechQueue: [],
      isSpeaking: false,
    });
    console.log('[Store] Emitting start to backend');
    socket.emit('start');
  },

  // ── Process incoming step ────────────────────────────────────────────────────
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

      if (tileKey === 'insured') {
        updates.tiles = {
          ...get().tiles,
          insured: {
            name:      data.insuredProfile.legalName,
            principal: data.insuredProfile.principal.name,
            title:     data.insuredProfile.principal.title,
            years:     data.insuredProfile.yearsInBusiness,
            employees: data.insuredProfile.employees,
            naics:     data.insuredProfile.naics,
            isoClass:  data.insuredProfile.isoClass,
            city:      data.insuredProfile.locations[0].city,
            state:     data.insuredProfile.locations[0].state,
          },
        };
      } else if (tileKey === 'lossRatio') {
        updates.tiles = {
          ...get().tiles,
          lossRatio: {
            lr:         data.lossHistory.lossRatio,
            median:     data.lossHistory.industryMedianLR,
            floor:      data.lossHistory.carrierFloorLR,
            totalClaims: data.lossHistory.totalClaims,
            totalIncurred: data.lossHistory.totalIncurred,
          },
        };
      } else if (tileKey === 'catPml') {
        updates.tiles = {
          ...get().tiles,
          catPml: {
            pml:        data.catExposure.pml100yr,
            pmlPct:     data.catExposure.pml100yrPct,
            windZone:   data.catExposure.windZone,
            floodZone:  data.catExposure.floodZone,
            treaty:     data.catExposure.treatyAttachmentLimit,
            tiv:        data.coverageSought.commercialProperty.tiv,
          },
        };
      } else if (tileKey === 'premium') {
        updates.tiles = {
          ...get().tiles,
          premium: {
            total:     data.indicatedPremium.total,
            property:  data.indicatedPremium.property,
            gl:        data.indicatedPremium.generalLiability,
            im:        data.indicatedPremium.inlandMarine,
            fees:      data.indicatedPremium.feesAndEndorsements,
            requested: data.coverageSought.requestedPremium,
          },
        };
      } else if (tileKey === 'isoClass') {
        updates.tiles = {
          ...get().tiles,
          isoClass: {
            code:        data.insuredProfile.isoClass,
            description: data.insuredProfile.isoClassDescription,
            rateFactor:  data.indicatedPremium.isoRateFactor,
            baseRate:    data.indicatedPremium.isoBaseRate,
            dnbScore:    data.insuredProfile.dnb.score,
            dnbRating:   data.insuredProfile.dnb.rating,
            riskScore:   data.riskScore.overall,
          },
        };
      } else if (tileKey === 'compliance') {
        updates.tiles = {
          ...get().tiles,
          compliance: {
            ohDoi:  true,
            serff:  true,
            ofac:   true,
            form:   data.coverageSought.commercialProperty.form,
            state:  data.insuredProfile.locations[0].state,
          },
        };
      } else if (tileKey === 'risks') {
        // Accumulate risks — each step adds the next one
        const existing = get().tiles.risks || [];
        const newRisk = data.risks[existing.length];
        if (newRisk && !existing.find((r) => r.id === newRisk.id)) {
          updates.tiles = { ...get().tiles, risks: [...existing, newRisk] };
        }
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

  // ── Memo complete ────────────────────────────────────────────────────────────
  setMemoComplete: () => set({ memoComplete: true, phase: PHASE.COMPLETE }),

  // ── Scenario ─────────────────────────────────────────────────────────────────
  applyScenario: (scenario) => set({ activeScenario: scenario, qaAnswer: null }),

  runScenario: (scenarioId) => {
    const { socket } = get();
    if (socket) socket.emit('scenario', { scenarioId });
  },

  // ── Q&A ──────────────────────────────────────────────────────────────────────
  setQAAnswer: (questionId, answer) => set({ qaAnswer: { questionId, answer } }),

  askQA: (questionId) => {
    const { socket } = get();
    if (socket) socket.emit('qa', { questionId });
  },

  // ── Freeform ─────────────────────────────────────────────────────────────────
  showDeflect: () => set({ showQRHighlight: true }),

  askFreeform: (text) => {
    const { socket } = get();
    if (socket) socket.emit('freeform', { text });
  },

  // ── Reset ─────────────────────────────────────────────────────────────────────
  reset: () => {
    const { socket, muted, callObject, tavusConversationUrl, tavusConversationId } = get();
    if (socket) socket.emit('reset');
    if (callObject && tavusConversationId) {
      callObject.sendAppMessage({
        message_type:    'conversation',
        event_type:      'conversation.interrupt',
        conversation_id: tavusConversationId,
        properties:      {},
      });
    }
    if (callObject) callObject.setLocalAudio(false);
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

  // ── Mute / Mic ────────────────────────────────────────────────────────────────
  toggleMute: () => set((state) => ({ muted: !state.muted })),

  toggleMic: () => {
    const { callObject, micEnabled } = get();
    const next = !micEnabled;
    set({ micEnabled: next });
    if (!callObject) {
      console.warn('[Mic] No call object yet — mic will enable when Aria connects');
      return;
    }
    try {
      callObject.setLocalAudio(next);
      console.log(`[Mic] ${next ? 'ON — Aria can hear you' : 'OFF'}`);
    } catch (e) {
      console.warn('[Mic] setLocalAudio failed:', e.message);
    }
  },

  // ── Stopwatch ─────────────────────────────────────────────────────────────────
  tickAgent: () => set((state) => ({ agentElapsed: state.agentElapsed + 1 })),

  DEFLECT_SCRIPT,
}));
