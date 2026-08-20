export type MediaItem = {
  type: string;
  url?: string | null;
  preview_image_url?: string | null;
  width?: number | null;
  height?: number | null;
};

export type SourceRef = {
  platform: string;
  username: string;
};

export type PaginationMeta = {
  page: number;
  page_size: number;
  total: number;
  pages: number;
  has_previous: boolean;
  has_next: boolean;
};

export type PaginatedResponse<T> = {
  items: T[];
  pagination: PaginationMeta;
};

export type FeatureEvidence = {
  name?: string;
  value?: string | number | boolean | null;
  source?: string;
  confidence?: number;
  [key: string]: unknown;
};

export type ListingMarketMeta = {
  is_repost?: boolean;
  canonical_public_id?: string | null;
  first_seen_at?: string | null;
  last_seen_at?: string | null;
};

export type ListingHistoryObservation = {
  observed_at: string;
  price?: number | null;
  currency?: string | null;
  mileage_km?: number | null;
  status: string;
};

export type ListingHistory = {
  listing_public_id: string;
  canonical_public_id: string;
  is_repost: boolean;
  first_seen_at?: string | null;
  last_seen_at?: string | null;
  days_listed: number;
  repost_count: number;
  first_price?: number | null;
  latest_price?: number | null;
  price_change?: number | null;
  price_change_percent?: number | null;
  observations: ListingHistoryObservation[];
};

export type ThreadPost = {
  x_post_id: string;
  text: string;
  created_at?: string | null;
  x_url: string;
  media: MediaItem[];
};

export type Listing = {
  // Numeric ids remain in the API for backwards compatibility, but the public
  // web app routes exclusively through public_id when the backend provides it.
  id: number;
  public_id?: string | null;
  public_url?: string | null;
  post_id: number;
  x_url: string;
  source?: SourceRef;
  make?: string | null;
  model?: string | null;
  generation?: string | null;
  variant?: string | null;
  year?: number | null;
  body_type?: string | null;
  fuel?: string | null;
  engine_cc?: number | null;
  transmission?: string | null;
  drivetrain?: string | null;
  colour?: string | null;
  price?: number | null;
  currency?: string | null;
  mileage_km?: number | null;
  location?: string | null;
  status: string;
  evidence: Record<string, unknown>;
  features: FeatureEvidence[];
  observations: string[];
  created_at?: string | null;
  market?: ListingMarketMeta;
  post?: {
    x_post_id: string;
    text: string;
    created_at?: string | null;
    classification: string;
    ai_status: string;
    media: MediaItem[];
    thread_post_count?: number;
    thread_text?: string;
    thread_media?: MediaItem[];
    thread_posts?: ThreadPost[];
  };
};

export type SignalPost = {
  id: number;
  x_post_id: string;
  text: string;
  created_at?: string | null;
  classification: string;
  ai_status: string;
  ai_provider?: string | null;
  ai_model?: string | null;
  ai_attempts?: number;
  ai_error?: string | null;
  listing_count: number;
  x_url: string;
  source?: SourceRef;
  thread_root_x_post_id?: string | null;
  media: MediaItem[];
};

export type TorqueSourceStatus = {
  username: string;
  x_user_id?: string | null;
  last_seen_post_id?: string | null;
  enabled: boolean;
};

export type TorqueStatus = {
  target?: string | null;
  targets?: string[];
  source_count?: number;
  sources?: TorqueSourceStatus[];
  x_user_id?: string | null;
  last_seen_post_id?: string | null;
  source_enabled?: boolean | null;
  daytime_poll_seconds: number;
  nighttime_poll_seconds: number;
  timezone: string;
  ai_provider?: string;
  ai_model?: string;
  ai_configured?: boolean;
  ai_failed_posts?: number;
  ai_waiting_posts?: number;
  ai_retry_max_attempts?: number;
};

export type Overview = {
  listings_total: number;
  posts_total: number;
  available_total: number;
  sold_total: number;
  enriched_posts: number;
  failed_posts?: number;
  waiting_posts?: number;
  enrichment_rate: number;
  latest_post_at?: string | null;
  latest_listing_at?: string | null;
};

export type IngestResult = {
  fetched?: number;
  new_posts?: number;
  new_listings?: number;
  inserted_posts?: number;
  enriched_posts?: number;
  listings_created?: number;
  retried_posts?: number;
  recovered_posts?: number;
  source_count?: number;
  failed_sources?: number;
  sources?: Array<Record<string, unknown>>;
  [key: string]: unknown;
};
