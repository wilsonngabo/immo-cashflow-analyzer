'use client';

import { Card } from '@/components/ui/card';
import { Building2, Briefcase, Home, Landmark } from 'lucide-react';

interface FiscalModeSelectorProps {
    currentMode: string;
    onModeChange: (mode: string) => void;
}

export function FiscalModeSelector({ currentMode, onModeChange }: FiscalModeSelectorProps) {
    const modes = [
        { id: 'LMNP_MICRO', label: 'LMNP Micro', sub: 'Abattement 50%', icon: Home },
        { id: 'LMNP_REEL', label: 'LMNP Réel', sub: 'Amortissement', icon: Briefcase },
        { id: 'FONCIER_MICRO', label: 'Nu Micro', sub: 'Abattement 30%', icon: Building2 },
        { id: 'SCI_IS', label: 'SCI à l\'IS', sub: 'Impôt Société', icon: Landmark },
    ];

    return (
        <div className="grid grid-cols-2 gap-3 mb-4">
            {modes.map((mode) => {
                const isSelected = currentMode === mode.id;
                const Icon = mode.icon;

                return (
                    <div
                        key={mode.id}
                        onClick={() => onModeChange(mode.id)}
                        className={`cursor-pointer relative p-3 rounded-xl border transition-all duration-300 flex flex-col items-center text-center gap-2 group
                            ${isSelected
                                ? 'bg-primary/5 border-primary ring-1 ring-primary shadow-sm'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-slate-300 hover:shadow-sm'
                            }
                        `}
                    >
                        <div className={`p-2 rounded-full transition-colors ${isSelected ? 'bg-primary text-white' : 'bg-slate-100 text-slate-500 group-hover:bg-slate-200'}`}>
                            <Icon className="w-4 h-4" />
                        </div>
                        <div>
                            <div className={`text-xs font-bold ${isSelected ? 'text-primary' : 'text-slate-700'}`}>
                                {mode.label}
                            </div>
                            <div className="text-[9px] text-slate-400 font-medium">
                                {mode.sub}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
