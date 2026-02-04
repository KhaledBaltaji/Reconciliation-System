import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { createChart, IChartApi, ISeriesApi, LineData } from 'lightweight-charts';
import { Clock, TrendingUp, BarChart3, Eye, EyeOff, Zap, Settings, ArrowLeft } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { useMarketStore } from '../stores/market';
import { useAuthStore } from '../stores/auth';
import { ordersApi, marketsApi } from '../services/api';
import { subscribeToMarket, unsubscribeFromMarket } from '../services/socket';
import SimpleBetting from '../components/SimpleBetting';

type TradingMode = 'simple' | 'advanced';

export default function MarketDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { currentMarket, fetchMarket, orderBooks, fetchOrderBook, isLoading } = useMarketStore();
  const { isAuthenticated, user, checkAuth } = useAuthStore();

  // Trading mode state
  const [tradingMode, setTradingMode] = useState<TradingMode>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('tradingMode') as TradingMode) || 'simple';
    }
    return 'simple';
  });

  const [showChart, setShowChart] = useState(true);
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [orderType, setOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [price, setPrice] = useState('');
  const [amount, setAmount] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recentTrades, setRecentTrades] = useState<any[]>([]);
  const [chartData, setChartData] = useState<LineData[]>([]);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<'Line'> | null>(null);

  // Save trading mode preference
  useEffect(() => {
    localStorage.setItem('tradingMode', tradingMode);
  }, [tradingMode]);

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
    if (chartContainerRef.current && showChart && chartData.length > 0 && tradingMode === 'advanced') {
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
  }, [showChart, chartData, tradingMode]);

  const handlePlaceOrder = async () => {
    if (!isAuthenticated) {
      toast.error('Please login to trade');
      return;
    }

    if (!selectedOutcome || !amount) {
      toast.error('Please fill all fields');
      return;
    }

    const amountNum = parseFloat(amount);
    if (!isFinite(amountNum) || amountNum <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    const outcomeData = currentMarket?.outcomes.find(o => o.id === selectedOutcome);
    if (!outcomeData) return;

    // Default to 0.5 if currentPrice is invalid
    const outcomePrice = outcomeData.currentPrice > 0 && outcomeData.currentPrice < 1
      ? outcomeData.currentPrice
      : 0.5;

    let priceNum: number;
    let quantityNum: number;

    if (orderType === 'MARKET') {
      // Market order: buy at current price + small buffer
      priceNum = side === 'BUY'
        ? Math.min(outcomePrice + 0.02, 0.99)
        : Math.max(outcomePrice - 0.02, 0.01);
      quantityNum = amountNum / outcomePrice;
    } else {
      // Limit order
      priceNum = parseFloat(price) / 100;
      if (!isFinite(priceNum) || priceNum < 0.01 || priceNum > 0.99) {
        toast.error('Price must be between 1% and 99%');
        return;
      }
      quantityNum = amountNum / priceNum;
    }

    // Validate quantity
    if (!isFinite(quantityNum) || quantityNum <= 0) {
      toast.error('Invalid order quantity');
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

      toast.success(side === 'BUY' ? 'Bet placed!' : 'Position sold!');
      setAmount('');
      setPrice('');

      // Refresh data
      fetchOrderBook(id!, selectedOutcome);
      checkAuth();
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

  // Calculate costs for advanced mode
  const currentPrice = selectedOutcomeData?.currentPrice || 0;
  const amountNum = parseFloat(amount) || 0;
  const priceNum = orderType === 'MARKET' ? currentPrice : (parseFloat(price) || 0) / 100;
  const quantity = priceNum > 0 ? amountNum / priceNum : 0;
  const fee = amountNum * 0.025;
  const total = amountNum + fee;
  const potentialPayout = quantity * (1 - 0.025);

  return (
    <div className="space-y-6">
      {/* Back Button */}
      <Link to="/markets" className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition">
        <ArrowLeft className="h-4 w-4" />
        Back to Markets
      </Link>

      {/* Market Header */}
      <div className="card p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1">
            <span className="text-sm text-primary-400">{currentMarket.category.name}</span>
            <h1 className="text-2xl font-bold mt-1">{currentMarket.title}</h1>
            {currentMarket.description && (
              <p className="text-gray-400 mt-2">{currentMarket.description}</p>
            )}
          </div>

          {/* Mode Toggle */}
          <div className="flex items-center gap-2 bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setTradingMode('simple')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition flex items-center gap-2 ${
                tradingMode === 'simple'
                  ? 'bg-primary-500 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Zap className="h-4 w-4" />
              Simple
            </button>
            <button
              onClick={() => setTradingMode('advanced')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition flex items-center gap-2 ${
                tradingMode === 'advanced'
                  ? 'bg-primary-500 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Settings className="h-4 w-4" />
              Advanced
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4 mt-4 text-sm text-gray-400">
          <div className="flex items-center gap-1">
            <Clock className="h-4 w-4" />
            Expires {formatDistanceToNow(new Date(currentMarket.expiresAt), { addSuffix: true })}
          </div>
          <div className="flex items-center gap-1">
            <TrendingUp className="h-4 w-4" />
            ${Number(currentMarket.totalVolume).toLocaleString()} volume
          </div>
        </div>
      </div>

      {/* SIMPLE MODE */}
      {tradingMode === 'simple' && (
        <SimpleBetting
          marketId={id!}
          title={currentMarket.title}
          outcomes={currentMarket.outcomes}
          onBetPlaced={() => {
            checkAuth();
            fetchOrderBook(id!, selectedOutcome!);
          }}
        />
      )}

      {/* ADVANCED MODE */}
      {tradingMode === 'advanced' && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Chart & Order Book */}
          <div className="lg:col-span-2 space-y-6">
            {/* Outcome Pills */}
            <div className="flex gap-2 flex-wrap">
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
                {chartData.length > 0 ? (
                  <div ref={chartContainerRef} />
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-gray-500">
                    No price history yet
                  </div>
                )}
              </div>
            )}

            {/* Order Book */}
            {showChart && orderBook && (
              <div className="card p-4">
                <h3 className="font-semibold mb-4">Order Book</h3>
                <div className="grid grid-cols-2 gap-4">
                  {/* Bids */}
                  <div>
                    <div className="text-xs text-gray-500 flex justify-between mb-2 pb-2 border-b border-gray-700">
                      <span>Price</span>
                      <span>Quantity</span>
                    </div>
                    {orderBook.bids.length === 0 ? (
                      <p className="text-gray-500 text-sm text-center py-4">No bids</p>
                    ) : (
                      orderBook.bids.slice(0, 10).map((bid, i) => (
                        <div key={i} className="flex justify-between text-sm py-1">
                          <span className="text-success-500 font-mono">
                            {(bid.price * 100).toFixed(1)}%
                          </span>
                          <span className="text-gray-300">{bid.quantity.toFixed(2)}</span>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Asks */}
                  <div>
                    <div className="text-xs text-gray-500 flex justify-between mb-2 pb-2 border-b border-gray-700">
                      <span>Price</span>
                      <span>Quantity</span>
                    </div>
                    {orderBook.asks.length === 0 ? (
                      <p className="text-gray-500 text-sm text-center py-4">No asks</p>
                    ) : (
                      orderBook.asks.slice(0, 10).map((ask, i) => (
                        <div key={i} className="flex justify-between text-sm py-1">
                          <span className="text-danger-500 font-mono">
                            {(ask.price * 100).toFixed(1)}%
                          </span>
                          <span className="text-gray-300">{ask.quantity.toFixed(2)}</span>
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
                <p className="text-gray-500 text-center py-4">No trades yet</p>
              ) : (
                <div className="space-y-2">
                  {recentTrades.slice(0, 10).map((trade) => (
                    <div key={trade.id} className="flex justify-between text-sm py-1 border-b border-gray-700 last:border-0">
                      <span className="text-gray-400">{trade.outcome.name}</span>
                      <span className="font-mono">{(trade.price * 100).toFixed(1)}%</span>
                      <span className="text-gray-400">{Number(trade.quantity).toFixed(2)} contracts</span>
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
                Buy
              </button>
              <button
                onClick={() => setSide('SELL')}
                className={`flex-1 py-2 rounded-lg font-medium transition ${
                  side === 'SELL'
                    ? 'bg-danger-600 text-white'
                    : 'bg-gray-700 text-gray-300'
                }`}
              >
                Sell
              </button>
            </div>

            {/* Order Type Toggle */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setOrderType('MARKET')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                  orderType === 'MARKET'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-700 text-gray-300'
                }`}
              >
                Market Order
              </button>
              <button
                onClick={() => setOrderType('LIMIT')}
                className={`flex-1 py-2 rounded-lg text-sm font-medium transition ${
                  orderType === 'LIMIT'
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-700 text-gray-300'
                }`}
              >
                Limit Order
              </button>
            </div>

            {/* Current Price Display (for Market orders) */}
            {orderType === 'MARKET' && (
              <div className="bg-gray-700/50 rounded-lg p-3 mb-4 text-center">
                <span className="text-sm text-gray-400">Current Price</span>
                <p className="text-2xl font-bold font-mono">
                  {(currentPrice * 100).toFixed(1)}%
                </p>
              </div>
            )}

            {/* Price Input (for Limit orders) */}
            {orderType === 'LIMIT' && (
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-1">
                  Price (1-99%)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder={`Current: ${(currentPrice * 100).toFixed(1)}`}
                    min="1"
                    max="99"
                    className="input pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                </div>
              </div>
            )}

            {/* Amount Input */}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-1">
                Amount (USD)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="100"
                  min="1"
                  className="input pl-8"
                />
              </div>
            </div>

            {/* Quick Amount Buttons */}
            <div className="flex gap-2 mb-4">
              {[10, 25, 50, 100].map((preset) => (
                <button
                  key={preset}
                  onClick={() => setAmount(preset.toString())}
                  className="flex-1 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm"
                >
                  ${preset}
                </button>
              ))}
            </div>

            {/* Order Summary */}
            <div className="bg-gray-700/50 rounded-lg p-3 mb-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Amount</span>
                <span className="font-mono">${amountNum.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Contracts</span>
                <span className="font-mono">{quantity.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Fee (2.5%)</span>
                <span className="font-mono">${fee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-semibold pt-2 border-t border-gray-600">
                <span>Total Cost</span>
                <span className="font-mono">${total.toFixed(2)}</span>
              </div>
              {amountNum > 0 && (
                <div className="flex justify-between text-success-500 pt-2 border-t border-gray-600">
                  <span>If {selectedOutcomeData?.name} wins</span>
                  <span className="font-mono font-bold">${potentialPayout.toFixed(2)}</span>
                </div>
              )}
            </div>

            {/* Submit Button */}
            <button
              onClick={handlePlaceOrder}
              disabled={isSubmitting || !isAuthenticated || currentMarket.status !== 'OPEN' || !amount}
              className={`w-full py-3 rounded-lg font-semibold transition ${
                side === 'BUY'
                  ? 'bg-success-600 hover:bg-success-500'
                  : 'bg-danger-600 hover:bg-danger-500'
              } text-white disabled:opacity-50 disabled:cursor-not-allowed`}
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
                Balance: ${Number(user.wallet.balanceUsd).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
