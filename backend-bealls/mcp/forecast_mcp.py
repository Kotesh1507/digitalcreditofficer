"""
Forecast MCP Server
Tools for category forecasts, confidence bands, and what-if scenarios
"""

from datetime import datetime, timedelta
import math


class ForecastMCP:
    def __init__(self):
        self.base_forecasts = self._build_base_forecasts()
        self.scenarios = self._build_scenarios()

    def _build_base_forecasts(self) -> dict:
        """Build base forecast data by category"""
        return {
            'Apparel': {
                'base_weekly': [380000, 375000, 368000, 362000, 358000, 420000,
                               385000, 372000, 345000, 338000, 342000, 355000],
                'base_total': 4500000,
                'growth_rate': 0.02,
                'volatility': 0.08
            },
            'Footwear': {
                'base_weekly': [185000, 182000, 178000, 175000, 172000, 195000,
                               188000, 180000, 168000, 165000, 170000, 175000],
                'base_total': 2133000,
                'growth_rate': 0.015,
                'volatility': 0.06
            },
            'Home': {
                'base_weekly': [142000, 140000, 138000, 135000, 132000, 148000,
                               145000, 140000, 132000, 130000, 135000, 138000],
                'base_total': 1655000,
                'growth_rate': 0.01,
                'volatility': 0.05
            },
            'Kids': {
                'base_weekly': [98000, 95000, 92000, 90000, 88000, 105000,
                               98000, 92000, 85000, 82000, 88000, 92000],
                'base_total': 1105000,
                'growth_rate': 0.018,
                'volatility': 0.07
            },
            'Accessories': {
                'base_weekly': [78000, 76000, 74000, 72000, 70000, 82000,
                               78000, 75000, 68000, 66000, 70000, 74000],
                'base_total': 883000,
                'growth_rate': 0.012,
                'volatility': 0.05
            },
            'Beauty': {
                'base_weekly': [52000, 51000, 50000, 48000, 47000, 55000,
                               52000, 50000, 46000, 45000, 48000, 50000],
                'base_total': 594000,
                'growth_rate': 0.025,
                'volatility': 0.04
            },
            'Jewelry': {
                'base_weekly': [38000, 37000, 36000, 35000, 34000, 42000,
                               40000, 38000, 34000, 33000, 35000, 37000],
                'base_total': 439000,
                'growth_rate': 0.008,
                'volatility': 0.09
            },
            'Outdoor': {
                'base_weekly': [32000, 34000, 36000, 38000, 40000, 45000,
                               48000, 50000, 48000, 45000, 42000, 38000],
                'base_total': 496000,
                'growth_rate': 0.03,
                'volatility': 0.10
            }
        }

    def _build_scenarios(self) -> dict:
        """Build what-if scenario definitions"""
        return {
            'promo_pull_forward_2w': {
                'name': 'Promo pull-forward 2 weeks',
                'description': 'Move W6 promo event 2 weeks earlier to W4',
                'revenue_impact': 180000,
                'revenue_impact_pct': 4.0,
                'risk': 'W8 rebound weakness',
                'confidence_impact': -5,
                'affected_weeks': [4, 5, 6, 7, 8],
                'weekly_deltas': [0.15, 0.12, -0.10, -0.05, 0.02]
            },
            'promo_push_out_1w': {
                'name': 'Promo push-out 1 week',
                'description': 'Delay W6 promo event by 1 week to W7',
                'revenue_impact': 95000,
                'revenue_impact_pct': 2.1,
                'risk': 'W10 rebound weakness',
                'confidence_impact': -5,
                'affected_weeks': [6, 7, 8, 9, 10],
                'weekly_deltas': [-0.08, 0.18, 0.05, -0.03, -0.02]
            },
            'price_cut_10pct': {
                'name': 'Price cut -10%',
                'description': 'Apply 10% markdown across category',
                'revenue_impact': 210000,
                'revenue_impact_pct': 4.7,
                'risk': 'Margin -0.8pt',
                'confidence_impact': -10,
                'affected_weeks': list(range(1, 13)),
                'weekly_deltas': [0.04] * 12
            },
            'inventory_constraint': {
                'name': 'Inventory constraint -15%',
                'description': 'Reduce available inventory by 15%',
                'revenue_impact': -320000,
                'revenue_impact_pct': -7.1,
                'risk': 'Lost sales, customer churn',
                'confidence_impact': -15,
                'affected_weeks': list(range(1, 13)),
                'weekly_deltas': [-0.06] * 12
            },
            'competitor_promo': {
                'name': 'Competitor promo response',
                'description': 'Match competitor W5 promo event',
                'revenue_impact': 85000,
                'revenue_impact_pct': 1.9,
                'risk': 'Margin erosion',
                'confidence_impact': -8,
                'affected_weeks': [4, 5, 6],
                'weekly_deltas': [0.02, 0.08, 0.03]
            }
        }

    def get_forecast(self, category: str, weeks_forward: int) -> dict:
        """Get base forecast for a category"""
        cat_data = self.base_forecasts.get(category, self.base_forecasts['Apparel'])

        weekly = cat_data['base_weekly'][:weeks_forward]
        total = sum(weekly)

        return {
            'category': category,
            'weeks_forward': weeks_forward,
            'base_total': total,
            'weekly_forecast': [
                {'week': i + 1, 'forecast': weekly[i]}
                for i in range(len(weekly))
            ],
            'growth_rate': cat_data['growth_rate'],
            'last_updated': datetime.now().isoformat()
        }

    def get_forecast_band(self, category: str, weeks_forward: int, confidence: float) -> dict:
        """Get forecast with confidence band"""
        base = self.get_forecast(category, weeks_forward)
        cat_data = self.base_forecasts.get(category, self.base_forecasts['Apparel'])

        z_score = self._confidence_to_z(confidence)
        volatility = cat_data['volatility']

        upper_weekly = []
        lower_weekly = []
        base_weekly = []

        for week_data in base['weekly_forecast']:
            week_num = week_data['week']
            base_val = week_data['forecast']

            uncertainty = volatility * math.sqrt(week_num / 4)
            margin = base_val * uncertainty * z_score

            upper_weekly.append({
                'week': week_num,
                'forecast': round(base_val + margin)
            })
            lower_weekly.append({
                'week': week_num,
                'forecast': round(base_val - margin)
            })
            base_weekly.append({
                'week': week_num,
                'forecast': base_val
            })

        upper_total = sum(w['forecast'] for w in upper_weekly)
        lower_total = sum(w['forecast'] for w in lower_weekly)

        return {
            'category': category,
            'weeks_forward': weeks_forward,
            'confidence': confidence,
            'base_total': base['base_total'],
            'upper_bound': upper_total,
            'lower_bound': lower_total,
            'band_width_pct': round((upper_total - lower_total) / base['base_total'] * 100, 1),
            'weekly_band': {
                'base': base_weekly,
                'upper': upper_weekly,
                'lower': lower_weekly
            },
            'drivers': self._get_forecast_drivers(category, weeks_forward)
        }

    def get_what_if_scenario(self, category: str, scenario_id: str) -> dict:
        """Get what-if scenario analysis"""
        scenario = self.scenarios.get(scenario_id)

        if not scenario:
            return {
                'error': f"Unknown scenario: {scenario_id}",
                'available_scenarios': list(self.scenarios.keys())
            }

        base = self.get_forecast(category, 12)
        base_total = base['base_total']

        new_total = base_total + scenario['revenue_impact']
        base_confidence = 80
        new_confidence = base_confidence + scenario['confidence_impact']

        adjusted_weekly = []
        for i, week_data in enumerate(base['weekly_forecast']):
            week_num = week_data['week']
            base_val = week_data['forecast']

            if week_num in scenario['affected_weeks']:
                idx = scenario['affected_weeks'].index(week_num)
                delta = scenario['weekly_deltas'][idx] if idx < len(scenario['weekly_deltas']) else 0
                adjusted_val = round(base_val * (1 + delta))
            else:
                adjusted_val = base_val

            adjusted_weekly.append({
                'week': week_num,
                'base': base_val,
                'adjusted': adjusted_val,
                'delta': adjusted_val - base_val
            })

        return {
            'category': category,
            'scenario_id': scenario_id,
            'scenario_name': scenario['name'],
            'description': scenario['description'],
            'base_total': base_total,
            'adjusted_total': new_total,
            'revenue_impact': scenario['revenue_impact'],
            'revenue_impact_pct': scenario['revenue_impact_pct'],
            'risk_factor': scenario['risk'],
            'base_confidence': base_confidence,
            'adjusted_confidence': new_confidence,
            'weekly_impact': adjusted_weekly
        }

    def _confidence_to_z(self, confidence: float) -> float:
        """Convert confidence level to z-score"""
        z_map = {
            0.50: 0.67,
            0.60: 0.84,
            0.70: 1.04,
            0.80: 1.28,
            0.90: 1.64,
            0.95: 1.96,
            0.99: 2.58
        }
        closest = min(z_map.keys(), key=lambda x: abs(x - confidence))
        return z_map[closest]

    def _get_forecast_drivers(self, category: str, weeks: int) -> list:
        """Get key drivers affecting the forecast"""
        drivers = [
            {
                'name': 'Seasonal tail-off W9-W11',
                'impact': -210000,
                'impact_pct': -4.7,
                'direction': 'negative',
                'confidence': 0.85
            },
            {
                'name': 'Promo event W6',
                'impact': 340000,
                'impact_pct': 7.6,
                'direction': 'positive',
                'confidence': 0.90
            },
            {
                'name': 'Trend carry-forward',
                'impact': 95000,
                'impact_pct': 2.1,
                'direction': 'positive',
                'confidence': 0.75
            }
        ]

        if category == 'Outdoor':
            drivers.append({
                'name': 'Summer seasonality',
                'impact': 125000,
                'impact_pct': 25.2,
                'direction': 'positive',
                'confidence': 0.92
            })

        return drivers


forecast_mcp = ForecastMCP()
