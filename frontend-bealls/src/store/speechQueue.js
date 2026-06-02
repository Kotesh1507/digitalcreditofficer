/**
 * Tavus speech — echo-only pattern (Digital Credit Officer reference).
 * All avatar speech uses conversation.echo via interrupt + clear.
 */

export function createSpeechActions(get, set, deps) {
  const {
    sendEchoMessage,
    sendInterruptMessage,
    isCallJoined,
    ensureConversation,
    bindCall,
  } = deps;

  return {
    /** Speak exact text now (conversation.echo) */
    echoNow: (text) => {
      const line = text?.trim();
      if (!line) return false;
      ensureConversation(get().tavusConversationId);
      const call = get().callObject;
      if (call) bindCall(call, get().tavusConversationId);
      if (!isCallJoined()) {
        set({ tavusError: 'Analyst is not LIVE. Click Start Analyst first.' });
        return false;
      }
      const ok = sendEchoMessage(line);
      if (!ok) {
        set({ tavusError: 'Could not send speech to analyst. Try End Session → Start Analyst.' });
      } else {
        set({ tavusError: null });
      }
      return ok;
    },

    addToSpeechQueue: (text) => {
      const line = text?.trim();
      if (!line) return;
      set((state) => ({ speechQueue: [...state.speechQueue, line] }));
      if (!get().isSpeaking) {
        get()._drainSpeechQueue();
      }
    },

    _drainSpeechQueue: () => {
      const { speechQueue } = get();
      if (speechQueue.length === 0) return;
      const [next, ...rest] = speechQueue;
      set({ speechQueue: rest, isSpeaking: true });
      get().echoNow(next);
    },

    onAvatarStoppedSpeaking: () => {
      set({ isSpeaking: false });
      get()._drainSpeechQueue();
    },

    interruptSpeech: () => {
      ensureConversation(get().tavusConversationId);
      if (isCallJoined()) {
        sendInterruptMessage();
      }
    },

    /** Interrupt, clear queue, echo script (Q&A chips, deflect, verdict) */
    sendInterruptAndClear: (text) => {
      get().interruptSpeech();
      set({ speechQueue: [], isSpeaking: false });
      if (!text?.trim()) return;
      setTimeout(() => {
        set({ isSpeaking: true });
        get().echoNow(text);
      }, 300);
    },

    bindCallFromStore: (call) => {
      bindCall(call, get().tavusConversationId);
    },

    narrateVerdict: (verdict) => {
      get().sendInterruptAndClear(verdict);
    },
  };
}
