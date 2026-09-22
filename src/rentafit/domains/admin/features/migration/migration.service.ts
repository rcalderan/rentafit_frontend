import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../../../environments/environment';
import { MigrationComparison, MigrationSession } from './migration.model';

@Injectable({ providedIn: 'root' })
export class MigrationService {
    private readonly api = `${environment.apiBaseUrl}/api/v1/migration`;
    private readonly http = inject(HttpClient);

    upload(file: File): Observable<MigrationSession> {
        const formData = new FormData();
        formData.append('file', file);
        return this.http.post<MigrationSession>(`${this.api}/upload`, formData);
    }

    getSession(sessionId: string): Observable<MigrationSession> {
        return this.http.get<MigrationSession>(`${this.api}/sessions/${sessionId}`);
    }

    promote(sessionId: string): Observable<{ status: string; message: string }> {
        return this.http.post<{ status: string; message: string }>(
            `${this.api}/sessions/${sessionId}/promote`,
            null,
            { params: { confirm: 'true' } },
        );
    }

    compare(): Observable<MigrationComparison> {
        return this.http.get<MigrationComparison>(`${this.api}/compare`);
    }
}
