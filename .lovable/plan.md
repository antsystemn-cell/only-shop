
# Marketplace → Ready-Stock Store Transformation Plan

## Phase 1: Remove External Provider Infrastructure
- Delete all OTAPI/Amazon/Taobao edge functions (~15 functions)
- Remove external provider services (`otApi.ts`, `otSession.ts`, `amazonProvider.ts`, `amazonOtapiAdapter.ts`, etc.)
- Remove `ProviderContext` and all provider-related hooks
- Remove OT cart context (`OtCartContext.tsx`) — keep only local `CartContext`
- Remove wishlist context tied to OT products

## Phase 2: Remove External-Facing Pages & Components
- Delete all `/ot/*` routes (OtShop, OtCategory, OtProductDetail, OtCheckout, OtOrders, etc.)
- Delete all `/amazon/*` routes
- Delete external marketplace components (OtProductCard, OtCartDrawer, OtCategoryStrip, ProviderStrip, etc.)
- Delete admin pages for OTAPI/Amazon (OtProviders, OtCategories, OtSettings, AmazonSync, etc.)
- Remove LegacyItemRedirect

## Phase 3: Simplify Core Flows
- Refactor `CartContext` to be the sole cart (remove OT cart merging)
- Simplify checkout to internal orders only
- Clean `StorefrontLayout` and `Header` of provider references
- Simplify `MobileBottomNav` and navigation
- Clean admin sidebar of removed sections

## Phase 4: Rebuild Homepage
- Remove provider-based segments and snapshot system
- Homepage shows: hero banners, featured products, new arrivals, categories
- All data from internal `products` and `categories` tables only

## Phase 5: Clean Product & Category Pages
- Product listing from `products` table only
- Product detail from `products` + `product_variants` only
- Remove all provider badges, external attributes, translation hooks
- Add clean filters: category, brand, sort, stock status

## Phase 6: Admin Cleanup
- Keep: Products, Categories, Brands, Orders, Banners, Content, Users, Settings
- Remove: All OT/Amazon admin pages and menu items
- Simplify dashboard to internal metrics only

## Phase 7: Code & DB Cleanup
- Remove unused types, utils, hooks
- Remove dead environment variable references
- Clean up unused edge functions
- Keep payment edge functions (QPay, OmniWay, Storepay) for internal orders
- Preserve all existing product/order/category data

## What's Preserved
- `products`, `product_variants`, `categories`, `brands` tables and data
- `orders`, `order_items` tables and data
- Local cart and checkout flow
- Payment integrations (QPay, OmniWay, Storepay)
- User auth, profiles, roles
- Admin product/order management
- Banners, content pages
- Delivery zones

## What's Removed
- ~15 edge functions (ot-api, amazon-api, sync functions, etc.)
- ~40+ components/pages related to external providers
- OtCartContext, ProviderContext, WishlistContext (OT-specific)
- All OTAPI/Amazon services and utilities
- Provider-specific UI (badges, strips, filters)
