"use client";

interface DashboardHeaderProps {
  title: string;
  subtitle?: string;
  userName?: string;
}

export default function DashboardHeader({
  title,
  subtitle,
}: DashboardHeaderProps) {
  return (
    <header className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {subtitle && <h2>{subtitle}</h2>}
      </div>
    </header>
  );
}
