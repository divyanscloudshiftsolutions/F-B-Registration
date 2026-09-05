import React from 'react';

interface VegBadgeProps {
  type?: 'VEG' | 'NON_VEG' | 'EGG' | string | null;
  className?: string;
  size?: 'sm' | 'md';
}

export const VegBadge: React.FC<VegBadgeProps> = ({ type, className = '', size = 'md' }) => {
  if (!type) return null;
  const normType = type.toUpperCase();
  if (normType !== 'VEG' && normType !== 'NON_VEG' && normType !== 'EGG') {
    return null;
  }
  const isVeg = normType === 'VEG';
  const isEgg = normType === 'EGG';

  const borderColor = isVeg ? 'border-emerald-600' : isEgg ? 'border-amber-600' : 'border-rose-600';
  const dotColor = isVeg ? 'bg-emerald-600' : isEgg ? 'bg-amber-600' : 'bg-rose-600';
  const dimensions = size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  const dotSize = size === 'sm' ? 'w-1.5 h-1.5' : 'w-2 h-2';

  return (
    <div
      className={`inline-flex items-center justify-center border-2 ${borderColor} rounded-[3px] ${dimensions} ${className}`}
      title={isVeg ? 'Vegetarian' : isEgg ? 'Contains Egg' : 'Non-Vegetarian'}
    >
      <div className={`rounded-full ${dotColor} ${dotSize}`} />
    </div>
  );
};
