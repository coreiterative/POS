
"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "@/components/auth/auth-provider";
import { SidebarProvider, Sidebar, SidebarInset } from "@/components/ui/sidebar";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { DashboardHeader } from "@/components/layout/header";
import { Icons } from "@/components/icons";

function DashboardLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Icons.spinner className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarNav />
      </Sidebar>
      <SidebarInset>
        <div className="flex flex-col h-full">
          <DashboardHeader />
          <main className="flex-1 p-4 md:p-8">{children}</main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}


export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </AuthProvider>
  );
}
