import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, BarChart3, DollarSign, Clock, Plus } from 'lucide-react';
import { adminApi } from '../../services/api';

interface Stats {
  totalUsers: number;
  activeMarkets: number;
  totalVolume: number;
  pendingKyc: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    adminApi
      .getStats()
      .then((res) => setStats(res.data.data))
      .catch(console.error)
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Link to="/admin/markets/create" className="btn-primary">
          <Plus className="h-4 w-4 mr-2" />
          Create Market
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary-500/20 rounded-lg">
              <Users className="h-6 w-6 text-primary-500" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Total Users</p>
              <p className="text-2xl font-bold">{stats?.totalUsers || 0}</p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-success-500/20 rounded-lg">
              <BarChart3 className="h-6 w-6 text-success-500" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Active Markets</p>
              <p className="text-2xl font-bold">{stats?.activeMarkets || 0}</p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-yellow-500/20 rounded-lg">
              <DollarSign className="h-6 w-6 text-yellow-500" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Total Volume</p>
              <p className="text-2xl font-bold">
                ${Number(stats?.totalVolume || 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-danger-500/20 rounded-lg">
              <Clock className="h-6 w-6 text-danger-500" />
            </div>
            <div>
              <p className="text-sm text-gray-400">Pending KYC</p>
              <p className="text-2xl font-bold">{stats?.pendingKyc || 0}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="card p-6">
        <h2 className="font-semibold mb-4">Quick Actions</h2>
        <div className="grid md:grid-cols-3 gap-4">
          <Link
            to="/admin/markets/create"
            className="p-4 bg-gray-700 rounded-lg hover:bg-gray-600 transition text-center"
          >
            <BarChart3 className="h-8 w-8 mx-auto mb-2 text-primary-400" />
            <p className="font-medium">Create Market</p>
            <p className="text-sm text-gray-400">Add a new prediction market</p>
          </Link>
          <Link
            to="/admin/users"
            className="p-4 bg-gray-700 rounded-lg hover:bg-gray-600 transition text-center"
          >
            <Users className="h-8 w-8 mx-auto mb-2 text-success-400" />
            <p className="font-medium">Manage Users</p>
            <p className="text-sm text-gray-400">View and manage user accounts</p>
          </Link>
          <Link
            to="/admin/markets"
            className="p-4 bg-gray-700 rounded-lg hover:bg-gray-600 transition text-center"
          >
            <Clock className="h-8 w-8 mx-auto mb-2 text-yellow-400" />
            <p className="font-medium">Resolve Markets</p>
            <p className="text-sm text-gray-400">Settle completed markets</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
