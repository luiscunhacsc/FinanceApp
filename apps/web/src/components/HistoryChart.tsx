import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, DataZoomComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { HistoryPoint } from '../../../../packages/domain';
import { date, money } from '../../../../packages/domain/format';
echarts.use([LineChart, GridComponent, TooltipComponent, DataZoomComponent, CanvasRenderer]);
export default function HistoryChart({ points, dark }: { points: HistoryPoint[]; dark: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const chart = echarts.init(ref.current!);
    const color = dark ? '#92a89f' : '#75817d';
    chart.setOption({
      animation: false,
      grid: { top: 22, left: 65, right: 24, bottom: 52 },
      tooltip: { trigger: 'axis', renderMode: 'richText', formatter: (params: unknown) => { const item = (params as Array<{ dataIndex: number }>)[0]; const point = points[item?.dataIndex]; return point ? `${date(point.date)}\n${money(point.close, point.currency)}` : ''; } },
      xAxis: { type: 'category', data: points.map(p => p.date), boundaryGap: false, axisLabel: { color, formatter: (v: string) => date(v) }, axisLine: { lineStyle: { color: dark ? '#344b42' : '#e2e8e5' } } },
      yAxis: { type: 'value', scale: true, axisLabel: { color, formatter: (value: number) => new Intl.NumberFormat('pt-PT', { useGrouping: 'always', maximumFractionDigits: 2 }).format(value) }, splitLine: { lineStyle: { color: dark ? '#243c32' : '#edf0ee' } } },
      dataZoom: [{ type: 'inside' }, { type: 'slider', height: 16, bottom: 0, borderColor: 'transparent', textStyle: { color }, brushSelect: false, labelFormatter: (_value: number, label: string) => date(label) }],
      series: [{ type: 'line', data: points.map(p => p.close), showSymbol: false, smooth: false, lineStyle: { color: '#279781', width: 2.5 }, itemStyle: { color: '#279781' }, areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: 'rgba(39,151,129,0.20)' }, { offset: 1, color: 'rgba(39,151,129,0.01)' }]) } }],
    });
    const observer = new ResizeObserver(() => chart.resize()); observer.observe(ref.current!);
    return () => { observer.disconnect(); chart.dispose(); };
  }, [points, dark]);
  return <div className="history-chart" ref={ref} role="img" aria-label={`Histórico de ${points.length} cotações. Valores exatos disponíveis na tabela abaixo.`} />;
}
