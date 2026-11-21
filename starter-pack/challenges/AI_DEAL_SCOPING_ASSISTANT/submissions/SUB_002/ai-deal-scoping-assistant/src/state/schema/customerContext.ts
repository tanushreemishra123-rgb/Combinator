/** Persisted schema for the customer/opportunity context a reviewer fills in by hand. */
import { z } from 'zod';

export const CustomerContextSchema = z.object({
  customerName: z.string().default(''),
  industry: z.string().default(''),
  opportunityName: z.string().default(''),
  region: z.string().default(''),
  engagementType: z.string().default(''),
  notes: z.string().default(''),
});
