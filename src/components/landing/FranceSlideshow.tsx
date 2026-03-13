'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Images libres de droits (Unsplash) - appartements et locations de qualité
const RENTAL_APARTMENTS = [
  { src: 'https://images.unsplash.com/photo-1499955085172-a104c9463ece?w=1920&q=80', alt: 'Salon lumineux, loft', label: 'Paris' },
  { src: 'https://images.unsplash.com/photo-1738168251394-9241984c8292?w=1920&q=80', alt: 'Salon avec canapé et fenêtre', label: 'Lyon' },
  { src: 'https://images.unsplash.com/photo-1759735218086-67f9f853ab8b?w=1920&q=80', alt: 'Salon moderne', label: 'Bordeaux' },
  { src: 'https://images.unsplash.com/photo-1562368764-651b0bba96af?w=1920&q=80', alt: 'Intérieur cosy avec plantes', label: 'Marseille' },
  { src: 'https://images.unsplash.com/photo-1740512885236-4f648864efdc?w=1920&q=80', alt: 'Pièce lumineuse avec grande fenêtre', label: 'Nice' },
  { src: 'https://images.unsplash.com/photo-1665483057650-f43811d36187?w=1920&q=80', alt: 'Salon à manger élégant', label: 'Toulouse' },
  { src: 'https://images.unsplash.com/photo-1588764391142-b290ef02e220?w=1920&q=80', alt: 'Entrée avec fauteuil', label: 'Lille' },
  { src: 'https://images.unsplash.com/photo-1668512624275-0ee56aca4c1a?w=1920&q=80', alt: 'Chambre lumineuse', label: 'Nantes' },
];

const SLIDE_DURATION = 4500;

export function FranceSlideshow() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % RENTAL_APARTMENTS.length);
    }, SLIDE_DURATION);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="absolute inset-0 w-full h-full min-h-screen overflow-hidden z-0">
      {/* Overlay sombre pour lisibilité du texte (comme ogroup.com) */}
      <div className="absolute inset-0 bg-black/35 dark:bg-black/50 z-[1]" aria-hidden />
      
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2, ease: 'easeInOut' }}
          className="absolute inset-0"
        >
          {/* img natif pour éviter tout blocage Next.js Image sur domaines externes */}
          <img
            src={RENTAL_APARTMENTS[index].src}
            alt={RENTAL_APARTMENTS[index].alt}
            className="absolute inset-0 w-full h-full object-cover"
            loading="eager"
            fetchPriority="high"
          />
        </motion.div>
      </AnimatePresence>

      {/* Labels des lieux - animation discrète */}
      <motion.div
        key={`label-${index}`}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20"
      >
        <span className="text-white/80 text-sm font-medium tracking-[0.2em] uppercase">
          {RENTAL_APARTMENTS[index].label}
        </span>
      </motion.div>

      {/* Indicateurs */}
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 flex gap-2">
        {RENTAL_APARTMENTS.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
              i === index ? 'bg-white w-4' : 'bg-white/40 hover:bg-white/60'
            }`}
            aria-label={`Voir ${RENTAL_APARTMENTS[i].label}`}
          />
        ))}
      </div>
    </div>
  );
}
