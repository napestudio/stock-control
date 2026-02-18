import { getAttributeTemplate } from "@/app/actions/attribute-actions";
import AttributeTemplateForm from "@/components/attributes/attribute-template-form";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditAttributeTemplatePage({ params }: Props) {
  const { id } = await params;
  const template = await getAttributeTemplate(id);

  if (!template) {
    notFound();
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link href="/panel/settings/attributes">
          <Button variant="ghost" size="sm" className="mb-4">
            ← Volver a Atributos
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Editar Plantilla de Atributos</h1>
        <p className="text-muted-foreground mt-1">
          Actualizá los detalles de la plantilla y administrá las opciones
        </p>
      </div>

      <AttributeTemplateForm mode="edit" template={template} />
    </div>
  );
}
