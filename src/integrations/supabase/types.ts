export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_settings: {
        Row: {
          category: string
          created_at: string
          description: string | null
          id: string
          setting_key: string
          setting_value: Json
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          setting_key: string
          setting_value?: Json
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          setting_key?: string
          setting_value?: Json
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      banners: {
        Row: {
          button_link: string | null
          button_text: string | null
          created_at: string
          display_order: number | null
          id: string
          image_url: string
          is_active: boolean | null
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          button_link?: string | null
          button_text?: string | null
          created_at?: string
          display_order?: number | null
          id?: string
          image_url: string
          is_active?: boolean | null
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          button_link?: string | null
          button_text?: string | null
          created_at?: string
          display_order?: number | null
          id?: string
          image_url?: string
          is_active?: boolean | null
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      brands: {
        Row: {
          created_at: string
          display_order: number | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      catalog_collections: {
        Row: {
          created_at: string
          description: string | null
          display_order: number | null
          id: string
          is_active: boolean | null
          item_ids: string[] | null
          name: string
          rules: Json | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          item_ids?: string[] | null
          name: string
          rules?: Json | null
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          item_ids?: string[] | null
          name?: string
          rules?: Json | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      catalog_restrictions: {
        Row: {
          created_at: string
          id: string
          is_active: boolean | null
          reason: string | null
          restriction_type: string
          target_id: string
          target_name: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          reason?: string | null
          restriction_type: string
          target_id: string
          target_name?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean | null
          reason?: string | null
          restriction_type?: string
          target_id?: string
          target_name?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          display_order: number | null
          icon: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          name: string
          name_mn: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name: string
          name_mn: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          display_order?: number | null
          icon?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          name?: string
          name_mn?: string
          updated_at?: string
        }
        Relationships: []
      }
      content_pages: {
        Row: {
          content: string | null
          created_at: string
          display_order: number | null
          id: string
          page_type: string
          seo_description: string | null
          seo_image: string | null
          seo_title: string | null
          slug: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          display_order?: number | null
          id?: string
          page_type?: string
          seo_description?: string | null
          seo_image?: string | null
          seo_title?: string | null
          slug: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          content?: string | null
          created_at?: string
          display_order?: number | null
          id?: string
          page_type?: string
          seo_description?: string | null
          seo_image?: string | null
          seo_title?: string | null
          slug?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      delivery_zones: {
        Row: {
          created_at: string
          express_days: number | null
          express_price: number | null
          id: string
          is_active: boolean | null
          name: string
          parent_id: string | null
          rural_days: number | null
          rural_price: number | null
          standard_days: number | null
          standard_price: number
          updated_at: string
          zone_type: string
        }
        Insert: {
          created_at?: string
          express_days?: number | null
          express_price?: number | null
          id?: string
          is_active?: boolean | null
          name: string
          parent_id?: string | null
          rural_days?: number | null
          rural_price?: number | null
          standard_days?: number | null
          standard_price?: number
          updated_at?: string
          zone_type: string
        }
        Update: {
          created_at?: string
          express_days?: number | null
          express_price?: number | null
          id?: string
          is_active?: boolean | null
          name?: string
          parent_id?: string | null
          rural_days?: number | null
          rural_price?: number | null
          standard_days?: number | null
          standard_price?: number
          updated_at?: string
          zone_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "delivery_zones_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      favourite_vendors: {
        Row: {
          created_at: string
          id: string
          user_id: string
          vendor_id: string
          vendor_name: string | null
          vendor_score: number | null
          vendor_url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
          vendor_id: string
          vendor_name?: string | null
          vendor_score?: number | null
          vendor_url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
          vendor_id?: string
          vendor_name?: string | null
          vendor_score?: number | null
          vendor_url?: string | null
        }
        Relationships: []
      }
      migration_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          error_count: number | null
          errors: Json | null
          id: string
          job_type: string
          params: Json | null
          processed_count: number | null
          started_at: string | null
          status: string
          success_count: number | null
          total_count: number | null
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_count?: number | null
          errors?: Json | null
          id?: string
          job_type: string
          params?: Json | null
          processed_count?: number | null
          started_at?: string | null
          status?: string
          success_count?: number | null
          total_count?: number | null
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          error_count?: number | null
          errors?: Json | null
          id?: string
          job_type?: string
          params?: Json | null
          processed_count?: number | null
          started_at?: string | null
          status?: string
          success_count?: number | null
          total_count?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      newsletter_subscribers: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          is_active: boolean | null
          source: string | null
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          source?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean | null
          source?: string | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          product_id: string | null
          product_snapshot: Json
          quantity: number
          total_price: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          product_id?: string | null
          product_snapshot: Json
          quantity: number
          total_price: number
          unit_price: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          product_id?: string | null
          product_snapshot?: Json
          quantity?: number
          total_price?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          delivery_address: Json | null
          delivery_fee: number
          delivery_type: Database["public"]["Enums"]["delivery_type"] | null
          delivery_zone_id: string | null
          estimated_delivery_date: string | null
          id: string
          notes: string | null
          order_number: string
          payment_method: string | null
          payment_reference: string | null
          payment_status: string | null
          qpay_invoice_id: string | null
          qpay_payment_id: string | null
          qpay_qr_image: string | null
          qpay_urls: Json | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          delivery_address?: Json | null
          delivery_fee?: number
          delivery_type?: Database["public"]["Enums"]["delivery_type"] | null
          delivery_zone_id?: string | null
          estimated_delivery_date?: string | null
          id?: string
          notes?: string | null
          order_number: string
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          qpay_invoice_id?: string | null
          qpay_payment_id?: string | null
          qpay_qr_image?: string | null
          qpay_urls?: Json | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          delivery_address?: Json | null
          delivery_fee?: number
          delivery_type?: Database["public"]["Enums"]["delivery_type"] | null
          delivery_zone_id?: string | null
          estimated_delivery_date?: string | null
          id?: string
          notes?: string | null
          order_number?: string
          payment_method?: string | null
          payment_reference?: string | null
          payment_status?: string | null
          qpay_invoice_id?: string | null
          qpay_payment_id?: string | null
          qpay_qr_image?: string | null
          qpay_urls?: Json | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_delivery_zone_id_fkey"
            columns: ["delivery_zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      ot_categories: {
        Row: {
          created_at: string
          depth: number | null
          display_order: number | null
          external_id: string | null
          icon_class: string | null
          icon_url: string | null
          id: string
          internal_id: string
          is_active: boolean | null
          is_parent_on_provider: boolean | null
          item_ids: string[] | null
          name_en: string | null
          name_mn: string | null
          name_ru: string | null
          name_zh: string | null
          parent_internal_id: string | null
          provider_type: string | null
          seo_alias: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          depth?: number | null
          display_order?: number | null
          external_id?: string | null
          icon_class?: string | null
          icon_url?: string | null
          id?: string
          internal_id: string
          is_active?: boolean | null
          is_parent_on_provider?: boolean | null
          item_ids?: string[] | null
          name_en?: string | null
          name_mn?: string | null
          name_ru?: string | null
          name_zh?: string | null
          parent_internal_id?: string | null
          provider_type?: string | null
          seo_alias?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          depth?: number | null
          display_order?: number | null
          external_id?: string | null
          icon_class?: string | null
          icon_url?: string | null
          id?: string
          internal_id?: string
          is_active?: boolean | null
          is_parent_on_provider?: boolean | null
          item_ids?: string[] | null
          name_en?: string | null
          name_mn?: string | null
          name_ru?: string | null
          name_zh?: string | null
          parent_internal_id?: string | null
          provider_type?: string | null
          seo_alias?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ot_orders: {
        Row: {
          cancel_reason: string | null
          comment: string | null
          created_at: string
          delivery_address: Json | null
          delivery_type: string
          id: string
          item_count: number
          items: Json
          order_number: string
          status: string
          subtotal: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          cancel_reason?: string | null
          comment?: string | null
          created_at?: string
          delivery_address?: Json | null
          delivery_type?: string
          id?: string
          item_count?: number
          items?: Json
          order_number: string
          status?: string
          subtotal?: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          cancel_reason?: string | null
          comment?: string | null
          created_at?: string
          delivery_address?: Json | null
          delivery_type?: string
          id?: string
          item_count?: number
          items?: Json
          order_number?: string
          status?: string
          subtotal?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      ot_wishlists: {
        Row: {
          created_at: string
          id: string
          product_id: string
          provider_type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          provider_type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          provider_type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payment_intents: {
        Row: {
          amount: number
          created_at: string
          error_message: string | null
          expires_at: string | null
          id: string
          invoice_id: string | null
          payment_id: string | null
          provider: Database["public"]["Enums"]["payment_provider"]
          qr_image: string | null
          reference_id: string
          status: Database["public"]["Enums"]["payment_intent_status"]
          type: Database["public"]["Enums"]["payment_intent_type"]
          updated_at: string
          urls: Json | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          error_message?: string | null
          expires_at?: string | null
          id?: string
          invoice_id?: string | null
          payment_id?: string | null
          provider?: Database["public"]["Enums"]["payment_provider"]
          qr_image?: string | null
          reference_id: string
          status?: Database["public"]["Enums"]["payment_intent_status"]
          type: Database["public"]["Enums"]["payment_intent_type"]
          updated_at?: string
          urls?: Json | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          error_message?: string | null
          expires_at?: string | null
          id?: string
          invoice_id?: string | null
          payment_id?: string | null
          provider?: Database["public"]["Enums"]["payment_provider"]
          qr_image?: string | null
          reference_id?: string
          status?: Database["public"]["Enums"]["payment_intent_status"]
          type?: Database["public"]["Enums"]["payment_intent_type"]
          updated_at?: string
          urls?: Json | null
          user_id?: string
        }
        Relationships: []
      }
      price_config: {
        Row: {
          config_key: string
          config_value: Json
          created_at: string
          description: string | null
          id: string
          updated_at: string
        }
        Insert: {
          config_key: string
          config_value?: Json
          created_at?: string
          description?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          config_key?: string
          config_value?: Json
          created_at?: string
          description?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      product_variants: {
        Row: {
          color: string | null
          color_hex: string | null
          created_at: string
          dimensions: string | null
          display_order: number | null
          id: string
          images: string[] | null
          is_active: boolean | null
          name: string | null
          price: number | null
          price_adjustment: number | null
          product_id: string
          size: string | null
          sku_suffix: string | null
          stock: number
          updated_at: string
          weight: string | null
        }
        Insert: {
          color?: string | null
          color_hex?: string | null
          created_at?: string
          dimensions?: string | null
          display_order?: number | null
          id?: string
          images?: string[] | null
          is_active?: boolean | null
          name?: string | null
          price?: number | null
          price_adjustment?: number | null
          product_id: string
          size?: string | null
          sku_suffix?: string | null
          stock?: number
          updated_at?: string
          weight?: string | null
        }
        Update: {
          color?: string | null
          color_hex?: string | null
          created_at?: string
          dimensions?: string | null
          display_order?: number | null
          id?: string
          images?: string[] | null
          is_active?: boolean | null
          name?: string | null
          price?: number | null
          price_adjustment?: number | null
          product_id?: string
          size?: string | null
          sku_suffix?: string | null
          stock?: number
          updated_at?: string
          weight?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand: string | null
          category_id: string | null
          compare_price: number | null
          created_at: string
          description: string | null
          description_mn: string | null
          id: string
          images: string[] | null
          is_active: boolean | null
          is_featured: boolean | null
          name: string
          name_mn: string
          price: number
          rating: number | null
          review_count: number | null
          sku: string | null
          specs: Json | null
          stock: number
          updated_at: string
        }
        Insert: {
          brand?: string | null
          category_id?: string | null
          compare_price?: number | null
          created_at?: string
          description?: string | null
          description_mn?: string | null
          id?: string
          images?: string[] | null
          is_active?: boolean | null
          is_featured?: boolean | null
          name: string
          name_mn: string
          price: number
          rating?: number | null
          review_count?: number | null
          sku?: string | null
          specs?: Json | null
          stock?: number
          updated_at?: string
        }
        Update: {
          brand?: string | null
          category_id?: string | null
          compare_price?: number | null
          created_at?: string
          description?: string | null
          description_mn?: string | null
          id?: string
          images?: string[] | null
          is_active?: boolean | null
          is_featured?: boolean | null
          name?: string
          name_mn?: string
          price?: number
          rating?: number | null
          review_count?: number | null
          sku?: string | null
          specs?: Json | null
          stock?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          ot_user_id: string | null
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id?: string
          ot_user_id?: string | null
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          ot_user_id?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      provider_sections: {
        Row: {
          category_id: string | null
          created_at: string
          display_order: number | null
          icon_name: string | null
          id: string
          is_active: boolean | null
          order_by: string | null
          page_size: number | null
          provider_type: string
          search_query: string | null
          show_on_home: boolean | null
          title: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          display_order?: number | null
          icon_name?: string | null
          id?: string
          is_active?: boolean | null
          order_by?: string | null
          page_size?: number | null
          provider_type: string
          search_query?: string | null
          show_on_home?: boolean | null
          title: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          display_order?: number | null
          icon_name?: string | null
          id?: string
          is_active?: boolean | null
          order_by?: string | null
          page_size?: number | null
          provider_type?: string
          search_query?: string | null
          show_on_home?: boolean | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      provider_strip_items: {
        Row: {
          bg_color: string | null
          created_at: string
          display_order: number | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          name: string
          provider_type: string
          show_categories: boolean | null
          slug: string
          text_color: string | null
          updated_at: string
        }
        Insert: {
          bg_color?: string | null
          created_at?: string
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name: string
          provider_type: string
          show_categories?: boolean | null
          slug: string
          text_color?: string | null
          updated_at?: string
        }
        Update: {
          bg_color?: string | null
          created_at?: string
          display_order?: number | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          name?: string
          provider_type?: string
          show_categories?: boolean | null
          slug?: string
          text_color?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          created_at: string
          id: string
          is_admin: boolean
          message: string
          ticket_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_admin?: boolean
          message: string
          ticket_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_admin?: boolean
          message?: string
          ticket_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          category: string
          created_at: string
          description: string
          id: string
          priority: string
          status: string
          subject: string
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string
          created_at?: string
          description: string
          id?: string
          priority?: string
          status?: string
          subject: string
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string
          created_at?: string
          description?: string
          id?: string
          priority?: string
          status?: string
          subject?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      title_translations: {
        Row: {
          created_at: string
          id: string
          original_text: string
          translated_text: string
        }
        Insert: {
          created_at?: string
          id?: string
          original_text: string
          translated_text: string
        }
        Update: {
          created_at?: string
          id?: string
          original_text?: string
          translated_text?: string
        }
        Relationships: []
      }
      user_addresses: {
        Row: {
          apartment: string | null
          city: string
          created_at: string
          delivery_zone_id: string | null
          district: string | null
          id: string
          is_default: boolean | null
          label: string | null
          phone: string | null
          street_address: string
          sub_district: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          apartment?: string | null
          city?: string
          created_at?: string
          delivery_zone_id?: string | null
          district?: string | null
          id?: string
          is_default?: boolean | null
          label?: string | null
          phone?: string | null
          street_address: string
          sub_district?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          apartment?: string | null
          city?: string
          created_at?: string
          delivery_zone_id?: string | null
          district?: string | null
          id?: string
          is_default?: boolean | null
          label?: string | null
          phone?: string | null
          street_address?: string
          sub_district?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_addresses_delivery_zone_id_fkey"
            columns: ["delivery_zone_id"]
            isOneToOne: false
            referencedRelation: "delivery_zones"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_wallets: {
        Row: {
          balance: number
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wallet_topups: {
        Row: {
          amount: number
          completed_at: string | null
          created_at: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          completed_at?: string | null
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          completed_at?: string | null
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      warehouse_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          images: string[] | null
          is_active: boolean
          item_id: string
          original_price_mnt: number | null
          price_mnt: number
          provider_type: string | null
          stock: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          is_active?: boolean
          item_id: string
          original_price_mnt?: number | null
          price_mnt?: number
          provider_type?: string | null
          stock?: number
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          images?: string[] | null
          is_active?: boolean
          item_id?: string
          original_price_mnt?: number | null
          price_mnt?: number
          provider_type?: string | null
          stock?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      wishlists: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlists_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      credit_wallet: {
        Args: { p_amount: number; p_user_id: string }
        Returns: number
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "user"
      delivery_type: "standard" | "express" | "rural"
      order_status:
        | "pending"
        | "processing"
        | "shipped"
        | "delivered"
        | "cancelled"
      payment_intent_status:
        | "initiated"
        | "processing"
        | "paid"
        | "failed"
        | "expired"
      payment_intent_type: "order" | "wallet_topup"
      payment_provider: "qpay" | "omniway" | "storepay"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      delivery_type: ["standard", "express", "rural"],
      order_status: [
        "pending",
        "processing",
        "shipped",
        "delivered",
        "cancelled",
      ],
      payment_intent_status: [
        "initiated",
        "processing",
        "paid",
        "failed",
        "expired",
      ],
      payment_intent_type: ["order", "wallet_topup"],
      payment_provider: ["qpay", "omniway", "storepay"],
    },
  },
} as const
