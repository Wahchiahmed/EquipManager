import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard, Package, ClipboardList, Bell, Users,
  Settings, BarChart3, Boxes, ShieldCheck, FileText,
  Building2, LogOut, ChevronLeft, ChevronRight, UserPlus,
} from 'lucide-react';
import { Role } from '@/types';

interface NavItem {
  label: string;
  to: string;
  icon: React.ElementType;
  badge?: number;          // optional numeric badge (amber dot when > 0)
}

const navByRole: Record<Role, NavItem[]> = {
  EMPLOYEE: [
    { label: 'Tableau de bord',   to: '/dashboard',     icon: LayoutDashboard },
    { label: 'Mes demandes',       to: '/my-requests',   icon: ClipboardList   },
    { label: 'Nouvelle demande',   to: '/new-request',   icon: Package         },
    { label: 'Catalogue produits', to: '/catalog',       icon: Boxes           },
    { label: 'Paramètres',         to: '/settings',      icon: Settings        },
  ],
  RESPONSABLE_DEPARTEMENT: [
    { label: 'Tableau de bord',      to: '/dashboard',        icon: LayoutDashboard },
    { label: 'Demandes en attente',  to: '/pending-requests', icon: ClipboardList   },
    { label: 'Toutes les demandes',  to: '/all-requests',     icon: FileText        },
    { label: 'Statistiques',         to: '/statistics',       icon: BarChart3       },
    { label: 'Paramètres',           to: '/settings',         icon: Settings        },
  ],
  RESPONSABLE_STOCK: [
    { label: 'Tableau de bord',      to: '/dashboard',      icon: LayoutDashboard },
    { label: 'Demandes à valider',   to: '/stock-requests', icon: ClipboardList   },
    { label: 'Gestion des produits', to: '/products',       icon: Boxes           },
    { label: 'Mouvements de stock',  to: '/movements',      icon: BarChart3       },
    { label: 'Alertes stock',        to: '/alerts',         icon: Bell            },
    { label: 'Paramètres',           to: '/settings',       icon: Settings        },
  ],
  ADMIN: [
    { label: 'Tableau de bord',    to: '/dashboard',        icon: LayoutDashboard },
    { label: 'Utilisateurs',       to: '/users',            icon: Users           },
    { label: 'Départements',       to: '/departments',      icon: Building2       },
    { label: 'Produits & Stock',   to: '/produits-stock',   icon: Boxes           },
    { label: 'Toutes les demandes',to: '/toutes-demandes',  icon: ClipboardList   },
    { label: 'Mouvements stock',   to: '/mouvements-stock', icon: BarChart3       },
    { label: 'Audit & Historique', to: '/audit',            icon: ShieldCheck     },
    { label: 'Inscriptions',       to: '/inscriptions',     icon: UserPlus        }, // ★ NEW
    { label: 'Paramètres',         to: '/settings',         icon: Settings        },
  ],
};

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  /** Pass the pending inscription count from a parent that fetches it */
  inscriptionBadge?: number;
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed, onToggle, inscriptionBadge = 0 }) => {
  const { currentUser, logout } = useAuth();
  const location = useLocation();

  if (!currentUser) return null;

  // Inject live badge into the Inscriptions item for ADMIN
  const navItems: NavItem[] = navByRole[currentUser.role_nom].map(item =>
    item.to === '/inscriptions' ? { ...item, badge: inscriptionBadge } : item
  );

  const roleLabels: Record<Role, string> = {
    EMPLOYEE:                 'Employé',
    RESPONSABLE_DEPARTEMENT:  'Resp. Département',
    RESPONSABLE_STOCK:        'Resp. Stock',
    ADMIN:                    'Administrateur',
  };

  const roleColors: Record<Role, string> = {
    EMPLOYEE:                'bg-blue-500',
    RESPONSABLE_DEPARTEMENT: 'bg-amber-500',
    RESPONSABLE_STOCK:       'bg-purple-500',
    ADMIN:                   'bg-red-500',
  };

  return (
    <aside className={cn(
      'relative flex flex-col h-screen sidebar-bg border-r border-sidebar-border transition-all duration-300 ease-in-out shrink-0',
      collapsed ? 'w-16' : 'w-64'
    )}>
      {/* Logo */}
      <div className={cn('flex items-center h-16 px-4 border-b border-sidebar-border', collapsed && 'justify-center')}>
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center shrink-0 shadow-brand">
          <Boxes className="w-4 h-4 text-primary-foreground" />
        </div>
        {!collapsed && (
          <div className="ml-3 min-w-0">
            <p className="text-sidebar-fg-active font-bold text-sm truncate">EquipManager</p>
            <p className="text-sidebar-fg text-xs truncate">v2.0 Pro</p>
          </div>
        )}
      </div>

      {/* Toggle button */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-brand hover:scale-110 transition-transform z-10"
      >
        {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
      </button>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto scrollbar-thin">
        <div className="space-y-0.5 px-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to;
            const hasBadge = (item.badge ?? 0) > 0;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                title={collapsed ? item.label : undefined}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-brand'
                    : 'text-sidebar-fg hover:bg-sidebar-accent hover:text-sidebar-fg-active',
                  collapsed && 'justify-center px-0'
                )}
              >
                {/* Icon with badge dot when collapsed */}
                <div className="relative shrink-0">
                  <item.icon className="w-4 h-4" />
                  {collapsed && hasBadge && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-500 ring-1 ring-sidebar-bg" />
                  )}
                </div>

                {/* Label + badge count when expanded */}
                {!collapsed && (
                  <>
                    <span className="truncate flex-1">{item.label}</span>
                    {hasBadge && (
                      <span className="ml-auto min-w-[20px] h-5 bg-amber-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1.5 shrink-0">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
      </nav>

      {/* User section */}
      <div className={cn('border-t border-sidebar-border p-3', collapsed && 'flex justify-center')}>
        {collapsed ? (
          <button
            onClick={logout}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-sidebar-fg hover:bg-sidebar-accent hover:text-sidebar-fg-active transition-colors"
            title="Déconnexion"
          >
            <LogOut className="w-4 h-4" />
          </button>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <span className="text-primary-foreground text-xs font-semibold">
                  {currentUser.prenom[0]}{currentUser.nom[0]}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sidebar-fg-active text-xs font-semibold truncate">
                  {currentUser.prenom} {currentUser.nom}
                </p>
                <span className={cn('inline-block text-[10px] px-1.5 py-0.5 rounded font-medium text-white', roleColors[currentUser.role_nom])}>
                  {roleLabels[currentUser.role_nom]}
                </span>
              </div>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs text-sidebar-fg hover:bg-sidebar-accent hover:text-status-rejected transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Déconnexion
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};

export default Sidebar;