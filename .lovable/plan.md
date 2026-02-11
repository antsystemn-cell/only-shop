
# OTAPI Full Integration — Comprehensive Audit & Plan

## Одоогийн байдал (2026-02-11)

Бүх 7 фаз дууссан. Одоо OTAPI docs-той харьцуулсан бүрэн audit хийгдэж, дутуу хэсгүүдийг нөхөх шинэ төлөвлөгөө гарсан.

---

## AUDIT: Одоогийн хэрэгжүүлэлт vs OTAPI Docs

### ✅ Бүрэн хэрэгжсэн модулиуд

| Модуль | Edge Actions | Frontend Service | UI |
|--------|-------------|------------------|-----|
| Sessions (Anonymous + Operator) | ✅ | ✅ | ✅ |
| Categories (Root, Sub, Search Props) | ✅ | ✅ | ✅ |
| Search (BatchSearchItemsFrame, filters, image search) | ✅ | ✅ | ✅ |
| Product Detail (BatchGetItemFullInfo, Description) | ✅ | ✅ | ✅ |
| Basket (Add, Edit, Remove, Clear, Checking) | ✅ | ✅ | ✅ |
| Orders (Search, Details, Cancel, Create, Recreate) | ✅ | ✅ | ✅ |
| User Profiles (CRUD, SearchCities) | ✅ | ✅ | ✅ |
| Delivery (Countries, Modes, External Rates) | ✅ | ✅ | ✅ |
| Currency (List, Rate History) | ✅ | ✅ | ✅ |
| Reviews (Add, Approve, Settings) | ✅ | ✅ | ✅ |
| Content (MenuTree, Banners) | ✅ | ✅ | ✅ |
| Roles & Permissions (RoleList, RightTree) | ✅ | ✅ | ✅ |
| System Tools (CallStats, Reset Caches, BlackList, Errors) | ✅ | ✅ | ✅ |
| Pricing (PriceFormationGroup, Settings, Discounts) | ✅ | ✅ | ✅ |
| Rating Lists (BatchSearch, Add, AddElements) | ✅ | ✅ | ✅ |
| Warehouse (Search Items, Categories, Create) | ✅ | ✅ | ✅ |
| Design (GetApplicationDesignSettings) | ✅ | ✅ | ✅ |
| OT Categories (XML import, DB, Admin, Storefront) | ✅ | ✅ | ✅ |

### ❌ Дутуу / Хэрэгжүүлэх шаардлагатай

#### Шат 1: Edge Function + Service Layer (Суурь)

| Method | Төрөл | Тайлбар |
|--------|-------|---------|
| ChangeEmail | Auth | Имэйл өөрчлөх |
| ChangePhone | Auth | Утас өөрчлөх |
| ConfirmEmail | Auth | Имэйл баталгаажуулах |
| ConfirmPhone | Auth | Утас баталгаажуулах |
| ExternalAuthentication | Auth | OAuth нэвтрэлт |
| SearchUsers / FindBaseUserInfoListFrame | Users | Хэрэглэгч хайх (admin) — edge байгаа, frontend дутуу |
| GetUserPreferences | Users | Хэрэглэгчийн тохиргоо |
| BatchSimplifiedAddItemsToBasket | Basket | Олон бараа нэг дор нэмэх |
| MoveItemsBetweenBasketAndNote | Basket | Бараа тэмдэглэл рүү шилжүүлэх |
| UpdateOrderLineInfo | Orders | Захиалгын мөр мэдээлэл засах |
| GetOrderStatusList | Orders | Статусын жагсаалт |
| ConfirmOrderPackaging | Orders | Боодлын баталгаажуулалт (edge байгаа, frontend дутуу) |
| CreateBalanceChargingBill | Payment | Данс цэнэглэх нэхэмжлэх |
| SalesPaymentReserve | Payment | Төлбөр нөөцлөх |
| AddUserToDiscountGroup | Discounts | Хэрэглэгч хөнгөлөлтөд нэмэх |
| RemoveUserFromDiscountGroup | Discounts | Хэрэглэгч хөнгөлөлтөөс хасах |
| GetUserDiscountGroups | Discounts | Хэрэглэгчийн хөнгөлөлтүүд |
| CreateContentMenuItem | Content | Контент үүсгэх |
| UpdateContentMenuItem | Content | Контент засах |
| DeleteContentMenuItem | Content | Контент устгах |
| SearchContentMenuItems | Content | Контент хайх |
| UpdateApplicationDesignSettings | Design | Дизайн тохиргоо хадгалах |
| RewardItemReview | Reviews | Сэтгэгдэл шагнах |
| SearchInstanceUserLogEntries | Reporting | Хэрэглэгчийн лог |
| CreateInstanceRole | Roles | Эрх үүсгэх |
| AttachRightsToRole | Roles | Эрх холбох |
| DeleteInstanceRole | Roles | Эрх устгах |
| GetProviderInfoList | Providers | Нийлүүлэгчийн жагсаалт |
| GetProviderCommonSettings | Providers | Нийлүүлэгчийн ерөнхий тохиргоо |
| SearchDeliveryPickupPoints | Delivery | Авах цэгүүд (edge байгаа, frontend дутуу) |

#### Шат 2: Admin UI Сайжруулалт

- Users хуудас: OT API SearchUsers + Discount group management
- Content CRUD хуудас: CreateContentMenuItem, UpdateContentMenuItem
- Roles хуудас: CreateInstanceRole, AttachRightsToRole
- Orders: ConfirmOrderPackaging UI, UpdateOrderLineInfo
- Providers: GetProviderInfoList, GetProviderCommonSettings UI

#### Шат 3: Frontend UX Сайжруулалт

- Delivery: Pickup points UI
- Basket: BatchSimplifiedAdd, MoveItemsBetween
- Payment: Balance charging, Payment reserve
- User: ChangeEmail/Phone/Confirm flows

#### Шат 4: Reporting & Analytics

- API call logging (edge function middleware)
- SearchInstanceUserLogEntries UI
- Enhanced error handling with retry mechanism

---

## Global Requirements

### A. OTAPI Service Wrapper ✅
Edge function `ot-api/index.ts` already implements:
- Method routing with signature
- instanceKey, timestamp, sessionId injection
- Normalized responses via proxy pattern
- Console logging for debugging

### B. Parameter Validation ✅
- XML parameters properly built with escapeXml
- includeMetaInfo explicitly set where needed
- Clean params filtering in frontend callProxy

### C. Error Handling ⚠️ (Partially)
- Proxy always returns 200 OK with {success, data, error}
- normalizeOtResponse utility exists
- TODO: Add UI retry mechanism, better fallback states

### D. Pagination & Search ✅
- framePosition/frameSize used in all list APIs
- URL-synced filters in search

### E. UI Normalization ✅
- Raw JSON never shown
- All data mapped to user-friendly structures
