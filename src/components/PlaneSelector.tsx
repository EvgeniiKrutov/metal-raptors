import React, { useEffect, useState } from 'react';
import { EraId, getEras, getPlaneById, getPlanesByEra } from '../game/config/data/planes/index';
import { getMaxSpriteHeight } from '../game/utils/spriteMetrics';

interface Props {
  selectedPlaneId: string;
  onSelect: (id: string) => void;
  onBack: () => void;
}

const PlaneSelector: React.FC<Props> = ({ selectedPlaneId, onSelect, onBack }) => {
  const eras = getEras();
  const initialEra: EraId = getPlaneById(selectedPlaneId)?.era ?? 'world_war_1';

  const [eraId, setEraId] = useState<EraId>(initialEra);
  const [index, setIndex] = useState(() => {
    const initial = getPlanesByEra(initialEra).findIndex((plane) => plane.id === selectedPlaneId);
    return Math.max(0, initial);
  });
  const [frameHeight, setFrameHeight] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    getMaxSpriteHeight().then((height) => {
      if (active && height > 0) setFrameHeight(height);
    });
    return () => {
      active = false;
    };
  }, []);

  const planes = getPlanesByEra(eraId);
  const plane = planes[index];
  const hasPlanes = planes.length > 0;
  const isCurrent = plane?.id === selectedPlaneId;

  const step = (delta: number) => {
    if (!hasPlanes) return;
    setIndex((prev) => (prev + delta + planes.length) % planes.length);
  };

  const changeEra = (nextEra: EraId) => {
    setEraId(nextEra);
    const selectedIndex = getPlanesByEra(nextEra).findIndex((p) => p.id === selectedPlaneId);
    setIndex(selectedIndex >= 0 ? selectedIndex : 0);
  };

  const imageUrl = plane ? `${import.meta.env.BASE_URL}${plane.file}` : '';

  return (
    <div className="plane-selector">
      <button className="plane-selector-back" onClick={onBack}>
        ← Back
      </button>

      <select
        className="plane-era-select"
        value={eraId}
        onChange={(event) => changeEra(event.target.value as EraId)}
      >
        {eras.map((era) => (
          <option key={era.id} value={era.id}>
            {era.name}
          </option>
        ))}
      </select>

      <h2 className="plane-selector-name">{plane?.name ?? 'No planes yet'}</h2>

      <div className="plane-selector-body">
        <button
          className="plane-arrow plane-arrow-left"
          onClick={() => step(-1)}
          disabled={!hasPlanes}
          aria-label="Previous plane"
        >
          <svg className="plane-arrow-icon" viewBox="0 0 24 24" aria-hidden="true">
            <polyline points="15 5 8 12 15 19" />
          </svg>
        </button>

        <div className="plane-selector-stage">
          <div
            className="plane-image-frame"
            style={frameHeight ? { height: `${frameHeight}px` } : undefined}
          >
            {plane && <img className="plane-image" src={imageUrl} alt={plane.name} />}
          </div>

          <div className="plane-stats" aria-hidden="true" />
        </div>

        <button
          className="plane-arrow plane-arrow-right"
          onClick={() => step(1)}
          disabled={!hasPlanes}
          aria-label="Next plane"
        >
          <svg className="plane-arrow-icon" viewBox="0 0 24 24" aria-hidden="true">
            <polyline points="9 5 16 12 9 19" />
          </svg>
        </button>
      </div>

      <button
        className="plane-select-btn"
        onClick={() => plane && onSelect(plane.id)}
        disabled={!plane || isCurrent}
      >
        {isCurrent ? 'Selected' : 'Select'}
      </button>
    </div>
  );
};

export default PlaneSelector;
