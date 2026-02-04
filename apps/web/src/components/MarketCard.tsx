import { Link } from 'react-router-dom';
import { Clock, TrendingUp, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Outcome {
  id: string;
  name: string;
  currentPrice: number;
}

interface MarketCardProps {
  id: string;
  title: string;
  category: { name: string; slug: string };
  outcomes: Outcome[];
  expiresAt: string;
  totalVolume: number;
  status: string;
}

export default function MarketCard({
  id,
  title,
  category,
  outcomes,
  expiresAt,
  totalVolume,
  status,
}: MarketCardProps) {
  const isExpired = new Date(expiresAt) < new Date();
  const isBinary = outcomes.length === 2;

  return (
    <Link to={`/market/${id}`} className="card p-4 hover:border-gray-600 transition group">
      <div className="flex items-start justify-between gap-4 mb-3">
        <div>
          <span className="text-xs text-primary-400 font-medium">{category.name}</span>
          <h3 className="font-semibold text-gray-100 group-hover:text-primary-400 transition line-clamp-2 mt-1">
            {title}
          </h3>
        </div>
        {status !== 'OPEN' && (
          <span className="text-xs px-2 py-1 bg-gray-700 rounded text-gray-400">
            {status}
          </span>
        )}
      </div>

      {/* Outcomes */}
      <div className="space-y-2 mb-4">
        {isBinary ? (
          <div className="flex gap-2">
            {outcomes.map((outcome) => (
              <div
                key={outcome.id}
                className={`flex-1 p-2 rounded-lg text-center ${
                  outcome.name.toLowerCase() === 'yes'
                    ? 'bg-success-500/10 border border-success-500/30'
                    : 'bg-danger-500/10 border border-danger-500/30'
                }`}
              >
                <span className="text-xs text-gray-400">{outcome.name}</span>
                <p
                  className={`text-lg font-bold font-mono ${
                    outcome.name.toLowerCase() === 'yes' ? 'text-success-500' : 'text-danger-500'
                  }`}
                >
                  {(outcome.currentPrice * 100).toFixed(0)}%
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {outcomes.slice(0, 3).map((outcome) => (
              <div
                key={outcome.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-gray-400 truncate">{outcome.name}</span>
                <span className="font-mono text-gray-200">
                  {(outcome.currentPrice * 100).toFixed(0)}%
                </span>
              </div>
            ))}
            {outcomes.length > 3 && (
              <span className="text-xs text-gray-500">
                +{outcomes.length - 3} more
              </span>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-1">
          <TrendingUp className="h-3 w-3" />
          <span>${totalVolume.toLocaleString()}</span>
        </div>
        <div className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          <span>
            {isExpired
              ? 'Expired'
              : formatDistanceToNow(new Date(expiresAt), { addSuffix: true })}
          </span>
        </div>
      </div>
    </Link>
  );
}
