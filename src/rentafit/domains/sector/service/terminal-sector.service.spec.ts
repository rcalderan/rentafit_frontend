import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { Sector } from '../data/sector.model';
import { TerminalSectorService } from './terminal-sector.service';

const STORAGE_KEY = 'rentafit.terminal.sectorId';

const makeSector = (id: string, overrides: Partial<Sector> = {}): Sector => ({
  id,
  issuerCnpj: '12345678000190',
  name: `Setor ${id}`,
  code: `S${id}`,
  active: true,
  isDefault: false,
  ...overrides,
});

describe('TerminalSectorService', () => {
  let service: TerminalSectorService;

  beforeEach(() => {
    localStorage.clear();
    service = TestBed.inject(TerminalSectorService);
  });

  it('inicia sem setor quando o storage está vazio', () => {
    expect(service.sectorId()).toBeNull();
    expect(service.sector()).toBeNull();
    expect(service.configured()).toBe(false);
  });

  it('assign vincula o setor e persiste no localStorage', () => {
    const sector = makeSector('sec-a');

    service.assign(sector);

    expect(service.sectorId()).toBe('sec-a');
    expect(service.sector()).toEqual(sector);
    expect(service.configured()).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('sec-a');
  });

  it('clear remove o vínculo e o storage', () => {
    service.assign(makeSector('sec-a'));

    service.clear();

    expect(service.sectorId()).toBeNull();
    expect(service.sector()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('resolveFrom cruza o id persistido com a lista da API', () => {
    localStorage.setItem(STORAGE_KEY, 'sec-b');
    const fresh = new TerminalSectorService();
    const sector = makeSector('sec-b');

    expect(fresh.resolveFrom([makeSector('sec-a'), sector])).toEqual(sector);
    expect(fresh.sector()).toEqual(sector);
  });

  it('resolveFrom limpa o vínculo quando o setor não existe mais', () => {
    localStorage.setItem(STORAGE_KEY, 'sec-removida');
    const fresh = new TerminalSectorService();

    expect(fresh.resolveFrom([makeSector('sec-a')])).toBeNull();
    expect(fresh.sectorId()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
