'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useProfile } from '@/hooks/useProfile';
import { CalculatorForm } from '@/components/calculator/CalculatorForm';
import { FiscalModeSelector } from '@/components/calculator/FiscalModeSelector';
import { FinancialResultsDisplay } from '@/components/calculator/FinancialResultsDisplay';
import { UrlImporter } from '@/components/importer/UrlImporter';
import { ComparisonDashboard } from '@/components/calculator/ComparisonDashboard';
import { PropertyBrowser } from '@/components/properties/PropertyBrowser';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Building2, Wallet, Save, FileText, User, ArrowLeft, ExternalLink } from 'lucide-react';
import { FinancialProjectionChart } from '@/components/calculator/FinancialProjectionChart';
import { PrintReport } from '@/components/calculator/PrintReport';
import { SensitivityPanel } from '@/components/calculator/SensitivityPanel';
import { AmortizationTable } from '@/components/calculator/AmortizationTable';
import { calculateFinancials, calculateAllFiscalModes, calculateNotaryFees } from '@/lib/calculations/financials';
import { calculateInvestmentScore } from '@/lib/calculations/score';
import { InvestmentData, FinancialResults, SavedSimulation } from '@/lib/types';
import Link from 'next/link';
import { Suspense } from 'react';

const INITIAL_RESULTS: FinancialResults = {
  totalProjectCost: 0,
  monthlyMortgage: 0,
  monthlyCashFlowBrut: 0,
  monthlyCashFlowNet: 0,
  monthlyCashFlowNetNet: 0,
  yieldBrut: 0,
  yieldNet: 0,
  taxes: 0,
  debtRatio: 0
};

const DEFAULT_DATA: InvestmentData = {
  price: 150000,
  surface: 0,
  furniture: 2000,
  works: 0,
  notaryFees: 0,
  propertyType: 'OLD',
  loanAmount: 150000,
  personalContribution: 0,
  interestRate: 3.41,
  loanDuration: 25,
  insuranceRate: 0.34,
  monthlyRent: 800,
  propertyTax: 800,
  condoFees: 100,
  pnoInsurance: 150,
  managementFees: 0,
  vacancyMonth: 1,
  gliRate: 0,
  annualSalary: 0,
  includePTZ: false,
  includeActionLogement: false
};

function SimulateurContent() {
  const searchParams = useSearchParams();
  const { profile, isLoaded: profileLoaded } = useProfile();
  const [data, setData] = useState<InvestmentData>(DEFAULT_DATA);
  const [mode, setMode] = useState('LMNP_MICRO');
  const [rentMarket, setRentMarket] = useState<{
    median: number; count: number;
    colocPerRoom?: number | null; colocCount?: number; colocSource?: string | null;
    furnished?: { count: number; median: number } | null;
    unfurnished?: { count: number; median: number } | null;
  } | null>(null);
  const [results, setResults] = useState<FinancialResults>(INITIAL_RESULTS);
  const [allResults, setAllResults] = useState<Record<string, FinancialResults>>({});
  const [simulations, setSimulations] = useState<SavedSimulation[]>([]);
  const [activeView, setActiveView] = useState<'calculator' | 'browser'>('calculator');
  const [browserFilters, setBrowserFilters] = useState<Record<string, string> | null>(null);

  // Sync from URL: ?view=annonces&region=Normandie
  useEffect(() => {
    const view = searchParams.get('view');
    const region = searchParams.get('region');
    if (view === 'annonces') {
      setActiveView('browser');
      if (region) setBrowserFilters((prev) => ({ ...(prev || {}), region }));
    }
  }, [searchParams]);

  useEffect(() => {
    const newResults = calculateFinancials(data, mode);
    const multiResults = calculateAllFiscalModes(data);
    setResults(newResults);
    setAllResults(multiResults);
  }, [data, mode]);

  useEffect(() => {
    const savedSims = localStorage.getItem('immo-simulations');
    if (savedSims) {
      try {
        setSimulations(JSON.parse(savedSims));
      } catch (e) {
        console.error("Failed to parse saved simulations", e);
      }
    }

    if (profileLoaded) {
      const dbDefaults = { ...DEFAULT_DATA };
      dbDefaults.annualSalary = profile.annualSalary;
      dbDefaults.personalContribution = profile.personalContribution;
      dbDefaults.loanDuration = profile.defaultLoanDuration;
      dbDefaults.interestRate = profile.defaultInterestRate;
      dbDefaults.revenueN2 = profile.revenueN2;
      dbDefaults.householdSize = profile.householdSize;

      const savedDraft = localStorage.getItem('immo-draft');
      if (savedDraft) {
        try {
          const parsed = JSON.parse(savedDraft);
          setData({ ...dbDefaults, ...parsed });
        } catch (e) {
          console.error("Failed to parse saved draft", e);
          setData(dbDefaults);
        }
      } else {
        setData(dbDefaults);
      }
    }
  }, [profileLoaded, profile]);

  useEffect(() => {
    localStorage.setItem('immo-draft', JSON.stringify(data));
  }, [data]);

  useEffect(() => {
    if (simulations.length > 0) {
      localStorage.setItem('immo-simulations', JSON.stringify(simulations));
    }
  }, [simulations]);

  const handleImport = (importedData: Partial<InvestmentData>) => {
    let newData = { ...data, ...importedData };
    if (importedData.price != null && importedData.loanAmount === undefined) {
      newData.loanAmount = importedData.price;
    }
    if (newData.price > 0) {
      if (!importedData.monthlyRent) {
        const surface = newData.surface || 0;
        const pricePerSqm = surface > 0 ? newData.price / surface : 0;
        let yieldPct = 6;
        if (pricePerSqm > 0) {
          yieldPct = 10.5 - pricePerSqm / 1000;
          yieldPct = Math.max(3, Math.min(10, yieldPct));
        }
        newData.monthlyRent = Math.round((newData.price * (yieldPct / 100)) / 12);
      }
      if (newData.propertyType) {
        newData.notaryFees = calculateNotaryFees(newData.price, newData.propertyType, newData.reducedNotaryFees);
        const totalProject = newData.price + (newData.works || 0) + (newData.furniture || 0) + newData.notaryFees;
        newData.loanAmount = Math.max(0, totalProject - (newData.personalContribution || 0));
      }
    }
    setData(newData);
  };

  const handleSave = () => {
    const score = calculateInvestmentScore(results);
    const newSim: SavedSimulation = {
      id: Date.now().toString(),
      date: new Date().toISOString(),
      name: data.listingUrl ? `${data.price?.toLocaleString('fr-FR')} € (${data.surface}m²)` : `Projet ${simulations.length + 1}`,
      data: { ...data },
      results: { ...results },
      score
    };
    setSimulations([...simulations, newSim]);
  };

  const loadSimulation = (sim: SavedSimulation) => {
    setData(sim.data);
  };

  const deleteSimulation = (id: string) => {
    const updated = simulations.filter(s => s.id !== id);
    setSimulations(updated);
    if (updated.length === 0) {
      localStorage.removeItem('immo-simulations');
    }
  };

  return (
    <>
    <div className="min-h-screen bg-[#FDFCF9] dark:bg-[#141416] text-[#1a1a1a] dark:text-[#F5F3ED] pb-0 print:hidden flex flex-col">
        <header className="sticky top-0 z-20 px-8 py-5 flex items-center justify-between bg-[#FDFCF9]/90 dark:bg-[#141416]/90 backdrop-blur-xl transition-all duration-300">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-11 h-11 rounded-2xl bg-[#1a1a1a] dark:bg-[#F5F3ED] flex items-center justify-center group-hover:bg-[#2d2d2d] dark:group-hover:bg-white/95 transition-colors shadow-lg shadow-black/5">
                <Building2 className="h-5 w-5 text-[#FDFCF9] dark:text-[#1a1a1a]" />
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-[#1a1a1a] dark:text-[#F5F3ED]">Rendement Immo</h1>
                <p className="text-xs text-[#1a1a1a]/55 dark:text-[#F5F3ED]/55 mt-0.5 tracking-wide">Rentabilité & cashflow immobilier</p>
              </div>
            </Link>
          </div>
          <div className="flex gap-4 items-center">
            <nav className="flex rounded-2xl bg-black/5 dark:bg-white/5 p-1 gap-0.5">
              <button
                onClick={() => setActiveView('calculator')}
                className={`px-5 py-2.5 text-sm font-medium transition-all duration-300 rounded-xl ${activeView === 'calculator' ? 'bg-[#1a1a1a] dark:bg-[#F5F3ED] text-[#FDFCF9] dark:text-[#1a1a1a]' : 'text-[#1a1a1a]/65 dark:text-[#F5F3ED]/65 hover:text-[#1a1a1a] dark:hover:text-[#F5F3ED]'}`}
              >Calcul</button>
              <button
                onClick={() => setActiveView('browser')}
                className={`px-5 py-2.5 text-sm font-medium transition-all duration-300 rounded-xl ${activeView === 'browser' ? 'bg-[#1a1a1a] dark:bg-[#F5F3ED] text-[#FDFCF9] dark:text-[#1a1a1a]' : 'text-[#1a1a1a]/65 dark:text-[#F5F3ED]/65 hover:text-[#1a1a1a] dark:hover:text-[#F5F3ED]'}`}
              >Annonces</button>
            </nav>

            <Link href="/profile">
              <Button variant="outline" size="sm" className="gap-2 rounded-full border-black/15 dark:border-white/15 text-[#1a1a1a] dark:text-[#F5F3ED] hover:bg-black/5 dark:hover:bg-white/5 font-medium">
                <User className="w-4 h-4" /> Profil
              </Button>
            </Link>

            <Button variant="outline" size="sm" className="gap-2 rounded-full border-black/15 dark:border-white/15 text-[#1a1a1a] dark:text-[#F5F3ED] hover:bg-black/5 font-medium" onClick={() => window.print()}>
              <FileText className="w-4 h-4" /> Dossier PDF
            </Button>
            <span className="text-[10px] uppercase tracking-[0.2em] text-[#1a1a1a]/40 dark:text-[#F5F3ED]/40">Beta</span>
          </div>
        </header>

        <main className="flex-1 container mx-auto max-w-7xl pt-12 pb-20 px-4 sm:px-6 lg:px-8 overflow-auto">

          {activeView === 'browser' ? (
            <PropertyBrowser
              onAnalyze={(partial, options) => {
                handleImport(partial);
                if (options?.fiscalMode) setMode(options.fiscalMode);
                if (options?.rentMarketInfo !== undefined) setRentMarket(options.rentMarketInfo ?? null);
                setBrowserFilters(null);
                setActiveView('calculator');
              }}
              initialFilters={browserFilters}
            />
          ) : (
            <>
                <div className="flex justify-end mb-4">
                <Button variant="outline" size="sm" className="gap-2 rounded-full" onClick={() => setActiveView('browser')}>
                  <ArrowLeft className="w-4 h-4" /> Retour aux annonces
                </Button>
              </div>
              {(data.imageUrl || data.listingUrl) && (
                <div className="flex items-center gap-4 mb-4 p-4 rounded-2xl border border-black/5 dark:border-white/5 bg-white dark:bg-[#1c1c1e] shadow-sm">
                  {data.imageUrl && (
                    <img src={data.imageUrl} alt="Photo du bien" className="w-24 h-20 object-cover rounded-lg flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-500 mb-1">Annonce importée</p>
                    {data.listingUrl && (
                      <a href={data.listingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline truncate max-w-full">
                        <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="truncate">{data.listingUrl.replace(/^https?:\/\//, '')}</span>
                      </a>
                    )}
                    <p className="text-xs text-slate-400 mt-1">
                      {data.price ? `${data.price.toLocaleString('fr-FR')} €` : ''}
                      {data.surface ? ` · ${data.surface} m²` : ''}
                      {data.rooms ? ` · ${data.rooms} pièces` : ''}
                    </p>
                  </div>
                </div>
              )}

              <div className="mb-6">
                <UrlImporter onDataImported={handleImport} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 mb-12">
                <div className="lg:col-span-7 space-y-6">
                  <Card className="bg-white dark:bg-[#1c1c1e] border border-black/5 dark:border-white/5 rounded-3xl shadow-lg">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2"><Wallet className="w-5 h-5" /> Données Financières</CardTitle>
                      <CardDescription>Prix, Financement, fiscalité.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <CalculatorForm
                        data={data}
                        mode={mode}
                        onDataChange={setData}
                        onModeChange={setMode}
                        rentMarket={rentMarket}
                        onShowRentListings={(postalCode, surface) => {
                          const filters: Record<string, string> = { listingType: 'rent', postalCode };
                          if (surface && surface > 0) filters.minSurface = String(Math.round(surface * 0.6));
                          setBrowserFilters(filters);
                          setActiveView('browser');
                        }}
                      />
                    </CardContent>
                  </Card>
                </div>
                <div className="lg:col-span-5 space-y-6">
                  <div className="sticky top-24 space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-semibold text-slate-500 uppercase">Analyse Fiscale</h3>
                      <Button onClick={handleSave} size="sm" variant="outline" className="gap-2 h-9"><Save className="w-4 h-4" /> Sauvegarder</Button>
                    </div>
                    <FiscalModeSelector currentMode={mode} onModeChange={setMode} />
                    <FinancialResultsDisplay results={results} comparativeResults={allResults} currentMode={mode} />
                    <SensitivityPanel data={data} mode={mode} />
                  </div>
                </div>
              </div>

              <Separator className="my-8" />
              <div className="mb-8"><FinancialProjectionChart data={data} results={results} /></div>
              <div className="mb-12"><AmortizationTable data={data} results={results} /></div>
              <div className="mb-20">
                <ComparisonDashboard simulations={simulations} onLoad={loadSimulation} onDelete={deleteSimulation} />
              </div>
            </>
          )}

        </main>
      </div>
      <PrintReport data={data} results={results} />
    </>
  );
}

export default function SimulateurPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FDFCF9] dark:bg-[#141416] flex items-center justify-center"><div className="animate-pulse text-[#1a1a1a]/50">Chargement...</div></div>}>
      <SimulateurContent />
    </Suspense>
  );
}
