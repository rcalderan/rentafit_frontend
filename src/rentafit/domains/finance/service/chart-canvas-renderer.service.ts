import { Injectable } from '@angular/core';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

Chart.register(...registerables);

export interface IChartInstanceHandle {
  destroy(): void;
}

/**
 * Adaptador fino sobre Chart.js pertencente ao projeto para desacoplar componentes Angular
 * da biblioteca externa e facilitar testes em ambiente JSDOM.
 */
@Injectable({ providedIn: 'root' })
export class ChartCanvasRendererService {
  /**
   * Renderiza um gráfico Chart.js no elemento canvas fornecido.
   *
   * Exemplo: `const handle = renderer.render(canvasEl, config);`
   */
  render(
    canvas: HTMLCanvasElement | undefined,
    config: ChartConfiguration,
  ): IChartInstanceHandle | null {
    if (!canvas || typeof canvas.getContext !== 'function') {
      return null;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return null;
    }
    const instance = new Chart(ctx, config);
    return {
      destroy: () => instance.destroy(),
    };
  }
}
