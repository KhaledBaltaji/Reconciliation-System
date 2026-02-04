import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { createChart, IChartApi, ISeriesApi, LineData } from 'lightweight-charts';
import { Clock, TrendingUp, BarChart3, Eye, EyeOff } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { useMarketStore } from '../stores/market';
import { useAuthStore } from '../stores/auth';
import { ordersApi, marketsApi } from '../services/api';
import { subscribeToMarket, unsubscribeFromMarket } from '../services/socket';

export default function MarketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { currentMarket, fetchMarket, orderBooks, fetchOrderBook, isLoading } = useMarketStore();
  const { isAuthenticated, user } = useAuthStore();

  const [showChart, setShowChart] = useState(true);
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recentTrades, setRecentTrades] = useState<any[]>([]);
  const [chartData, setChartData] = useState<LineData[]>([]);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  // Fetch market data
  useEffect(() => {
    if (id) {
      fetchMarket(id);
      subscribeToMarket(id);

      return () => {
        unsubscribeFromMarket(id);
      };
    }
  }, [id, fetchMarket]);

  // Set default selected outcome
  useEffect(() => {
    if (currentMarket?.outcomes && !selectedOutcome) {
      setSelectedOutcome(currentMarket.outcomes[0].id);
    }
  }, [currentMarket, selectedOutcome]);

  // Fetch order book and trades
  useEffect(() => {
    if (id && selectedOutcome) {
      fetchOrderBook(id, selectedOutcome);

      marketsApi.getTrades(id).then((res) => {
        setRecentTrades(res.data.data);
      });

      marketsApi.getChart(id, selectedOutcome).then((res) => {
        const data = res.data.data.map((p: any) => ({
          time: p.time / 1000,
          value: p.price * 100,
        }));
        setChartData(data);
      });
    }
  }, [id, selectedOutcome, fetchOrderBook]);

  // Initialize chart
  useEffect(() => {
    if (chartContainerRef.current && showChart && chartData.length > 0) {
      if (chartRef.current) {
        chartRef.current.remove();
      }

      const chart = createChart(chartContainerRef.current, {
        layout: {
          background: { color: '#1f2937' },
          textColor: '#9ca3af',
        },
        grid: {
          vertLines: { color: '#374151' },
          horzLines: { color: '#374151' },
        },
        width: chartContainerRef.current.clientWidth,
        height: 300,
        timeScale: {
          timeVisible: true,
          secondsVisible: false,
        },
      });

      const series = chart.addLineSeries({
        color: '#0ea5e9',
        lineWidth: 2,
      });

      series.setData(chartData);
      chartRef.current = chart;
      seriesRef.current = series;

      const handleResize = () => {
        if (chartContainerRef.current) {
          chart.applyOptions({ width: chartContainerRef.current.clientWidth });
        }
      };

      window.addEventListener('resize', handleResize);
      return () => {
        window.removeEventListener('resize', handleResize);
        chart.remove();
      };
    }
  }, [showChart, chartData]);

  const handlePlaceOrder = async () => {
    if (!isAuthenticated) {
      toast.error('Please login to trade');
      return;
    }

    if (!selectedOutcome || !price || !quantity) {
      toast.error('Please fill all fields');
      return;
    }

    const priceNum = parseFloat(price) / 100;
    const quantityNum = parseFloat(quantity);

    if (priceNum < 0.01 || priceNum > 0.99) {
      toast.error('Price must be between 1% and 99%');
      return;
    }

    if (quantityNum < 1) {
      toast.error('Minimum quantity is 1');
      return;
    }

    setIsSubmitting(true);
    try {
      await ordersApi.place({
        marketId: id!,
        outcomeId: selectedOutcome,
        side,
        price: priceNum,
        quantity: quantityNum,
      });

      toast.success('Order placed successfully');
      setPrice('');
      setQuantity('');

      // Refresh order book
      fetchOrderBook(id!, selectedOutcome);
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to place order');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedOutcomeData = currentMarket?.outcomes.find((o) => o.id === selectedOutcome);
  const orderBook = selectedOutcome ? orderBooks[selectedOutcome] : null;

  if (isLoading || !currentMarket) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  const fee = price && quantity ? (parseFloat(price) / 100) * parseFloat(quantity) * 0.025 : 0;
  const total = price && quantity ? (parseFloat(price) / 100) * parseFloat(quantity) + fee : 0;

  return (
    <div className="space-y-6">
      {/* Market Header */}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-sm text-primary-400">{currentMarket.category.name}</span>
            <h1 className="text-2xl font-bold mt-1">{currentMarket.title}</h1>
            {currentMarket.description && (
              <p className="text-gray-400 mt-2">{currentMarket.description}</p>
            )}
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <Clock className="h-4 w-4" />
              Expires {formatDistanceToNow(new Date(currentMarket.expiresAt), { addSuffix: true })}
            </div>
            <div className="flex items-center gap-2 text-gray-400 text-sm mt-1">
              <TrendingUp className="h-4 w-4" />
              ${currentMarket.totalVolume.toLocaleString()} volume
            </div>
          </div>
        </div>

        {/* Outcome Pills */}
        <div className="flex gap-2 mt-4 flex-wrap">
          {currentMarket.outcomes.map((outcome) => (
            <button
              key={outcome.id}
              onClick={() => setSelectedOutcome(outcome.id)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                selectedOutcome === outcome.id
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {outcome.name}
              <span className="ml-2 font-mono">
                {(outcome.currentPrice * 100).toFixed(1)}%
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: Chart & Order Book */}
        <div className="lg:col-span-2 space-y-6">
          {/* Chart Toggle */}
          <div className="flex items-center justify-between">
            <h2 className="font-semibold flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Price Chart
            </h2>
            <button
              onClick={() => setShowChart(!showChart)}
              className="btn-ghost text-sm flex items-center gap-1"
            >
              {showChart ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showChart ? 'Hide' : 'Show'} Chart
            </button>
          </div>

          {/* Chart */}
          {showChart && (
            <div className="card p-4">
              <div ref={chartContainerRef} />
            </div>
          )}

          {/* Order Book */}
          {showChart && orderBook && (
            <div className="card p-4">
              <h3 className="font-semibold mb-4">Order Book</h3>
              <div className="grid grid-cols-2 gap-4">
                {/* Bids */}
                <div>
                  <div className="text-xs text-gray-500 flex justify-between mb-2">
                    <span>Price</span>
                    <span>Quantity</span>
                  </div>
                  {orderBook.bids.length === 0 ? (
                    <p className="text-gray-500 text-sm">No bids</p>
                  ) : (
                    orderBook.bids.slice(0, 10).map((bid, i) => (
                      <div
                        key={i}
                        className="flex justify-between text-sm py-1 bid-depth"
                      >
                        <span className="text-success-500 font-mono">
                          {(bid.price * 100).toFixed(1)}%
                        </span>
                        <span className="text-gray-300">{bid.quantity}</span>
                      </div>
                    ))
                  )}
                </div>

                {/* Asks */}
                <div>
                  <div className="text-xs text-gray-500 flex justify-between mb-2">
                    <span>Price</span>
                    <span>Quantity</span>
                  </div>
                  {orderBook.asks.length === 0 ? (
                    <p className="text-gray-500 text-sm">No asks</p>
                  ) : (
                    orderBook.asks.slice(0, 10).map((ask, i) => (
                      <div
                        key={i}
                        className="flex justify-between text-sm py-1 ask-depth"
                      >
                        <span className="text-danger-500 font-mono">
                          {(ask.price * 100).toFixed(1)}%
                        </span>
                        <span className="text-gray-300">{ask.quantity}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Recent Trades */}
          <div className="card p-4">
            <h3 className="font-semibold mb-4">Recent Trades</h3>
            {recentTrades.length === 0 ? (
              <p className="text-gray-500">No trades yet</p>
            ) : (
              <div className="space-y-2">
                {recentTrades.slice(0, 10).map((trade) => (
                  <div key={trade.id} className="flex justify-between text-sm">
                    <span className="text-gray-400">{trade.outcome.name}</span>
                    <span className="font-mono">
                      {(trade.price * 100).toFixed(1)}%
                    </span>
                    <span className="text-gray-400">{trade.quantity} shares</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Trading Panel */}
        <div className="card p-6 h-fit sticky top-24">
          <h2 className="font-semibold mb-4">
            Trade {selectedOutcomeData?.name || 'Select Outcome'}
          </h2>

          {/* Buy/Sell Toggle */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setSide('BUY')}
              className={`flex-1 py-2 rounded-lg font-medium transition ${
                side === 'BUY'
                  ? 'bg-success-600 text-white'
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              Buy Yes
            </button>
            <button
              onClick={() => setSide('SELL')}
              className={`flex-1 py-2 rounded-lg font-medium transition ${
                side === 'SELL'
                  ? 'bg-danger-600 text-white'
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              Sell Yes
            </button>
          </div>

          {/* Price Input */}
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-1">
              Price (1-99%)
            </label>
            <div className="relative">
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="50"
                min="1"
                max="99"
                className="input pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                %
              </span>
            </div>
          </div>

          {/* Quantity Input */}
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-1">
              Quantity (shares)
            </label>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="100"
              min="1"
              className="input"
            />
          </div>

          {/* Order Summary */}
          <div className="bg-gray-700/50 rounded-lg p-3 mb-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Cost</span>
              <span className="font-mono">
                ${price && quantity ? ((parseFloat(price) / 100) * parseFloat(quantity)).toFixed(2) : '0.00'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Fee (2.5%)</span>
              <span className="font-mono">${fee.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-semibold pt-2 border-t border-gray-600">
              <span>Total</span>
              <span className="font-mono">${total.toFixed(2)}</span>
            </div>
          </div>

          {/* Potential Payout */}
          {price && quantity && (
            <div className="text-sm text-gray-400 mb-4">
              Potential payout if {selectedOutcomeData?.name} wins:{' '}
              <span className="text-success-500 font-semibold">
                ${(parseFloat(quantity) * (1 - 0.025)).toFixed(2)}
              </span>
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={handlePlaceOrder}
            disabled={isSubmitting || !isAuthenticated || currentMarket.status !== 'OPEN'}
            className={`w-full py-3 rounded-lg font-semibold transition ${
              side === 'BUY'
                ? 'bg-success-600 hover:bg-success-500'
                : 'bg-danger-600 hover:bg-danger-500'
            } text-white disabled:opacity-50`}
          >
            {isSubmitting
              ? 'Placing Order...'
              : !isAuthenticated
              ? 'Login to Trade'
              : currentMarket.status !== 'OPEN'
              ? 'Market Closed'
              : `${side === 'BUY' ? 'Buy' : 'Sell'} ${selectedOutcomeData?.name}`}
          </button>

          {/* Balance */}
          {isAuthenticated && user?.wallet && (
            <p className="text-center text-sm text-gray-500 mt-3">
              Available: ${Number(user.wallet.balanceUsd).toLocaleString()}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
