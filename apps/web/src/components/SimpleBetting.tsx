import { useState, useEffect } from 'react';
import { Info, TrendingUp, Users, X, Clock, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { ordersApi, marketsApi } from '../services/api';
import { useAuthStore } from '../stores/auth';
import { onTradeExecuted } from '../services/socket';

interface Outcome {
  id: string;
  name: string;
  currentPrice: number;
}

interface Trade {
  id: string;
  price: number;
  quantity: number;
  createdAt: string;
  outcome: { id: string; name: string };
}

interface Position {
  id: string;
  outcomeId: string;
  quantity: number;
  avgEntryPrice: string;
  outcome: { id: string; name: string };
  market: { id: string; title: string };
}

interface SimpleBettingProps {
  marketId: string;
  title: string;
  outcomes: Outcome[];
  onBetPlaced?: () => void;
}

const PRESET_AMOUNTS = [5, 10, 25, 50, 100];

export default function SimpleBetting({ marketId, title, outcomes, onBetPlaced }: SimpleBettingProps) {
  const { isAuthenticated, user, checkAuth } = useAuthStore();
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);
  const [amount, setAmount] = useState<number>(10);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [recentTrades, setRecentTrades] = useState<Trade[]>([]);
  const [userPositions, setUserPositions] = useState<Position[]>([]);
  const [closingPosition, setClosingPosition] = useState<string | null>(null);

  const selectedOutcomeData = outcomes.find(o => o.id === selectedOutcome);
  const price = selectedOutcomeData?.currentPrice || 0;
  const potentialWin = amount / price;
  const profit = potentialWin - amount;

  // Fetch recent trades
  useEffect(() => {
    if (marketId) {
      marketsApi.getTrades(marketId, 10).then((res) => {
        setRecentTrades(res.data.data || []);
      }).catch(() => {});
    }
  }, [marketId]);

  // Fetch user positions
  useEffect(() => {
    if (isAuthenticated && marketId) {
      ordersApi.getPositions().then((res) => {
        const positions = res.data.data || [];
        // Filter to only this market's positions
        const marketPositions = positions.filter((p: Position) => p.market.id === marketId);
        setUserPositions(marketPositions);
      }).catch(() => {});
    }
  }, [isAuthenticated, marketId]);

  // Listen for real-time trade updates
  useEffect(() => {
    const unsubscribe = onTradeExecuted(marketId, (trade) => {
      // Add new trade to the top of the list
      setRecentTrades(prev => {
        const newTrade: Trade = {
          id: trade.id,
          price: trade.price,
          quantity: trade.quantity,
          createdAt: new Date(trade.timestamp).toISOString(),
          outcome: { id: trade.outcomeId, name: outcomes.find(o => o.id === trade.outcomeId)?.name || 'Unknown' }
        };
        return [newTrade, ...prev].slice(0, 10);
      });
    });

    return () => unsubscribe();
  }, [marketId, outcomes]);

  const handlePlaceBet = async () => {
    if (!selectedOutcome || !amount) return;

    if (!isAuthenticated) {
      toast.error('Please login to place a bet');
      return;
    }

    // Get current price, default to 0.5 if not available
    const currentPrice = selectedOutcomeData?.currentPrice || 0.5;
    if (currentPrice <= 0 || currentPrice >= 1) {
      toast.error('Invalid price. Please try again.');
      return;
    }

    const orderPrice = Math.min(currentPrice + 0.02, 0.99); // Cap at 99%
    const orderQuantity = amount / currentPrice;

    if (!isFinite(orderQuantity) || orderQuantity <= 0) {
      toast.error('Invalid bet amount');
      return;
    }

    setIsSubmitting(true);
    try {
      // Place a market order (buy at current price)
      await ordersApi.place({
        marketId,
        outcomeId: selectedOutcome,
        side: 'BUY',
        price: orderPrice,
        quantity: orderQuantity,
      });

      toast.success(`Bet placed! Good luck!`);
      setSelectedOutcome(null);
      setAmount(10);

      // Refresh positions and auth (balance)
      checkAuth();
      ordersApi.getPositions().then((res) => {
        const positions = res.data.data || [];
        const marketPositions = positions.filter((p: Position) => p.market.id === marketId);
        setUserPositions(marketPositions);
      });

      onBetPlaced?.();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to place bet');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClosePosition = async (position: Position) => {
    if (closingPosition) return;

    const positionQty = Number(position.quantity);
    if (!isFinite(positionQty) || positionQty <= 0) {
      toast.error('Invalid position quantity');
      return;
    }

    setClosingPosition(position.id);
    try {
      const outcome = outcomes.find(o => o.id === position.outcomeId);
      const currentPrice = outcome?.currentPrice || 0.5;
      const sellPrice = Math.max(currentPrice - 0.02, 0.01);

      // Sell at slightly below market to ensure fill
      await ordersApi.place({
        marketId,
        outcomeId: position.outcomeId,
        side: 'SELL',
        price: sellPrice,
        quantity: positionQty,
      });

      toast.success('Position closed!');

      // Refresh positions and balance
      checkAuth();
      ordersApi.getPositions().then((res) => {
        const positions = res.data.data || [];
        const marketPositions = positions.filter((p: Position) => p.market.id === marketId);
        setUserPositions(marketPositions);
      });

      onBetPlaced?.();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to close position');
    } finally {
      setClosingPosition(null);
    }
  };

  const handleAmountChange = (value: number) => {
    setAmount(value);
    setCustomAmount('');
  };

  const handleCustomAmount = (value: string) => {
    setCustomAmount(value);
    const num = parseFloat(value);
    if (!isNaN(num) && num > 0) {
      setAmount(num);
    }
  };

  return (
    <div className="space-y-6">
      {/* Main Betting Card */}
      <div className="card p-6 space-y-6">
        {/* Question */}
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">{title}</h2>
          <div className="flex items-center justify-center gap-2 text-gray-400 text-sm">
            <Users className="h-4 w-4" />
            <span>Based on current market prices</span>
          </div>
        </div>

        {/* Outcome Selection */}
        <div className="grid grid-cols-2 gap-4">
          {outcomes.slice(0, 2).map((outcome) => {
            const isYes = outcome.name.toLowerCase() === 'yes';
            const isSelected = selectedOutcome === outcome.id;
            const percent = Math.round(outcome.currentPrice * 100);
            const potentialReturn = amount / outcome.currentPrice;

            return (
              <button
                key={outcome.id}
                onClick={() => setSelectedOutcome(outcome.id)}
                className={`relative p-4 rounded-xl border-2 transition-all ${
                  isSelected
                    ? isYes
                      ? 'border-success-500 bg-success-500/10'
                      : 'border-danger-500 bg-danger-500/10'
                    : 'border-gray-700 hover:border-gray-600 bg-gray-800/50'
                }`}
              >
                {isSelected && (
                  <div className={`absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold ${
                    isYes ? 'bg-success-500' : 'bg-danger-500'
                  }`}>
                    ✓
                  </div>
                )}

                <div className={`text-2xl font-bold mb-1 ${
                  isYes ? 'text-success-500' : 'text-danger-500'
                }`}>
                  {outcome.name}
                </div>

                <div className="text-3xl font-bold font-mono mb-2">
                  {percent}%
                </div>

                <div className="text-sm text-gray-400">
                  {percent}% chance
                </div>

                {amount > 0 && (
                  <div className={`mt-3 pt-3 border-t border-gray-700 text-sm ${
                    isYes ? 'text-success-400' : 'text-danger-400'
                  }`}>
                    <div>Bet ${amount.toFixed(0)}</div>
                    <div className="font-bold">Win ${potentialReturn.toFixed(2)}</div>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Multiple choice outcomes (if more than 2) */}
        {outcomes.length > 2 && (
          <div className="space-y-2">
            {outcomes.slice(2).map((outcome) => {
              const isSelected = selectedOutcome === outcome.id;
              const percent = Math.round(outcome.currentPrice * 100);
              const potentialReturn = amount / outcome.currentPrice;

              return (
                <button
                  key={outcome.id}
                  onClick={() => setSelectedOutcome(outcome.id)}
                  className={`w-full p-3 rounded-lg border transition-all flex items-center justify-between ${
                    isSelected
                      ? 'border-primary-500 bg-primary-500/10'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center">
                        <span className="text-white text-xs">✓</span>
                      </div>
                    )}
                    <span className="font-medium">{outcome.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="font-mono font-bold">{percent}%</div>
                    {amount > 0 && (
                      <div className="text-xs text-gray-400">
                        Win ${potentialReturn.toFixed(2)}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Amount Selection */}
        <div>
          <label className="block text-sm text-gray-400 mb-2">Bet Amount (USD)</label>
          <div className="flex flex-wrap gap-2 mb-3">
            {PRESET_AMOUNTS.map((preset) => (
              <button
                key={preset}
                onClick={() => handleAmountChange(preset)}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  amount === preset && !customAmount
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                }`}
              >
                ${preset}
              </button>
            ))}
            <input
              type="number"
              placeholder="Custom"
              value={customAmount}
              onChange={(e) => handleCustomAmount(e.target.value)}
              className="w-24 px-3 py-2 rounded-lg bg-gray-700 border border-gray-600 focus:border-primary-500 outline-none"
            />
          </div>
        </div>

        {/* Bet Summary */}
        {selectedOutcome && amount > 0 && (
          <div className="bg-gray-800/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Your bet</span>
              <span className="font-mono">${amount.toFixed(2)} on {selectedOutcomeData?.name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">If you win</span>
              <span className="font-mono text-success-500">+${profit.toFixed(2)} profit</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Total payout</span>
              <span className="font-mono font-bold">${potentialWin.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm pt-2 border-t border-gray-700">
              <span className="text-gray-400">If you lose</span>
              <span className="font-mono text-danger-500">-${amount.toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Place Bet Button */}
        <button
          onClick={handlePlaceBet}
          disabled={!selectedOutcome || !amount || isSubmitting}
          className={`w-full py-4 rounded-xl font-bold text-lg transition ${
            !selectedOutcome || !amount
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white'
          }`}
        >
          {isSubmitting ? 'Placing Bet...' :
           !selectedOutcome ? 'Select an outcome' :
           !amount ? 'Enter amount' :
           `Place Bet - $${amount.toFixed(2)}`}
        </button>

        {/* Info */}
        <div className="flex items-start gap-2 text-xs text-gray-500">
          <Info className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            Your bet is matched against other players. When the outcome is decided,
            if you're right, you win! A 2.5% fee applies on entry and exit.
          </span>
        </div>
      </div>

      {/* Your Active Bets */}
      {isAuthenticated && userPositions.length > 0 && (
        <div className="card p-6">
          <h3 className="font-bold mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary-500" />
            Your Active Bets
          </h3>
          <div className="space-y-3">
            {userPositions.map((position) => {
              const outcome = outcomes.find(o => o.id === position.outcomeId);
              const currentPrice = outcome?.currentPrice || 0;
              const entryPrice = Number(position.avgEntryPrice);
              const quantity = Number(position.quantity);
              const currentValue = quantity * currentPrice;
              const costBasis = quantity * entryPrice;
              const pnl = currentValue - costBasis;
              const pnlPercent = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
              const isProfit = pnl >= 0;

              return (
                <div
                  key={position.id}
                  className="bg-gray-800/50 rounded-lg p-4 flex items-center justify-between"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`font-bold ${
                        outcome?.name.toLowerCase() === 'yes' ? 'text-success-500' : 'text-danger-500'
                      }`}>
                        {outcome?.name || 'Unknown'}
                      </span>
                      <span className="text-gray-500 text-sm">
                        {quantity.toFixed(2)} contracts
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-gray-400">
                        Entry: {(entryPrice * 100).toFixed(0)}%
                      </span>
                      <span className="text-gray-400">
                        Now: {(currentPrice * 100).toFixed(0)}%
                      </span>
                      <span className={`flex items-center gap-1 font-medium ${
                        isProfit ? 'text-success-500' : 'text-danger-500'
                      }`}>
                        {isProfit ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                        ${Math.abs(pnl).toFixed(2)} ({pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(1)}%)
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleClosePosition(position)}
                    disabled={closingPosition === position.id}
                    className="ml-4 px-4 py-2 bg-danger-600 hover:bg-danger-500 text-white rounded-lg font-medium transition flex items-center gap-2 disabled:opacity-50"
                  >
                    {closingPosition === position.id ? (
                      'Closing...'
                    ) : (
                      <>
                        <X className="h-4 w-4" />
                        Close
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Trades */}
      <div className="card p-6">
        <h3 className="font-bold mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5 text-gray-400" />
          Recent Trades
        </h3>
        {recentTrades.length === 0 ? (
          <p className="text-gray-500 text-center py-4">No trades yet. Be the first to bet!</p>
        ) : (
          <div className="space-y-2">
            {recentTrades.map((trade) => {
              const isYes = trade.outcome.name.toLowerCase() === 'yes';
              return (
                <div
                  key={trade.id}
                  className="flex items-center justify-between py-2 border-b border-gray-700 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span className={`font-medium ${
                      isYes ? 'text-success-500' : 'text-danger-500'
                    }`}>
                      {trade.outcome.name}
                    </span>
                    <span className="text-gray-500 text-sm">
                      @ {(trade.price * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="font-mono text-gray-300">
                      {Number(trade.quantity).toFixed(2)}
                    </span>
                    <span className="text-gray-500">
                      {formatDistanceToNow(new Date(trade.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
