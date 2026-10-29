import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { ICustomer } from '../data/Customer.interface';
import { catchError, map, switchMap } from 'rxjs/operators';
import { Observable, throwError } from 'rxjs';
import { apiErrorMessage } from '../../../shared/utils/api-error';
import { APP_CONFIG } from '../../../shared/data/app-config.token';

export interface ICustomerPageResponse {
  content: ICustomer[];
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface CustomerListParams {
  name?: string;
  page?: number;
  size?: number;
  sort?: string;
}

@Injectable({
  providedIn: 'root',
})
export class CustomerService {
  private readonly apiBaseUrl = inject(APP_CONFIG).apiBaseUrl;

  constructor(
    private readonly httpClient: HttpClient
  ) {}

  private handleError(error: HttpErrorResponse): Observable<never> {
    console.error('CustomerService error:', error);
    return throwError(() => new Error(apiErrorMessage(error)));
  }

  public getCustomerById(customerId: string): Observable<ICustomer> {
    return this.httpClient.get<ICustomer>(`${this.apiBaseUrl}/api/v1/customers/byId/${customerId}`).pipe(
      catchError(this.handleError.bind(this)),
    );
  }

  public getCustomerByDocument(document: string): Observable<ICustomer> {
    return this.httpClient.get<ICustomer>(`${this.apiBaseUrl}/api/v1/customers/byDocument/${document}`).pipe(
      catchError(this.handleError.bind(this)),
    );
  }

  public getCustomerByLegacyId(id: number): Observable<ICustomer> {
    return this.httpClient.get<ICustomer>(`${this.apiBaseUrl}/api/v1/customers/byLegacyId/${id}`).pipe(
      catchError(this.handleError.bind(this)),
    );
  }

  public listCustomers(params?: CustomerListParams): Observable<ICustomerPageResponse> {
    let httpParams = new HttpParams();
    if (params?.name?.trim()) httpParams = httpParams.set('name', params.name.trim());
    if (params?.page != null) httpParams = httpParams.set('page', params.page);
    if (params?.size != null) httpParams = httpParams.set('size', params.size);
    if (params?.sort) httpParams = httpParams.set('sort', params.sort);

    return this.httpClient.get<ICustomerPageResponse>(`${this.apiBaseUrl}/api/v1/customers`, { params: httpParams }).pipe(
      catchError(this.handleError.bind(this)),
    );
  }

  public saveCustomer(customer: ICustomer): Observable<ICustomer> {
    if (customer.id) {
      return this.getCustomerById(customer.id).pipe(
        switchMap(() => this.updateCustomer(customer))
      )
    } else {
      return this.createCustomer(customer);
    }
  }

  private createCustomer(customer: ICustomer): Observable<ICustomer> {
    return this.httpClient.post<ICustomer>(`${this.apiBaseUrl}/api/v1/customers`, customer).pipe(
      catchError(this.handleError.bind(this)),
    );
  }

  private updateCustomer(customer: ICustomer): Observable<ICustomer> {
    return this.httpClient.put<ICustomer>(`${this.apiBaseUrl}/api/v1/customers`, customer).pipe(
      catchError(this.handleError.bind(this)),
    );
  }
  
}
