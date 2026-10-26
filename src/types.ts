export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export type Project = {
  project_id: string;
  project_name: string;
  project_slug: string;
  user_id: string;
  created_at?: string;
  updated_at?: string;
};

export type Scheme = {
  scheme_id: string;
  project_id: string;
  scheme_name: string;
  scheme_description?: string;
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
};

export type Node = {
  node_id: string;
  scheme_id: string;
  node_type: string;
  node_name?: string;
  node_description?: string;
  config?: Record<string, unknown>;
  created_at?: string;
  updated_at?: string;
};

export type NodeProcess = {
  node_process_id: string;
  node_id: string;
  scheme_process_id: string;
  running_status: string;
  node_type?: string;
  created_at?: string;
};

export type SchemeProcess = {
  scheme_process_id: string;
  scheme_id: string;
  project_id?: string;
  running_trigger?: string;
  running_status: string;
  completion_status?: string;
  created_at?: string;
};

export type PaymentAccount = {
  payment_account_id: string;
  user_id: string;
  balance?: number;
  currency?: string;
  created_at?: string;
};

export type Transaction = {
  transaction_id: string;
  payment_account_id: string;
  amount: number;
  type: string;
  description?: string;
  created_at?: string;
};

export type AnalyticsAppProject = {
  _id: string;
  project_slug: string;
  analytics_org: string;
  created_time?: string;
};

export type AnalyticsEventType = {
  _id: string;
  analytics_event_name: string;
  analytics_app_project?: string;
  analytics_org?: string;
};

export type AnalyticsExportJob = {
  _id: string;
  export_kind: 'EVENTS' | 'USER_EVENTS' | 'USERS';
  file_format: 'CSV' | 'JSONL';
  export_status: 'QUEUED' | 'RUNNING' | 'DONE' | 'FAILED';
  rows_count?: number;
  is_truncated?: boolean;
  file_name?: string;
  file_size_bytes?: number;
  error_text?: string;
  created_time?: string;
  finished_time?: string;
  expires_time?: string;
};

export type AnalyticsExportWithDownloadUrl = {
  export_job: AnalyticsExportJob;
  download_url: string | null;
  download_url_expires_time: string | null;
};
