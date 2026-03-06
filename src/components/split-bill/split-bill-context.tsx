"use client";

import React, { createContext, useContext, useReducer, type ReactNode } from "react";
import { nanoid } from "nanoid";

// Types
export interface BillItem {
  id: string;
  name: string;
  qty: number;
  price: number;
}

export interface ParticipantAssignment {
  itemId: string;
  qty: number;
}

export interface Participant {
  id: string;
  name: string;
  isOwner: boolean;
  assignments: ParticipantAssignment[];
}

export interface SplitBillState {
  items: BillItem[];
  tax: number;
  discount: number;
  participants: Participant[];
}

// Actions
type Action =
  | { type: "ADD_ITEM" }
  | { type: "UPDATE_ITEM"; id: string; field: keyof Omit<BillItem, "id">; value: string | number }
  | { type: "REMOVE_ITEM"; id: string }
  | { type: "SET_TAX"; value: number }
  | { type: "SET_DISCOUNT"; value: number }
  | { type: "ADD_PARTICIPANT" }
  | { type: "REMOVE_PARTICIPANT"; id: string }
  | { type: "UPDATE_PARTICIPANT_NAME"; id: string; name: string }
  | { type: "SET_ASSIGNMENT"; participantId: string; itemId: string; qty: number }
  | { type: "SET_ITEMS_FROM_SCAN"; items: BillItem[]; tax: number; discount: number }
  | { type: "RESET" };

function createInitialState(): SplitBillState {
  return {
    items: [{ id: nanoid(), name: "", qty: 1, price: 0 }],
    tax: 0,
    discount: 0,
    participants: [
      { id: nanoid(), name: "Kamu", isOwner: true, assignments: [] },
    ],
  };
}

function reducer(state: SplitBillState, action: Action): SplitBillState {
  switch (action.type) {
    case "ADD_ITEM":
      return {
        ...state,
        items: [...state.items, { id: nanoid(), name: "", qty: 1, price: 0 }],
      };

    case "UPDATE_ITEM":
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.id ? { ...item, [action.field]: action.value } : item,
        ),
      };

    case "REMOVE_ITEM": {
      const newItems = state.items.filter((item) => item.id !== action.id);
      // Also remove assignments referencing this item
      const newParticipants = state.participants.map((p) => ({
        ...p,
        assignments: p.assignments.filter((a) => a.itemId !== action.id),
      }));
      return { ...state, items: newItems, participants: newParticipants };
    }

    case "SET_TAX":
      return { ...state, tax: action.value };

    case "SET_DISCOUNT":
      return { ...state, discount: action.value };

    case "ADD_PARTICIPANT":
      return {
        ...state,
        participants: [
          ...state.participants,
          { id: nanoid(), name: `Orang ${state.participants.length}`, isOwner: false, assignments: [] },
        ],
      };

    case "REMOVE_PARTICIPANT":
      return {
        ...state,
        participants: state.participants.filter(
          (p) => p.id !== action.id || p.isOwner,
        ),
      };

    case "UPDATE_PARTICIPANT_NAME":
      return {
        ...state,
        participants: state.participants.map((p) =>
          p.id === action.id ? { ...p, name: action.name } : p,
        ),
      };

    case "SET_ASSIGNMENT": {
      return {
        ...state,
        participants: state.participants.map((p) => {
          if (p.id !== action.participantId) return p;
          const existing = p.assignments.findIndex((a) => a.itemId === action.itemId);
          let newAssignments = [...p.assignments];
          if (action.qty <= 0) {
            newAssignments = newAssignments.filter((a) => a.itemId !== action.itemId);
          } else if (existing >= 0) {
            newAssignments[existing] = { itemId: action.itemId, qty: action.qty };
          } else {
            newAssignments.push({ itemId: action.itemId, qty: action.qty });
          }
          return { ...p, assignments: newAssignments };
        }),
      };
    }

    case "SET_ITEMS_FROM_SCAN":
      return {
        ...state,
        items: action.items,
        tax: action.tax,
        discount: action.discount,
      };

    case "RESET":
      return createInitialState();

    default:
      return state;
  }
}

// Computed helpers
export function getItemSubtotal(item: BillItem): number {
  return item.qty * item.price;
}

export function getGrandSubtotal(items: BillItem[]): number {
  return items.reduce((sum, item) => sum + getItemSubtotal(item), 0);
}

export function getFinalTotal(state: SplitBillState): number {
  return getGrandSubtotal(state.items) + state.tax - state.discount;
}

export function getParticipantShare(
  participant: Participant,
  state: SplitBillState,
): { itemsTotal: number; taxShare: number; discountShare: number; total: number } {
  let itemsTotal = 0;

  participant.assignments.forEach((assignment) => {
    const item = state.items.find((i) => i.id === assignment.itemId);
    if (!item) return;

    // Calculate total shares for this item across ALL participants
    const totalShares = state.participants.reduce((sum, p) => {
      const pAssignment = p.assignments.find((a) => a.itemId === item.id);
      return sum + (pAssignment?.qty || 0);
    }, 0);

    if (totalShares > 0) {
      const itemTotalPrice = item.qty * item.price;
      const pricePerShare = itemTotalPrice / totalShares;
      itemsTotal += assignment.qty * pricePerShare;
    }
  });

  const subtotal = getGrandSubtotal(state.items);
  const proportion = subtotal > 0 ? itemsTotal / subtotal : 0;

  const taxShare = Math.round(state.tax * proportion);
  const discountShare = Math.round(state.discount * proportion);
  const roundedItemsTotal = Math.round(itemsTotal);
  const total = roundedItemsTotal + taxShare - discountShare;

  return { itemsTotal: roundedItemsTotal, taxShare, discountShare, total };
}

export function hasUnassignedItems(state: SplitBillState): boolean {
  // An item is unassigned if NO participant has placed any shares on it.
  return state.items.some((item) => {
    const totalShares = state.participants.reduce((sum, p) => {
      const a = p.assignments.find((a) => a.itemId === item.id);
      return sum + (a?.qty ?? 0);
    }, 0);
    return totalShares === 0;
  });
}

// Context
interface SplitBillContextValue {
  state: SplitBillState;
  dispatch: React.Dispatch<Action>;
}

const SplitBillContext = createContext<SplitBillContextValue | null>(null);

export function SplitBillProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);

  return (
    <SplitBillContext.Provider value={{ state, dispatch }}>
      {children}
    </SplitBillContext.Provider>
  );
}

export function useSplitBill() {
  const ctx = useContext(SplitBillContext);
  if (!ctx) throw new Error("useSplitBill must be used within SplitBillProvider");
  return ctx;
}