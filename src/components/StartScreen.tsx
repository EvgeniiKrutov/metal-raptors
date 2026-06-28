import React, { useState } from 'react';
import { getSections } from '../game/config/data/sections';
import { getSelectedPlaneId, setSelectedPlaneId } from '../game/utils/selectedPlane';
import PlaneSelector from './PlaneSelector';

interface Props {
  ready: boolean;
  completed: string[];
  username: string | null;
  onStart: (levelId: string) => void;
}

const StartScreen: React.FC<Props> = ({ ready, completed, username, onStart }) => {
  const sections = getSections();

  const [showSelector, setShowSelector] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [selectedPlaneId, setSelectedPlane] = useState(() => getSelectedPlaneId());

  if (showSelector) {
    return (
      <PlaneSelector
        selectedPlaneId={selectedPlaneId}
        onSelect={(id) => {
          setSelectedPlaneId(id);
          setSelectedPlane(id);
        }}
        onBack={() => setShowSelector(false)}
      />
    );
  }

  const activeSection = sections.find((section) => section.id === activeSectionId) ?? null;

  if (activeSection) {
    return (
      <div className="start-overlay">
        <button className="plane-selector-back" onClick={() => setActiveSectionId(null)}>
          ← Back
        </button>

        <h1 className="start-title">{activeSection.name}</h1>

        <div className="level-list">
          {activeSection.levels.map((level, index) => {
            const isDone = completed.includes(level.id);
            return (
              <button
                key={level.id}
                className="level-btn"
                onClick={() => onStart(level.id)}
                disabled={!ready}
              >
                <span className="level-index">{index + 1}</span>
                <span className="level-name">{level.name}</span>
                {isDone && <span className="level-badge">✓</span>}
              </button>
            );
          })}
        </div>

        <p className="start-status">{ready ? 'Select a level' : 'Loading…'}</p>
      </div>
    );
  }

  return (
    <div className="start-overlay">
      <h1 className="start-title">METAL RAPTORS</h1>

      <div className="level-list">
        {sections.map((section) => (
          <button
            key={section.id}
            className="level-btn"
            onClick={() => setActiveSectionId(section.id)}
            disabled={!ready}
          >
            <span className="level-name">{section.name}</span>
          </button>
        ))}
      </div>

      <button
        className="plane-select-entry"
        onClick={() => setShowSelector(true)}
        disabled={!ready}
      >
        <span className="plane-select-entry-label">Garage</span>
      </button>

      <p className="start-status">{ready ? 'Select a section' : 'Loading…'}</p>
      <p className="start-userid">Player: {username ?? 'none'}</p>
    </div>
  );
};

export default StartScreen;
