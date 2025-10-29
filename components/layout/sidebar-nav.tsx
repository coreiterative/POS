"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  BarChart,
  Settings,
  BookOpen,
  ClipboardList,
  FileText,
} from "lucide-react";

import { useAuth } from "@/components/auth/auth-provider";
import { cn } from "@/lib/utils";
import {
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { Icons } from "@/components/icons";

const staffLinks = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/dashboard/pos", icon: ShoppingCart, label: "POS" },
  { href: "/dashboard/tables", icon: ClipboardList, label: "Tables" },
];

const adminLinks = [
  { href: "/dashboard/admin/menu", icon: BookOpen, label: "Menu" },
  { href: "/dashboard/admin/reports", icon: BarChart, label: "Sales Reports" },
  { href: "/dashboard/admin/order-reports", icon: FileText, label: "Order Reports" },
  // { href: "/dashboard/admin/staff", icon: Users, label: "Staff" },
  // { href: "/dashboard/admin/settings", icon: Settings, label: "Settings" },
];

export function SidebarNav() {
  const pathname = usePathname();
  const { userProfile, user } = useAuth();

  // Show admin links if user is admin OR if profile hasn't loaded yet (to avoid UI flicker)
  // You can change this to always show admin links for development: const isAdmin = true;
  const isAdmin = userProfile?.role === "Admin" || (user && !userProfile);

  const renderLinks = (links: typeof staffLinks) => {
    return links.map((link) => (
      <SidebarMenuItem key={link.href}>
        <SidebarMenuButton
          asChild
          isActive={pathname === link.href}
          tooltip={link.label}
        >
          <Link href={link.href}>
            <link.icon />
            <span>{link.label}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    ));
  };

  return (
    <>
      <SidebarHeader>
        <Link href="/dashboard" className="flex items-center gap-2">
          <Icons.logo className="size-8 shrink-0 text-primary" />
          <span className="font-headline text-xl font-bold text-primary">SmartDine</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {renderLinks(staffLinks)}
          {isAdmin && renderLinks(adminLinks)}
        </SidebarMenu>
      </SidebarContent>
    </>
  );
}
