import React, { useState, useEffect, useCallback } from "react";
import {
  BarChart3,
  TrendingUp,
  Clock,
  CheckCircle2,
  XCircle,
  Package,
  RefreshCw,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Users,
  ChevronRight,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
  LineChart,
  Line,
  Area,
  AreaChart,
} from "recharts";
import axios from "axios";

// ─── API ──────────────────────────────────────────────────────────────────────
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? "http://localhost:8000/api",
  headers: { "Content-Type": "application/json" },
});
api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem("token");
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// ─── Types ────────────────────────────────────────────────────────────────────
interface DeptStats {
  total: number;
  en_attente: number;
  transmises: number;
  traitees: number;
  refusees: number;
  par_mois?: { mois: number; total: number }[];
}

interface Detail {
  id_produit: number;
  produit?: { nom?: string; nom_produit?: string };
  nom?: string;
  quantite: number;
}
interface Demande {
  id_demande: number;
  date_demande: string;
  statut: string;
  demandeur?: { prenom: string; nom: string } | null;
  demandeur_nom?: string;
  demandeur_prenom?: string;
  details: Detail[];
}

// ─── Config ───────────────────────────────────────────────────────────────────
const MONTH_LABELS = [
  "Jan",
  "Fév",
  "Mar",
  "Avr",
  "Mai",
  "Jun",
  "Jul",
  "Aoû",
  "Sep",
  "Oct",
  "Nov",
  "Déc",
];

const PIE_COLORS = {
  EN_ATTENTE_DEPT: "#f59e0b",
  EN_ATTENTE_STOCK: "#8b5cf6",
  VALIDEE: "#10b981",
  PARTIELLEMENT_VALIDEE: "#3b82f6",
  LIVREE: "#0ea5e9",
  REFUSEE_DEPT: "#ef4444",
  REFUSEE_STOCK: "#dc2626",
};

const STATUS_LABELS: Record<string, string> = {
  EN_ATTENTE_DEPT: "En attente",
  EN_ATTENTE_STOCK: "Au stock",
  VALIDEE: "Validée",
  PARTIELLEMENT_VALIDEE: "Partielle",
  LIVREE: "Livrée",
  REFUSEE_DEPT: "Ref. dept",
  REFUSEE_STOCK: "Ref. stock",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (d: string) =>
  new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
const getProduitNom = (d: Detail) =>
  d.produit?.nom ??
  d.produit?.nom_produit ??
  d.nom ??
  `Produit #${d.id_produit}`;
const getDemandeurNom = (d: Demande) =>
  d.demandeur
    ? `${d.demandeur.prenom} ${d.demandeur.nom}`
    : `${d.demandeur_prenom ?? ""} ${d.demandeur_nom ?? ""}`.trim() || "—";

// ─── Skeleton ─────────────────────────────────────────────────────────────────
const Skeleton: React.FC<{ className?: string }> = ({ className = "" }) => (
  <div
    className={`bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse ${className}`}
  />
);

// ─── KPI Card ─────────────────────────────────────────────────────────────────
const KpiCard: React.FC<{
  label: string;
  value: number | undefined;
  icon: React.FC<{ className?: string }>;
  color: string;
  bgColor: string;
  loading: boolean;
  trend?: { value: number; positive: boolean };
  subtitle?: string;
}> = ({
  label,
  value,
  icon: Icon,
  color,
  bgColor,
  loading,
  trend,
  subtitle,
}) => (
  <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all">
    <div className="flex items-start justify-between mb-3">
      <div
        className={`w-11 h-11 rounded-xl ${bgColor} flex items-center justify-center shadow-sm`}
      >
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      {trend && (
        <div
          className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded-lg ${trend.positive ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400" : "bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400"}`}
        >
          {trend.positive ? (
            <ArrowUpRight className="w-3 h-3" />
          ) : (
            <ArrowDownRight className="w-3 h-3" />
          )}
          {trend.value}%
        </div>
      )}
    </div>
    {loading ? (
      <Skeleton className="h-9 w-20 mb-1" />
    ) : (
      <p className="text-3xl font-extrabold text-gray-900 dark:text-white">
        {value ?? 0}
      </p>
    )}
    <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-1">
      {label}
    </p>
    {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
  </div>
);

// ─── Custom Tooltip ───────────────────────────────────────────────────────────
const CustomTooltip: React.FC<{
  active?: boolean;
  payload?: any[];
  label?: string;
}> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg px-4 py-3">
      <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
        {label}
      </p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span
            className="w-2 h-2 rounded-full"
            style={{ background: p.color || p.fill }}
          />
          <span className="text-gray-500">{p.name}</span>
          <span className="font-bold text-gray-900 dark:text-white ml-auto">
            {p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// ─── Top Demandeurs ───────────────────────────────────────────────────────────
const getTopDemandeurs = (demandes: Demande[], n = 5) => {
  const counts: Record<string, number> = {};
  demandes.forEach((d) => {
    const nom = getDemandeurNom(d);
    counts[nom] = (counts[nom] ?? 0) + 1;
  });
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, n)
    .map(([nom, count]) => ({ nom, count }));
};

// ─── Top Produits ─────────────────────────────────────────────────────────────
const getTopProduits = (demandes: Demande[], n = 5) => {
  const counts: Record<string, number> = {};
  demandes.forEach((d) => {
    d.details?.forEach((det) => {
      const nom = getProduitNom(det);
      counts[nom] = (counts[nom] ?? 0) + det.quantite;
    });
  });
  return Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, n)
    .map(([nom, quantite]) => ({ nom, quantite }));
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const ManagerStatistiques: React.FC = () => {
  const [stats, setStats] = useState<DeptStats | null>(null);
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [statsRes, demandesRes] = await Promise.all([
        api.get("/dept/stats"),
        api.get("/dept/demandes"),
      ]);
      setStats(statsRes.data);
      setDemandes(demandesRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Derived data ──────────────────────────────────────────────────────────

  // Pie: repartition by statut
  const pieData = Object.entries(
    demandes.reduce<Record<string, number>>((acc, d) => {
      acc[d.statut] = (acc[d.statut] ?? 0) + 1;
      return acc;
    }, {}),
  )
    .filter(([, v]) => v > 0)
    .map(([statut, value]) => ({
      name: STATUS_LABELS[statut] ?? statut,
      value,
      color: PIE_COLORS[statut as keyof typeof PIE_COLORS] ?? "#94a3b8",
    }));

  // Bar: monthly activity from stats.par_mois OR computed from demandes
  const barData = (() => {
    if (stats?.par_mois?.length) {
      return stats.par_mois.map((m) => ({
        mois: MONTH_LABELS[m.mois - 1] ?? `M${m.mois}`,
        total: m.total,
      }));
    }
    // Fallback: compute from raw demandes
    const map: Record<number, number> = {};
    demandes.forEach((d) => {
      const m = new Date(d.date_demande).getMonth();
      map[m] = (map[m] ?? 0) + 1;
    });
    return Object.entries(map)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([m, total]) => ({ mois: MONTH_LABELS[Number(m)], total }));
  })();

  // Area: cumulative demandes by day (last 30 days)
  const areaData = (() => {
    const now = Date.now();
    const days = 30;
    const map: Record<string, number> = {};
    demandes.forEach((d) => {
      const date = new Date(d.date_demande);
      const diff = Math.floor((now - date.getTime()) / 86400000);
      if (diff <= days) {
        const key = date.toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "short",
        });
        map[key] = (map[key] ?? 0) + 1;
      }
    });
    return Object.entries(map)
      .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
      .map(([date, demandes]) => ({ date, demandes }));
  })();

  const topDemandeurs = getTopDemandeurs(demandes);
  const topProduits = getTopProduits(demandes);
  const tauxValidation = stats?.total
    ? Math.round(((stats.traitees ?? 0) / stats.total) * 100)
    : 0;
  const tauxRefus = stats?.total
    ? Math.round(((stats.refusees ?? 0) / stats.total) * 100)
    : 0;

  return (
    <div className="w-full min-h-screen  p-4 sm:p-6">
      <div className="w-full space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              Statistiques
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Vue d'ensemble de l'activité de votre département
            </p>
          </div>
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"
          >
            <RefreshCw
              className={`w-4 h-4 text-gray-500 ${refreshing ? "animate-spin" : ""}`}
            />
            Actualiser
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <KpiCard
            label="Total"
            value={stats?.total}
            icon={BarChart3}
            color="text-white"
            bgColor="bg-indigo-600"
            loading={loading}
          />
          <KpiCard
            label="En attente"
            value={stats?.en_attente}
            icon={Clock}
            color="text-white"
            bgColor="bg-amber-500"
            loading={loading}
            subtitle="À traiter"
          />
          <KpiCard
            label="Transmises"
            value={stats?.transmises}
            icon={ArrowUpRight as any}
            color="text-white"
            bgColor="bg-violet-500"
            loading={loading}
            subtitle="Au stock"
          />
          <KpiCard
            label="Traitées"
            value={stats?.traitees}
            icon={CheckCircle2}
            color="text-white"
            bgColor="bg-emerald-500"
            loading={loading}
            subtitle={`${tauxValidation}% du total`}
          />
          <KpiCard
            label="Refusées"
            value={stats?.refusees}
            icon={XCircle}
            color="text-white"
            bgColor="bg-red-500"
            loading={loading}
            subtitle={`${tauxRefus}% du total`}
          />
        </div>

        {/* Row 2: Charts */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Monthly bar chart */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                Activité mensuelle
              </h3>
              <span className="text-xs text-gray-400">
                {new Date().getFullYear()}
              </span>
            </div>
            {loading ? (
              <div className="h-[200px] flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : barData.length === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-sm text-gray-400">
                Pas encore de données
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={barData}
                  margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(156,163,175,0.15)"
                  />
                  <XAxis
                    dataKey="mois"
                    tick={{ fontSize: 11, fill: "#9ca3af" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#9ca3af" }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar
                    dataKey="total"
                    name="Demandes"
                    fill="#6366f1"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Pie chart: statut distribution */}
          <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
            <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-4">
              Répartition des statuts
            </h3>
            {loading ? (
              <div className="h-[180px] flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : pieData.length === 0 ? (
              <div className="h-[180px] flex items-center justify-center text-sm text-gray-400">
                Pas de données
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={170}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={78}
                      paddingAngle={3}
                      dataKey="value"
                      stroke="none"
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-2">
                  {pieData.map((s) => (
                    <div
                      key={s.name}
                      className="flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ background: s.color }}
                        />
                        <span className="text-gray-500 dark:text-gray-400">
                          {s.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 dark:text-white">
                          {s.value}
                        </span>
                        <span className="text-gray-400">
                          {stats?.total
                            ? `${Math.round((s.value / (stats.total ?? 1)) * 100)}%`
                            : ""}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Row 3: Area + Top lists */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Area chart: recent 30 days */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                Tendance (30 derniers jours)
              </h3>
            </div>
            {loading ? (
              <div className="h-[160px] flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : areaData.length < 2 ? (
              <div className="h-[160px] flex items-center justify-center text-sm text-gray-400">
                Pas assez de données
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart
                  data={areaData}
                  margin={{ top: 0, right: 0, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="colorDemandes"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(156,163,175,0.15)"
                  />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="demandes"
                    name="Demandes"
                    stroke="#6366f1"
                    strokeWidth={2}
                    fill="url(#colorDemandes)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Top demandeurs */}
          <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-indigo-500" />
              <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                Top demandeurs
              </h3>
            </div>
            {loading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : topDemandeurs.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">
                Aucune données
              </p>
            ) : (
              <div className="space-y-2">
                {topDemandeurs.map((d, i) => {
                  const pct = topDemandeurs[0].count
                    ? Math.round((d.count / topDemandeurs[0].count) * 100)
                    : 0;
                  return (
                    <div key={d.nom} className="flex items-center gap-3">
                      <span
                        className={`text-xs font-bold w-5 shrink-0 ${i === 0 ? "text-amber-500" : "text-gray-400"}`}
                      >
                        #{i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 truncate">
                          {d.nom}
                        </p>
                        <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-1.5 mt-1">
                          <div
                            className="bg-indigo-500 h-1.5 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 shrink-0">
                        {d.count}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Row 4: Top produits + taux */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Top produits demandés */}
          <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Package className="w-4 h-4 text-indigo-500" />
              <h3 className="font-bold text-sm text-gray-900 dark:text-white">
                Produits les plus demandés
              </h3>
            </div>
            {loading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-10" />
                ))}
              </div>
            ) : topProduits.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">
                Aucune donnée
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart
                  data={topProduits}
                  layout="vertical"
                  margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="rgba(156,163,175,0.15)"
                    horizontal={false}
                  />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <YAxis
                    type="category"
                    dataKey="nom"
                    tick={{ fontSize: 10, fill: "#9ca3af" }}
                    axisLine={false}
                    tickLine={false}
                    width={120}
                    tickFormatter={(v) =>
                      v.length > 14 ? v.slice(0, 14) + "…" : v
                    }
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar
                    dataKey="quantite"
                    name="Qté demandée"
                    fill="#818cf8"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Taux cards */}
          <div className="grid grid-cols-2 gap-4 content-start">
            {[
              {
                label: "Taux de traitement",
                value: tauxValidation,
                subtitle: "des demandes ont été traitées",
                color: "text-emerald-600",
                ring: "border-emerald-400",
                bg: "bg-emerald-50 dark:bg-emerald-900/20",
              },
              {
                label: "Taux de refus",
                value: tauxRefus,
                subtitle: "des demandes ont été refusées",
                color: "text-red-600",
                ring: "border-red-400",
                bg: "bg-red-50 dark:bg-red-900/20",
              },
              {
                label: "En attente",
                value: stats?.en_attente
                  ? Math.round((stats.en_attente / (stats.total || 1)) * 100)
                  : 0,
                subtitle: "nécessitent une action",
                color: "text-amber-600",
                ring: "border-amber-400",
                bg: "bg-amber-50 dark:bg-amber-900/20",
              },
              {
                label: "Au stock",
                value: stats?.transmises
                  ? Math.round((stats.transmises / (stats.total || 1)) * 100)
                  : 0,
                subtitle: "transmises au stock",
                color: "text-violet-600",
                ring: "border-violet-400",
                bg: "bg-violet-50 dark:bg-violet-900/20",
              },
            ].map((t) => (
              <div
                key={t.label}
                className={`${t.bg} border ${t.ring} rounded-2xl p-5 flex flex-col items-center text-center`}
              >
                {loading ? (
                  <Skeleton className="w-16 h-16 rounded-full mb-3" />
                ) : (
                  <div
                    className={`w-16 h-16 rounded-full border-4 ${t.ring} flex items-center justify-center mb-3`}
                  >
                    <span className={`text-xl font-extrabold ${t.color}`}>
                      {t.value}%
                    </span>
                  </div>
                )}
                <p className={`text-xs font-bold ${t.color}`}>{t.label}</p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                  {t.subtitle}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManagerStatistiques;
