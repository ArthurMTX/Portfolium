from types import SimpleNamespace

import pytest

from app.routers.assets import calculate_theme_allocation


@pytest.mark.unit
class TestThemeAllocation:
    def test_primary_only_themes_split_equally(self):
        positions = [
            SimpleNamespace(
                symbol='NVDA',
                name='NVIDIA Corporation',
                market_value=1000,
                themes=[
                    {'label': 'AI Infrastructure', 'tier': 'primary'},
                    {'label': 'Data Centers', 'tier': 'primary'},
                ],
            )
        ]

        allocation = calculate_theme_allocation(positions)

        assert allocation == [
            {
                'theme': 'AI Infrastructure',
                'value': 500.0,
                'percentage': 50.0,
                'assets': [
                    {
                        'symbol': 'NVDA',
                        'name': 'NVIDIA Corporation',
                        'contribution_value': 500.0,
                    }
                ],
            },
            {
                'theme': 'Data Centers',
                'value': 500.0,
                'percentage': 50.0,
                'assets': [
                    {
                        'symbol': 'NVDA',
                        'name': 'NVIDIA Corporation',
                        'contribution_value': 500.0,
                    }
                ],
            },
        ]

    def test_secondary_only_themes_split_equally(self):
        positions = [
            SimpleNamespace(
                symbol='PLTR',
                name='Palantir Technologies',
                market_value=1000,
                themes=[
                    {'label': 'Defense Tech', 'tier': 'secondary'},
                    {'label': 'AI Infrastructure', 'tier': 'secondary'},
                ],
            )
        ]

        allocation = calculate_theme_allocation(positions)
        allocation_by_theme = {item['theme']: item for item in allocation}

        assert allocation_by_theme['AI Infrastructure']['value'] == 500.0
        assert allocation_by_theme['AI Infrastructure']['percentage'] == 50.0
        assert allocation_by_theme['Defense Tech']['value'] == 500.0
        assert allocation_by_theme['Defense Tech']['percentage'] == 50.0

    def test_primary_and_secondary_follow_method_two(self):
        positions = [
            SimpleNamespace(
                symbol='NVDA',
                name='NVIDIA Corporation',
                market_value=1000,
                themes=[
                    {'label': 'AI Infrastructure', 'tier': 'primary'},
                    {'label': 'Data Centers', 'tier': 'primary'},
                    {'label': 'Cloud Infrastructure', 'tier': 'secondary'},
                ],
            )
        ]

        allocation = calculate_theme_allocation(positions)
        allocation_by_theme = {item['theme']: item for item in allocation}

        assert allocation_by_theme['AI Infrastructure']['value'] == 350.0
        assert allocation_by_theme['Data Centers']['value'] == 350.0
        assert allocation_by_theme['Cloud Infrastructure']['value'] == 300.0
        assert sum(item['percentage'] for item in allocation) == pytest.approx(100.0, abs=0.01)

    def test_no_themes_go_to_unclassified(self):
        positions = [
            SimpleNamespace(
                symbol='CASH',
                name='Cash Position',
                market_value=1000,
                themes=[],
            )
        ]

        allocation = calculate_theme_allocation(positions)

        assert allocation == [
            {
                'theme': 'Unclassified',
                'value': 1000.0,
                'percentage': 100.0,
                'assets': [
                    {
                        'symbol': 'CASH',
                        'name': 'Cash Position',
                        'contribution_value': 1000.0,
                    }
                ],
            }
        ]

    def test_multiple_assets_aggregate_into_same_theme(self):
        positions = [
            SimpleNamespace(
                symbol='NVDA',
                name='NVIDIA Corporation',
                market_value=1000,
                themes=[{'label': 'AI Infrastructure', 'tier': 'primary'}],
            ),
            SimpleNamespace(
                symbol='AMD',
                name='Advanced Micro Devices',
                market_value=500,
                themes=[{'label': 'AI Infrastructure', 'tier': 'secondary'}],
            ),
        ]

        allocation = calculate_theme_allocation(positions)

        assert allocation == [
            {
                'theme': 'AI Infrastructure',
                'value': 1500.0,
                'percentage': 100.0,
                'assets': [
                    {
                        'symbol': 'NVDA',
                        'name': 'NVIDIA Corporation',
                        'contribution_value': 1000.0,
                    },
                    {
                        'symbol': 'AMD',
                        'name': 'Advanced Micro Devices',
                        'contribution_value': 500.0,
                    },
                ],
            }
        ]

    def test_percentages_sum_to_about_one_hundred(self):
        positions = [
            SimpleNamespace(
                symbol='NVDA',
                name='NVIDIA Corporation',
                market_value=1000,
                themes=[
                    {'label': 'AI Infrastructure', 'tier': 'primary'},
                    {'label': 'Data Centers', 'tier': 'secondary'},
                ],
            ),
            SimpleNamespace(
                symbol='PLTR',
                name='Palantir Technologies',
                market_value=500,
                themes=[{'label': 'Defense Tech', 'tier': 'primary'}],
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
                themes=[
                    {'label': 'AI Infrastructure', 'tier': 'primary'},
                    {'label': 'AI Infrastructure', 'tier': 'secondary'},
                ],
            )
        ]

        allocation = calculate_theme_allocation(positions)

        assert allocation == [
            {
                'theme': 'AI Infrastructure',
                'value': 1000.0,
                'percentage': 100.0,
                'assets': [
                    {
                        'symbol': 'NVDA',
                        'name': 'NVIDIA Corporation',
                        'contribution_value': 1000.0,
                    }
                ],
            }
        ]

    def test_hierarchical_theme_allocation_ignores_subthemes(self):
        positions = [
            SimpleNamespace(
                symbol='NVDA',
                name='NVIDIA Corporation',
                market_value=1000,
                themes=[
                    {
                        'label': 'AI Infrastructure',
                        'tier': 'primary',
                        'children': [
                            {'label': 'GPU Computing', 'confidence': 0.92},
                            {'label': 'Data Centers', 'confidence': 0.88},
                        ],
                    },
                    {
                        'label': 'Space Infrastructure',
                        'tier': 'secondary',
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
        assert allocation_by_theme['AI Infrastructure']['value'] == 700.0
        assert allocation_by_theme['Space Infrastructure']['value'] == 300.0
