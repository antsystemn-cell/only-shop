import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "@/contexts/CartContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { WishlistProvider } from "@/contexts/WishlistContext";
import NotFound from "./pages/NotFound";
import { ScrollToTop } from "./components/ScrollToTop";
import { RequireAuth } from "./components/storefront/RequireAuth";
import { PWAUpdatePrompt } from "./components/pwa/PWAUpdatePrompt";
import { PWAInstallBanner } from "./components/pwa/PWAInstallBanner";
import { PWAAppSplash } from "./components/pwa/PWAAppSplash";
import { PhonePromptDialog } from "./components/storefront/PhonePromptDialog";
import { MetaPixelTracker } from "./components/MetaPixelTracker";

// Storefront imports
import { StorefrontLayout } from "./components/storefront/StorefrontLayout";
import Home from "./pages/storefront/Home";
import Shop from "./pages/storefront/Shop";
import ProductDetail from "./pages/storefront/ProductDetail";
import Auth from "./pages/storefront/Auth";
import ResetPassword from "./pages/storefront/ResetPassword";
import Checkout from "./pages/storefront/Checkout";
import BuyNow from "./pages/storefront/BuyNow";
import OrderConfirmation from "./pages/storefront/OrderConfirmation";
import MyOrders from "./pages/storefront/MyOrders";
import Wishlist from "./pages/storefront/Wishlist";
import Profile from "./pages/storefront/Profile";
import Wallet from "./pages/storefront/Wallet";
import Support from "./pages/storefront/Support";
import ViewHistory from "./pages/storefront/ViewHistory";
import MobileCategories from "./pages/storefront/MobileCategories";
import DynamicContentPage from "./pages/storefront/DynamicContentPage";
import FacebookCallback from "./pages/storefront/FacebookCallback";

// Admin imports
import { AdminLayout } from "./components/admin/AdminLayout";
import { AdminProtectedRoute } from "./components/admin/AdminProtectedRoute";
import AdminLogin from "./pages/admin/Login";
import Dashboard from "./pages/admin/Dashboard";
import Products from "./pages/admin/Products";
import Categories from "./pages/admin/Categories";
import Brands from "./pages/admin/Brands";
import Orders from "./pages/admin/Orders";
import Sales from "./pages/admin/Sales";
import Users from "./pages/admin/Users";
import Delivery from "./pages/admin/Delivery";
import DeliveryOperations from "./pages/admin/DeliveryOperations";
import Banners from "./pages/admin/Banners";
import Pricing from "./pages/admin/Pricing";
import Content from "./pages/admin/Content";
import Seo from "./pages/admin/Seo";
import Newsletter from "./pages/admin/Newsletter";
import Permissions from "./pages/admin/Permissions";
import GeneralSettings from "./pages/admin/GeneralSettings";
import PwaSettings from "./pages/admin/PwaSettings";
import AuthSettings from "./pages/admin/AuthSettings";
import SmsGateway from "./pages/admin/SmsGateway";
import OrderSettings from "./pages/admin/OrderSettings";
import SystemTools from "./pages/admin/SystemTools";
import Reviews from "./pages/admin/Reviews";
import UserActivityLog from "./pages/admin/UserActivityLog";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <WishlistProvider>
        <CartProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <PWAAppSplash />
            <PWAUpdatePrompt />
            <PWAInstallBanner />
            <BrowserRouter>
            <ScrollToTop />
            <MetaPixelTracker />
            <PhonePromptDialog />
            <Routes>
              {/* Storefront routes */}
              <Route element={<StorefrontLayout />}>
                <Route path="/" element={<Home />} />
                <Route path="/shop" element={<Shop />} />
                <Route path="/product/:id" element={<ProductDetail />} />
                <Route path="/categories" element={<MobileCategories />} />
                <Route path="/wishlist" element={<Wishlist />} />
                <Route path="/page/:slug" element={<DynamicContentPage />} />
              </Route>
              
              {/* Auth and checkout routes - outside layout */}
              <Route path="/auth" element={<Auth />} />
              <Route path="/auth/facebook/callback" element={<FacebookCallback />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/buy-now/:id" element={<BuyNow />} />
              <Route path="/order-confirmation/:orderId" element={<OrderConfirmation />} />
              <Route path="/orders" element={<RequireAuth><MyOrders /></RequireAuth>} />
              <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
              <Route path="/wallet" element={<RequireAuth><Wallet /></RequireAuth>} />
              <Route path="/view-history" element={<ViewHistory />} />
              <Route path="/support" element={<Support />} />
              
              {/* Admin routes */}
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route
                path="/admin"
                element={
                  <AdminProtectedRoute>
                    <AdminLayout />
                  </AdminProtectedRoute>
                }
              >
                <Route index element={<Dashboard />} />
                <Route path="products" element={<Products />} />
                <Route path="categories" element={<Categories />} />
                <Route path="brands" element={<Brands />} />
                <Route path="orders" element={<Orders />} />
                <Route path="sales" element={<Sales />} />
                <Route path="users" element={<Users />} />
                <Route path="delivery" element={<Delivery />} />
                <Route path="delivery-ops" element={<DeliveryOperations />} />
                <Route path="banners" element={<Banners />} />
                <Route path="pricing" element={<Pricing />} />
                <Route path="content" element={<Content />} />
                <Route path="seo" element={<Seo />} />
                <Route path="newsletter" element={<Newsletter />} />
                <Route path="permissions" element={<Permissions />} />
                <Route path="settings" element={<GeneralSettings />} />
                <Route path="settings-seo" element={<Seo />} />
                <Route path="pwa-settings" element={<PwaSettings />} />
                <Route path="auth-settings" element={<AuthSettings />} />
                <Route path="sms-gateway" element={<SmsGateway />} />
                <Route path="settings-orders" element={<OrderSettings />} />
                <Route path="system-tools" element={<SystemTools />} />
                <Route path="reviews" element={<Reviews />} />
                <Route path="user-activity-log" element={<UserActivityLog />} />
              </Route>

              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </CartProvider>
    </WishlistProvider>
  </AuthProvider>
</QueryClientProvider>
);

export default App;
