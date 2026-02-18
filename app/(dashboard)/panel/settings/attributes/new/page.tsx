import AttributeTemplateForm from "@/components/attributes/attribute-template-form";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NewAttributeTemplatePage() {
  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link href="/panel/settings/attributes">
          <Button variant="ghost" size="sm" className="mb-4">
            ← Volver a Atributos
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Crear Plantilla de Atributos</h1>
        <p className="text-muted-foreground mt-1">
          Creá una nueva plantilla de atributos como Talla, Color o Material
        </p>
      </div>

      <AttributeTemplateForm mode="create" />
    </div>
  );
}
