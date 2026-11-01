"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { PlusIcon, Trash2Icon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useFieldArray, useForm, type UseFormRegisterReturn } from "react-hook-form";
import { toast } from "sonner";
import { applyActionError } from "@/shared/presentation/form-errors";
import { Button, buttonVariants } from "@/shared/presentation/ui/button";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/shared/presentation/ui/field";
import { Input } from "@/shared/presentation/ui/input";
import { NativeSelect, NativeSelectOption } from "@/shared/presentation/ui/native-select";
import type { ProductView } from "../application/catalog-ports";
import {
  newProductSchema,
  presentationSchema,
  productSchema,
  type NewProductInput,
  type PresentationInput,
} from "../application/catalog-schemas";
import { CONTENT_UNITS, PRODUCT_LINES, SALE_UNITS } from "../domain/product";
import { addPresentationAction, createProductAction, updateProductAction } from "./catalog-actions";
import { LINE_LABELS, SALE_UNIT_LABELS, UNIT_LABELS } from "./catalog-labels";
import { PRODUCTS_PATH, productPath } from "./catalog-routes";

const EMPTY_PRESENTATION: PresentationInput = { content: "", unit: "l", saleUnit: "container" };
const DUPLICATE_NAME = { name: "Ya hay un producto con ese nombre." };

export function NewProductForm() {
  const router = useRouter();
  const [isSaving, startSaving] = useTransition();
  const form = useForm({
    resolver: zodResolver(newProductSchema),
    defaultValues: {
      name: "",
      line: "fertilizers",
      presentations: [EMPTY_PRESENTATION],
    } satisfies NewProductInput,
  });
  const presentations = useFieldArray({ control: form.control, name: "presentations" });
  const { errors } = form.formState;

  const submit = form.handleSubmit((values) =>
    startSaving(async () => {
      const result = await createProductAction(values);
      if (!result.ok) return applyActionError(form, result.error, DUPLICATE_NAME);
      toast.success("Producto creado");
      router.push(productPath(result.data.id));
    }),
  );

  return (
    <form onSubmit={submit} noValidate className="flex max-w-3xl flex-col gap-6">
      <FieldGroup>
        <div className="grid gap-5 sm:grid-cols-[2fr_1fr]">
          <Field data-invalid={!!errors.name}>
            <FieldLabel htmlFor="name">Producto</FieldLabel>
            <Input id="name" autoFocus aria-invalid={!!errors.name} {...form.register("name")} />
            <FieldError errors={[errors.name]} />
          </Field>
          <LineField registration={form.register("line")} />
        </div>

        <fieldset className="flex flex-col gap-3">
          <legend className="mb-2 text-sm font-medium">Presentaciones</legend>
          {presentations.fields.map((field, index) => (
            <div key={field.id} className="flex flex-wrap items-start gap-2">
              <PresentationFields
                content={form.register(`presentations.${index}.content`)}
                unit={form.register(`presentations.${index}.unit`)}
                saleUnit={form.register(`presentations.${index}.saleUnit`)}
                error={errors.presentations?.[index]?.content?.message}
              />
              {presentations.fields.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Quitar presentación"
                  onClick={() => presentations.remove(index)}
                >
                  <Trash2Icon aria-hidden />
                </Button>
              )}
            </div>
          ))}
          <FieldError errors={[errors.presentations?.root ?? errors.presentations]} />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="self-start"
            onClick={() => presentations.append(EMPTY_PRESENTATION)}
          >
            <PlusIcon aria-hidden /> Otra presentación
          </Button>
        </fieldset>
      </FieldGroup>

      <FieldError errors={[errors.root]} />
      <div className="flex gap-3">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Guardando…" : "Crear producto"}
        </Button>
        <Link href={PRODUCTS_PATH} className={buttonVariants({ variant: "ghost" })}>
          Cancelar
        </Link>
      </div>
    </form>
  );
}

export function EditProductForm({ product }: { product: ProductView }) {
  const router = useRouter();
  const [isSaving, startSaving] = useTransition();
  const form = useForm({
    resolver: zodResolver(productSchema),
    defaultValues: { name: product.name, line: product.line },
  });
  const { errors } = form.formState;

  const submit = form.handleSubmit((values) =>
    startSaving(async () => {
      const result = await updateProductAction(product.id, values);
      if (!result.ok) return applyActionError(form, result.error, DUPLICATE_NAME);
      toast.success("Producto actualizado");
      router.refresh();
    }),
  );

  return (
    <form onSubmit={submit} noValidate className="flex max-w-3xl flex-col gap-4">
      <div className="grid gap-5 sm:grid-cols-[2fr_1fr]">
        <Field data-invalid={!!errors.name}>
          <FieldLabel htmlFor="name">Producto</FieldLabel>
          <Input id="name" aria-invalid={!!errors.name} {...form.register("name")} />
          <FieldError errors={[errors.name]} />
        </Field>
        <LineField registration={form.register("line")} />
      </div>
      <FieldError errors={[errors.root]} />
      <Button type="submit" variant="outline" disabled={isSaving} className="self-start">
        {isSaving ? "Guardando…" : "Guardar nombre y línea"}
      </Button>
    </form>
  );
}

export function AddPresentationForm({ productId }: { productId: string }) {
  const router = useRouter();
  const [isSaving, startSaving] = useTransition();
  const form = useForm({ resolver: zodResolver(presentationSchema), defaultValues: EMPTY_PRESENTATION });
  const { errors } = form.formState;

  const submit = form.handleSubmit((values) =>
    startSaving(async () => {
      const result = await addPresentationAction(productId, values);
      if (!result.ok) {
        return applyActionError(form, result.error, { content: "El producto ya tiene esa presentación." });
      }
      toast.success("Presentación agregada");
      form.reset(EMPTY_PRESENTATION);
      router.refresh();
    }),
  );

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-2">
      <p className="text-sm font-medium">Agregar presentación</p>
      <div className="flex flex-wrap items-start gap-2">
        <PresentationFields
          content={form.register("content")}
          unit={form.register("unit")}
          saleUnit={form.register("saleUnit")}
          error={errors.content?.message}
        />
        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Agregando…" : "Agregar"}
        </Button>
      </div>
      <FieldError errors={[errors.root]} />
    </form>
  );
}

function LineField({ registration }: { registration: UseFormRegisterReturn }) {
  return (
    <Field>
      <FieldLabel htmlFor="line">Línea</FieldLabel>
      <NativeSelect id="line" {...registration}>
        {PRODUCT_LINES.map((line) => (
          <NativeSelectOption key={line} value={line}>
            {LINE_LABELS[line]}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </Field>
  );
}

/** Content, unit and how the presentation is charged. */
function PresentationFields({
  content,
  unit,
  saleUnit,
  error,
}: {
  content: UseFormRegisterReturn;
  unit: UseFormRegisterReturn;
  saleUnit: UseFormRegisterReturn;
  error?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-2">
        <Input
          className="w-24"
          inputMode="decimal"
          placeholder="20"
          aria-label="Contenido"
          aria-invalid={!!error}
          {...content}
        />
        <NativeSelect aria-label="Unidad" {...unit}>
          {CONTENT_UNITS.map((option) => (
            <NativeSelectOption key={option} value={option}>
              {UNIT_LABELS[option]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <NativeSelect aria-label="Cómo se cobra" {...saleUnit}>
          {SALE_UNITS.map((option) => (
            <NativeSelectOption key={option} value={option}>
              Precio {SALE_UNIT_LABELS[option]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
      {error && <FieldError>{error}</FieldError>}
    </div>
  );
}
