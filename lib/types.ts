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
  /** Added in migration 0004 (widget branding + alerts). */
  logo_url?: string | null;
  greeting_message?: string | null;
  starter_questions?: string[] | null;
  launcher_text?: string | null;
  notification_email?: string | null;
};

/** Only the fields that are safe to expose to the public chat widget. */
export type PublicTenant = Pick<
  Tenant,
  "business_name" | "brand_color" | "logo_url" | "greeting_message" | "starter_questions" | "launcher_text"
>;

export type Lead = {
  id: string;
  tenant_id: string;
  conversation_id: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  message: string | null;
  created_at: string;
};

export const DEFAULT_LAUNCHER_TEXT = "Have any questions? Ask away!";
export const DEFAULT_GREETING = "👋 Hi! How can I help you today?";
