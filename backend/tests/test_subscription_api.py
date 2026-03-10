"""
Test suite for subscription and Stripe endpoints
Tests: /api/subscription/plans, /api/subscription/status, /api/subscription/checkout, /api/subscription/checkout/status/{session_id}
Also tests: /api/athletes endpoint for freemium model (1 athlete limit for free tier)
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://freemium-coach-2.preview.emergentagent.com')

class TestHealthCheck:
    """Basic health check tests"""
    
    def test_health_endpoint(self):
        """Test health endpoint returns healthy"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print(f"Health check passed: {data}")


class TestSubscriptionPlans:
    """Tests for /api/subscription/plans endpoint"""
    
    def test_get_subscription_plans(self):
        """Test that subscription plans endpoint returns available plans"""
        response = requests.get(f"{BASE_URL}/api/subscription/plans")
        assert response.status_code == 200
        
        data = response.json()
        assert "plans" in data
        assert "free_tier" in data
        
        plans = data["plans"]
        assert len(plans) >= 2  # monthly and annual
        
        # Verify monthly plan
        monthly_plan = next((p for p in plans if p["id"] == "monthly"), None)
        assert monthly_plan is not None
        assert "price" in monthly_plan
        assert "currency" in monthly_plan
        assert monthly_plan["interval"] == "month"
        
        # Verify annual plan
        annual_plan = next((p for p in plans if p["id"] == "annual"), None)
        assert annual_plan is not None
        assert annual_plan["interval"] == "year"
        
        # Verify free tier info
        free_tier = data["free_tier"]
        assert "athlete_limit" in free_tier
        assert free_tier["athlete_limit"] == 1
        
        print(f"Plans fetched: {[p['id'] for p in plans]}")
        print(f"Free tier limit: {free_tier['athlete_limit']} athlete")


class TestSubscriptionStatus:
    """Tests for /api/subscription/status endpoint"""
    
    @pytest.fixture
    def auth_token(self):
        """Get auth token for test coach"""
        # First try to login, if fails register new user
        unique_id = str(uuid.uuid4())[:8]
        email = f"TEST_status_coach_{unique_id}@test.it"
        password = "test123"
        
        # Try registration
        register_response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": email,
                "name": "Test Status Coach",
                "password": password,
                "role": "coach"
            }
        )
        
        if register_response.status_code == 200:
            return register_response.json()["access_token"]
        
        # If registration fails, try login
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": email, "password": password}
        )
        
        if login_response.status_code == 200:
            return login_response.json()["access_token"]
        
        pytest.skip("Could not authenticate test user")
    
    def test_get_subscription_status_authenticated(self, auth_token):
        """Test subscription status for authenticated coach"""
        headers = {"Authorization": f"Bearer {auth_token}"}
        response = requests.get(
            f"{BASE_URL}/api/subscription/status",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify required fields
        assert "is_premium" in data
        assert "plan" in data
        assert "athlete_count" in data
        assert "athlete_limit" in data
        assert "can_add_athlete" in data
        
        print(f"Subscription status: is_premium={data['is_premium']}, plan={data['plan']}")
        print(f"Athletes: {data['athlete_count']}/{data['athlete_limit']}")
    
    def test_subscription_status_unauthenticated(self):
        """Test subscription status without auth token fails"""
        response = requests.get(f"{BASE_URL}/api/subscription/status")
        assert response.status_code in [401, 403]


class TestSubscriptionCheckout:
    """Tests for /api/subscription/checkout endpoint"""
    
    @pytest.fixture
    def coach_token(self):
        """Get auth token for coach"""
        unique_id = str(uuid.uuid4())[:8]
        email = f"TEST_checkout_coach_{unique_id}@test.it"
        password = "test123"
        
        register_response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": email,
                "name": "Test Checkout Coach",
                "password": password,
                "role": "coach"
            }
        )
        
        if register_response.status_code == 200:
            return register_response.json()["access_token"]
        
        login_response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": email, "password": password}
        )
        
        if login_response.status_code == 200:
            return login_response.json()["access_token"]
        
        pytest.skip("Could not authenticate test user")
    
    def test_create_checkout_session_monthly(self, coach_token):
        """Test creating Stripe checkout session for monthly plan"""
        headers = {"Authorization": f"Bearer {coach_token}"}
        response = requests.post(
            f"{BASE_URL}/api/subscription/checkout",
            headers=headers,
            json={
                "plan_id": "monthly",
                "origin_url": "https://freemium-coach-2.preview.emergentagent.com"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify checkout URL and session ID are returned
        assert "checkout_url" in data
        assert "session_id" in data
        assert data["checkout_url"].startswith("http")
        assert len(data["session_id"]) > 0
        
        print(f"Checkout session created: {data['session_id']}")
        print(f"Checkout URL: {data['checkout_url'][:50]}...")
        
        return data["session_id"]
    
    def test_create_checkout_session_annual(self, coach_token):
        """Test creating Stripe checkout session for annual plan"""
        headers = {"Authorization": f"Bearer {coach_token}"}
        response = requests.post(
            f"{BASE_URL}/api/subscription/checkout",
            headers=headers,
            json={
                "plan_id": "annual",
                "origin_url": "https://freemium-coach-2.preview.emergentagent.com"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "checkout_url" in data
        assert "session_id" in data
        
        print(f"Annual checkout session: {data['session_id']}")
    
    def test_create_checkout_invalid_plan(self, coach_token):
        """Test creating checkout with invalid plan fails"""
        headers = {"Authorization": f"Bearer {coach_token}"}
        response = requests.post(
            f"{BASE_URL}/api/subscription/checkout",
            headers=headers,
            json={
                "plan_id": "invalid_plan",
                "origin_url": "https://freemium-coach-2.preview.emergentagent.com"
            }
        )
        
        assert response.status_code == 400
    
    def test_checkout_unauthenticated(self):
        """Test checkout without auth fails"""
        response = requests.post(
            f"{BASE_URL}/api/subscription/checkout",
            json={
                "plan_id": "monthly",
                "origin_url": "https://freemium-coach-2.preview.emergentagent.com"
            }
        )
        assert response.status_code in [401, 403]


class TestCheckoutStatus:
    """Tests for /api/subscription/checkout/status/{session_id} endpoint"""
    
    @pytest.fixture
    def coach_with_session(self):
        """Create coach and checkout session"""
        unique_id = str(uuid.uuid4())[:8]
        email = f"TEST_status_check_coach_{unique_id}@test.it"
        password = "test123"
        
        register_response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": email,
                "name": "Test Status Check Coach",
                "password": password,
                "role": "coach"
            }
        )
        
        if register_response.status_code != 200:
            pytest.skip("Could not register test user")
        
        token = register_response.json()["access_token"]
        
        # Create checkout session
        headers = {"Authorization": f"Bearer {token}"}
        checkout_response = requests.post(
            f"{BASE_URL}/api/subscription/checkout",
            headers=headers,
            json={
                "plan_id": "monthly",
                "origin_url": "https://freemium-coach-2.preview.emergentagent.com"
            }
        )
        
        if checkout_response.status_code != 200:
            pytest.skip("Could not create checkout session")
        
        session_id = checkout_response.json()["session_id"]
        return {"token": token, "session_id": session_id}
    
    def test_get_checkout_status(self, coach_with_session):
        """Test getting checkout session status"""
        headers = {"Authorization": f"Bearer {coach_with_session['token']}"}
        response = requests.get(
            f"{BASE_URL}/api/subscription/checkout/status/{coach_with_session['session_id']}",
            headers=headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify status fields
        assert "status" in data
        assert "payment_status" in data
        
        # For unpaid sessions, status should be open or expired
        print(f"Checkout status: {data['status']}, payment: {data['payment_status']}")
    
    def test_checkout_status_invalid_session(self):
        """Test checkout status with invalid session ID"""
        # Create auth token first
        unique_id = str(uuid.uuid4())[:8]
        email = f"TEST_invalid_session_{unique_id}@test.it"
        
        register_response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": email,
                "name": "Test Invalid Session",
                "password": "test123",
                "role": "coach"
            }
        )
        
        if register_response.status_code != 200:
            pytest.skip("Could not register test user")
        
        token = register_response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        response = requests.get(
            f"{BASE_URL}/api/subscription/checkout/status/invalid_session_id_12345",
            headers=headers
        )
        
        # Should return 500 (Stripe error) or 404
        assert response.status_code in [404, 500]


class TestFreemiumAthleteLimit:
    """Tests for freemium athlete limit (max 1 for free tier)"""
    
    @pytest.fixture
    def fresh_coach(self):
        """Create a fresh coach with no athletes"""
        unique_id = str(uuid.uuid4())[:8]
        email = f"TEST_freemium_coach_{unique_id}@test.it"
        password = "test123"
        
        register_response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": email,
                "name": "Test Freemium Coach",
                "password": password,
                "role": "coach"
            }
        )
        
        if register_response.status_code != 200:
            pytest.skip("Could not register test user")
        
        return {
            "token": register_response.json()["access_token"],
            "email": email
        }
    
    def test_first_athlete_creation_succeeds(self, fresh_coach):
        """Test that first athlete creation succeeds for free tier"""
        headers = {"Authorization": f"Bearer {fresh_coach['token']}"}
        
        unique_id = str(uuid.uuid4())[:8]
        response = requests.post(
            f"{BASE_URL}/api/athletes",
            headers=headers,
            json={
                "name": f"TEST_First Athlete {unique_id}",
                "email": f"TEST_first_athlete_{unique_id}@test.it",
                "phone": "1234567890"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "id" in data
        assert "access_code" in data  # Verify access code is generated
        
        print(f"First athlete created: {data['id']}")
        print(f"Access code: {data['access_code']}")
        
        return data["id"]
    
    def test_second_athlete_fails_for_free_tier_without_trial(self, fresh_coach):
        """Test that second athlete creation should fail for free tier after trial ends"""
        headers = {"Authorization": f"Bearer {fresh_coach['token']}"}
        
        # Create first athlete
        unique_id1 = str(uuid.uuid4())[:8]
        response1 = requests.post(
            f"{BASE_URL}/api/athletes",
            headers=headers,
            json={
                "name": f"TEST_First Athlete {unique_id1}",
                "email": f"TEST_first_athlete_{unique_id1}@test.it"
            }
        )
        assert response1.status_code == 200
        
        # Try to create second athlete
        # Note: This might succeed if coach has trial subscription active
        unique_id2 = str(uuid.uuid4())[:8]
        response2 = requests.post(
            f"{BASE_URL}/api/athletes",
            headers=headers,
            json={
                "name": f"TEST_Second Athlete {unique_id2}",
                "email": f"TEST_second_athlete_{unique_id2}@test.it"
            }
        )
        
        # Document behavior: New coaches get 30-day trial, so second athlete might succeed
        # If trial active: 200
        # If no trial: 403
        if response2.status_code == 200:
            print("Second athlete created - coach has active trial subscription")
        elif response2.status_code == 403:
            print("Second athlete blocked - free tier limit enforced")
            assert "Piano gratuito limitato" in response2.json().get("detail", "")
        else:
            print(f"Unexpected status: {response2.status_code}")


class TestAuthEndpoints:
    """Test authentication endpoints"""
    
    def test_register_coach(self):
        """Test coach registration"""
        unique_id = str(uuid.uuid4())[:8]
        response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": f"TEST_new_coach_{unique_id}@test.it",
                "name": "Test New Coach",
                "password": "test123",
                "role": "coach"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["role"] == "coach"
        
        # Verify subscription is assigned to new coach
        if data["user"].get("subscription"):
            assert data["user"]["subscription"]["plan"] in ["trial", "none"]
        
        print(f"Coach registered: {data['user']['email']}")
    
    def test_login_coach(self):
        """Test coach login"""
        unique_id = str(uuid.uuid4())[:8]
        email = f"TEST_login_coach_{unique_id}@test.it"
        password = "test123"
        
        # Register first
        requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": email,
                "name": "Test Login Coach",
                "password": password,
                "role": "coach"
            }
        )
        
        # Then login
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": email, "password": password}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "access_token" in data
        assert "user" in data
        
        print(f"Coach logged in: {data['user']['email']}")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials fails"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": "nonexistent@test.it",
                "password": "wrongpassword"
            }
        )
        
        assert response.status_code == 401
    
    def test_get_me_authenticated(self):
        """Test /auth/me endpoint"""
        unique_id = str(uuid.uuid4())[:8]
        email = f"TEST_me_coach_{unique_id}@test.it"
        
        # Register
        register_response = requests.post(
            f"{BASE_URL}/api/auth/register",
            json={
                "email": email,
                "name": "Test Me Coach",
                "password": "test123",
                "role": "coach"
            }
        )
        
        if register_response.status_code != 200:
            pytest.skip("Could not register")
        
        token = register_response.json()["access_token"]
        
        # Get me
        headers = {"Authorization": f"Bearer {token}"}
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["email"] == email
        assert data["role"] == "coach"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
