## Suha PWA E-Commerce Design Migration

### Phase 1 — Foundation (энэ удаа)
1. **Design System** — Өнгө (#625AFA primary), фонт (Google Sans), border-radius, card стиль зэрэг CSS tokens-ийг index.css + tailwind.config-д шинэчлэх
2. **Home Page** — Suha-ийн home.html загвараар: Hero carousel, category grid (4 багана, icon+текст), Flash sale slider, Product grid (2 багана mobile, wishlist+rating+add to cart)
3. **Header** — Mobile: logo + cart + profile; Desktop: бүтэн header
4. **Bottom Navigation** — Suha стилийн доод nav
5. **Product Card** — Suha стилийн card (badge, wishlist, thumbnail, title, price, rating, add to cart)

### Phase 2 — Дэлгүүр хуудсууд (дараагийн)
- Shop grid/list
- Product detail page
- Category page
- Search

### Phase 3 — Cart + Checkout (дараагийн)
- Cart page
- Checkout flow
- Payment pages

### Phase 4 — Profile + Auth (дараагийн)
- Login/Register
- Profile
- Orders
- Settings

### Техникийн зарчмууд
- Mobile: max-width ~480px, Suha-тай адилхан
- Desktop: бүтэн дэлгэц (container max-width 1280px), ижил загвар гэхдээ grid илүү олон багана
- Одоогийн бизнес логик, data fetching хэвээр
- Tailwind semantic tokens ашиглана
