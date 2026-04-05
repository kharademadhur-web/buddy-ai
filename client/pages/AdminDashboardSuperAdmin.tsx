import { useState, useEffect } from "react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Users,
  Building2,
  TrendingUp,
  AlertCircle,
  Loader2,
  Plus,
  Eye,
} from "lucide-react";
import { apiFetch } from "@/lib/api-base";

interface ClinicStats {
  clinic_id: string;
  name: string;
  code: string;
  status: string;
  totalUsers: number;
  doctors: number;
  receptionists: number;
  totalRevenue: string;
  paidRevenue: string;
  pendingRevenue: string;
}

interface RevenueData {
  totalRevenue: string;
  paidRevenue: string;
  pendingRevenue: string;
  failedRevenue: string;
  totalTransactions: number;
}

interface UserStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  doctors: number;
  receptionists: number;
  independentDoctors: number;
  superAdmins: number;
}

export default function AdminDashboardSuperAdmin() {
  const { user } = useAdminAuth();
  const [clinicStats, setClinicStats] = useState<ClinicStats[]>([]);
  const [revenueData, setRevenueData] = useState<RevenueData | null>(null);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const accessToken = sessionStorage.getItem("admin_access_token") || "";

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch revenue data
        const revenueResponse = await apiFetch("/api/admin/analytics/revenue");
        if (revenueResponse.ok) {
          const revenueJson = await revenueResponse.json();
          setRevenueData(revenueJson.revenue);
        }

        // Fetch user stats
        const userResponse = await apiFetch("/api/admin/analytics/users");
        if (userResponse.ok) {
          const userJson = await userResponse.json();
          setUserStats(userJson.stats);
        }

        // Fetch clinic stats
        const clinicResponse = await apiFetch("/api/admin/analytics/clinics");
        if (clinicResponse.ok) {
          const clinicJson = await clinicResponse.json();
          setClinicStats(clinicJson.clinics);
        }

        // Fetch trend data
        const trendResponse = await apiFetch("/api/admin/analytics/trends?months=6");
        if (trendResponse.ok) {
          const trendJson = await trendResponse.json();
          setTrendData(trendJson.trends);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load analytics");
        console.error("Analytics fetch error:", err);
      } finally {
        setIsLoading(false);
      }
    };

    if (accessToken) {
      fetchAnalytics();
    }
  }, [accessToken]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const revenueChartData = revenueData
    ? [
        { name: "Paid", value: parseFloat(revenueData.paidRevenue), fill: "#10b981" },
        { name: "Pending", value: parseFloat(revenueData.pendingRevenue), fill: "#f59e0b" },
        { name: "Failed", value: parseFloat(revenueData.failedRevenue), fill: "#ef4444" },
      ]
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
              <p className="text-gray-600 mt-1">Welcome back, {user?.name}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline">
                <Eye className="mr-2 h-4 w-4" />
                View Profile
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        {/* Error Alert */}
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {/* Total Clinics */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Clinics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-gray-900">
                  {clinicStats.length}
                </div>
                <Building2 className="h-8 w-8 text-blue-500 opacity-20" />
              </div>
            </CardContent>
          </Card>

          {/* Total Users */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Users
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-gray-900">
                  {userStats?.totalUsers || 0}
                </div>
                <Users className="h-8 w-8 text-green-500 opacity-20" />
              </div>
            </CardContent>
          </Card>

          {/* Total Revenue */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total Revenue
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold text-gray-900">
                    ₹{revenueData?.totalRevenue || "0"}
                  </div>
                  <p className="text-xs text-green-600 mt-1">
                    Paid: ₹{revenueData?.paidRevenue || "0"}
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-500 opacity-20" />
              </div>
            </CardContent>
          </Card>

          {/* Pending Approvals */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                Active Doctors
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="text-2xl font-bold text-gray-900">
                  {userStats?.doctors || 0}
                </div>
                <Users className="h-8 w-8 text-orange-500 opacity-20" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts and Tables */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="clinics">Clinics</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Revenue Pie Chart */}
              <Card>
                <CardHeader>
                  <CardTitle>Revenue Distribution</CardTitle>
                  <CardDescription>Payment status breakdown</CardDescription>
                </CardHeader>
                <CardContent>
                  {revenueChartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={revenueChartData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, value }) => `${name}: ₹${value}`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {revenueChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => `₹${value}`} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-gray-500">
                      No revenue data available
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* User Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle>User Distribution</CardTitle>
                  <CardDescription>Users by role</CardDescription>
                </CardHeader>
                <CardContent>
                  {userStats ? (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Doctors</span>
                        <Badge variant="default">{userStats.doctors}</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Receptionists</span>
                        <Badge variant="secondary">{userStats.receptionists}</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Independent Doctors</span>
                        <Badge variant="outline">
                          {userStats.independentDoctors}
                        </Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Active Users</span>
                        <Badge variant="default">{userStats.activeUsers}</Badge>
                      </div>
                    </div>
                  ) : (
                    <div className="text-gray-500">No user data available</div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Trends Chart */}
            {trendData.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Revenue Trends</CardTitle>
                  <CardDescription>Last 6 months</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={trendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip formatter={(value) => `₹${value}`} />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="paid"
                        stroke="#10b981"
                        name="Paid"
                      />
                      <Line
                        type="monotone"
                        dataKey="pending"
                        stroke="#f59e0b"
                        name="Pending"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Clinics Tab */}
          <TabsContent value="clinics">
            <Card>
              <CardHeader className="flex justify-between items-center">
                <div>
                  <CardTitle>Clinics</CardTitle>
                  <CardDescription>Manage all clinics in the system</CardDescription>
                </div>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Clinic
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-4">Name</th>
                        <th className="text-left py-2 px-4">Code</th>
                        <th className="text-left py-2 px-4">Users</th>
                        <th className="text-left py-2 px-4">Revenue</th>
                        <th className="text-left py-2 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clinicStats.map((clinic) => (
                        <tr key={clinic.clinic_id} className="border-b hover:bg-gray-50">
                          <td className="py-3 px-4">{clinic.name}</td>
                          <td className="py-3 px-4 font-mono text-xs">{clinic.code}</td>
                          <td className="py-3 px-4">{clinic.totalUsers}</td>
                          <td className="py-3 px-4">₹{clinic.totalRevenue}</td>
                          <td className="py-3 px-4">
                            <Badge
                              variant={
                                clinic.status === "active" ? "default" : "secondary"
                              }
                            >
                              {clinic.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>Users Summary</CardTitle>
                <CardDescription>Overall user statistics</CardDescription>
              </CardHeader>
              <CardContent>
                {userStats && (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Total Users</p>
                      <p className="text-2xl font-bold">{userStats.totalUsers}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Active</p>
                      <p className="text-2xl font-bold text-green-600">
                        {userStats.activeUsers}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Inactive</p>
                      <p className="text-2xl font-bold text-gray-600">
                        {userStats.inactiveUsers}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Doctors</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {userStats.doctors}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Receptionists</p>
                      <p className="text-2xl font-bold text-purple-600">
                        {userStats.receptionists}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Super Admins</p>
                      <p className="text-2xl font-bold text-red-600">
                        {userStats.superAdmins}
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
