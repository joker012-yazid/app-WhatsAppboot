import { Router } from 'express';
import { z } from 'zod';
import prisma from '../lib/prisma';
import { requireAuth, requireRole } from '../middleware/auth';
import { hashPassword } from '../services/auth';

const router = Router();

// Schema validation
const createUserSchema = z.object({
  username: z.string().min(3, 'Username minimum 3 characters'),
  password: z.string().min(6, 'Password minimum 6 characters'),
  email: z.string().email('Invalid email format'),
  fullName: z.string().min(1, 'Full name is required'),
  role: z.enum(['ADMIN', 'USER']),
  phone: z.string().optional(),
});

const updateUserSchema = z.object({
  username: z.string().min(3, 'Username minimum 3 characters').optional(),
  email: z.string().email('Invalid email format').optional(),
  fullName: z.string().min(1, 'Full name is required').optional(),
  name: z.string().min(1, 'Name is required').optional(),
  role: z.enum(['ADMIN', 'USER']).optional(),
  phone: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  permissions: z.any().optional(),
});

const updateUserStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE']),
});

const approveUserSchema = z.object({
  approved: z.boolean(),
});

// Helper function to send consistent error responses
const sendError = (
  res: import('express').Response,
  status: number,
  errorCode: string,
  message: string,
  details?: unknown,
) => res.status(status).json({ success: false, errorCode, message, details });

// GET /api/users - List all users (admin only)
router.get('/', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status, role } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { username: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    if (status && status !== 'ALL') {
      where.status = status;
    }

    if (role && role !== 'ALL') {
      where.role = role;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          username: true,
          email: true,
          name: true,
          role: true,
          status: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          lastLoginAt: true,
          approvedAt: true,
          _count: {
            select: {
              ownedJobs: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        users,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          pages: Math.ceil(total / Number(limit)),
        },
      },
    });
  } catch (error) {
    console.error('[USERS] Get users error:', error);
    sendError(res, 500, 'GET_USERS_FAILED', 'Failed to fetch users');
  }
});

// GET /api/users/:id - Get specific user (admin only)
router.get('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true,
        status: true,
        isActive: true,
        permissions: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        approvedAt: true,
        approvedBy: true,
        _count: {
          select: {
            ownedJobs: true,
            sessions: true,
          },
        },
      },
    });

    if (!user) {
      return sendError(res, 404, 'USER_NOT_FOUND', 'User not found');
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('[USERS] Get user error:', error);
    sendError(res, 500, 'GET_USER_FAILED', 'Failed to fetch user');
  }
});

// POST /api/users - Create new user (admin only)
router.post('/', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendError(res, 400, 'INVALID_PAYLOAD', 'Validation failed', parsed.error.format());
    }

    const { username, password, email, fullName, role, phone } = parsed.data;

    // Check if username already exists
    const existingUsername = await prisma.user.findUnique({ where: { username } });
    if (existingUsername) {
      return sendError(res, 409, 'USERNAME_EXISTS', 'Username already exists');
    }

    // Check if email already exists
    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      return sendError(res, 409, 'EMAIL_EXISTS', 'Email already exists');
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Get current admin user for approval
    const currentUser = (req as any).user;

    // Create user with ACTIVE status (admin-created, auto-approved)
    const user = await prisma.user.create({
      data: {
        username,
        email,
        name: fullName,
        passwordHash,
        role,
        status: 'ACTIVE',
        approvedBy: currentUser.id,
        approvedAt: new Date(),
      },
    });

    console.log('[USERS] User created by admin:', { username, email, role, createdBy: currentUser.id });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        name: user.name,
        role: user.role,
        status: user.status,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('[USERS] Create user error:', error);
    sendError(res, 500, 'CREATE_USER_FAILED', 'Failed to create user');
  }
});

// PUT /api/users/:id - Update user details (admin only)
router.put('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const parsed = updateUserSchema.safeParse(req.body);

    if (!parsed.success) {
      return sendError(res, 400, 'INVALID_PAYLOAD', 'Validation failed', parsed.error.format());
    }

    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      return sendError(res, 404, 'USER_NOT_FOUND', 'User not found');
    }

    const updateData: any = {};

    if (parsed.data.username) {
      const existingUsername = await prisma.user.findFirst({
        where: { username: parsed.data.username, id: { not: id } }
      });
      if (existingUsername) {
        return sendError(res, 409, 'USERNAME_EXISTS', 'Username already exists');
      }
      updateData.username = parsed.data.username;
    }

    if (parsed.data.email) {
      const existingEmail = await prisma.user.findFirst({
        where: { email: parsed.data.email, id: { not: id } }
      });
      if (existingEmail) {
        return sendError(res, 409, 'EMAIL_EXISTS', 'Email already exists');
      }
      updateData.email = parsed.data.email;
    }

    if (parsed.data.fullName) updateData.name = parsed.data.fullName;
    else if (parsed.data.name) updateData.name = parsed.data.name;
    if (parsed.data.role) updateData.role = parsed.data.role;
    if (parsed.data.status) updateData.status = parsed.data.status;
    if (parsed.data.phone) updateData.phone = parsed.data.phone;
    if (parsed.data.permissions !== undefined) updateData.permissions = parsed.data.permissions;

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true,
        status: true,
        isActive: true,
        permissions: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
      },
    });

    console.log('[USERS] User updated by admin:', { userId: id, updatedBy: (req as any).user.id });

    res.json({
      success: true,
      message: 'User updated successfully',
      data: updatedUser,
    });
  } catch (error) {
    console.error('[USERS] Update user error:', error);
    sendError(res, 500, 'UPDATE_USER_FAILED', 'Failed to update user');
  }
});

// PUT /api/users/:id/status - Approve/reject user registration (admin only)
router.put('/:id/status', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const parsed = approveUserSchema.safeParse(req.body);

    if (!parsed.success) {
      return sendError(res, 400, 'INVALID_PAYLOAD', 'Validation failed', parsed.error.format());
    }

    const { approved } = parsed.data;

    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      return sendError(res, 404, 'USER_NOT_FOUND', 'User not found');
    }

    const currentUser = (req as any).user;
    const updateData: any = {};

    if (approved) {
      updateData.status = 'ACTIVE';
      updateData.approvedBy = currentUser.id;
      updateData.approvedAt = new Date();
    } else {
      updateData.status = 'INACTIVE';
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        email: true,
        name: true,
        role: true,
        status: true,
        createdAt: true,
        approvedAt: true,
      },
    });

    console.log('[USERS] User status updated:', {
      userId: id,
      approved,
      updatedBy: currentUser.id
    });

    res.json({
      success: true,
      message: approved ? 'User approved successfully' : 'User rejected',
      data: updatedUser,
    });
  } catch (error) {
    console.error('[USERS] Update user status error:', error);
    sendError(res, 500, 'UPDATE_USER_STATUS_FAILED', 'Failed to update user status');
  }
});

// DELETE /api/users/:id - Hard delete user (admin only)
router.delete('/:id', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const currentUser = (req as any).user;
    const { reason } = req.body || {}; // Optional deletion reason from request body

    // Prevent admin from deleting themselves
    if (id === currentUser.sub) {
      return sendError(res, 400, 'CANNOT_DELETE_SELF', 'You cannot delete your own account');
    }

    // Start transaction for atomic deletion
    const result = await prisma.$transaction(async (tx) => {
      // Get user with counts before deletion
      const userToDelete = await tx.user.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              ownedJobs: true,
              campaigns: true,
              campaignPresets: true,
              sessions: true,
              refreshTokens: true
            }
          }
        }
      });

      if (!userToDelete) {
        throw new Error('USER_NOT_FOUND');
      }

      // Handle active jobs - set ownerUserId to NULL to keep jobs intact
      if (userToDelete._count.ownedJobs > 0) {
        await tx.job.updateMany({
          where: { ownerUserId: id },
          data: { ownerUserId: null }
        });
      }

      // Create audit record before deletion
      await tx.deletedUserAudit.create({
        data: {
          originalUserId: userToDelete.id,
          username: userToDelete.username,
          email: userToDelete.email,
          name: userToDelete.name,
          role: userToDelete.role,
          status: userToDelete.status,
          deletedById: currentUser.sub,
          reason: reason || 'No reason provided',
          ownedJobsCount: userToDelete._count.ownedJobs,
          campaignsCount: userToDelete._count.campaigns,
          dataSnapshot: {
            createdAt: userToDelete.createdAt,
            lastLoginAt: userToDelete.lastLoginAt,
            isActive: userToDelete.isActive
          }
        }
      });

      // Delete user (cascade will handle sessions and refreshTokens)
      const deletedUser = await tx.user.delete({
        where: { id }
      });

      return {
        user: deletedUser,
        auditData: {
          ownedJobsReassigned: userToDelete._count.ownedJobs,
          campaignsOrphaned: userToDelete._count.campaigns
        }
      };
    });

    console.log('[USERS] User hard deleted:', {
      userId: id,
      deletedBy: currentUser.sub,
      reason,
      jobsReassigned: result.auditData.ownedJobsReassigned
    });

    res.json({
      success: true,
      message: 'User permanently deleted',
      data: {
        id: result.user.id,
        username: result.user.username,
        deletedAt: new Date().toISOString(),
        jobsReassigned: result.auditData.ownedJobsReassigned,
        campaignsOrphaned: result.auditData.campaignsOrphaned
      }
    });

  } catch (error: any) {
    if (error.message === 'USER_NOT_FOUND') {
      return sendError(res, 404, 'USER_NOT_FOUND', 'User not found');
    }

    console.error('[USERS] Hard delete user error:', error);
    sendError(res, 500, 'DELETE_USER_FAILED', 'Failed to delete user');
  }
});

// POST /api/users/:id/reset-password - Reset user password (admin only)
router.post('/:id/reset-password', requireAuth, requireRole('ADMIN'), async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return sendError(res, 400, 'INVALID_PASSWORD', 'Password must be at least 6 characters');
    }

    const existingUser = await prisma.user.findUnique({ where: { id } });
    if (!existingUser) {
      return sendError(res, 404, 'USER_NOT_FOUND', 'User not found');
    }

    const passwordHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id },
      data: { passwordHash },
    });

    console.log('[USERS] User password reset:', { userId: id, resetBy: (req as any).user.id });

    res.json({
      success: true,
      message: 'Password reset successfully',
    });
  } catch (error) {
    console.error('[USERS] Reset password error:', error);
    sendError(res, 500, 'RESET_PASSWORD_FAILED', 'Failed to reset password');
  }
});

export default router;