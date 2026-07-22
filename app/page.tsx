import { auth, signIn } from "@/auth";
import { HologramConstellation } from "@/components/animations/HologramConstellation";
import { PageLoader } from "@/components/animations/PageLoader";
import { ViewportHeightFix } from "@/components/animations/ViewportHeightFix";
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

  // Break-glass admin credential login (bypasses SSO). Only succeeds for a user
  // whose `users` row has a bcrypt password hash provisioned via the admin
  // bootstrap script; SSO-only users can never authenticate here.
  async function signInWithCredentials(username: string, password: string) {
    "use server";
    await signIn("credentials", {
      username,
      password,
      redirectTo: "/dashboard",
    });
  }

  return (
    <main className="itbd-login-bg grid min-h-dvh grid-rows-[1fr_auto] text-white md:h-(--vh100,100dvh) md:min-h-0 md:overflow-hidden">
      <ViewportHeightFix />
      <PageLoader />
      {/* top row: fills all height left after the marquee footer. On mobile the
          cells stack in a single column; the 6×6 placement kicks in at md+.
          Padding lives here (not on <main>) so the marquee footer can sit flush
          against the very bottom of the screen. */}
      <div className="row-start-1 mx-auto min-h-0 w-full max-w-[1680px] p-6 md:overflow-hidden lg:p-10">
        {/* 3 row-bands: logo (auto) · upper hero region (3fr, taller) · lab
            cards (2fr, shorter) — matching the mockup's 3:2 upper-to-cards
            ratio. 4 columns: two for the left content, one gutter, one wide
            column for the login panel. */}
        {/* Fits ONE screen at md+: logo band (auto) · hero band (3fr) · cards
            band (2fr). Everything inside shrinks to fit the fixed height.
            The outer wrapper caps at max-w-[1680px] and centers — without a
            cap, 1fr grid tracks fill the whole viewport width on large PC
            monitors while fixed rem/text sizes stay the same, so every card
            reads as oversized/sparse; capping width means extra space beyond
            the reference design width becomes side margin instead. */}
        <div className="grid h-full min-h-0 grid-cols-1 gap-4 md:grid-cols-[1fr_1fr_0.15fr_1.2fr] md:grid-rows-[auto_minmax(0,3fr)_minmax(0,2fr)]">
          {/* logo — top-left */}
          <div className="content-center md:col-start-1 md:row-start-1">
            <Image
              src="/itbd_logo_img.png"
              alt="ITBD Logo"
              width={200}
              height={76}
            />
          </div>
          {/* div 2 — hero headline (typewriter) — upper-left, taller band */}
          <div className="min-w-0 md:col-start-1 md:row-start-2">
            <HeroHeadline className="h-full" />
          </div>
          {/* div 3 — 3D ITBD hologram constellation (desktop/laptop only) */}
          <div className="hidden md:col-start-2 md:row-start-2 md:block">
            <HologramConstellation />
          </div>
          {/* div 7+8 — Technical Lab + Communication Lab, combined into ONE
              grid cell spanning both content columns. A flex row inside with
              flex-1 on each card guarantees identical width AND height
              regardless of blurb length — sizing them via two separate grid
              columns let content length skew one track relative to the
              other; a single flex row can't.
              `items-start` stops the cards from stretching to fill the whole
              row band on tall/large-monitor viewports — they stay
              content-sized and sit at the top of the band instead of
              ballooning into empty space. */}
          <div className="flex items-start gap-4 md:col-span-2 md:col-start-1 md:row-start-3">
            <LabCard
              icon="technical"
              title="Technical Lab"
              description="Practice with 13+ industry-standard simulators including Azure, Microsoft 365, Active Directory and more."
              accent="blue"
              className="flex-1"
              href="/dashboard/labs"
            />
            <LabCard
              icon="communication"
              title="Communication Lab"
              description="Enhance soft skills with real-world scenarios in Customer Centricity and Ticket Hygiene & Email Writing modules."
              accent="green"
              className="flex-1"
            />
          </div>
          {/* login panel — right column, spans all row bands but the card
              itself stays content-sized and vertically centered (not stretched) */}
          <div className="md:col-start-4 md:row-span-3 md:row-start-1">
            <LoginCard
              signInAction={signInWithMicrosoft}
              onAdminSubmit={signInWithCredentials}
            />
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
            // non-collapsing breathing room. The trailing separator closes the
            // loop so the last phrase is followed by ✦ before the tile repeats.
            // CurvedLoop tiles this string internally to cover the path, so no
            // manual .repeat() is needed here.
            .join("   ✦   ")
            .concat("   ✦   ")}
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
