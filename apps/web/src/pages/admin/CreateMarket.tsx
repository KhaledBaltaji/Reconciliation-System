import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, X, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminApi, marketsApi } from '../../services/api';

const schema = z.object({
  categoryId: z.string().min(1, 'Select a category'),
  title: z.string().min(5, 'Title must be at least 5 characters'),
  description: z.string().optional(),
  marketType: z.enum(['BINARY', 'MULTIPLE_CHOICE']),
  outcomes: z.array(z.object({ name: z.string().min(1) })).min(2),
  expiresAt: z.string().min(1, 'Select expiration date'),
});

type FormData = z.infer<typeof schema>;

export default function AdminCreateMarket() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      marketType: 'BINARY',
      outcomes: [{ name: 'Yes' }, { name: 'No' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'outcomes',
  });

  const marketType = watch('marketType');

  useEffect(() => {
    marketsApi.getCategories().then((res) => {
      setCategories(res.data.data);
    });
  }, []);

  useEffect(() => {
    if (marketType === 'BINARY') {
      setValue('outcomes', [{ name: 'Yes' }, { name: 'No' }]);
    }
  }, [marketType, setValue]);

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      await adminApi.createMarket({
        ...data,
        outcomes: data.outcomes.map((o) => o.name),
        expiresAt: new Date(data.expiresAt).toISOString(),
      });
      toast.success('Market created successfully');
      navigate('/admin/markets');
    } catch (error: any) {
      toast.error(error.response?.data?.error?.message || 'Failed to create market');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-gray-400 hover:text-white mb-6"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>

      <h1 className="text-2xl font-bold mb-6">Create New Market</h1>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Category */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Category</label>
          <select {...register('categoryId')} className="input">
            <option value="">Select category...</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          {errors.categoryId && (
            <p className="text-danger-500 text-sm mt-1">{errors.categoryId.message}</p>
          )}
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Market Title</label>
          <input
            {...register('title')}
            placeholder="Will X happen by Y date?"
            className="input"
          />
          {errors.title && (
            <p className="text-danger-500 text-sm mt-1">{errors.title.message}</p>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Description (Optional)</label>
          <textarea
            {...register('description')}
            placeholder="Provide details about resolution criteria..."
            rows={3}
            className="input"
          />
        </div>

        {/* Market Type */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Market Type</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                {...register('marketType')}
                value="BINARY"
                className="text-primary-500"
              />
              <span>Binary (Yes/No)</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                {...register('marketType')}
                value="MULTIPLE_CHOICE"
                className="text-primary-500"
              />
              <span>Multiple Choice</span>
            </label>
          </div>
        </div>

        {/* Outcomes */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Outcomes</label>
          <div className="space-y-2">
            {fields.map((field, index) => (
              <div key={field.id} className="flex gap-2">
                <input
                  {...register(`outcomes.${index}.name`)}
                  placeholder={`Outcome ${index + 1}`}
                  className="input flex-1"
                  disabled={marketType === 'BINARY'}
                />
                {marketType === 'MULTIPLE_CHOICE' && fields.length > 2 && (
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    className="p-2 text-danger-400 hover:bg-danger-500/20 rounded"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
            ))}
          </div>
          {marketType === 'MULTIPLE_CHOICE' && (
            <button
              type="button"
              onClick={() => append({ name: '' })}
              className="mt-2 text-sm text-primary-400 flex items-center gap-1"
            >
              <Plus className="h-4 w-4" />
              Add Outcome
            </button>
          )}
        </div>

        {/* Expiration */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Expiration Date</label>
          <input
            type="datetime-local"
            {...register('expiresAt')}
            className="input"
            min={new Date().toISOString().slice(0, 16)}
          />
          {errors.expiresAt && (
            <p className="text-danger-500 text-sm mt-1">{errors.expiresAt.message}</p>
          )}
        </div>

        {/* Submit */}
        <div className="flex gap-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="btn-secondary flex-1"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary flex-1"
          >
            {isSubmitting ? 'Creating...' : 'Create Market'}
          </button>
        </div>
      </form>
    </div>
  );
}
