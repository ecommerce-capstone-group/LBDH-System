export const LBDH_CAREERS = {
  hospitalName: "Los Baños Doctors Hospital",
  tagline: "The Heart of Healing in Makiling",
  network: "Metro Pacific Health",
  phone: "(049) 536-1825 Local 8017",
  mobile: "0998-963-6538",
  email: "hr@lbdhmc.com.ph",
  website: "www.lbdh.net",
  facebook: "LBDH Careers",
  navy: "#0c1f4a",
  navyLight: "#1a3a7a",
  accent: "#5eb8e8",
} as const;

export function getPublicApplyUrl(jobId: number): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "") || "";
  if (typeof window !== "undefined") {
    return `${window.location.origin}${base}/apply/${jobId}`;
  }
  return `${base}/apply/${jobId}`;
}

export function getQrCodeImageUrl(applyUrl: string, size = 200): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(applyUrl)}`;
}
