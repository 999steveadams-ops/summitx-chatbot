-- SummitX ChatBot — website knowledge base (RAG).
--
-- Crawls a client's website, stores the text as embedded chunks, and lets the
-- chat endpoint retrieve the passages most relevant to each question. This is
-- what stops the assistant from inventing answers "based on the website" when
-- it has never actually seen the website.

create extension if not exists vector;

alter table public.tenants
  add column if not exists website_url     text,
  add column if not exists last_scanned_at timestamptz;

create table if not exists public.documents (
  id         uuid primary key default gen_random_uuid(),
  tenant_id  uuid not null references public.tenants(id) on delete cascade,
  url        text not null,
  title      text,
  content    text not null,
  -- gemini-embedding-001 with outputDimensionality=768
  embedding  vector(768),
  created_at timestamptz not null default now()
);

create index if not exists documents_tenant_idx on public.documents (tenant_id);

-- Approximate nearest-neighbour index for cosine distance.
create index if not exists documents_embedding_idx
  on public.documents using hnsw (embedding vector_cosine_ops);

-- ============================================================ RETRIEVAL
-- security definer: the widget is anonymous and reaches this through the
-- service role, but keeping it definer means the function is also safe to grant
-- to signed-in staff later without loosening table policies.
create or replace function public.match_documents(
  p_tenant_id   uuid,
  p_embedding   vector(768),
  p_match_count int default 6
)
returns table (
  id         uuid,
  url        text,
  title      text,
  content    text,
  similarity float
)
language sql stable security definer set search_path = public as $$
  select d.id,
         d.url,
         d.title,
         d.content,
         1 - (d.embedding <=> p_embedding) as similarity
  from public.documents d
  where d.tenant_id = p_tenant_id
    and d.embedding is not null
  order by d.embedding <=> p_embedding
  limit greatest(1, least(p_match_count, 20))
$$;

-- ============================================================ RLS
alter table public.documents enable row level security;

-- Staff and that business's own client users may read what was scraped.
-- Writes happen through the service role during a scan.
drop policy if exists documents_read on public.documents;
create policy documents_read on public.documents
  for select to authenticated using (public.can_view_tenant(tenant_id));
