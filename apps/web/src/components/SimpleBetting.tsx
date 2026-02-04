import { useState } from 'react';
import { Info, TrendingUp, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { ordersApi } from '../services/api';
import { useAuthStore } from '../stores/auth';

interface Outcome {
  id: string;
  name: string;
  currentPrice: number;
}

interface SimpleBettingProps {
  marketId: string;
  title: string;
  outcomes: Outcome[];
  onBetPlaced?: () => void;
}

const PRESET_AMOUNTS = [5, 10, 25, 50, 100];

export default function SimpleBetting({ marketId, title, outcomes, onBetPlaced }: SimpleBettingProps) {
  const { isAuthenticated, user } = useAuthStore();
  const [selectedOutcome, setSelectedOutcome] = useState<string | null>(null);
  const [amount, setAmount] = useState<number>(10);
  const [customAmount, setCustomAmount] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedOutcomeData = outcomes.find(o => o.id === selectedOutcome);
  const price = selectedOutcomeData?.currentPrice || 0;
  const potentialWin = amount / price;
  const profit = potentialWin - amount;

  const handlePlaceBet = async () => {
    if (!selectedOutcome || !amount) return;

    if (!isAuthenticated) {
      toast.error('Please login to place a bet');
      return;
    }

    setIsSubmitting(true);
    try {
      // Place a market order (buy at current price)
      await ordersApi.placeOrder({
        marketId,
        outcomeId: selectedOutcome,
        side: 'BUY',
        orderType: 'LIMIT',
        price: price + 0.01, // Slightly above market to ensure fill
        quantity: amount / price,
      });

      toast.success(`Bet placed! Good luck!`);
      setSelectedOutcome(null);
      setAmount(10);
      onBetPlaced?.();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to place bet');
    } finally {
      setIsSubmitting(false);
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

  // Calculate crowd sentiment as percentage
  const getTotalVolume = () => outcomes.reduce((sum, o) => sum + Number(o.currentPrice), 0);

  return (
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
          Your bet is matched against other traders. If your prediction is correct when the
          market resolves, you win the payout. A 2.5% fee applies on entry and exit.
        </span>
      </div>
    </div>
  );
}
