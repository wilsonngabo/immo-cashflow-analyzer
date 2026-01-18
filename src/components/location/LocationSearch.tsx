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
};

interface LocationSearchProps {
    onSelect: (city: City) => void;
    selectedCity?: City | null; // New prop
}

export function LocationSearch({ onSelect, selectedCity }: LocationSearchProps) {
    const [open, setOpen] = React.useState(false);
    const [value, setValue] = React.useState('');
    const [query, setQuery] = React.useState('');
    const [results, setResults] = React.useState<City[]>([]);
    const [loading, setLoading] = React.useState(false);

    // Sync from parent
    React.useEffect(() => {
        if (selectedCity) {
            setValue(selectedCity.code);
            // We might want to pre-fill available results if we want to allow re-selection, 
            // but primarily we just want the display to be correct.
        }
    }, [selectedCity]);

    // ... search effect ...

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between"
                >
                    {selectedCity
                        ? `${selectedCity.nom} (${selectedCity.codesPostaux[0]})`
                        : (value
                            ? results.find((city) => city.code === value)?.nom || value
                            : "Rechercher une ville...")}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>

            </PopoverTrigger>
            <PopoverContent className="w-[400px] p-0" align="start">
                <Command shouldFilter={false}>
                    <CommandInput
                        placeholder="Nom de la ville ou code postal..."
                        value={query}
                        onValueChange={setQuery}
                    />
                    <CommandList>
                        {loading && <div className="py-6 text-center text-sm">Chargement...</div>}
                        {!loading && results.length === 0 && query.length >= 3 && (
                            <CommandEmpty>Aucune ville trouvée.</CommandEmpty>
                        )}
                        {!loading && results.length > 0 && (
                            <CommandGroup>
                                {results.map((city) => (
                                    <CommandItem
                                        key={city.code}
                                        value={city.code}
                                        onSelect={(currentValue) => {
                                            setValue(currentValue);
                                            setOpen(false);
                                            onSelect(city);
                                        }}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                value === city.code ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        {city.nom} ({city.codesPostaux[0]})
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
