// ECharts, tree-shaken to what the analytics screens use and bundled with the app (no CDN: the
// tool runs on internal networks). SVG renders on screen and in print (vector, scales to the page);
// Canvas is used only to export a chart as a PNG image.
import * as echarts from "echarts/core";
import { BarChart, HeatmapChart, LineChart, ScatterChart } from "echarts/charts";
import { AriaComponent, CalendarComponent, GridComponent, LegendComponent, MarkLineComponent, TooltipComponent, VisualMapComponent } from "echarts/components";
import { CanvasRenderer, SVGRenderer } from "echarts/renderers";

echarts.use([
  BarChart, LineChart, HeatmapChart, ScatterChart,
  GridComponent, TooltipComponent, LegendComponent, MarkLineComponent, VisualMapComponent, CalendarComponent, AriaComponent,
  SVGRenderer, CanvasRenderer,
]);

export default echarts;
