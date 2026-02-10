import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "@/contexts/CartContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { WishlistProvider } from "@/contexts/WishlistContext";
import NotFound from "./pages/NotFound";

// Storefront imports
import { StorefrontLayout } from "./components/storefront/StorefrontLayout";
import Home from "./pages/storefront/Home";
import Shop from "./pages/storefront/Shop";
import ProductDetail from "./pages/storefront/ProductDetail";
import CategoriesPage from "./pages/storefront/Categories";
import Auth from "./pages/storefront/Auth";
import Checkout from "./pages/storefront/Checkout";
import OrderConfirmation from "./pages/storefront/OrderConfirmation";
import CustomerOrders from "./pages/storefront/CustomerOrders";
import Wishlist from "./pages/storefront/Wishlist";
import OtShop from "./pages/storefront/OtShop";
import OtCategory from "./pages/storefront/OtCategory";
import OtProductDetail from "./pages/storefront/OtProductDetail";

// Admin imports
import { AdminLayout } from "./components/admin/AdminLayout";
import { AdminProtectedRoute } from "./components/admin/AdminProtectedRoute";
import AdminLogin from "./pages/admin/Login";
import Dashboard from "./pages/admin/Dashboard";
import Products from "./pages/admin/Products";
import Categories from "./pages/admin/Categories";
import Brands from "./pages/admin/Brands";
import Orders from "./pages/admin/Orders";
import Users from "./pages/admin/Users";
import Delivery from "./pages/admin/Delivery";
import Banners from "./pages/admin/Banners";
import Pricing from "./pages/admin/Pricing";
import Content from "./pages/admin/Content";
import Collections from "./pages/admin/Collections";
import Restrictions from "./pages/admin/Restrictions";
import CatalogItems from "./pages/admin/CatalogItems";
import Seo from "./pages/admin/Seo";
import Newsletter from "./pages/admin/Newsletter";
import Permissions from "./pages/admin/Permissions";
import GeneralSettings from "./pages/admin/GeneralSettings";
import OrderSettings from "./pages/admin/OrderSettings";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <WishlistProvider>
        <CartProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
            <Routes>
              {/* Storefront routes */}
              <Route element={<StorefrontLayout />}>
                <Route path="/" element={<Home />} />
                <Route path="/shop" element={<Shop />} />
                <Route path="/product/:id" element={<ProductDetail />} />
                <Route path="/categories" element={<CategoriesPage />} />
                <Route path="/wishlist" element={<Wishlist />} />
                <Route path="/ot" element={<OtShop />} />
                <Route path="/ot/category/:categoryId" element={<OtCategory />} />
                <Route path="/ot/product/:itemId" element={<OtProductDetail />} />
              </Route>
              
              {/* Auth and checkout routes - outside layout */}
              <Route path="/auth" element={<Auth />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/order-confirmation/:orderId" element={<OrderConfirmation />} />
              <Route path="/orders" element={<CustomerOrders />} />
              
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
                <Route path="users" element={<Users />} />
                <Route path="delivery" element={<Delivery />} />
                <Route path="banners" element={<Banners />} />
                <Route path="pricing" element={<Pricing />} />
                <Route path="content" element={<Content />} />
                <Route path="collections" element={<Collections />} />
                <Route path="restrictions" element={<Restrictions />} />
                <Route path="catalog-items" element={<CatalogItems />} />
                <Route path="seo" element={<Seo />} />
                <Route path="newsletter" element={<Newsletter />} />
                <Route path="permissions" element={<Permissions />} />
                <Route path="settings" element={<GeneralSettings />} />
                <Route path="settings-orders" element={<OrderSettings />} />
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
