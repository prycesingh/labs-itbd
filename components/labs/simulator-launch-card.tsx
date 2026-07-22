import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function SimulatorLaunchCard({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href?: string;
}) {
  return (
    <Card className="flex h-full flex-col">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="mt-auto">
        {href ? (
          <Button asChild size="sm" className="w-full">
            <Link href={href}>Launch</Link>
          </Button>
        ) : (
          <Button size="sm" className="w-full" disabled>
            Coming soon
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
