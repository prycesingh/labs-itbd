"use client";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { LAB_CATALOG, resolveBreadcrumbTrail } from "@/lib/dashboard-nav-data";
import { usePathname } from "next/navigation";

/** Breadcrumb trail for the current dashboard route, e.g.
 *  Lab Catalog > Communication Lab > Interview > My Evaluations. Replaces the
 *  nested sidebar sub-menus that used to show this hierarchy. */
export function DashboardBreadcrumb() {
  const pathname = usePathname();

  if (pathname === LAB_CATALOG.href) {
    return (
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>{LAB_CATALOG.label}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    );
  }

  const trail = resolveBreadcrumbTrail(pathname);
  if (!trail || !trail.section) return null;

  const { section, subgroup, link } = trail;
  const showSubgroup = section.subgroups.length > 1;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem className="hidden md:block">
          <BreadcrumbLink href={LAB_CATALOG.href}>
            {LAB_CATALOG.label}
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator className="hidden md:block" />

        <BreadcrumbItem className="hidden md:block">
          <BreadcrumbLink href={section.href}>{section.label}</BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator className="hidden md:block" />

        {showSubgroup ? (
          <>
            <BreadcrumbItem className="hidden md:block">
              {subgroup.label}
            </BreadcrumbItem>
            <BreadcrumbSeparator className="hidden md:block" />
          </>
        ) : null}

        <BreadcrumbItem>
          <BreadcrumbPage>{link.label}</BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
