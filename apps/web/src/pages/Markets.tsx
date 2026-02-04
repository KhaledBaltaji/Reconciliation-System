import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { useMarketStore } from '../stores/market';
import MarketCard from '../components/MarketCard';

export default function MarketsPage() {
  const { category } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('search') || '');

  const { markets, fetchMarkets, isLoading, categories } = useMarketStore();

  useEffect(() => {
    fetchMarkets({ category, search: searchParams.get('search') || undefined });
  }, [category, searchParams, fetchMarkets]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search) {
      setSearchParams({ search });
    } else {
      setSearchParams({});
    }
  };

  const currentCategory = categories.find((c) => c.slug === category);

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">
            {currentCategory ? currentCategory.name : 'All Markets'}
          </h1>
          <p className="text-gray-400 text-sm">
            {markets.length} market{markets.length !== 1 ? 's' : ''} available
          </p>
        </div>

        {/* Search */}
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search markets..."
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

      {/* Markets Grid */}
      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="h-4 bg-gray-700 rounded w-1/4 mb-2"></div>
              <div className="h-6 bg-gray-700 rounded w-3/4 mb-4"></div>
              <div className="flex gap-2">
                <div className="flex-1 h-16 bg-gray-700 rounded"></div>
                <div className="flex-1 h-16 bg-gray-700 rounded"></div>
              </div>
            </div>
          ))}
        </div>
      ) : markets.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 text-lg">No markets found</p>
          <p className="text-gray-500 text-sm mt-2">
            Try adjusting your search or filters
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {markets.map((market) => (
            <MarketCard
              key={market.id}
              id={market.id}
              title={market.title}
              category={market.category}
              outcomes={market.outcomes}
              expiresAt={market.expiresAt}
              totalVolume={market.totalVolume}
              status={market.status}
            />
          ))}
        </div>
      )}
    </div>
  );
}
