export type Tenant = {
  id: string;
  business_name: string;
  system_prompt: string;
  brand_color: string;
  owner_id: string;
  created_at: string;
  updated_at: string;
};

/** Only the fields that are safe to expose to the public chat widget. */
export type PublicTenant = Pick<Tenant, "business_name" | "brand_color">;
