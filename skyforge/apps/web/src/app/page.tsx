"use client";
import { useState } from "react";

export default function LandingPage() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !role) return;
    setLoading(true);
    // TODO: Replace with Firestore / Sheets / email API call
    await new Promise((r) => setTimeout(r, 900));
    setSubmitted(true);
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white font-sans">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-white/10">
        <span className="text-lg font-semibold tracking-tight">Skyforge</span>
        <a href="#waitlist" className="text-sm px-4 py-2 rounded-lg border border-white/20 hover:bg-white/10 transition">
          Join waitlist
        </a>
      </nav>

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-6 pt-24 pb-16 text-center">
        <div className="inline-block text-xs font-medium px-3 py-1 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25 mb-6">
          Currently in private beta
        </div>
        <h1 className="text-5xl font-semibold leading-tight tracking-tight mb-6">
          From drone to deliverable<br />
          <span className="text-blue-400">in under 2 hours</span>
        </h1>
        <p className="text-lg text-white/60 max-w-xl mx-auto mb-10">
          Upload your drone photos. Skyforge processes them into orthomosaics, DSM, contours,
          and an AI-generated report — then delivers everything to your client via a shareable link.
        </p>
        <a
          href="#waitlist"
          className="inline-block bg-blue-600 hover:bg-blue-500 text-white font-semibold px-8 py-3.5 rounded-xl transition"
        >
          Get early access
        </a>
      </section>

      {/* How it works */}
      <section className="max-w-4xl mx-auto px-6 py-16">
        <h2 className="text-center text-sm font-medium text-white/40 uppercase tracking-widest mb-12">
          How it works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {[
            { step: "01", title: "Upload", desc: "Drag your JPGs from any device. Direct-to-cloud, zero bottleneck." },
            { step: "02", title: "Process", desc: "OpenDroneMap runs on GCP. Ortho, DSM, DTM, contours — all automatic." },
            { step: "03", title: "Analyse", desc: "Gemini AI scans outputs for anomalies, land cover, and key features." },
            { step: "04", title: "Deliver", desc: "Send your client a link. They view the map, download files, no login needed." },
          ].map((item) => (
            <div key={item.step} className="bg-white/5 rounded-2xl p-6 border border-white/10">
              <span className="text-xs font-mono text-blue-400 mb-3 block">{item.step}</span>
              <h3 className="font-semibold text-base mb-2">{item.title}</h3>
              <p className="text-sm text-white/50 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Outputs */}
      <section className="max-w-4xl mx-auto px-6 py-16 border-t border-white/10">
        <h2 className="text-center text-sm font-medium text-white/40 uppercase tracking-widest mb-12">
          What you get
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {[
            { label: "Orthomosaic", sub: "COG GeoTIFF, web-ready" },
            { label: "DSM / DTM", sub: "Elevation models" },
            { label: "Contour lines", sub: "GeoPackage, any interval" },
            { label: "Point cloud", sub: "LAZ format" },
            { label: "Volume report", sub: "Cut/fill, stockpiles" },
            { label: "AI report PDF", sub: "Gemini-generated" },
          ].map((o) => (
            <div key={o.label} className="flex items-start gap-3 bg-white/5 rounded-xl px-4 py-4 border border-white/10">
              <span className="mt-0.5 w-2 h-2 rounded-full bg-blue-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium">{o.label}</p>
                <p className="text-xs text-white/40">{o.sub}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="max-w-4xl mx-auto px-6 py-16 border-t border-white/10">
        <h2 className="text-center text-sm font-medium text-white/40 uppercase tracking-widest mb-12">
          Simple pricing
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { plan: "Starter", price: "Free", note: "1 project/month", features: ["Up to 200 photos", "Ortho + DSM", "7-day share links"], highlight: false },
            { plan: "Pro", price: "$99/mo", note: "10 projects/month", features: ["Up to 2,000 photos", "All outputs + AI report", "Unlimited share links"], highlight: true },
            { plan: "Agency", price: "$299/mo", note: "Unlimited projects", features: ["Unlimited photos", "White-label client portal", "Priority processing"], highlight: false },
          ].map((p) => (
            <div
              key={p.plan}
              className={`rounded-2xl p-6 border ${
                p.highlight
                  ? "border-blue-500/50 bg-blue-500/10"
                  : "border-white/10 bg-white/5"
              }`}
            >
              {p.highlight && (
                <span className="text-xs bg-blue-600 text-white font-semibold px-2 py-0.5 rounded-md mb-3 inline-block">
                  Most popular
                </span>
              )}
              <h3 className="font-semibold text-lg">{p.plan}</h3>
              <p className="text-3xl font-semibold mt-2 mb-1">{p.price}</p>
              <p className="text-xs text-white/40 mb-4">{p.note}</p>
              <ul className="space-y-2">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-white/70">
                    <span className="text-blue-400">+</span> {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Waitlist */}
      <section id="waitlist" className="max-w-lg mx-auto px-6 py-20 text-center">
        <h2 className="text-3xl font-semibold mb-3">Join the waitlist</h2>
        <p className="text-white/50 mb-8 text-sm">
          Early access users get 3 free projects and locked-in beta pricing.
        </p>

        {submitted ? (
          <div className="bg-blue-500/15 border border-blue-500/30 rounded-2xl px-6 py-8">
            <p className="text-blue-400 font-semibold text-lg mb-2">You&apos;re on the list</p>
            <p className="text-white/50 text-sm">We&apos;ll reach out to you at {email} when early access opens.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-3">
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 focus:outline-none focus:border-blue-500 transition"
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              required
              className="bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 transition"
            >
              <option value="" disabled>I am a...</option>
              <option value="drone_operator">Drone operator / pilot</option>
              <option value="surveyor">Land surveyor</option>
              <option value="civil_engineer">Civil engineer</option>
              <option value="gis_analyst">GIS analyst</option>
              <option value="construction">Construction / site manager</option>
              <option value="other">Other</option>
            </select>
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition"
            >
              {loading ? "Submitting..." : "Request early access"}
            </button>
          </form>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 px-8 py-6 text-center text-xs text-white/30">
        Skyforge — Drone data, delivered. — Built with FastAPI + GCP + Gemini
      </footer>
    </main>
  );
}
