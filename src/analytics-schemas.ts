import { z } from 'zod';

export const MAX_EVENT_TYPE_FILTERS = 20;
export const MAX_CONDITIONS_PER_FILTER = 20;
export const MAX_CONDITION_VALUES = 50;
export const MAX_CONDITION_VALUE_LENGTH = 200;

export const conditionSchema = z.object({
  param_name: z.string().max(MAX_CONDITION_VALUE_LENGTH).describe('Property name'),
  param_values: z
    .array(z.string().max(MAX_CONDITION_VALUE_LENGTH))
    .max(MAX_CONDITION_VALUES)
    .describe('Values to compare with. EQUAL and CONTAINS match any of the values, NOT_EQUAL and NOT_CONTAINS match none of them, GREATER_THAN and LESS_THAN use the first value as a number, IS_SET and IS_NOT_SET ignore the values (pass [])'),
  condition: z
    .enum(['EQUAL', 'NOT_EQUAL', 'CONTAINS', 'NOT_CONTAINS', 'GREATER_THAN', 'LESS_THAN', 'IS_SET', 'IS_NOT_SET'])
    .optional()
    .describe('Comparison, EQUAL by default. NOT_EQUAL and NOT_CONTAINS keep events that do not have the property at all'),
});

export type Condition = z.infer<typeof conditionSchema>;
