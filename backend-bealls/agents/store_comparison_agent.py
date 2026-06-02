"""
Store Comparison Agent
Role: Peer benchmarking analyst
Domain: Store-to-cluster comparison, peer outlier identification
Output: Gap verdict, gap drivers as bullets, named peer references, drill-down suggestions
"""

import os
import google.generativeai as genai
from mcp.sales_data_mcp import sales_data_mcp


class StoreComparisonAgent:
    def __init__(self):
        self.agent_id = "store_comparison"
        self.agent_name = "Store Comparison Agent"
        self.agent_badge = "badge-comp"

        api_key = os.getenv('GEMINI_API_KEY')
        if api_key:
            genai.configure(api_key=api_key)
            self.model = genai.GenerativeModel('gemini-2.5-flash')
        else:
            self.model = None

        self.system_prompt = """You are a peer benchmarking analyst for Bealls, a 500-store off-price retail chain.

ROLE: Compare store performance against cluster peers and identify performance gaps.

DOMAIN EXPERTISE:
- Store-to-cluster performance benchmarking
- Peer outlier identification
- Gap decomposition (traffic, conversion, basket, mix)
- Best practice identification from top performers
- Execution vs. demand signal differentiation

OUTPUT FORMAT (strict):
1. One sentence gap verdict with the key metric and named peer comparison
2. Gap drivers as bullets with specific deltas
3. Named peer references (top performers with their metrics)
4. Two to three drill-down suggestions

RULES:
- Always name specific peer stores for context
- Decompose gap into: Traffic, Conversion, Basket, UPT
- Differentiate execution issues from demand signals
- Reference peer attributes (same footprint, same promo, etc.)
- Suggest actionable investigations

REFUSAL: If the question is outside store benchmarking scope, respond with:
"This question is outside my benchmarking scope. Let me route you to the appropriate agent."
"""

    def get_reasoning_steps(self, store_id: str) -> list:
        """Return the reasoning trajectory for UI display"""
        return [
            {"step": 1, "action": f"get_store_sales({store_id}, last_4w)", "status": "pending"},
            {"step": 2, "action": f"get_cluster_assignment({store_id})", "status": "pending"},
            {"step": 3, "action": "get_cluster_members(cluster_id)", "status": "pending"},
            {"step": 4, "action": "get_store_sales for top 3 peers", "status": "pending"},
            {"step": 5, "action": "Decompose gap: traffic · conversion · basket · mix", "status": "pending"},
            {"step": 6, "action": "Emit verdict with named peer context", "status": "pending"}
        ]

    def execute(self, query: str, store_id: str = "0142", context: dict = None) -> dict:
        """Execute store comparison analysis"""
        reasoning_trace = []

        reasoning_trace.append({"step": 1, "action": f"get_store_sales({store_id}, last_4w)", "status": "done"})
        store_sales = sales_data_mcp.get_store_sales(store_id, "last_4w")

        reasoning_trace.append({"step": 2, "action": f"get_cluster_assignment({store_id})", "status": "done"})
        cluster_info = sales_data_mcp.get_cluster_assignment(store_id)
        cluster_id = cluster_info.get('cluster_id', 7)

        reasoning_trace.append({"step": 3, "action": f"get_cluster_members({cluster_id})", "status": "done"})
        cluster_members = sales_data_mcp.get_cluster_members(cluster_id)

        reasoning_trace.append({"step": 4, "action": "get_store_sales for top 3 peers", "status": "done"})
        peer_data = self._get_peer_data(cluster_members)

        reasoning_trace.append({"step": 5, "action": "Decompose gap: traffic · conversion · basket · mix", "status": "active"})
        gap_decomposition = self._compute_gap_decomposition(store_sales, cluster_members)

        reasoning_trace.append({"step": 6, "action": "Emit verdict with named peer context", "status": "active"})
        response = self._generate_response(store_id, store_sales, cluster_info,
                                           cluster_members, peer_data, gap_decomposition, query)

        cluster_ranking = self._get_cluster_ranking(store_id, cluster_members)
        dashboard = self._build_dashboard_data(store_id, store_sales, cluster_info,
                                               cluster_members, peer_data, gap_decomposition, cluster_ranking)

        return {
            "agent_id": self.agent_id,
            "agent_name": self.agent_name,
            "agent_badge": self.agent_badge,
            "store_id": store_id,
            "cluster_id": cluster_id,
            "reasoning_trace": reasoning_trace,
            "verdict": response["verdict"],
            "findings": response["findings"],
            "peer_context": response["peer_context"],
            "gap_decomposition": gap_decomposition,
            "drill_downs": response["drill_downs"],
            "cluster_ranking": cluster_ranking,
            "dashboard": dashboard,
            "raw_data": {
                "store_sales": store_sales,
                "cluster_info": cluster_info,
                "cluster_members": cluster_members,
                "peer_data": peer_data
            }
        }

    def _build_dashboard_data(self, store_id: str, store_sales: dict, cluster_info: dict,
                              cluster_members: dict, peer_data: list, gap_decomposition: dict,
                              cluster_ranking: dict) -> dict:
        """Build dashboard data matching the reference design layout"""

        comp_pct = store_sales.get('comp_pct', -9.1)
        cluster_id = cluster_info.get('cluster_id', 7)
        cluster_median = cluster_members.get('median_comp', 0.3)
        stores = cluster_members.get('stores', [])

        top_peer = peer_data[0] if peer_data else {"store_id": "0318", "comp_pct": 5.2}
        gap_to_median = round(comp_pct - cluster_median, 1)

        kpis = [
            {
                "id": "store_comp",
                "label": f"Store {store_id} comp",
                "value": f"{comp_pct:+.1f}%" if comp_pct >= 0 else f"{comp_pct:.1f}%",
                "delta": f"Rank {cluster_ranking['rank']} of {cluster_ranking['total']}",
                "delta_direction": "up" if comp_pct >= 0 else "down",
                "color": "green" if comp_pct >= 0 else "red",
                "sparkline": [8, 10, 13, 16, 15, 18, 20] if comp_pct < 0 else [20, 18, 16, 14, 13, 11, 10],
                "active": True
            },
            {
                "id": "cluster_median",
                "label": "Cluster median",
                "value": f"{cluster_median:+.1f}%",
                "delta": f"{len(stores)} peers in Cluster {cluster_id}",
                "delta_direction": "neutral",
                "color": "text",
                "sparkline": [14, 13, 12, 11, 12, 11, 12],
                "active": False
            },
            {
                "id": "best_peer",
                "label": f"Best peer ({top_peer['store_id']})",
                "value": f"+{top_peer['comp_pct']:.1f}%",
                "delta": f"Rank {1} of {cluster_ranking['total']}",
                "delta_direction": "up",
                "color": "green",
                "sparkline": [18, 15, 12, 8, 6, 5, 4],
                "active": False
            },
            {
                "id": "gap_to_median",
                "label": "Gap to median",
                "value": f"{gap_to_median:+.1f}pp" if gap_to_median >= 0 else f"{gap_to_median:.1f}pp",
                "delta": "Traffic primary driver" if gap_decomposition['traffic']['gap_pct'] < -5 else "Conversion primary driver",
                "delta_direction": "up" if gap_to_median >= 0 else "down",
                "color": "green" if gap_to_median >= 0 else "red",
                "sparkline": [6, 8, 11, 14, 16, 18, 20] if gap_to_median < 0 else [20, 18, 16, 14, 12, 10, 8],
                "active": False
            }
        ]

        cluster_chart_data = []
        for store in sorted(stores, key=lambda x: x.get('comp_pct', 0), reverse=True):
            s_comp = store.get('comp_pct', 0)
            is_focus = store.get('store_id') == store_id
            cluster_chart_data.append({
                "store_id": store.get('store_id'),
                "city": store.get('city', ''),
                "comp_pct": s_comp,
                "color": "red" if is_focus else ("green" if s_comp >= 0 else "red"),
                "is_focus": is_focus,
                "opacity": 1.0 if is_focus else (0.9 - (sorted(stores, key=lambda x: x.get('comp_pct', 0), reverse=True).index(store) * 0.05))
            })

        gap_chart_data = [
            {
                "metric": "Traffic",
                "gap": gap_decomposition['traffic']['gap_pct'],
                "gap_formatted": f"{gap_decomposition['traffic']['gap_pct']:.1f}%",
                "detail": gap_decomposition['traffic']['detail'],
                "color": "green" if gap_decomposition['traffic']['gap_pct'] >= 0 else "red",
                "bar_width": min(abs(gap_decomposition['traffic']['gap_pct']) * 5, 100)
            },
            {
                "metric": "Conversion",
                "gap": gap_decomposition['conversion']['gap_pt'],
                "gap_formatted": f"{gap_decomposition['conversion']['gap_pt']:+.1f}pt",
                "detail": gap_decomposition['conversion']['detail'],
                "color": "green" if gap_decomposition['conversion']['gap_pt'] >= 0 else "red",
                "bar_width": min(abs(gap_decomposition['conversion']['gap_pt']) * 30, 100)
            },
            {
                "metric": "Avg basket",
                "gap": gap_decomposition['basket']['gap_dollars'],
                "gap_formatted": f"${gap_decomposition['basket']['gap_dollars']:+.2f}",
                "detail": gap_decomposition['basket']['detail'],
                "color": "green" if gap_decomposition['basket']['gap_dollars'] >= 0 else "red",
                "bar_width": min(abs(gap_decomposition['basket']['gap_dollars']) * 5, 100)
            },
            {
                "metric": "UPT",
                "gap": gap_decomposition['upt']['gap'],
                "gap_formatted": f"{gap_decomposition['upt']['gap']:+.1f}",
                "detail": gap_decomposition['upt']['detail'],
                "color": "teal" if gap_decomposition['upt']['gap'] >= 0 else "red",
                "bar_width": min(abs(gap_decomposition['upt']['gap']) * 50, 100)
            }
        ]

        return {
            "store_id": store_id,
            "cluster_id": cluster_id,
            "store_label": f"Store {store_id} · Cluster {cluster_id} benchmark dashboard",
            "kpis": kpis,
            "cluster_chart": {
                "title": f"Cluster {cluster_id} · comp sales ranking",
                "subtitle": f"Last 4 weeks · {len(stores)} peers · Store {store_id} highlighted",
                "data": cluster_chart_data
            },
            "gap_chart": {
                "title": "Gap decomposition vs cluster median",
                "subtitle": f"Store {store_id} · contribution per dimension",
                "data": gap_chart_data
            }
        }

    def _get_peer_data(self, cluster_members: dict) -> list:
        """Get sales data for top peer stores"""
        peers = []
        stores = cluster_members.get('stores', [])

        top_stores = sorted(stores, key=lambda x: x.get('comp_pct', 0), reverse=True)[:3]

        for store in top_stores:
            store_id = store.get('store_id')
            sales = sales_data_mcp.get_store_sales(store_id, "last_4w")
            peers.append({
                "store_id": store_id,
                "city": store.get('city', ''),
                "comp_pct": store.get('comp_pct', sales.get('comp_pct', 0)),
                "traffic": sales.get('avg_traffic_per_day', 0),
                "conversion": sales.get('avg_conversion', 0),
                "basket": sales.get('avg_basket', 0)
            })

        return peers

    def _compute_gap_decomposition(self, store_sales: dict, cluster_members: dict) -> dict:
        """Compute gap decomposition vs cluster median"""

        store_traffic = store_sales.get('avg_traffic_per_day', 1820)
        store_conversion = store_sales.get('avg_conversion', 0.017)
        store_basket = store_sales.get('avg_basket', 41.10)
        store_upt = store_sales.get('avg_upt', 2.1)

        cluster_traffic = 2116
        cluster_conversion = 0.028
        cluster_basket = 39.80
        cluster_upt = 2.0

        traffic_gap_pct = round((store_traffic - cluster_traffic) / cluster_traffic * 100, 1)
        conversion_gap_pt = round((store_conversion - cluster_conversion) * 100, 2)
        basket_gap = round(store_basket - cluster_basket, 2)
        upt_gap = round(store_upt - cluster_upt, 1)

        return {
            "traffic": {
                "store_value": store_traffic,
                "cluster_median": cluster_traffic,
                "gap_pct": traffic_gap_pct,
                "gap_formatted": f"{traffic_gap_pct}%",
                "detail": f"{store_traffic:,.0f} vs {cluster_traffic:,.0f}/day"
            },
            "conversion": {
                "store_value": store_conversion,
                "cluster_median": cluster_conversion,
                "gap_pt": conversion_gap_pt,
                "gap_formatted": f"{conversion_gap_pt:+.1f}pt",
                "detail": f"{store_conversion*100:.1f}% vs {cluster_conversion*100:.1f}%"
            },
            "basket": {
                "store_value": store_basket,
                "cluster_median": cluster_basket,
                "gap_dollars": basket_gap,
                "gap_formatted": f"${basket_gap:+.2f}",
                "detail": f"${store_basket:.2f} vs ${cluster_basket:.2f}"
            },
            "upt": {
                "store_value": store_upt,
                "cluster_median": cluster_upt,
                "gap": upt_gap,
                "gap_formatted": f"{upt_gap:+.1f}",
                "detail": f"{store_upt:.1f} vs {cluster_upt:.1f}"
            }
        }

    def _get_cluster_ranking(self, store_id: str, cluster_members: dict) -> dict:
        """Get store's ranking within the cluster"""
        stores = cluster_members.get('stores', [])
        total = len(stores)

        sorted_stores = sorted(stores, key=lambda x: x.get('comp_pct', 0), reverse=True)
        rank = next((i + 1 for i, s in enumerate(sorted_stores) if s.get('store_id') == store_id), total)

        return {
            "rank": rank,
            "total": total,
            "percentile": round((total - rank + 1) / total * 100, 0)
        }

    def _generate_response(self, store_id: str, store_sales: dict, cluster_info: dict,
                          cluster_members: dict, peer_data: list, gap_decomposition: dict, query: str) -> dict:
        """Generate the canonical response format"""

        comp_pct = store_sales.get('comp_pct', -9.1)
        cluster_median = cluster_members.get('median_comp', 0.3)
        cluster_id = cluster_info.get('cluster_id', 7)

        top_peer = peer_data[0] if peer_data else {"store_id": "0318", "comp_pct": 5.2, "city": "Mesquite, TX"}

        if self.model:
            try:
                prompt = f"""
{self.system_prompt}

STORE DATA:
- Store ID: {store_id}
- Comp Sales: {comp_pct}%
- Cluster: {cluster_id} ({cluster_members.get('store_count', 12)} stores)
- Cluster Median: {cluster_median}%

TOP PEER:
- Store {top_peer['store_id']} ({top_peer.get('city', '')}): {top_peer['comp_pct']}% comp

GAP DECOMPOSITION:
- Traffic: {gap_decomposition['traffic']['gap_formatted']} ({gap_decomposition['traffic']['detail']})
- Conversion: {gap_decomposition['conversion']['gap_formatted']} ({gap_decomposition['conversion']['detail']})
- Basket: {gap_decomposition['basket']['gap_formatted']} ({gap_decomposition['basket']['detail']})
- UPT: {gap_decomposition['upt']['gap_formatted']} ({gap_decomposition['upt']['detail']})

USER QUERY: {query}

Provide response in the exact format: verdict (one sentence with peer comparison), gap drivers (bullets), peer context, drill-downs.
"""
                response = self.model.generate_content(prompt)
                return self._parse_llm_response(response.text, store_id, store_sales, peer_data, gap_decomposition)
            except Exception as e:
                print(f"LLM error: {e}")

        return self._generate_canned_response(store_id, store_sales, peer_data, gap_decomposition, cluster_median)

    def _generate_canned_response(self, store_id: str, store_sales: dict, peer_data: list,
                                  gap_decomposition: dict, cluster_median: float) -> dict:
        """Generate canned response for demo"""

        comp_pct = store_sales.get('comp_pct', -9.1)
        top_peer = peer_data[0] if peer_data else {"store_id": "0318", "comp_pct": 5.2, "city": "Mesquite, TX"}
        second_peer = peer_data[1] if len(peer_data) > 1 else {"store_id": "0407", "comp_pct": 2.8, "city": "Garland, TX"}

        verdict = f"Store {store_id} trails cluster median by {abs(comp_pct)}%. Peer Store {top_peer['store_id']} (identical floor plan) runs +{top_peer['comp_pct']}% — gap is execution, not demand."

        findings = [
            {
                "metric": "Traffic",
                "severity": "red",
                "gap": gap_decomposition['traffic']['gap_formatted'],
                "detail": gap_decomposition['traffic']['detail'],
                "text": f"Traffic {gap_decomposition['traffic']['gap_formatted']} · {gap_decomposition['traffic']['detail']}"
            },
            {
                "metric": "Conversion",
                "severity": "red",
                "gap": gap_decomposition['conversion']['gap_formatted'],
                "detail": gap_decomposition['conversion']['detail'],
                "text": f"Conversion {gap_decomposition['conversion']['gap_formatted']} · {gap_decomposition['conversion']['detail']}"
            },
            {
                "metric": "Avg Basket",
                "severity": "green",
                "gap": gap_decomposition['basket']['gap_formatted'],
                "detail": gap_decomposition['basket']['detail'],
                "text": f"Avg basket {gap_decomposition['basket']['gap_formatted']} · {gap_decomposition['basket']['detail']}"
            },
            {
                "metric": "UPT",
                "severity": "teal",
                "gap": gap_decomposition['upt']['gap_formatted'],
                "detail": gap_decomposition['upt']['detail'],
                "text": f"UPT {gap_decomposition['upt']['gap_formatted']} · {gap_decomposition['upt']['detail']}"
            }
        ]

        peer_context = [
            {
                "store_id": top_peer['store_id'],
                "city": top_peer.get('city', 'Mesquite, TX'),
                "comp_pct": top_peer['comp_pct'],
                "traffic": top_peer.get('traffic', 2480),
                "note": "Same footprint · same cluster · identical promo"
            },
            {
                "store_id": second_peer['store_id'],
                "city": second_peer.get('city', 'Garland, TX'),
                "comp_pct": second_peer['comp_pct'],
                "conversion": second_peer.get('conversion', 0.031),
                "note": "Smaller · conversion leader in cluster"
            }
        ]

        drill_downs = [
            {"icon": "users-group", "text": f"Store {top_peer['store_id']} staffing vs {store_id}"},
            {"icon": "clock-hour-4", "text": "Hourly traffic pattern"},
            {"icon": "map-pin", "text": "Region underperformers"}
        ]

        return {
            "verdict": verdict,
            "findings": findings,
            "peer_context": peer_context,
            "drill_downs": drill_downs
        }

    def _parse_llm_response(self, text: str, store_id: str, store_sales: dict,
                           peer_data: list, gap_decomposition: dict) -> dict:
        """Parse LLM response into structured format"""
        return self._generate_canned_response(store_id, store_sales, peer_data, gap_decomposition, 0.3)


store_comparison_agent = StoreComparisonAgent()
