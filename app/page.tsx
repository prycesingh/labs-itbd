import { auth, signIn } from "@/auth";
import { PageLoader } from "@/components/animations/PageLoader";
import { HeroHeadline } from "@/components/app_componentes/HeroHeadline";
import { LabCard } from "@/components/app_componentes/LabCard";
import { LoginCard } from "@/components/app_componentes/loginCard";
import CurvedLoop from "@/components/CurvedLoop";
import Image from "next/image";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await auth();

  if (session?.user) {
    redirect("/dashboard");
  }

  async function signInWithMicrosoft() {
    "use server";
    await signIn("microsoft-entra-id", { redirectTo: "/dashboard" });
  }

  return (
    <main className="itbd-login-bg grid min-h-dvh grid-rows-[1fr_auto] text-white md:h-dvh md:min-h-0 md:overflow-hidden">
      <PageLoader />
      {/* top row: fills all height left after the marquee footer. On mobile the
          cells stack in a single column; the 6×6 placement kicks in at md+.
          Padding lives here (not on <main>) so the marquee footer can sit flush
          against the very bottom of the screen. */}
      <div className="row-start-1 min-h-0 p-10 md:overflow-hidden">
        {/* 3 row-bands: logo (auto) · upper hero region (3fr, taller) · lab
            cards (2fr, shorter) — matching the mockup's 3:2 upper-to-cards
            ratio. 4 columns: two for the left content, one gutter, one wide
            column for the login panel. */}
        <div className="grid h-full min-h-0 grid-cols-1 gap-4 md:grid-cols-[1fr_1fr_0.15fr_1.2fr] md:grid-rows-[auto_3fr_2fr]">
          {/* logo — top-left */}
          <div className="content-center md:col-start-1 md:row-start-1">
            <Image
              src="/itbd_logo_img.png"
              alt="ITBD Logo"
              width={200}
              height={200}
            />
          </div>
          {/* div 2 — hero headline (typewriter) — upper-left, taller band */}
          <div className="min-w-0 md:col-start-1 md:row-start-2">
            <HeroHeadline className="h-full" />
          </div>
          {/* div 3 — reserved for the hero illustration (empty placeholder) */}
          <div
            aria-hidden
            className="hidden rounded-2xl border border-dashed border-white/10 md:col-start-2 md:row-start-2 md:block"
          />
          {/* div 7 — Technical Lab card. Top-aligned in its band so the card
              stays content-height instead of stretching to fill the row. */}
          <div className="flex items-start md:col-start-1 md:row-start-3">
            <LabCard
              icon="technical"
              title="Technical Lab"
              description="Practice with 13+ industry-standard simulators including Azure, Microsoft 365, Active Directory and more."
              accent="blue"
            />
          </div>
          {/* div 8 — Communication Lab card */}
          <div className="flex items-start md:col-start-2 md:row-start-3">
            <LabCard
              icon="communication"
              title="Communication Lab"
              description="Enhance soft skills with real-world scenarios in Customer Centricity and Ticket Hygiene & Email Writing modules."
              accent="green"
            />
          </div>
          {/* login panel — right column, spans all row bands but the card
              itself stays content-sized and vertically centered (not stretched) */}
          <div className="md:col-start-4 md:row-span-3 md:row-start-1">
            <LoginCard signInAction={signInWithMicrosoft} />
          </div>
        </div>
      </div>
      {/* bottom row: marquee pinned to the bottom of the grid */}
      <footer className="row-start-2 w-full bg-black">
        <CurvedLoop
          marqueeText={[
            "Industry Focused Labs",
            "Real-world Simulations",
            "Skill Enhancement Journey",
            "Track, analyze, and improve your skills",
          ]
            // 3 non-breaking spaces + ✦ + 3 more give the separator wide,
            // non-collapsing breathing room. Repeat the phrase set so the
            // marquee tiles seamlessly across the full width.
            .join("   ✦   ")
            .concat("   ✦   ")
            .repeat(4)}
          speed={1}
          className="text-[0.8rem] uppercase font-light"
          curveAmount={0}
          direction="left"
          interactive={false}
        />
      </footer>
    </main>
  );
}
