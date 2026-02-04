import { Outlet } from 'react-router-dom';
import Header from './Header';

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-6">
        <Outlet />
      </main>
      <footer className="border-t border-gray-800 py-6">
        <div className="container mx-auto px-4 text-center text-gray-500 text-sm">
          <p>&copy; 2026 Prediction Market. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
