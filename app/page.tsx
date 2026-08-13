import { auth, signIn } from "@/auth";
import { HologramConstellation } from "@/components/animations/HologramConstellation";
import { PageLoader } from "@/components/animations/PageLoader";
import { ViewportHeightFix } from "@/components/animations/ViewportHeightFix";
import { HeroHeadline } from "@/components/app_componentes/HeroHeadline";
import { LabCard } from "@/components/app_componentes/LabCard";
import { LoginCard } from "@/components/app_componentes/loginCard";
import CurvedLoop from "@/components/CurvedLoop";
import { AuthError } from "next-auth";
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
  async function signInWithCredentials(
    username: string,
    password: string,
  ): Promise<{ error: string } | void> {
    "use server";
    try {
      await signIn("credentials", {
        username,
        password,
        redirectTo: "/dashboard",
      });
    } catch (error) {
      // A successful signIn() throws Next's internal redirect signal — let
      // that (and anything else that isn't an auth failure) propagate so the
      // redirect still happens. Only a genuine AuthError means the
      // credentials were rejected (unknown user, wrong password, non-admin
      // role, or no password hash provisioned for SSO-only accounts).
      if (error instanceof AuthError) {
        return { error: "Invalid username or password." };
      }
      throw error;
    }
  }

  return (
    <main className="itbd-login-bg grid min-h-dvh grid-rows-[1fr_auto] text-white xl:h-(--vh100,100dvh) xl:min-h-0 xl:overflow-hidden">
      <ViewportHeightFix />
      <PageLoader />
      {/* top row: fills all height left after the marquee footer. On mobile,
          tablet, and small laptops the cells stack in a single column and the
          page scrolls naturally; the fixed one-screen 6×6 placement only
          kicks in at xl+ (1280px), where there's actually enough width for
          the 4-column layout to fit without squeezing text. Padding lives
          here (not on <main>) so the marquee footer can sit flush against the
          very bottom of the screen. */}
      <div className="row-start-1 mx-auto w-full max-w-[1680px] p-6 xl:min-h-0 xl:overflow-hidden xl:p-10">
        {/* 3 row-bands: logo (auto) · upper hero region (3fr, taller) · lab
            cards (2fr, shorter) — matching the mockup's 3:2 upper-to-cards
            ratio. 4 columns: two for the left content, one gutter, one wide
            column for the login panel. */}
        {/* Fits ONE screen at xl+: logo band (auto) · hero band (3fr) · cards
            band (2fr). Everything inside shrinks to fit the fixed height.
            The outer wrapper caps at max-w-[1680px] and centers — without a
            cap, 1fr grid tracks fill the whole viewport width on large PC
            monitors while fixed rem/text sizes stay the same, so every card
            reads as oversized/sparse; capping width means extra space beyond
            the reference design width becomes side margin instead.
            Below xl there isn't room for the full 4-column split, but the
            login panel still runs alongside the content as its own column
            (not stacked below) from md up — only the hologram (least
            essential) and the lab-card/content split get dropped until xl. */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[1.4fr_1fr] xl:h-full xl:min-h-0 xl:grid-cols-[1fr_1fr_0.15fr_1.2fr] xl:grid-rows-[auto_minmax(0,3fr)_minmax(0,2fr)]">
          {/* logo — top-left */}
          <div className="content-center md:col-start-1 md:row-start-1 xl:row-start-1">
            <Image
              src="/itbd_logo_img.png"
              alt="ITBD Logo"
              width={200}
              height={76}
            />
          </div>
          {/* div 2 — hero headline (typewriter) — upper-left, taller band */}
          <div className="min-w-0 md:col-start-1 md:row-start-2 xl:row-start-2">
            <HeroHeadline className="h-full" />
          </div>
          {/* div 3 — 3D ITBD hologram constellation (large laptop/desktop only —
              dropped below xl so the hero/cards/login stack gets full width on
              tablets and small laptops instead of being squeezed) */}
          <div className="hidden xl:col-start-2 xl:row-start-2 xl:block">
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
              ballooning into empty space. Stacked vertically (flex-col) below
              xl — the content column is narrower there (md:1.4fr alongside
              the login panel), so side-by-side cards would squeeze; full-width
              stacked cards read better until there's room for the 4-column
              desktop split. */}
          <div className="flex flex-col items-stretch gap-4 md:col-start-1 md:row-start-3 xl:col-span-2 xl:col-start-1 xl:row-start-3 xl:flex-row xl:items-start">
            <LabCard
              icon="technical"
              title="Technical Lab"
              accent="blue"
              className="xl:flex-1"
            />
            <LabCard
              icon="communication"
              title="Communication Lab"
              accent="green"
              className="xl:flex-1"
            />
          </div>
          {/* login panel — right column, spans all row bands but the card
              itself stays content-sized and vertically centered (not stretched).
              Runs parallel to the content column from md up (not stacked
              below it), matching the desktop design at every width. */}
          <div className="min-w-0 md:col-start-2 md:row-span-3 md:row-start-1 xl:col-start-4">
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
