import { IRetailItem } from '../../product/data/Product.interface';
import { ISalesOrder } from '../data/sales-order.interface';

/** formType dos rascunhos de pedido de venda — deve bater com NewSale.formType. */
export const SALES_ORDER_FORM_TYPE = 'sales-order';

/** Espelha o snapshot produzido por NewSale.createDraftSnapshot (campos mínimos). */
export interface SaleDraftSnapshot {
  order: ISalesOrder;
  selectedCustomer: { id: string; name: string; document: string } | null;
  customerSearch: string;
  orderNotes: string;
  orderDiscount: number;
}

/**
 * Monta o rascunho de um pedido de venda novo já contendo o produto
 * recém-cadastrado (1 unidade). O chamador persiste via
 * SessionFormStorageService sob um draftId próprio e abre a aba `/sales/new`
 * com esse draftId — o NewSale restaura o rascunho em `order` (DRAFT local,
 * ainda sem id de backend).
 */
export function buildSaleDraftWithItem(product: IRetailItem): SaleDraftSnapshot {
  const specs = [product.size, product.color].filter(Boolean).join(' ');
  const description = specs ? `${product.name} — ${specs}` : product.name;

  return {
    order: {
      status: 'DRAFT',
      discountValue: 0,
      invoiceStatus: 'NONE',
      items: [
        {
          retailProductId: product.id!,
          sku: product.sku ?? '',
          description,
          unitPrice: product.value,
          quantity: 1,
          discountValue: 0,
          itemStatus: 'PENDING',
          needsTailoring: false,
        },
      ],
      payments: [],
    },
    selectedCustomer: null,
    customerSearch: '',
    orderNotes: '',
    orderDiscount: 0,
  };
}
