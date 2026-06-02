"""
Calendar and Seasonality MCP Server
Tools for calendar overlays, holiday flags, and event detection
"""

from datetime import datetime, timedelta


class CalendarMCP:
    def __init__(self):
        self.holidays = self._build_holiday_calendar()
        self.events = self._build_event_calendar()

    def _build_holiday_calendar(self) -> list:
        """Build holiday calendar for demo period"""
        return [
            {'date': '2024-11-28', 'name': 'Thanksgiving', 'impact': 'high', 'sales_lift': 0.35},
            {'date': '2024-11-29', 'name': 'Black Friday', 'impact': 'high', 'sales_lift': 0.65},
            {'date': '2024-12-02', 'name': 'Cyber Monday', 'impact': 'medium', 'sales_lift': 0.25},
            {'date': '2024-12-24', 'name': 'Christmas Eve', 'impact': 'high', 'sales_lift': 0.40},
            {'date': '2024-12-25', 'name': 'Christmas', 'impact': 'low', 'sales_lift': -0.80},
            {'date': '2024-12-26', 'name': 'After Christmas', 'impact': 'high', 'sales_lift': 0.45},
            {'date': '2025-01-01', 'name': 'New Years Day', 'impact': 'low', 'sales_lift': -0.30},
            {'date': '2025-02-14', 'name': 'Valentines Day', 'impact': 'medium', 'sales_lift': 0.15},
            {'date': '2025-04-20', 'name': 'Easter', 'impact': 'medium', 'sales_lift': 0.20},
            {'date': '2025-05-26', 'name': 'Memorial Day', 'impact': 'medium', 'sales_lift': 0.18},
            {'date': '2025-07-04', 'name': 'Independence Day', 'impact': 'medium', 'sales_lift': 0.15},
            {'date': '2025-09-01', 'name': 'Labor Day', 'impact': 'medium', 'sales_lift': 0.20}
        ]

    def _build_event_calendar(self) -> list:
        """Build promo/event calendar for demo period"""
        return [
            {'week': 3, 'name': 'Spring Preview', 'type': 'promo', 'category': 'Apparel', 'lift': 0.12},
            {'week': 6, 'name': 'Mid-Season Sale', 'type': 'promo', 'category': 'All', 'lift': 0.18},
            {'week': 9, 'name': 'Clearance Event', 'type': 'clearance', 'category': 'All', 'lift': 0.22},
            {'week': 12, 'name': 'Summer Kickoff', 'type': 'promo', 'category': 'Outdoor', 'lift': 0.15},
            {'week': 15, 'name': 'Back to School', 'type': 'promo', 'category': 'Kids', 'lift': 0.28},
            {'week': 18, 'name': 'Fall Preview', 'type': 'promo', 'category': 'Apparel', 'lift': 0.14},
            {'week': 21, 'name': 'Pre-Holiday', 'type': 'promo', 'category': 'All', 'lift': 0.20}
        ]

    def get_calendar_overlay(self, week_range: str) -> dict:
        """Get calendar overlay for a week range including holidays and events"""
        weeks = self._parse_week_range(week_range)

        relevant_events = [e for e in self.events if e['week'] in weeks]

        has_holiday = any(self._week_has_holiday(w) for w in weeks)

        return {
            'week_range': week_range,
            'weeks': weeks,
            'events': relevant_events,
            'has_major_holiday': has_holiday,
            'has_promo': len(relevant_events) > 0,
            'seasonality_factor': self._get_seasonality_factor(weeks),
            'yoy_calendar_shift': 0
        }

    def get_holiday_flags(self, date_range: str) -> dict:
        """Get holiday flags for a date range"""
        start_date, end_date = self._parse_date_range(date_range)

        relevant_holidays = [
            h for h in self.holidays
            if start_date <= datetime.strptime(h['date'], '%Y-%m-%d') <= end_date
        ]

        return {
            'date_range': date_range,
            'holidays': relevant_holidays,
            'holiday_count': len(relevant_holidays),
            'high_impact_count': len([h for h in relevant_holidays if h['impact'] == 'high'])
        }

    def get_event_flags(self, date_range: str) -> dict:
        """Get promotional event flags"""
        weeks = self._date_range_to_weeks(date_range)

        relevant_events = [e for e in self.events if e['week'] in weeks]

        return {
            'date_range': date_range,
            'events': relevant_events,
            'promo_weeks': len(relevant_events),
            'avg_expected_lift': sum(e['lift'] for e in relevant_events) / len(relevant_events) if relevant_events else 0
        }

    def _parse_week_range(self, week_range: str) -> list:
        """Parse week range string to list of week numbers"""
        if 'last_2w' in week_range or 'last_two_weeks' in week_range:
            return [11, 12]
        elif 'last_4w' in week_range or 'last_four_weeks' in week_range:
            return [9, 10, 11, 12]
        elif 'last_12w' in week_range or 'last_12_weeks' in week_range:
            return list(range(1, 13))
        elif 'next_12w' in week_range or 'next_12_weeks' in week_range:
            return list(range(13, 25))
        else:
            return list(range(1, 13))

    def _parse_date_range(self, date_range: str) -> tuple:
        """Parse date range string to start/end dates"""
        today = datetime.now()

        if 'last_2w' in date_range:
            return (today - timedelta(weeks=2), today)
        elif 'last_4w' in date_range:
            return (today - timedelta(weeks=4), today)
        elif 'last_12w' in date_range:
            return (today - timedelta(weeks=12), today)
        elif 'next_12w' in date_range:
            return (today, today + timedelta(weeks=12))
        else:
            return (today - timedelta(weeks=12), today)

    def _date_range_to_weeks(self, date_range: str) -> list:
        """Convert date range to week numbers"""
        return self._parse_week_range(date_range)

    def _week_has_holiday(self, week_num: int) -> bool:
        """Check if a week contains a major holiday"""
        holiday_weeks = [48, 49, 51, 52, 1, 7, 16, 22, 27, 36]
        return (week_num % 52) in holiday_weeks

    def _get_seasonality_factor(self, weeks: list) -> float:
        """Get seasonality factor for given weeks"""
        seasonal_factors = {
            1: 0.85, 2: 0.82, 3: 0.88, 4: 0.92, 5: 0.95, 6: 1.02,
            7: 1.05, 8: 1.00, 9: 0.95, 10: 0.92, 11: 0.90, 12: 0.88,
            13: 0.90, 14: 0.92, 15: 1.08, 16: 1.05, 17: 1.00, 18: 1.02,
            19: 1.05, 20: 1.08, 21: 1.12, 22: 1.15, 23: 1.25, 24: 1.35
        }

        if not weeks:
            return 1.0

        factors = [seasonal_factors.get(w, 1.0) for w in weeks]
        return round(sum(factors) / len(factors), 2)


calendar_mcp = CalendarMCP()
