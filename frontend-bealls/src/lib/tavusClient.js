/**
 * Tavus CVI + Daily.co — echo-first (Digital Credit Officer pattern).
 * Always creates a fresh Daily call object (never reuse getCallInstance — stale Quadrant video).
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

/** Tear down every Daily singleton so the next join cannot show a previous replica. */
async function destroyAllDailyCalls(Daily) {
  const instances = [];
  const singleton = Daily.getCallInstance?.();
  if (singleton) instances.push(singleton);
  if (callObject && !instances.includes(callObject)) instances.push(callObject);

  for (const call of instances) {
    try {
      const state = call.meetingState?.();
      if (state === 'joined-meeting' || state === 'joining-meeting') {
        await call.leave();
      }
      call.destroy();
    } catch (err) {
      console.warn('[Tavus] destroy call:', err);
    }
  }

  callObject = null;
  conversationId = null;
  conversationUrl = null;
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

export function speakVerdict(verdict) {
  if (!verdict?.trim()) return false;
  return sendEchoMessage(verdict);
}

export function speakText(text, { mode = 'echo' } = {}) {
  if (!text?.trim()) return false;
  if (mode === 'echo') return sendEchoMessage(text);
  return sendRespondMessage(text);
}

export async function joinConversation(url, convId, Daily) {
  if (!url || !convId) {
    throw new Error('conversation URL and ID required');
  }

  const sameRoom =
    conversationUrl === url &&
    conversationId === convId &&
    callObject?.meetingState?.() === 'joined-meeting';

  if (sameRoom) {
    console.log('[Tavus] Already in room', convId);
    return callObject;
  }

  console.log('[Tavus] Joining new room', { convId, url: url.slice(0, 60) + '...' });
  await destroyAllDailyCalls(Daily);

  callObject = Daily.createCallObject({
    subscribeToTracksAutomatically: true,
    dailyConfig: { experimentalChromeVideoMuteLightOff: true },
  });

  conversationUrl = url;
  conversationId = convId;

  return new Promise((resolve, reject) => {
    const onJoined = async () => {
      callObject.off('joined-meeting', onJoined);
      callObject.off('error', onError);
      console.log('[Tavus] joined-meeting', convId);

      resolve(callObject);
    };
    const onError = (ev) => {
      callObject.off('joined-meeting', onJoined);
      callObject.off('error', onError);
      reject(ev?.error || ev || new Error('Daily error'));
    };
    callObject.on('joined-meeting', onJoined);
    callObject.on('error', onError);
    // Keep audio off until user explicitly grants/enables mic.
    callObject.join({ url, startVideoOff: true, startAudioOff: true }).catch(reject);
  });
}

export async function leaveConversation(Daily) {
  if (Daily) {
    await destroyAllDailyCalls(Daily);
  } else {
    const call = callObject;
    callObject = null;
    conversationId = null;
    conversationUrl = null;
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
}
