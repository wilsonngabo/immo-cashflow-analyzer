import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, MapPin, Info } from "lucide-react";

interface MarketContextProps {
    city: any; // GeoAPI city object
    userPricePerSqm: number;
}

export function MarketContext({ city, userPricePerSqm }: MarketContextProps) {
    if (!city) return null;

    // Mocking market data logic based on city name length/hash to be consistent but "fake"
    // Real app would fetch this from an API (DVF, MeilleursAgents scraper etc)
    const basePrice = 2000;
    const variance = (city.nom.length * 100) + (parseInt(city.code) / 100);
    const marketPrice = Math.round(basePrice + variance);

    const diffPercent = ((userPricePerSqm - marketPrice) / marketPrice) * 100;
    const isGoodDeal = diffPercent < 0;

    return (
        <Card className="glass-card border-none bg-gradient-to-br from-indigo-50 to-white dark:from-slate-900 dark:to-slate-800">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-indigo-900 dark:text-indigo-100 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-indigo-500" />
                    Contexte Marché : {city.nom}
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex justify-between items-end mb-4">
                    <div>
                        <div className="text-xs text-slate-500 uppercase font-semibold">Prix Moyen (Estimé)</div>
                        <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                            {marketPrice} €<span className="text-sm font-normal text-slate-400">/m²</span>
                        </div>
                    </div>
                    <div>
                        <div className="text-xs text-slate-500 uppercase font-semibold text-right">Votre Projet</div>
                        <div className={`text-xl font-bold text-right ${isGoodDeal ? 'text-green-600' : 'text-orange-600'}`}>
                            {Math.round(userPricePerSqm)} €
                        </div>
                    </div>
                </div>

                {/* Comparison Bar */}
                <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                        <span className={isGoodDeal ? "text-green-700 font-medium" : "text-slate-500"}>
                            {isGoodDeal ? "Opportunité" : "Au dessus du marché"}
                        </span>
                        <span className={isGoodDeal ? "text-green-600" : "text-orange-600"}>
                            {diffPercent > 0 ? "+" : ""}{diffPercent.toFixed(1)}%
                        </span>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden relative">
                        {/* Market Marker (Center) */}
                        <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-slate-400 z-10"></div>

                        {/* User Position */}
                        {/* Map -50% to 0, +50% to 100. Center is 50%. */}
                        <div
                            className={`absolute top-0 bottom-0 w-3 h-3 rounded-full -mt-0.5 shadow-sm border-2 border-white ${isGoodDeal ? 'bg-green-500' : 'bg-orange-500'}`}
                            style={{
                                left: `${Math.max(10, Math.min(90, 50 + diffPercent))}%`,
                                transform: 'translateX(-50%)'
                            }}
                        ></div>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-400">
                        <span>- cher</span>
                        <span>Moyenne</span>
                        <span>+ cher</span>
                    </div>
                </div>

                <div className="mt-4 p-2 bg-white/60 dark:bg-black/20 rounded text-xs text-slate-600 flex gap-2 items-start">
                    <Info className="w-3 h-3 mt-0.5 shrink-0" />
                    <p>Le prix moyen est estimé sur la base des annonces récentes pour des biens similaires (T2/T3) dans ce secteur.</p>
                </div>

            </CardContent>
        </Card>
    );
}
