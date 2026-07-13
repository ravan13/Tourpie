"use client";

import Image from "next/image";

export default function PageHeader({
  title,
  subtitle,
  imageUrl,
  badge,
}: {
  title: string;
  subtitle?: string;
  imageUrl?: string;
  badge?: string;
}) {
  return (
    <section className="relative overflow-hidden rounded-[2.5rem] border border-white/70 bg-white/78 shadow-[0_30px_80px_rgba(15,23,42,0.10)] backdrop-blur-xl">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(168,216,255,0.34),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(255,106,26,0.16),_transparent_24%),linear-gradient(135deg,_rgba(255,255,255,0.96),_rgba(244,248,255,0.84))]" />
      <div className="absolute -left-20 top-16 h-56 w-56 rounded-full bg-blue-200/40 blur-3xl" />
      <div className="absolute bottom-0 right-0 h-64 w-64 rounded-full bg-orange-200/30 blur-3xl" />
      <div className="relative grid gap-8 px-6 py-8 md:px-10 md:py-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)] lg:items-center lg:gap-10">
        <div className="relative z-[1]">
          {badge && (
            <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/70 px-4 py-2 text-xs font-black uppercase tracking-[0.3em] text-blue-900 shadow-[0_16px_40px_rgba(59,130,246,0.12)] backdrop-blur-md">
              <span className="h-2 w-2 rounded-full bg-blue-500" />
              {badge}
            </div>
          )}
          <h1 className="mt-6 max-w-4xl text-4xl font-black tracking-[-0.04em] text-slate-950 md:text-5xl lg:text-6xl leading-[0.94]">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-5 max-w-3xl text-base font-medium leading-7 text-slate-600 md:text-lg">
              {subtitle}
            </p>
          )}
        </div>
        {imageUrl ? (
          <div className="relative z-[1]">
            <div className="relative overflow-hidden rounded-[2rem] border border-white/80 bg-slate-200 shadow-[0_24px_64px_rgba(15,23,42,0.16)] aspect-[5/4] min-h-[260px]">
              <Image
                src={imageUrl}
                alt={title}
                fill
                className="object-cover"
                priority
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,15,35,0.04),rgba(8,15,35,0.28))]" />
              <div className="absolute inset-x-0 bottom-0 p-5">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-slate-950/45 px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.24em] text-white/90 backdrop-blur-md">
                  TourPie
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
