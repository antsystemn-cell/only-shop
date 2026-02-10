// ─── OT API Response Types ───────────────────────────────────

export interface OtCategory {
  Id: string;
  Name: string;
  IconUrl?: string;
  IsLeaf?: boolean;
  ParentId?: string;
  ChildCategories?: OtCategory[];
}

export interface OtCategoryListResponse {
  ErrorCode: string;
  CategoryInfoList?: OtCategory[];
  Result?: {
    CategoryInfoList?: OtCategory[];
  };
}

export interface OtPrice {
  OriginalPrice?: number;
  MarginPrice?: number;
  ConvertedPrice?: number;
  ConvertedPriceWithoutSign?: string;
  CurrencySign?: string;
  CurrencyName?: string;
  OriginalCurrencySign?: string;
}

export interface OtItemImage {
  Url: string;
  IsMain?: boolean;
}

export interface OtConfiguredItem {
  Id: string;
  Quantity?: number;
  Price?: OtPrice;
  Configurators?: OtConfigurator[];
  ImageUrl?: string;
}

export interface OtConfiguratorValue {
  Id: string;
  Value?: string;
  ImageUrl?: string;
  PropertyValueDisplayName?: string;
}

export interface OtConfigurator {
  Pid: string;
  Vid: string;
  PropertyName?: string;
  Value?: string;
  ImageUrl?: string;
  Values?: OtConfiguratorValue[];
}

export interface OtVendor {
  Id: string;
  Name?: string;
  Score?: number;
  Url?: string;
}

export interface OtSearchItem {
  Id: string;
  Title: string;
  ExternalTitle?: string;
  MainPictureUrl?: string;
  Pictures?: OtItemImage[];
  Price?: OtPrice;
  OriginalPrice?: OtPrice;
  Quantity?: number;
  VendorId?: string;
  VendorName?: string;
  VendorScore?: number;
  BrandName?: string;
  FeaturedValues?: Array<{
    Name: string;
    Value: string;
  }>;
  CategoryId?: string;
  PromotionPrice?: OtPrice;
  TaobaoItemUrl?: string;
}

export interface OtSearchResult {
  ErrorCode: string;
  Result?: {
    Items?: {
      Items?: OtSearchItem[];
      TotalCount?: number;
    };
    SearchProperties?: {
      Items?: Array<{
        PropertyName: string;
        PropertyValues: Array<{
          Id: string;
          Value: string;
          ItemCount?: number;
        }>;
      }>;
    };
    SubCategories?: {
      Items?: OtCategory[];
    };
    BreadCrumbs?: Array<{
      Id: string;
      Name: string;
    }>;
  };
}

export interface OtItemFullInfo {
  ErrorCode: string;
  Result?: {
    Item?: {
      Id: string;
      Title: string;
      ExternalTitle?: string;
      MainPictureUrl?: string;
      Pictures?: { ItemPicture?: OtItemImage[] };
      Price?: OtPrice;
      OriginalPrice?: OtPrice;
      Quantity?: number;
      VendorId?: string;
      VendorName?: string;
      VendorScore?: number;
      BrandName?: string;
      CategoryId?: string;
      TaobaoItemUrl?: string;
      FeaturedValues?: Array<{
        Name: string;
        Value: string;
      }>;
      ConfiguredItems?: OtConfiguredItem[];
      Configurators?: OtConfigurator[];
    };
    Vendor?: OtVendor;
    RootPath?: Array<{ Id: string; Name: string }>;
  };
}

// ─── Frontend-friendly types ─────────────────────────────────

export interface OtProductCard {
  id: string;
  title: string;
  imageUrl: string;
  price: number;
  originalPrice?: number;
  currency: string;
  vendorName?: string;
  quantity?: number;
}

export interface OtCategoryCard {
  id: string;
  name: string;
  iconUrl?: string;
  isLeaf?: boolean;
}
