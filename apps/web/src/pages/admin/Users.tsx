import { useEffect, useState } from 'react';
import { Search, User } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { adminApi } from '../../services/api';

interface UserData {
  id: string;
  fullName: string;
  phoneNumber: string;
  email?: string;
  role: string;
  kycStatus: string;
  isActive: boolean;
  createdAt: string;
  wallet?: { balanceUsd: number };
}

export default function AdminUsers() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async (searchQuery?: string) => {
    setIsLoading(true);
    try {
      const res = await adminApi.getUsers({ search: searchQuery });
      setUsers(res.data.data.users);
    } catch (error) {
      toast.error('Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadUsers(search);
  };

  const getKycBadge = (status: string) => {
    const styles: Record<string, string> = {
      NONE: 'bg-gray-500/20 text-gray-400',
      PENDING: 'bg-yellow-500/20 text-yellow-500',
      APPROVED: 'bg-success-500/20 text-success-500',
      REJECTED: 'bg-danger-500/20 text-danger-500',
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${styles[status] || ''}`}>
        {status}
      </span>
    );
  };

  const getRoleBadge = (role: string) => {
    const styles: Record<string, string> = {
      USER: 'bg-gray-500/20 text-gray-400',
      ADMIN: 'bg-primary-500/20 text-primary-500',
      SUPER_ADMIN: 'bg-purple-500/20 text-purple-400',
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${styles[role] || ''}`}>
        {role.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Users</h1>

        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input pl-10 w-64"
            />
          </div>
          <button type="submit" className="btn-primary">
            Search
          </button>
        </form>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">User</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Role</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">KYC</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Balance</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Joined</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-800/50">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gray-700 rounded-full">
                        <User className="h-4 w-4 text-gray-400" />
                      </div>
                      <div>
                        <p className="font-medium">{user.fullName}</p>
                        <p className="text-sm text-gray-500">{user.phoneNumber}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">{getRoleBadge(user.role)}</td>
                  <td className="px-4 py-4">{getKycBadge(user.kycStatus)}</td>
                  <td className="px-4 py-4 font-mono">
                    ${Number(user.wallet?.balanceUsd || 0).toLocaleString()}
                  </td>
                  <td className="px-4 py-4 text-sm text-gray-400">
                    {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        user.isActive
                          ? 'bg-success-500/20 text-success-500'
                          : 'bg-danger-500/20 text-danger-500'
                      }`}
                    >
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
