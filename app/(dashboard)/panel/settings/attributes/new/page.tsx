import AttributeTemplateForm from "@/components/attributes/attribute-template-form";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NewAttributeTemplatePage() {
  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Link href="/panel/settings/attributes">
          <Button variant="ghost" size="sm" className="mb-4">
            ← Back to Attributes
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Create Attribute Template</h1>
        <p className="text-muted-foreground mt-1">
          Create a new attribute template like Size, Color, or Material
        </p>
      </div>

      <AttributeTemplateForm mode="create" />
    </div>
  );
}
