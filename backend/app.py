"""
Digital Credit Officer — Flask Backend
---------------------------------------
• WebSocket (Socket.IO) session manager — drives the 20-step demo timeline
• Tavus CVI integration — opens a live avatar session on socket connect
  (avatar is live on the idle screen, ready to greet visitors)
• Step frames include tavusNarration text — frontend speech-queues them
  and sends via Daily.js conversation.echo interactions (not HTTP)
• Scenario / Q&A handlers return data only — frontend handles avatar speech
• PDF endpoint — HTML memo returned for client-side rendering
• Reset handler — clears timeline timers; Tavus session stays open
"""

import json
import os
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
CORS(app)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode="eventlet")

# ── Config ────────────────────────────────────────────────────────────────────
TAVUS_API_KEY    = os.environ.get("TAVUS_API_KEY", "")
TAVUS_PERSONA_ID = os.environ.get("TAVUS_PERSONA_ID", "")
TAVUS_REPLICA_ID = os.environ.get("TAVUS_REPLICA_ID", "")
LEAD_CAPTURE_URL = os.environ.get("LEAD_CAPTURE_URL", "https://yourdomain.com/pilot")

# ── Load static data ──────────────────────────────────────────────────────────
BASE_DIR = os.path.dirname(__file__)

with open(os.path.join(BASE_DIR, "borrower.json"), "r") as f:
    BORROWER = json.load(f)

with open(os.path.join(BASE_DIR, "steps.json"), "r") as f:
    STEPS = json.load(f)

# ── In-memory session store ───────────────────────────────────────────────────
# session_id → {
#   "sid": socket_id,
#   "timers": [threading.Timer, ...],
#   "tavus_conversation_id": str | None,
# }
SESSIONS = {}


# ─────────────────────────────────────────────────────────────────────────────
# Tavus helpers
# ─────────────────────────────────────────────────────────────────────────────

def build_tavus_context():
    """
    Builds the conversational_context string injected into the Tavus session.
    Contains every borrower number so the avatar can reason live, do math on
    stress scenarios, and answer freeform questions without hallucinating.
    """
    b = BORROWER
    br = b["borrower"]
    ln = b["loan"]
    fi = b["financials"]
    cr = b["credit"]
    ow = b["owner"]
    co = b["collateral"]
    ind = b["industry"]
    sc = b["scenarios"]

    return f"""You are a senior commercial loan officer at Hill Country Community Bank.
You are reviewing a live SBA 7(a) loan application. The analysis agent on screen will send you narration messages as it works through the packet. Speak each finding naturally as your own analysis — do not say "I was told" or "the system says". Sound like you have done this a thousand times.

BORROWER DATA — use these exact numbers in all responses:
Borrower: {br['legalName']} | Owner: {br['owner']} ({br['ownership']}) | Veteran: yes
Years in business: {br['yearsInBusiness']} | Employees: {br['employees']}
Locations: {', '.join(br['currentLocations'])} expanding to {br['expansionLocation']}
NAICS: {br['naics']} ({br['naicsDescription']})

LOAN REQUEST:
Amount: ${ln['amount']:,} | Type: {ln['type']} | Purpose: {ln['purpose']}
Term: {ln['term']} months | Rate: {ln['rate']} | SBA guaranty: {int(ln['guaranty'] * 100)}%
Use of proceeds: Real estate ${ln['useOfProceeds']['realEstate']:,} | Equipment ${ln['useOfProceeds']['equipment']:,} | Working capital ${ln['useOfProceeds']['workingCapital']:,}

FINANCIALS:
Revenue: 2024 ${fi['revenue2024']:,} | 2023 ${fi['revenue2023']:,} | 2022 ${fi['revenue2022']:,} | YoY growth {fi['revenueGrowthYoY']}%
EBITDA 2024: ${fi['ebitda2024']:,} | Gross margin: {fi['grossMarginPct']}%
Annual debt service (total): ${fi['annualDebtServiceTotal']:,} (proposed ${fi['annualDebtServiceProposed']:,} + existing ${fi['annualDebtServiceExisting']:,})
DSCR: {fi['dscr']}x | Bank floor: {fi['dscrBankFloor']}x | SBA min: {fi['dscrSbaMin']}x | Industry median: {fi['dscrIndustryMedian']}x
Monthly avg deposits: ${fi['monthlyAvgDeposits']:,} | NSF (12mo): {fi['nsfCount12mo']} | Deposit volatility: {fi['depositVolatilityCoefficient']} | Deposit-to-revenue variance: {fi['depositToRevenueVariance']}%

CREDIT:
Personal FICO: {cr['personalFico']} | Business PAYDEX: {cr['businessPaydex']} | Intelliscore: {cr['businessIntelliscore']}
Public records: {cr['publicRecords']} | Liens: {cr['liens']} | Judgments: {cr['judgments']} | Credit history: {cr['creditHistoryYears']} years

OWNER:
Net worth: ${ow['personalNetWorth']:,} | Liquidity: ${ow['personalLiquidity']:,} | Personal guarantee: yes

COLLATERAL:
Real estate (Fredericksburg): appraised ${co['realEstate']['appraisedValue']:,} at {int(co['realEstate']['advanceRate'] * 100)}% = ${co['realEstate']['advanceValue']:,}
Equipment: ${co['equipment']['value']:,} at {int(co['equipment']['advanceRate'] * 100)}% = ${co['equipment']['advanceValue']:,}
Inventory blanket: book ${co['inventoryBlanket']['bookValue']:,} at {int(co['inventoryBlanket']['advanceRate'] * 100)}% = ${co['inventoryBlanket']['advanceValue']:,}
Total advance value: ${co['totalAdvanceValue']:,} | Coverage ratio: {co['loanCoverageRatio']}x

INDUSTRY (NAICS {ind['naics']}):
5yr CAGR: {ind['fiveYearCagr']}% | Outlook: {ind['outlook']}
Tailwinds: {'; '.join(ind['tailwinds'])}
Headwinds: {'; '.join(ind['headwinds'])}

THREE RISKS (all amber):
1. Customer concentration: top 3 = 31% of revenue. Mitigant: 7+ year relationships, recurring service contracts.
2. Tariff exposure: 62% imported small engines. Mitigant: full price pass-through demonstrated in 2023 tariff round, gross margins held.
3. Collateral coverage tight: 1.01x. Mitigant: SBA 75% guaranty + personal guarantee backed by ${ow['personalNetWorth']:,} net worth.

RECOMMENDATION: Approve with conditions (quarterly reporting, DSCR covenant 1.25x, personal guaranty, life insurance assignment, second appraisal, annual concentration review).

STRESS SCENARIOS:
Rates +200bps: new debt service ${sc[0]['newDebtService']:,} → DSCR {sc[0]['newDscr']}x. {sc[0]['recommendation']}.
Top customer leaves (-14% revenue): EBITDA ${sc[1]['newEbitda']:,} → DSCR {sc[1]['newDscr']}x. {sc[1]['recommendation']}.
Revenue -20%: revenue ${sc[2]['newRevenue']:,}, EBITDA ${sc[2]['newEbitda']:,} → DSCR {sc[2]['newDscr']}x (at SBA floor). {sc[2]['recommendation']}.

BEHAVIOUR:
- Speak narration messages as your own analysis. No meta-commentary.
- For freeform questions: use the exact numbers above, show your reasoning, do the math explicitly.
- Keep narrations to 3-5 sentences. Freeform answers up to 8 sentences.
- Never invent numbers. Every figure must come from the data block above."""


def create_tavus_conversation():
    """Creates a new Tavus CVI session. Returns (conversation_id, conversation_url) or (None, None)."""
    if not TAVUS_API_KEY or not TAVUS_PERSONA_ID:
        print("[Tavus] API key or persona ID not set — avatar disabled")
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
        print(f"[Tavus] Create failed: {e}")
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
        "stepIndex":     step["index"],
        "traceText":     step["traceText"],
        "tileKey":       step.get("tileKey"),
        "memoChunk":     memo_chunk,
        "tavusNarration": step.get("tavusNarration"),  # frontend queues and echoes this
        "data":          BORROWER,
    })

    if step.get("tileKey") == "complete":
        def _memo_complete():
            time.sleep(0.4)
            emit_to_session(session_id, "memo_complete", {})
        threading.Thread(target=_memo_complete, daemon=True).start()


def start_timeline(session_id):
    """Schedules all 20 steps with cumulative delays using threading.Timer."""
    session = get_session(session_id)
    if not session:
        return

    clear_timers(session)
    cumulative_delay = 0.0

    for step in STEPS:
        cumulative_delay += step["delayMs"] / 1000.0
        delay = cumulative_delay  # capture for closure
        s = step             # capture for closure
        t = threading.Timer(delay, fire_step, args=(session_id, s))
        t.daemon = True
        t.start()
        session["timers"].append(t)


# ─────────────────────────────────────────────────────────────────────────────
# Socket.IO events
# ─────────────────────────────────────────────────────────────────────────────

@socketio.on("connect")
def handle_connect():
    session_id = str(uuid.uuid4())
    SESSIONS[session_id] = {
        "sid": request.sid,
        "timers": [],
        "tavus_conversation_id": None,
    }
    join_room(session_id)
    emit("connected", {"sessionId": session_id})
    print(f"[WS] New session: {session_id} (sid={request.sid})")

    # Store reverse mapping sid → session_id for disconnect lookup
    SESSIONS[f"sid:{request.sid}"] = session_id


@socketio.on("init_tavus")
def handle_init_tavus():
    """User clicked 'Start Conversation' — create the Tavus session now."""
    session_id = SESSIONS.get(f"sid:{request.sid}")
    if not session_id:
        return
    session = get_session(session_id)
    if not session:
        return

    def _open_tavus():
        if not get_session(session_id):
            return
        conversation_id, conversation_url = create_tavus_conversation()
        if conversation_id:
            session["tavus_conversation_id"] = conversation_id
            emit_to_session(session_id, "tavus_session", {
                "conversationId": conversation_id,
                "conversationUrl": conversation_url,
            })

    threading.Thread(target=_open_tavus, daemon=True).start()


@socketio.on("disconnect")
def handle_disconnect():
    session_id = SESSIONS.pop(f"sid:{request.sid}", None)
    if not session_id:
        return
    session = SESSIONS.pop(session_id, None)
    if session:
        clear_timers(session)
        cid = session.get("tavus_conversation_id")
        if cid:
            threading.Thread(target=end_tavus_conversation, args=(cid,), daemon=True).start()
    print(f"[WS] Session closed: {session_id}")


@socketio.on("start")
def handle_start(data=None):
    """
    Visitor drops a file or taps 'Use demo packet'.
    Tavus session is already open (created on connect) — just start the timeline.
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
    scenario = next((s for s in BORROWER["scenarios"] if s["id"] == scenario_id), None)
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
    qa = BORROWER.get("qaPairs", {}).get(question_id)
    if not qa:
        return

    emit_to_session(session_id, "qa_answer", {
        "questionId": question_id,
        "answer": qa["answer"],
        "script": qa["script"],   # spoken verbatim by avatar via conversation.echo
    })


@socketio.on("freeform")
def handle_freeform(data):
    """
    Visitor types a free-form question.
    Sends deflect event to UI — frontend interrupts avatar, says deflect line, shows QR.
    """
    session_id = SESSIONS.get(f"sid:{request.sid}")
    if not session_id:
        return

    emit_to_session(session_id, "freeform_deflect", {})


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
    Returns the credit memo as an HTML string for client-side PDF rendering.
    Optionally applies a stress-test scenario.

    Input (JSON body):
      { "scenarioId": "revenueDown20" }   -- optional

    Output (success):
      { "html": "<full HTML string>" }

    The frontend passes this HTML to html2pdf or jsPDF to generate the download.
    """
    payload = request.get_json(silent=True) or {}
    scenario_id = payload.get("scenarioId")

    active_scenario = None
    if scenario_id:
        active_scenario = next(
            (s for s in BORROWER["scenarios"] if s["id"] == scenario_id), None
        )

    today = datetime.now().strftime("%B %d, %Y")
    html = build_memo_html(BORROWER, today, active_scenario)
    return jsonify({"html": html})


@app.route("/health")
def health():
    return jsonify({
        "ok": True,
        "tavus_configured": bool(TAVUS_API_KEY),
        "persona": TAVUS_PERSONA_ID or "NOT SET",
        "replica": TAVUS_REPLICA_ID or "default",
    })


# ─────────────────────────────────────────────────────────────────────────────
# Memo HTML builder
# ─────────────────────────────────────────────────────────────────────────────

def build_memo_html(data, date, active_scenario=None):
    b = data["borrower"]
    ln = data["loan"]
    fi = data["financials"]
    cr = data["credit"]
    ow = data["owner"]
    co = data["collateral"]
    ind = data["industry"]
    risks = data["risks"]
    rec = data["recommendation"]

    dscr = active_scenario["newDscr"] if active_scenario else fi["dscr"]
    rec_text = active_scenario["recommendation"] if active_scenario else "APPROVE WITH CONDITIONS"
    memo_override = active_scenario["memoOverride"] if active_scenario else None

    if dscr >= 2.0:
        dscr_color = "#065f46"
    elif dscr >= 1.25:
        dscr_color = "#92400e"
    else:
        dscr_color = "#991b1b"

    risks_html = ""
    for i, r in enumerate(risks):
        risks_html += f"""
        <div class="risk">
          <div class="risk-title">{i + 1}. {r['title']} — {r['severity'].upper()}</div>
          <div class="risk-finding">Finding: {r['finding']}</div>
          <div style="font-size:9pt;color:#888;">Source: {r['source']}</div>
          <div class="risk-mitigant">Mitigant: {r['mitigant']}</div>
        </div>"""

    conditions_html = "\n".join(f"  <li>{c}</li>" for c in rec["conditions"])
    tailwinds = " | ".join(ind["tailwinds"])
    headwinds = " | ".join(ind["headwinds"])
    final_rec = memo_override or "Approve $850,000 SBA 7(a) loan. Strong cash flow, excellent credit profile, and adequate mitigants for all identified risks."

    import random
    loan_number = random.randint(10000, 99999)

    return f"""<!DOCTYPE html>
<html>
<head>
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{ font-family: Georgia, serif; font-size: 11pt; color: #1a1a1a; line-height: 1.5; }}
  .header {{ text-align: center; border-bottom: 3px double #1a3a5c; padding-bottom: 16px; margin-bottom: 24px; }}
  .bank-name {{ font-size: 18pt; font-weight: bold; color: #1a3a5c; letter-spacing: 2px; text-transform: uppercase; }}
  .memo-title {{ font-size: 13pt; color: #444; margin-top: 4px; }}
  .meta {{ display: flex; justify-content: space-between; font-size: 9pt; color: #666; margin-top: 8px; }}
  h2 {{ font-size: 11pt; text-transform: uppercase; letter-spacing: 1px; color: #1a3a5c; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin: 20px 0 10px; }}
  .field {{ display: flex; gap: 8px; margin-bottom: 4px; }}
  .label {{ font-weight: bold; min-width: 200px; color: #333; }}
  .risk {{ border-left: 4px solid #f59e0b; padding: 8px 12px; margin: 8px 0; background: #fffbeb; }}
  .risk-title {{ font-weight: bold; color: #92400e; }}
  .risk-finding {{ color: #78350f; font-size: 10pt; }}
  .risk-mitigant {{ color: #065f46; font-size: 10pt; margin-top: 4px; }}
  .conditions li {{ padding: 2px 0; }}
  .conditions li::before {{ content: "▸ "; color: #1a3a5c; }}
  .decision-box {{ border: 2px solid #1a3a5c; padding: 12px 16px; text-align: center; margin: 20px 0; background: #f0f4f8; }}
  .decision-text {{ font-size: 14pt; font-weight: bold; color: #1a3a5c; letter-spacing: 1px; }}
  .footer {{ margin-top: 40px; border-top: 1px solid #ddd; padding-top: 12px; font-size: 8pt; color: #888; display: flex; justify-content: space-between; }}
  .watermark {{ position: fixed; top: 50%; left: 50%; transform: translate(-50%,-50%) rotate(-45deg); font-size: 60pt; color: rgba(26,58,92,0.04); font-weight: bold; white-space: nowrap; pointer-events: none; }}
</style>
</head>
<body>
<div class="watermark">HILL COUNTRY COMMUNITY BANK</div>
<div class="header">
  <div class="bank-name">Hill Country Community Bank</div>
  <div class="memo-title">Commercial Credit Memorandum — Confidential</div>
  <div class="meta">
    <span>Date: {date}</span>
    <span>Prepared by: AI Credit Officer (reviewed by Loan Officer)</span>
    <span>SBA 7(a) | Loan #DCO-{loan_number}</span>
  </div>
</div>
<div class="decision-box">
  <div class="decision-text">{rec_text.upper()}</div>
  <div style="font-size:10pt;color:#444;margin-top:4px;">Subject to conditions listed herein</div>
</div>

<h2>1. Borrower Identification</h2>
<div class="field"><span class="label">Legal Name:</span><span>{b['legalName']}</span></div>
<div class="field"><span class="label">Owner:</span><span>{b['owner']} ({b['ownership']}) — US Army Veteran</span></div>
<div class="field"><span class="label">Business Address:</span><span>{b['businessAddress']}</span></div>
<div class="field"><span class="label">NAICS:</span><span>{b['naics']} — {b['naicsDescription']}</span></div>
<div class="field"><span class="label">Years in Business:</span><span>{b['yearsInBusiness']} years | {b['employees']} employees</span></div>
<div class="field"><span class="label">Current Locations:</span><span>{', '.join(b['currentLocations'])} → expanding to {b['expansionLocation']}</span></div>

<h2>2. Loan Request</h2>
<div class="field"><span class="label">Loan Amount:</span><span>${ln['amount']:,}</span></div>
<div class="field"><span class="label">Loan Type:</span><span>{ln['type']}</span></div>
<div class="field"><span class="label">Purpose:</span><span>{ln['purpose']}</span></div>
<div class="field"><span class="label">Term / Rate:</span><span>{ln['term']} months | {ln['rate']}</span></div>
<div class="field"><span class="label">SBA Guaranty:</span><span>{int(ln['guaranty'] * 100)}% (${int(ln['amount'] * ln['guaranty']):,})</span></div>
<div class="field"><span class="label">Equity Injection:</span><span>${ln['equityInjection']:,}</span></div>
<div style="margin-top:8px;font-size:10pt;color:#555;">Use of Proceeds: Real Estate ${ln['useOfProceeds']['realEstate']:,} | Equipment ${ln['useOfProceeds']['equipment']:,} | Working Capital ${ln['useOfProceeds']['workingCapital']:,}</div>

<h2>3. Financial Analysis</h2>
<div class="field"><span class="label">2024 Revenue:</span><span>${fi['revenue2024']:,} (+{fi['revenueGrowthYoY']}% YoY)</span></div>
<div class="field"><span class="label">2024 EBITDA:</span><span>${fi['ebitda2024']:,}</span></div>
<div class="field"><span class="label">Annual Debt Service:</span><span>${fi['annualDebtServiceTotal']:,} (proposed + existing)</span></div>
<div class="field"><span class="label">DSCR:</span><span style="font-weight:bold;color:{dscr_color};">{dscr}x</span>&nbsp;<span>vs. {fi['dscrBankFloor']}x bank floor / {fi['dscrSbaMin']}x SBA min / {fi['dscrIndustryMedian']}x industry median</span></div>
<div class="field"><span class="label">Monthly Avg Deposits:</span><span>${fi['monthlyAvgDeposits']:,} (volatility {fi['depositVolatilityCoefficient']} — low | revenue variance {fi['depositToRevenueVariance']}%)</span></div>

<h2>4. Credit Profile</h2>
<div class="field"><span class="label">Personal FICO (Reyes):</span><span>{cr['personalFico']} — Excellent | {cr['creditHistoryYears']} year history</span></div>
<div class="field"><span class="label">Business PAYDEX (D&amp;B):</span><span>{cr['businessPaydex']}</span></div>
<div class="field"><span class="label">Intelliscore (Experian):</span><span>{cr['businessIntelliscore']}</span></div>
<div class="field"><span class="label">Public Records / Liens:</span><span>None</span></div>
<div class="field"><span class="label">Owner Net Worth / Liquidity:</span><span>${ow['personalNetWorth']:,} / ${ow['personalLiquidity']:,}</span></div>

<h2>5. Collateral</h2>
<div class="field"><span class="label">Real Estate (Fredericksburg):</span><span>${co['realEstate']['advanceValue']:,} advance ({int(co['realEstate']['advanceRate']*100)}% of ${co['realEstate']['appraisedValue']:,})</span></div>
<div class="field"><span class="label">Equipment:</span><span>${co['equipment']['advanceValue']:,} advance ({int(co['equipment']['advanceRate']*100)}% of ${co['equipment']['value']:,})</span></div>
<div class="field"><span class="label">Inventory Blanket:</span><span>${co['inventoryBlanket']['advanceValue']:,} advance ({int(co['inventoryBlanket']['advanceRate']*100)}% of ${co['inventoryBlanket']['bookValue']:,})</span></div>
<div class="field"><span class="label">Total Advance / Coverage:</span><span>${co['totalAdvanceValue']:,} vs ${ln['amount']:,} loan = {co['loanCoverageRatio']}x</span></div>

<h2>6. Risk Assessment</h2>
{risks_html}

<h2>7. Industry Analysis</h2>
<div class="field"><span class="label">NAICS {ind['naics']}:</span><span>Farm &amp; Garden Machinery Wholesalers — {ind['outlook']} outlook, {ind['fiveYearCagr']}% 5-yr CAGR</span></div>
<div style="margin-top:8px;font-size:10pt;color:#065f46;">Tailwinds: {tailwinds}</div>
<div style="margin-top:4px;font-size:10pt;color:#991b1b;">Headwinds: {headwinds}</div>

<h2>8. Recommendation &amp; Conditions</h2>
<p style="margin-bottom:10px;">{final_rec}</p>
<ul class="conditions" style="list-style:none;padding:0;">
{conditions_html}
</ul>

<h2>9. Compliance</h2>
<p>This credit memorandum has been prepared in accordance with SBA SOP 50-10-8 documentation requirements (effective June 2025). All required elements verified.</p>

<div class="footer">
  <span>Hill Country Community Bank — Confidential — For Internal Use Only</span>
  <span>AI Credit Officer v1.0 | {date}</span>
  <span>SBA SOP 50-10-8 Compliant</span>
</div>
</body>
</html>"""


# ─────────────────────────────────────────────────────────────────────────────
# Serve React SPA — must be last (catches everything not matched above)
# ─────────────────────────────────────────────────────────────────────────────

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
    tavus_ok     = "OK" if TAVUS_API_KEY    else "NOT SET"
    persona_ok   = TAVUS_PERSONA_ID         or  "NOT SET"
    replica_ok   = TAVUS_REPLICA_ID         or  "default"

    print(f"\n  Digital Credit Officer")
    print(f"  Tavus API   : {tavus_ok}")
    print(f"  Persona     : {persona_ok}")
    print(f"  Replica     : {replica_ok}")
    print(f"  URL         : http://localhost:5000\n")

    port = int(os.environ.get("PORT", 5000))
    socketio.run(app, debug=True, host="0.0.0.0", port=port)
