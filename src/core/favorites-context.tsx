import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import type { DataModelEntity } from "@/core/data-model/types";

interface FavoritesContextValue {
    favorites: DataModelEntity[];
    isFavorite: (id: string) => boolean;
    toggleFavorite: (entity: DataModelEntity) => void;
}

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
    const [favorites, setFavorites] = useState<DataModelEntity[]>([]);

    const isFavorite = useCallback((id: string) => favorites.some((e) => e.$id === id), [favorites]);

    const toggleFavorite = useCallback((entity: DataModelEntity) => {
        setFavorites((prev) => {
            const exists = prev.some((e) => e.$id === entity.$id);
            return exists ? prev.filter((e) => e.$id !== entity.$id) : [...prev, entity];
        });
    }, []);

    return (
        <FavoritesContext.Provider value={{ favorites, isFavorite, toggleFavorite }}>
            {children}
        </FavoritesContext.Provider>
    );
}

export function useFavorites(): FavoritesContextValue {
    const ctx = useContext(FavoritesContext);
    if (!ctx) throw new Error("useFavorites must be used within FavoritesProvider");
    return ctx;
}

