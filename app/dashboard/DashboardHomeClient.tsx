"use client";

import { HowItWorks } from "@/components/app_componentes/HowItWorks";
import { LabCard } from "@/components/app_componentes/LabCard";
import CountUp from "@/components/CountUp";
import { GraduationCap, Mail } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Image from "next/image";

// Kept in sync with app/dashboard/labs/simulators/page.tsx's SIMULATORS list
// (order + titles). Only the first 10 are featured here; the rest are behind
// "View all simulators".
const FEATURED_SIMULATORS = [
  {
    href: "/dashboard/labs/simulators/azure-vm",
    label: "Azure",
    iconSrc: "/labs-logos/Azure.png",
  },
  {
    href: "/dashboard/labs/simulators/adds",
    label: "Active Directory",
    iconSrc: "/labs-logos/Active Directory.png",
  },
  {
    href: "/dashboard/labs/simulators/m365",
    label: "Microsoft 365",
    iconSrc: "/labs-logos/M365.png",
  },
  {
    href: "/dashboard/labs/simulators/intune",
    label: "Intune",
    iconSrc: "/labs-logos/microsoft-intune.png",
  },
  {
    href: "/dashboard/labs/simulators/avd",
    label: "Azure Virtual Desktop",
    iconSrc: "/labs-logos/Azure Virtual Desktop_512x512.png",
  },
  {
    href: "/dashboard/labs/simulators/defender",
    label: "Defender XDR",
    iconSrc: "/labs-logos/Defender_512x512.png",
  },
  {
    href: "/dashboard/labs/simulators/sentinel",
    label: "Sentinel",
    iconSrc: "/labs-logos/Azure Sentinel_512x512.png",
  },
  {
    href: "/dashboard/labs/simulators/purview",
    label: "Purview",
    iconSrc: "/labs-logos/purview color_512x512.png",
  },
  {
    href: "/dashboard/labs/simulators/winserver",
    label: "Windows Server",
    iconSrc: "/labs-logos/Windows Server.png",
  },
  {
    href: "/dashboard/labs/simulators/azure-devops",
    label: "Azure DevOps",
    iconSrc: "/labs-logos/azure-devops.png",
  },
];

const COMMUNICATION_MODULES = [
  {
    href: "/dashboard/interview/PracticalLearning",
    label: "Customer Centricity",
    icon: GraduationCap,
    description:
      "Handle irate customers and respond with empathy, clarity, and professionalism.",
    tags: ["Voice Recording", "AI Feedback", "Graded"],
  },
  {
    href: "/dashboard/emailAssessments/take",
    label: "Ticket Hygiene & Email Writing",
    icon: Mail,
    description:
      "Practice proper ticket updates, email writing, and resolution communication.",
    tags: ["Real Scenarios", "Best Practices", "Graded"],
  },
];

/** Splits a duration in seconds into a countable number + compact unit ("H"/"M"). */
function splitDuration(totalSeconds: number): { value: number; unit: string } {
  const hours = Math.floor(totalSeconds / 3600);
  if (hours > 0) return { value: hours, unit: "H" };
  return { value: Math.floor((totalSeconds % 3600) / 60), unit: "M" };
}

function StatTile({
  value,
  unit,
  label,
}: {
  value: number;
  unit?: string;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-8 px-5 text-center">
      <p className="flex items-baseline text-6xl font-semibold text-white">
        <CountUp to={value} duration={1.5} />{" "}
        {unit ? <span className="text-4xl">{unit}</span> : null}
      </p>
      <p className="mt-1 text-xs text-itbd-blue">{label}</p>
    </div>
  );
}

export function DashboardHomeClient({
  totalSimulators,
  todaySeconds,
  weekSeconds,
}: {
  totalSimulators: number;
  todaySeconds: number;
  weekSeconds: number;
}) {
  const reduce = useReducedMotion();

  return (
    <div className="space-y-8">
      <motion.div
        className="flex justify-between items-center gap-6"
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="space-y-2 p-5">
          <h1 className="text-2xl leading-[0.95] font-bold tracking-normal sm:text-5xl">
            LAB
          </h1>
          <h1 className="text-2xl leading-[0.95] font-bold tracking-normal sm:text-5xl">
            CATALOG
          </h1>
          <p className="text-md tracking-widest text-itbd-blue">
            Explore. Practice. <br /> Improve. Excel.
          </p>
        </div>

        {/* Central logo: the hologram frame (image 8) with the ITBD cube
            logo (image 7) composited on top. The two float in OPPOSITE
            directions (frame up while logo down, and vice versa) so the
            logo reads as floating independently inside the case, rather
            than the whole composite moving as one rigid unit.
            image 8's canvas is mostly transparent EXCEPT a large opaque
            rectangle around the glow itself (confirmed via its alpha
            channel: opaque from ~29%-71% width, ~24%-82% height) — cropped
            out here via a clipping wrapper + fill/object-cover so only the
            glow and its soft fade show, not the hard-edged box. */}
        <div className="relative hidden aspect-696/540 w-72 shrink-0 md:block lg:w-96">
          <motion.div
            className="absolute inset-0 overflow-hidden"
            animate={reduce ? undefined : { y: [0, -8, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            {/* scale-125 zooms the crop in further so the hologram reads
                bigger inside the same box, instead of resizing the wrapper
                (which would shift the whole header's layout). */}
            <Image
              src="/login-images/8.png"
              alt=""
              aria-hidden
              fill
              sizes="(min-width: 1024px) 24rem, 18rem"
              className="scale-125 object-cover"
            />
          </motion.div>
          <motion.div
            className="absolute top-1/3 left-1/2 w-[48%] -translate-x-1/2 -translate-y-1/2"
            animate={reduce ? undefined : { y: [0, 8, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <Image
              src="/login-images/7.png"
              alt="ITBD"
              width={1280}
              height={1280}
              className="h-auto w-full object-contain"
            />
          </motion.div>
        </div>

        {/* Stat tiles — one merged strip, three counted-up figures separated
            by thin fading dividers (matches the mockup: a single stat card,
            not three separate boxes). No fill/rounding — just top and bottom
            hairlines, each fading to transparent at both ends. */}
        <div
          className="relative flex shrink-0 items-stretch self-center px-2 bg-slate-800/25 rounded-2xl"
          style={{
            borderImage:
              "linear-gradient(to right, transparent, var(--itbd-blue), transparent) 1",
            borderTop: "1px solid",
            borderBottom: "1px solid",
          }}
        >
          <StatTile value={totalSimulators} label="Total Modules" />
          <div
            aria-hidden
            className="w-px self-stretch my-3"
            style={{
              background:
                "linear-gradient(to bottom, transparent, var(--itbd-blue), transparent)",
            }}
          />
          <StatTile
            value={splitDuration(weekSeconds).value}
            unit={splitDuration(weekSeconds).unit}
            label="Spent This Week"
          />
          <div
            aria-hidden
            className="w-px self-stretch my-3"
            style={{
              background:
                "linear-gradient(to bottom, transparent, var(--itbd-blue), transparent)",
            }}
          />
          <StatTile
            value={splitDuration(todaySeconds).value}
            unit={splitDuration(todaySeconds).unit}
            label="Spent Today"
          />
        </div>
      </motion.div>

      <div className="grid gap-4 lg:grid-cols-2">
        <LabCard
          icon="technical"
          title="Technical Lab"
          description="Hands-on practice environments modeled on real admin consoles."
          accent="blue"
          variant="grid"
          gridItems={FEATURED_SIMULATORS}
          ctaLabel={`View all ${totalSimulators} simulators`}
          ctaHref="/dashboard/labs/simulators"
        />
        <LabCard
          icon="communication"
          title="Communication Lab"
          description="Enhance soft skills through real-world scenarios."
          accent="blue"
          variant="list"
          listItems={COMMUNICATION_MODULES}
          ctaLabel="View all communication modules"
          ctaHref="/dashboard/interview/PracticalLearning"
        />
      </div>

      <HowItWorks />
    </div>
  );
}
