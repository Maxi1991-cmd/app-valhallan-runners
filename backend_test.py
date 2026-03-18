#!/usr/bin/env python3
"""
Comprehensive Backend API Testing for RunCoach Pro
Tests all authentication, athlete, payment, training, and analytics endpoints
"""

import requests
import json
import uuid
from datetime import datetime, timedelta
import os

# Get backend URL from environment
BACKEND_URL = "https://coach-athlete-hub-11.preview.emergentagent.com/api"

class RunCoachAPITester:
    def __init__(self):
        self.base_url = BACKEND_URL
        self.session = requests.Session()
        self.auth_token = None
        self.coach_user = None
        self.athlete_id = None
        self.program_id = None
        self.payment_id = None
        
    def log(self, message, level="INFO"):
        print(f"[{level}] {message}")
        
    def make_request(self, method, endpoint, data=None, auth=True):
        """Make HTTP request with optional authentication"""
        url = f"{self.base_url}{endpoint}"
        headers = {"Content-Type": "application/json"}
        
        if auth and self.auth_token:
            headers["Authorization"] = f"Bearer {self.auth_token}"
            
        try:
            # Add timeout and verify SSL
            kwargs = {
                "headers": headers,
                "timeout": 30,
                "verify": True
            }
            
            if method == "GET":
                response = self.session.get(url, **kwargs)
            elif method == "POST":
                response = self.session.post(url, json=data, **kwargs)
            elif method == "PUT":
                response = self.session.put(url, json=data, **kwargs)
            elif method == "DELETE":
                response = self.session.delete(url, **kwargs)
            else:
                raise ValueError(f"Unsupported method: {method}")
                
            self.log(f"Request {method} {url} -> {response.status_code}")
            return response
        except Exception as e:
            self.log(f"Request failed: {e}", "ERROR")
            return None
    
    def test_health_check(self):
        """Test basic health endpoints"""
        self.log("=== Testing Health Check ===")
        
        # Test root endpoint
        response = self.make_request("GET", "/", auth=False)
        if response and response.status_code == 200:
            self.log("✅ Root endpoint working")
        else:
            self.log(f"❌ Root endpoint failed: {response.status_code if response else 'No response'}", "ERROR")
            return False
            
        # Test health endpoint
        response = self.make_request("GET", "/health", auth=False)
        if response and response.status_code == 200:
            self.log("✅ Health endpoint working")
            return True
        else:
            self.log(f"❌ Health endpoint failed: {response.status_code if response else 'No response'}", "ERROR")
            return False
    
    def test_authentication(self):
        """Test authentication endpoints"""
        self.log("=== Testing Authentication ===")
        
        # Generate unique test data
        test_email = f"coach_{uuid.uuid4().hex[:8]}@example.com"
        test_password = "SecurePass123!"
        test_name = "Marco Rossi"
        
        # Test registration
        self.log("Testing user registration...")
        register_data = {
            "email": test_email,
            "password": test_password,
            "name": test_name,
            "role": "coach"
        }
        
        response = self.make_request("POST", "/auth/register", register_data, auth=False)
        if not response or response.status_code != 200:
            self.log(f"❌ Registration failed: {response.status_code if response else 'No response'}", "ERROR")
            if response:
                self.log(f"Response: {response.text}", "ERROR")
            return False
            
        register_result = response.json()
        if not register_result.get("access_token"):
            self.log("❌ Registration didn't return access token", "ERROR")
            return False
            
        self.auth_token = register_result["access_token"]
        self.coach_user = register_result["user"]
        self.log("✅ Registration successful")
        
        # Test login with correct credentials
        self.log("Testing login with correct credentials...")
        login_data = {
            "email": test_email,
            "password": test_password
        }
        
        response = self.make_request("POST", "/auth/login", login_data, auth=False)
        if not response or response.status_code != 200:
            self.log(f"❌ Login failed: {response.status_code if response else 'No response'}", "ERROR")
            return False
            
        login_result = response.json()
        if not login_result.get("access_token"):
            self.log("❌ Login didn't return access token", "ERROR")
            return False
            
        self.log("✅ Login successful")
        
        # Test login with incorrect credentials
        self.log("Testing login with incorrect credentials...")
        wrong_login_data = {
            "email": test_email,
            "password": "WrongPassword"
        }
        
        response = self.make_request("POST", "/auth/login", wrong_login_data, auth=False)
        if response is None:
            self.log("❌ No response received for invalid login", "ERROR")
            return False
        elif response.status_code == 401:
            self.log("✅ Login correctly rejected invalid credentials")
        else:
            self.log(f"❌ Login should reject invalid credentials but got: {response.status_code}", "ERROR")
            self.log(f"Response: {response.text}", "ERROR")
            return False
        
        # Test /auth/me endpoint
        self.log("Testing /auth/me endpoint...")
        response = self.make_request("GET", "/auth/me")
        if not response or response.status_code != 200:
            self.log(f"❌ /auth/me failed: {response.status_code if response else 'No response'}", "ERROR")
            return False
            
        me_result = response.json()
        if me_result.get("email") != test_email:
            self.log("❌ /auth/me returned wrong user data", "ERROR")
            return False
            
        self.log("✅ /auth/me working correctly")
        
        # Test protected route without token
        self.log("Testing protected route without token...")
        response = self.make_request("GET", "/auth/me", auth=False)
        if response is None:
            self.log("❌ No response received for protected route test", "ERROR")
            return False
        elif response.status_code in [401, 403]:
            self.log("✅ Protected route correctly requires authentication")
        else:
            self.log(f"❌ Protected route should require auth but got: {response.status_code}", "ERROR")
            self.log(f"Response: {response.text}", "ERROR")
            return False
            
        return True
    
    def test_athlete_crud(self):
        """Test athlete CRUD operations"""
        self.log("=== Testing Athlete CRUD ===")
        
        if not self.auth_token:
            self.log("❌ No auth token available for athlete tests", "ERROR")
            return False
        
        # Create athlete
        self.log("Testing athlete creation...")
        athlete_data = {
            "name": "Giuseppe Verdi",
            "email": f"athlete_{uuid.uuid4().hex[:8]}@example.com",
            "phone": "+39 123 456 7890",
            "birth_date": "1990-05-15",
            "notes": "Maratoneta esperto, obiettivo sub 3:00",
            "password": "AthletePass123!"
        }
        
        response = self.make_request("POST", "/athletes", athlete_data)
        if not response or response.status_code != 200:
            self.log(f"❌ Athlete creation failed: {response.status_code if response else 'No response'}", "ERROR")
            if response:
                self.log(f"Response: {response.text}", "ERROR")
            return False
            
        athlete_result = response.json()
        self.athlete_id = athlete_result.get("id")
        if not self.athlete_id:
            self.log("❌ Athlete creation didn't return ID", "ERROR")
            return False
            
        self.log("✅ Athlete created successfully")
        
        # Get all athletes
        self.log("Testing get all athletes...")
        response = self.make_request("GET", "/athletes")
        if not response or response.status_code != 200:
            self.log(f"❌ Get athletes failed: {response.status_code if response else 'No response'}", "ERROR")
            return False
            
        athletes_list = response.json()
        if not isinstance(athletes_list, list) or len(athletes_list) == 0:
            self.log("❌ Get athletes didn't return list or empty list", "ERROR")
            return False
            
        self.log("✅ Get all athletes working")
        
        # Get single athlete
        self.log("Testing get single athlete...")
        response = self.make_request("GET", f"/athletes/{self.athlete_id}")
        if not response or response.status_code != 200:
            self.log(f"❌ Get single athlete failed: {response.status_code if response else 'No response'}", "ERROR")
            return False
            
        single_athlete = response.json()
        if single_athlete.get("id") != self.athlete_id:
            self.log("❌ Get single athlete returned wrong athlete", "ERROR")
            return False
            
        self.log("✅ Get single athlete working")
        
        # Update athlete biometrics and medical certificate
        self.log("Testing athlete update...")
        update_data = {
            "biometrics": {
                "heart_rate_max": 185,
                "heart_rate_rest": 45,
                "vo2_max": 55.5,
                "weight": 70.5,
                "height": 175
            },
            "medical_certificate": {
                "issue_date": "2024-01-15",
                "expiry_date": "2025-01-15"
            },
            "notes": "Aggiornato: ottimi progressi negli allenamenti"
        }
        
        response = self.make_request("PUT", f"/athletes/{self.athlete_id}", update_data)
        if not response or response.status_code != 200:
            self.log(f"❌ Athlete update failed: {response.status_code if response else 'No response'}", "ERROR")
            if response:
                self.log(f"Response: {response.text}", "ERROR")
            return False
            
        updated_athlete = response.json()
        if updated_athlete.get("biometrics", {}).get("vo2_max") != 55.5:
            self.log("❌ Athlete update didn't save biometrics correctly", "ERROR")
            return False
            
        self.log("✅ Athlete update working")
        
        return True
    
    def test_payment_management(self):
        """Test payment management"""
        self.log("=== Testing Payment Management ===")
        
        if not self.athlete_id:
            self.log("❌ No athlete ID available for payment tests", "ERROR")
            return False
        
        # Add payment to athlete
        self.log("Testing add payment...")
        payment_data = {
            "month": "2024-12",
            "amount": 150.0,
            "paid": False,
            "due_date": "2024-12-31"
        }
        
        response = self.make_request("POST", f"/athletes/{self.athlete_id}/payments", payment_data)
        if not response or response.status_code != 200:
            self.log(f"❌ Add payment failed: {response.status_code if response else 'No response'}", "ERROR")
            if response:
                self.log(f"Response: {response.text}", "ERROR")
            return False
            
        payment_result = response.json()
        self.payment_id = payment_result.get("id")
        if not self.payment_id:
            self.log("❌ Add payment didn't return payment ID", "ERROR")
            return False
            
        self.log("✅ Payment added successfully")
        
        # Toggle payment status to paid
        self.log("Testing payment status toggle...")
        response = self.make_request("PUT", f"/athletes/{self.athlete_id}/payments/{self.payment_id}?paid=true")
        if not response or response.status_code != 200:
            self.log(f"❌ Payment status toggle failed: {response.status_code if response else 'No response'}", "ERROR")
            if response:
                self.log(f"Response: {response.text}", "ERROR")
            return False
            
        self.log("✅ Payment status toggle working")
        
        # Verify payment was updated by getting athlete
        response = self.make_request("GET", f"/athletes/{self.athlete_id}")
        if response and response.status_code == 200:
            athlete = response.json()
            payments = athlete.get("payments", [])
            payment_found = False
            for payment in payments:
                if payment.get("id") == self.payment_id and payment.get("paid") == True:
                    payment_found = True
                    break
            if payment_found:
                self.log("✅ Payment status correctly updated")
            else:
                self.log("❌ Payment status not updated correctly", "ERROR")
                return False
        
        return True
    
    def test_training_programs(self):
        """Test training program CRUD"""
        self.log("=== Testing Training Programs ===")
        
        if not self.athlete_id:
            self.log("❌ No athlete ID available for program tests", "ERROR")
            return False
        
        # Create training program with workouts
        self.log("Testing program creation...")
        program_data = {
            "name": "Preparazione Maratona Roma 2024",
            "description": "Piano di allenamento 16 settimane per maratona",
            "start_date": "2024-01-01",
            "end_date": "2024-04-15",
            "goal": "Maratona sotto 3:00:00",
            "athlete_id": self.athlete_id,
            "workouts": [
                {
                    "day": "Lunedì",
                    "title": "Corsa Facile",
                    "description": "Corsa aerobica di recupero",
                    "workout_type": "easy",
                    "duration_minutes": 45,
                    "distance_km": 8.0,
                    "target_pace": "5:30-6:00 min/km",
                    "heart_rate_zone": "Zona 1-2",
                    "notes": "Mantenere ritmo conversazione"
                },
                {
                    "day": "Mercoledì",
                    "title": "Interval Training",
                    "description": "5x1000m a ritmo soglia",
                    "workout_type": "interval",
                    "duration_minutes": 60,
                    "distance_km": 10.0,
                    "target_pace": "4:15-4:30 min/km",
                    "heart_rate_zone": "Zona 4",
                    "notes": "Recupero 2' tra le ripetute"
                }
            ]
        }
        
        response = self.make_request("POST", "/programs", program_data)
        if not response or response.status_code != 200:
            self.log(f"❌ Program creation failed: {response.status_code if response else 'No response'}", "ERROR")
            if response:
                self.log(f"Response: {response.text}", "ERROR")
            return False
            
        program_result = response.json()
        self.program_id = program_result.get("id")
        if not self.program_id:
            self.log("❌ Program creation didn't return ID", "ERROR")
            return False
            
        self.log("✅ Program created successfully")
        
        # Get all programs
        self.log("Testing get programs...")
        response = self.make_request("GET", "/programs")
        if not response or response.status_code != 200:
            self.log(f"❌ Get programs failed: {response.status_code if response else 'No response'}", "ERROR")
            return False
            
        programs_list = response.json()
        if not isinstance(programs_list, list):
            self.log("❌ Get programs didn't return list", "ERROR")
            return False
            
        self.log("✅ Get programs working")
        
        # Get single program
        self.log("Testing get single program...")
        response = self.make_request("GET", f"/programs/{self.program_id}")
        if not response or response.status_code != 200:
            self.log(f"❌ Get single program failed: {response.status_code if response else 'No response'}", "ERROR")
            return False
            
        single_program = response.json()
        if single_program.get("id") != self.program_id:
            self.log("❌ Get single program returned wrong program", "ERROR")
            return False
            
        self.log("✅ Get single program working")
        
        # Update program
        self.log("Testing program update...")
        update_data = {
            "description": "Piano aggiornato con focus su velocità",
            "goal": "Maratona sotto 2:55:00"
        }
        
        response = self.make_request("PUT", f"/programs/{self.program_id}", update_data)
        if not response or response.status_code != 200:
            self.log(f"❌ Program update failed: {response.status_code if response else 'No response'}", "ERROR")
            return False
            
        self.log("✅ Program update working")
        
        # Complete a workout
        self.log("Testing workout completion...")
        workout_id = program_result.get("workouts", [{}])[0].get("id")
        if workout_id:
            actual_data = {
                "actual_duration": 47,
                "actual_distance": 8.2,
                "avg_pace": "5:45 min/km",
                "avg_heart_rate": 145
            }
            
            response = self.make_request("PUT", f"/programs/{self.program_id}/workouts/{workout_id}/complete", actual_data)
            if response and response.status_code == 200:
                self.log("✅ Workout completion working")
            else:
                self.log(f"❌ Workout completion failed: {response.status_code if response else 'No response'}", "ERROR")
                return False
        
        return True
    
    def test_expiry_check(self):
        """Test expiry check API"""
        self.log("=== Testing Expiry Check ===")
        
        # Test expiry check endpoint
        self.log("Testing expiry check...")
        response = self.make_request("GET", "/check-expiries")
        if not response or response.status_code != 200:
            self.log(f"❌ Expiry check failed: {response.status_code if response else 'No response'}", "ERROR")
            if response:
                self.log(f"Response: {response.text}", "ERROR")
            return False
            
        expiry_result = response.json()
        if "warnings" not in expiry_result:
            self.log("❌ Expiry check didn't return warnings field", "ERROR")
            return False
            
        warnings = expiry_result["warnings"]
        self.log(f"✅ Expiry check working - found {len(warnings)} warnings")
        
        # Log warning details for verification
        for warning in warnings:
            warning_type = warning.get("type", "unknown")
            athlete_name = warning.get("athlete_name", "unknown")
            if warning_type == "certificate_expiry":
                days = warning.get("days_until", 0)
                self.log(f"  - Certificate expiry: {athlete_name} ({days} days)")
            elif warning_type == "payment_due":
                days = warning.get("days_overdue", 0)
                self.log(f"  - Payment due: {athlete_name} ({days} days overdue)")
        
        return True
    
    def test_analytics(self):
        """Test analytics API"""
        self.log("=== Testing Analytics ===")
        
        if not self.athlete_id:
            self.log("❌ No athlete ID available for analytics tests", "ERROR")
            return False
        
        # Test analytics with different periods
        for period in ["week", "month", "year"]:
            self.log(f"Testing analytics for period: {period}...")
            response = self.make_request("GET", f"/analytics/athlete/{self.athlete_id}?period={period}")
            if not response or response.status_code != 200:
                self.log(f"❌ Analytics failed for {period}: {response.status_code if response else 'No response'}", "ERROR")
                if response:
                    self.log(f"Response: {response.text}", "ERROR")
                return False
                
            analytics_result = response.json()
            required_fields = ["period", "total_distance_km", "total_duration_minutes", "total_activities", "heart_rate_zones", "biometrics"]
            for field in required_fields:
                if field not in analytics_result:
                    self.log(f"❌ Analytics missing field: {field}", "ERROR")
                    return False
                    
            self.log(f"✅ Analytics working for {period}")
        
        return True
    
    def test_cleanup(self):
        """Clean up test data"""
        self.log("=== Cleaning Up Test Data ===")
        
        # Delete program
        if self.program_id:
            response = self.make_request("DELETE", f"/programs/{self.program_id}")
            if response and response.status_code == 200:
                self.log("✅ Program deleted")
            else:
                self.log("⚠️ Program deletion failed (may not exist)")
        
        # Delete athlete
        if self.athlete_id:
            response = self.make_request("DELETE", f"/athletes/{self.athlete_id}")
            if response and response.status_code == 200:
                self.log("✅ Athlete deleted")
            else:
                self.log("⚠️ Athlete deletion failed (may not exist)")
        
        self.log("✅ Cleanup completed")
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        self.log("🚀 Starting RunCoach Pro Backend API Tests")
        self.log(f"Backend URL: {self.base_url}")
        
        test_results = {}
        
        # Health check
        test_results["health"] = self.test_health_check()
        
        # Authentication tests
        test_results["authentication"] = self.test_authentication()
        
        # Only continue if auth works
        if test_results["authentication"]:
            test_results["athlete_crud"] = self.test_athlete_crud()
            test_results["payment_management"] = self.test_payment_management()
            test_results["training_programs"] = self.test_training_programs()
            test_results["expiry_check"] = self.test_expiry_check()
            test_results["analytics"] = self.test_analytics()
            
            # Cleanup
            self.test_cleanup()
        else:
            self.log("❌ Skipping other tests due to authentication failure", "ERROR")
        
        # Summary
        self.log("\n" + "="*50)
        self.log("TEST SUMMARY")
        self.log("="*50)
        
        passed = 0
        total = 0
        for test_name, result in test_results.items():
            total += 1
            if result:
                passed += 1
                self.log(f"✅ {test_name.replace('_', ' ').title()}: PASSED")
            else:
                self.log(f"❌ {test_name.replace('_', ' ').title()}: FAILED")
        
        self.log(f"\nOverall: {passed}/{total} tests passed")
        
        if passed == total:
            self.log("🎉 All tests passed!")
            return True
        else:
            self.log("💥 Some tests failed!")
            return False

if __name__ == "__main__":
    tester = RunCoachAPITester()
    success = tester.run_all_tests()
    exit(0 if success else 1)