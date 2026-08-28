import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import type { TrendPoint } from '@/services/statsService';

interface TrendChartProps {
  data: TrendPoint[];
}

/**
 * 完成趋势图（方向稿 §9）：ECharts 深度定制——去网格、去默认蓝；
 * 单色系 ink 细柱，今天所在桶朱砂点缀，坐标轴 mono caption。
 */
export function TrendChart({ data }: TrendChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts>();

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current);
    chartRef.current = chart;
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(ref.current);
    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const css = getComputedStyle(document.documentElement);
    const ink = css.getPropertyValue('--ink').trim();
    const sub = css.getPropertyValue('--sub').trim();
    const accent = css.getPropertyValue('--accent').trim();
    chart.setOption({
      grid: { left: 8, right: 8, top: 16, bottom: 4, containLabel: true },
      xAxis: {
        type: 'category',
        data: data.map((d) => d.label),
        axisLine: { lineStyle: { color: sub, opacity: 0.3 } },
        axisTick: { show: false },
        axisLabel: { color: sub, fontFamily: 'IBM Plex Mono, monospace', fontSize: 11 },
      },
      yAxis: {
        type: 'value',
        minInterval: 1,
        splitLine: { show: false },
        axisLabel: { show: false },
      },
      series: [
        {
          type: 'bar',
          data: data.map((d) => ({
            value: d.count,
            itemStyle: { color: d.isToday ? accent : ink, opacity: d.isToday ? 1 : 0.82 },
          })),
          barMaxWidth: 18,
          itemStyle: { borderRadius: [2, 2, 0, 0] },
        },
      ],
      tooltip: {
        trigger: 'axis',
        formatter: (params: unknown) => {
          const p = (params as Array<{ name: string; value: number }>)[0];
          return `${p.name} · 完成 ${p.value}`;
        },
      },
    });
  }, [data]);

  return <div ref={ref} className="h-44 w-full" />;
}
