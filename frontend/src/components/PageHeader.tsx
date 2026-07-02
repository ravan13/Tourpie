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
    <section className="relative overflow-hidden rounded-[2.5rem] border border-gray-100 bg-white">
      <div className="absolute inset-0 bg-gradient-to-tr from-blue-900/80 via-blue-600/40 to-purple-500/25" />
      {imageUrl && (
        <Image
          src={imageUrl}
          alt={title}
          fill
          className="object-cover"
          priority
        />
      )}
      <div className="absolute inset-0 bg-black/30" />
      <div className="relative px-8 py-16 md:px-12 md:py-20 text-white">
        {badge && (
          <div className="inline-flex items-center gap-2 px-4 py-2 mb-6 text-xs font-black tracking-[0.3em] uppercase bg-white/15 backdrop-blur-md rounded-full border border-white/20">
            <span className="w-2 h-2 bg-blue-300 rounded-full" />
            {badge}
          </div>
        )}
        <h1 className="text-4xl md:text-6xl font-black tracking-tighter leading-[0.95] drop-shadow-xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-4 text-white/90 text-lg md:text-xl max-w-3xl font-medium leading-relaxed drop-shadow">
            {subtitle}
          </p>
        )}
      </div>
    </section>
  );
}
