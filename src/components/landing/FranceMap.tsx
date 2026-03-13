'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import franceMapData from '@svg-maps/france.regions';

interface Location {
  name: string;
  id: string;
  path: string;
}

const mapData = franceMapData as { label: string; viewBox: string; locations: Location[] };

/** Images de fond par défaut — Wikimedia Commons (vérifiées, géolocalisées) */
const BG_IMAGES = [
  'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Tour_Eiffel_Wikimedia_Commons.jpg/1920px-Tour_Eiffel_Wikimedia_Commons.jpg',   // Paris
  'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/La_Manneporte-Etretat-Normandie.jpg/1920px-La_Manneporte-Etretat-Normandie.jpg', // Normandie
  'https://upload.wikimedia.org/wikipedia/commons/thumb/7/74/Marseille_Old_Port.jpg/1920px-Marseille_Old_Port.jpg',                         // Marseille
  'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Place_de_la_Bourse_%C3%A0_Bordeaux.jpg/1920px-Place_de_la_Bourse_%C3%A0_Bordeaux.jpg', // Bordeaux
  'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Pen%27Hir.jpg/1920px-Pen%27Hir.jpg',                                         // Bretagne
];

/** Images par région — Wikimedia Commons : photos vérifiées, géolocalisées, haute qualité */
const REGION_IMAGES: Record<string, string> = {
  'Île-de-France': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a8/Tour_Eiffel_Wikimedia_Commons.jpg/1920px-Tour_Eiffel_Wikimedia_Commons.jpg',   // Paris, Tour Eiffel (Featured)
  'Auvergne-Rhône-Alpes': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Lyon_Cath%C3%A9drale_Saint-Jean-Baptiste_Basilique_Notre_Dame_de_Fourvi%C3%A8re.jpg/1920px-Lyon_Cath%C3%A9drale_Saint-Jean-Baptiste_Basilique_Notre_Dame_de_Fourvi%C3%A8re.jpg', // Lyon, Fourvière
  "Provence-Alpes-Côte d'Azur": 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Nice_-_Promenade_des_Anglais_-_View_ESE.jpg/1920px-Nice_-_Promenade_des_Anglais_-_View_ESE.jpg', // Nice, Promenade des Anglais
  'Occitanie': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Cit%C3%A9_de_Carcassonne.jpg/1920px-Cit%C3%A9_de_Carcassonne.jpg', // Cité de Carcassonne
  'Nouvelle-Aquitaine': 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Place_de_la_Bourse_%C3%A0_Bordeaux.jpg/1920px-Place_de_la_Bourse_%C3%A0_Bordeaux.jpg', // Bordeaux Place de la Bourse
  'Bretagne': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e6/Pen%27Hir.jpg/1920px-Pen%27Hir.jpg',                               // Pointe de Pen-Hir (Featured)
  'Normandie': 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/30/La_Manneporte-Etretat-Normandie.jpg/1920px-La_Manneporte-Etretat-Normandie.jpg', // Étretat La Manneporte (Valued)
  'Pays de la Loire': 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f3/Ch%C3%A2teau_de_Chenonceau_02.jpg/1920px-Ch%C3%A2teau_de_Chenonceau_02.jpg', // Château de Chenonceau
  'Centre-Val de Loire': 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bd/Ch%C3%A2teau_de_Chambord_vu_du_canal.jpg/1920px-Ch%C3%A2teau_de_Chambord_vu_du_canal.jpg', // Chambord
  'Grand Est': 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e1/Cath%C3%A9drale_Notre-Dame_de_Strasbourg_ao%C3%BBt_2014.jpg/1920px-Cath%C3%A9drale_Notre-Dame_de_Strasbourg_ao%C3%BBt_2014.jpg', // Cathédrale Strasbourg
  'Hauts-de-France': 'https://upload.wikimedia.org/wikipedia/commons/thumb/2/2b/Grand_place%2C_Lille.jpg/1920px-Grand_place%2C_Lille.jpg',     // Lille Grand Place
  'Bourgogne-Franche-Comté': 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/7e/Chateau_Tanlay_facade_cour_grand_chateau.jpg/1920px-Chateau_Tanlay_facade_cour_grand_chateau.jpg', // Château de Tanlay, Yonne (Quality image)
  'Corse': 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/19/Bonifacio_1.jpg/1920px-Bonifacio_1.jpg',                             // Bonifacio, Haute ville
};

/** Direction de mouvement Ken Burns par région (selon position sur la carte) : pan subtil + scale */
const REGION_MOTION: Record<string, { x: number; y: number; scale: number }> = {
  'Île-de-France': { x: 2, y: -1, scale: 1.02 },
  'Auvergne-Rhône-Alpes': { x: -3, y: 2, scale: 1.03 },
  "Provence-Alpes-Côte d'Azur": { x: 2, y: -2, scale: 1.025 },
  'Occitanie': { x: -2, y: -3, scale: 1.03 },
  'Nouvelle-Aquitaine': { x: -4, y: 1, scale: 1.025 },
  'Bretagne': { x: 4, y: 0, scale: 1.02 },
  'Normandie': { x: 2, y: 3, scale: 1.025 },
  'Pays de la Loire': { x: -2, y: 1, scale: 1.02 },
  'Centre-Val de Loire': { x: 1, y: 0, scale: 1.015 },
  'Grand Est': { x: -5, y: 0, scale: 1.03 },
  'Hauts-de-France': { x: 0, y: 4, scale: 1.025 },
  'Bourgogne-Franche-Comté': { x: -3, y: 1, scale: 1.02 },
  'Corse': { x: -2, y: -2, scale: 1.03 },
};

interface FranceMapProps {
  fullScreen?: boolean;
}

export function FranceMap({ fullScreen = false }: FranceMapProps) {
  const router = useRouter();
  const [hovered, setHovered] = useState<string | null>(null);
  const [bgIndex, setBgIndex] = useState(0);

  useEffect(() => {
    if (!fullScreen) return;
    const t = setInterval(() => setBgIndex((i) => (i + 1) % BG_IMAGES.length), 5000);
    return () => clearInterval(t);
  }, [fullScreen]);

  const handleRegionClick = useCallback((regionName: string) => {
    router.push(`/simulateur?view=annonces&region=${encodeURIComponent(regionName)}`);
  }, [router]);

  return (
    <div className={fullScreen ? 'absolute inset-0 w-full min-h-screen z-0 overflow-hidden' : 'w-full max-w-2xl mx-auto'}>
      {/* Animated background images - très subtil */}
      {fullScreen && (
        <>
          {/* Couche 1 — fond initial, transition douce entre images */}
          <div className="absolute inset-0 z-0">
            <AnimatePresence mode="wait" initial={false}>
              <motion.img
                key={`bg-${bgIndex}`}
                src={BG_IMAGES[bgIndex]}
                alt=""
                className="absolute inset-0 w-full h-full object-cover"
                initial={{ opacity: 0, scale: 1.02 }}
                animate={{ opacity: 0.35, scale: 1 }}
                exit={{ opacity: 0, scale: 1.01 }}
                transition={{ duration: 1.2, ease: [0.4, 0, 0.2, 1] }}
              />
            </AnimatePresence>
          </div>
          {/* Couche 2 — image de la région au survol : transition directionnelle + Ken Burns selon la région */}
          <div className="absolute inset-0 z-[1] pointer-events-none overflow-hidden">
            <AnimatePresence mode="wait">
              {hovered && REGION_IMAGES[hovered] ? (
                <motion.div
                  key={`region-${hovered}`}
                  className="absolute inset-0"
                  initial={{ opacity: 0, scale: 0.98, x: (REGION_MOTION[hovered]?.x ?? 0) * -8, y: (REGION_MOTION[hovered]?.y ?? 0) * -8 }}
                  animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
                  exit={{ opacity: 0, scale: 0.99, transition: { duration: 0.35 } }}
                  transition={{ type: 'spring', stiffness: 120, damping: 24, mass: 0.8 }}
                >
                  <motion.img
                    src={REGION_IMAGES[hovered]}
                    alt=""
                    className="absolute inset-0 w-full h-full object-cover min-w-[110%] min-h-[110%] -translate-x-[5%] -translate-y-[5%]"
                    animate={{
                      x: ['-5%', `${-5 + (REGION_MOTION[hovered]?.x ?? 0) * 0.6}%`],
                      y: ['-5%', `${-5 + (REGION_MOTION[hovered]?.y ?? 0) * 0.6}%`],
                      scale: [REGION_MOTION[hovered]?.scale ?? 1.02, (REGION_MOTION[hovered]?.scale ?? 1.02) * 1.015],
                    }}
                    transition={{
                      duration: 20,
                      repeat: Infinity,
                      repeatType: 'reverse',
                      ease: 'easeInOut',
                    }}
                  />
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
          {/* Couche 3 — overlay crème ; léger au survol (image régionale visible), plus fort sinon */}
          <div
            className="absolute inset-0 z-[2] pointer-events-none transition-all duration-500"
            style={{
              background: hovered
                ? 'linear-gradient(to bottom, rgba(253,251,247,0.12) 0%, rgba(250,247,242,0.1) 50%, rgba(245,240,232,0.12) 100%)'
                : 'linear-gradient(to bottom, rgba(253,251,247,0.7) 0%, rgba(250,247,242,0.65) 50%, rgba(245,240,232,0.7) 100%)',
            }}
          />
        </>
      )}
      {!fullScreen && (
        <div className="absolute inset-0 bg-gradient-to-b from-[#FDFBF7] via-[#FAF7F2] to-[#F5F0E8]" />
      )}
      {/* Header — layout avec slot dédié pour le tooltip, pas de chevauchement */}
      <div className={fullScreen ? 'absolute top-0 left-0 right-0 z-20 pt-28 px-6 pb-2' : 'text-center mb-6'}>
        <div className="max-w-2xl mx-auto text-center">
          <p className={`font-medium ${fullScreen ? 'text-[10px] uppercase tracking-[0.4em] text-amber-700/80' : 'text-[10px] uppercase tracking-[0.35em] text-[#1a1a1a]/50 dark:text-[#F5F3ED]/50'}`}>
            {fullScreen ? 'Choisissez votre région' : 'Explorez par région'}
          </p>
          <p className={`mt-1 ${fullScreen ? 'text-base text-[#2d2a26]/70 font-light' : 'text-sm text-[#1a1a1a]/60 dark:text-[#F5F3ED]/60'}`}>
            {fullScreen ? 'Survolez et cliquez pour découvrir les annonces immobilières' : 'Survolez et cliquez pour découvrir les annonces'}
          </p>
          {fullScreen && (
            <>
              {/* Slot réservé : tooltip uniquement ici, jamais de chevauchement */}
              <div className="min-h-[72px] flex items-center justify-center mt-4 mb-3">
                <AnimatePresence mode="wait">
                  {hovered ? (
                    <motion.div
                      key={hovered}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.2 }}
                      className="px-6 py-3 rounded-2xl bg-white/90 border border-amber-400/30 shadow-lg shadow-black/5 backdrop-blur-sm"
                    >
                      <span className="font-semibold text-[#1a1a1a] block">{hovered}</span>
                      <span className="text-xs text-amber-700 tracking-[0.1em] uppercase mt-1 block">
                        Cliquez pour voir les annonces
                      </span>
                    </motion.div>
                  ) : (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-[#1a1a1a]/25 text-sm"
                    >
                      —
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
              <Link
                href="/simulateur?view=annonces"
                className="inline-block px-6 py-3 rounded-full text-sm font-medium text-white bg-[#1a1a1a] hover:bg-[#2d2d2d] shadow-lg shadow-black/10 transition-all duration-300"
              >
                Voir toutes les annonces
              </Link>
            </>
          )}
        </div>
      </div>
      <div
        className={
          fullScreen
            ? 'absolute inset-0 z-10 pt-72 pb-20 px-4 sm:px-8 md:px-16 flex items-center justify-center'
            : 'relative overflow-hidden rounded-[1.75rem] p-6 sm:p-8 bg-gradient-to-br from-[#faf8f4] via-[#f2efe8] to-[#ebe6dc] dark:from-[#1e1d1b] dark:via-[#161514] dark:to-[#121110] shadow-[0_4px_6px_-1px_rgba(0,0,0,0.04),0_20px_40px_-12px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.6)] dark:shadow-[0_4px_6px_-1px_rgba(0,0,0,0.2),0_20px_40px_-12px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.03)]'
        }
      >
        <div
          className="absolute inset-0 pointer-events-none rounded-[1.75rem]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`,
          }}
        />
        {!fullScreen && (
          <AnimatePresence>
            {hovered && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="absolute top-6 left-1/2 -translate-x-1/2 z-10 pointer-events-none px-6 py-4 rounded-3xl shadow-xl bg-gradient-to-b from-[#2a2722] to-[#1e1c18] border border-amber-500/30"
              >
                <span className="text-amber-50 font-semibold block">{hovered}</span>
                <span className="text-xs text-amber-300/90 tracking-[0.15em] uppercase mt-2 block">Voir les annonces →</span>
              </motion.div>
            )}
          </AnimatePresence>
        )}

        <motion.svg
          viewBox={mapData.viewBox}
          className={`w-full touch-none relative z-[1] map-regions ${fullScreen ? 'h-full max-h-[70vh]' : 'h-auto'}`}
          aria-label="Carte interactive des régions de France"
          animate={{ scale: hovered ? 1.02 : 1, y: hovered ? -2 : 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          whileTap={{ scale: 0.98 }}
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
            {/* Hero light: régions crème, bien visibles */}
            <linearGradient id="map-region-default-hero" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#e8e2d8" />
              <stop offset="100%" stopColor="#ddd6c9" />
            </linearGradient>
            {/* Hero light: hover — ambre chaud */}
            <linearGradient id="map-region-hover-hero" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#d4a84b" />
              <stop offset="100%" stopColor="#c49b3d" />
            </linearGradient>
          </defs>
          {mapData.locations.map((loc, i) => {
            const isHovered = hovered === loc.name;
            const fillUrl = fullScreen
              ? (isHovered ? 'url(#map-region-hover-hero)' : 'url(#map-region-default-hero)')
              : (isHovered ? 'url(#map-region-hover)' : 'url(#map-region-default)');
            return (
              <motion.path
                key={loc.id}
                d={loc.path}
                fill={fillUrl}
                className="cursor-pointer select-none"
                initial={fullScreen ? { opacity: 0 } : false}
                animate={{ opacity: 1, transition: { delay: fullScreen ? i * 0.02 : 0 } }}
                style={{
                  stroke: isHovered
                    ? 'rgba(139, 90, 43, 0.5)'
                    : fullScreen
                      ? 'rgba(0,0,0,0.12)'
                      : 'rgba(0,0,0,0.06)',
                  strokeWidth: isHovered ? 2 : 1,
                  transition: 'fill 0.3s ease, stroke 0.3s ease, stroke-width 0.3s ease',
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
