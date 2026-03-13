'use client';

import { motion } from 'framer-motion';
import { useRef } from 'react';
import Link from 'next/link';
import { Building2, Calculator, FileText, Search, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FranceMap } from '@/components/landing/FranceMap';

const stats = [
  { value: '140k+', label: 'Annonces analysées' },
  { value: '18', label: 'Régions couvertes' },
  { value: '4', label: 'Régimes fiscaux' },
  { value: '100%', label: 'France' },
];

const features = [
  {
    icon: Calculator,
    title: 'Simulateur LMNP & SCI',
    description: 'Comparez LMNP Micro/Réel, Foncier, SCI à l\'IS. PTZ, Action Logement, cashflow net-net.',
  },
  {
    icon: Search,
    title: 'Base d\'annonces',
    description: 'LeBonCoin, Bienveo. Filtrez par région, prix, rendement. Importez une annonce en un clic.',
  },
  {
    icon: FileText,
    title: 'Dossier bancaire PDF',
    description: 'Exportez un dossier de présentation professionnel pour votre banquier.',
  },
];

export default function LandingPage() {
  const heroRef = useRef(null);
  const statsRef = useRef(null);
  const featuresRef = useRef(null);

  return (
    <div className="min-h-screen bg-[#FDFCF9] dark:bg-[#141416] text-[#1a1a1a] dark:text-[#F5F3ED] overflow-x-hidden">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 px-8 py-5 flex items-center justify-between bg-[#FDFBF7]/95 dark:bg-[#141416]/95 backdrop-blur-xl transition-all duration-300 border-b border-black/5 dark:border-white/5">
        <Link href="/" className="flex items-center gap-3 group">
          <div className="w-11 h-11 rounded-2xl bg-[#1a1a1a] dark:bg-[#F5F3ED] flex items-center justify-center">
            <Building2 className="h-5 w-5 text-[#FDFCF9] dark:text-[#1a1a1a]" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-[#1a1a1a] dark:text-[#F5F3ED]">Rendement Immo</h1>
            <p className="text-xs text-[#1a1a1a]/55 dark:text-[#F5F3ED]/55 tracking-wide">Rentabilité & cashflow immobilier</p>
          </div>
        </Link>
        <div className="flex gap-4 items-center">
          <Link href="/profile">
            <Button variant="ghost" size="sm" className="text-[#1a1a1a] dark:text-[#F5F3ED] hover:bg-black/5 dark:hover:bg-white/10">
              Profil
            </Button>
          </Link>
          <Link href="/simulateur">
            <Button className="bg-[#1a1a1a] dark:bg-[#F5F3ED] text-[#FDFCF9] dark:text-[#1a1a1a] hover:bg-[#2d2d2d] dark:hover:bg-white/90 rounded-full px-6 py-2.5 shadow-lg">
              Accéder au simulateur
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero — carte France plein écran */}
      <section ref={heroRef} className="relative min-h-screen overflow-hidden flex flex-col pt-20">
        <FranceMap fullScreen />
        {/* Scroll indicator — clic pour descendre */}
        <motion.button
          type="button"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          onClick={() => statsRef.current?.scrollIntoView({ behavior: 'smooth' })}
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 z-30 cursor-pointer hover:opacity-80 transition-opacity focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400/50 focus-visible:ring-offset-2 rounded-full p-2"
          aria-label="Descendre pour découvrir"
        >
          <span className="text-xs uppercase tracking-[0.3em] text-[#1a1a1a]/50">Découvrir</span>
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <ChevronDown className="w-6 h-6 text-[#1a1a1a]/50" />
          </motion.div>
        </motion.button>
      </section>

      {/* Stats - carte flottante style éditorial */}
      <section ref={statsRef} className="py-24 px-6 -mt-16 relative z-20 mx-6 rounded-3xl overflow-hidden shadow-xl shadow-black/5 dark:shadow-black/30">
        <div className="absolute inset-0 bg-gradient-to-b from-white to-[#faf8f4] dark:from-[#1c1c1e] dark:to-[#141416]" />
        <div className="absolute inset-0 border border-black/5 dark:border-white/5 rounded-3xl" />
        <div className="relative container max-w-6xl mx-auto py-24 px-6">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-[10px] uppercase tracking-[0.35em] text-amber-700/70 dark:text-amber-400/60 text-center mb-2"
          >
            Notre impact
          </motion.p>
          <motion.h3
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-2xl font-semibold text-center mb-16"
          >
            Nos chiffres
          </motion.h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <div className="text-3xl md:text-4xl font-semibold mb-1" >
                  {stat.value}
                </div>
                <div className="text-sm text-[#1a1a1a]/60 dark:text-[#F5F3ED]/60">{stat.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section ref={featuresRef} className="py-24 px-6">
        <div className="container max-w-6xl mx-auto">
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-[10px] uppercase tracking-[0.35em] text-amber-700/70 dark:text-amber-400/60 text-center mb-2"
          >
            Pourquoi nous choisir
          </motion.p>
          <motion.h3
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl font-semibold text-center mb-4"
          >
            Pourquoi Rendement Immo
          </motion.h3>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center text-[#1a1a1a]/65 dark:text-[#F5F3ED]/65 max-w-xl mx-auto mb-16"
          >
            L&apos;outil complet pour piloter vos projets immobiliers locatifs en France.
          </motion.p>
          <div className="grid md:grid-cols-3 gap-6">
            {features.map((feat, i) => (
              <motion.div
                key={feat.title}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                whileHover={{ y: -6, transition: { duration: 0.2 } }}
                className="p-8 rounded-3xl border border-black/5 dark:border-white/5 bg-white dark:bg-[#1c1c1e] hover:shadow-xl hover:shadow-black/5 dark:hover:shadow-black/20 hover:border-amber-200/30 dark:hover:border-amber-500/20 transition-all duration-300"
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/30 dark:to-amber-900/20 flex items-center justify-center mb-5 ring-1 ring-amber-200/20 dark:ring-amber-500/10">
                  <feat.icon className="w-6 h-6 text-[#1a1a1a] dark:text-[#F5F3ED]" />
                </div>
                <h4 className="text-lg font-semibold mb-2" >
                  {feat.title}
                </h4>
                <p className="text-[#1a1a1a]/65 dark:text-[#F5F3ED]/65 text-sm">{feat.description}</p>
              </motion.div>
            ))}
          </div>
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-center mt-16"
          >
            <Link href="/simulateur">
              <Button size="lg" className="bg-[#1a1a1a] dark:bg-[#F5F3ED] text-[#FDFCF9] dark:text-[#1a1a1a] hover:bg-[#2d2d2d] dark:hover:bg-white/90 rounded-full px-10 shadow-lg">
                Accéder au simulateur
              </Button>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Footer CTA */}
      <section className="py-24 px-6 bg-[#1a1a1a] dark:bg-[#0d0d0e] text-[#F5F3ED] rounded-t-[2.5rem]">
        <div className="container max-w-4xl mx-auto text-center">
          <motion.h3
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-2xl font-semibold mb-4"
          >
            Prêt à analyser votre premier projet ?
          </motion.h3>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="text-[#F5F3ED]/70 mb-8"
          >
            Simulateur gratuit. Aucune inscription requise.
          </motion.p>
          <Link href="/simulateur">
            <Button size="lg" className="bg-[#F5F3ED] text-[#1a1a1a] hover:bg-white rounded-full px-10 shadow-lg hover:scale-[1.02] transition-transform">
              Commencer
            </Button>
          </Link>
        </div>
      </section>

      <footer className="py-8 px-6 text-center text-xs text-[#1a1a1a]/50 dark:text-[#F5F3ED]/50">
        © {new Date().getFullYear()} Rendement Immo · Beta
      </footer>
    </div>
  );
}
