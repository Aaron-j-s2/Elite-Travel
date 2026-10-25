import type { FieldErrors, FieldValues, Resolver } from 'react-hook-form';
import type { ZodType } from 'zod';

/** Minimal zod → react-hook-form resolver (avoids an extra dependency). */
export function zodResolver<TIn extends FieldValues, TOut extends FieldValues = TIn>(schema: ZodType<TOut, TIn>): Resolver<TIn, unknown, TOut> {
  return async (values) => {
    const result = await schema.safeParseAsync(values);
    if (result.success) return { values: result.data, errors: {} };
    const errors: Record<string, unknown> = {};
    for (const issue of result.error.issues) {
      let node = errors;
      issue.path.forEach((key, i) => {
        const k = String(key);
        if (i === issue.path.length - 1) {
          node[k] ??= { type: issue.code, message: issue.message };
        } else {
          node[k] ??= {};
          node = node[k] as Record<string, unknown>;
        }
      });
    }
    return { values: {}, errors: errors as FieldErrors<TIn> };
  };
}
