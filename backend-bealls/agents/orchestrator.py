"""
Orchestrator Agent
Root agent that owns the user-facing chat and routes to sub-agents
Handles: routing, multi-turn state, agent badge plumbing
"""

import os
import re
import google.generativeai as genai
from agents.diagnostics_agent import diagnostics_agent
from agents.forecast_agent import forecast_agent
from agents.store_comparison_agent import store_comparison_agent


class OrchestratorAgent:
    def __init__(self):
        self.agent_id = "orchestrator"
        self.agent_name = "Orchestrator"

        api_key = os.getenv('GEMINI_API_KEY')
        if api_key:
            genai.configure(api_key=api_key)
            self.classifier_model = genai.GenerativeModel('gemini-2.5-flash')
        else:
            self.classifier_model = None

        self.conversation_history = {}

        self.agents = {
            "diagnostics": diagnostics_agent,
            "forecast": forecast_agent,
            "store_comparison": store_comparison_agent
        }

        self.canonical_prompts = {
            "store_0214_down": {
                "route": "diagnostics",
                "store_id": "0214",
                "query": "Why is Store 0214 down?"
            },
            "apparel_forecast": {
                "route": "forecast",
                "category": "Apparel",
                "weeks": 12,
                "query": "What is the 12-week Apparel forecast?"
            },
            "store_142_cluster": {
                "route": "store_comparison",
                "store_id": "0142",
                "query": "Why does Store 142 lag its cluster?"
            }
        }

    def route_query(self, query: str) -> dict:
        """Route query using semantic analysis with Gemini for deterministic routing"""

        if self.classifier_model:
            return self._classify_with_gemini(query)

        return {"agent": "diagnostics", "confidence": 0.5, "error": "Gemini not configured"}

    def _classify_with_gemini(self, query: str) -> dict:
        """Use Gemini for semantic analysis and deterministic routing"""
        error_msg = None
        try:
            prompt = f"""You are a query router for a retail analytics system. Analyze the SEMANTIC MEANING of the query and classify it.

QUERY: "{query}"

AGENT DEFINITIONS:

1. DIAGNOSTICS AGENT
   - Purpose: Explain WHY metrics changed, root cause analysis, variance decomposition
   - Handles: "Why is store down?", "What's causing the decline?", "Explain the drop", "What's wrong with performance?"
   - Key intent: Understanding PAST/CURRENT problems and their causes

2. FORECAST AGENT
   - Purpose: Future predictions, projections, what-if scenarios, demand planning
   - Handles: "What will sales be?", "Predict next quarter", "What if we change promo timing?", "Project demand"
   - Key intent: Predicting FUTURE outcomes or modeling scenarios

3. STORE_COMPARISON AGENT
   - Purpose: Benchmarking, peer comparison, cluster analysis, ranking stores
   - Handles: "How does store X compare to peers?", "Why is store lagging cluster?", "Rank stores", "Best/worst performers"
   - Key intent: COMPARING entities against each other or group

ANALYSIS STEPS:
1. Identify the core intent of the query
2. Determine if it's about PAST/CURRENT (diagnostics), FUTURE (forecast), or COMPARISON (store_comparison)
3. Match to the most appropriate agent

Respond with ONLY one word: diagnostics OR forecast OR store_comparison
"""
            response = self.classifier_model.generate_content(prompt)
            agent = response.text.strip().lower().replace(" ", "_")

            if "diagnostic" in agent:
                agent = "diagnostics"
            elif "forecast" in agent:
                agent = "forecast"
            elif "comparison" in agent or "store" in agent:
                agent = "store_comparison"

            if agent in self.agents:
                return {"agent": agent, "confidence": 0.95, "method": "semantic_analysis"}
            else:
                error_msg = f"Unknown agent returned: {agent}"

        except Exception as e:
            error_msg = str(e)
            print(f"Gemini classification error: {e}")

        return {"agent": "diagnostics", "confidence": 0.5, "error": error_msg or "classification_failed"}

    def extract_parameters(self, query: str, agent_type: str) -> dict:
        """Extract relevant parameters from the query"""
        params = {}

        store_match = re.search(r'store\s*[#]?(\d+)', query.lower())
        if store_match:
            store_num = store_match.group(1)
            params['store_id'] = store_num.zfill(4)

        categories = ['apparel', 'footwear', 'home', 'kids', 'accessories', 'beauty', 'jewelry', 'outdoor']
        for cat in categories:
            if cat in query.lower():
                params['category'] = cat.capitalize()
                break

        weeks_match = re.search(r'(\d+)\s*week', query.lower())
        if weeks_match:
            params['weeks'] = int(weeks_match.group(1))

        if 'pull forward' in query.lower() or 'pull-forward' in query.lower():
            params['scenario_id'] = 'promo_pull_forward_2w'
        elif 'push out' in query.lower() or 'push-out' in query.lower():
            params['scenario_id'] = 'promo_push_out_1w'
        elif 'price cut' in query.lower():
            params['scenario_id'] = 'price_cut_10pct'

        return params

    def process_query(self, query: str, session_id: str, context: dict = None) -> dict:
        """Process a user query through the appropriate agent"""

        if session_id not in self.conversation_history:
            self.conversation_history[session_id] = []

        self.conversation_history[session_id].append({
            "role": "user",
            "content": query
        })

        routing = self.route_query(query)
        agent_type = routing['agent']
        agent = self.agents.get(agent_type)

        if not agent:
            return {
                "error": f"Unknown agent type: {agent_type}",
                "agent_badge": None
            }

        params = self.extract_parameters(query, agent_type)

        context_slice = self._get_context_slice(session_id)

        if agent_type == "diagnostics":
            store_id = params.get('store_id', '0214')
            result = agent.execute(query, store_id=store_id, context=context_slice)

        elif agent_type == "forecast":
            category = params.get('category', 'Apparel')
            weeks = params.get('weeks', 12)
            scenario_id = params.get('scenario_id')
            result = agent.execute(query, category=category, weeks=weeks,
                                  scenario_id=scenario_id, context=context_slice)

        elif agent_type == "store_comparison":
            store_id = params.get('store_id', '0142')
            result = agent.execute(query, store_id=store_id, context=context_slice)

        else:
            result = {"error": "Agent execution failed"}

        self.conversation_history[session_id].append({
            "role": "assistant",
            "agent": agent_type,
            "content": result.get('verdict', ''),
            "full_response": result
        })

        return {
            "routing": routing,
            "agent_id": result.get('agent_id', agent_type),
            "agent_name": result.get('agent_name', agent_type.replace('_', ' ').title()),
            "agent_badge": result.get('agent_badge', ''),
            "response": result
        }

    def _get_context_slice(self, session_id: str, max_turns: int = 5) -> dict:
        """Get relevant conversation context for the sub-agent"""
        history = self.conversation_history.get(session_id, [])

        recent = history[-max_turns * 2:] if len(history) > max_turns * 2 else history

        return {
            "history": recent,
            "turn_count": len(history) // 2
        }

    def get_suggested_prompts(self, persona: str = None) -> list:
        """Get suggested prompts for conversation starters"""
        prompts = {
            "store_manager": [
                {"text": "Why is Store 0214 down?", "agent": "diagnostics"},
                {"text": "Show me traffic trends for Store 0214", "agent": "diagnostics"},
                {"text": "What's driving the comp decline?", "agent": "diagnostics"}
            ],
            "merchandiser": [
                {"text": "What's the 12-week Apparel forecast?", "agent": "forecast"},
                {"text": "Run a what-if: pull promo forward 2 weeks", "agent": "forecast"},
                {"text": "Show Footwear forecast by week", "agent": "forecast"}
            ],
            "regional_vp": [
                {"text": "Why does Store 142 lag its cluster?", "agent": "store_comparison"},
                {"text": "Compare Store 142 to top performers", "agent": "store_comparison"},
                {"text": "Show me cluster 7 rankings", "agent": "store_comparison"}
            ]
        }

        if persona and persona.lower().replace(' ', '_') in prompts:
            return prompts[persona.lower().replace(' ', '_')]

        return [
            {"text": "Why is Store 0214 down?", "agent": "diagnostics", "persona": "Store Manager"},
            {"text": "What's the 12-week Apparel forecast?", "agent": "forecast", "persona": "Merchandiser"},
            {"text": "Why does Store 142 lag its cluster?", "agent": "store_comparison", "persona": "Regional VP"}
        ]

    def clear_session(self, session_id: str):
        """Clear conversation history for a session"""
        if session_id in self.conversation_history:
            del self.conversation_history[session_id]

    def get_session_history(self, session_id: str) -> list:
        """Get conversation history for a session"""
        return self.conversation_history.get(session_id, [])


orchestrator = OrchestratorAgent()
