"""
Tests for dashboard layout management
"""
import pytest
from datetime import datetime

from app.models import DashboardLayout
from app.schemas import (
    DashboardLayoutCreate, DashboardLayoutUpdate,
    LayoutConfigSchema, LayoutItemSchema
)
from app.crud import dashboard_layouts as crud
from tests.factories import UserFactory, PortfolioFactory


def sample_layout_config():
    """Create a sample layout configuration"""
    return LayoutConfigSchema(
        lg=[
            LayoutItemSchema(i="portfolio-summary", x=0, y=0, w=6, h=2),
            LayoutItemSchema(i="asset-allocation", x=6, y=0, w=6, h=2),
            LayoutItemSchema(i="performance-chart", x=0, y=2, w=12, h=4),
        ],
        md=[
            LayoutItemSchema(i="portfolio-summary", x=0, y=0, w=6, h=2),
            LayoutItemSchema(i="asset-allocation", x=0, y=2, w=6, h=2),
            LayoutItemSchema(i="performance-chart", x=0, y=4, w=6, h=4),
        ],
        sm=[
            LayoutItemSchema(i="portfolio-summary", x=0, y=0, w=4, h=2),
            LayoutItemSchema(i="asset-allocation", x=0, y=2, w=4, h=2),
            LayoutItemSchema(i="performance-chart", x=0, y=4, w=4, h=4),
        ]
    )


@pytest.mark.crud
@pytest.mark.unit
class TestDashboardLayoutCRUD:
    """Test dashboard layout CRUD operations"""
    
    def test_create_layout(self, test_db):
        """Test creating a new dashboard layout"""
        user = UserFactory.create()
        test_db.commit()
        
        layout_create = DashboardLayoutCreate(
            name="My Custom Layout",
            description="A test layout",
            portfolio_id=None,
            is_default=False,
            is_shared=False,
            layout_config=sample_layout_config()
        )
        
        layout = crud.create_layout(test_db, layout_create, user.id)
        
        assert layout.id is not None
        assert layout.user_id == user.id
        assert layout.name == "My Custom Layout"
        assert layout.description == "A test layout"
        assert layout.portfolio_id is None
        assert layout.is_default is False
        assert layout.is_shared is False
        assert layout.layout_config is not None
        assert len(layout.layout_config['lg']) == 3
    
    def test_create_default_layout_unsets_previous_default(self, test_db):
        """Test that creating a default layout unsets previous defaults"""
        user = UserFactory.create()
        test_db.commit()
        
        # Create first default layout
        layout1 = crud.create_layout(
            test_db,
            DashboardLayoutCreate(
                name="Layout 1",
                is_default=True,
                layout_config=sample_layout_config()
            ),
            user.id
        )
        assert layout1.is_default is True
        
        # Create second default layout
        layout2 = crud.create_layout(
            test_db,
            DashboardLayoutCreate(
                name="Layout 2",
                is_default=True,
                layout_config=sample_layout_config()
            ),
            user.id
        )
        
        test_db.refresh(layout1)
        
        # First layout should no longer be default
        assert layout1.is_default is False
        assert layout2.is_default is True
    
    def test_get_layout_by_id(self, test_db):
        """Test retrieving a layout by ID"""
        user = UserFactory.create()
        test_db.commit()
        
        created_layout = crud.create_layout(
            test_db,
            DashboardLayoutCreate(
                name="Test Layout",
                layout_config=sample_layout_config()
            ),
            user.id
        )
        
        retrieved_layout = crud.get_layout_by_id(test_db, created_layout.id, user.id)
        
        assert retrieved_layout is not None
        assert retrieved_layout.id == created_layout.id
        assert retrieved_layout.name == "Test Layout"
    
    def test_get_layout_by_id_wrong_user(self, test_db):
        """Test that getting a layout with wrong user returns None"""
        user1 = UserFactory.create()
        user2 = UserFactory.create()
        test_db.commit()
        
        layout = crud.create_layout(
            test_db,
            DashboardLayoutCreate(
                name="User 1 Layout",
                layout_config=sample_layout_config()
            ),
            user1.id
        )
        
        # Try to get with wrong user
        retrieved = crud.get_layout_by_id(test_db, layout.id, user2.id)
        
        assert retrieved is None
    
    def test_get_user_layouts(self, test_db):
        """Test getting all layouts for a user"""
        user = UserFactory.create()
        test_db.commit()
        
        # Create multiple layouts
        for i in range(3):
            crud.create_layout(
                test_db,
                DashboardLayoutCreate(
                    name=f"Layout {i+1}",
                    layout_config=sample_layout_config()
                ),
                user.id
            )
        
        layouts = crud.get_user_layouts(test_db, user.id)
        
        assert len(layouts) == 3
    
    def test_get_default_layout(self, test_db):
        """Test getting the default layout"""
        user = UserFactory.create()
        test_db.commit()
        
        # Create non-default layout
        crud.create_layout(
            test_db,
            DashboardLayoutCreate(
                name="Non-default",
                is_default=False,
                layout_config=sample_layout_config()
            ),
            user.id
        )
        
        # Create default layout
        default_layout = crud.create_layout(
            test_db,
            DashboardLayoutCreate(
                name="Default Layout",
                is_default=True,
                layout_config=sample_layout_config()
            ),
            user.id
        )
        
        retrieved = crud.get_default_layout(test_db, user.id)
        
        assert retrieved is not None
        assert retrieved.id == default_layout.id
        assert retrieved.is_default is True
    
    def test_update_layout(self, test_db):
        """Test updating a layout"""
        user = UserFactory.create()
        test_db.commit()
        
        layout = crud.create_layout(
            test_db,
            DashboardLayoutCreate(
                name="Original Name",
                description="Original Description",
                layout_config=sample_layout_config()
            ),
            user.id
        )
        
        # Update the layout
        update = DashboardLayoutUpdate(
            name="Updated Name",
            description="Updated Description"
        )
        
        updated_layout = crud.update_layout(test_db, layout.id, user.id, update)
        
        assert updated_layout is not None
        assert updated_layout.name == "Updated Name"
        assert updated_layout.description == "Updated Description"
    
    def test_update_to_default_unsets_other_defaults(self, test_db):
        """Test that updating a layout to default unsets other defaults"""
        user = UserFactory.create()
        test_db.commit()
        
        # Create default layout
        layout1 = crud.create_layout(
            test_db,
            DashboardLayoutCreate(
                name="Layout 1",
                is_default=True,
                layout_config=sample_layout_config()
            ),
            user.id
        )
        
        # Create non-default layout
        layout2 = crud.create_layout(
            test_db,
            DashboardLayoutCreate(
                name="Layout 2",
                is_default=False,
                layout_config=sample_layout_config()
            ),
            user.id
        )
        
        # Update layout2 to be default
        crud.update_layout(
            test_db,
            layout2.id,
            user.id,
            DashboardLayoutUpdate(is_default=True)
        )
        
        test_db.refresh(layout1)
        test_db.refresh(layout2)
        
        assert layout1.is_default is False
        assert layout2.is_default is True
    
    def test_delete_layout(self, test_db):
        """Test deleting a layout"""
        user = UserFactory.create()
        test_db.commit()
        
        layout = crud.create_layout(
            test_db,
            DashboardLayoutCreate(
                name="To Delete",
                layout_config=sample_layout_config()
            ),
            user.id
        )
        
        # Delete the layout
        success = crud.delete_layout(test_db, layout.id, user.id)
        
        assert success is True
        
        # Verify it's gone
        deleted = crud.get_layout_by_id(test_db, layout.id, user.id)
        assert deleted is None
    
    def test_duplicate_layout(self, test_db):
        """Test duplicating a layout"""
        user = UserFactory.create()
        test_db.commit()
        
        original = crud.create_layout(
            test_db,
            DashboardLayoutCreate(
                name="Original Layout",
                description="Original Description",
                is_default=True,
                layout_config=sample_layout_config()
            ),
            user.id
        )
        
        # Duplicate the layout
        duplicate = crud.duplicate_layout(
            test_db,
            original.id,
            user.id,
            "Duplicated Layout"
        )
        
        assert duplicate is not None
        assert duplicate.id != original.id
        assert duplicate.name == "Duplicated Layout"
        assert duplicate.description == f"Copy of {original.name}"
        assert duplicate.is_default is False  # Duplicates are never default
        assert duplicate.layout_config == original.layout_config


@pytest.mark.api
@pytest.mark.integration
class TestDashboardLayoutAPI:
    """Test dashboard layout API endpoints"""
    
    def test_list_layouts_empty(self, client, auth_headers):
        """Test listing layouts when user has none"""
        response = client.get("/dashboard-layouts/", headers=auth_headers)
        
        assert response.status_code == 200
        assert response.json() == []
    
    def test_create_layout_via_api(self, client, auth_headers):
        """Test creating a layout via API"""
        layout_data = {
            "name": "API Created Layout",
            "description": "Created via API",
            "is_default": False,
            "is_shared": False,
            "layout_config": {
                "lg": [{"i": "widget-1", "x": 0, "y": 0, "w": 6, "h": 2}],
                "md": [{"i": "widget-1", "x": 0, "y": 0, "w": 6, "h": 2}],
                "sm": [{"i": "widget-1", "x": 0, "y": 0, "w": 4, "h": 2}]
            }
        }
        
        response = client.post(
            "/dashboard-layouts/",
            json=layout_data,
            headers=auth_headers
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "API Created Layout"
        assert data["description"] == "Created via API"
        assert "id" in data
        assert "created_at" in data
    
    def test_get_layout_by_id_via_api(self, client, auth_headers, test_db, test_user):
        """Test getting a specific layout via API"""
        # Create a layout first
        layout = crud.create_layout(
            test_db,
            DashboardLayoutCreate(
                name="Test Layout",
                layout_config=sample_layout_config()
            ),
            test_user.id
        )
        
        response = client.get(
            f"/dashboard-layouts/{layout.id}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == layout.id
        assert data["name"] == "Test Layout"
    
    def test_get_layout_not_found(self, client, auth_headers):
        """Test getting non-existent layout returns 404"""
        response = client.get(
            "/dashboard-layouts/99999",
            headers=auth_headers
        )
        
        assert response.status_code == 404
    
    def test_update_layout_via_api(self, client, auth_headers, test_db, test_user):
        """Test updating a layout via API"""
        # Create a layout
        layout = crud.create_layout(
            test_db,
            DashboardLayoutCreate(
                name="Original",
                layout_config=sample_layout_config()
            ),
            test_user.id
        )
        
        # Update it
        update_data = {
            "name": "Updated Name",
            "description": "Updated Description"
        }
        
        response = client.put(
            f"/dashboard-layouts/{layout.id}",
            json=update_data,
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["description"] == "Updated Description"
    
    def test_delete_layout_via_api(self, client, auth_headers, test_db, test_user):
        """Test deleting a layout via API"""
        # Create a layout
        layout = crud.create_layout(
            test_db,
            DashboardLayoutCreate(
                name="To Delete",
                layout_config=sample_layout_config()
            ),
            test_user.id
        )
        
        # Delete it
        response = client.delete(
            f"/dashboard-layouts/{layout.id}",
            headers=auth_headers
        )
        
        assert response.status_code == 204
        
        # Verify it's gone
        get_response = client.get(
            f"/dashboard-layouts/{layout.id}",
            headers=auth_headers
        )
        assert get_response.status_code == 404
    
    def test_duplicate_layout_via_api(self, client, auth_headers, test_db, test_user):
        """Test duplicating a layout via API"""
        # Create original layout
        layout = crud.create_layout(
            test_db,
            DashboardLayoutCreate(
                name="Original",
                layout_config=sample_layout_config()
            ),
            test_user.id
        )
        
        # Duplicate it
        response = client.post(
            f"/dashboard-layouts/{layout.id}/duplicate?new_name=Duplicated",
            headers=auth_headers
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Duplicated"
        assert data["id"] != layout.id
    
    def test_get_default_layout_via_api(self, client, auth_headers, test_db, test_user):
        """Test getting default layout via API"""
        # Create default layout
        layout = crud.create_layout(
            test_db,
            DashboardLayoutCreate(
                name="Default Layout",
                is_default=True,
                layout_config=sample_layout_config()
            ),
            test_user.id
        )
        
        response = client.get(
            "/dashboard-layouts/default",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == layout.id
        assert data["is_default"] is True
    
    def test_export_layout_via_api(self, client, auth_headers, test_db, test_user):
        """Test exporting a layout via API"""
        # Create layout
        layout = crud.create_layout(
            test_db,
            DashboardLayoutCreate(
                name="Export Test",
                description="Layout to export",
                layout_config=sample_layout_config()
            ),
            test_user.id
        )
        
        response = client.get(
            f"/dashboard-layouts/{layout.id}/export",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Export Test"
        assert data["description"] == "Layout to export"
        assert "layout_config" in data
        assert "exported_at" in data
    
    def test_import_layout_via_api(self, client, auth_headers):
        """Test importing a layout via API"""
        import_data = {
            "name": "Imported Layout",
            "description": "This was imported",
            "layout_config": {
                "lg": [{"i": "widget-1", "x": 0, "y": 0, "w": 6, "h": 2}],
                "md": [{"i": "widget-1", "x": 0, "y": 0, "w": 6, "h": 2}],
                "sm": [{"i": "widget-1", "x": 0, "y": 0, "w": 4, "h": 2}]
            },
            "exported_at": datetime.utcnow().isoformat()
        }
        
        response = client.post(
            "/dashboard-layouts/import",
            json=import_data,
            headers=auth_headers
        )
        
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Imported Layout"
        assert data["portfolio_id"] is None  # Should be global


@pytest.mark.unit
class TestLayoutConfigValidation:
    """Test layout configuration validation"""
    
    def test_valid_layout_item(self):
        """Test creating valid layout item"""
        item = LayoutItemSchema(
            i="test-widget",
            x=0,
            y=0,
            w=6,
            h=2
        )
        
        assert item.i == "test-widget"
        assert item.x == 0
        assert item.y == 0
        assert item.w == 6
        assert item.h == 2
    
    def test_layout_item_with_constraints(self):
        """Test layout item with min/max constraints"""
        item = LayoutItemSchema(
            i="constrained-widget",
            x=0,
            y=0,
            w=4,
            h=2,
            minW=2,
            minH=1,
            maxW=8,
            maxH=4
        )
        
        assert item.minW == 2
        assert item.minH == 1
        assert item.maxW == 8
        assert item.maxH == 4
    
    def test_complete_layout_config(self):
        """Test complete layout configuration with all breakpoints"""
        config = sample_layout_config()
        
        assert len(config.lg) == 3
        assert len(config.md) == 3
        assert len(config.sm) == 3
        
        # Verify all widgets present in all breakpoints
        widget_ids = {"portfolio-summary", "asset-allocation", "performance-chart"}
        assert {item.i for item in config.lg} == widget_ids
        assert {item.i for item in config.md} == widget_ids
        assert {item.i for item in config.sm} == widget_ids
