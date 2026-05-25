import type { ReactNode } from "react";
import { LBDH_CAREERS } from "./lbdh-brand";
import { Mail, Phone, Globe, Facebook } from "lucide-react";

export function LbdhCareersShell({
  children,
  compactHeader = false,
}: {
  children: ReactNode;
  compactHeader?: boolean;
}) {
  return (
    <div className="min-h-screen bg-slate-100">
      {!compactHeader && (
        <div
          className="relative overflow-hidden text-white"
          style={{ background: `linear-gradient(135deg, ${LBDH_CAREERS.navy} 0%, ${LBDH_CAREERS.navyLight} 55%, #2d5a9e 100%)` }}
        >
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "radial-gradient(circle at 85% 15%, rgba(255,255,255,0.35) 0%, transparent 45%)",
            }}
          />
          <div className="relative max-w-3xl mx-auto px-4 py-10 text-center">
            <p className="text-xs uppercase tracking-[0.35em] text-sky-200/90 mb-2">
              {LBDH_CAREERS.network}
            </p>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
              {LBDH_CAREERS.hospitalName}
            </h1>
            <p className="mt-2 text-sky-100/90 italic text-lg font-light">
              {LBDH_CAREERS.tagline}
            </p>
          </div>
        </div>
      )}

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">{children}</div>

      <footer
        className="mt-4 text-white text-xs"
        style={{ backgroundColor: LBDH_CAREERS.navy }}
      >
        <div className="max-w-3xl mx-auto px-4 py-6 grid gap-4 md:grid-cols-3 items-center">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-white/10 flex items-center justify-center border border-white/20 shrink-0">
              <span className="text-lg font-black text-red-400">+</span>
            </div>
            <div>
              <p className="font-bold text-sm leading-tight">{LBDH_CAREERS.hospitalName}</p>
              <p className="text-[10px] uppercase tracking-wider text-sky-200/80 mt-0.5">
                {LBDH_CAREERS.network}
              </p>
            </div>
          </div>
          <p className="text-center italic text-sky-100/95 text-sm hidden md:block">
            {LBDH_CAREERS.tagline}
          </p>
          <ul className="space-y-1.5 md:text-right text-sky-50/90">
            <li className="flex items-center gap-2 md:justify-end">
              <Phone className="h-3 w-3 shrink-0" />
              {LBDH_CAREERS.phone}
            </li>
            <li className="flex items-center gap-2 md:justify-end">
              <Phone className="h-3 w-3 shrink-0" />
              {LBDH_CAREERS.mobile}
            </li>
            <li className="flex items-center gap-2 md:justify-end">
              <Mail className="h-3 w-3 shrink-0" />
              {LBDH_CAREERS.email}
            </li>
            <li className="flex items-center gap-2 md:justify-end">
              <Globe className="h-3 w-3 shrink-0" />
              {LBDH_CAREERS.website}
            </li>
            <li className="flex items-center gap-2 md:justify-end">
              <Facebook className="h-3 w-3 shrink-0" />
              {LBDH_CAREERS.facebook}
            </li>
          </ul>
        </div>
      </footer>
    </div>
  );
}
