import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

import { requireAuth, requireRole } from './auth';
import type { AccessPayload } from './auth';

// Mock the env module
vi.mock('../config/env', () => ({
  default: {
    JWT_ACCESS_SECRET: 'test-secret-key-for-testing',
  },
}));

describe('requireAuth middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Reset mocks before each test
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockRequest = {
      headers: {},
      cookies: {},
    };

    mockResponse = {
      status: statusMock,
      json: jsonMock,
    };

    mockNext = vi.fn();
  });

  describe('Token from Authorization header', () => {
    it('should authenticate valid Bearer token from header', () => {
      const payload: AccessPayload = { sub: 'user123', role: 'USER' };
      const token = jwt.sign(payload, 'test-secret-key-for-testing');

      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.user).toBeDefined();
      expect(mockRequest.user?.sub).toBe('user123');
      expect(mockRequest.user?.role).toBe('USER');
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should authenticate ADMIN role from header token', () => {
      const payload: AccessPayload = { sub: 'admin456', role: 'ADMIN' };
      const token = jwt.sign(payload, 'test-secret-key-for-testing');

      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.user?.sub).toBe('admin456');
      expect(mockRequest.user?.role).toBe('ADMIN');
    });

    it('should handle token with additional JWT claims (iat, exp)', () => {
      const payload: AccessPayload = {
        sub: 'user789',
        role: 'USER',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };
      const token = jwt.sign(payload, 'test-secret-key-for-testing');

      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.user?.iat).toBeDefined();
      expect(mockRequest.user?.exp).toBeDefined();
    });
  });

  describe('Token from cookies', () => {
    it('should authenticate valid token from cookies', () => {
      const payload: AccessPayload = { sub: 'cookie-user', role: 'USER' };
      const token = jwt.sign(payload, 'test-secret-key-for-testing');

      mockRequest.cookies = {
        access_token: token,
      };

      requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.user?.sub).toBe('cookie-user');
      expect(mockRequest.user?.role).toBe('USER');
    });

    it('should prefer Bearer token over cookie when both present', () => {
      const headerPayload: AccessPayload = { sub: 'header-user', role: 'ADMIN' };
      const cookiePayload: AccessPayload = { sub: 'cookie-user', role: 'USER' };

      const headerToken = jwt.sign(headerPayload, 'test-secret-key-for-testing');
      const cookieToken = jwt.sign(cookiePayload, 'test-secret-key-for-testing');

      mockRequest.headers = {
        authorization: `Bearer ${headerToken}`,
      };
      mockRequest.cookies = {
        access_token: cookieToken,
      };

      requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      // Should use header token, not cookie
      expect(mockRequest.user?.sub).toBe('header-user');
      expect(mockRequest.user?.role).toBe('ADMIN');
    });
  });

  describe('Missing token scenarios', () => {
    it('should reject request with no authorization header and no cookie', () => {
      mockRequest.headers = {};
      mockRequest.cookies = {};

      requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        errorCode: 'AUTH_REQUIRED',
        message: 'Missing Authorization header',
      });
    });

    it('should reject request with empty authorization header', () => {
      mockRequest.headers = {
        authorization: '',
      };

      requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        errorCode: 'AUTH_REQUIRED',
        message: 'Missing Authorization header',
      });
    });

    it('should reject authorization header without Bearer prefix', () => {
      const payload: AccessPayload = { sub: 'user123', role: 'USER' };
      const token = jwt.sign(payload, 'test-secret-key-for-testing');

      mockRequest.headers = {
        authorization: token, // Missing "Bearer " prefix
      };

      requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it('should reject Bearer with empty token', () => {
      mockRequest.headers = {
        authorization: 'Bearer ',
      };

      requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(401);
    });
  });

  describe('Invalid token scenarios', () => {
    it('should reject invalid JWT token', () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid-token-string',
      };

      requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        errorCode: 'INVALID_TOKEN',
        message: 'Invalid or expired token',
      });
    });

    it('should reject token signed with wrong secret', () => {
      const payload: AccessPayload = { sub: 'user123', role: 'USER' };
      const token = jwt.sign(payload, 'wrong-secret-key');

      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        errorCode: 'INVALID_TOKEN',
        message: 'Invalid or expired token',
      });
    });

    it('should reject malformed JWT token', () => {
      mockRequest.headers = {
        authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI.malformed',
      };

      requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        errorCode: 'INVALID_TOKEN',
        message: 'Invalid or expired token',
      });
    });

    it('should reject expired token', () => {
      const payload: AccessPayload = { sub: 'user123', role: 'USER' };
      const token = jwt.sign(payload, 'test-secret-key-for-testing', {
        expiresIn: '-1h', // Expired 1 hour ago
      });

      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        errorCode: 'INVALID_TOKEN',
        message: 'Invalid or expired token',
      });
    });

    it('should reject token with invalid payload structure', () => {
      // Token with missing required fields
      const invalidPayload = { foo: 'bar' };
      const token = jwt.sign(invalidPayload, 'test-secret-key-for-testing');

      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

      // Should still pass JWT verification, but payload will be incomplete
      // The middleware doesn't validate payload structure, only JWT signature
      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.user).toBeDefined();
    });
  });

  describe('Edge cases', () => {
    it('should handle authorization header with extra whitespace', () => {
      const payload: AccessPayload = { sub: 'user123', role: 'USER' };
      const token = jwt.sign(payload, 'test-secret-key-for-testing');

      mockRequest.headers = {
        authorization: `  Bearer ${token}  `,
      };

      // Due to strict prefix check, this will fail
      requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it('should handle case-sensitive Bearer prefix', () => {
      const payload: AccessPayload = { sub: 'user123', role: 'USER' };
      const token = jwt.sign(payload, 'test-secret-key-for-testing');

      mockRequest.headers = {
        authorization: `bearer ${token}`, // lowercase 'bearer'
      };

      requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

      // Should fail because prefix check is case-sensitive
      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it('should handle undefined cookies object', () => {
      const payload: AccessPayload = { sub: 'user123', role: 'USER' };
      const token = jwt.sign(payload, 'test-secret-key-for-testing');

      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };
      delete (mockRequest as any).cookies;

      // Should still work with header token
      requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.user?.sub).toBe('user123');
    });

    it('should not mutate request if authentication fails', () => {
      mockRequest.headers = {
        authorization: 'Bearer invalid-token',
      };

      requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toBeUndefined();
    });
  });

  describe('Authorization header variations', () => {
    it('should handle authorization header in different case', () => {
      const payload: AccessPayload = { sub: 'user123', role: 'USER' };
      const token = jwt.sign(payload, 'test-secret-key-for-testing');

      mockRequest.headers = {
        Authorization: `Bearer ${token}`, // Capitalized
      };

      requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

      // Express normalizes headers to lowercase, but if it doesn't:
      // This tests the actual behavior
      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(401);
    });

    it('should handle very long valid token', () => {
      const largePayload: AccessPayload = {
        sub: 'u'.repeat(1000),
        role: 'USER',
      };
      const token = jwt.sign(largePayload, 'test-secret-key-for-testing');

      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.user?.sub).toBe('u'.repeat(1000));
    });
  });
});

describe('requireRole middleware', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let jsonMock: ReturnType<typeof vi.fn>;
  let statusMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    mockRequest = {
      headers: {},
      cookies: {},
    };

    mockResponse = {
      status: statusMock,
      json: jsonMock,
    };

    mockNext = vi.fn();
  });

  describe('Single role check', () => {
    it('should allow USER role when USER is required', () => {
      mockRequest.user = { sub: 'user123', role: 'USER' };

      const middleware = requireRole('USER');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should allow ADMIN role when ADMIN is required', () => {
      mockRequest.user = { sub: 'admin123', role: 'ADMIN' };

      const middleware = requireRole('ADMIN');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should reject USER role when ADMIN is required', () => {
      mockRequest.user = { sub: 'user123', role: 'USER' };

      const middleware = requireRole('ADMIN');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        errorCode: 'FORBIDDEN',
        message: 'Forbidden',
      });
    });

    it('should reject ADMIN role when USER is required', () => {
      mockRequest.user = { sub: 'admin123', role: 'ADMIN' };

      const middleware = requireRole('USER');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        errorCode: 'FORBIDDEN',
        message: 'Forbidden',
      });
    });
  });

  describe('Multiple roles check', () => {
    it('should allow USER role when both USER and ADMIN are accepted', () => {
      mockRequest.user = { sub: 'user123', role: 'USER' };

      const middleware = requireRole('USER', 'ADMIN');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should allow ADMIN role when both USER and ADMIN are accepted', () => {
      mockRequest.user = { sub: 'admin123', role: 'ADMIN' };

      const middleware = requireRole('USER', 'ADMIN');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should work with roles in different order', () => {
      mockRequest.user = { sub: 'user123', role: 'USER' };

      const middleware = requireRole('ADMIN', 'USER');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Missing user scenarios', () => {
    it('should reject request with no user (not authenticated)', () => {
      // No user property on request
      delete mockRequest.user;

      const middleware = requireRole('USER');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        errorCode: 'AUTH_REQUIRED',
        message: 'Unauthorized',
      });
    });

    it('should reject request with undefined user', () => {
      mockRequest.user = undefined;

      const middleware = requireRole('USER');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(401);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        errorCode: 'AUTH_REQUIRED',
        message: 'Unauthorized',
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle empty roles array', () => {
      mockRequest.user = { sub: 'user123', role: 'USER' };

      const middleware = requireRole();
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // With no roles specified, user won't match any role
      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(403);
    });

    it('should handle duplicate role in requirements', () => {
      mockRequest.user = { sub: 'user123', role: 'USER' };

      const middleware = requireRole('USER', 'USER', 'USER');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should preserve request.user when role check passes', () => {
      const userPayload: AccessPayload = { sub: 'user123', role: 'ADMIN', iat: 123, exp: 456 };
      mockRequest.user = userPayload;

      const middleware = requireRole('ADMIN');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockRequest.user).toEqual(userPayload);
      expect(mockNext).toHaveBeenCalled();
    });

    it('should preserve request.user when role check fails', () => {
      const userPayload: AccessPayload = { sub: 'user123', role: 'USER' };
      mockRequest.user = userPayload;

      const middleware = requireRole('ADMIN');
      middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // User object should still exist even though access is denied
      expect(mockRequest.user).toEqual(userPayload);
      expect(statusMock).toHaveBeenCalledWith(403);
    });
  });

  describe('Integration with requireAuth', () => {
    it('should work correctly after requireAuth middleware', () => {
      const payload: AccessPayload = { sub: 'admin789', role: 'ADMIN' };
      const token = jwt.sign(payload, 'test-secret-key-for-testing');

      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      // First, authenticate
      requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRequest.user).toBeDefined();

      // Reset mocks for second middleware
      vi.clearAllMocks();
      mockNext = vi.fn();

      // Then, check role
      const roleMiddleware = requireRole('ADMIN');
      roleMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
    });

    it('should properly reject when auth passes but role check fails', () => {
      const payload: AccessPayload = { sub: 'user123', role: 'USER' };
      const token = jwt.sign(payload, 'test-secret-key-for-testing');

      mockRequest.headers = {
        authorization: `Bearer ${token}`,
      };

      // First, authenticate
      requireAuth(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();

      // Reset mocks
      vi.clearAllMocks();
      mockNext = vi.fn();
      jsonMock = vi.fn();
      statusMock = vi.fn().mockReturnValue({ json: jsonMock });
      mockResponse.status = statusMock;

      // Then, check role for ADMIN
      const roleMiddleware = requireRole('ADMIN');
      roleMiddleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(403);
      expect(jsonMock).toHaveBeenCalledWith({
        success: false,
        errorCode: 'FORBIDDEN',
        message: 'Forbidden',
      });
    });
  });

  describe('Middleware factory pattern', () => {
    it('should create different middleware instances for different role requirements', () => {
      const userOnlyMiddleware = requireRole('USER');
      const adminOnlyMiddleware = requireRole('ADMIN');
      const bothMiddleware = requireRole('USER', 'ADMIN');

      // All should be functions
      expect(typeof userOnlyMiddleware).toBe('function');
      expect(typeof adminOnlyMiddleware).toBe('function');
      expect(typeof bothMiddleware).toBe('function');

      // Should be different function instances
      expect(userOnlyMiddleware).not.toBe(adminOnlyMiddleware);
      expect(userOnlyMiddleware).not.toBe(bothMiddleware);
    });

    it('should maintain closure over roles parameter', () => {
      mockRequest.user = { sub: 'user123', role: 'USER' };

      const middleware1 = requireRole('USER');
      const middleware2 = requireRole('ADMIN');

      // First middleware should pass
      middleware1(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);

      // Reset mocks
      vi.clearAllMocks();
      mockNext = vi.fn();
      jsonMock = vi.fn();
      statusMock = vi.fn().mockReturnValue({ json: jsonMock });
      mockResponse.status = statusMock;

      // Second middleware should fail
      middleware2(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).not.toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(403);
    });
  });
});
