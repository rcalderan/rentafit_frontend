import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { ItemRentalsModalComponent } from './item-rentals-modal.component';
import { IItemReservationResponse } from '../../../rental/data/rental-contract-response.interface';

const buildReservation = (
  overrides: Partial<IItemReservationResponse> = {}
): IItemReservationResponse => ({
  contractId: 'contract-1',
  legacyId: '20260101-1',
  customerId: 'customer-1',
  customerName: 'Maria Silva',
  eventDate: '2026-07-10',
  pickupDate: '2026-07-08',
  returnDate: '2026-07-12',
  status: 'SIGNED',
  statusDescription: 'Assinado',
  ...overrides,
});

const makeFixture = (rentals: IItemReservationResponse[], itemLabel = '42') => {
  const fixture = TestBed.createComponent(ItemRentalsModalComponent);
  fixture.componentRef.setInput('rentals', rentals);
  fixture.componentRef.setInput('itemLabel', itemLabel);
  fixture.detectChanges();
  return fixture;
};

describe('ItemRentalsModalComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ItemRentalsModalComponent],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('renderiza uma linha por locação com nº, nome e data do evento', () => {
    const fixture = makeFixture([buildReservation()]);
    const cells = fixture.nativeElement.querySelectorAll('tbody td');

    expect(cells[0].textContent).toContain('20260101-1');
    expect(cells[1].textContent).toContain('Maria Silva');
    expect(cells[2].textContent).toContain('10/07/2026');
  });

  it('renderiza uma roupa com N locações em N linhas', () => {
    const fixture = makeFixture([
      buildReservation(),
      buildReservation({ contractId: 'contract-2', legacyId: '20260102-5' }),
    ]);

    expect(fixture.nativeElement.querySelectorAll('tbody tr')).toHaveLength(2);
  });

  it('link "Abrir" aponta para /rental/new com o id do contrato', () => {
    const fixture = makeFixture([buildReservation()]);
    const link: HTMLAnchorElement = fixture.nativeElement.querySelector('a.action-link');

    expect(link.getAttribute('href')).toContain('/rental/new');
    expect(link.getAttribute('href')).toContain('id=contract-1');
  });

  it('marca "Devolução Pendente" quando pendingReturn é true', () => {
    const fixture = makeFixture([buildReservation({ pendingReturn: true })]);
    const badge = fixture.nativeElement.querySelector('.pending-return-badge');

    expect(badge).not.toBeNull();
    expect(badge.textContent).toContain('Devolução Pendente');
  });

  it('exibe statusDescription quando pendingReturn é falso', () => {
    const fixture = makeFixture([buildReservation({ pendingReturn: false })]);
    const cells = fixture.nativeElement.querySelectorAll('tbody td');

    expect(fixture.nativeElement.querySelector('.pending-return-badge')).toBeNull();
    expect(cells[3].textContent).toContain('Assinado');
  });

  it('exibe o código da roupa no título', () => {
    const fixture = makeFixture([buildReservation()], 'ABC-7');
    const title = fixture.nativeElement.querySelector('#item-rentals-title');

    expect(title.textContent).toContain('ABC-7');
  });

  it('emite closed ao clicar no backdrop', () => {
    const fixture = makeFixture([buildReservation()]);
    const closedSpy = vi.fn();
    fixture.componentInstance.closed.subscribe(closedSpy);

    fixture.nativeElement.querySelector('.modal-backdrop').click();

    expect(closedSpy).toHaveBeenCalled();
  });

  it('emite closed ao clicar no botão Fechar', () => {
    const fixture = makeFixture([buildReservation()]);
    const closedSpy = vi.fn();
    fixture.componentInstance.closed.subscribe(closedSpy);

    fixture.nativeElement.querySelector('.btn-close-modal').click();

    expect(closedSpy).toHaveBeenCalled();
  });
});
