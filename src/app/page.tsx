'use client';

import { useState, useEffect } from 'react';
import { LocationSearch } from '@/components/location/LocationSearch';
import { CalculatorForm } from '@/components/calculator/CalculatorForm';
import { FiscalModeSelector } from '@/components/calculator/FiscalModeSelector'; // NEW
import { FinancialResultsDisplay } from '@/components/calculator/FinancialResultsDisplay';
import { UrlImporter } from '@/components/importer/UrlImporter'; // NEW
import { ComparisonDashboard, SavedSimulation } from '@/components/calculator/ComparisonDashboard'; // NEW
import { MarketContext } from '@/components/location/MarketContext'; // NEW
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button'; // NEW
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator'; // NEW
import { Building2, TrendingUp, Wallet, Save } from 'lucide-react'; // NEW Icons
import { FinancialResults, InvestmentData } from '@/lib/types';
import { calculateFinancials, calculateAllFiscalModes } from '@/lib/calculations/financials'; // NEW import
import { calculateInvestmentScore } from '@/lib/calculations/score'; // NEW

const INITIAL_RESULTS: FinancialResults = {
  totalProjectCost: 0,
  monthlyMortgage: 0,
  monthlyCashFlowBrut: 0,
  monthlyCashFlowNet: 0,
  monthlyCashFlowNetNet: 0,
  yieldBrut: 0,
  yieldNet: 0,
  taxes: 0
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
  vacancyMonth: 1
};

export default function Home() {
  const [selectedCity, setSelectedCity] = useState<any>(null);
  const [data, setData] = useState<InvestmentData>(DEFAULT_DATA);
  const [mode, setMode] = useState('LMNP_MICRO');
  const [results, setResults] = useState<FinancialResults>(INITIAL_RESULTS);
  const [allResults, setAllResults] = useState<Record<string, FinancialResults>>({}); // NEW
  const [simulations, setSimulations] = useState<SavedSimulation[]>([]); // NEW

  // Recalculate whenever data or mode changes
  useEffect(() => {
    const newResults = calculateFinancials(data, mode);
    const multiResults = calculateAllFiscalModes(data); // NEW
    setResults(newResults);
    setAllResults(multiResults); // NEW
  }, [data, mode]);

  const handleImport = (importedData: Partial<InvestmentData>) => {
    // Merge imported data with existing, but recalculate defaults if needed
    // For simplified UX, we just override.
    // Logic: If price changes, maybe update loan amount too?
    const newData = { ...data, ...importedData };
    if (importedData.price) {
      // Auto-update loan amount to match price + works + furniture? 
      // Or just match price. Let's match Price + Works + Furniture + Notary(Auto)
      // Simplified: Match Price
      newData.loanAmount = importedData.price;
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
    // We might want to set selectedCity if we stored it? 
    // Current sim data doesn't store city object, just name implies it.
  };

  const deleteSimulation = (id: string) => {
    setSimulations(simulations.filter(s => s.id !== id));
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 pb-20">
      {/* Header */}
      <header className="border-b bg-white dark:bg-slate-900 sticky top-0 z-10 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <div className="bg-primary/10 p-2 rounded-lg">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">ImmoCashFlow</h1>
            <p className="text-xs text-slate-500 font-medium">Analyzes Rentabilité Immobilière</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Badge variant="outline" className="px-3 py-1">v0.1.0 Beta</Badge>
        </div>
      </header>

      <main className="container mx-auto max-w-7xl pt-8 px-4 sm:px-6 lg:px-8">

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
                      {(data.surface > 0 && data.price > 0) ? (
                        <MarketContext city={selectedCity} userPricePerSqm={data.price / data.surface} />
                      ) : (
                        <div className="text-xs text-slate-400 italic">Renseignez le prix et la surface pour voir l'analyse du marché.</div>
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
                <Button onClick={handleSave} size="sm" variant="outline" className="gap-2 h-8">
                  <Save className="w-3 h-3" /> Sauvegarder
                </Button>
              </div>

              {/* Fiscal Selector */}
              <FiscalModeSelector currentMode={mode} onModeChange={setMode} />

              <FinancialResultsDisplay
                results={results}
                comparativeResults={allResults} // NEW
                currentMode={mode} // NEW
              />
            </div>
          </div>

        </div>

        <Separator className="my-8" />

        {/* Bottom Section: Comparison */}
        <div className="mb-20">
          <ComparisonDashboard
            simulations={simulations}
            onLoad={loadSimulation}
            onDelete={deleteSimulation}
          />
        </div>

      </main>
    </div>
  );
}
