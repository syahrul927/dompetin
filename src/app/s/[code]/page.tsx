import Link from "next/link";
import { api } from "@/trpc/server";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatIDR } from "@/lib/formatIDR";

interface PublicSplitBillPageProps {
  params: Promise<{ code: string }>;
}

export default async function PublicSplitBillPage({ params }: PublicSplitBillPageProps) {
  const { code } = await params;

  let splitBill;
  try {
    splitBill = await api.splitBill.getByCode({ code });
  } catch (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center">
          <CardContent className="pt-6 space-y-4">
            <div className="text-6xl mb-4">📄</div>
            <h2 className="text-xl font-semibold">Tagihan tidak ditemukan</h2>
            <p className="text-muted-foreground">
              Link yang Anda kunjungi tidak valid atau tagihan telah dihapus.
            </p>
            <Link href="/">
              <Button variant="outline" className="w-full">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Kembali ke Beranda
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const subtotal = parseFloat(splitBill.subtotal);
  const tax = parseFloat(splitBill.tax);
  const discount = parseFloat(splitBill.discount);
  const total = parseFloat(splitBill.total);

  // Sort participants: owner first
  const sortedParticipants = [...splitBill.participants].sort((a, b) =>
    Number(b.isOwner) - Number(a.isOwner)
  );

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <div className="sticky top-0 bg-background border-b z-10">
        <div className="max-w-md mx-auto px-4 py-4 flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" asChild>
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1 flex items-center gap-2">
            <span className="text-xl">💳</span>
            <h1 className="text-xl font-semibold truncate">Dompetin</h1>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Bill Title Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">{splitBill.title}</CardTitle>
          </CardHeader>
        </Card>

        {/* Participants List */}
        <div className="space-y-4">
          {sortedParticipants.map((participant) => (
            <div
              key={participant.id}
              className={`rounded-lg border p-4 space-y-3 ${
                participant.isOwner ? "border-primary" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{participant.name}</h3>
                {participant.isOwner && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                    Pemilik
                  </span>
                )}
              </div>

              {/* Items */}
              {participant.items.length > 0 && (
                <div className="space-y-2 pl-2 border-l-2 border-border">
                  {participant.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {item.name} {item.qty > 1 ? `${item.qty}x` : ""}
                      </span>
                      <span>{formatIDR(item.subtotal)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Tax/Discount shares */}
              {parseFloat(participant.taxShare) > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>+Pajak</span>
                  <span>+{formatIDR(parseFloat(participant.taxShare))}</span>
                </div>
              )}

              {parseFloat(participant.discountShare) > 0 && (
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>-Diskon</span>
                  <span>-{formatIDR(parseFloat(participant.discountShare))}</span>
                </div>
              )}

              {/* Total */}
              <div className="border-t pt-3 flex justify-between font-bold">
                <span>Total</span>
                <span>{formatIDR(parseFloat(participant.total))}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Grand Total Summary */}
        <Card>
          <CardContent className="pt-6 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatIDR(subtotal)}</span>
            </div>
            {tax > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>+Pajak</span>
                <span>+{formatIDR(tax)}</span>
              </div>
            )}
            {discount > 0 && (
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>-Diskon</span>
                <span>-{formatIDR(discount)}</span>
              </div>
            )}
            <div className="border-t pt-2 flex justify-between font-bold text-lg">
              <span>Total</span>
              <span>{formatIDR(total)}</span>
            </div>
          </CardContent>
        </Card>

        {/* PWA Install Banner */}
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="pt-6 space-y-3">
            <div className="text-center space-y-2">
              <div className="text-4xl">💰</div>
              <h3 className="font-semibold text-lg">
                Kelola keuanganmu lebih mudah
              </h3>
              <p className="text-sm text-muted-foreground">
                Gunakan Dompetin untuk membagi tagihan, lacak pengeluaran, dan banyak lagi!
              </p>
            </div>
            <Link href="/" className="block">
              <Button className="w-full" size="lg">
                Buka Dompetin
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
