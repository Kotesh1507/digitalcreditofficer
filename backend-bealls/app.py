"""
Bealls Sales Command Center - Flask Backend
Main application with Socket.IO for real-time communication and Tavus CVI integration
"""

import os
import json
import uuid
import threading
import requests
from datetime import datetime
from functools import wraps

from flask import Flask, request, jsonify, send_from_directory
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__, static_folder='../frontend/dist', static_url_path='')
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'bealls-secret-key-change-in-prod')

CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

TAVUS_API_KEY = os.getenv('TAVUS_API_KEY')

# Multi-agent Tavus configuration
TAVUS_AGENTS = {
    'diagnostics': {
        'persona_id': os.getenv('TAVUS_DIAGNOSTICS_PERSONA_ID'),
        'replica_id': os.getenv('TAVUS_DIAGNOSTICS_REPLICA_ID'),
        'name': 'Diagnostics Analyst',
    },
    'forecast': {
        'persona_id': os.getenv('TAVUS_FORECAST_PERSONA_ID'),
        'replica_id': os.getenv('TAVUS_FORECAST_REPLICA_ID'),
        'name': 'Forecast Analyst',
    },
    'store_comparison': {
        'persona_id': os.getenv('TAVUS_COMPARISON_PERSONA_ID'),
        'replica_id': os.getenv('TAVUS_COMPARISON_REPLICA_ID'),
        'name': 'Store Comparison Analyst',
    },
}

sessions = {}

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

with open(os.path.join(BASE_DIR, "data", "qa_pairs.json"), "r", encoding="utf-8") as f:
    QA_PAIRS = json.load(f)

DEFLECT_SCRIPT = (
    "Good question. For a deeper dive on your stores and categories, "
    "scan the QR code — we'll set up a full session with the Bealls analytics team."
)


def session_id_for_sid(sid: str):
    """Resolve Socket.IO session_id from connection sid."""
    for session_id, session in sessions.items():
        if isinstance(session, dict) and session.get("sid") == sid:
            return session_id
    return None


def init_agents():
    """Initialize agent modules"""
    import sys
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

    from agents.orchestrator import orchestrator
    from agents.diagnostics_agent import diagnostics_agent
    from agents.forecast_agent import forecast_agent
    from agents.store_comparison_agent import store_comparison_agent
    from mcp.sales_data_mcp import sales_data_mcp
    from mcp.calendar_mcp import calendar_mcp
    from mcp.forecast_mcp import forecast_mcp

    return {
        'orchestrator': orchestrator,
        'diagnostics': diagnostics_agent,
        'forecast': forecast_agent,
        'store_comparison': store_comparison_agent,
        'mcp': {
            'sales': sales_data_mcp,
            'calendar': calendar_mcp,
            'forecast': forecast_mcp
        }
    }


agents = None


def get_agents():
    global agents
    if agents is None:
        agents = init_agents()
    return agents


# === Tavus Integration ===

def list_active_tavus_conversations():
    """List active Tavus conversations for this API key."""
    if not TAVUS_API_KEY:
        return []
    try:
        res = requests.get(
            "https://tavusapi.com/v2/conversations",
            headers={"x-api-key": TAVUS_API_KEY},
            params={"status": "active", "limit": 50},
            timeout=30,
        )
        res.raise_for_status()
        return res.json().get("data", [])
    except requests.RequestException as e:
        print(f"[Tavus] List active failed: {e}")
        return []


def end_all_active_tavus_conversations():
    """End every active Tavus conversation (frees concurrent slots)."""
    ended = []
    for conv in list_active_tavus_conversations():
        cid = conv.get("conversation_id")
        if not cid:
            continue
        try:
            end_tavus_conversation(cid)
            ended.append(cid)
            print(f"[Tavus] Ended active conversation: {cid}")
        except requests.RequestException as e:
            print(f"[Tavus] Failed to end {cid}: {e}")
    return ended


def get_agent_context(agent_type):
    """Get conversational context for each agent persona."""
    base_data = """
BEALLS RETAIL DATA (use these numbers in your responses):
- 500 stores across Southeast, Southwest, Central, Northeast, West regions
- 8 categories: Apparel, Footwear, Home, Kids, Accessories, Beauty, Jewelry, Outdoor
- Store 100: +2.5% comp, strong performer, Kids +6.9%, Apparel +2.0%
- Store 101: -3.2% comp, traffic down 8%, Footwear struggling at -5.1%
- Store 102: -7.8% comp, conversion issue, Apparel down 12%
- Apparel forecast: $4.2M-$4.8M over 12 weeks, Promo W6 adds +$340K
- Cluster 7 median comp: +0.3%, top performer Store 318 at +5.2%
"""

    contexts = {
        'diagnostics': f"""You are the Diagnostics Analyst for Bealls Sales Command Center.
You help store managers understand WHY their stores are underperforming.

{base_data}

YOUR EXPERTISE:
- Variance decomposition: Traffic, Conversion, Basket, Mix/UPT
- Root cause analysis for sales drops
- Category-level diagnostics
- Calendar and seasonality effects

CONVERSATION STYLE:
- Be warm, conversational, and confident
- Always cite specific numbers from the data
- When user asks "why is my store down?", decompose the variance
- Suggest actionable drill-downs
- Keep responses concise (2-3 sentences max)

When you receive a conversation.echo message, speak that text verbatim - it contains detailed analysis.""",

        'forecast': f"""You are the Forecast Analyst for Bealls Sales Command Center.
You help merchandisers understand future sales projections and demand drivers.

{base_data}

YOUR EXPERTISE:
- 12-week sales forecasting with confidence bands
- Seasonal patterns and trend analysis
- Promo impact modeling
- What-if scenario analysis

CONVERSATION STYLE:
- Be warm, conversational, and confident
- Always cite specific forecast numbers
- Explain drivers: "Promo W6 adds $340K, seasonal tail-off W9-11 pulls back $210K"
- Discuss confidence levels and risks
- Keep responses concise (2-3 sentences max)

When you receive a conversation.echo message, speak that text verbatim - it contains detailed analysis.""",

        'store_comparison': f"""You are the Store Comparison Analyst for Bealls Sales Command Center.
You help regional VPs benchmark stores against their peer clusters.

{base_data}

YOUR EXPERTISE:
- Peer cluster benchmarking
- Identifying performance gaps vs cluster median
- Best practice sharing from top performers
- Regional and demographic context

CONVERSATION STYLE:
- Be warm, conversational, and confident
- Always cite specific store numbers and rankings
- Compare to cluster median and top performers
- Suggest what lagging stores can learn from leaders
- Keep responses concise (2-3 sentences max)

When you receive a conversation.echo message, speak that text verbatim - it contains detailed analysis.""",
    }
    return contexts.get(agent_type, contexts['diagnostics'])


def create_tavus_conversation(agent_type='diagnostics', retry_after_cleanup=True):
    """Create a new Tavus CVI conversation for a specific agent type."""
    agent_config = TAVUS_AGENTS.get(agent_type, TAVUS_AGENTS['diagnostics'])
    persona_id = agent_config['persona_id']
    replica_id = agent_config['replica_id']
    agent_name = agent_config['name']

    print(f"[Tavus] create_tavus_conversation called for agent: {agent_type}")
    print(f"[Tavus] API_KEY present: {bool(TAVUS_API_KEY)}, PERSONA_ID: {persona_id}, REPLICA_ID: {replica_id}")

    if not TAVUS_API_KEY or not persona_id:
        return None, None, f"Tavus API key or persona ID not configured for {agent_type}", None, None

    body = {
        "persona_id": persona_id,
        "conversational_context": get_agent_context(agent_type),
        "properties": {
            "max_call_duration": 1800,
            "participant_left_timeout": 600,
            "enable_recording": False,
        },
    }
    if replica_id:
        body["replica_id"] = replica_id

    try:
        res = requests.post(
            "https://tavusapi.com/v2/conversations",
            headers={"Content-Type": "application/json", "x-api-key": TAVUS_API_KEY},
            json=body,
            timeout=30,
        )
        print(f"[Tavus] Response status: {res.status_code}")
        print(f"[Tavus] Response body: {res.text[:500]}")

        if res.status_code == 400 and retry_after_cleanup:
            err = res.json() if res.text else {}
            msg = err.get("message", "")
            if "maximum concurrent" in msg.lower() or "concurrent conversations" in msg.lower():
                print("[Tavus] Concurrent limit hit — ending stale active conversations...")
                end_all_active_tavus_conversations()
                return create_tavus_conversation(agent_type, retry_after_cleanup=False)

        res.raise_for_status()
        data = res.json()
        cid = data.get("conversation_id")
        curl = data.get("conversation_url")
        if not cid or not curl:
            return None, None, "Tavus returned an invalid conversation payload", None, None
        conv_replica = data.get("replica_id") or replica_id
        print(f"[Tavus] Conversation created: {cid}, replica_id={conv_replica}, agent={agent_type}")
        return cid, curl, None, conv_replica, agent_name
    except requests.RequestException as e:
        detail = str(e)
        if getattr(e, "response", None) is not None:
            try:
                detail = e.response.json().get("message", e.response.text)
            except Exception:
                detail = e.response.text or detail
        print(f"[Tavus] Create failed: {detail}")
        return None, None, detail, None, None


def end_tavus_conversation(conversation_id):
    """End a Tavus conversation"""
    requests.post(
        f"https://tavusapi.com/v2/conversations/{conversation_id}/end",
        headers={"x-api-key": TAVUS_API_KEY},
        timeout=10,
    )




def emit_to_session(session_id: str, event: str, data: dict):
    """Emit event to a specific session - safe for background threads"""
    if session_id in sessions:
        sid = sessions[session_id].get('sid')
        if sid:
            print(f"[emit_to_session] Sending {event} to sid={sid}", flush=True)
            socketio.emit(event, data, to=sid)
        else:
            print(f"[emit_to_session] No sid for session {session_id}", flush=True)
    else:
        print(f"[emit_to_session] Session {session_id} not found", flush=True)


# === REST API Routes ===

@app.route('/')
def index():
    """Serve frontend"""
    return send_from_directory(app.static_folder, 'index.html')


def get_replica_label(replica_id: str) -> str:
    """Resolve replica display name for UI verification."""
    if not replica_id or not TAVUS_API_KEY:
        return replica_id or ""
    try:
        res = requests.get(
            f"https://tavusapi.com/v2/replicas/{replica_id}",
            headers={"x-api-key": TAVUS_API_KEY},
            timeout=15,
        )
        if res.ok:
            data = res.json()
            return data.get("replica_name") or data.get("name") or replica_id
    except requests.RequestException:
        pass
    return replica_id


@app.route('/health')
def health():
    """Health check endpoint"""
    diagnostics_config = TAVUS_AGENTS.get('diagnostics', {})
    return jsonify({
        "status": "healthy",
        "service": "Bealls Sales Command Center",
        "version": "1.0.0",
        "tavus_configured": bool(TAVUS_API_KEY and diagnostics_config.get('persona_id')),
        "tavus_agents": list(TAVUS_AGENTS.keys()),
        "gemini_configured": bool(os.getenv('GEMINI_API_KEY')),
        "s3_configured": bool(os.getenv('AWS_ACCESS_KEY_ID')),
        "active_sessions": len(sessions),
        "active_tavus_conversations": len([s for s in sessions.values() if s.get('tavus_conversation_id')])
    })


@app.route('/api/query', methods=['POST'])
def process_query():
    """Process a query through the orchestrator"""
    data = request.json
    query = data.get('query', '')
    session_id = data.get('session_id', str(uuid.uuid4()))
    persona = data.get('persona')

    if not query:
        return jsonify({"error": "Query is required"}), 400

    try:
        agent_system = get_agents()
        orchestrator = agent_system['orchestrator']

        result = orchestrator.process_query(query, session_id, {"persona": persona})

        return jsonify({
            "session_id": session_id,
            "query": query,
            "result": result
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/qa-chips')
def get_qa_chips():
    """Q&A chip metadata for scripted echo responses."""
    chips = [
        {"id": "store_0214_down", "label": "Why is Store 0214 down?"},
        {"id": "apparel_forecast", "label": "12-week Apparel forecast"},
        {"id": "store_0142_peers", "label": "Why does 0142 lag its cluster?"},
        {"id": "manager_action", "label": "What should the manager do?"},
        {"id": "apparel_problem", "label": "Why is Apparel the problem?"},
        {"id": "peer_318", "label": "How does 318 beat us?"},
    ]
    return jsonify({"chips": chips})


@app.route('/api/suggested-prompts')
def get_suggested_prompts():
    """Get suggested prompts for conversation starters"""
    persona = request.args.get('persona')

    agent_system = get_agents()
    orchestrator = agent_system['orchestrator']

    prompts = orchestrator.get_suggested_prompts(persona)
    return jsonify({"prompts": prompts})


@app.route('/api/opening-briefing', methods=['GET'])
def opening_briefing():
    """Landing/opening page KPI snapshot (pre-conversation briefing)."""
    agent_system = get_agents()
    sales = agent_system['mcp']['sales']

    week_range = request.args.get('week_range', 'last_12w')
    kpis_payload = sales.get_opening_briefing_kpis(week_range=week_range)
    return jsonify(kpis_payload)


@app.route('/api/store/<store_id>/diagnostics', methods=['GET'])
def get_store_diagnostics(store_id):
    """Get diagnostics for a specific store"""
    agent_system = get_agents()
    diagnostics = agent_system['diagnostics']

    result = diagnostics.execute(
        f"Why is Store {store_id} performing this way?",
        store_id=store_id
    )

    return jsonify(result)


@app.route('/api/forecast/<category>', methods=['GET'])
def get_category_forecast(category):
    """Get forecast for a category"""
    weeks = request.args.get('weeks', 12, type=int)
    scenario_id = request.args.get('scenario')

    agent_system = get_agents()
    forecast = agent_system['forecast']

    result = forecast.execute(
        f"What is the {weeks}-week {category} forecast?",
        category=category,
        weeks=weeks,
        scenario_id=scenario_id
    )

    return jsonify(result)


@app.route('/api/forecast/what-if', methods=['POST'])
def run_what_if():
    """Run a what-if scenario"""
    data = request.json
    category = data.get('category', 'Apparel')
    scenario_id = data.get('scenario_id')

    if not scenario_id:
        return jsonify({"error": "scenario_id is required"}), 400

    agent_system = get_agents()
    forecast = agent_system['forecast']

    result = forecast.execute_what_if(category, scenario_id)
    return jsonify(result)


@app.route('/api/store/<store_id>/comparison', methods=['GET'])
def get_store_comparison(store_id):
    """Get peer comparison for a store"""
    agent_system = get_agents()
    comparison = agent_system['store_comparison']

    result = comparison.execute(
        f"How does Store {store_id} compare to its cluster?",
        store_id=store_id
    )

    return jsonify(result)


@app.route('/api/tavus/init', methods=['POST'])
def init_tavus_rest():
    """Initialize Tavus conversation via REST for a specific agent type"""
    data = request.json or {}
    agent_type = data.get('agent_type', 'diagnostics')

    # Validate agent type
    if agent_type not in TAVUS_AGENTS:
        agent_type = 'diagnostics'

    end_all_active_tavus_conversations()
    conversation_id, conversation_url, error, conv_replica, agent_name = create_tavus_conversation(agent_type)

    if error or not conversation_id:
        return jsonify({
            "error": error or "No conversation returned from Tavus API",
            "conversationId": None,
            "conversationUrl": None,
        }), 503

    agent_config = TAVUS_AGENTS[agent_type]
    replica_id = conv_replica or agent_config['replica_id'] or ""
    replica_name = get_replica_label(replica_id)

    print(f"[init_tavus] agent={agent_type} persona={agent_config['persona_id']} replica={replica_id} ({replica_name})")
    return jsonify({
        "conversationId": conversation_id,
        "conversationUrl": conversation_url,
        "personaId": agent_config['persona_id'],
        "replicaId": replica_id,
        "replicaName": replica_name,
        "agentType": agent_type,
        "agentName": agent_name,
    })


@app.route('/api/tavus/end', methods=['POST'])
def end_tavus_rest():
    """End Tavus conversation via REST"""
    data = request.json or {}
    conversation_id = data.get('conversation_id')

    if not conversation_id:
        return jsonify({"error": "conversation_id required"}), 400

    end_tavus_conversation(conversation_id)
    return jsonify({"status": "ended"})


@app.route('/api/tavus/switch', methods=['POST'])
def switch_tavus_agent():
    """Switch to a different Tavus agent - ends current and starts new"""
    data = request.json or {}
    current_conversation_id = data.get('current_conversation_id')
    new_agent_type = data.get('agent_type', 'diagnostics')

    # Validate agent type
    if new_agent_type not in TAVUS_AGENTS:
        return jsonify({"error": f"Invalid agent type: {new_agent_type}"}), 400

    # End current conversation if exists
    if current_conversation_id:
        try:
            end_tavus_conversation(current_conversation_id)
            print(f"[switch_tavus] Ended conversation: {current_conversation_id}")
        except Exception as e:
            print(f"[switch_tavus] Failed to end {current_conversation_id}: {e}")

    # Create new conversation for the new agent
    conversation_id, conversation_url, error, conv_replica, agent_name = create_tavus_conversation(new_agent_type)

    if error or not conversation_id:
        return jsonify({
            "error": error or "Failed to create new conversation",
            "conversationId": None,
            "conversationUrl": None,
        }), 503

    agent_config = TAVUS_AGENTS[new_agent_type]
    replica_id = conv_replica or agent_config['replica_id'] or ""
    replica_name = get_replica_label(replica_id)

    print(f"[switch_tavus] Switched to agent={new_agent_type} replica={replica_id} ({replica_name})")
    return jsonify({
        "conversationId": conversation_id,
        "conversationUrl": conversation_url,
        "personaId": agent_config['persona_id'],
        "replicaId": replica_id,
        "replicaName": replica_name,
        "agentType": new_agent_type,
        "agentName": agent_name,
    })


@app.route('/api/mcp/sales/<tool_name>', methods=['POST'])
def call_sales_mcp(tool_name):
    """Call a Sales Data MCP tool directly"""
    data = request.json or {}

    agent_system = get_agents()
    sales_mcp = agent_system['mcp']['sales']

    tool_map = {
        'get_store_sales': sales_mcp.get_store_sales,
        'get_category_sales': sales_mcp.get_category_sales,
        'get_store_traffic': sales_mcp.get_store_traffic,
        'get_cluster_assignment': sales_mcp.get_cluster_assignment,
        'get_cluster_members': sales_mcp.get_cluster_members,
        'get_customer_cohort_summary': sales_mcp.get_customer_cohort_summary,
        'get_recommendation_log': sales_mcp.get_recommendation_log
    }

    if tool_name not in tool_map:
        return jsonify({"error": f"Unknown tool: {tool_name}"}), 404

    try:
        result = tool_map[tool_name](**data)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# === Socket.IO Events ===

@socketio.on('connect')
def handle_connect():
    """Handle client connection"""
    import sys
    print(f"[Socket] handle_connect called!", file=sys.stderr, flush=True)
    session_id = str(uuid.uuid4())
    sessions[session_id] = {
        "connected_at": datetime.now().isoformat(),
        "sid": request.sid
    }
    join_room(session_id)
    emit('connected', {"session_id": session_id})
    print(f"[Socket] Client connected: {session_id}", flush=True)


@socketio.on('disconnect')
def handle_disconnect():
    """Handle client disconnection — keep Tavus alive (REST lifecycle owns conversations)."""
    for session_id, session in list(sessions.items()):
        if session.get('sid') == request.sid:
            del sessions[session_id]
            print(f"Client disconnected: {session_id}")
            break


@socketio.on('init_tavus')
def handle_init_tavus(data):
    """Initialize Tavus for a session"""
    print(f"[init_tavus] Received request: {data}")
    session_id = data.get('session_id')

    if not session_id or session_id not in sessions:
        print(f"[init_tavus] Session not found: {session_id}, available: {list(sessions.keys())}")
        emit('tavus_error', {"error": "session_id required"})
        return

    print(f"[init_tavus] Starting Tavus for session: {session_id}")

    def _open_tavus():
        try:
            print(f"[init_tavus] Calling create_tavus_conversation...")
            conversation_id, conversation_url, error, _conv_replica = create_tavus_conversation()
            print(f"[init_tavus] Result: id={conversation_id}, url={conversation_url}, error={error}")
            if conversation_id:
                sessions[session_id]['tavus_conversation_id'] = conversation_id
                emit_to_session(session_id, 'tavus_session', {
                    "conversationId": conversation_id,
                    "conversationUrl": conversation_url,
                })
                print(f"[init_tavus] Emitted tavus_session to {session_id}")
            else:
                emit_to_session(session_id, 'tavus_fallback', {
                    "reason": error or "No conversation ID returned"
                })
        except Exception as e:
            print(f"[init_tavus] Error: {e}")
            import traceback
            traceback.print_exc()
            emit_to_session(session_id, 'tavus_fallback', {"reason": str(e)})

    threading.Thread(target=_open_tavus, daemon=True).start()


@socketio.on('qa')
def handle_qa(data):
    """
    Q&A chip tapped — return scripted answer + spoken script (frontend uses conversation.echo).
    Same pattern as Digital Credit Officer.
    """
    session_id = session_id_for_sid(request.sid)
    if not session_id:
        return

    question_id = (data or {}).get("questionId")
    qa = QA_PAIRS.get(question_id)
    if not qa:
        emit("error", {"message": f"Unknown question: {question_id}"})
        return

    emit_to_session(session_id, "qa_answer", {
        "questionId": question_id,
        "answer": qa["answer"],
        "script": qa["script"],
    })


@socketio.on('freeform')
def handle_freeform(data):
    """
    Visitor typed a free-form question — deflect to QR (frontend echoes DEFLECT_SCRIPT).
    """
    session_id = session_id_for_sid(request.sid)
    if not session_id:
        return

    emit_to_session(session_id, "freeform_deflect", {})


@socketio.on('query')
def handle_query(data):
    """Handle a user query with progressive step emission"""
    session_id = data.get('session_id')
    query = data.get('query', '')
    persona = data.get('persona')

    if not query:
        emit('error', {"message": "Query is required"})
        return

    emit('processing', {"status": "routing", "query": query})

    try:
        agent_system = get_agents()
        orchestrator = agent_system['orchestrator']

        routing = orchestrator.route_query(query)
        emit('routing', {
            "agent": routing['agent'],
            "confidence": routing['confidence']
        })

        emit('processing', {"status": "executing", "agent": routing['agent']})

        result = orchestrator.process_query(query, session_id, {"persona": persona})

        response = result.get('response', {})
        reasoning_trace = response.get('reasoning_trace', [])
        dashboard = response.get('dashboard', {})

        # Emit steps progressively with dashboard tiles and narrations
        step_narrations = build_step_narrations(routing['agent'], response, dashboard)

        for i, step in enumerate(reasoning_trace):
            step_data = {
                "action": step.get('action', ''),
                "status": step.get('status', 'active')
            }

            # Attach tile data and narration based on step index
            if i < len(step_narrations):
                narration_info = step_narrations[i]
                if narration_info.get('tavusNarration'):
                    step_data['tavusNarration'] = narration_info['tavusNarration']
                if narration_info.get('tileKey'):
                    step_data['tileKey'] = narration_info['tileKey']
                    step_data['tileData'] = narration_info.get('tileData')

            emit('reasoning_step', step_data)
            socketio.sleep(0.3)  # Pace the steps for natural flow

        emit('response', {
            "session_id": session_id,
            "agent_id": result.get('agent_id'),
            "agent_name": result.get('agent_name'),
            "agent_badge": result.get('agent_badge'),
            "response": result.get('response')
        })

    except Exception as e:
        emit('error', {"message": str(e)})


def build_step_narrations(agent_type: str, response: dict, dashboard: dict) -> list:
    """Build narration and tile data for each reasoning step"""
    narrations = []

    if agent_type == 'diagnostics':
        # Step 1: Loading store data
        store_id = response.get('store_id', '0214')
        comp = response.get('comp_sales_pct', -8.3)
        narrations.append({
            'tavusNarration': f"Let me pull up the data for Store {store_id}. I see it's running at {comp}% comp sales.",
            'tileKey': 'alerts',
            'tileData': dashboard.get('alerts', [
                {'type': 'red', 'text': 'Apparel traffic down 12%'},
                {'type': 'amber', 'text': '3 SKUs OOS Week 2'},
                {'type': 'green', 'text': 'Footwear UPT +2.1%'}
            ])
        })

        # Step 2: KPI breakdown
        narrations.append({
            'tavusNarration': "Looking at the key metrics: traffic is down significantly, conversion has dropped, and average basket is also weaker.",
            'tileKey': 'kpis',
            'tileData': dashboard.get('kpis', [
                {'label': 'Comp Sales', 'value': f'{comp}%', 'delta': 'vs plan', 'color': 'red', 'active': True},
                {'label': 'Traffic / day', 'value': '1,820', 'delta': '-12.0%', 'color': 'red', 'delta_direction': 'down'},
                {'label': 'Conversion', 'value': '1.7%', 'delta': '-0.4pt', 'color': 'red', 'delta_direction': 'down'},
                {'label': 'Avg Basket', 'value': '$38.20', 'delta': '-$2.10', 'color': 'red', 'delta_direction': 'down'}
            ])
        })

        # Step 3: Category analysis
        narrations.append({
            'tavusNarration': "Apparel is the main drag, down 14% compared to plan. Home and Accessories are actually holding up.",
            'tileKey': 'categories',
            'tileData': [
                {'name': 'Apparel', 'actual': 52, 'plan': 80, 'comp': -14, 'color': '#f05252'},
                {'name': 'Footwear', 'actual': 64, 'plan': 72, 'comp': 2, 'color': '#4f7ef8'},
                {'name': 'Home', 'actual': 86, 'plan': 90, 'comp': 4, 'color': '#34c97a'},
                {'name': 'Kids', 'actual': 48, 'plan': 68, 'comp': -9, 'color': '#f05252'},
                {'name': 'Accessories', 'actual': 82, 'plan': 76, 'comp': 1, 'color': '#4f7ef8'}
            ]
        })

        # Step 4: Variance waterfall
        decomp = response.get('decomposition', {})
        narrations.append({
            'tavusNarration': "Breaking down the variance: traffic is the biggest factor at negative 5.8 points, followed by basket decline.",
            'tileKey': 'waterfall',
            'tileData': [
                {'name': 'Traffic', 'val': decomp.get('traffic', {}).get('contribution_pp', -5.8), 'width': 70},
                {'name': 'Basket', 'val': decomp.get('basket', {}).get('contribution_pp', -2.9), 'width': 50},
                {'name': 'Conversion', 'val': decomp.get('conversion', {}).get('contribution_pp', -1.9), 'width': 35},
                {'name': 'Mix/UPT', 'val': decomp.get('mix', {}).get('contribution_pp', 2.3), 'width': 30},
                {'name': 'Net Comp', 'val': comp, 'width': 70}
            ]
        })

    elif agent_type == 'forecast':
        category = response.get('category', 'Apparel')

        narrations.append({
            'tavusNarration': f"Let me build the 12-week forecast for {category}.",
            'tileKey': 'alerts',
            'tileData': [
                {'type': 'green', 'text': f'{category} trending +3%'},
                {'type': 'amber', 'text': 'Promo W6 pending'},
            ]
        })

        narrations.append({
            'tavusNarration': f"Based on seasonal patterns and current trends, I'm projecting {category} between $4.2M and $4.8M.",
            'tileKey': 'forecast',
            'tileData': {
                'title': f'{category} 12-Week Forecast',
                'subtitle': 'Base scenario',
                'low': '4.2',
                'high': '4.8'
            }
        })

        narrations.append({
            'tavusNarration': "The promotional week 6 event could add around $340K to the forecast if executed well.",
        })

    elif agent_type == 'store_comparison':
        store_id = response.get('store_id', '0142')
        cluster = response.get('cluster_id', 'Cluster 7')
        gap = response.get('gap_vs_median_pp', -9.4)

        narrations.append({
            'tavusNarration': f"Analyzing Store {store_id} against its peer group in {cluster}.",
            'tileKey': 'alerts',
            'tileData': [
                {'type': 'red', 'text': f'Gap vs cluster: {gap}pp'},
                {'type': 'amber', 'text': 'Ranked 5th of 8'},
            ]
        })

        narrations.append({
            'tavusNarration': f"Store {store_id} is trailing the cluster median by {abs(gap)} percentage points. The top performer in this cluster is Store 0318.",
            'tileKey': 'peers',
            'tileData': {
                'cluster': cluster,
                'stores': [
                    {'id': 'Store 0318', 'comp': 5.2, 'isTarget': False},
                    {'id': 'Store 0156', 'comp': 2.1, 'isTarget': False},
                    {'id': 'Store 0289', 'comp': 0.8, 'isTarget': False},
                    {'id': f'Store {store_id}', 'comp': gap + 0.5, 'isTarget': True},
                    {'id': 'Store 0167', 'comp': -10.2, 'isTarget': False},
                ]
            }
        })

        narrations.append({
            'tavusNarration': "The main gaps are in traffic and conversion. Store 0318 is getting 15% more foot traffic despite similar demographics.",
        })

    return narrations


@socketio.on('what_if')
def handle_what_if(data):
    """Handle what-if scenario request"""
    category = data.get('category', 'Apparel')
    scenario_id = data.get('scenario_id')

    if not scenario_id:
        emit('error', {"message": "scenario_id required"})
        return

    try:
        agent_system = get_agents()
        forecast = agent_system['forecast']

        result = forecast.execute_what_if(category, scenario_id)

        emit('what_if_result', {
            "category": category,
            "scenario_id": scenario_id,
            "result": result
        })
    except Exception as e:
        emit('error', {"message": str(e)})


@socketio.on('reset')
def handle_reset(data):
    """Reset session state"""
    session_id = data.get('session_id')

    if session_id and session_id in sessions:
        if sessions[session_id].get('tavus_conversation_id'):
            end_tavus_conversation(sessions[session_id]['tavus_conversation_id'])
            sessions[session_id]['tavus_conversation_id'] = None

        agent_system = get_agents()
        orchestrator = agent_system['orchestrator']
        orchestrator.clear_session(session_id)

    emit('reset_complete', {"session_id": session_id})


# === Debug Endpoints ===

@app.route('/debug/sessions')
def debug_sessions():
    """List active sessions"""
    tavus_sessions = [s for s in sessions.values() if s.get('tavus_conversation_id')]
    return jsonify({
        "sessions": len(sessions),
        "tavus_conversations": len(tavus_sessions),
        "session_ids": list(sessions.keys())
    })


@app.route('/reset-tavus', methods=['POST'])
def reset_all_tavus():
    """End all active Tavus conversations (Tavus account + local sessions)"""
    ended_ids = end_all_active_tavus_conversations()
    for session in sessions.values():
        session['tavus_conversation_id'] = None
    return jsonify({"ended": len(ended_ids), "conversation_ids": ended_ids})


# === Main Entry ===

if __name__ == '__main__':
    port = int(os.getenv('PORT', 5002))
    print(f"Starting Bealls Sales Command Center on port {port}")
    print(f"Tavus API key configured: {bool(TAVUS_API_KEY)}")
    print(f"Tavus agents configured: {list(TAVUS_AGENTS.keys())}")
    for agent_type, config in TAVUS_AGENTS.items():
        print(f"  - {agent_type}: persona={config['persona_id']}, replica={config['replica_id']}")
    print(f"Gemini configured: {bool(os.getenv('GEMINI_API_KEY'))}")
    print(f"S3 configured: {bool(os.getenv('AWS_ACCESS_KEY_ID'))}")

    # use_reloader=False avoids WinError 10048 (port already in use) on Windows
    debug = os.getenv('FLASK_DEBUG', '0').lower() in ('1', 'true', 'yes')
    socketio.run(
        app,
        host='0.0.0.0',
        port=port,
        debug=debug,
        use_reloader=False,
        allow_unsafe_werkzeug=True,
    )
