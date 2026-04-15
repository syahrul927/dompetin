"use client";

import React, { createContext, useContext, useReducer, type ReactNode } from "react";

export interface ParsedTransaction {
  id: string;
  name: string;
  amount: number;
  date: string; // YYYY-MM-DD
  type: "income" | "expense";
  notes: string;
  walletId?: string;
  categoryId?: string;
}

interface ImportMutationState {
  transactions: ParsedTransaction[];
}

type ImportMutationAction =
  | { type: "SET_TRANSACTIONS"; transactions: ParsedTransaction[] }
  | { type: "UPDATE_TRANSACTION"; id: string; data: Partial<ParsedTransaction> }
  | { type: "REMOVE_TRANSACTION"; id: string };

const initialState: ImportMutationState = {
  transactions: [],
};

function importMutationReducer(
  state: ImportMutationState,
  action: ImportMutationAction,
): ImportMutationState {
  switch (action.type) {
    case "SET_TRANSACTIONS":
      return { transactions: action.transactions };
    case "UPDATE_TRANSACTION":
      return {
        transactions: state.transactions.map((t) =>
          t.id === action.id ? { ...t, ...action.data } : t,
        ),
      };
    case "REMOVE_TRANSACTION":
      return {
        transactions: state.transactions.filter((t) => t.id !== action.id),
      };
    default:
      return state;
  }
}

interface ImportMutationContextType {
  state: ImportMutationState;
  dispatch: React.Dispatch<ImportMutationAction>;
  /** Check if a transaction has all required fields for saving */
  isValid: (t: ParsedTransaction) => boolean;
  /** Check if ALL transactions are valid (for enabling the save button) */
  allValid: () => boolean;
}

const ImportMutationContext = createContext<ImportMutationContextType | null>(null);

export function ImportMutationProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(importMutationReducer, initialState);

  const isValid = (t: ParsedTransaction): boolean =>
    !!t.walletId && !!t.categoryId && t.amount > 0 && t.name.trim().length > 0;

  const allValid = (): boolean =>
    state.transactions.length > 0 && state.transactions.every(isValid);

  return (
    <ImportMutationContext.Provider value={{ state, dispatch, isValid, allValid }}>
      {children}
    </ImportMutationContext.Provider>
  );
}

export function useImportMutation() {
  const context = useContext(ImportMutationContext);
  if (!context) {
    throw new Error("useImportMutation must be used within ImportMutationProvider");
  }
  return context;
}
