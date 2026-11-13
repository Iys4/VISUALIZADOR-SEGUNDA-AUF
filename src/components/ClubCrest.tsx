import React from 'react';
import { EquipoBase } from '../data/segunda2026Data';

interface SvgClubCrestProps {
  equipo: EquipoBase;
  x?: number;
  y?: number;
  size?: number;
}

/**
 * Renderiza el escudo oficial directamente dentro de un <svg> usando <image>
 */
export const SvgClubCrest: React.FC<SvgClubCrestProps> = ({
  equipo,
  x = 0,
  y = 0,
  size = 22,
}) => {
  return (
    <image
      href={equipo.escudoUrl}
      x={x}
      y={y}
      width={size}
      height={size}
      preserveAspectRatio="xMidYMid meet"
    />
  );
};

interface ClubCrestProps {
  equipo: EquipoBase;
  size?: number;
}

/**
 * Componente HTML del escudo oficial para usar en los botones de equipos
 */
export const ClubCrest: React.FC<ClubCrestProps> = ({ equipo, size = 22 }) => {
  return (
    <img
      src={equipo.escudoUrl}
      alt={`Escudo de ${equipo.nombre}`}
      width={size}
      height={size}
      referrerPolicy="no-referrer"
      className="shrink-0 object-contain select-none"
      style={{ width: size, height: size }}
    />
  );
};
