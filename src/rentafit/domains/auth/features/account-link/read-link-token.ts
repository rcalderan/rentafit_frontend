import { ActivatedRoute, Router } from '@angular/router';

/**
 * Lê o token do link enviado por e-mail e o remove da barra de endereço/histórico,
 * para que não vaze por histórico do navegador, prints de tela ou cabeçalho Referer.
 * Ex.: `readLinkToken(route, router)` em `/auth/unlock?token=abc` → `'abc'` e URL vira `/auth/unlock`.
 */
export function readLinkToken(route: ActivatedRoute, router: Router): string | null {
  const token = route.snapshot.queryParamMap.get('token');
  if (token) {
    router.navigate([], { relativeTo: route, queryParams: {}, replaceUrl: true });
  }
  return token && /^[A-Za-z0-9_-]{20,128}$/.test(token) ? token : null;
}
