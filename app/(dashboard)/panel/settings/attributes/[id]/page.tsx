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
            ← Back to Attributes
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Edit Attribute Template</h1>
        <p className="text-muted-foreground mt-1">
          Update template details and manage options
        </p>
      </div>

      <AttributeTemplateForm mode="edit" template={template} />
    </div>
  );
}
