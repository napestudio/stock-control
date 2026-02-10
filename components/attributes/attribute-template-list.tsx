"use client";

import { useState } from "react";
import { AttributeTemplateWithOptions } from "@/types/attribute";
import { deleteAttributeTemplate } from "@/app/actions/attribute-actions";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface Props {
  templates: AttributeTemplateWithOptions[];
}

export default function AttributeTemplateList({ templates }: Props) {
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete template "${name}"? This cannot be undone.`)) return;

    setIsDeleting(id);
    try {
      await deleteAttributeTemplate(id);
    } catch (error) {
      alert(error instanceof Error ? error.message : "Failed to delete template");
    } finally {
      setIsDeleting(null);
    }
  };

  if (templates.length === 0) {
    return (
      <div className="text-center py-12 border-2 border-dashed rounded-lg">
        <p className="text-muted-foreground mb-4">
          No attribute templates yet. Create one to get started.
        </p>
        <Link href="/panel/settings/attributes/new">
          <Button>Create First Template</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {templates.map((template) => (
        <div key={template.id} className="border rounded-lg p-6">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="font-semibold text-lg">{template.name}</h3>
              {template.description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {template.description}
                </p>
              )}
              <div className="flex flex-wrap gap-2 mt-3">
                {template.options.length > 0 ? (
                  template.options.map((option) => (
                    <span
                      key={option.id}
                      className="px-3 py-1 text-sm bg-secondary rounded-full"
                    >
                      {option.value}
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground italic">
                    No options yet
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                {template.options.length} option{template.options.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div className="flex gap-2 ml-4">
              <Link href={`/panel/settings/attributes/${template.id}`}>
                <Button variant="outline" size="sm">
                  Edit
                </Button>
              </Link>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleDelete(template.id, template.name)}
                disabled={isDeleting === template.id}
              >
                {isDeleting === template.id ? "Deleting..." : "Delete"}
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
