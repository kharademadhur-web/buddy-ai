import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  CreditCard,
  Check,
  Loader,
  AlertCircle,
  Download,
  ToggleLeft,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiUrl } from "@/lib/api-base";

interface Plan {
  id: string;
  name: string;
  type: string;
  price: number;
  currency: string;
  duration: number;
  features: string[];
}

interface Payment {
  id: string;
  orderId: string;
  amount: number;
  method: string;
  status: "pending" | "completed" | "failed";
  planType: string;
  createdAt: string;
  completedAt?: string;
}

interface Subscription {
  id?: string;
  planType: string;
  status: string;
  endDate: string;
  autoPayEnabled: boolean;
}

export default function PaymentDashboard() {
  const { user } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Fetch available plans
  useEffect(() => {
    fetchPlans();
    fetchSubscription();
    fetchPaymentHistory();
  }, []);

  const fetchPlans = async () => {
    try {
      const response = await fetch(apiUrl("/api/subscriptions/plans"));
      const data = await response.json();
      if (data.success) {
        setPlans(data.plans);
      }
    } catch (err) {
      console.error("Failed to fetch plans:", err);
    }
  };

  const fetchSubscription = async () => {
    try {
      const token = sessionStorage.getItem("accessToken");
      if (!token) return;

      const response = await fetch(apiUrl("/api/subscriptions/current"), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        setSubscription(data.subscription);
      }
    } catch (err) {
      console.error("Failed to fetch subscription:", err);
    }
  };

  const fetchPaymentHistory = async () => {
    try {
      const token = sessionStorage.getItem("accessToken");
      if (!token) return;

      const response = await fetch(apiUrl("/api/payments/history"), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await response.json();
      if (data.success) {
        setPayments(data.payments);
      }
    } catch (err) {
      console.error("Failed to fetch payments:", err);
    }
  };

  const handleSelectPlan = async (planType: string) => {
    setLoading(true);
    setError(null);

    try {
      const token = sessionStorage.getItem("accessToken");
      const clinicId = sessionStorage.getItem("clinicId");

      if (!token || !clinicId) {
        setError("Authentication required");
        return;
      }

      const response = await fetch(apiUrl("/api/subscriptions/select"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          clinicId,
          planType,
          autoPayEnabled: true,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setSelectedPlan(planType);
        setSuccessMessage(data.message);
        // Proceed to payment
        setTimeout(() => {
          handleProceedToPayment(planType);
        }, 1500);
      } else {
        setError(data.message || "Failed to select plan");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to select plan");
    } finally {
      setLoading(false);
    }
  };

  const handleProceedToPayment = async (planType: string) => {
    setProcessingPayment(true);
    setError(null);

    try {
      const token = sessionStorage.getItem("accessToken");
      const clinicId = sessionStorage.getItem("clinicId");

      if (!token || !clinicId) {
        setError("Authentication required");
        return;
      }

      // Get plan details
      const plan = plans.find((p) => p.type === planType);
      if (!plan) {
        setError("Plan not found");
        return;
      }

      // Create payment order
      const orderResponse = await fetch(apiUrl("/api/payments/create-order"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          clinicId,
          planType,
          amount: plan.price,
        }),
      });

      const orderData = await orderResponse.json();
      if (!orderData.success) {
        setError(orderData.message || "Failed to create payment order");
        return;
      }

      // Mock payment processing
      // In production, this would open Razorpay checkout
      setSuccessMessage("Processing payment...");

      // Simulate payment verification after 2 seconds
      setTimeout(async () => {
        try {
          const verifyResponse = await fetch(apiUrl("/api/payments/verify"), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              orderId: orderData.order.orderId,
              paymentId: `pay_${Date.now()}`,
              signature: `sig_${Math.random().toString(36).substr(2, 9)}`,
            }),
          });

          const verifyData = await verifyResponse.json();
          if (verifyData.success) {
            setSuccessMessage("Payment successful! Subscription activated.");
            setSelectedPlan(null);
            fetchSubscription();
            fetchPaymentHistory();
          } else {
            setError(verifyData.message || "Payment verification failed");
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : "Payment verification failed");
        } finally {
          setProcessingPayment(false);
        }
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to process payment");
      setProcessingPayment(false);
    }
  };

  const toggleAutoPay = async (enabled: boolean) => {
    try {
      const token = sessionStorage.getItem("accessToken");
      if (!subscription || !token) return;

      const response = await fetch(apiUrl(`/api/subscriptions/${subscription.id}/auto-pay`), {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ enabled }),
      });

      const data = await response.json();
      if (data.success) {
        setSubscription({ ...subscription, autoPayEnabled: enabled });
        setSuccessMessage("Auto-pay settings updated");
      }
    } catch (err) {
      setError("Failed to update auto-pay settings");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 p-6">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Payment & Subscription</h1>
          <p className="text-gray-600">Manage your clinic subscription and payment methods</p>
        </div>

        {/* Messages */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex gap-3">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700 flex gap-3">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Current Subscription */}
        {subscription && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Current Subscription</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-gray-600 mb-1">Plan Type</p>
                <p className="text-2xl font-bold text-blue-600">
                  {subscription.planType === "monthly" ? "Monthly" : "Yearly"}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Status</p>
                <div className="flex items-center gap-2">
                  {subscription.status === "active" ? (
                    <CheckCircle2 className="w-6 h-6 text-green-500" />
                  ) : (
                    <XCircle className="w-6 h-6 text-red-500" />
                  )}
                  <span className="font-semibold capitalize">{subscription.status}</span>
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-600 mb-1">Valid Until</p>
                <p className="text-lg font-semibold">
                  {new Date(subscription.endDate).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Auto-pay Toggle */}
            <div className="mt-6 pt-6 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">Auto-pay</p>
                  <p className="text-sm text-gray-600">
                    Automatically renew subscription on expiry
                  </p>
                </div>
                <button
                  onClick={() => toggleAutoPay(!subscription.autoPayEnabled)}
                  className={cn(
                    "p-2 rounded-lg transition-colors",
                    subscription.autoPayEnabled
                      ? "bg-blue-100 text-blue-600"
                      : "bg-gray-100 text-gray-600"
                  )}
                >
                  <ToggleLeft className="w-6 h-6" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Plans */}
        {!subscription || subscription.status !== "active" && (
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Select a Plan</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className={cn(
                    "relative bg-white rounded-lg border-2 p-8 transition-all",
                    selectedPlan === plan.type
                      ? "border-blue-600 shadow-lg"
                      : "border-gray-200 shadow-sm hover:border-blue-300"
                  )}
                >
                  {selectedPlan === plan.type && (
                    <div className="absolute top-4 right-4">
                      <Check className="w-6 h-6 text-blue-600" />
                    </div>
                  )}

                  <h3 className="text-2xl font-bold text-gray-900 mb-2">{plan.name}</h3>
                  <div className="mb-6">
                    <span className="text-4xl font-bold text-blue-600">₹{plan.price}</span>
                    <span className="text-gray-600 ml-2">/{plan.type === "monthly" ? "month" : "year"}</span>
                  </div>

                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => handleSelectPlan(plan.type)}
                    disabled={loading || processingPayment}
                    className={cn(
                      "w-full py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2",
                      selectedPlan === plan.type && !processingPayment
                        ? "bg-blue-600 hover:bg-blue-700 text-white"
                        : "bg-gray-100 hover:bg-gray-200 text-gray-900"
                    )}
                  >
                    {loading && processingPayment ? (
                      <>
                        <Loader className="w-5 h-5 animate-spin" />
                        Processing...
                      </>
                    ) : selectedPlan === plan.type && !processingPayment ? (
                      <>
                        <CreditCard className="w-5 h-5" />
                        Proceed to Payment
                      </>
                    ) : (
                      "Select Plan"
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Payment History */}
        {payments.length > 0 && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Payment History</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Order ID</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Amount</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Plan</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Status</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-700">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4 font-mono text-sm text-gray-600">
                        {payment.orderId.slice(-8)}
                      </td>
                      <td className="py-3 px-4 font-semibold text-gray-900">₹{payment.amount}</td>
                      <td className="py-3 px-4 capitalize text-gray-700">{payment.planType}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {payment.status === "completed" && (
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                          )}
                          {payment.status === "pending" && (
                            <Clock className="w-5 h-5 text-yellow-500" />
                          )}
                          {payment.status === "failed" && (
                            <XCircle className="w-5 h-5 text-red-500" />
                          )}
                          <span className="capitalize font-semibold">{payment.status}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {new Date(payment.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Invoice Section */}
        {payments.some((p) => p.status === "completed") && (
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Invoices</h2>
            <div className="space-y-3">
              {payments
                .filter((p) => p.status === "completed")
                .map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div>
                      <p className="font-semibold text-gray-900">
                        Invoice for {payment.planType} plan
                      </p>
                      <p className="text-sm text-gray-600">
                        ₹{payment.amount} • {new Date(payment.completedAt || "").toLocaleDateString()}
                      </p>
                    </div>
                    <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                      <Download className="w-5 h-5 text-blue-600" />
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
