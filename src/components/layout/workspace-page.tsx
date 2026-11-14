import { ArrowRight, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function WorkspacePage({
  title,
  subtitle,
  eyebrow = 'AgriShif AI',
  children,
}: {
  title: string;
  subtitle?: string;
  eyebrow?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-8">
      <header className="shell-surface rounded-2xl p-6 md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="space-y-4">
            <Badge variant="secondary" className="w-fit gap-2">
              <Sparkles className="h-3.5 w-3.5" />
              {eyebrow}
            </Badge>
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
              {subtitle ? <p className="max-w-2xl text-sm text-muted-foreground md:text-base">{subtitle}</p> : null}
            </div>
          </div>

          <Button className="w-fit gap-2 rounded-full">
            Explore platform
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {children ? (
        <div className="space-y-8">{children}</div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="p-10 text-sm text-muted-foreground">
            Starter content for the {title.toLowerCase()} experience is being prepared for the next integration phase.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
