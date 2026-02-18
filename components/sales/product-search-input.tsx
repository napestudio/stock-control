"use client";

import { useState, useEffect, useRef } from "react";
import { searchProductsForSale } from "@/app/actions/sale-actions";
import type { ProductVariantSearchResult } from "@/types/sale";

interface ProductSearchInputProps {
  onSelect: (variantId: string, quantity: number) => void;
  disabled?: boolean;
}

export default function ProductSearchInput({
  onSelect,
  disabled = false,
}: ProductSearchInputProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ProductVariantSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout for 300ms
    timeoutRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const data = await searchProductsForSale(query, 10);
        setResults(data);
        setShowResults(true);
      } catch (error) {
        console.error("Error searching products:", error);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    // Cleanup
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [query]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setShowResults(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  function handleSelect(result: ProductVariantSearchResult) {
    onSelect(result.id, 1);
    setQuery("");
    setResults([]);
    setShowResults(false);
  }

  return (
    <div ref={wrapperRef} className="relative">
      <label
        htmlFor="product-search"
        className="block text-sm font-medium text-gray-700 mb-1"
      >
        Buscar Producto
      </label>
      <input
        id="product-search"
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => {
          if (results.length > 0) setShowResults(true);
        }}
        disabled={disabled}
        className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
        placeholder="Buscar por nombre o SKU..."
      />

      {isSearching && (
        <div className="mt-2 text-sm text-gray-500">Buscando...</div>
      )}

      {showResults && results.length > 0 && (
        <div className="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg mt-1 max-h-64 overflow-y-auto">
          {results.map((result) => (
            <button
              key={result.id}
              onClick={() => handleSelect(result)}
              className="w-full px-3 py-3 text-left hover:bg-gray-50 focus:bg-gray-50 focus:outline-none border-b border-gray-100 last:border-b-0"
              type="button"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">
                    {result.productName}
                  </p>
                  <p className="text-sm text-gray-600 truncate">
                    {result.displayName && `${result.displayName} • `}
                    SKU: {result.sku}
                  </p>
                </div>
                <div className="ml-4 text-right shrink-0">
                  <p className="font-bold text-gray-900">
                    ${result.price.toFixed(2)}
                  </p>
                  <p
                    className={`text-sm ${
                      result.stockQuantity > 0
                        ? result.stockQuantity <= 5
                          ? "text-yellow-600"
                          : "text-green-600"
                        : "text-red-600"
                    }`}
                  >
                    Stock: {result.stockQuantity}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {showResults &&
        results.length === 0 &&
        !isSearching &&
        query.length >= 2 && (
          <div className="absolute z-10 w-full bg-white border border-gray-300 rounded-md shadow-lg mt-1 px-3 py-4">
            <p className="text-sm text-gray-500 text-center">
              No se encontraron productos
            </p>
          </div>
        )}
    </div>
  );
}
