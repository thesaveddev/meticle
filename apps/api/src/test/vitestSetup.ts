// Set env vars before any test module imports
process.env.REDIS_URL = ''
process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder'
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key'
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-jwt-refresh-secret-key'
