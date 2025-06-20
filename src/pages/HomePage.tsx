import React from 'react';
import { Link } from 'react-router-dom';

const HomePage: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-100 flex flex-col justify-center items-center">
      <h1 className="text-4xl font-bold mb-4">Welcome to the Running App</h1>
      <p className="text-lg text-gray-600 mb-8">Track your runs, achieve your goals.</p>
      <div>
        <Link to="/login" className="bg-blue-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-600 transition-colors">
          Get Started
        </Link>
      </div>
    </div>
  );
};

export default HomePage; 