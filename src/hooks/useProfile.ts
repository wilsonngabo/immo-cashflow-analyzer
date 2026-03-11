import { useState, useEffect } from 'react';

export interface UserProfile {
    annualSalary: number;
    personalContribution: number;
    defaultLoanDuration: number;
    defaultInterestRate: number;
    targetYieldMin: number;
    targetCashflowMin: number;
    revenueN2: number;
    householdSize: number;
    maxDebtRatio: number; // Taux d'endettement max visé
}

const DEFAULT_PROFILE: UserProfile = {
    annualSalary: 0,
    personalContribution: 0,
    defaultLoanDuration: 25,
    defaultInterestRate: 3.8,
    targetYieldMin: 6,
    targetCashflowMin: 0,
    revenueN2: 0,
    householdSize: 1,
    maxDebtRatio: 35,
};

export function useProfile() {
    const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        const stored = localStorage.getItem('immo_cashflow_profile');
        if (stored) {
            try {
                const parsed = JSON.parse(stored);
                // Merge with DEFAULT_PROFILE to keep any new keys
                setProfile({ ...DEFAULT_PROFILE, ...parsed });
            } catch (e) {
                console.error("Failed to parse profile", e);
            }
        }
        setIsLoaded(true);
    }, []);

    const saveProfile = (newProfile: UserProfile) => {
        setProfile(newProfile);
        localStorage.setItem('immo_cashflow_profile', JSON.stringify(newProfile));
    };

    const updateProfile = (partial: Partial<UserProfile>) => {
        const newProfile = { ...profile, ...partial };
        saveProfile(newProfile);
    };

    return { profile, saveProfile, updateProfile, isLoaded };
}
