import type { LucideIcon } from "lucide-react";
import {
  Banknote,
  Coins,
  CircleDollarSign,
  BadgeDollarSign,
  Wallet,
  Building2,
  Landmark,
  CreditCard,
  Smartphone,
  Zap,
  Send,
  PiggyBank,
  Home,
  GraduationCap,
  Plane,
  TrendingUp,
  BarChart3,
  Gem,
  Trophy,
} from "lucide-react";

export const WALLET_ICONS: Record<string, LucideIcon> = {
  banknote: Banknote,
  coins: Coins,
  "circle-dollar-sign": CircleDollarSign,
  "badge-dollar-sign": BadgeDollarSign,
  wallet: Wallet,
  "building-2": Building2,
  landmark: Landmark,
  "credit-card": CreditCard,
  smartphone: Smartphone,
  zap: Zap,
  send: Send,
  "piggy-bank": PiggyBank,
  home: Home,
  "graduation-cap": GraduationCap,
  plane: Plane,
  "trending-up": TrendingUp,
  "bar-chart-3": BarChart3,
  gem: Gem,
  trophy: Trophy,
};

export const WALLET_ICONS_BY_TYPE: Record<string, string[]> = {
  cash: ["banknote", "coins", "circle-dollar-sign", "badge-dollar-sign", "wallet"],
  bank: ["building-2", "landmark", "credit-card"],
  ewallet: ["smartphone", "zap", "send"],
  savings: ["piggy-bank", "home", "graduation-cap", "plane"],
  investment: ["trending-up", "bar-chart-3", "gem", "trophy"],
};

export const DEFAULT_ICON_FOR_TYPE: Record<string, string> = {
  cash: "banknote",
  bank: "building-2",
  ewallet: "smartphone",
  savings: "piggy-bank",
  investment: "trending-up",
};

export function getWalletIcon(name: string): LucideIcon {
  return WALLET_ICONS[name] ?? Wallet;
}
