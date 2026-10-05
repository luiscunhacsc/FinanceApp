import { useEffect, useRef } from 'react';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import { GridComponent, TooltipComponent, LegendComponent, DataZoomComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import type { TimelinePoint } from '../../../../../packages/quantitative/portfolio';
import { date, money } from '../../../../../packages/domain/format';
echarts.use([LineChart, GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, CanvasRenderer]);
export default function PortfolioChart({ points, dark }: { points: TimelinePoint[]; dark: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const chart = echarts.init(ref.current!); const color = dark ? '#a6baad' : '#64776c';
    chart.setOption({ animation: false, color: ['#279781', '#8994ae', '#d3a450'], legend: { bottom: 0, textStyle: { color, fontSize: 11 } },
      grid: { top: 18, left: 85, right: 20, bottom: 85 },
      tooltip: { trigger: 'axis', renderMode: 'richText', formatter: (params: unknown) => { const p = points[(params as { dataIndex: number }[])[0]?.dataIndex]; return p ? `${date(p.date)}\nPatrimónio: ${p.value === null ? 'em falta' : money(Number(p.value))}\nCapital líquido: ${money(Number(p.flows))}\nResultado: ${p.profit === null ? 'em falta' : money(Number(p.profit))}${p.carried ? '\nInclui preços/câmbios transportados' : ''}${p.manual ? '\nInclui dados manuais/importados' : ''}` : ''; } },
      xAxis: { type: 'category', data: points.map(p => p.date), boundaryGap: false, axisLabel: { color, formatter: date } },
      yAxis: { type: 'value', scale: true, axisLabel: { color, formatter: (v: number) => money(v) }, splitLine: { lineStyle: { color: dark ? '#2a3b31' : '#edf0ee' } } },
      dataZoom: [{ type: 'inside' }, { type: 'slider', bottom: 35, height: 16, labelFormatter: (_v: number, label: string) => date(label), textStyle: { color } }],
      series: [{ name: 'Património', key: 'value', areaStyle: { opacity: .07 } }, { name: 'Capital líquido', key: 'flows', areaStyle: undefined }, { name: 'Resultado', key: 'profit', areaStyle: undefined }].map(s => ({ name: s.name, type: 'line', data: points.map(p => p[s.key as 'value' | 'flows' | 'profit'] === null ? null : Number(p[s.key as 'value' | 'flows' | 'profit'])), showSymbol: points.length === 1, connectNulls: false, smooth: false, areaStyle: s.areaStyle, lineStyle: { width: 2 } })),
    });
    const observer = new ResizeObserver(() => chart.resize()); observer.observe(ref.current!); return () => { observer.disconnect(); chart.dispose(); };
  }, [points, dark]);
  return <div className="portfolio-chart" ref={ref} role="img" aria-label="Evolução do património, capital líquido e resultado. As lacunas indicam dados em falta." />;
}
