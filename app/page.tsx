"use client";

import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Componentes shadcn/ui já instalados no template
const INSTALLED_COMPONENTS = [
  "button",
  "card",
  "input",
  "dialog",
  "tabs",
  "badge",
  "skeleton",
  "separator",
  "textarea",
  "label",
] as const;

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-10 px-6 py-24">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">hack-template</h1>
        <p className="text-muted-foreground">pronto para construir</p>
      </div>

      <div className="flex max-w-md flex-wrap items-center justify-center gap-2">
        {INSTALLED_COMPONENTS.map((name) => (
          <Badge
            key={name}
            variant="outline"
            className="cursor-pointer"
            onClick={() =>
              toast(`pnpm dlx shadcn@latest add ${name}`, {
                description: "comando de instalação copiado para referência",
              })
            }
          >
            {name}
          </Badge>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Dialog>
          <DialogTrigger render={<Button variant="outline" />}>
            Abrir dialog
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Exemplo de dialog</DialogTitle>
              <DialogDescription>
                Isso é só um placeholder para confirmar que o shadcn/ui está
                funcionando.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter showCloseButton />
          </DialogContent>
        </Dialog>

        <Button onClick={() => toast.success("Toast funcionando!")}>
          Disparar toast
        </Button>
      </div>
    </div>
  );
}
