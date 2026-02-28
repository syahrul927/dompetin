import { PageHeader } from "@/components/shared/PageHeader";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getSession } from "@/server/better-auth/server";
import { SectionHeader } from "@/components/shared/SectionHeader";
import { ChevronRight, Grid2X2, Target, Mail, Info } from "lucide-react";
import Link from "next/link";
import { ThemeToggle } from "@/components/profile/ThemeToggle";
import { LogoutButton } from "@/components/shared/LogoutButton";

/**
 * Profile page - basic implementation showing user info.
 */
export default async function ProfilePage() {
  const session = await getSession();
  const user = session?.user;

  if (!user) {
    return null;
  }

  const initials = user.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() ?? "??";

  return (
    <>
      <PageHeader title="Profil" />
      <div className="px-5 pt-2">
        {/* User Card */}
        <div className="mt-2 flex flex-col items-center gap-4 py-6">
          <Avatar className="h-20 w-20 bg-primary/10">
            <AvatarFallback className="text-xl font-bold text-primary">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="text-center">
            <h2 className="text-lg font-bold text-foreground">{user.name}</h2>
            <p className="mt-0.5 text-sm font-medium text-muted-foreground">{user.email}</p>
          </div>
        </div>

        {/* Appearance */}
        <div className="mt-6">
          <SectionHeader title="Tampilan" />
          <div className="mt-2 rounded-2xl bg-card p-4">
            <ThemeToggle />
          </div>
        </div>

        {/* Settings List */}
        <div className="mt-6">
          <SectionHeader title="Pengaturan Data" />
          <div className="mt-2 space-y-1">
            <Link
              href="/profile/categories"
              className="flex items-center gap-4 rounded-2xl bg-card p-4 transition-colors active:bg-muted/50"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Grid2X2 size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">Kategori</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Atur kategori pemasukan & pengeluaran</p>
              </div>
              <ChevronRight size={16} className="text-muted-foreground/50 flex-shrink-0" />
            </Link>

            <Link
              href="/goals"
              className="flex items-center gap-4 rounded-2xl bg-card p-4 transition-colors active:bg-muted/50"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Target size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">Tujuan Finansial</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Kelola target tabungan Anda</p>
              </div>
              <ChevronRight size={16} className="text-muted-foreground/50 flex-shrink-0" />
            </Link>
            <Link
              href="/profile/invitations"
              className="flex items-center gap-4 rounded-2xl bg-card p-4 transition-colors active:bg-muted/50"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Mail size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">Undangan Workspace</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Lihat dan kelola undangan masuk</p>
              </div>
              <ChevronRight size={16} className="text-muted-foreground/50 flex-shrink-0" />
            </Link>
          </div>
        </div>

        {/* Tentang */}
        <div className="mt-6">
          <SectionHeader title="Tentang" />
          <div className="mt-2 space-y-1">
            <Link
              href="/profile/about"
              className="flex items-center gap-4 rounded-2xl bg-card p-4 transition-colors active:bg-muted/50"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Info size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">Tentang Aplikasi</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">Informasi & kontak pengembang</p>
              </div>
              <ChevronRight size={16} className="text-muted-foreground/50 flex-shrink-0" />
            </Link>
          </div>
        </div>

        {/* Logout */}
        <div className="mt-6">
          <SectionHeader title="Akun" />
          <div className="mt-2">
            <LogoutButton />
          </div>
        </div>
      </div>
    </>
  );
}
