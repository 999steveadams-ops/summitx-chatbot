export type Tenant = {
  id: string;
  business_name: string;
  system_prompt: string;
  brand_color: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
  /** Added in migration 0003 (website knowledge base). */
  website_url?: string | null;
  last_scanned_at?: string | null;
};

/** Only the fields that are safe to expose to the public chat widget. */
export type PublicTenant = Pick<Tenant, "business_name" | "brand_color">;
