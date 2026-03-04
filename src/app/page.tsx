'use client';

import { useState, useEffect } from 'react';
import { useProfile } from '@/hooks/useProfile';
import { LocationSearch } from '@/components/location/LocationSearch';
import { CalculatorForm } from '@/components/calculator/CalculatorForm';
import { FiscalModeSelector } from '@/components/calculator/FiscalModeSelector';
import { FinancialResultsDisplay } from '@/components/calculator/FinancialResultsDisplay';
import { UrlImporter } from '@/components/importer/UrlImporter';
import { ComparisonDashboard } from '@/components/calculator/ComparisonDashboard';
import { PropertyBrowser } from '@/components/properties/PropertyBrowser';
import { MarketContext } from '@/components/location/MarketContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Building2, TrendingUp, Wallet, Save, FileText, User, ArrowLeft } from 'lucide-react';
import { FinancialProjectionChart } from '@/components/calculator/FinancialProjectionChart';
import { PrintReport } from '@/components/calculator/PrintReport';
import { SensitivityPanel } from '@/components/calculator/SensitivityPanel';
import { AmortizationTable } from '@/components/calculator/AmortizationTable';
import { calculateFinancials, calculateAllFiscalModes, calculateNotaryFees } from '@/lib/calculations/financials';
import { calculateInvestmentScore } from '@/lib/calculations/score';
import { InvestmentData, FinancialResults, SavedSimulation } from '@/lib/types';
import Link from 'next/link';

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
  interestRate: 3.8,
  loanDuration: 20,
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

export default function Home() {
  const { profile, isLoaded: profileLoaded } = useProfile();
  const [selectedCity, setSelectedCity] = useState<any>(null);
  const [data, setData] = useState<InvestmentData>(DEFAULT_DATA);
  const [mode, setMode] = useState('LMNP_MICRO');
  const [results, setResults] = useState<FinancialResults>(INITIAL_RESULTS);
  const [allResults, setAllResults] = useState<Record<string, FinancialResults>>({});
  const [simulations, setSimulations] = useState<SavedSimulation[]>([]);
  const [activeView, setActiveView] = useState<'calculator' | 'browser'>('calculator');

  // Recalculate whenever data or mode changes
  useEffect(() => {
    const newResults = calculateFinancials(data, mode);
    const multiResults = calculateAllFiscalModes(data);
    setResults(newResults);
    setAllResults(multiResults);
  }, [data, mode]);

  // Load draft & simulations on mount
  useEffect(() => {
    // Load Simulations
    const savedSims = localStorage.getItem('immo-simulations');
    if (savedSims) {
      try {
        setSimulations(JSON.parse(savedSims));
      } catch (e) {
        console.error("Failed to parse saved simulations", e);
      }
    }

    // Load Draft and merge with profile defaults
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

  // Save drafts
  useEffect(() => {
    localStorage.setItem('immo-draft', JSON.stringify(data));
  }, [data]);

  // Save to LocalStorage whenever simulations change
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
    // Estimation dynamique : loyer mensuel, frais de notaire, prêt (quand on a prix/surface depuis un lien)
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
      name: selectedCity ? `${selectedCity.nom} (${data.surface}m²)` : `Projet ${simulations.length + 1}`,
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
      <div className="min-h-screen bg-[#DAD9D3] dark:bg-[#211D1D] text-[#211D1D] dark:text-[#DAD9D3] pb-0 print:hidden flex flex-col">
        {/* Header — style AVA SRG: minimal, deux tons */}
        <header className="sticky top-0 z-20 px-6 py-5 flex items-center justify-between bg-[#DAD9D3]/95 dark:bg-[#211D1D]/95 backdrop-blur-md border-b border-[#211D1D]/10 dark:border-[#DAD9D3]/10 transition-all duration-300">
          <div className="flex items-center gap-5">
            <div className="w-11 h-11 rounded-full bg-[#211D1D] dark:bg-[#DAD9D3] flex items-center justify-center">
              <Building2 className="h-5 w-5 text-[#DAD9D3] dark:text-[#211D1D]" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight text-[#211D1D] dark:text-[#DAD9D3]">ImmoCashFlow</h1>
              <p className="text-xs text-[#211D1D]/60 dark:text-[#DAD9D3]/60 mt-0.5">Rentabilité & cashflow immobilier</p>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <div className="flex rounded-full bg-[#211D1D]/5 dark:bg-[#DAD9D3]/5 p-1 gap-0.5">
              <button
                onClick={() => setActiveView('calculator')}
                className={`px-4 py-2 text-sm rounded-full font-medium transition-all duration-300 ${activeView === 'calculator' ? 'bg-[#211D1D] dark:bg-[#DAD9D3] text-[#DAD9D3] dark:text-[#211D1D]' : 'text-[#211D1D]/70 dark:text-[#DAD9D3]/70 hover:text-[#211D1D] dark:hover:text-[#DAD9D3]'}`}
              >Calculatrice</button>
              <button
                onClick={() => setActiveView('browser')}
                className={`px-4 py-2 text-sm rounded-full font-medium transition-all duration-300 ${activeView === 'browser' ? 'bg-[#211D1D] dark:bg-[#DAD9D3] text-[#DAD9D3] dark:text-[#211D1D]' : 'text-[#211D1D]/70 dark:text-[#DAD9D3]/70 hover:text-[#211D1D] dark:hover:text-[#DAD9D3]'}`}
              >Annonces</button>
            </div>

            <Link href="/profile">
              <Button variant="outline" size="sm" className="gap-2 rounded-full border-[#211D1D]/20 dark:border-[#DAD9D3]/20 text-[#211D1D] dark:text-[#DAD9D3] hover:bg-[#211D1D]/5 dark:hover:bg-[#DAD9D3]/5">
                <User className="w-4 h-4" /> Profil
              </Button>
            </Link>

            <Button variant="outline" size="sm" className="gap-2 rounded-full border-[#211D1D]/20 dark:border-[#DAD9D3]/20 text-[#211D1D] dark:text-[#DAD9D3] hover:bg-[#211D1D]/5" onClick={() => window.print()}>
              <FileText className="w-4 h-4" /> Dossier PDF
            </Button>
            <span className="text-[10px] uppercase tracking-wider text-[#211D1D]/50 dark:text-[#DAD9D3]/50 px-2">Beta</span>
          </div>
        </header>

        <main className="flex-1 container mx-auto max-w-7xl pt-12 pb-20 px-4 sm:px-6 lg:px-8 overflow-auto">

          {activeView === 'browser' ? (
            <PropertyBrowser
              onAnalyze={(partial, options) => {
                handleImport(partial);
                if (options?.fiscalMode) setMode(options.fiscalMode);
                setActiveView('calculator');
              }}
            />
          ) : (
            <>
              <div className="flex justify-end mb-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => setActiveView('browser')}
                >
                  <ArrowLeft className="w-4 h-4" /> Retour aux annonces
                </Button>
              </div>
              {/* Top Section: Location & Quick Stats */}
              <div className="grid gap-6 md:grid-cols-12 mb-8">
                <div className="md:col-span-8 lg:col-span-9">
                  <div className="space-y-4">
                    {/* Importer */}
                    <UrlImporter onDataImported={handleImport} />

                    <Card className="border-none shadow-md bg-white/50 backdrop-blur-sm">
                      <CardHeader className="pb-3">
                        <CardTitle>Localisation du bien</CardTitle>
                        <CardDescription>Recherchez la commune pour récupérer les indicateurs de marché.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <LocationSearch onSelect={(city) => setSelectedCity(city)} />
                        {selectedCity && (
                          <div className="mt-4 space-y-4">
                            <div className="p-4 bg-blue-50 text-blue-700 rounded-md border border-blue-100 text-sm">
                              📍 Sélectionné : <strong>{selectedCity.nom}</strong> ({selectedCity.codesPostaux[0]})
                            </div>

                            {/* Market Context Integration */}
                            {(data.surface > 0) ? (
                              <MarketContext
                                city={selectedCity}
                                userPricePerSqm={data.price / data.surface}
                                onApplyEstimates={(estimates) => {
                                  const newPrice = estimates.price * data.surface;
                                  const newRent = estimates.rent * data.surface;
                                  let newLoan = data.loanAmount;
                                  if (Math.abs(data.loanAmount - data.price) < 1000) {
                                    newLoan = newPrice;
                                  }

                                  setData({
                                    ...data,
                                    price: Math.round(newPrice),
                                    monthlyRent: Math.round(newRent),
                                    loanAmount: Math.round(newLoan)
                                  });
                                }}
                              />
                            ) : (
                              <div className="text-xs text-slate-400 italic">Renseignez la surface pour voir l'analyse du marché.</div>
                            )}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>

                <div className="md:col-span-4 lg:col-span-3">
                  <Card className="h-full bg-slate-900 text-white border-none shadow-xl">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Taux Moyen</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-3xl font-bold">3.85%</div>
                      <p className="text-sm text-slate-400">Sur 20 ans</p>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Main Content Area */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">

                {/* Left Column: Calculator Inputs */}
                <div className="lg:col-span-7 space-y-6">
                  <Card className="shadow-sm">
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
                      />
                    </CardContent>
                  </Card>
                </div>

                {/* Right Column: KPIs & Results */}
                <div className="lg:col-span-5 space-y-6">
                  <div className="sticky top-24 space-y-4">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-semibold text-slate-500 uppercase">Analyse Fiscale</h3>
                      <div className="flex gap-2">
                        <Button onClick={handleSave} size="sm" variant="outline" className="gap-2 h-9">
                          <Save className="w-4 h-4" /> Sauvegarder
                        </Button>
                      </div>
                    </div>

                    {/* Fiscal Selector */}
                    <FiscalModeSelector currentMode={mode} onModeChange={setMode} />

                    <FinancialResultsDisplay
                      results={results}
                      comparativeResults={allResults}
                      currentMode={mode}
                    />

                    {/* Sensitivity Analysis */}
                    <SensitivityPanel data={data} mode={mode} />
                  </div>
                </div>

              </div>

              <Separator className="my-8" />

              {/* Projections Chart */}
              <div className="mb-8">
                <FinancialProjectionChart data={data} results={results} />
              </div>

              {/* Amortization Table */}
              <div className="mb-12">
                <AmortizationTable data={data} results={results} />
              </div>

              {/* Bottom Section: Comparison */}
              <div className="mb-20">
                <ComparisonDashboard
                  simulations={simulations}
                  onLoad={loadSimulation}
                  onDelete={deleteSimulation}
                />
              </div>

            </>
          )}

        </main>
      </div >

      {/* Print Report */}
      < PrintReport data={data} results={results} city={selectedCity} />
    </>
  );
}
