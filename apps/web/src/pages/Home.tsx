import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, Shield, Zap, ArrowRight } from 'lucide-react';
import { useMarketStore } from '../stores/market';
import MarketCard from '../components/MarketCard';

export default function HomePage() {
  const { featuredMarkets, fetchFeaturedMarkets, isLoading } = useMarketStore();

  useEffect(() => {
    fetchFeaturedMarkets();
  }, [fetchFeaturedMarkets]);

  return (
    <div className="space-y-12">
      {/* Hero Section */}
      <section className="text-center py-12">
        <h1 className="text-4xl md:text-5xl font-bold mb-4">
          Trade on{' '}
          <span className="text-primary-500">Future Events</span>
        </h1>
        <p className="text-xl text-gray-400 mb-8 max-w-2xl mx-auto">
          The first regulated prediction market in Lebanon. Trade on sports, politics,
          crypto, and more with real-time pricing.
        </p>
        <div className="flex items-center justify-center gap-4">
          <Link to="/markets" className="btn-primary text-lg px-6 py-3">
            Start Trading
          </Link>
          <Link to="/register" className="btn-secondary text-lg px-6 py-3">
            Create Account
          </Link>
        </div>
      </section>

      {/* Features */}
      <section className="grid md:grid-cols-3 gap-6">
        <div className="card p-6 text-center">
          <div className="w-12 h-12 bg-primary-500/20 rounded-lg flex items-center justify-center mx-auto mb-4">
            <TrendingUp className="h-6 w-6 text-primary-500" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Real-Time Trading</h3>
          <p className="text-gray-400 text-sm">
            Trade on live markets with real-time order book and price updates.
          </p>
        </div>
        <div className="card p-6 text-center">
          <div className="w-12 h-12 bg-success-500/20 rounded-lg flex items-center justify-center mx-auto mb-4">
            <Shield className="h-6 w-6 text-success-500" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Fully Regulated</h3>
          <p className="text-gray-400 text-sm">
            Licensed and regulated for secure, transparent trading.
          </p>
        </div>
        <div className="card p-6 text-center">
          <div className="w-12 h-12 bg-yellow-500/20 rounded-lg flex items-center justify-center mx-auto mb-4">
            <Zap className="h-6 w-6 text-yellow-500" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Instant Settlement</h3>
          <p className="text-gray-400 text-sm">
            Get paid instantly when markets resolve in your favor.
          </p>
        </div>
      </section>

      {/* Featured Markets */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Featured Markets</h2>
          <Link
            to="/markets"
            className="flex items-center gap-1 text-primary-400 hover:text-primary-300"
          >
            View All <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
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
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {featuredMarkets.map((market) => (
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
      </section>

      {/* CTA */}
      <section className="card p-8 text-center bg-gradient-to-r from-primary-900/50 to-primary-800/50">
        <h2 className="text-2xl font-bold mb-4">Ready to start trading?</h2>
        <p className="text-gray-400 mb-6">
          Create an account and get $10,000 in demo credits to practice.
        </p>
        <Link to="/register" className="btn-primary text-lg px-8 py-3">
          Get Started Free
        </Link>
      </section>
    </div>
  );
}
