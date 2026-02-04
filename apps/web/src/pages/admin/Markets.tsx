import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Play, Pause, CheckCircle, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { marketsApi, adminApi } from '../../services/api';

interface Market {
  id: string;
  title: string;
  status: string;
  expiresAt: string;
  totalVolume: number;
  category: { name: string };
  outcomes: { id: string; name: string; currentPrice: number }[];
}

export default function AdminMarkets() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [resolveModal, setResolveModal] = useState<Market | null>(null);

  useEffect(() => {
    loadMarkets();
  }, []);

  const loadMarkets = async () => {
    setIsLoading(true);
    try {
      const res = await marketsApi.list({ page: 1 });
      setMarkets(res.data.data.markets);
    } catch (error) {
      toast.error('Failed to load markets');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenMarket = async (id: string) => {
    try {
      await adminApi.openMarket(id);
      toast.success('Market opened');
      loadMarkets();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to open market');
    }
  };

  const handleResolve = async (marketId: string, outcomeId: string) => {
    try {
      await adminApi.resolveMarket(marketId, outcomeId);
      toast.success('Market resolved');
      setResolveModal(null);
      loadMarkets();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to resolve market');
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      DRAFT: 'bg-gray-500/20 text-gray-400',
      OPEN: 'bg-success-500/20 text-success-500',
      SUSPENDED: 'bg-yellow-500/20 text-yellow-500',
      CLOSED: 'bg-danger-500/20 text-danger-500',
      RESOLVED: 'bg-primary-500/20 text-primary-500',
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${styles[status] || ''}`}>
        {status}
      </span>
    );
  };

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
        <h1 className="text-2xl font-bold">Markets</h1>
        <Link to="/admin/markets/create" className="btn-primary">
          <Plus className="h-4 w-4 mr-2" />
          Create Market
        </Link>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-700">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Market</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Status</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Volume</th>
              <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Expires</th>
              <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {markets.map((market) => (
              <tr key={market.id} className="hover:bg-gray-800/50">
                <td className="px-4 py-4">
                  <div>
                    <p className="font-medium">{market.title}</p>
                    <p className="text-sm text-gray-500">{market.category.name}</p>
                  </div>
                </td>
                <td className="px-4 py-4">{getStatusBadge(market.status)}</td>
                <td className="px-4 py-4 font-mono">
                  ${Number(market.totalVolume).toLocaleString()}
                </td>
                <td className="px-4 py-4 text-sm text-gray-400">
                  {formatDistanceToNow(new Date(market.expiresAt), { addSuffix: true })}
                </td>
                <td className="px-4 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {market.status === 'DRAFT' && (
                      <button
                        onClick={() => handleOpenMarket(market.id)}
                        className="p-2 text-success-400 hover:bg-success-500/20 rounded"
                        title="Open Market"
                      >
                        <Play className="h-4 w-4" />
                      </button>
                    )}
                    {(market.status === 'OPEN' || market.status === 'CLOSED') && (
                      <button
                        onClick={() => setResolveModal(market)}
                        className="p-2 text-primary-400 hover:bg-primary-500/20 rounded"
                        title="Resolve Market"
                      >
                        <CheckCircle className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Resolve Modal */}
      {resolveModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Resolve Market</h2>
            <p className="text-gray-400 mb-4">{resolveModal.title}</p>
            <p className="text-sm text-gray-500 mb-4">Select the winning outcome:</p>

            <div className="space-y-2 mb-6">
              {resolveModal.outcomes.map((outcome) => (
                <button
                  key={outcome.id}
                  onClick={() => handleResolve(resolveModal.id, outcome.id)}
                  className="w-full p-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition text-left flex justify-between items-center"
                >
                  <span>{outcome.name}</span>
                  <span className="font-mono text-gray-400">
                    {(outcome.currentPrice * 100).toFixed(1)}%
                  </span>
                </button>
              ))}
            </div>

            <button
              onClick={() => setResolveModal(null)}
              className="btn-secondary w-full"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
