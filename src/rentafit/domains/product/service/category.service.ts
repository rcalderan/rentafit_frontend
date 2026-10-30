import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { apiErrorMessage } from '../../../shared/utils/api-error';
import { CategoryProductType, ICategory } from '../data/Product.interface';
import { APP_CONFIG } from '../../../shared/data/app-config.token';

@Injectable({
    providedIn: 'root'
})
export class CategoryService {
    private readonly config = inject(APP_CONFIG);
    private readonly apiUrl = `${this.config.apiBaseUrl}/api/v1/categories`;

    constructor(private readonly httpClient: HttpClient) { }

    private handleError(error: HttpErrorResponse): Observable<never> {
        console.error('CategoryService error:', error);
        return throwError(() => new Error(apiErrorMessage(error)));
    }

    /**
     * Busca uma categoria pelo ID
     */
    getById(id: string): Observable<ICategory> {
        return this.httpClient.get<ICategory>(`${this.apiUrl}/${id}`).pipe(
            catchError(this.handleError.bind(this))
        );
    }

    /**
     * Lista categorias por tipo de produto (RENTAL, RETAIL, ACCESSORY)
     */
    getByType(type: CategoryProductType): Observable<ICategory[]> {
        return this.httpClient.get<ICategory[]>(`${this.apiUrl}/type/${type}`).pipe(
            catchError(this.handleError.bind(this))
        );
    }

    /**
     * Lista todas as categorias ativas
     */
    getActive(): Observable<ICategory[]> {
        return this.httpClient.get<ICategory[]>(`${this.apiUrl}/active`).pipe(
            catchError(this.handleError.bind(this))
        );
    }

    /**
     * Salva uma categoria (cria ou atualiza)
     */
    save(category: ICategory): Observable<ICategory> {
        if (category.id) {
            return this.httpClient.put<ICategory>(`${this.apiUrl}/${category.id}`, category).pipe(
                catchError(this.handleError.bind(this))
            );
        }
        return this.httpClient.post<ICategory>(this.apiUrl, category).pipe(
            catchError(this.handleError.bind(this))
        );
    }

    /**
     * Remove uma categoria pelo ID
     */
    delete(id: string): Observable<void> {
        return this.httpClient.delete<void>(`${this.apiUrl}/${id}`).pipe(
            catchError(this.handleError.bind(this))
        );
    }
}
