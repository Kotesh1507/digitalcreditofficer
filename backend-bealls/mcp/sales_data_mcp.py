"""
Mocked Sales Data MCP Server
Tools for store sales, traffic, categories, clusters, and customer cohorts
Data source: S3 bucket s3://bealls-bucket/retail_data/
"""

import json
import os
import boto3
from datetime import datetime, timedelta
from functools import lru_cache

class SalesDataMCP:
    def __init__(self):
        self.s3_client = None
        self.bucket = os.getenv('S3_BUCKET', 'bealls-bucket')
        self.prefix = os.getenv('S3_DATA_PREFIX', 'retail_data/')
        self._init_s3()
        self._cache = {}

    def _init_s3(self):
        try:
            self.s3_client = boto3.client(
                's3',
                aws_access_key_id=os.getenv('AWS_ACCESS_KEY_ID'),
                aws_secret_access_key=os.getenv('AWS_SECRET_ACCESS_KEY'),
                region_name=os.getenv('AWS_REGION', 'us-east-1')
            )
        except Exception as e:
            print(f"S3 init warning: {e}. Using local fallback data.")
            self.s3_client = None

    def _load_from_s3(self, key):
        if key in self._cache:
            return self._cache[key]

        if self.s3_client:
            try:
                full_key = f"{self.prefix}{key}"
                print(f"[S3] Loading: s3://{self.bucket}/{full_key}")
                response = self.s3_client.get_object(
                    Bucket=self.bucket,
                    Key=full_key
                )
                data = json.loads(response['Body'].read().decode('utf-8'))
                print(f"[S3] Loaded {len(data)} records from {key}")
                self._cache[key] = data
                return data
            except Exception as e:
                print(f"[S3] Load error for {key}: {e}")

        return self._get_fallback_data(key)

    def _get_fallback_data(self, key):
        """Fallback mock data for demo purposes"""
        fallback = {
            'store_dim.json': self._generate_mock_stores(),
            'sales_fact.json': self._generate_mock_sales(),
            'category_dim.json': self._generate_mock_categories(),
            'clusters.json': self._generate_mock_clusters(),
            'customer_cohort.json': self._generate_mock_cohorts(),
            'recommendation_log.json': self._generate_mock_recommendations(),
            'calendar.json': [],
            'forecast.json': [],
            'what_if_scenarios.json': []
        }
        return fallback.get(key, {})

    def _generate_mock_stores(self):
        stores = []
        regions = ['Southeast', 'Southwest', 'Central', 'Northeast', 'West']
        cities = {
            'Southeast': ['Jacksonville, FL', 'Tampa, FL', 'Orlando, FL', 'Miami, FL'],
            'Southwest': ['Phoenix, AZ', 'Tucson, AZ', 'Las Vegas, NV', 'Albuquerque, NM'],
            'Central': ['Dallas, TX', 'Houston, TX', 'San Antonio, TX', 'Austin, TX'],
            'Northeast': ['Columbus, OH', 'Cleveland, OH', 'Pittsburgh, PA', 'Buffalo, NY'],
            'West': ['Los Angeles, CA', 'San Diego, CA', 'Sacramento, CA', 'Fresno, CA']
        }

        for i in range(500):
            store_id = str(i + 1).zfill(4)
            region = regions[i % 5]
            city = cities[region][i % 4]
            cluster_id = (i % 12) + 1

            stores.append({
                'store_id': store_id,
                'name': f'Store {store_id}',
                'city': city,
                'region': region,
                'cluster_id': cluster_id,
                'sqft': 15000 + (i % 10) * 1000,
                'open_date': '2015-01-01'
            })
        return stores

    def _generate_mock_sales(self):
        import random
        random.seed(42)

        sales = []
        categories = ['Apparel', 'Footwear', 'Home', 'Kids', 'Accessories', 'Beauty', 'Jewelry', 'Outdoor']

        for store_idx in range(500):
            store_id = str(store_idx + 1).zfill(4)
            base_sales = 50000 + random.randint(-10000, 20000)

            for week in range(24):
                week_date = (datetime.now() - timedelta(weeks=12-week)).strftime('%Y-%m-%d')

                for cat in categories:
                    cat_multiplier = {'Apparel': 1.4, 'Footwear': 1.1, 'Home': 0.9, 'Kids': 0.8,
                                     'Accessories': 0.6, 'Beauty': 0.5, 'Jewelry': 0.4, 'Outdoor': 0.3}

                    sales_amt = base_sales * cat_multiplier.get(cat, 0.5) * (0.8 + random.random() * 0.4) / 8
                    traffic = int(1500 + random.randint(-300, 500))
                    conversion = 0.015 + random.random() * 0.02
                    avg_basket = 35 + random.random() * 15
                    upt = 1.8 + random.random() * 0.6

                    sales.append({
                        'store_id': store_id,
                        'category': cat,
                        'week': week_date,
                        'week_num': week + 1,
                        'sales': round(sales_amt, 2),
                        'traffic': traffic,
                        'conversion': round(conversion, 4),
                        'avg_basket': round(avg_basket, 2),
                        'upt': round(upt, 2),
                        'plan': round(sales_amt * (0.95 + random.random() * 0.1), 2)
                    })
        return sales

    def _generate_mock_categories(self):
        return [
            {'id': 'apparel', 'name': 'Apparel', 'plan_pct': 0.28},
            {'id': 'footwear', 'name': 'Footwear', 'plan_pct': 0.18},
            {'id': 'home', 'name': 'Home', 'plan_pct': 0.15},
            {'id': 'kids', 'name': 'Kids', 'plan_pct': 0.12},
            {'id': 'accessories', 'name': 'Accessories', 'plan_pct': 0.10},
            {'id': 'beauty', 'name': 'Beauty', 'plan_pct': 0.08},
            {'id': 'jewelry', 'name': 'Jewelry', 'plan_pct': 0.05},
            {'id': 'outdoor', 'name': 'Outdoor', 'plan_pct': 0.04}
        ]

    def _generate_mock_clusters(self):
        clusters = []
        for i in range(12):
            cluster_id = i + 1
            clusters.append({
                'cluster_id': cluster_id,
                'name': f'Cluster {cluster_id}',
                'store_count': 40 + (i % 5) * 2,
                'avg_sqft': 16000 + i * 500,
                'region_mix': 'Multi-region',
                'comp_median': round(-2 + (i % 8) * 1.5, 1)
            })
        return clusters

    def _generate_mock_cohorts(self):
        return [
            {'bucket': 'Champions', 'rfm': '111', 'count': 45000, 'revenue_pct': 0.35},
            {'bucket': 'Loyal', 'rfm': '112', 'count': 62000, 'revenue_pct': 0.25},
            {'bucket': 'Potential', 'rfm': '121', 'count': 85000, 'revenue_pct': 0.15},
            {'bucket': 'New', 'rfm': '211', 'count': 32000, 'revenue_pct': 0.08},
            {'bucket': 'Promising', 'rfm': '122', 'count': 28000, 'revenue_pct': 0.06},
            {'bucket': 'Attention', 'rfm': '212', 'count': 41000, 'revenue_pct': 0.05},
            {'bucket': 'At Risk', 'rfm': '221', 'count': 38000, 'revenue_pct': 0.03},
            {'bucket': 'Hibernating', 'rfm': '222', 'count': 52000, 'revenue_pct': 0.02},
            {'bucket': 'Lost', 'rfm': '333', 'count': 67000, 'revenue_pct': 0.01}
        ]

    def _generate_mock_recommendations(self):
        return [
            {'id': 1, 'store_id': '0214', 'type': 'floor_placement', 'category': 'Apparel',
             'action': 'Move clearance rack to front zone', 'impact_pct': 3.2},
            {'id': 2, 'store_id': '0142', 'type': 'staffing', 'category': 'All',
             'action': 'Add weekend PM shift', 'impact_pct': 2.8},
            {'id': 3, 'store_id': '0318', 'type': 'signage', 'category': 'Footwear',
             'action': 'Add promo signage at entrance', 'impact_pct': 1.9}
        ]

    # === MCP Tool Methods ===

    def get_store_sales(self, store_id: str, week_range: str) -> dict:
        """Get sales data for a specific store from S3"""
        sales_data = self._load_from_s3('sales_fact.json')

        weeks = self._parse_week_range(week_range)
        # Handle both string and int store_id formats
        store_id_int = int(store_id.lstrip('0') or '0') if store_id else 0
        store_id_str = str(store_id_int)

        # Filter by store_id (S3 data uses integers)
        store_sales = [s for s in sales_data
                       if (s.get('store_id') == store_id_int or str(s.get('store_id')) == store_id_str)
                       and s.get('week_num') in weeks]

        print(f"[MCP] get_store_sales: store={store_id}, weeks={weeks}, found={len(store_sales)} records")

        if not store_sales or len(store_sales) < 3:
            print(f"[MCP] Using demo data for store {store_id}")
            return self._get_demo_store_sales(store_id, week_range)

        # S3 data uses 'actual_sales', 'plan_sales', 'conversion_rate' (as percentage)
        total_sales = sum(s.get('actual_sales', 0) for s in store_sales)
        total_plan = sum(s.get('plan_sales', 0) for s in store_sales)
        avg_traffic = sum(s.get('traffic', 0) for s in store_sales) / len(store_sales) if store_sales else 0
        # conversion_rate in S3 is already in percentage (e.g., 2.27 = 2.27%)
        avg_conversion = sum(s.get('conversion_rate', 0) for s in store_sales) / len(store_sales) if store_sales else 0
        avg_basket = sum(s.get('avg_basket', 0) for s in store_sales) / len(store_sales) if store_sales else 0
        avg_upt = sum(s.get('upt', 0) for s in store_sales) / len(store_sales) if store_sales else 0

        comp_pct = ((total_sales - total_plan) / total_plan * 100) if total_plan else 0

        return {
            'store_id': store_id,
            'week_range': week_range,
            'total_sales': round(total_sales * 1000, 2),  # Scale up for display
            'total_plan': round(total_plan * 1000, 2),
            'comp_pct': round(comp_pct, 1),
            'avg_traffic_per_day': round(avg_traffic / 7, 0),
            'avg_conversion': round(avg_conversion / 100, 4),  # Convert percentage to decimal
            'avg_basket': round(avg_basket, 2),
            'avg_upt': round(avg_upt, 2),
            'by_category': self._aggregate_by_category(store_sales),
            'data_source': 's3'
        }

    def _get_demo_store_sales(self, store_id: str, week_range: str) -> dict:
        """Demo data for canonical demo stores"""
        demo_data = {
            '0214': {
                'store_id': '0214',
                'week_range': week_range,
                'total_sales': 142800,
                'total_plan': 155700,
                'comp_pct': -8.3,
                'avg_traffic_per_day': 1820,
                'avg_conversion': 0.017,
                'avg_basket': 38.20,
                'avg_upt': 2.1,
                'by_category': {
                    'Apparel': {'sales': 48500, 'plan': 56400, 'comp_pct': -14.0, 'traffic': 620},
                    'Footwear': {'sales': 28200, 'plan': 27600, 'comp_pct': 2.2, 'traffic': 340},
                    'Home': {'sales': 24600, 'plan': 23600, 'comp_pct': 4.2, 'traffic': 280},
                    'Kids': {'sales': 15800, 'plan': 17400, 'comp_pct': -9.2, 'traffic': 210},
                    'Accessories': {'sales': 25700, 'plan': 25400, 'comp_pct': 1.2, 'traffic': 370}
                }
            },
            '0142': {
                'store_id': '0142',
                'week_range': week_range,
                'total_sales': 128400,
                'total_plan': 141200,
                'comp_pct': -9.1,
                'avg_traffic_per_day': 1820,
                'avg_conversion': 0.017,
                'avg_basket': 41.10,
                'avg_upt': 2.1,
                'by_category': {
                    'Apparel': {'sales': 42100, 'plan': 48200, 'comp_pct': -12.7, 'traffic': 580},
                    'Footwear': {'sales': 26800, 'plan': 28100, 'comp_pct': -4.6, 'traffic': 320},
                    'Home': {'sales': 22400, 'plan': 24500, 'comp_pct': -8.6, 'traffic': 260},
                    'Kids': {'sales': 14200, 'plan': 15800, 'comp_pct': -10.1, 'traffic': 190},
                    'Accessories': {'sales': 22900, 'plan': 24600, 'comp_pct': -6.9, 'traffic': 340}
                }
            },
            '0318': {
                'store_id': '0318',
                'week_range': week_range,
                'total_sales': 168200,
                'total_plan': 159800,
                'comp_pct': 5.2,
                'avg_traffic_per_day': 2480,
                'avg_conversion': 0.028,
                'avg_basket': 39.80,
                'avg_upt': 2.0,
                'by_category': {
                    'Apparel': {'sales': 58400, 'plan': 54200, 'comp_pct': 7.8, 'traffic': 820},
                    'Footwear': {'sales': 32100, 'plan': 30400, 'comp_pct': 5.6, 'traffic': 420},
                    'Home': {'sales': 28600, 'plan': 27800, 'comp_pct': 2.9, 'traffic': 380},
                    'Kids': {'sales': 19800, 'plan': 19200, 'comp_pct': 3.1, 'traffic': 290},
                    'Accessories': {'sales': 29300, 'plan': 28200, 'comp_pct': 3.9, 'traffic': 440}
                }
            },
            '0407': {
                'store_id': '0407',
                'week_range': week_range,
                'total_sales': 152600,
                'total_plan': 148400,
                'comp_pct': 2.8,
                'avg_traffic_per_day': 2240,
                'avg_conversion': 0.031,
                'avg_basket': 38.50,
                'avg_upt': 2.0,
                'by_category': {
                    'Apparel': {'sales': 52800, 'plan': 50200, 'comp_pct': 5.2, 'traffic': 740},
                    'Footwear': {'sales': 29400, 'plan': 28800, 'comp_pct': 2.1, 'traffic': 380},
                    'Home': {'sales': 26200, 'plan': 26400, 'comp_pct': -0.8, 'traffic': 340},
                    'Kids': {'sales': 17800, 'plan': 17200, 'comp_pct': 3.5, 'traffic': 260},
                    'Accessories': {'sales': 26400, 'plan': 25800, 'comp_pct': 2.3, 'traffic': 400}
                }
            }
        }
        return demo_data.get(store_id, demo_data['0214'])

    def get_category_sales(self, category: str, week_range: str) -> dict:
        """Get chain-wide sales for a category"""
        sales_data = self._load_from_s3('sales_fact.json')
        weeks = self._parse_week_range(week_range)

        cat_sales = [s for s in sales_data
                     if s.get('category_name', s.get('category', '')).lower() == category.lower()
                     and s.get('week_num') in weeks]

        if not cat_sales:
            return self._get_demo_category_sales(category, week_range)

        total_sales = sum(s.get('actual_sales', s.get('sales', 0)) for s in cat_sales)
        total_plan = sum(s.get('plan_sales', s.get('plan', 0)) for s in cat_sales)
        comp_pct = ((total_sales - total_plan) / total_plan * 100) if total_plan else 0

        return {
            'category': category,
            'week_range': week_range,
            'total_sales': round(total_sales, 2),
            'total_plan': round(total_plan, 2),
            'comp_pct': round(comp_pct, 1),
            'store_count': len(set(s.get('store_id') for s in cat_sales))
        }

    def _get_demo_category_sales(self, category: str, week_range: str) -> dict:
        """Demo category data for Apparel forecast"""
        demo = {
            'Apparel': {
                'category': 'Apparel',
                'week_range': week_range,
                'total_sales': 4200000,
                'total_plan': 4500000,
                'comp_pct': -6.7,
                'store_count': 500,
                'weekly_trend': [
                    {'week': 1, 'sales': 380000}, {'week': 2, 'sales': 365000},
                    {'week': 3, 'sales': 358000}, {'week': 4, 'sales': 342000},
                    {'week': 5, 'sales': 335000}, {'week': 6, 'sales': 328000},
                    {'week': 7, 'sales': 348000}, {'week': 8, 'sales': 362000},
                    {'week': 9, 'sales': 345000}, {'week': 10, 'sales': 338000},
                    {'week': 11, 'sales': 352000}, {'week': 12, 'sales': 347000}
                ]
            }
        }
        return demo.get(category, demo['Apparel'])

    def get_store_traffic(self, store_id: str, week_range: str) -> dict:
        """Get traffic data for a specific store"""
        store_sales = self.get_store_sales(store_id, week_range)

        return {
            'store_id': store_id,
            'week_range': week_range,
            'avg_daily_traffic': store_sales.get('avg_traffic_per_day', 1820),
            'traffic_by_category': {
                cat: data.get('traffic', 0)
                for cat, data in store_sales.get('by_category', {}).items()
            },
            'hourly_peak': '2PM-4PM',
            'weekend_pct': 0.42
        }

    def get_cluster_assignment(self, store_id: str) -> dict:
        """Get cluster assignment for a store"""
        stores = self._load_from_s3('store_dim.json')
        store_id_int = int(store_id.lstrip('0') or '0')
        store = next((s for s in stores if s.get('store_id') == store_id_int), None)

        if not store:
            cluster_map = {'0214': 5, '0142': 7, '0318': 7, '0407': 7, '100': 1, '101': 1}
            cluster_id = cluster_map.get(store_id, 7)
            return {
                'store_id': store_id,
                'cluster_id': cluster_id,
                'cluster_name': f'Cluster {cluster_id}',
                'region': 'Central'
            }

        return {
            'store_id': store_id,
            'cluster_id': store.get('cluster_id', 1),
            'cluster_name': f"Cluster {store.get('cluster_id', 1)}",
            'region': store.get('region', 'Unknown')
        }

    def get_cluster_members(self, cluster_id: int) -> dict:
        """Get all stores in a cluster"""
        stores = self._load_from_s3('store_dim.json')
        cluster_stores = [s for s in stores if s.get('cluster_id') == cluster_id]

        if not cluster_stores:
            return self._get_demo_cluster_members(cluster_id)

        sales_data = self._load_from_s3('sales_fact.json')
        store_comps = {}
        for sale in sales_data:
            sid = sale.get('store_id')
            if sid not in store_comps:
                store_comps[sid] = {'sales': 0, 'plan': 0}
            store_comps[sid]['sales'] += sale.get('actual_sales', 0)
            store_comps[sid]['plan'] += sale.get('plan_sales', 0)

        members = []
        for s in cluster_stores:
            sid = s.get('store_id')
            comp = store_comps.get(sid, {})
            sales = comp.get('sales', 0)
            plan = comp.get('plan', 0)
            comp_pct = ((sales - plan) / plan * 100) if plan > 0 else 0
            members.append({
                'store_id': str(sid).zfill(4),
                'city': f"{s.get('city', 'Unknown')}, {s.get('state', '')}",
                'comp_pct': round(comp_pct, 1)
            })

        members.sort(key=lambda x: x['comp_pct'], reverse=True)
        median_idx = len(members) // 2
        median_comp = members[median_idx]['comp_pct'] if members else 0

        return {
            'cluster_id': cluster_id,
            'store_count': len(members),
            'stores': members[:15],
            'median_comp': round(median_comp, 1)
        }

    def _get_demo_cluster_members(self, cluster_id: int) -> dict:
        """Demo cluster 7 members"""
        return {
            'cluster_id': cluster_id,
            'store_count': 12,
            'stores': [
                {'store_id': '0318', 'city': 'Mesquite, TX', 'comp_pct': 5.2},
                {'store_id': '0412', 'city': 'Plano, TX', 'comp_pct': 4.3},
                {'store_id': '0389', 'city': 'Irving, TX', 'comp_pct': 3.6},
                {'store_id': '0407', 'city': 'Garland, TX', 'comp_pct': 2.8},
                {'store_id': '0445', 'city': 'Arlington, TX', 'comp_pct': 1.8},
                {'store_id': '0423', 'city': 'Fort Worth, TX', 'comp_pct': 0.9},
                {'store_id': '0398', 'city': 'Denton, TX', 'comp_pct': 0.1},
                {'store_id': '0367', 'city': 'McKinney, TX', 'comp_pct': -2.4},
                {'store_id': '0378', 'city': 'Frisco, TX', 'comp_pct': -4.1},
                {'store_id': '0142', 'city': 'Dallas, TX', 'comp_pct': -9.1},
                {'store_id': '0356', 'city': 'Richardson, TX', 'comp_pct': -10.2},
                {'store_id': '0334', 'city': 'Carrollton, TX', 'comp_pct': -12.5}
            ],
            'median_comp': 0.3
        }

    def get_customer_cohort_summary(self) -> dict:
        """Get RFM customer cohort summary"""
        cohorts = self._load_from_s3('customer_cohort.json')
        # S3 schema can vary (some exports use `count`, others may use a different field name).
        total_customers = sum(
            (c.get('count') or c.get('customers') or c.get('customer_count') or 0) for c in cohorts
        )
        return {
            'cohorts': cohorts,
            'total_customers': total_customers,
            'active_pct': 0.62
        }

    def get_recommendation_log(self) -> dict:
        """Get AI recommendation log"""
        recommendations = self._load_from_s3('recommendation_log.json')
        return {
            'recommendations': recommendations,
            'pending_count': len([r for r in recommendations if r.get('status') != 'completed']),
            'avg_impact': 2.6
        }

    def get_opening_briefing_kpis(self, week_range: str = "last_12w") -> dict:
        """
        KPI snapshot for the opening/landing page.

        Note: If S3 access is unavailable or fields are missing, this method
        falls back to the existing demo/mock data so the UI can still render.
        """
        sales_data = self._load_from_s3('sales_fact.json')
        store_dim = self._load_from_s3('store_dim.json')
        cohorts_summary = self.get_customer_cohort_summary()

        week_nums = set(self._parse_week_range(week_range))

        # Use comp stores proxy: include stores opened >= 12 months.
        # In the current demo dataset, all stores satisfy this.
        today = datetime.now().date()
        comp_cutoff = today.replace(year=today.year - 1)
        comp_store_ids = None
        try:
            comp_store_ids = set()
            for s in store_dim:
                sid = s.get('store_id')
                open_date = s.get('open_date')
                if not sid or not open_date:
                    continue
                try:
                    d = datetime.fromisoformat(open_date).date()
                except Exception:
                    continue
                if d <= comp_cutoff:
                    comp_store_ids.add(str(sid).zfill(4) if str(sid).isdigit() else str(sid))
        except Exception:
            comp_store_ids = None

        def store_is_comp(rec: dict) -> bool:
            if not comp_store_ids:
                return True
            sid = rec.get('store_id')
            if sid is None:
                return True
            sid_str = str(sid).zfill(4) if str(sid).isdigit() else str(sid)
            return sid_str in comp_store_ids

        records = [r for r in sales_data if int(r.get('week_num', 0) or 0) in week_nums and store_is_comp(r)]
        last_2w = {11, 12}
        records_last2 = [r for r in sales_data if int(r.get('week_num', 0) or 0) in last_2w and store_is_comp(r)]

        # Baselines are used only for delta display on the opening page.
        BASELINE_CONVERSION_PCT = 43.5
        BASELINE_AVG_BASKET = 44.72
        BASELINE_SELL_THROUGH_PCT = 82
        BASELINE_REPEAT_PCT = 43.43

        # --- YTD Sales (proxy) and Comp Store Sales (proxy) ---
        # S3 data has sales in thousands (e.g., 108.1 = $108,100), scale up by 1000
        total_sales = sum((r.get('actual_sales', r.get('sales', 0)) or 0) for r in records)
        total_plan = sum((r.get('plan_sales', r.get('plan', 0)) or 0) for r in records)

        # Scale to actual dollars (S3 values are in $thousands)
        total_sales_dollars = total_sales * 1000
        total_plan_dollars = total_plan * 1000

        comp_store_sales_pct = ((total_sales - total_plan) / total_plan * 100) if total_plan else 0.0
        ytd_sales_m = total_sales_dollars / 1e6  # Convert to millions for display
        ytd_delta_pct = comp_store_sales_pct

        # --- Conversion Rate (last 2 weeks) ---
        # S3 uses 'conversion_rate' (as percentage like 2.27), fallback uses 'conversion' (as decimal)
        conv_num = 0.0
        conv_den = 0.0
        for r in records_last2:
            traffic = float(r.get('traffic', 0) or 0)
            # S3: conversion_rate is percentage (e.g., 2.27 means 2.27%)
            # Fallback: conversion is decimal (e.g., 0.0227 means 2.27%)
            conv_rate = r.get('conversion_rate')
            if conv_rate is not None:
                conversion = float(conv_rate) / 100.0  # Convert percentage to decimal
            else:
                conversion = float(r.get('conversion', 0) or 0)
            conv_num += conversion * traffic
            conv_den += traffic
        conversion_pct = (conv_num / conv_den * 100) if conv_den else 0.0
        conversion_delta_pp = conversion_pct - BASELINE_CONVERSION_PCT

        # --- Avg Transaction Value (last 2 weeks; weighted by estimated transactions) ---
        tx_num = 0.0
        tx_den = 0.0
        for r in records_last2:
            traffic = float(r.get('traffic', 0) or 0)
            conv_rate = r.get('conversion_rate')
            if conv_rate is not None:
                conversion = float(conv_rate) / 100.0
            else:
                conversion = float(r.get('conversion', 0) or 0)
            avg_basket = float(r.get('avg_basket', 0) or 0)
            tx = traffic * conversion
            tx_num += avg_basket * tx
            tx_den += tx
        avg_transaction_value = (tx_num / tx_den) if tx_den else 0.0
        avg_transaction_value_delta = avg_transaction_value - BASELINE_AVG_BASKET

        # --- Sell-Through Rate (proxy from units-per-transaction; inventory fields not present in demo schema) ---
        upt_num = 0.0
        upt_den = 0.0
        for r in records_last2:
            traffic = float(r.get('traffic', 0) or 0)
            conv_rate = r.get('conversion_rate')
            if conv_rate is not None:
                conversion = float(conv_rate) / 100.0
            else:
                conversion = float(r.get('conversion', 0) or 0)
            upt = float(r.get('upt', 0) or 0)
            tx = traffic * conversion
            upt_num += upt * tx
            upt_den += tx
        avg_upt = (upt_num / upt_den) if upt_den else 2.0
        # Map UPT (~2.0) to a sell-through proxy (~75%).
        sell_through_pct = max(1.0, min(99.0, (avg_upt / 2.0) * 75.0))
        sell_through_delta_pp = sell_through_pct - BASELINE_SELL_THROUGH_PCT

        # --- Repeat Rate (proxy from cohort active_pct) ---
        repeat_pct = float(cohorts_summary.get('active_pct', 0.62) or 0.62) * 100.0
        repeat_delta_pp = repeat_pct - BASELINE_REPEAT_PCT

        def color_for_delta(delta: float) -> str:
            return "green" if delta >= 0 else "red"

        return {
            "periodLabel": "YTD (last 12 weeks proxy)",
            "storeId": None,
            "kpis": [
                {
                    "id": "ytd_sales",
                    "label": "YTD Sales",
                    "valueText": f"${ytd_sales_m:.0f}M",
                    "deltaText": f"{ytd_delta_pct:+.1f}%",
                    "delta_direction": "up" if ytd_delta_pct >= 0 else "down",
                    "color": color_for_delta(ytd_delta_pct),
                },
                {
                    "id": "comp_store_sales",
                    "label": "Comp Store Sales",
                    "valueText": f"{comp_store_sales_pct:+.1f}%",
                    "deltaText": "vs LY same period (proxy)",
                    "delta_direction": "up" if comp_store_sales_pct >= 0 else "down",
                    "color": color_for_delta(comp_store_sales_pct),
                },
                {
                    "id": "conversion_rate",
                    "label": "Conversion Rate",
                    "valueText": f"{conversion_pct:.1f}%",
                    "deltaText": f"{conversion_delta_pp:+.1f}pp",
                    "delta_direction": "up" if conversion_delta_pp >= 0 else "down",
                    "color": color_for_delta(conversion_delta_pp),
                },
                {
                    "id": "avg_transaction_value",
                    "label": "Average Transaction Value",
                    "valueText": f"${avg_transaction_value:.2f}",
                    "deltaText": f"{avg_transaction_value_delta:+.2f}",
                    "delta_direction": "up" if avg_transaction_value_delta >= 0 else "down",
                    "color": color_for_delta(avg_transaction_value_delta),
                },
                {
                    "id": "sell_through_rate",
                    "label": "Sell-Through Rate",
                    "valueText": f"{sell_through_pct:.0f}%",
                    "deltaText": f"{sell_through_delta_pp:+.0f}pp",
                    "delta_direction": "up" if sell_through_delta_pp >= 0 else "down",
                    "color": color_for_delta(sell_through_delta_pp),
                },
                {
                    "id": "repeat_rate",
                    "label": "Repeat Rate",
                    "valueText": f"{repeat_pct:.1f}%",
                    "deltaText": f"{repeat_delta_pp:+.2f}pp",
                    "delta_direction": "up" if repeat_delta_pp >= 0 else "down",
                    "color": color_for_delta(repeat_delta_pp),
                },
            ],
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

    def _aggregate_by_category(self, sales: list) -> dict:
        """Aggregate sales by category"""
        by_cat = {}
        for s in sales:
            cat = s.get('category_name', s.get('category', 'Unknown'))
            if cat not in by_cat:
                by_cat[cat] = {'sales': 0, 'plan': 0, 'traffic': 0, 'count': 0}
            by_cat[cat]['sales'] += s.get('actual_sales', s.get('sales', 0))
            by_cat[cat]['plan'] += s.get('plan_sales', s.get('plan', 0))
            by_cat[cat]['traffic'] += s.get('traffic', 0)
            by_cat[cat]['count'] += 1

        for cat in by_cat:
            if by_cat[cat]['plan'] > 0:
                by_cat[cat]['comp_pct'] = round(
                    (by_cat[cat]['sales'] - by_cat[cat]['plan']) / by_cat[cat]['plan'] * 100, 1
                )

        return by_cat


sales_data_mcp = SalesDataMCP()
