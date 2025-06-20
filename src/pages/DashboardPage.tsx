import React from 'react';
import Card from '../components/ui/Card';

const DashboardPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-3xl font-bold mb-6">Your Dashboard</h1>
      <Card>
        <h2 className="text-xl font-semibold">Welcome!</h2>
        <p>This is where your running data and training plans will appear.</p>
      </Card>
    </div>
  );
};

export default DashboardPage; 