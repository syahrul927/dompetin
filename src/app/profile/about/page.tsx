"use client";

import { PageHeader } from "@/components/shared/PageHeader";
import { api } from "@/trpc/react";
import { Mail, MessageCircle, Instagram } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function AboutPage() {
  const { data: about, isLoading } = api.getAboutInfo.useQuery();

  const contacts = [
    {
      key: "email",
      label: "Email",
      value: about?.email,
      icon: Mail,
      href: about?.email ? `mailto:${about.email}` : undefined,
    },
    {
      key: "whatsapp",
      label: "WhatsApp",
      value: about?.whatsapp,
      icon: MessageCircle,
      href: about?.whatsapp
        ? `https://wa.me/${about.whatsapp.replace(/[^0-9]/g, "")}`
        : undefined,
    },
    {
      key: "instagram",
      label: "Instagram",
      value: about?.instagram,
      icon: Instagram,
      href: about?.instagram
        ? `https://instagram.com/${about.instagram.replace(/^@/, "")}`
        : undefined,
    },
  ];

  return (
    <>
      <PageHeader title="Tentang" variant="back" />
      <div className="px-5 pt-4">
        {/* App Info */}
        <div className="flex flex-col items-center gap-2 py-6">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <span className="text-2xl">💰</span>
          </div>
          <h2 className="text-lg font-bold text-foreground">Dompetin</h2>
          <p className="text-sm text-muted-foreground">
            Aplikasi manajemen keuangan pribadi
          </p>
        </div>

        {/* Contact */}
        <div className="mt-4">
          <p className="mb-3 px-1 text-xs font-medium text-muted-foreground">
            Hubungi Pengembang
          </p>
          <div className="space-y-1">
            {isLoading
              ? [1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 rounded-2xl" />
                ))
              : contacts
                  .filter((c) => c.value)
                  .map((contact) => (
                    <a
                      key={contact.key}
                      href={contact.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-4 rounded-2xl bg-card p-4 transition-colors active:bg-muted/50"
                    >
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <contact.icon size={20} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground">
                          {contact.label}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">
                          {contact.value}
                        </p>
                      </div>
                    </a>
                  ))}
          </div>
        </div>

        {/* Footer */}
        <p className="mt-8 text-center text-[11px] text-muted-foreground">
          Dibuat dengan hati di Indonesia
        </p>
      </div>
    </>
  );
}
