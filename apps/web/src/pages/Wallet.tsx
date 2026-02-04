import { useEffect, useState } from 'react';
import { Wallet as WalletIcon, ArrowUpRight, ArrowDownLeft, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';
import { walletApi } from '../services/api';
import { useAuthStore } from '../stores/auth';

interface Transaction {
  id: string;
  type: string;
  amount: number;
  fee: number;
  status: string;
  createdAt: string;
}

interface DepositMethod {
  id: string;
  name: string;
  type: string;
  feePercentage: number;
  feeFixed: number;
  minAmount: number;
  maxAmount?: number;
}

export default function WalletPage() {
  const { user, checkAuth } = useAuthStore();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [depositMethods, setDepositMethods] = useState<DepositMethod[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showDeposit, setShowDeposit] = useState(false);
  const [depositAmount, setDepositAmount] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [txRes, methodsRes] = await Promise.all([
        walletApi.getTransactions(),
        walletApi.getDepositMethods(),
      ]);
      setTransactions(txRes.data.data.transactions);
      setDepositMethods(methodsRes.data.data);
      if (methodsRes.data.data.length > 0) {
        setSelectedMethod(methodsRes.data.data[0].id);
      }
    } catch (error) {
      toast.error('Failed to load wallet data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeposit = async () => {
    if (!depositAmount || !selectedMethod) return;

    setIsSubmitting(true);
    try {
      await walletApi.deposit({
        amount: parseFloat(depositAmount),
        methodId: selectedMethod,
      });
      toast.success('Deposit successful!');
      setShowDeposit(false);
      setDepositAmount('');
      await checkAuth(); // Refresh balance
      loadData();
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Deposit failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTransactionIcon = (type: string) => {
    if (type.includes('DEPOSIT') || type.includes('CREDIT') || type.includes('WIN')) {
      return <ArrowDownLeft className="h-4 w-4 text-success-500" />;
    }
    if (type.includes('WITHDRAWAL') || type.includes('FEE') || type.includes('BUY')) {
      return <ArrowUpRight className="h-4 w-4 text-danger-500" />;
    }
    return <Clock className="h-4 w-4 text-gray-400" />;
  };

  const formatTransactionType = (type: string) => {
    return type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  const balance = Number(user?.wallet?.balanceUsd || 0);
  const lockedBalance = Number(user?.wallet?.lockedBalance || 0);
  const availableBalance = balance - lockedBalance;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <WalletIcon className="h-6 w-6" />
        Wallet
      </h1>

      {/* Balance Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="card p-6">
          <p className="text-sm text-gray-400">Total Balance</p>
          <p className="text-3xl font-bold font-mono text-success-500">
            ${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="card p-6">
          <p className="text-sm text-gray-400">Available</p>
          <p className="text-3xl font-bold font-mono">
            ${availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="card p-6">
          <p className="text-sm text-gray-400">In Orders</p>
          <p className="text-3xl font-bold font-mono text-yellow-500">
            ${lockedBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4">
        <button onClick={() => setShowDeposit(true)} className="btn-success">
          <ArrowDownLeft className="h-4 w-4 mr-2" />
          Deposit
        </button>
        <button className="btn-secondary" disabled>
          <ArrowUpRight className="h-4 w-4 mr-2" />
          Withdraw (Coming Soon)
        </button>
      </div>

      {/* Deposit Modal */}
      {showDeposit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Add Funds</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Amount (USD)</label>
                <input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder="100"
                  min="1"
                  className="input"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Method</label>
                <select
                  value={selectedMethod}
                  onChange={(e) => setSelectedMethod(e.target.value)}
                  className="input"
                >
                  {depositMethods.map((method) => (
                    <option key={method.id} value={method.id}>
                      {method.name}
                      {method.feePercentage > 0 && ` (${method.feePercentage * 100}% fee)`}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-gray-700/50 rounded-lg p-3 text-sm">
                <p className="text-gray-400">
                  This is a demo environment. Deposits are instant and use demo credits.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeposit(false)}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeposit}
                  disabled={isSubmitting || !depositAmount}
                  className="btn-success flex-1"
                >
                  {isSubmitting ? 'Processing...' : 'Deposit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Transaction History */}
      <div className="card p-6">
        <h2 className="font-semibold mb-4">Transaction History</h2>

        {transactions.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No transactions yet</p>
        ) : (
          <div className="space-y-3">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="flex items-center justify-between py-3 border-b border-gray-700 last:border-0"
              >
                <div className="flex items-center gap-3">
                  {getTransactionIcon(tx.type)}
                  <div>
                    <p className="font-medium">{formatTransactionType(tx.type)}</p>
                    <p className="text-xs text-gray-500">
                      {formatDistanceToNow(new Date(tx.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p
                    className={`font-mono font-semibold ${
                      Number(tx.amount) >= 0 ? 'text-success-500' : 'text-danger-500'
                    }`}
                  >
                    {Number(tx.amount) >= 0 ? '+' : ''}${Number(tx.amount).toFixed(2)}
                  </p>
                  {Number(tx.fee) > 0 && (
                    <p className="text-xs text-gray-500">Fee: ${Number(tx.fee).toFixed(2)}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
