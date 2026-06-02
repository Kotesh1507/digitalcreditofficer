"""
Forecast Agent
Role: Retail demand forecaster
Domain: 12-week forward forecast at store, category, and chain grain
Output: Forecast verdict, range band, drivers, what-if branch, drill-down suggestions
"""

import os
import google.generativeai as genai
from mcp.sales_data_mcp import sales_data_mcp
from mcp.calendar_mcp import calendar_mcp
from mcp.forecast_mcp import forecast_mcp


class ForecastAgent:
    def __init__(self):
        self.agent_id = "forecast"
        self.agent_name = "Forecast Agent"
        self.agent_badge = "badge-fore"

        api_key = os.getenv('GEMINI_API_KEY')
        if api_key:
            genai.configure(api_key=api_key)
            self.model = genai.GenerativeModel('gemini-2.5-flash')
        else:
            self.model = None

        self.system_prompt = """You are a retail demand forecaster for Bealls, a 500-store off-price retail chain.

ROLE: Generate and explain category-level demand forecasts with confidence bands.

DOMAIN EXPERTISE:
- 12-week forward forecasting at store, category, and chain grain
- What-if scenario modeling for promo timing, price, and inventory
- Seasonality and trend decomposition
- Confidence interval estimation
- Driver attribution

OUTPUT FORMAT (strict):
1. One sentence forecast verdict with total range and key driver
2. Forecast band (base, upper, lower) with confidence level
3. Key drivers with revenue impact
4. What-if scenario impact if requested
5. Two to three drill-down suggestions

RULES:
- Always provide a confidence band (typically 80%)
- Quantify driver impacts in dollars
- For what-if scenarios, show before/after comparison
- Highlight the single biggest upside and downside risk
- Keep responses concise and actionable

REFUSAL: If the question is outside forecasting scope, respond with:
"This question is outside my forecasting scope. Let me route you to the appropriate agent."
"""

    def get_reasoning_steps(self, category: str) -> list:
        """Return the reasoning trajectory for UI display"""
        return [
            {"step": 1, "action": f"get_forecast({category}, 12)", "status": "pending"},
            {"step": 2, "action": f"get_forecast_band({category}, 12, 0.8)", "status": "pending"},
            {"step": 3, "action": "get_calendar_overlay(next_12w)", "status": "pending"},
            {"step": 4, "action": f"get_category_sales({category}, last_12w)", "status": "pending"},
            {"step": 5, "action": "Build band + driver decomposition", "status": "pending"},
            {"step": 6, "action": "Emit forecast verdict", "status": "pending"}
        ]

    def execute(self, query: str, category: str = "Apparel", weeks: int = 12,
                scenario_id: str = None, context: dict = None) -> dict:
        """Execute forecast analysis for a category"""
        reasoning_trace = []

        reasoning_trace.append({"step": 1, "action": f"get_forecast({category}, {weeks})", "status": "done"})
        base_forecast = forecast_mcp.get_forecast(category, weeks)

        reasoning_trace.append({"step": 2, "action": f"get_forecast_band({category}, {weeks}, 0.8)", "status": "done"})
        forecast_band = forecast_mcp.get_forecast_band(category, weeks, 0.8)

        reasoning_trace.append({"step": 3, "action": "get_calendar_overlay(next_12w)", "status": "done"})
        calendar = calendar_mcp.get_calendar_overlay("next_12w")

        reasoning_trace.append({"step": 4, "action": f"get_category_sales({category}, last_12w)", "status": "done"})
        historical = sales_data_mcp.get_category_sales(category, "last_12w")

        what_if_result = None
        if scenario_id:
            reasoning_trace.append({"step": 5, "action": f"get_what_if_scenario({category}, {scenario_id})", "status": "done"})
            what_if_result = forecast_mcp.get_what_if_scenario(category, scenario_id)

        reasoning_trace.append({"step": 5 if not scenario_id else 6, "action": "Build band + driver decomposition", "status": "active"})
        reasoning_trace.append({"step": 6 if not scenario_id else 7, "action": "Emit forecast verdict", "status": "active"})

        response = self._generate_response(category, base_forecast, forecast_band,
                                           calendar, historical, what_if_result, query)

        dashboard = self._build_dashboard_data(category, weeks, base_forecast, forecast_band, what_if_result)

        return {
            "agent_id": self.agent_id,
            "agent_name": self.agent_name,
            "agent_badge": self.agent_badge,
            "category": category,
            "weeks": weeks,
            "reasoning_trace": reasoning_trace,
            "verdict": response["verdict"],
            "forecast_summary": {
                "base": base_forecast.get('base_total', 4500000),
                "upper": forecast_band.get('upper_bound', 4800000),
                "lower": forecast_band.get('lower_bound', 4200000),
                "confidence": 0.80
            },
            "drivers": forecast_band.get('drivers', []),
            "what_if": what_if_result,
            "drill_downs": response["drill_downs"],
            "weekly_band": forecast_band.get('weekly_band', {}),
            "dashboard": dashboard,
            "raw_data": {
                "base_forecast": base_forecast,
                "forecast_band": forecast_band,
                "calendar": calendar,
                "historical": historical
            }
        }

    def _build_dashboard_data(self, category: str, weeks: int, base_forecast: dict,
                              forecast_band: dict, what_if: dict) -> dict:
        """Build dashboard data matching the reference design layout"""

        base = base_forecast.get('base_total', 4500000)
        upper = forecast_band.get('upper_bound', 4800000)
        lower = forecast_band.get('lower_bound', 4200000)
        drivers = forecast_band.get('drivers', [])

        base_m = base / 1000000
        upper_m = upper / 1000000
        lower_m = lower / 1000000

        kpis = [
            {
                "id": "base_forecast",
                "label": "Base forecast",
                "value": f"${base_m:.1f}M",
                "delta": f"{weeks}-week total",
                "delta_direction": "neutral",
                "color": "accent",
                "sparkline": [18, 15, 12, 8, 10, 7, 9],
                "active": True
            },
            {
                "id": "upside_band",
                "label": "Upside band",
                "value": f"${upper_m:.1f}M",
                "delta": f"+{((upper - base) / base * 100):.1f}% vs base",
                "delta_direction": "up",
                "color": "green",
                "sparkline": [20, 16, 12, 8, 6, 4, 5],
                "active": False
            },
            {
                "id": "downside_band",
                "label": "Downside band",
                "value": f"${lower_m:.1f}M",
                "delta": f"{((lower - base) / base * 100):.1f}% vs base",
                "delta_direction": "down",
                "color": "red",
                "sparkline": [8, 10, 13, 15, 14, 16, 18],
                "active": False
            },
            {
                "id": "confidence",
                "label": "Confidence",
                "value": "80%",
                "delta": "W6 promo anchored",
                "delta_direction": "neutral",
                "color": "text",
                "sparkline": [14, 13, 12, 10, 11, 10, 10],
                "active": False
            }
        ]

        weekly_band = forecast_band.get('weekly_band', {})
        forecast_chart_data = []
        for i in range(weeks):
            week_num = i + 1
            base_val = weekly_band.get('base', [{}] * weeks)[i].get('forecast', base / weeks) if weekly_band else base / weeks
            upper_val = weekly_band.get('upper', [{}] * weeks)[i].get('forecast', upper / weeks) if weekly_band else upper / weeks
            lower_val = weekly_band.get('lower', [{}] * weeks)[i].get('forecast', lower / weeks) if weekly_band else lower / weeks

            forecast_chart_data.append({
                "week": week_num,
                "base": base_val,
                "upper": upper_val,
                "lower": lower_val,
                "has_promo": week_num == 6
            })

        drivers_chart = []
        for d in drivers:
            drivers_chart.append({
                "name": d.get('name', ''),
                "impact": d.get('impact', 0),
                "impact_formatted": f"+${d.get('impact', 0) / 1000:.0f}K" if d.get('direction') == 'positive' else f"-${abs(d.get('impact', 0)) / 1000:.0f}K",
                "color": "green" if d.get('direction') == 'positive' else "red"
            })

        what_if_scenarios = [
            {
                "id": "promo_pull_forward_2w",
                "label": "Promo pull-forward 2 weeks",
                "revenue_impact": "+$180K",
                "risk": "↓W8 rebound",
                "confidence": "80%",
                "active": what_if and what_if.get('scenario_id') == 'promo_pull_forward_2w'
            },
            {
                "id": "promo_push_out_1w",
                "label": "Promo push-out 1 week",
                "revenue_impact": "+$95K",
                "risk": "↓W10 rebound",
                "confidence": "75%",
                "active": what_if and what_if.get('scenario_id') == 'promo_push_out_1w'
            },
            {
                "id": "price_cut_10pct",
                "label": "Price cut -10%",
                "revenue_impact": "+$210K",
                "risk": "Margin -0.8pt",
                "confidence": "70%",
                "active": what_if and what_if.get('scenario_id') == 'price_cut_10pct'
            }
        ]

        return {
            "category": category,
            "weeks": weeks,
            "store_label": f"{category} · {weeks}-week forecast dashboard",
            "kpis": kpis,
            "forecast_chart": {
                "title": f"{weeks}-week {category} projection band",
                "subtitle": "Base · 80% confidence interval · What-if overlay",
                "data": forecast_chart_data
            },
            "drivers_chart": {
                "title": "Driver contribution to forecast",
                "subtitle": f"Revenue impact over {weeks} weeks",
                "data": drivers_chart
            },
            "what_if_scenarios": what_if_scenarios
        }

    def execute_what_if(self, category: str, scenario_id: str) -> dict:
        """Execute what-if scenario analysis"""
        what_if = forecast_mcp.get_what_if_scenario(category, scenario_id)

        return {
            "agent_id": self.agent_id,
            "agent_name": self.agent_name,
            "scenario": what_if,
            "summary": self._generate_what_if_summary(what_if)
        }

    def _generate_response(self, category: str, base_forecast: dict, forecast_band: dict,
                          calendar: dict, historical: dict, what_if: dict, query: str) -> dict:
        """Generate the canonical response format"""

        base = base_forecast.get('base_total', 4500000)
        upper = forecast_band.get('upper_bound', 4800000)
        lower = forecast_band.get('lower_bound', 4200000)
        drivers = forecast_band.get('drivers', [])

        if self.model:
            try:
                prompt = f"""
{self.system_prompt}

FORECAST DATA:
- Category: {category}
- Base Forecast: ${base:,.0f}
- Upper Band (80% CI): ${upper:,.0f}
- Lower Band (80% CI): ${lower:,.0f}
- Upcoming Events: {calendar.get('events', [])}

DRIVERS:
{self._format_drivers(drivers)}

WHAT-IF SCENARIO: {what_if.get('scenario_name', 'None') if what_if else 'None'}

USER QUERY: {query}

Provide response in the exact format: verdict (one sentence with range), drivers summary, drill-downs (2-3 suggestions).
"""
                response = self.model.generate_content(prompt)
                return self._parse_llm_response(response.text, category, base, upper, lower, drivers)
            except Exception as e:
                print(f"LLM error: {e}")

        return self._generate_canned_response(category, base, upper, lower, drivers)

    def _generate_canned_response(self, category: str, base: int, upper: int, lower: int, drivers: list) -> dict:
        """Generate canned response for demo"""

        lower_m = lower / 1000000
        upper_m = upper / 1000000
        base_m = base / 1000000

        verdict = f"{category} projected at ${lower_m:.1f}M-${upper_m:.1f}M (base ${base_m:.1f}M). Promo W6 adds +$340K. Seasonal tail W9-W11 is the primary downside risk."

        drill_downs = [
            {"icon": "layout-list", "text": "Forecast by sub-category"},
            {"icon": "box-off", "text": "Inventory risk scenario"},
            {"icon": "calendar-stats", "text": "YoY comparison"}
        ]

        return {
            "verdict": verdict,
            "drill_downs": drill_downs
        }

    def _generate_what_if_summary(self, what_if: dict) -> dict:
        """Generate summary for what-if scenario"""
        if not what_if or 'error' in what_if:
            return {"error": "Invalid scenario"}

        return {
            "scenario_name": what_if.get('scenario_name', ''),
            "revenue_impact": what_if.get('revenue_impact', 0),
            "revenue_impact_formatted": f"+${what_if.get('revenue_impact', 0)/1000:.0f}K" if what_if.get('revenue_impact', 0) > 0 else f"-${abs(what_if.get('revenue_impact', 0))/1000:.0f}K",
            "risk": what_if.get('risk_factor', ''),
            "confidence_change": what_if.get('adjusted_confidence', 80) - what_if.get('base_confidence', 80)
        }

    def _format_drivers(self, drivers: list) -> str:
        """Format drivers for prompt"""
        lines = []
        for d in drivers:
            sign = "+" if d['direction'] == 'positive' else "-"
            lines.append(f"- {d['name']}: {sign}${abs(d['impact']):,.0f}")
        return "\n".join(lines)

    def _parse_llm_response(self, text: str, category: str, base: int, upper: int, lower: int, drivers: list) -> dict:
        """Parse LLM response into structured format"""
        return self._generate_canned_response(category, base, upper, lower, drivers)


forecast_agent = ForecastAgent()
