/**
 * Tavus CVI + Daily.co — echo-first (Digital Credit Officer pattern).
 * All demo speech uses conversation.echo; respond kept for optional use only.
 */

let callObject = null;
let conversationId = null;
let conversationUrl = null;

function buildInteraction(eventType, properties = {}) {
  return {
    message_type: 'conversation',
    event_type: eventType,
    conversation_id: conversationId,
    ...(Object.keys(properties).length ? { properties } : {}),
  };
}

export function bindCall(call, convId) {
  if (call) callObject = call;
  if (convId) conversationId = convId;
}

export function ensureConversation(id) {
  if (id) conversationId = id;
}

export function isCallJoined() {
  return !!(
    callObject &&
    conversationId &&
    typeof callObject.meetingState === 'function' &&
    callObject.meetingState() === 'joined-meeting'
  );
}

export function getCallObject() {
  return callObject;
}

export function sendEchoMessage(text) {
  if (!text?.trim() || !isCallJoined()) {
    console.warn('[Tavus] Echo skipped', { conversationId, joined: isCallJoined() });
    return false;
  }
  try {
    const payload = buildInteraction('conversation.echo', {
      modality: 'text',
      text: text.trim(),
      done: true,
    });
    const ret = callObject.sendAppMessage(payload, '*');
    console.log('[Tavus] Echo sent:', text.substring(0, 80), 'ret:', ret);
    return true;
  } catch (err) {
    console.error('[Tavus] Echo error:', err);
    return false;
  }
}

export function sendRespondMessage(text) {
  if (!text?.trim() || !isCallJoined()) {
    console.warn('[Tavus] Respond skipped', { conversationId, joined: isCallJoined() });
    return false;
  }
  try {
    const payload = buildInteraction('conversation.respond', { text: text.trim() });
    const ret = callObject.sendAppMessage(payload, '*');
    console.log('[Tavus] Respond sent:', text.substring(0, 80), 'ret:', ret);
    return true;
  } catch (err) {
    console.error('[Tavus] Respond error:', err);
    return false;
  }
}

export function sendInterruptMessage() {
  if (!isCallJoined()) return false;
  try {
    callObject.sendAppMessage(buildInteraction('conversation.interrupt'), '*');
    return true;
  } catch (err) {
    return false;
  }
}

/** User question → respond (Tavus app). Backend verdict → echo (exact script). */
export function speakUserQuery(query) {
  return sendRespondMessage(query);
}

export function speakVerdict(verdict) {
  if (!verdict?.trim()) return false;
  if (sendEchoMessage(verdict)) return true;
  return sendRespondMessage(verdict);
}

export function speakText(text, { mode = 'respond' } = {}) {
  if (!text?.trim()) return false;
  if (mode === 'echo') return sendEchoMessage(text) || sendRespondMessage(text);
  return sendRespondMessage(text) || sendEchoMessage(text);
}

export function joinConversation(url, convId, Daily) {
  if (!url || !convId) {
    return Promise.reject(new Error('conversation URL and ID required'));
  }

  if (!callObject) {
    callObject = Daily.getCallInstance() || Daily.createCallObject({
      subscribeToTracksAutomatically: true,
      dailyConfig: { experimentalChromeVideoMuteLightOff: true },
    });
  }

  conversationUrl = url;
  conversationId = convId;

  const state = callObject.meetingState();
  if (state === 'joined-meeting') return Promise.resolve(callObject);
  if (state === 'joining-meeting') return waitForJoined(callObject);

  return new Promise((resolve, reject) => {
    const onJoined = () => {
      callObject.off('joined-meeting', onJoined);
      callObject.off('error', onError);
      resolve(callObject);
    };
    const onError = (ev) => {
      callObject.off('joined-meeting', onJoined);
      callObject.off('error', onError);
      reject(ev?.error || ev || new Error('Daily error'));
    };
    callObject.on('joined-meeting', onJoined);
    callObject.on('error', onError);
    callObject.join({ url, startVideoOff: true, startAudioOff: true }).catch(reject);
  });
}

function waitForJoined(call) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Join timeout')), 45000);
    const onJoined = () => {
      clearTimeout(timer);
      call.off('error', onError);
      resolve(call);
    };
    const onError = (ev) => {
      clearTimeout(timer);
      call.off('joined-meeting', onJoined);
      reject(ev?.error || ev);
    };
    call.on('joined-meeting', onJoined);
    call.on('error', onError);
  });
}

export async function leaveConversation() {
  const call = callObject;
  conversationId = null;
  conversationUrl = null;
  callObject = null;
  if (!call) return;
  try {
    if (['joined-meeting', 'joining-meeting'].includes(call.meetingState())) {
      await call.leave();
    }
    call.destroy();
  } catch {
    /* ignore */
  }
}
