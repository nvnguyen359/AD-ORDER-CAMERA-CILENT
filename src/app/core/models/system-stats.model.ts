export interface SystemStats {
  cpu_overall: number;
  ram_percent: number;
  ram_used_mb: number;
  temp_c: number;
  disk_percent: number;
  disk_free_gb: number;
  threads: number;
  active_cams: number;
  uptime: number;
  ts: number;
}