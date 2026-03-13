'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import franceMapData from '@svg-maps/france.regions';

interface Location {
  name: string;
  id: string;
  path: string;
}

const mapData = franceMapData as { label: string; viewBox: string; locations: Location[] };

export function FranceMap() {
  const router = useRouter();
  const [hovered, setHovered] = useState<string | null>(null);
  const handleRegionClick = useCallback((regionName: string) => {
    router.push(`/simulateur?view=annonces&region=${encodeURIComponent(regionName)}`);
  }, [router]);

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="text-center mb-6">
        <p className="text-[10px] uppercase tracking-[0.35em] text-[#1a1a1a]/50 dark:text-[#F5F3ED]/50 font-medium mb-1">
          Explorez par région
        </p>
        <p className="text-sm text-[#1a1a1a]/60 dark:text-[#F5F3ED]/60">
          Survolez et cliquez pour découvrir les annonces
        </p>
      </div>
      <div className="relative overflow-hidden rounded-[1.75rem] p-6 sm:p-8 bg-gradient-to-br from-[#faf8f4] via-[#f2efe8] to-[#ebe6dc] dark:from-[#1e1d1b] dark:via-[#161514] dark:to-[#121110] shadow-[0_4px_6px_-1px_rgba(0,0,0,0.04),0_20px_40px_-12px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.6)] dark:shadow-[0_4px_6px_-1px_rgba(0,0,0,0.2),0_20px_40px_-12px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.03)]">
        <div
          className="absolute inset-0 pointer-events-none rounded-[1.75rem]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`,
          }}
        />
        {/* Tooltip élégant */}
        <AnimatePresence>
          {hovered && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              transition={{ duration: 0.2 }}
              className="absolute top-6 left-1/2 -translate-x-1/2 z-10 pointer-events-none"
            >
              <div className="px-5 py-3 rounded-2xl shadow-lg border border-amber-500/25 bg-gradient-to-b from-[#2c2a26] to-[#1a1917] dark:from-[#2a2826] dark:to-[#1c1b19] dark:border-amber-400/20">
                <span className="text-white font-medium tracking-tight block">{hovered}</span>
                <span className="text-[11px] text-amber-200/90 dark:text-amber-300/80 tracking-wider uppercase mt-1 block">
                  Voir les annonces →
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.svg
          viewBox={mapData.viewBox}
          className="w-full h-auto touch-none relative z-[1] map-regions"
          aria-label="Carte interactive des régions de France"
          whileTap={{ scale: 0.99 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
        >
          <defs>
            <linearGradient id="map-region-default" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#e8e4de" />
              <stop offset="100%" stopColor="#ddd9d2" />
            </linearGradient>
            <linearGradient id="map-region-hover" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2c2a26" />
              <stop offset="100%" stopColor="#1a1917" />
            </linearGradient>
          </defs>
          {mapData.locations.map((loc) => {
            const isHovered = hovered === loc.name;
            return (
              <motion.path
                key={loc.id}
                d={loc.path}
                fill={isHovered ? 'url(#map-region-hover)' : 'url(#map-region-default)'}
                className="cursor-pointer select-none transition-all duration-300"
                initial={false}
                style={{
                  stroke: isHovered ? 'rgba(212, 175, 55, 0.45)' : 'rgba(0,0,0,0.06)',
                  strokeWidth: isHovered ? 2 : 0.8,
                }}
                onMouseEnter={() => setHovered(loc.name)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => handleRegionClick(loc.name)}
                onKeyDown={(e) => e.key === 'Enter' && handleRegionClick(loc.name)}
                tabIndex={0}
                role="button"
                aria-label={`Voir les annonces en ${loc.name}`}
              >
                <title>{loc.name} — Cliquez pour les annonces</title>
              </motion.path>
            );
          })}
        </motion.svg>
      </div>
    </div>
  );
}
