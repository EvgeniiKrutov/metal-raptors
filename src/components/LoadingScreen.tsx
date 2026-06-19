import React from 'react';

interface Props {
  label?: string;
}

const LoadingScreen: React.FC<Props> = ({ label = 'Connecting…' }) => (
  <div className="loading-overlay">
    <h1 className="start-title">METAL RAPTORS</h1>
    <p className="loading-status">{label}</p>
  </div>
);

export default LoadingScreen;
