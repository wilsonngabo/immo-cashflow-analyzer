'use client';

import * as React from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';

type City = {
    nom: string;
    code: string;
    codesPostaux: string[];
    isDepartment?: boolean;
};

interface LocationSearchProps {
    onSelect: (city: City | City[]) => void;
    selectedCity?: City | null;
    selectedCities?: City[]; // For controlled multi mode
    multi?: boolean;
}

export function LocationSearch({ onSelect, selectedCity, selectedCities, multi = false }: LocationSearchProps) {
    const [open, setOpen] = React.useState(false);
    const [value, setValue] = React.useState('');
    const [query, setQuery] = React.useState('');
    const [results, setResults] = React.useState<City[]>([]);
    const [loading, setLoading] = React.useState(false);

    // Internal state for multi-select if uncontrolled (or synced)
    // For simpler usage, we'll assume the parent manages state if props are provided.

    // Search Effect - Fetch from local Internal API
    React.useEffect(() => {
        if (!query || query.length < 2) {
            setResults([]);
            return;
        }

        const fetchCities = async () => {
            setLoading(true);
            try {
                // Query our internal API 
                const response = await fetch(`/api/cities/search?q=${encodeURIComponent(query)}`);
                if (response.ok) {
                    const data = await response.json();
                    setResults(data);
                }
            } catch (error) {
                console.error('Failed to fetch cities:', error);
            } finally {
                setLoading(false);
            }
        };

        const timeoutId = setTimeout(fetchCities, 300);
        return () => clearTimeout(timeoutId);
    }, [query]);

    const handleSelect = (city: City) => {
        if (multi) {
            const current = selectedCities || [];
            if (!current.find(c => c.code === city.code)) {
                // Return new array
                onSelect([...current, city]);
            }
        } else {
            onSelect(city);
            setOpen(false);
        }
    };

    const handleRemove = (code: string) => {
        if (multi && selectedCities) {
            onSelect(selectedCities.filter(c => c.code !== code));
        }
    };

    return (
        <div className="space-y-2">
            {multi && selectedCities && selectedCities.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                    {selectedCities.map(city => (
                        <div key={city.code} className="bg-primary/10 text-primary text-xs px-2 py-1 rounded-full flex items-center gap-1">
                            {city.nom}
                            <div className="cursor-pointer hover:text-red-500" onClick={() => handleRemove(city.code)}>×</div>
                        </div>
                    ))}
                </div>
            )}

            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={open}
                        className="w-full justify-between overflow-hidden"
                    >
                        {!multi && selectedCity
                            ? `${selectedCity.nom} (${selectedCity.codesPostaux[0]})`
                            : (multi ? "Ajouter une ville ou département..." : "Rechercher...")}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>

                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                    <Command shouldFilter={false}>
                        <CommandInput
                            placeholder="Nom, Code postal (ex: 33)..."
                            value={query}
                            onValueChange={setQuery}
                        />
                        <CommandList>
                            {loading && <div className="py-6 text-center text-sm">Chargement...</div>}
                            {!loading && results.length === 0 && query.length >= 2 && (
                                <CommandEmpty>Aucune ville trouvée.</CommandEmpty>
                            )}
                            {!loading && results.length > 0 && (
                                <CommandGroup>
                                    {results.map((city) => (
                                        <CommandItem
                                            key={city.code}
                                            value={city.code}
                                            onSelect={() => handleSelect(city)}
                                            className={city.isDepartment ? "font-bold bg-slate-50" : ""}
                                        >
                                            <Check
                                                className={cn(
                                                    "mr-2 h-4 w-4",
                                                    (multi ? selectedCities?.find(c => c.code === city.code) : selectedCity?.code === city.code)
                                                        ? "opacity-100" : "opacity-0"
                                                )}
                                            />
                                            {city.nom} {!city.isDepartment && `(${city.codesPostaux[0]})`}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            )}
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    );
}
