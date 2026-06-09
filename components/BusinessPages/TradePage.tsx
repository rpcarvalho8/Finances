'use client';

import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const mockPropFirmData = [
  { name: 'Jan', 'Firm A': 4000, 'Firm B': 2400, 'Firm C': 2900 },
  { name: 'Feb', 'Firm A': 3000, 'Firm B': 1398, 'Firm C': 2200 },
  { name: 'Mar', 'Firm A': 2000, 'Firm B': 9800, 'Firm C': 2290 },
  { name: 'Apr', 'Firm A': 2780, 'Firm B': 3908, 'Firm C': 2000 },
  { name: 'May', 'Firm A': 1890, 'Firm B': 4800, 'Firm C': 2181 },
  { name: 'Jun', 'Firm A': 2390, 'Firm B': 3800, 'Firm C': 2500 },
];

const mockRealAccountData = [
  { name: 'Jan', 'Account 1': 1500, 'Account 2': 1200, 'Account 3': 1800 },
  { name: 'Feb', 'Account 1': 1100, 'Account 2': 1000, 'Account 3': 1600 },
  { name: 'Mar', 'Account 1': 2000, 'Account 2': 950,  'Account 3': 2200 },
  { name: 'Apr', 'Account 1': 2780, 'Account 2': 3908, 'Account 3': 2600 },
  { name: 'May', 'Account 1': 1890, 'Account 2': 4800, 'Account 3': 2900 },
  { name: 'Jun', 'Account 1': 2390, 'Account 2': 3800, 'Account 3': 2200 },
];

const mockCryptoPerformance = [
  { name: 'Jan', btc: 4000, eth: 2400, total: 6400 },
  { name: 'Feb', btc: 3000, eth: 1398, total: 4398 },
  { name: 'Mar', btc: 2000, eth: 9800,  total: 11800 },
  { name: 'Apr', btc: 2780, eth: 3908, total: 6688 },
  { name: 'May', btc: 1890, eth: 4800, total: 6690 },
  { name: 'Jun', btc: 2390, eth: 3800, total: 6190 },
];

const mockForexPerformance = [
  { name: 'Jan', eur: 4000, gbp: 2400, total: 6400 },
  { name: 'Feb', eur: 3000, gbp: 1398, total: 4398 },
  { name: 'Mar', eur: 2000, gbp: 9800,  total: 11800 },
  { name: 'Apr', eur: 2780, gbp: 3908, total: 6688 },
  { name: 'May', eur: 1890, gbp: 4800, total: 6690 },
  { name: 'Jun', eur: 2390, gbp: 3800, total: 6190 },
];

const mockExecutiveData = [
  { name: 'Jan', roi: 5, winRate: 60, profitFactor: 1.5 },
  { name: 'Feb', roi: 3, winRate: 55, profitFactor: 1.2 },
  { name: 'Mar', roi: 8, winRate: 70, profitFactor: 2.0 },
  { name: 'Apr', roi: 6, winRate: 65, profitFactor: 1.8 },
  { name: 'May', roi: 4, winRate: 58, profitFactor: 1.3 },
  { name: 'Jun', roi: 7, winRate: 62, profitFactor: 1.6 },
];

export default function TradeDashboard() {
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h1 className="text-3xl font-bold text-gray-800 mb-6">Trade Dashboard</h1>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-sm font-medium text-gray-500">Forex Personal</h2>
          <p className="text-2xl font-bold text-gray-900 mt-2">$12,450.00</p>
          <p className="text-sm text-green-500 mt-1">+2.3% today</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-sm font-medium text-gray-500">Forex Prop Firm</h2>
          <p className="text-2xl font-bold text-gray-900 mt-2">$45,200.00</p>
          <p className="text-sm text-green-500 mt-1">+1.8% today</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-sm font-medium text-gray-500">Crypto Personal</h2>
          <p className="text-2xl font-bold text-gray-900 mt-2">$8,750.00</p>
          <p className="text-sm text-red-500 mt-1">-1.2% today</p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-sm font-medium text-gray-500">Crypto Prop Firm</h2>
          <p className="text-2xl font-bold text-gray-900 mt-2">$32,100.00</p>
          <p className="text-sm text-green-500 mt-1">+0.8% today</p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid gap-6 mb-8">
        {/* Prop Firms Performance */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Prop Firms Performance</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={mockPropFirmData}>
              <XAxis dataKey="name" tickLine={false} />
              <YAxis tickLine={false} />
              <Tooltip />
              <Legend verticalAlign="top" height={36} />
              <Line type="monotone" dataKey="Firm A" stroke="#FF6384" />
              <Line type="monotone" dataKey="Firm B" stroke="#36A2EB" />
              <Line type="monotone" dataKey="Firm C" stroke="#FFCE56" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Real Accounts Performance */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Real Accounts Performance</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={mockRealAccountData}>
              <XAxis dataKey="name" tickLine={false} />
              <YAxis tickLine={false} />
              <Tooltip />
              <Legend verticalAlign="top" height={36} />
              <Line type="monotone" dataKey="Account 1" stroke="#4BC0C0" />
              <Line type="monotone" dataKey="Account 2" stroke="#9966FF" />
              <Line type="monotone" dataKey="Account 3" stroke="#FF9F40" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Overall Crypto Performance */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Overall Crypto Performance</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={mockCryptoPerformance}>
              <XAxis dataKey="name" tickLine={false} />
              <YAxis tickLine={false} />
              <Tooltip />
              <Legend verticalAlign="top" height={36} />
              <Line type="monotone" dataKey="btc" stroke="#F2A65A" />
              <Line type="monotone" dataKey="eth" stroke="#9966FF" />
              <Line type="monotone" dataKey="total" stroke="#FF6384" isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Overall Forex Performance */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Overall Forex Performance</h2>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={mockForexPerformance}>
              <XAxis dataKey="name" tickLine={false} />
              <YAxis tickLine={false} />
              <Tooltip />
              <Legend verticalAlign="top" height={36} />
              <Line type="monotone" dataKey="eur" stroke="#36A2EB" />
              <Line type="monotone" dataKey="gbp" stroke="#FFCE56" />
              <Line type="monotone" dataKey="total" stroke="#4BC0C0" isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Executive Dashboard */}
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Executive Dashboard</h2>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={mockExecutiveData}>
            <XAxis dataKey="name" tickLine={false} />
            <YAxis tickLine={false} />
            <Tooltip />
            <Legend verticalAlign="top" height={36} />
            <Line type="monotone" dataKey="roi" stroke="#FF6384" dot={false} />
            <Line type="monotone" dataKey="winRate" stroke="#36A2EB" dot={false} />
            <Line type="monotone" dataKey="profitFactor" stroke="#4BC0C0" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}