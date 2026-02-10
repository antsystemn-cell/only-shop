
# Legacy OTCommerce → React Платформ Бүрэн Шилжүүлгийн Төлөвлөгөө

## Дууссан фазууд: 1 ✅, 2 ✅, 3 ✅, 4 ✅

## Одоогийн байдал

Одоогийн React платформ нь OT API-тай холбогдсон боловч legacy системийн олон чухал функцүүд дутуу байна. Доорх хүснэгт нь legacy системийн бүх модулийг React дээрх одоогийн хэрэгжүүлэлттэй харьцуулж, юу дутуу байгааг тодорхойлсон болно.

---

## Фаз 1: Сагс (Cart) системийг OT API руу шилжүүлэх (Хамгийн чухал)

**Асуудал:** Одоо сагс нь зөвхөн `localStorage`-д хадгалагддаг, OT API-тай огт холбогдоогүй. Legacy систем нь OT API-н `GetBasket`, `AddItemToBasket`, `RunBasketChecking` зэрэг дуудлагуудыг ашигладаг.

**Хийх зүйлс:**

1. **OtCartContext** шинээр үүсгэх (`src/contexts/OtCartContext.tsx`)
   - Anonymous session ашиглан OT API-н сагсны системтэй холбогдох
   - `addItemToBasket` — configurator string-тэй бараа нэмэх
   - `getBasket` — сагсны бараануудыг provider-ээр бүлэглэж харуулах
   - `editBasketItemQuantity` — тоо хэмжээ өөрчлөх
   - `removeBasketItem` — бараа устгах
   - `clearBasket` — сагс хоослох
   - `runBasketChecking` + `getBasketCheckingResult` — захиалга өгөхийн өмнө бараа шалгах (polling mechanism)

2. **CartDrawer шинэчлэх** (`src/components/storefront/CartDrawer.tsx`)
   - OT API сагснаас ирсэн бараануудыг provider-ээр бүлэглэж харуулах
   - orderLineId ашиглан тоо хэмжээ засах, устгах
   - Барааны зурагтай, нэртэй харуулах

3. **OtProductDetail шинэчлэх** — `addToCart` дуудлагыг OT API `AddItemToBasket` руу чиглүүлэх, configurator XML string үүсгэх

---

## Фаз 2: Захиалгын систем (Order) OT API руу шилжүүлэх

**Статус: ✅ ДУУССАН** — OtCheckout.tsx 5-алхамт хуудас, edge function actions, otApi.ts service functions бүрэн хэрэгжсэн.

**Хийх зүйлс:**

1. **OtCheckout хуудас** шинээр үүсгэх (`src/pages/storefront/OtCheckout.tsx`)
   - **Алхам 1:** Сагсны бараа шалгах (`RunBasketChecking` → poll → `GetBasketCheckingResult`)
   - **Алхам 2:** Хүргэлтийн горим сонгох (`SearchDeliveryModes`)
   - **Алхам 3:** Хүргэлтийн профайл сонгох/үүсгэх (`GetUserProfileInfoList`, `CreateUserProfile`)
   - **Алхам 4:** Захиалга баталгаажуулах дүн харуулах
   - **Алхам 5:** `CreateOrder` API дуудлагаар захиалга үүсгэх

2. **OT Хүргэлтийн профайл CRUD** нэмэх (`src/services/otApi.ts`-д)
   - `getUserProfileInfoList` — хаягийн жагсаалт
   - `createUserProfile` — шинэ хаяг нэмэх (хот хайлт `SearchCities`-тэй)
   - `updateUserProfile` — хаяг засах
   - `deleteUserProfile` — хаяг устгах

3. **Edge function-д шинэ action-ууд нэмэх** (`supabase/functions/ot-api/index.ts`)
   - `createOrder` — `CreateOrder` XML бүтэцтэй
   - `recreateOrder` — дахин захиалга
   - `getUserProfileInfoList`, `createUserProfile`, `updateUserProfile`
   - `searchCities` — хот хайлт

---

## Фаз 3: Хэрэглэгчийн хувийн хэсэг (Private Office)

**Асуудал:** Legacy-д `PrivateOfficeController` нь данс, захиалга, хөнгөлөлт, профайл зэргийг нэг дор удирддаг. Одоогийн React-д зөвхөн `CustomerOrders` хуудас байна.

**Хийх зүйлс:**

1. **Profile хуудас** үүсгэх (`src/pages/storefront/Profile.tsx`)
   - Хэрэглэгчийн мэдээлэл (нэр, имэйл, утас)
   - Нууц үг солих
   - OT дансны мэдээлэл (`GetAccountInfo`)
   - Хүргэлтийн хаягуудын жагсаалт (CRUD)

2. **OtOrders хуудас** (`src/pages/storefront/OtOrders.tsx`)
   - OT API-н `SearchOrders` ашиглан захиалгын жагсаалт
   - Статусаар шүүх
   - Захиалгын дэлгэрэнгүй (`GetSalesOrderDetails`)
   - Захиалга цуцлах (`CancelSalesOrder`)

3. **Wallet / Данс** хэсэг
   - `GetAccountInfo` — баланс харуулах
   - `GetStatementForOperator` — гүйлгээний түүх
   - Данс цэнэглэх (QPay интеграцитай)

---

## Фаз 4: Хайлтын систем сайжруулах

**Асуудал:** Одоогийн хайлт нь зөвхөн текст + ангилал + эрэмбэлэлт дэмждэг. Legacy систем нь үнийн хүрээ, брэнд, нийлүүлэгч, зургаар хайх, search properties шүүлтүүр зэргийг дэмждэг.

**Хийх зүйлс:**

1. **OtShop хуудас сайжруулах** (`src/pages/storefront/OtShop.tsx`)
   - Хажуугийн шүүлтүүр panel (sidebar/drawer) нэмэх:
     - Үнийн хүрээ (min/max slider)
     - Брэнд шүүлтүүр (`filters[20000]` pattern)
     - Provider шүүлтүүр (Taobao, Poizon гэх мэт)
     - Search properties (өнгө, хэмжээ гэх мэт) — `GetCategorySearchProperties`-аас авах
   - Зургаар хайх (image search) — `imageUrl` параметр
   - URL-д бүх шүүлтүүрийг синк хийх (одоо байгаа pattern дээр нэмэх)

2. **searchItems функц өргөтгөх** (`src/services/otApi.ts`)
   - `SearchParams`-д `properties` (key-value шүүлтүүр) нэмэх
   - Edge function-д XML property filter нэмэх

---

## Фаз 5: Админ захиалгын удирдлага OT API-тай холбох

**Асуудал:** Одоогийн админ Orders хуудас нь зөвхөн Supabase `orders` хүснэгтээс уншдаг. Legacy-д `UserZakazNew` нь OT API-н захиалгуудыг удирддаг.

**Хийх зүйлс:**

1. **Admin OT Orders хуудас** шинээр (`src/pages/admin/OtOrders.tsx`)
   - `SearchOrdersForUser` / `SearchOrders` — OT захиалгуудын жагсаалт
   - `GetSalesOrderDetailsForOperator` — дэлгэрэнгүй
   - `CancelSalesOrderForOperator` / `CancelLineSalesOrderForOperator` — цуцлах
   - Бараа тус бүрийн timeline (статусын түүх)
   - Нийлүүлэгчийн холбоос (vendor link)
   - Админ тэмдэглэл

2. **Admin sidebar-д нэмэх** (`src/components/admin/AdminSidebar.tsx`)
3. **Route нэмэх** (`src/App.tsx`)

---

## Фаз 6: Хэрэглэгчийн бүртгэл OT API-тай синк хийх

**Асуудал:** Одоо хэрэглэгчид зөвхөн Supabase Auth-д бүртгэгддэг. Legacy-д OT API-н `RegisterUser`-ээр давхар бүртгэдэг.

**Хийх зүйлс:**

1. **Auth flow шинэчлэх** — Бүртгүүлэхэд Supabase + OT API `RegisterUser` давхар дуудах
2. **Login flow** — OT API session авах (anonymous/operator)
3. **Edge function** нэмэх: `registerOtUser` — OT API бүртгэл + Supabase profile холбох

---

## Фаз 7: Нэмэлт функцүүд

| Функц | Legacy эх | Хийх зүйл |
|-------|-----------|------------|
| Дуртай борлуулагч | `FavouriteVendorController` | Vendor CRUD (Add/Remove/List) хуудас |
| Сэтгэгдэл | `ReviewsController` + `Shopreviews` | Барааны сэтгэгдэл бичих, like/dislike, хариулт |
| Хүргэлтийн тооцоолуур | `CalculatorController` | Жин, улсаар хүргэлтийн зардал тооцоолох widget |
| Дэмжлэг (Support) | `Support` block | Тикет системийн хуудас (Supabase DB дээр) |
| Referral систем | `Referral` block | Урилгын линк, бонус систем |

---

## Техникийн хэрэгжүүлэлтийн дараалал

```text
Фаз 1 (Сагс)
  ├── OtCartContext үүсгэх
  ├── CartDrawer шинэчлэх
  └── OtProductDetail addToCart засах

Фаз 2 (Захиалга)
  ├── Edge function-д CreateOrder нэмэх
  ├── OtCheckout хуудас (5 алхамт)
  └── Хүргэлтийн профайл CRUD

Фаз 3 (Хувийн хэсэг)
  ├── Profile хуудас
  ├── OtOrders хуудас
  └── Wallet/Данс хэсэг

Фаз 4 (Хайлт)
  ├── Шүүлтүүр sidebar
  ├── Зургаар хайх
  └── Search properties

Фаз 5 (Админ захиалга)
  ├── OtOrders админ хуудас
  └── Timeline, vendor link

Фаз 6 (Auth синк)
  └── OT RegisterUser давхар бүртгэл

Фаз 7 (Нэмэлт)
  └── Vendor, Review, Calculator, Support
```

## Шинэ файлуудын жагсаалт

| Файл | Зорилго |
|------|---------|
| `src/contexts/OtCartContext.tsx` | OT API сагсны state management |
| `src/pages/storefront/OtCheckout.tsx` | OT захиалгын 5 алхамт checkout |
| `src/pages/storefront/OtOrders.tsx` | OT захиалгын түүх |
| `src/pages/storefront/Profile.tsx` | Хэрэглэгчийн профайл, хаяг, данс |
| `src/pages/admin/OtOrders.tsx` | Админ OT захиалгын удирдлага |
| `src/components/storefront/OtCartDrawer.tsx` | OT API-д суурилсан сагсны drawer |
| `src/components/storefront/SearchFilters.tsx` | Хайлтын шүүлтүүр sidebar |
| `src/components/storefront/DeliveryCalculator.tsx` | Хүргэлтийн зардал тооцоолуур |

## Шинэчлэгдэх файлууд

| Файл | Өөрчлөлт |
|------|----------|
| `src/App.tsx` | Шинэ route-ууд нэмэх (`/ot/checkout`, `/ot/orders`, `/profile`, admin `/ot-orders`) |
| `src/services/otApi.ts` | CreateOrder, UserProfile CRUD, SearchCities, delivery modes функцүүд нэмэх |
| `src/components/storefront/Header.tsx` | Profile, OT Orders линкүүд нэмэх |
| `src/components/storefront/MobileBottomNav.tsx` | Profile tab нэмэх |
| `src/components/admin/AdminSidebar.tsx` | OT Захиалга цэс нэмэх |
| `src/pages/storefront/OtShop.tsx` | Шүүлтүүр sidebar, image search нэмэх |
| `src/pages/storefront/OtProductDetail.tsx` | OT Cart-д нэмэх функц руу чиглүүлэх |
| `supabase/functions/ot-api/index.ts` | CreateOrder, UserProfile, SearchCities action-ууд нэмэх |

## Анхааруулга

- Фаз тус бүрийг дарааллаар нь хэрэгжүүлэх хэрэгтэй (Фаз 1 → 2 → ... → 7), учир нь хоорондоо хамааралтай
- Фаз бүрийг хэрэгжүүлсний дараа end-to-end тест хийх шаардлагатай
- OT API-н session management (`otSession.ts`) аль хэдийн бэлэн, нэмэлт өөрчлөлт шаардахгүй
- Одоогийн Supabase-д суурилсан дотоодын бараа/захиалгын систем (`/shop`, `/checkout`) хэвээр үлдэнэ — OT систем нь тусдаа `/ot/*` route-уудаар ажиллана
