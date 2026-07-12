from types import SimpleNamespace

import pytest

from app.routers.assets import calculate_theme_allocation


@pytest.mark.unit
class TestThemeAllocation:
    def test_weighted_theme_market_value(self):
        positions = [
            SimpleNamespace(
                symbol='NVDA',
                name='NVIDIA Corporation',
                market_value=1000,
                cost_basis=800,
                unrealized_pnl=200,
                themes=[
                    {'label': 'AI Infrastructure', 'tier': 'primary', 'weight': 0.75},
                    {'label': 'Data Centers', 'tier': 'primary', 'weight': 0.25},
                ],
            )
        ]

        allocation = calculate_theme_allocation(positions)
        allocation_by_theme = {item['theme']: item for item in allocation}

        assert allocation_by_theme['AI Infrastructure']['value'] == 750.0
        assert allocation_by_theme['Data Centers']['value'] == 250.0
        assert allocation_by_theme['AI Infrastructure']['assets'][0]['contribution_value'] == 750.0

    def test_weighted_cost_basis(self):
        positions = [
            SimpleNamespace(
                symbol='PLTR',
                name='Palantir Technologies',
                market_value=1000,
                cost_basis=600,
                unrealized_pnl=400,
                themes=[
                    {'label': 'Defense Tech', 'tier': 'secondary', 'weight': 0.4},
                    {'label': 'AI Infrastructure', 'tier': 'secondary', 'weight': 0.6},
                ],
            )
        ]

        allocation = calculate_theme_allocation(positions)
        allocation_by_theme = {item['theme']: item for item in allocation}

        assert allocation_by_theme['Defense Tech']['cost_basis'] == 240.0
        assert allocation_by_theme['AI Infrastructure']['cost_basis'] == 360.0
        assert allocation_by_theme['AI Infrastructure']['assets'][0]['contribution_cost_basis'] == 360.0

    def test_weighted_unrealized_pnl(self):
        positions = [
            SimpleNamespace(
                symbol='NVDA',
                name='NVIDIA Corporation',
                market_value=1000,
                cost_basis=900,
                unrealized_pnl=100,
                themes=[
                    {'label': 'AI Infrastructure', 'tier': 'primary', 'weight': 0.7},
                    {'label': 'Cloud Infrastructure', 'tier': 'secondary', 'weight': 0.3},
                ],
            )
        ]

        allocation = calculate_theme_allocation(positions)
        allocation_by_theme = {item['theme']: item for item in allocation}

        assert allocation_by_theme['AI Infrastructure']['unrealized_pnl'] == 70.0
        assert allocation_by_theme['Cloud Infrastructure']['unrealized_pnl'] == 30.0
        assert allocation_by_theme['AI Infrastructure']['assets'][0]['contribution_unrealized_pnl'] == 70.0

    def test_unrealized_pnl_percentage_calculation(self):
        positions = [
            SimpleNamespace(
                symbol='NVDA',
                name='NVIDIA Corporation',
                market_value=1000,
                cost_basis=800,
                unrealized_pnl=200,
                themes=[{'label': 'AI Infrastructure', 'tier': 'primary', 'weight': 1}],
            )
        ]

        allocation = calculate_theme_allocation(positions)

        assert allocation[0]['unrealized_pnl_pct'] == 25.0
        assert allocation[0]['assets'][0]['contribution_unrealized_pnl_pct'] == 25.0

    def test_zero_cost_basis_has_zero_unrealized_pnl_pct(self):
        positions = [
            SimpleNamespace(
                symbol='NVDA',
                name='NVIDIA Corporation',
                market_value=1000,
                cost_basis=0,
                unrealized_pnl=100,
                themes=[{'label': 'AI Infrastructure', 'tier': 'primary', 'weight': 1}],
            ),
        ]

        allocation = calculate_theme_allocation(positions)

        assert allocation[0]['cost_basis'] == 0.0
        assert allocation[0]['unrealized_pnl'] == 100.0
        assert allocation[0]['unrealized_pnl_pct'] == 0.0

    def test_fallback_equal_split_when_theme_weight_missing(self):
        positions = [
            SimpleNamespace(
                symbol='NVDA',
                name='NVIDIA Corporation',
                market_value=1000,
                cost_basis=800,
                unrealized_pnl=200,
                themes=[
                    {'label': 'AI Infrastructure', 'tier': 'primary'},
                    {'label': 'Data Centers', 'tier': 'secondary'},
                ],
            )
        ]

        allocation = calculate_theme_allocation(positions)
        allocation_by_theme = {item['theme']: item for item in allocation}

        assert allocation_by_theme['AI Infrastructure']['value'] == 500.0
        assert allocation_by_theme['Data Centers']['value'] == 500.0
        assert allocation_by_theme['AI Infrastructure']['cost_basis'] == 400.0
        assert allocation_by_theme['Data Centers']['unrealized_pnl'] == 100.0

    def test_no_themes_go_to_unclassified(self):
        positions = [
            SimpleNamespace(
                symbol='CASH',
                name='Cash Position',
                market_value=1000,
                cost_basis=1000,
                unrealized_pnl=0,
                themes=[],
            )
        ]

        allocation = calculate_theme_allocation(positions)

        assert allocation[0]['theme'] == 'Unclassified'
        assert allocation[0]['value'] == 1000.0
        assert allocation[0]['cost_basis'] == 1000.0
        assert allocation[0]['unrealized_pnl'] == 0.0
        assert allocation[0]['percentage'] == 100.0

    def test_multiple_assets_aggregate_into_same_theme(self):
        positions = [
            SimpleNamespace(
                symbol='NVDA',
                name='NVIDIA Corporation',
                market_value=1000,
                cost_basis=800,
                unrealized_pnl=200,
                themes=[{'label': 'AI Infrastructure', 'tier': 'primary', 'weight': 1}],
            ),
            SimpleNamespace(
                symbol='AMD',
                name='Advanced Micro Devices',
                market_value=500,
                cost_basis=400,
                unrealized_pnl=100,
                themes=[{'label': 'AI Infrastructure', 'tier': 'secondary', 'weight': 1}],
            ),
        ]

        allocation = calculate_theme_allocation(positions)

        assert allocation[0]['theme'] == 'AI Infrastructure'
        assert allocation[0]['value'] == 1500.0
        assert allocation[0]['cost_basis'] == 1200.0
        assert allocation[0]['unrealized_pnl'] == 300.0
        assert allocation[0]['assets'][0]['contribution_value'] == 1000.0
        assert allocation[0]['assets'][1]['contribution_value'] == 500.0

    def test_percentages_sum_to_about_one_hundred(self):
        positions = [
            SimpleNamespace(
                symbol='NVDA',
                name='NVIDIA Corporation',
                market_value=1000,
                cost_basis=800,
                unrealized_pnl=200,
                themes=[
                    {'label': 'AI Infrastructure', 'tier': 'primary', 'weight': 0.7},
                    {'label': 'Data Centers', 'tier': 'secondary', 'weight': 0.3},
                ],
            ),
            SimpleNamespace(
                symbol='PLTR',
                name='Palantir Technologies',
                market_value=500,
                cost_basis=300,
                unrealized_pnl=200,
                themes=[{'label': 'Defense Tech', 'tier': 'primary', 'weight': 1}],
            ),
        ]

        allocation = calculate_theme_allocation(positions)

        assert sum(item['percentage'] for item in allocation) == pytest.approx(100.0, abs=0.01)

    def test_duplicate_theme_labels_do_not_double_count(self):
        positions = [
            SimpleNamespace(
                symbol='NVDA',
                name='NVIDIA Corporation',
                market_value=1000,
                cost_basis=800,
                unrealized_pnl=200,
                themes=[
                    {'label': 'AI Infrastructure', 'tier': 'primary', 'weight': 0.5},
                    {'label': 'AI Infrastructure', 'tier': 'secondary', 'weight': 0.5},
                ],
            )
        ]

        allocation = calculate_theme_allocation(positions)

        assert allocation[0]['theme'] == 'AI Infrastructure'
        assert allocation[0]['value'] == 1000.0
        assert allocation[0]['cost_basis'] == 800.0
        assert allocation[0]['unrealized_pnl'] == 200.0

    def test_hierarchical_theme_allocation_ignores_subthemes(self):
        positions = [
            SimpleNamespace(
                symbol='NVDA',
                name='NVIDIA Corporation',
                market_value=1000,
                cost_basis=800,
                unrealized_pnl=200,
                themes=[
                    {
                        'label': 'AI Infrastructure',
                        'tier': 'primary',
                        'weight': 0.8,
                        'children': [
                            {'label': 'GPU Computing', 'confidence': 0.92},
                            {'label': 'Data Centers', 'confidence': 0.88},
                        ],
                    },
                    {
                        'label': 'Space Infrastructure',
                        'tier': 'secondary',
                        'weight': 0.2,
                        'children': [
                            {'label': 'Satellites', 'confidence': 0.8},
                        ],
                    },
                ],
            )
        ]

        allocation = calculate_theme_allocation(positions)
        allocation_by_theme = {item['theme']: item for item in allocation}

        assert set(allocation_by_theme) == {'AI Infrastructure', 'Space Infrastructure'}
        assert allocation_by_theme['AI Infrastructure']['value'] == 800.0
        assert allocation_by_theme['Space Infrastructure']['value'] == 200.0

    def test_subthemes_split_parent_theme_contribution_equally(self):
        positions = [
            SimpleNamespace(
                symbol='NVDA',
                name='NVIDIA Corporation',
                market_value=1000,
                cost_basis=800,
                unrealized_pnl=200,
                themes=[
                    {
                        'label': 'AI Infrastructure',
                        'tier': 'primary',
                        'weight': 1,
                        'children': [
                            {'label': 'GPU Computing', 'confidence': 0.92},
                            {'label': 'Data Centers', 'confidence': 0.88},
                        ],
                    },
                ],
            )
        ]

        allocation = calculate_theme_allocation(positions)
        subthemes = {item['name']: item for item in allocation[0]['subthemes']}

        assert subthemes['GPU Computing']['value'] == 500.0
        assert subthemes['GPU Computing']['cost_basis'] == 400.0
        assert subthemes['GPU Computing']['unrealized_pnl'] == 100.0
        assert subthemes['GPU Computing']['percentage'] == 50.0
        assert subthemes['GPU Computing']['assets'][0]['contribution_unrealized_pnl_pct'] == 25.0
        assert subthemes['Data Centers']['value'] == 500.0
