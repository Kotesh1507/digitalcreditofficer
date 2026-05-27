"""
Digital Insurance Underwriting Officer - Flask Backend
--------------------------------------------------------
WebSocket (Socket.IO) session manager - drives the 21-step demo timeline
Tavus CVI integration - opens a live avatar session on socket connect
"""

import json
import os
import sys
import threading
import time
import uuid
from datetime import datetime

import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from flask_socketio import SocketIO, emit, join_room

load_dotenv(override=True)

app = Flask(__name__, static_folder='static', static_url_path='')
app.config['JSON_AS_ASCII'] = False   # emit Unicode as-is, not escaped \uXXXX
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="threading")

# ── Config ────────────────────────────────────────────────────────────────────
# Uses _INSURANCE suffixed env vars so both backends can coexist in the same
# ECS task without colliding on TAVUS_PERSONA_ID / TAVUS_REPLICA_ID.
TAVUS_API_KEY    = os.environ.get("TAVUS_API_KEY", "")
TAVUS_PERSONA_ID = os.environ.get("TAVUS_PERSONA_ID_INSURANCE", os.environ.get("TAVUS_PERSONA_ID", ""))
TAVUS_REPLICA_ID = os.environ.get("TAVUS_REPLICA_ID_INSURANCE", os.environ.get("TAVUS_REPLICA_ID", ""))
LEAD_CAPTURE_URL = os.environ.get("LEAD_CAPTURE_URL_INSURANCE", os.environ.get("LEAD_CAPTURE_URL", "https://yourdomain.com/insurance-pilot"))

DEFLECT_SCRIPT = (
    "Good question. For a deeper conversation, let's set this up properly - "
    "scan the QR code and we'll look at your submission together."
)

# ── Load static data ──────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(__file__)

with open(os.path.join(BASE_DIR, "insured.json"), "r", encoding="utf-8") as f:
    INSURED = json.load(f)

with open(os.path.join(BASE_DIR, "steps.json"), "r", encoding="utf-8") as f:
    STEPS = json.load(f)

# ── In-memory session store ───────────────────────────────────────────────────
SESSIONS = {}

# ── Global Tavus conversation (shared, reused across browser refreshes) ───────
GLOBAL_TAVUS = {
    "conversation_id":  None,
    "conversation_url": None,
    "lock": threading.Lock(),
    "creating": False,
}


# ─────────────────────────────────────────────────────────────────────────────
# Tavus helpers
# ─────────────────────────────────────────────────────────────────────────────

def build_tavus_context():
    """
    Builds the conversational_context string injected into the Tavus session.
    Contains all insured underwriting numbers so the avatar can reason live,
    answer freeform questions, and run stress tests without hallucinating.
    """
    p  = INSURED["insuredProfile"]
    cs = INSURED["coverageSought"]["commercialProperty"]
    gl = INSURED["coverageSought"]["generalLiability"]
    lh = INSURED["lossHistory"]
    cat = INSURED["catExposure"]
    pr = INSURED["indicatedPremium"]
    rs = INSURED["riskScore"]
    risks = INSURED["risks"]
    rec = INSURED["recommendation"]
    sc = INSURED["scenarios"]

    risk_lines = "\n".join(
        f"{i+1}. [{r['severity'].upper()} {r['confidence']}%] {r['title']}: {r['finding']} Mitigant: {r['mitigant']}"
        for i, r in enumerate(risks)
    )

    scenario_lines = "\n".join(
        f"{s['id']}: {s['label']} -> {s['recommendation']}. {s['memoOverride']}"
        for s in sc
    )

    return f"""You are the Memo Layer AI Underwriting Officer for Meridian Commercial Insurance Carriers.

You are a senior commercial P&C underwriter with 20 years of experience at Lloyd's syndicates and large regional carriers. Your voice is calm and authoritative - precise but not robotic. You use underwriting terminology naturally: TIV, PML, ISO class, NAICS, loss ratio, coinsurance, cat loading, treaty capacity, ACORD forms. When flagging a risk, your tone is matter-of-fact, never alarmist.

INSURED DATA - use these exact numbers in all responses:
Insured: {p['legalName']} | Principal: {p['principal']['name']}, {p['principal']['title']}
NAICS: {p['naics']} ({p['naicsDescription']}) | ISO Class: {p['isoClass']} ({p['isoClassDescription']})
Years in business: {p['yearsInBusiness']} | Employees: {p['employees']} | Revenue: ${p['annualRevenue']:,}
D&B Score: {p['dnb']['score']} | Rating: {p['dnb']['rating']}
Primary Location: {p['locations'][0]['address']}, {p['locations'][0]['city']}, {p['locations'][0]['state']} {p['locations'][0]['zip']}
Broker: {p['broker']} | Submission date: {p['submissionDate']}

COVERAGE SOUGHT:
Property TIV: ${cs['tiv']:,} | Construction: {cs['constructionType']} | Sprinklered: {cs['sprinklered']}
Year built: {cs['yearBuilt']} | Sq ft: {cs['squareFootage']:,} | FPC: {cs['fireProtectionClass']} | Form: {cs['form']}
GL: ${gl['perOccurrence']:,} per occ / ${gl['aggregate']:,} aggregate | Products: ${gl['productsCompleted']:,}
Inland Marine: ${INSURED['coverageSought']['inlandMarine']['scheduledEquipment']:,} scheduled equipment
Requested premium: ${INSURED['coverageSought']['requestedPremium']:,}

LOSS HISTORY (5-year):
Total claims: {lh['totalClaims']} | Total incurred: ${lh['totalIncurred']:,}
Loss ratio: {lh['lossRatio']} vs {lh['industryMedianLR']} industry median (carrier floor {lh['carrierFloorLR']})
LR is {round((1 - lh['lossRatio'] / lh['industryMedianLR']) * 100, 0):.0f}% below median - favorable
Claims: {'; '.join(f"{c['year']} {c['type']} ${c['incurred']:,} {c['status']}" for c in lh['claims'])}

CAT EXPOSURE:
Location: {cat['primaryLocation']} | Wind Zone: {cat['windZone']} | Flood Zone: {cat['floodZone']} | Seismic: {cat['seismic']}
1-in-100yr PML: ${cat['pml100yr']:,} ({cat['pml100yrPct']}% of TIV)
Treaty attachment: ${cat['treatyAttachmentLimit']:,} - within treaty: {cat['withinTreaty']}

INDICATED PREMIUM:
Property: ${pr['property']:,} | GL: ${pr['generalLiability']:,} | IM: ${pr['inlandMarine']:,} | Fees: ${pr['feesAndEndorsements']:,}
Total indicated: ${pr['total']:,} | ISO base rate: {pr['isoBaseRate']} | Rate factor: {pr['isoRateFactor']}
Coinsurance: {INSURED['coinsurance']['clause']} | Check: {INSURED['coinsurance']['check']}

RISK SCORE: {rs['overall']}/{rs['outOf']} - {rs['interpretation']}

THREE RISK FLAGS (all amber):
{risk_lines}

RECOMMENDATION: {rec['decision']}
Conditions:
{chr(10).join(f'  - {c}' for c in rec['bindingConditions'])}

STRESS SCENARIOS:
{scenario_lines}

BEHAVIOUR:
- Speak narration messages as your own analysis. No meta-commentary.
- For freeform questions: use the exact numbers above, show your reasoning.
- Keep narrations to 3-5 sentences. Freeform answers up to 8 sentences.
- Never invent numbers. Every figure must come from the data block above.
- When asked something outside this data, say: "{DEFLECT_SCRIPT}" """


def create_tavus_conversation():
    """Creates a new Tavus CVI session. Returns (conversation_id, conversation_url) or (None, None)."""
    if not TAVUS_API_KEY or not TAVUS_PERSONA_ID:
        print("[Tavus] API key or persona ID not set - avatar disabled")
        return None, None

    body = {
        "persona_id": TAVUS_PERSONA_ID,
        "conversational_context": build_tavus_context(),
        "properties": {
            "max_call_duration": 600,
            "participant_left_timeout": 30,
            "enable_recording": False,
        },
    }
    if TAVUS_REPLICA_ID:
        body["replica_id"] = TAVUS_REPLICA_ID

    try:
        res = requests.post(
            "https://tavusapi.com/v2/conversations",
            headers={"Content-Type": "application/json", "x-api-key": TAVUS_API_KEY},
            json=body,
            timeout=15,
        )
        res.raise_for_status()
        data = res.json()
        print(f"[Tavus] Conversation created: {data['conversation_id']}")
        return data["conversation_id"], data["conversation_url"]
    except requests.RequestException as e:
        detail = ""
        try:
            detail = e.response.text[:500]
        except Exception:
            pass
        print(f"[Tavus] Create failed: {e} | detail: {detail}", flush=True)
        return None, None


def end_tavus_conversation(conversation_id):
    """Ends a Tavus conversation."""
    if not TAVUS_API_KEY or not conversation_id:
        return
    try:
        requests.post(
            f"https://tavusapi.com/v2/conversations/{conversation_id}/end",
            headers={"x-api-key": TAVUS_API_KEY},
            timeout=10,
        )
        print(f"[Tavus] Conversation ended: {conversation_id}")
    except requests.RequestException as e:
        print(f"[Tavus] End error: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# Session helpers
# ─────────────────────────────────────────────────────────────────────────────

def get_session(session_id):
    return SESSIONS.get(session_id)


def clear_timers(session):
    for t in session.get("timers", []):
        t.cancel()
    session["timers"] = []


def emit_to_session(session_id, event, data):
    """Emit a Socket.IO event to a specific session room."""
    socketio.emit(event, data, room=session_id)


# ─────────────────────────────────────────────────────────────────────────────
# Demo timeline
# ─────────────────────────────────────────────────────────────────────────────

def fire_step(session_id, step):
    """
    Sends one step frame to the frontend.
    The frontend handles avatar speech via Daily.js interactions (conversation.echo).
    Runs in a background thread via threading.Timer.
    """
    session = get_session(session_id)
    if not session:
        return

    today = datetime.now().strftime("%B %d, %Y")

    memo_chunk = step.get("memoChunk")
    if memo_chunk:
        memo_chunk = memo_chunk.replace("{{date}}", today)

    emit_to_session(session_id, "step", {
        "stepIndex":      step["index"],
        "traceText":      step["traceText"],
        "tileKey":        step.get("tileKey"),
        "memoChunk":      memo_chunk,
        "tavusNarration": step.get("tavusNarration"),
        "avatarClipId":   step.get("avatarClipId"),
        "data":           INSURED,
    })


def fire_memo_complete(session_id):
    """Fires the memo_complete event after all steps finish."""
    if not get_session(session_id):
        return
    emit_to_session(session_id, "memo_complete", {})
    print(f"[Timeline] memo_complete -> session {session_id}")


def start_timeline(session_id):
    """Schedules all 21 steps with cumulative delays using threading.Timer."""
    session = get_session(session_id)
    if not session:
        return

    clear_timers(session)
    cumulative_delay = 0.0

    for step in STEPS:
        cumulative_delay += step["delayMs"] / 1000.0
        delay = cumulative_delay
        s = step
        t = threading.Timer(delay, fire_step, args=(session_id, s))
        t.daemon = True
        t.start()
        session["timers"].append(t)

    # Fire memo_complete 800ms after the last step
    complete_delay = cumulative_delay + 0.8
    tc = threading.Timer(complete_delay, fire_memo_complete, args=(session_id,))
    tc.daemon = True
    tc.start()
    session["timers"].append(tc)


# ─────────────────────────────────────────────────────────────────────────────
# Socket.IO events
# ─────────────────────────────────────────────────────────────────────────────

@socketio.on("connect")
def handle_connect():
    session_id = str(uuid.uuid4())
    SESSIONS[session_id] = {
        "sid": request.sid,
        "timers": [],
    }
    join_room(session_id)
    emit("connected", {"sessionId": session_id})
    print(f"[WS] New session: {session_id} (sid={request.sid})", flush=True)
    SESSIONS[f"sid:{request.sid}"] = session_id

    # Send existing global conversation immediately if available
    if GLOBAL_TAVUS["conversation_id"]:
        print(f"[Tavus] Reusing global conversation {GLOBAL_TAVUS['conversation_id']}", flush=True)
        emit("tavus_session", {
            "conversationId": GLOBAL_TAVUS["conversation_id"],
            "conversationUrl": GLOBAL_TAVUS["conversation_url"],
        })
        return

    # Otherwise create it in a thread (only once — lock prevents double creation)
    def _open_tavus():
        with GLOBAL_TAVUS["lock"]:
            # Double-check inside lock
            if GLOBAL_TAVUS["conversation_id"]:
                emit_to_session(session_id, "tavus_session", {
                    "conversationId": GLOBAL_TAVUS["conversation_id"],
                    "conversationUrl": GLOBAL_TAVUS["conversation_url"],
                })
                return
            if GLOBAL_TAVUS["creating"]:
                return
            GLOBAL_TAVUS["creating"] = True

        print(f"[Tavus] Creating global conversation...", flush=True)
        conversation_id, conversation_url = create_tavus_conversation()

        with GLOBAL_TAVUS["lock"]:
            GLOBAL_TAVUS["creating"] = False
            if conversation_id:
                GLOBAL_TAVUS["conversation_id"]  = conversation_id
                GLOBAL_TAVUS["conversation_url"] = conversation_url

        if conversation_id:
            print(f"[Tavus] Global conversation created: {conversation_id}", flush=True)
            emit_to_session(session_id, "tavus_session", {
                "conversationId": conversation_id,
                "conversationUrl": conversation_url,
            })
        else:
            print(f"[Tavus] Failed to create global conversation", flush=True)

    threading.Thread(target=_open_tavus, daemon=True).start()


@socketio.on("init_tavus")
def handle_init_tavus():
    """Re-send the global Tavus conversation URL to this session."""
    if GLOBAL_TAVUS["conversation_id"]:
        print(f"[Tavus] init_tavus — resending {GLOBAL_TAVUS['conversation_id']}", flush=True)
        emit("tavus_session", {
            "conversationId": GLOBAL_TAVUS["conversation_id"],
            "conversationUrl": GLOBAL_TAVUS["conversation_url"],
        })


@socketio.on("disconnect")
def handle_disconnect():
    session_id = SESSIONS.pop(f"sid:{request.sid}", None)
    if not session_id:
        return
    session = SESSIONS.pop(session_id, None)
    if session:
        clear_timers(session)
    # NOTE: Do NOT end the global Tavus conversation on disconnect —
    # it is reused across page refreshes. It ends only when the server shuts down.
    print(f"[WS] Session closed: {session_id}", flush=True)


@socketio.on("start")
def handle_start(data=None):
    """
    Visitor drops a file or taps 'Use demo packet'.
    Tavus session is already open — just start the timeline.
    """
    session_id = SESSIONS.get(f"sid:{request.sid}")
    if not session_id:
        return
    session = get_session(session_id)
    if not session:
        return

    clear_timers(session)
    print(f"[Start] Session {session_id}")
    start_timeline(session_id)


@socketio.on("scenario")
def handle_scenario(data):
    """
    Visitor taps a stress-test button.
    Sends scenario data to UI — frontend handles avatar speech via Daily interaction.
    """
    session_id = SESSIONS.get(f"sid:{request.sid}")
    if not session_id:
        return

    scenario_id = (data or {}).get("scenarioId")
    scenario = next((s for s in INSURED["scenarios"] if s["id"] == scenario_id), None)
    if not scenario:
        return

    emit_to_session(session_id, "scenario_result", {"scenario": scenario})


@socketio.on("qa")
def handle_qa(data):
    """
    Visitor taps a Q&A chip.
    Sends answer text + spoken script to frontend — frontend handles avatar speech.
    """
    session_id = SESSIONS.get(f"sid:{request.sid}")
    if not session_id:
        return

    question_id = (data or {}).get("questionId")
    qa = INSURED.get("qaPairs", {}).get(question_id)
    if not qa:
        return

    emit_to_session(session_id, "qa_answer", {
        "questionId": question_id,
        "answer": qa["answer"],
        "script": qa["script"],
    })


@socketio.on("freeform")
def handle_freeform(data):
    """
    Visitor types a free-form question.
    Sends deflect event to UI — frontend shows QR code.
    """
    session_id = SESSIONS.get(f"sid:{request.sid}")
    if not session_id:
        return

    emit_to_session(session_id, "freeform_deflect", {
        "script": DEFLECT_SCRIPT
    })


@socketio.on("reset")
def handle_reset(data=None):
    """
    Visitor hits Reset. Cancels the timeline — Tavus session stays open so the
    avatar is ready on the idle screen for the next run.
    """
    session_id = SESSIONS.get(f"sid:{request.sid}")
    if not session_id:
        return
    session = get_session(session_id)
    if not session:
        return

    clear_timers(session)
    emit_to_session(session_id, "reset", {})
    print(f"[Reset] Session {session_id}")


# ─────────────────────────────────────────────────────────────────────────────
# REST endpoints
# ─────────────────────────────────────────────────────────────────────────────

@app.route("/api/memo/pdf", methods=["POST"])
def memo_pdf():
    """
    Returns the underwriting memo as an HTML string for client-side PDF rendering.
    Optionally applies a stress-test scenario.

    Input (JSON body):
      { "scenarioId": "cat-100yr" }   -- optional

    Output:
      { "html": "<full HTML string>" }
    """
    payload = request.get_json(silent=True) or {}
    scenario_id = payload.get("scenarioId")

    active_scenario = None
    if scenario_id:
        active_scenario = next(
            (s for s in INSURED["scenarios"] if s["id"] == scenario_id), None
        )

    today = datetime.now().strftime("%B %d, %Y")
    html = build_memo_html(INSURED, today, active_scenario)
    return jsonify({"html": html})


@app.route("/debug/sessions")
def debug_sessions():
    safe = {k: {"sid": v.get("sid"), "timers": len(v.get("timers", []))}
            for k, v in SESSIONS.items() if isinstance(v, dict)}
    return jsonify({"sessions": safe, "count": len(safe)})


@app.route("/health")
def health():
    return jsonify({
        "ok": True,
        "service": "insurance-underwriting-officer",
        "tavus_configured": bool(TAVUS_API_KEY),
        "persona": TAVUS_PERSONA_ID or "NOT SET",
        "replica": TAVUS_REPLICA_ID or "default",
    })


# ─────────────────────────────────────────────────────────────────────────────
# Memo HTML builder — Meridian Commercial Insurance Carriers
# ─────────────────────────────────────────────────────────────────────────────

def ascii_safe(s):
    """Replace common Unicode punctuation with ASCII equivalents, strip the rest."""
    if not isinstance(s, str):
        return s
    return (s
        .replace('—', '-')   # em dash
        .replace('–', '-')   # en dash
        .replace('→', '->')  # right arrow
        .replace('↳', '->')  # curved arrow
        .replace('✓', '[OK]')# check mark
        .replace('⚠', '[!]') # warning
        .replace('▸', '>')   # right triangle
        .replace('‘', "'")   # left single quote
        .replace('’', "'")   # right single quote
        .replace('“', '"')   # left double quote
        .replace('”', '"')   # right double quote
        .encode('ascii', 'ignore').decode('ascii')
    )


def build_memo_html(data, date, active_scenario=None):
    p   = data["insuredProfile"]
    cs  = data["coverageSought"]
    cp  = cs["commercialProperty"]
    gl  = cs["generalLiability"]
    lh  = data["lossHistory"]
    cat = data["catExposure"]
    pr  = data["indicatedPremium"]
    co  = data["coinsurance"]
    rs  = data["riskScore"]
    risks = data["risks"]
    rec   = data["recommendation"]

    lr = active_scenario["newLossRatio"] if active_scenario and "newLossRatio" in active_scenario else lh["lossRatio"]
    rec_text = active_scenario["recommendation"] if active_scenario else rec["decision"]
    memo_override = active_scenario["memoOverride"] if active_scenario else None

    if lr <= 0.45:
        lr_color = "#065f46"
    elif lr <= 0.60:
        lr_color = "#92400e"
    else:
        lr_color = "#991b1b"

    risks_html = ""
    for i, r in enumerate(risks):
        risks_html += f"""
        <div class="risk">
          <div class="risk-title">{i+1}. {ascii_safe(r['title'])} - {r['severity'].upper()} ({r['confidence']}%)</div>
          <div class="risk-finding">Finding: {ascii_safe(r['finding'])}</div>
          <div style="font-size:9pt;color:#888;">Source: {ascii_safe(r['source'])}</div>
          <div class="risk-mitigant">Mitigant: {ascii_safe(r['mitigant'])}</div>
        </div>"""

    conditions_html = "\n".join(f"  <li>{ascii_safe(c)}</li>" for c in rec["bindingConditions"])
    final_rec = ascii_safe(memo_override) if memo_override else (
        f"Bind ${cp['tiv']:,} commercial property (ISO CP 00 10) and "
        f"${gl['perOccurrence']:,}/${gl['aggregate']:,} GL with conditions. "
        f"Loss ratio {lh['lossRatio']} vs {lh['industryMedianLR']} industry median - favorable. "
        f"Three amber flags, all mitigable. Indicated premium ${pr['total']:,}."
    )
    rec_text = ascii_safe(rec_text)

    import random
    memo_number = random.randint(10000, 99999)

    return f"""<!DOCTYPE html>
<html>
<head>
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{ font-family: Georgia, serif; font-size: 11pt; color: #1a1a1a; line-height: 1.5; }}
  .header {{ text-align: center; border-bottom: 3px double #1a3a5c; padding-bottom: 16px; margin-bottom: 24px; }}
  .carrier-name {{ font-size: 18pt; font-weight: bold; color: #1a3a5c; letter-spacing: 2px; text-transform: uppercase; }}
  .memo-title {{ font-size: 13pt; color: #444; margin-top: 4px; }}
  .meta {{ display: flex; justify-content: space-between; font-size: 9pt; color: #666; margin-top: 8px; }}
  h2 {{ font-size: 11pt; text-transform: uppercase; letter-spacing: 1px; color: #1a3a5c; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin: 20px 0 10px; }}
  .field {{ display: flex; gap: 8px; margin-bottom: 4px; }}
  .label {{ font-weight: bold; min-width: 220px; color: #333; }}
  .risk {{ border-left: 4px solid #f59e0b; padding: 8px 12px; margin: 8px 0; background: #fffbeb; }}
  .risk-title {{ font-weight: bold; color: #92400e; }}
  .risk-finding {{ color: #78350f; font-size: 10pt; }}
  .risk-mitigant {{ color: #065f46; font-size: 10pt; margin-top: 4px; }}
  .conditions li {{ padding: 2px 0; }}
  .conditions li::before {{ content: "> "; color: #1a3a5c; }}
  .decision-box {{ border: 2px solid #1a3a5c; padding: 12px 16px; text-align: center; margin: 20px 0; background: #f0f4f8; }}
  .decision-text {{ font-size: 14pt; font-weight: bold; color: #1a3a5c; letter-spacing: 1px; }}
  .footer {{ margin-top: 40px; border-top: 1px solid #ddd; padding-top: 12px; font-size: 8pt; color: #888; display: flex; justify-content: space-between; }}
  .watermark {{ position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-45deg); font-size: 60pt; color: rgba(26,58,92,0.04); font-weight: bold; white-space: nowrap; pointer-events: none; }}
</style>
</head>
<body>
<div class="watermark">MERIDIAN COMMERCIAL INSURANCE</div>
<div class="header">
  <div class="carrier-name">Meridian Commercial Insurance Carriers</div>
  <div class="memo-title">Commercial Lines Underwriting Memorandum - Confidential</div>
  <div class="meta">
    <span>Date: {date}</span>
    <span>Prepared by: Memo Layer AI Underwriting Officer (reviewed by Underwriter)</span>
    <span>Commercial P&amp;C | Memo #{memo_number}</span>
  </div>
</div>
<div class="decision-box">
  <div class="decision-text">{rec_text.upper()}</div>
  <div style="font-size:10pt;color:#444;margin-top:4px;">Subject to binding conditions listed herein</div>
</div>

<h2>1. Executive Summary</h2>
<p>{final_rec}</p>

<h2>2. Insured Overview</h2>
<div class="field"><span class="label">Legal Name:</span><span>{p['legalName']}</span></div>
<div class="field"><span class="label">Principal:</span><span>{p['principal']['name']}, {p['principal']['title']}</span></div>
<div class="field"><span class="label">NAICS:</span><span>{p['naics']} - {p['naicsDescription']}</span></div>
<div class="field"><span class="label">ISO Class:</span><span>{p['isoClass']} - {p['isoClassDescription']}</span></div>
<div class="field"><span class="label">Years in Business:</span><span>{p['yearsInBusiness']} years | {p['employees']} employees</span></div>
<div class="field"><span class="label">Annual Revenue:</span><span>${p['annualRevenue']:,}</span></div>
<div class="field"><span class="label">D&amp;B:</span><span>Score {p['dnb']['score']} | Rating {p['dnb']['rating']}</span></div>
<div class="field"><span class="label">Primary Location:</span><span>{p['locations'][0]['address']}, {p['locations'][0]['city']}, {p['locations'][0]['state']} {p['locations'][0]['zip']}</span></div>
<div class="field"><span class="label">Broker:</span><span>{p['broker']}</span></div>

<h2>3. Coverage Summary</h2>
<div class="field"><span class="label">Property TIV:</span><span>${cp['tiv']:,} | {cp['constructionType']} | Sprinklered | FPC {cp['fireProtectionClass']}</span></div>
<div class="field"><span class="label">Year Built / Sq Ft:</span><span>{cp['yearBuilt']} | {cp['squareFootage']:,} sq ft</span></div>
<div class="field"><span class="label">Form:</span><span>{cp['form']}</span></div>
<div class="field"><span class="label">General Liability:</span><span>${gl['perOccurrence']:,} per occ / ${gl['aggregate']:,} aggregate | Products: ${gl['productsCompleted']:,}</span></div>
<div class="field"><span class="label">Inland Marine:</span><span>${cs['inlandMarine']['scheduledEquipment']:,} scheduled equipment</span></div>
<div class="field"><span class="label">Policy Period:</span><span>{cs['policyPeriod']['effectiveDate']} to {cs['policyPeriod']['expirationDate']}</span></div>
<div class="field"><span class="label">Requested Premium:</span><span>${cs['requestedPremium']:,}</span></div>

<h2>4. Loss History (5-Year)</h2>
<div class="field"><span class="label">Total Claims:</span><span>{lh['totalClaims']} | Total Incurred: ${lh['totalIncurred']:,}</span></div>
<div class="field"><span class="label">Loss Ratio:</span><span style="font-weight:bold;color:{lr_color};">{lr}</span>&nbsp;<span>vs. {lh['industryMedianLR']} industry median | {lh['carrierFloorLR']} carrier floor</span></div>
<div style="margin-top:8px;font-size:10pt;color:#555;">
  {' | '.join(f"{c['year']}: {c['type']} ${c['incurred']:,} ({c['status']})" for c in lh['claims'])}
</div>

<h2>5. Cat Exposure</h2>
<div class="field"><span class="label">Location:</span><span>{cat['primaryLocation']} | Wind Zone {cat['windZone']} | Flood Zone {cat['floodZone']} | Seismic: {cat['seismic']}</span></div>
<div class="field"><span class="label">1-in-100yr PML:</span><span>${cat['pml100yr']:,} ({cat['pml100yrPct']}% of TIV)</span></div>
<div class="field"><span class="label">Treaty Capacity:</span><span>${cat['treatyAttachmentLimit']:,} - within treaty: {cat['withinTreaty']}</span></div>

<h2>6. Indicated Premium</h2>
<div class="field"><span class="label">ISO Base Rate:</span><span>{pr['isoBaseRate']} | Rate Factor: {pr['isoRateFactor']}</span></div>
<div class="field"><span class="label">Property:</span><span>${pr['property']:,}</span></div>
<div class="field"><span class="label">General Liability:</span><span>${pr['generalLiability']:,}</span></div>
<div class="field"><span class="label">Inland Marine:</span><span>${pr['inlandMarine']:,}</span></div>
<div class="field"><span class="label">Fees &amp; Endorsements:</span><span>${pr['feesAndEndorsements']:,}</span></div>
<div class="field"><span class="label">Total Indicated:</span><span><strong>${pr['total']:,}</strong> vs ${cs['requestedPremium']:,} requested (+{round((pr['total']/cs['requestedPremium']-1)*100,1)}% variance)</span></div>
<div class="field"><span class="label">Coinsurance {co['clause']}:</span><span>{co['check']}</span></div>
<div class="field"><span class="label">Risk Score:</span><span>{data['riskScore']['overall']}/{data['riskScore']['outOf']} - {ascii_safe(data['riskScore']['interpretation'])}</span></div>

<h2>7. Risk Assessment</h2>
{risks_html}

<h2>8. Recommendation &amp; Binding Conditions</h2>
<p style="margin-bottom:10px;">{final_rec}</p>
<ul class="conditions" style="list-style:none;padding:0;">
{conditions_html}
</ul>

<h2>9. Compliance</h2>
<p>Ohio DOI: ISO CP 00 10 admitted market form - approved. SERFF filing current. OFAC SDN check: Apex Precision Manufacturing LLC - CLEAR. David Chen, CEO - CLEAR.</p>
<p style="margin-top:8px;font-size:10pt;color:#555;">All AI underwriting decisions carry full source citations, confidence scores, and reasoning chains per Meridian Explainable AI Policy MEX-2025-01.</p>

<div class="footer">
  <span>Meridian Commercial Insurance Carriers - Confidential - For Internal Use Only</span>
  <span>Memo Layer AI Underwriting Officer v1.0 | {date}</span>
  <span>ISO CP 00 10 | OH Admitted</span>
</div>

<div style="margin-top:30px;border-top:1px solid #ccc;padding-top:16px;">
  <div style="display:flex;justify-content:space-between;font-size:10pt;color:#333;">
    <div>Underwriter: _________________________  Date: __________</div>
    <div>Supervisor Review: _________________________  Date: __________</div>
  </div>
</div>
</body>
</html>"""

    # Final safety pass: strip any remaining non-ASCII that slipped through
    return html.encode('ascii', 'replace').decode('ascii').replace('?', ' ') if False else \
           ''.join(c if ord(c) < 128 else '-' for c in html)


# Serve React SPA - must be last (catches everything not matched above)

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve_react(path):
    static_dir = app.static_folder
    if path and os.path.exists(os.path.join(static_dir, path)):
        return send_from_directory(static_dir, path)
    return send_from_directory(static_dir, 'index.html')


# ─────────────────────────────────────────────────────────────────────────────
# Run
# ─────────────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    tavus_ok   = "OK" if TAVUS_API_KEY    else "NOT SET"
    persona_ok = TAVUS_PERSONA_ID         or  "NOT SET"
    replica_ok = TAVUS_REPLICA_ID         or  "default"

    print(f"\n  Digital Insurance Underwriting Officer - Memo Layer")
    print(f"  Meridian Commercial Insurance Carriers")
    print(f"  Tavus API   : {tavus_ok}")
    print(f"  Persona     : {persona_ok}")
    print(f"  Replica     : {replica_ok}")
    port = int(os.environ.get("PORT", 5002))
    print(f"  URL         : http://localhost:{port}\n")
    socketio.run(app, debug=False, use_reloader=False, host="0.0.0.0", port=port, allow_unsafe_werkzeug=True)
