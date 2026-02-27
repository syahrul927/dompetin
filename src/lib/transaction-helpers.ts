export function getWalletContext(
  type: string,
  wallet?: { name: string } | null,
  toWallet?: { name: string } | null
): string {
  if (type === "transfer") {
    if (wallet && toWallet) {
      return `${wallet.name} -> ${toWallet.name}`;
    }
    return "Transfer";
  }
  return wallet?.name || "Dompet";
}
