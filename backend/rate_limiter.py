"""
SAtendify - High Performance Application-Wide Rate Limiter
Zero-dependency in-memory sliding window rate limiter with tiered route protection.
"""

import time
import re
import threading
from collections import deque
from flask import request, jsonify

class RateLimiter:
    def __init__(self):
        self.lock = threading.Lock()
        # requests map: { key: deque([timestamp1, timestamp2, ...]) }
        self.requests = {}
        self.last_cleanup = time.time()
        self.cleanup_interval = 300  # purge expired records every 5 minutes

        # Default rules per endpoint category: (max_requests, window_in_seconds)
        self.rules = {
            'default': (120, 60),          # 120 req / 60s for standard API calls
            'auth': (10, 60),              # 10 req / 60s for login / student-login / reset-password
            'profile_update': (10, 60),    # 10 req / 60s for user profile edits
            'attendance': (30, 60),        # 30 req / 60s for attendance marking
            'reports': (30, 60),           # 30 req / 60s for report generation & exports
            'admin_mutate': (40, 60)       # 40 req / 60s for admin create/edit/delete
        }

    def _get_client_ip(self, req):
        """
        Accurately extracts real client IP behind Cloudflare, Vercel, reverse proxies, or localhost.
        """
        # 1. Cloudflare connecting IP
        cf_ip = req.headers.get('CF-Connecting-IP')
        if cf_ip:
            return cf_ip.strip()

        # 2. X-Forwarded-For (take the first client IP in comma-separated list)
        xff = req.headers.get('X-Forwarded-For')
        if xff:
            client_ip = xff.split(',')[0].strip()
            if client_ip:
                return client_ip

        # 3. X-Real-IP
        x_real = req.headers.get('X-Real-IP')
        if x_real:
            return x_real.strip()

        # 4. Fallback to direct remote address
        return req.remote_addr or '127.0.0.1'

    def _determine_category(self, path, method):
        """
        Categorizes request path and method into appropriate rate limit tier.
        """
        path_lower = path.lower()
        method_upper = method.upper()

        # Auth endpoints
        if path_lower in ['/api/auth/login', '/api/auth/student-login', '/api/auth/reset-password']:
            return 'auth'

        # Profile update
        if path_lower == '/api/auth/me' and method_upper in ['PUT', 'POST']:
            return 'profile_update'

        # Attendance recording
        if '/attendance' in path_lower and method_upper in ['POST', 'PUT']:
            return 'attendance'

        # Reports and Analytics
        if path_lower.startswith('/api/reports'):
            return 'reports'

        # Admin data mutations
        if path_lower.startswith('/api/admin') and method_upper in ['POST', 'PUT', 'DELETE']:
            return 'admin_mutate'

        return 'default'

    def _cleanup_expired(self, now):
        """
        Periodically purges inactive keys to keep memory strictly bounded.
        """
        if now - self.last_cleanup < self.cleanup_interval:
            return

        self.last_cleanup = now
        max_window = max(r[1] for r in self.rules.values())
        expired_keys = []

        for key, timestamps in self.requests.items():
            while timestamps and now - timestamps[0] > max_window:
                timestamps.popleft()
            if not timestamps:
                expired_keys.append(key)

        for k in expired_keys:
            del self.requests[k]

    def check_rate_limit(self, req):
        """
        Evaluates incoming request against rate limit policies.
        Returns None if request is allowed, or a 429 Flask Response if rate limited.
        Also returns rate limit metadata dict for header injection.
        """
        # Always allow CORS preflight requests
        if req.method == 'OPTIONS':
            return None, None

        path = req.path
        # Only rate-limit API endpoints; let static files and health checks pass through
        if not path.startswith('/api') or path == '/api/health':
            return None, None

        client_ip = self._get_client_ip(req)
        category = self._determine_category(path, req.method)
        max_requests, window_seconds = self.rules.get(category, self.rules['default'])

        # Partition key by IP and rate limit category
        key = f"{client_ip}:{category}"
        now = time.time()

        with self.lock:
            self._cleanup_expired(now)

            if key not in self.requests:
                self.requests[key] = deque()

            timestamps = self.requests[key]

            # Evict timestamps outside current sliding window
            cutoff = now - window_seconds
            while timestamps and timestamps[0] <= cutoff:
                timestamps.popleft()

            current_count = len(timestamps)

            if current_count >= max_requests:
                # Rate limit exceeded
                oldest = timestamps[0]
                retry_after = max(1, int(oldest + window_seconds - now))
                reset_time = int(oldest + window_seconds)

                meta = {
                    "limit": max_requests,
                    "remaining": 0,
                    "reset": reset_time,
                    "retry_after": retry_after
                }

                response = jsonify({
                    "success": False,
                    "error": f"Rate limit exceeded. Too many requests. Please slow down and try again in {retry_after}s.",
                    "retryAfter": retry_after
                })
                response.status_code = 429
                response.headers['Retry-After'] = str(retry_after)
                response.headers['X-RateLimit-Limit'] = str(max_requests)
                response.headers['X-RateLimit-Remaining'] = '0'
                response.headers['X-RateLimit-Reset'] = str(reset_time)
                return response, meta

            # Request is within limits
            timestamps.append(now)
            remaining = max(0, max_requests - len(timestamps))
            reset_time = int(timestamps[0] + window_seconds)

            meta = {
                "limit": max_requests,
                "remaining": remaining,
                "reset": reset_time,
                "retry_after": None
            }
            return None, meta


# Global RateLimiter instance
rate_limiter = RateLimiter()
