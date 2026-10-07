import { Subject } from 'rxjs';
import { AutosaveService } from './autosave.service';

class FakeDraftEndpoint {
  readonly requests: Array<{ id: string; amount: number }> = [];
  readonly result = new Subject<void>();
  save(request: { id: string; amount: number }): Subject<void> {
    this.requests.push(request);
    return this.result;
  }
}

describe('AutosaveService draft isolation', () => {
  it('captures pending work before another tab changes the mutable state', () => {
    const autosave = new AutosaveService<{ id: string; amount: number }, void>();
    const endpoint = new FakeDraftEndpoint();
    const form = { id: 'original', amount: 10 };
    autosave.schedule(
      () => form,
      (request) => endpoint.save(request),
    );
    form.amount = 20;
    autosave.schedule(
      () => form,
      (request) => endpoint.save(request),
    );
    form.id = 'another-tab';
    form.amount = 100;
    endpoint.result.complete();
    expect(endpoint.requests).toEqual([
      { id: 'original', amount: 10 },
      { id: 'original', amount: 20 },
    ]);
  });
  it('cancels queued and in-flight responses when the draft resets', () => {
    const autosave = new AutosaveService<{ id: string; amount: number }, void>();
    const endpoint = new FakeDraftEndpoint();
    autosave.schedule(
      () => ({ id: 'original', amount: 10 }),
      (request) => endpoint.save(request),
    );
    autosave.schedule(
      () => ({ id: 'original', amount: 20 }),
      (request) => endpoint.save(request),
    );
    autosave.reset();
    endpoint.result.next();
    endpoint.result.complete();
    expect(autosave.status).toBe('idle');
    expect(endpoint.requests).toHaveLength(1);
  });
});
