import { Routes } from '@angular/router';
import { Login } from './domains/auth/features/login/login.component';
import { MainLayout } from './shared/layout/main-layout/main-layout';
import { authGuard } from './domains/auth/guards/auth.guard';
import { roleGuard } from './domains/auth/guards/role.guard';
import { UserRole } from './domains/auth/data/user.model';

export const routes: Routes = [
    { path: '', redirectTo: 'auth/login', pathMatch: 'full' },
    { path: 'auth/login', component: Login },
    {
        path: 'auth/register',
        loadComponent: () => import('./domains/auth/features/register/register.component').then(m => m.RegisterComponent)
    },
    {
        path: 'auth/setup-credentials',
        loadComponent: () => import('./domains/auth/features/setup-credentials/setup-credentials.component').then(m => m.SetupCredentialsComponent)
    },
    {
        path: 'auth/change-password',
        loadComponent: () => import('./domains/auth/features/change-password/change-password.component').then(m => m.ChangePasswordComponent)
    },
    {
        path: 'auth/issuer-setup',
        loadComponent: () => import('./domains/auth/features/issuer-setup/issuer-setup.component').then(m => m.IssuerSetupComponent)
    },
    {
        path: 'auth/issuer-confirm',
        loadComponent: () => import('./domains/auth/features/issuer-confirm/issuer-confirm.component').then(m => m.IssuerConfirmComponent),
        canActivate: [roleGuard],
        data: { roles: [UserRole.MANAGER, UserRole.EMPLOYEE], title: 'Confirmar Emitente' }
    },
    {
        path: '',
        component: MainLayout,
        canActivate: [authGuard],
        children: [
            {
                path: 'account/profile',
                loadComponent: () => import('./domains/account/features/profile/account-profile.component').then(m => m.AccountProfileComponent),
                data: { title: 'Minha Conta' }
            },
            {
                path: 'customer/registration',
                loadComponent: () => import('./domains/customer/features/registration/registration.component').then(m => m.RegistrationComponent),
                canActivate: [roleGuard],
                data: { roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE], title: 'Clientes', tabGroup: 'customer' }
            },
            {
                path: 'customer/legacy',
                loadComponent: () => import('./domains/customer/features/legacy/clientes/clientes').then(m => m.ClientesLegacy),
                canActivate: [roleGuard],
                data: { roles: [UserRole.ADMIN], title: 'Clientes (Legacy)' }
            },
            {
                path: 'product/registration',
                loadComponent: () => import('./domains/product/components/rent-registration/rent-registration.component').then(m => m.Registration),
                canActivate: [roleGuard],
                data: { roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE], title: 'Cadastro de Produtos', tabGroup: 'product' }
            },
            {
                path: 'product/retail-registration',
                loadComponent: () => import('./domains/product/components/retail-registration/retail-registration.component').then(m => m.RetailRegistration),
                canActivate: [roleGuard],
                data: { roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE], title: 'Produtos para Venda', tabGroup: 'product' }
            },
            {
                path: 'product/search',
                loadComponent: () => import('./domains/product/components/search/search').then(m => m.Search),
                data: { title: 'Busca de Produtos' }
            },
            {
                path: 'product/stock',
                loadComponent: () => import('./domains/product/components/stock/stock').then(m => m.Stock),
                canActivate: [roleGuard],
                data: { roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE], title: 'Estoque' }
            },
            {
                path: 'rental/new',
                loadComponent: () => import('./domains/rental/features/new-rental/new-rental.component').then(m => m.NewRental),
                canActivate: [roleGuard],
                data: { roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE], title: 'Nova Locação', tabGroup: 'rental' }
            },
            {
                path: 'rental/management',
                loadComponent: () => import('./domains/rental/features/management/management').then(m => m.Management),
                canActivate: [roleGuard],
                data: { roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE], title: 'Gestão de Locações' }
            },
            {
                path: 'rental/return/:contractId',
                loadComponent: () => import('./domains/rental/features/return/return.component').then(m => m.ReturnComponent),
                canActivate: [roleGuard],
                data: { roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE], title: 'Devolução', tabGroup: 'rental' }
            },
            {
                path: 'rental/daily-report',
                loadComponent: () => import('./domains/rental/features/daily-report/daily-report.component').then(m => m.DailyReportComponent),
                canActivate: [roleGuard],
                data: { roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE], title: 'Relatório Diário de Locação' }
            },
            {
                path: 'rental/nfse-view',
                loadComponent: () => import('./domains/finance/features/nfse-view/nfse-view.component').then(m => m.NfseViewComponent),
                canActivate: [roleGuard],
                data: { roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE], title: 'NFS-e de Locações' }
            },
            {
                path: 'rental/nfse-view/:id',
                loadComponent: () => import('./domains/finance/features/nfse-view/nfse-view-detail.component').then(m => m.NfseViewDetailComponent),
                canActivate: [roleGuard],
                data: { roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE], title: 'Detalhe da NFS-e' }
            },
            {
                path: 'rental/legacy',
                loadComponent: () => import('./domains/rental/features/legacy/locacao/locacao').then(m => m.LocacaoComponent),
                canActivate: [roleGuard],
                data: { roles: [UserRole.ADMIN], title: 'Locação (Legacy)' }
            },
            {
                path: 'customer/devolucao-legacy',
                loadComponent: () => import('./domains/customer/features/legacy/devolucao/devolucao').then(m => m.DevolucaoLegacy),
                canActivate: [roleGuard],
                data: { roles: [UserRole.ADMIN], title: 'Devolução (Legacy)' }
            },
            {
                path: 'finance/relatorio-locacao-legacy',
                loadComponent: () => import('./domains/finance/features/legacy/relatorios/relatorio-locacao').then(m => m.RelatorioLocacaoLegacy),
                canActivate: [roleGuard],
                data: { roles: [UserRole.ADMIN], title: 'Relatório de Locação' }
            },
            {
                path: 'finance/relatorio-devolucao-legacy',
                loadComponent: () => import('./domains/finance/features/legacy/relatorios/relatorio-devolucao').then(m => m.RelatorioDevolucaoLegacy),
                canActivate: [roleGuard],
                data: { roles: [UserRole.ADMIN], title: 'Relatório de Devolução' }
            },
            {
                path: 'sales/new',
                loadComponent: () => import('./domains/sales/features/new-sale/new-sale.component').then(m => m.NewSale),
                canActivate: [roleGuard],
                data: { roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE], title: 'Nova Venda', tabGroup: 'sales' }
            },
            {
                path: 'sales/management',
                loadComponent: () => import('./domains/sales/features/management/sales-management.component').then(m => m.SalesManagement),
                canActivate: [roleGuard],
                data: { roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE], title: 'Gestão de Vendas' }
            },
            {
                path: 'sales/nfe-view',
                loadComponent: () => import('./domains/finance/features/nfe-view/nfe-view.component').then(m => m.NfeViewComponent),
                canActivate: [roleGuard],
                data: { roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE], title: 'NF-e de Vendas' }
            },
            {
                path: 'sales/nfe-view/:id',
                loadComponent: () => import('./domains/finance/features/nfe-view/nfe-view-detail.component').then(m => m.NfeViewDetailComponent),
                canActivate: [roleGuard],
                data: { roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE], title: 'Detalhe da NF-e' }
            },
            {
                path: 'home/dashboard',
                loadComponent: () => import('./domains/home/features/dashboard.component').then(m => m.HomeDashboard),
                canActivate: [roleGuard],
                data: { roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE], title: 'Dashboard' }
            },
            {
                path: 'finance/dashboard',
                loadComponent: () => import('./domains/finance/features/dashboard/dashboard').then(m => m.Dashboard),
                canActivate: [roleGuard],
                data: { roles: [UserRole.ADMIN, UserRole.MANAGER], title: 'Financeiro', tabGroup: 'admin' }
            },
            {
                path: 'finance/nfse-backup',
                loadComponent: () => import('./domains/finance/features/nfse-upload/nfse-upload').then(m => m.NfseUpload),
                canActivate: [roleGuard],
                data: { roles: [UserRole.ADMIN, UserRole.MANAGER], title: 'NFS-e Backup', tabGroup: 'admin' }
            },
            {
                path: 'admin/user-management',
                loadComponent: () => import('./domains/admin/features/user-management/user-management.component').then(m => m.UserManagementComponent),
                canActivate: [roleGuard],
                data: { roles: [UserRole.ADMIN, UserRole.MANAGER], title: 'Gerenciamento de Usuários', tabGroup: 'admin' }
            },
            {
                path: 'admin/cnpj',
                loadComponent: () => import('./domains/admin/features/cnpj/cnpj.component').then(m => m.CnpjComponent),
                canActivate: [roleGuard],
                data: { roles: [UserRole.ADMIN, UserRole.MANAGER], title: 'CNPJ', tabGroup: 'admin' }
            },
            {
                path: 'admin/system',
                loadComponent: () => import('./domains/admin/features/system/system.component').then(m => m.SystemComponent),
                canActivate: [roleGuard],
                data: { roles: [UserRole.ADMIN, UserRole.MANAGER], title: 'Sistema', tabGroup: 'admin' }
            },
            {
                path: 'admin/print-templates',
                loadComponent: () => import('./domains/print/components/template-list/template-list.component').then(m => m.TemplateListComponent),
                canActivate: [roleGuard],
                data: { roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE], title: 'Templates de Impressão', tabGroup: 'admin' }
            },
            {
                path: 'admin/print-templates/editor/:id',
                loadComponent: () => import('./domains/print/components/page-editor/page-editor.component').then(m => m.PageEditorComponent),
                canActivate: [roleGuard],
                data: { roles: [UserRole.ADMIN, UserRole.MANAGER], title: 'Editor de Template' }
            },
            {
                path: 'admin/print-templates/new',
                loadComponent: () => import('./domains/print/components/page-editor/page-editor.component').then(m => m.PageEditorComponent),
                canActivate: [roleGuard],
                data: { roles: [UserRole.ADMIN, UserRole.MANAGER], title: 'Novo Template' }
            }
        ]
    },
    { path: '**', redirectTo: 'auth/login' }
];
