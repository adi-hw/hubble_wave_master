export type MetricQueryRange = {
  start?: string;
  end?: string;
  limit?: number;
};

export type MetricPointResult = {
  metricCode: string;
  periodStart: string;
  periodEnd: string;
  value: number;
};
