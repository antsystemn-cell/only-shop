import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { CartProvider } from "@/contexts/CartContext";
import { OtCartProvider } from "@/contexts/OtCartContext";
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
import OtCheckout from "./pages/storefront/OtCheckout";
import Profile from "./pages/storefront/Profile";
import OtOrders from "./pages/storefront/OtOrders";
import Wallet from "./pages/storefront/Wallet";
import FavouriteVendors from "./pages/storefront/FavouriteVendors";
import DeliveryCalculator from "./pages/storefront/DeliveryCalculator";
import Support from "./pages/storefront/Support";

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
import SystemTools from "./pages/admin/SystemTools";
import Reviews from "./pages/admin/Reviews";
import OtDelivery from "./pages/admin/OtDelivery";
import OtPricing from "./pages/admin/OtPricing";
import OtProviders from "./pages/admin/OtProviders";
import OtContent from "./pages/admin/OtContent";
import OtWarehouse from "./pages/admin/OtWarehouse";
import OtRatingLists from "./pages/admin/OtRatingLists";
import OtSettings from "./pages/admin/OtSettings";
import SearchSettings from "./pages/admin/SearchSettings";
import AdminOtOrders from "./pages/admin/OtOrders";
import OtCategories from "./pages/admin/OtCategories";
import OtCategoryBrowse from "./pages/storefront/OtCategoryBrowse";
const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <WishlistProvider>
        <CartProvider>
          <OtCartProvider>
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
                <Route path="/ot/browse/:internalId" element={<OtCategoryBrowse />} />
                <Route path="/ot/product/:itemId" element={<OtProductDetail />} />
              </Route>
              
              {/* Auth and checkout routes - outside layout */}
              <Route path="/auth" element={<Auth />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/ot/checkout" element={<OtCheckout />} />
              <Route path="/order-confirmation/:orderId" element={<OrderConfirmation />} />
              <Route path="/orders" element={<CustomerOrders />} />
              <Route path="/ot/orders" element={<OtOrders />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/wallet" element={<Wallet />} />
              <Route path="/favourite-vendors" element={<FavouriteVendors />} />
              <Route path="/delivery-calculator" element={<DeliveryCalculator />} />
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
                <Route path="users" element={<Users />} />
                <Route path="ot-orders" element={<AdminOtOrders />} />
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
                <Route path="system-tools" element={<SystemTools />} />
                <Route path="reviews" element={<Reviews />} />
                <Route path="ot-delivery" element={<OtDelivery />} />
                <Route path="ot-pricing" element={<OtPricing />} />
                <Route path="ot-providers" element={<OtProviders />} />
                <Route path="ot-content" element={<OtContent />} />
                <Route path="ot-warehouse" element={<OtWarehouse />} />
                <Route path="ot-rating-lists" element={<OtRatingLists />} />
                <Route path="ot-settings" element={<OtSettings />} />
                <Route path="search-settings" element={<SearchSettings />} />
                <Route path="ot-categories" element={<OtCategories />} />
              </Route>

              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
          </OtCartProvider>
      </CartProvider>
    </WishlistProvider>
  </AuthProvider>
</QueryClientProvider>
);

export default App;
