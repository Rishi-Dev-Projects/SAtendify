"""
Test Suite: Rate Limiting & Student Profile Mobile Number Validation
"""
import sys
import os
import unittest
import json
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app
from rate_limiter import rate_limiter
from decorators import USER_CACHE

class TestRateLimitAndProfile(unittest.TestCase):
    def setUp(self):
        self.client = app.test_client()
        # Reset rate limiter requests for clean test run
        with rate_limiter.lock:
            rate_limiter.requests.clear()

    def test_mobile_number_validation_rejections(self):
        """Test that oversized or invalid mobile numbers are strictly rejected with 400"""
        # Mock student token
        student_uid = "test-student-val"
        USER_CACHE[f"student-session-{student_uid}"] = (
            {"role": "student", "name": "Test Student", "email": "test@student.edu", "mobile": "+91 99999 88888"},
            student_uid,
            time.time()
        )
        headers = {"Authorization": f"Bearer student-session-{student_uid}"}

        # 1. 450,000 character long string
        huge_mobile = "2" * 450000
        res = self.client.put('/api/auth/me', json={"name": "Test Student", "mobile": huge_mobile}, headers=headers)
        self.assertEqual(res.status_code, 400)
        data = res.get_json()
        self.assertFalse(data['success'])
        self.assertIn("exceed 16 characters", data['error'])

        # 2. 20 digits (> 16 chars)
        res2 = self.client.put('/api/auth/me', json={"name": "Test Student", "mobile": "98765432109876543210"}, headers=headers)
        self.assertEqual(res2.status_code, 400)
        self.assertIn("exceed 16 characters", res2.get_json()['error'])

        # 3. Letters/symbols
        res3 = self.client.put('/api/auth/me', json={"name": "Test Student", "mobile": "98765abcde"}, headers=headers)
        self.assertEqual(res3.status_code, 400)
        self.assertIn("invalid characters", res3.get_json()['error'])

        # 4. Too short (< 10 digits)
        res4 = self.client.put('/api/auth/me', json={"name": "Test Student", "mobile": "1234567"}, headers=headers)
        self.assertEqual(res4.status_code, 400)
        self.assertIn("Must contain between 10 and 15 digits", res4.get_json()['error'])

        print("[PASS] All invalid / oversized mobile number rejections passed (HTTP 400).")

    def test_rate_limiting_enforcement(self):
        """Test that exceeding route limit triggers HTTP 429 with Retry-After header"""
        # Auth category limit is 10 requests per minute
        # We send 11 requests to an auth endpoint
        hit_429 = False
        retry_after_found = None

        for i in range(12):
            res = self.client.post('/api/auth/login', json={"idToken": "fake-token"}, headers={"X-Forwarded-For": "198.51.100.1"})
            if res.status_code == 429:
                hit_429 = True
                retry_after_found = res.headers.get('Retry-After')
                data = res.get_json()
                self.assertFalse(data['success'])
                self.assertIn("Rate limit exceeded", data['error'])
                break

        self.assertTrue(hit_429, "Expected 429 rate limit response after exceeding request quota")
        self.assertIsNotNone(retry_after_found, "Expected Retry-After header in 429 response")
        print(f"[PASS] Rate limit 429 triggered successfully as expected with Retry-After: {retry_after_found}s.")

    def test_options_cors_exempt_from_rate_limiting(self):
        """OPTIONS preflight must never be blocked by rate limiter"""
        for _ in range(25):
            res = self.client.open('/api/auth/login', method='OPTIONS', headers={"X-Forwarded-For": "198.51.100.2"})
            self.assertNotEqual(res.status_code, 429)
        print("[PASS] CORS preflight OPTIONS requests are properly exempt.")

    def test_rate_limit_headers_in_normal_response(self):
        """Normal API responses must include X-RateLimit headers"""
        res = self.client.get('/api/health')
        self.assertEqual(res.status_code, 200)

        # Non-exempt endpoint like /api/auth/logout
        res = self.client.post('/api/auth/logout', headers={"X-Forwarded-For": "198.51.100.3"})
        self.assertEqual(res.status_code, 200)
        self.assertIn('X-RateLimit-Limit', res.headers)
        self.assertIn('X-RateLimit-Remaining', res.headers)
        self.assertIn('X-RateLimit-Reset', res.headers)
        print("[PASS] X-RateLimit headers correctly present on normal API responses.")

if __name__ == '__main__':
    unittest.main()
