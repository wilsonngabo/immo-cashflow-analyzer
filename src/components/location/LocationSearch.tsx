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
}

export function LocationSearch({ onSelect }: LocationSearchProps) {
    const [open, setOpen] = React.useState(false);
    const [value, setValue] = React.useState('');
    const [query, setQuery] = React.useState('');
    const [results, setResults] = React.useState<City[]>([]);
    const [loading, setLoading] = React.useState(false);

    React.useEffect(() => {
        if (!query || query.length < 3) {
            setResults([]);
            return;
        }

        const fetchCities = async () => {
            setLoading(true);
            try {
                const isZip = /^\d+$/.test(query);
                const url = isZip
                    ? `https://geo.api.gouv.fr/communes?codePostal=${query}&fields=nom,code,codesPostaux&format=json&geometry=centre`
                    : `https://geo.api.gouv.fr/communes?nom=${query}&fields=nom,code,codesPostaux&boost=population&limit=10`;

                const response = await fetch(url);
                const data = await response.json();
                setResults(data);
            } catch (error) {
                console.error('Failed to fetch cities:', error);
            } finally {
                setLoading(false);
            }
        };

        const timeoutId = setTimeout(fetchCities, 300);
        return () => clearTimeout(timeoutId);
    }, [query]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between"
                >
                    {value
                        ? results.find((city) => city.code === value)?.nom || value
                        : "Rechercher une ville..."}
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
