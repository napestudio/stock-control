import { getAttributeTemplates } from "@/app/actions/attribute-actions";
import AttributeTemplateList from "@/components/attributes/attribute-template-list";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default async function AttributesPage() {
  const templates = await getAttributeTemplates();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Variant Attributes</h1>
          <p className="text-muted-foreground mt-1">
            Manage attribute templates and options for product variants
          </p>
        </div>
        <Link href="/panel/settings/attributes/new">
          <Button>Create Template</Button>
        </Link>
      </div>

      <AttributeTemplateList templates={templates} />
    </div>
  );
}
