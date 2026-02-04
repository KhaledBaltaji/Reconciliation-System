import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { ordersApi } from '../services/api';

interface Position {
  id: string;
  quantity: number;
  avgEntryPrice: number;
  market: {
    id: string;
    title: string;
    status: string;
    expiresAt: string;
  };
  outcome: {
    id: string;
    name: string;
    currentPrice: number;
  };
}

interface Order {
  id: string;
  side: 'BUY' | 'SELL';
  price: number;
  quantity: number;
  filledQuantity: number;
  status: string;
  market: {
    id: string;
    title: string;
  };
  outcome: {
    name: string;
  };
}

export default function PortfolioPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'positions' | 'orders'>('positions');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [posRes, orderRes] = await Promise.all([
        ordersApi.getPositions(),
        ordersApi.list({ status: 'OPEN' }),
      ]);
      setPositions(posRes.data.data);
      setOrders(orderRes.data.data.orders);
    } catch (error) {
      toast.error('Failed to load portfolio');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    try {
      await ordersApi.cancel(orderId);
      toast.success('Order cancelled');
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to cancel order');
    }
  };

  const totalValue = positions.reduce((sum, pos) => {
    return sum + Number(pos.quantity) * Number(pos.outcome.currentPrice);
  }, 0);

  const totalPnL = positions.reduce((sum, pos) => {
    const currentValue = Number(pos.quantity) * Number(pos.outcome.currentPrice);
    const entryValue = Number(pos.quantity) * Number(pos.avgEntryPrice);
    return sum + (currentValue - entryValue);
  }, 0);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <Briefcase className="h-6 w-6" />
        Portfolio
      </h1>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-sm text-gray-400">Positions Value</p>
          <p className="text-2xl font-bold font-mono">${totalValue.toFixed(2)}</p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-400">Unrealized P&L</p>
          <p className={`text-2xl font-bold font-mono ${totalPnL >= 0 ? 'text-success-500' : 'text-danger-500'}`}>
            {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-sm text-gray-400">Open Orders</p>
          <p className="text-2xl font-bold font-mono">{orders.length}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-700">
        <button
          onClick={() => setActiveTab('positions')}
          className={`px-4 py-2 font-medium transition ${
            activeTab === 'positions'
              ? 'text-primary-400 border-b-2 border-primary-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Positions ({positions.length})
        </button>
        <button
          onClick={() => setActiveTab('orders')}
          className={`px-4 py-2 font-medium transition ${
            activeTab === 'orders'
              ? 'text-primary-400 border-b-2 border-primary-400'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Open Orders ({orders.length})
        </button>
      </div>

      {/* Positions Tab */}
      {activeTab === 'positions' && (
        <div className="space-y-4">
          {positions.length === 0 ? (
            <div className="text-center py-12">
              <Briefcase className="h-12 w-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No positions yet</p>
              <Link to="/markets" className="btn-primary mt-4">
                Explore Markets
              </Link>
            </div>
          ) : (
            positions.map((position) => {
              const currentValue = Number(position.quantity) * Number(position.outcome.currentPrice);
              const entryValue = Number(position.quantity) * Number(position.avgEntryPrice);
              const pnl = currentValue - entryValue;
              const pnlPercent = ((pnl / entryValue) * 100).toFixed(1);

              return (
                <Link
                  key={position.id}
                  to={`/market/${position.market.id}`}
                  className="card p-4 block hover:border-gray-600 transition"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm text-gray-400">{position.outcome.name}</p>
                      <h3 className="font-semibold">{position.market.title}</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        {position.quantity} shares @ {(Number(position.avgEntryPrice) * 100).toFixed(1)}%
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-semibold">${currentValue.toFixed(2)}</p>
                      <p className={`text-sm font-mono ${pnl >= 0 ? 'text-success-500' : 'text-danger-500'}`}>
                        {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)} ({pnlPercent}%)
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Current: {(Number(position.outcome.currentPrice) * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>
      )}

      {/* Orders Tab */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          {orders.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="h-12 w-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No open orders</p>
            </div>
          ) : (
            orders.map((order) => (
              <div key={order.id} className="card p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span
                      className={`text-xs font-medium px-2 py-0.5 rounded ${
                        order.side === 'BUY'
                          ? 'bg-success-500/20 text-success-500'
                          : 'bg-danger-500/20 text-danger-500'
                      }`}
                    >
                      {order.side}
                    </span>
                    <p className="font-semibold mt-1">{order.market.title}</p>
                    <p className="text-sm text-gray-400">
                      {order.outcome.name} @ {(Number(order.price) * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono">
                      {order.filledQuantity}/{order.quantity} filled
                    </p>
                    <button
                      onClick={() => handleCancelOrder(order.id)}
                      className="text-danger-400 hover:text-danger-300 text-sm mt-2"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
