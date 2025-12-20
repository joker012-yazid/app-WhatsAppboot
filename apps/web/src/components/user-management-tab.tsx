'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Users,
  UserCheck,
  UserX,
  Edit,
  Trash2,
  Search,
  Filter,
  ChevronDown,
  Check,
  X,
  Loader2,
  AlertCircle,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { apiGet, apiPut, apiDelete, apiPost } from '@/lib/api';
import { useToast } from '@/components/toast-provider';
import { cn } from '@/lib/utils';

type User = {
  id: string;
  username: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'USER';
  status: 'ACTIVE' | 'INACTIVE' | 'PENDING';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  approvedAt?: string;
  _count: {
    ownedJobs: number;
  };
};

type UsersResponse = {
  success: boolean;
  data?: {
    users: User[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      pages: number;
    };
  };
  errorCode?: string;
  message?: string;
};

export default function UserManagementTab() {
  const toast = useToast();
  const qc = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE' | 'PENDING'>('ALL');
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'ADMIN' | 'USER'>('ALL');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);

  // Fetch users
  const { data: usersData, isLoading, error, refetch } = useQuery<UsersResponse>({
    queryKey: ['users', searchTerm, statusFilter, roleFilter],
    queryFn: async () => {
      try {
        const response = await apiGet<UsersResponse>(`/api/users?search=${searchTerm || ''}&status=${statusFilter === 'ALL' ? '' : statusFilter}&role=${roleFilter === 'ALL' ? '' : roleFilter}&page=1&limit=50`);
        console.log('Users API Response:', response);
        return response;
      } catch (err) {
        console.error('Users API Error:', err);
        throw err;
      }
    },
  });

  // Update user status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ userId, approved }: { userId: string; approved: boolean }) => {
      return apiPut(`/api/users/${userId}/status`, { approved });
    },
    onSuccess: () => {
      toast.success('User status updated successfully');
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to update user status');
    },
  });

  // Delete user
  const deleteUserMutation = useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason?: string }) => {
      return apiDelete(`/api/users/${userId}`, { reason });
    },
    onSuccess: (data: any) => {
      const jobsReassigned = data.data?.jobsReassigned || 0;
      const campaignsOrphaned = data.data?.campaignsOrphaned || 0;

      let message = 'User permanently deleted';
      if (jobsReassigned > 0) {
        message += `. ${jobsReassigned} jobs unassigned`;
      }
      if (campaignsOrphaned > 0) {
        message += `. ${campaignsOrphaned} campaigns orphaned`;
      }

      toast.success(message);
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to delete user');
    },
  });

  // Update user
  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, data }: { userId: string; data: Partial<User> }) => {
      return apiPut(`/api/users/${userId}`, data);
    },
    onSuccess: () => {
      toast.success('User updated successfully');
      setEditingUser(null);
      qc.invalidateQueries({ queryKey: ['users'] });
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to update user');
    },
  });

  const getStatusBadge = (status: User['status']) => {
    const styles = {
      ACTIVE: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700',
      INACTIVE: 'bg-muted text-muted-foreground border-border',
      PENDING: 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700',
    };

    return (
      <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border', styles[status])}>
        {status}
      </span>
    );
  };

  const getRoleBadge = (role: User['role']) => {
    const styles = {
      ADMIN: 'bg-violet-500/20 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-700',
      USER: 'bg-muted text-muted-foreground border-border',
    };

    return (
      <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border', styles[role])}>
        {role === 'ADMIN' ? 'Admin' : 'User'}
      </span>
    );
  };

  const handleApproveUser = (userId: string, approved: boolean) => {
    updateStatusMutation.mutate({ userId, approved });
  };

  const handleDeleteUser = (userId: string, userName: string) => {
    // Enhanced confirmation dialog
    const reason = prompt(`⚠️  Permanent Deletion Warning\n\nAre you sure you want to permanently delete ${userName}?\n\nThis will:\n• Permanently remove the user from the system\n• Unassign all jobs owned by this user\n• Delete all user sessions and tokens\n• Create an audit record\n\nThis action cannot be undone!\n\nOptional: Provide a reason for deletion:`);

    if (reason !== null) { // User didn't cancel
      if (confirm('🚨 FINAL CONFIRMATION\n\nThis is your last chance to cancel.\n\nClick "OK" to permanently delete this user.\nClick "Cancel" to abort.')) {
        deleteUserMutation.mutate({
          userId,
          reason: reason || 'No reason provided'
        });
      }
    }
  };

  const handleEditUser = (user: User) => {
    setEditingUser({ ...user });
  };

  const handleSaveEdit = () => {
    if (!editingUser) return;

    updateUserMutation.mutate({
      userId: editingUser.id,
      data: {
        name: editingUser.name,
        email: editingUser.email,
        role: editingUser.role,
        status: editingUser.status,
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">User administration</p>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">User Management</h2>
            {usersData?.data?.users && usersData.data.users.length > 0 && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                {usersData.data.users.length} users
              </span>
            )}
          </div>
        </div>
        <Button onClick={() => setShowCreateUserModal(true)} className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          Add User
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
        </div>

        <div className="relative">
          <Button
            variant="outline"
            onClick={() => setShowStatusDropdown(!showStatusDropdown)}
            className="flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            {statusFilter === 'ALL' ? 'All Status' : statusFilter.charAt(0) + statusFilter.slice(1).toLowerCase()}
            <ChevronDown className="h-4 w-4" />
          </Button>

          {showStatusDropdown && (
            <div className="absolute top-full mt-1 right-0 bg-popover border border-border rounded-lg shadow-lg z-10 min-w-[150px]">
              {['ALL', 'ACTIVE', 'INACTIVE', 'PENDING'].map((status) => (
                <button
                  key={status}
                  onClick={() => {
                    setStatusFilter(status as any);
                    setShowStatusDropdown(false);
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-accent hover:text-accent-foreground first:rounded-t-lg last:rounded-b-lg text-popover-foreground"
                >
                  {status}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="relative">
          <Button
            variant="outline"
            onClick={() => setShowRoleDropdown(!showRoleDropdown)}
            className="flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            {roleFilter === 'ALL' ? 'All Roles' : roleFilter === 'ADMIN' ? 'Admins' : 'Users'}
            <ChevronDown className="h-4 w-4" />
          </Button>

          {showRoleDropdown && (
            <div className="absolute top-full mt-1 right-0 bg-popover border border-border rounded-lg shadow-lg z-10 min-w-[150px]">
              {['ALL', 'ADMIN', 'USER'].map((role) => (
                <button
                  key={role}
                  onClick={() => {
                    setRoleFilter(role as any);
                    setShowRoleDropdown(false);
                  }}
                  className="w-full px-4 py-2 text-left hover:bg-accent hover:text-accent-foreground first:rounded-t-lg last:rounded-b-lg text-popover-foreground"
                >
                  {role === 'ALL' ? 'All' : role === 'ADMIN' ? 'Admin' : 'User'}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Users Table */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 bg-card rounded-lg border">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground">Loading users...</p>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
          <p className="text-red-600 mb-2">Error loading users</p>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'An unknown error occurred'}
          </p>
          <Button
            onClick={() => refetch()}
            variant="outline"
            className="mt-4"
          >
            Try Again
          </Button>
        </div>
      ) : !usersData?.success || !usersData?.data?.users ? (
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 mx-auto text-yellow-500 mb-4" />
          <p className="text-yellow-600 mb-2">Invalid response from server</p>
          <p className="text-sm text-muted-foreground">
            Please check if you have the required permissions
          </p>
          <Button
            onClick={() => refetch()}
            variant="outline"
            className="mt-4"
          >
            Retry
          </Button>
        </div>
      ) : usersData.data.users.length === 0 ? (
        <div className="text-center py-16 bg-card rounded-lg border">
          <Users className="h-16 w-16 mx-auto text-muted-foreground mb-6" />
          <h3 className="text-lg font-semibold text-foreground mb-2">No Users Found</h3>
          <p className="text-muted-foreground mb-6">
            {searchTerm || statusFilter !== 'ALL' || roleFilter !== 'ALL'
              ? 'Try adjusting your search or filters to see more users.'
              : 'Get started by adding your first user.'}
          </p>
          {(!searchTerm && statusFilter === 'ALL' && roleFilter === 'ALL') && (
            <Button onClick={() => setShowCreateUserModal(true)} className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Add Your First User
            </Button>
          )}
        </div>
      ) : (
        <div className="bg-card rounded-lg border shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-muted/30 border-b">
                <tr>
                  <th className="text-left p-4 font-medium text-sm text-muted-foreground">User Information</th>
                  <th className="text-left p-4 font-medium text-sm text-muted-foreground">Role</th>
                  <th className="text-left p-4 font-medium text-sm text-muted-foreground">Status</th>
                  <th className="text-center p-4 font-medium text-sm text-muted-foreground">Jobs</th>
                  <th className="text-left p-4 font-medium text-sm text-muted-foreground">Last Login</th>
                  <th className="text-left p-4 font-medium text-sm text-muted-foreground">Joined</th>
                  <th className="text-right p-4 font-medium text-sm text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {usersData?.data?.users.map((user) => (
                  <tr key={user.id} className="hover:bg-muted/20 transition-colors">
                    <td className="p-4">
                      <div className="flex items-start space-x-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-medium text-primary">
                            {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium text-foreground">{user.name}</div>
                          <div className="text-sm text-muted-foreground">{user.email}</div>
                          <div className="text-xs text-muted-foreground">@{user.username || 'no-username'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">{getRoleBadge(user.role)}</td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {getStatusBadge(user.status)}
                        {!user.isActive && (
                          <span className="text-xs text-red-600 font-medium">Disabled</span>
                        )}
                      </div>
                    </td>
                    <td className="p-4 text-center">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-muted text-sm font-medium">
                        {user._count.ownedJobs}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-sm text-muted-foreground">
                        {user.lastLoginAt
                          ? new Date(user.lastLoginAt).toLocaleDateString()
                          : 'Never'
                        }
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="text-sm text-muted-foreground">
                        {new Date(user.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        {user.status === 'PENDING' && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleApproveUser(user.id, true)}
                              disabled={updateStatusMutation.isPending}
                              className="text-green-600 hover:text-green-700"
                            >
                              <UserCheck className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleApproveUser(user.id, false)}
                              disabled={updateStatusMutation.isPending}
                              className="text-red-600 hover:text-red-700"
                            >
                              <UserX className="h-4 w-4" />
                            </Button>
                          </>
                        )}

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditUser(user)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDeleteUser(user.id, user.name)}
                          disabled={deleteUserMutation.isPending}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-card rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Edit User</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Full Name</label>
                <input
                  type="text"
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  className="w-full p-2 border rounded-lg bg-background"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Email</label>
                <input
                  type="email"
                  value={editingUser.email}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  className="w-full p-2 border rounded-lg bg-background"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Role</label>
                <select
                  value={editingUser.role}
                  onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as any })}
                  className="w-full p-2 border rounded-lg bg-background"
                >
                  <option value="ADMIN">Admin</option>
                  <option value="USER">User</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select
                  value={editingUser.status}
                  onChange={(e) => setEditingUser({ ...editingUser, status: e.target.value as any })}
                  className="w-full p-2 border rounded-lg bg-background"
                >
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button
                variant="outline"
                onClick={() => setEditingUser(null)}
                disabled={updateUserMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                onClick={handleSaveEdit}
                disabled={updateUserMutation.isPending}
              >
                {updateUserMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Save'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateUserModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card text-card-foreground rounded-lg p-6 w-full max-w-md border border-border">
            <h3 className="text-lg font-semibold mb-4">Create New User</h3>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const userData = {
                  username: formData.get('username') as string,
                  email: formData.get('email') as string,
                  fullName: formData.get('fullName') as string,
                  role: formData.get('role') as 'ADMIN' | 'USER',
                  password: formData.get('password') as string,
                };

                try {
                  await apiPost('/api/users', userData);
                  toast.success('User created successfully');
                  setShowCreateUserModal(false);
                  refetch();
                } catch (error: any) {
                  toast.error(error?.message || 'Failed to create user');
                }
              }}
            >
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Username
                  </label>
                  <input
                    type="text"
                    name="username"
                    required
                    className="w-full px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    required
                    className="w-full px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Full Name
                  </label>
                  <input
                    type="text"
                    name="fullName"
                    required
                    className="w-full px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Role
                  </label>
                  <select
                    name="role"
                    required
                    className="w-full px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  >
                    <option value="USER">USER</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-foreground mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    name="password"
                    required
                    minLength={6}
                    className="w-full px-3 py-2 border border-input bg-background rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateUserModal(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">Create User</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}