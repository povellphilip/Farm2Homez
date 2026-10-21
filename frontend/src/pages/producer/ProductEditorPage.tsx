import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight, Eye, ImagePlus, Trash2 } from 'lucide-react';
import { useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { z } from 'zod';
import { applyFieldErrors, errorMessage, toApiError } from '@/api/errors';
import { useCategories } from '@/api/queries/catalog';
import { useImageMutations, useMyProduct, useProductMutations } from '@/api/queries/producer';
import type { ProducerProduct, ProducerProductRequest, Unit } from '@/api/types';
import { useAuth } from '@/auth/AuthProvider';
import { PortalPageHeader } from '@/components/layout/Layouts';
import { ProductPhoto } from '@/components/product/ProductVisuals';
import { Badge, ModerationBadge, ProductStatusBadge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/Dialog';
import { Alert, ErrorState, PageLoader, Spinner } from '@/components/ui/Feedback';
import { Checkbox, SelectField, TextArea, TextField } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toaster';
import { money, perUnit, UNIT_LABELS } from '@/lib/format';
import { PageMeta } from '@/lib/seo';
import { NotFoundPage } from '../public/StatusPages';

const MAX_IMAGES = 8;
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];

const schema = z
  .object({
    name: z.string().trim().min(2, 'Give the product a name.').max(160),
    category: z.string().min(1, 'Choose a category.'),
    subcategory: z.string().optional(),
    description: z.string().trim().min(10, 'Describe the product in at least 10 characters.').max(5000),
    price: z.string().trim().regex(/^\d{1,7}(\.\d{1,2})?$/, 'Enter a price like 120 or 120.50.').refine((value) => Number(value) > 0, 'Price must be more than zero.'),
    unit: z.string().min(1, 'Choose a unit.'),
    stock_quantity: z.coerce.number({ invalid_type_error: 'Enter a whole number.' }).int('Enter a whole number.').min(0).max(10_000_000),
    min_order_quantity: z.coerce.number({ invalid_type_error: 'Enter a whole number.' }).int('Enter a whole number.').min(1, 'At least 1.').max(100_000),
    origin: z.string().trim().min(2, 'Where was it grown or made?').max(160),
    harvest_info: z.string().trim().max(255).optional(),
    is_seasonal: z.boolean(),
    available_from: z.string().optional(),
    available_until: z.string().optional(),
    is_available: z.boolean(),
    is_organic: z.boolean(),
  })
  .refine((values) => !values.available_from || !values.available_until || values.available_until >= values.available_from, {
    path: ['available_until'],
    message: 'The end date must be on or after the start date.',
  });
type Values = z.infer<typeof schema>;
const FIELDS = Object.keys(schema.innerType().shape);

function toValues(product: ProducerProduct | undefined, origin: string): Values {
  return {
    name: product?.name ?? '',
    category: product?.category ?? '',
    subcategory: product?.subcategory ?? '',
    description: product?.description ?? '',
    price: product?.price ?? '',
    unit: product?.unit ?? 'kg',
    stock_quantity: product?.stock_quantity ?? 0,
    min_order_quantity: product?.min_order_quantity ?? 1,
    origin: product?.origin ?? origin,
    harvest_info: product?.harvest_info ?? '',
    is_seasonal: product?.is_seasonal ?? false,
    available_from: product?.available_from ?? '',
    available_until: product?.available_until ?? '',
    is_available: product?.is_available ?? true,
    is_organic: product?.is_organic ?? false,
  };
}

function toRequest(values: Values): Partial<ProducerProductRequest> {
  return {
    ...values,
    unit: values.unit as Unit,
    subcategory: values.subcategory || null,
    available_from: values.available_from || null,
    available_until: values.available_until || null,
    harvest_info: values.harvest_info ?? '',
  };
}

function ImageManager({ product }: { product: ProducerProduct }) {
  const { upload, remove, reorder } = useImageMutations(product.id);
  const notify = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const images = product.images;

  async function handleFiles(files: FileList | null) {
    if (!files?.length) return;
    const room = MAX_IMAGES - images.length;
    const selected = Array.from(files).slice(0, room);
    if (files.length > room) notify(`Only ${room} more ${room === 1 ? 'photo fits' : 'photos fit'} on this listing.`, 'error');
    for (const file of selected) {
      if (!ACCEPTED.includes(file.type)) {
        notify(`${file.name}: use a JPEG, PNG or WebP image.`, 'error');
        continue;
      }
      if (file.size > MAX_BYTES) {
        notify(`${file.name} is larger than 5 MB.`, 'error');
        continue;
      }
      setUploading((count) => count + 1);
      try {
        await upload.mutateAsync({ file, altText: product.name });
      } catch (error) {
        notify(`${file.name}: ${errorMessage(error)}`, 'error');
      } finally {
        setUploading((count) => count - 1);
      }
    }
    if (input.current) input.current.value = '';
  }

  function move(index: number, delta: number) {
    const ids = images.map((image) => image.id);
    const [moved] = ids.splice(index, 1);
    ids.splice(index + delta, 0, moved);
    reorder.mutate(ids, { onError: (error) => notify(errorMessage(error), 'error') });
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-sans text-base font-semibold">Photos</h2>
          <p className="text-sm text-charcoal-500">Up to {MAX_IMAGES} JPEG, PNG or WebP photos, 5 MB each. The first photo is the cover.</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          disabled={images.length >= MAX_IMAGES}
          onClick={() => input.current?.click()}
          icon={<ImagePlus className="h-4 w-4" aria-hidden="true" />}
        >
          Add photos
        </Button>
        <input ref={input} type="file" accept={ACCEPTED.join(',')} multiple hidden onChange={(event) => handleFiles(event.target.files)} aria-label="Upload product photos" />
      </div>
      <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {images.map((image, index) => (
          <li key={image.id} className="group relative overflow-hidden rounded-xl bg-ivory-100">
            <img src={image.url} alt={image.alt_text} className="aspect-square w-full object-cover" />
            {index === 0 ? <Badge className="absolute left-2 top-2 bg-white/90">Cover</Badge> : null}
            <div className="absolute inset-x-0 bottom-0 flex justify-between bg-gradient-to-t from-charcoal-900/70 p-2 opacity-100 sm:opacity-0 sm:transition sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
              <div className="flex gap-1">
                <button type="button" disabled={index === 0} onClick={() => move(index, -1)} className="rounded-full bg-white/90 p-1.5 disabled:opacity-40" aria-label="Move photo earlier">
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button type="button" disabled={index === images.length - 1} onClick={() => move(index, 1)} className="rounded-full bg-white/90 p-1.5 disabled:opacity-40" aria-label="Move photo later">
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
              <button type="button" onClick={() => remove.mutate(image.id)} className="rounded-full bg-white/90 p-1.5 text-terracotta-700" aria-label="Delete photo">
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          </li>
        ))}
        {Array.from({ length: uploading }).map((_, index) => (
          <li key={`uploading-${index}`} className="grid aspect-square place-items-center rounded-xl bg-sage-100">
            <Spinner label="Uploading photo" />
          </li>
        ))}
        {!images.length && !uploading ? (
          <li className="col-span-full">
            <button
              type="button"
              onClick={() => input.current?.click()}
              className="flex w-full flex-col items-center rounded-xl border border-dashed border-sage-300 px-6 py-10 text-sm text-charcoal-500 hover:border-forest-600 hover:text-forest-700"
            >
              <ImagePlus className="mb-2 h-6 w-6" aria-hidden="true" />
              Add a clear, well-lit photo. Listings with photos sell far better.
            </button>
          </li>
        ) : null}
      </ul>
    </Card>
  );
}

export default function ProductEditorPage() {
  const { id } = useParams();
  const productId = id ? Number(id) : undefined;
  const navigate = useNavigate();
  const notify = useToast();
  const { user } = useAuth();
  const { data: categories } = useCategories();
  const { data: product, isLoading, error, refetch } = useMyProduct(productId);
  const { save, publish, remove } = useProductMutations();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const verified = user?.producer?.verification_status === 'VERIFIED';

  const defaultOrigin = '';
  const form = useForm<Values>({ resolver: zodResolver(schema), values: toValues(product, defaultOrigin) });
  const {
    register,
    control,
    formState: { errors, isSubmitting, isDirty },
  } = form;
  const watched = useWatch({ control });
  const category = categories?.find((item) => item.slug === watched.category);

  // Wait for categories too: a <select> can't hold a value whose <option> hasn't rendered yet.
  if ((productId && isLoading) || !categories) return <PageLoader />;
  if (productId && error) return toApiError(error).status === 404 ? <NotFoundPage /> : <ErrorState error={error} onRetry={() => refetch()} />;

  async function persist(values: Values) {
    try {
      const saved = await save.mutateAsync({ id: productId, body: toRequest(values) });
      form.reset(toValues(saved, defaultOrigin));
      return saved;
    } catch (err) {
      const message = applyFieldErrors(err, form.setError, FIELDS);
      if (message) form.setError('root', { message });
      return null;
    }
  }

  const onSave = form.handleSubmit(async (values) => {
    const saved = await persist(values);
    if (!saved) return;
    notify(productId ? 'Changes saved.' : 'Draft created. Add photos, then publish when ready.');
    if (!productId) navigate(`/producer/products/${saved.id}`, { replace: true });
  });

  const onPublish = form.handleSubmit(async (values) => {
    const saved = isDirty || !productId ? await persist(values) : product;
    if (!saved) return;
    try {
      const published = await publish.mutateAsync({ id: saved.id, publish: true });
      notify(published.moderation_status === 'PENDING' ? 'Submitted for review. It goes live once approved.' : 'Published. Your listing is live.');
      if (!productId) navigate(`/producer/products/${saved.id}`, { replace: true });
    } catch (err) {
      notify(errorMessage(err), 'error');
    }
  });

  const unitOptions = Object.entries(UNIT_LABELS).map(([value, label]) => ({ value, label }));
  const previewPrice = watched.price && Number(watched.price) > 0 ? money(watched.price) : '₹—';

  return (
    <div>
      <PageMeta title={product ? `Edit ${product.name}` : 'New listing'} noindex />
      <Link to="/producer/products" className="text-sm text-charcoal-500 hover:text-charcoal-900">
        ← All products
      </Link>
      <PortalPageHeader
        title={product ? product.name : 'New listing'}
        actions={
          product ? (
            <div className="flex flex-wrap items-center gap-2">
              <ProductStatusBadge status={product.status} />
              {product.moderation_status !== 'APPROVED' ? <ModerationBadge status={product.moderation_status} /> : null}
            </div>
          ) : undefined
        }
      />
      {product?.moderation_status === 'REJECTED' ? (
        <Alert tone="warning" title="A moderator asked for changes" className="mb-6">
          {product.moderation_note} Edit the listing and publish again to request a new review.
        </Alert>
      ) : null}
      {!verified ? (
        <Alert className="mb-6">You can save drafts now. Publishing unlocks once your farm is verified.</Alert>
      ) : null}

      <div className="grid gap-8 xl:grid-cols-[1fr_18rem]">
        <form onSubmit={onSave} noValidate className="space-y-6">
          {errors.root?.message ? <Alert tone="error">{errors.root.message}</Alert> : null}
          <Card className="space-y-5 p-5 sm:p-6">
            <h2 className="font-sans text-base font-semibold">Basics</h2>
            <TextField label="Product name" error={errors.name?.message} {...register('name')} />
            <div className="grid gap-5 sm:grid-cols-2">
              <SelectField
                label="Category"
                placeholder="Choose…"
                options={categories?.map((item) => ({ value: item.slug, label: item.name })) ?? []}
                error={errors.category?.message}
                {...register('category', { onChange: () => form.setValue('subcategory', '') })}
              />
              <SelectField
                label="Subcategory"
                optional
                placeholder={category ? 'None' : 'Choose a category first'}
                disabled={!category?.children.length}
                options={category?.children.map((child) => ({ value: child.slug, label: child.name })) ?? []}
                error={errors.subcategory?.message}
                {...register('subcategory')}
              />
            </div>
            <TextArea label="Description" rows={6} hint="Variety, taste, how it was grown, storage tips." error={errors.description?.message} {...register('description')} />
          </Card>

          <Card className="space-y-5 p-5 sm:p-6">
            <h2 className="font-sans text-base font-semibold">Price & stock</h2>
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField label="Price (₹)" inputMode="decimal" error={errors.price?.message} {...register('price')} />
              <SelectField label="Sold per" options={unitOptions} error={errors.unit?.message} {...register('unit')} />
              <TextField label="Available quantity" type="number" min={0} error={errors.stock_quantity?.message} {...register('stock_quantity')} />
              <TextField label="Minimum order" type="number" min={1} error={errors.min_order_quantity?.message} {...register('min_order_quantity')} />
            </div>
            <Checkbox label="Currently available to order" description="Untick to pause sales without unpublishing the listing." {...register('is_available')} />
          </Card>

          <Card className="space-y-5 p-5 sm:p-6">
            <h2 className="font-sans text-base font-semibold">Origin & season</h2>
            <TextField label="Origin" placeholder="e.g. Vythiri, Wayanad" error={errors.origin?.message} {...register('origin')} />
            <TextField label="Harvest information" optional placeholder="e.g. Picked to order between May and August" {...register('harvest_info')} />
            <Checkbox label="Seasonal product" {...register('is_seasonal')} />
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField label="Available from" type="date" optional {...register('available_from')} />
              <TextField label="Available until" type="date" optional error={errors.available_until?.message} {...register('available_until')} />
            </div>
            <Checkbox label="Organic" description="Only tick this if you can describe your organic practice on request." {...register('is_organic')} />
          </Card>

          {product ? <ImageManager product={product} /> : <Alert>Save the listing as a draft to start adding photos.</Alert>}

          <div className="flex flex-wrap items-center gap-3 border-t border-charcoal-800/[0.07] pt-6">
            <Button type="submit" variant="secondary" loading={isSubmitting && save.isPending && !publish.isPending}>
              {productId ? 'Save changes' : 'Save as draft'}
            </Button>
            {product?.status === 'PUBLISHED' ? (
              <Button variant="ghost" loading={publish.isPending} onClick={() => publish.mutate({ id: product.id, publish: false }, { onSuccess: () => notify('Listing unpublished.') })}>
                Unpublish
              </Button>
            ) : (
              <Button onClick={onPublish} disabled={!verified} loading={publish.isPending}>
                {productId ? 'Publish' : 'Save & publish'}
              </Button>
            )}
            {product ? (
              <Button variant="danger" className="ml-auto" onClick={() => setConfirmDelete(true)} icon={<Trash2 className="h-4 w-4" aria-hidden="true" />}>
                Delete
              </Button>
            ) : null}
          </div>
        </form>

        <aside className="xl:sticky xl:top-8 xl:self-start">
          <p className="mb-3 flex items-center gap-2 text-sm font-medium text-charcoal-600">
            <Eye className="h-4 w-4" aria-hidden="true" /> Preview
          </p>
          <Card className="overflow-hidden">
            <ProductPhoto image={product?.images[0]} alt={watched.name || 'Your product'} categorySlug={watched.category} className="aspect-[4/3] w-full" />
            <div className="p-4">
              <p className="text-xs font-medium text-forest-600">{user?.producer?.farm_name}</p>
              <p className="mt-0.5 font-semibold text-charcoal-900">{watched.name || 'Product name'}</p>
              <p className="mt-1 text-xs text-charcoal-500">{watched.origin || 'Origin'}</p>
              <p className="mt-3">
                <span className="text-lg font-semibold">{previewPrice}</span>
                <span className="ml-1 text-xs text-charcoal-500">{perUnit((watched.unit as Unit) || 'kg')}</span>
              </p>
            </div>
          </Card>
          {product?.status === 'PUBLISHED' && product.moderation_status === 'APPROVED' ? (
            <Link to={`/products/${product.slug}`} className="mt-3 inline-block text-sm font-medium text-forest-700 hover:underline">
              View live listing →
            </Link>
          ) : null}
        </aside>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this listing?"
        description="This can't be undone. Listings with orders still in progress can't be deleted; unpublish them instead."
        confirmLabel="Delete listing"
        tone="danger"
        loading={remove.isPending}
        error={remove.error ? errorMessage(remove.error) : null}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          if (!product) return;
          try {
            await remove.mutateAsync(product.id);
            notify('Listing deleted.');
            navigate('/producer/products');
          } catch {
            /* shown in the dialog */
          }
        }}
      />
    </div>
  );
}
