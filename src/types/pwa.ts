export type PwaBannerPosition = "bottom" | "top" | "center";
export type PwaBorderRadius = "sm" | "md" | "lg" | "xl" | "2xl";

export interface PwaBannerConfig {
  enabled: boolean;
  title: string;
  subtitle: string;
  button_text: string;
  dismiss_days: number;
  position: PwaBannerPosition;
  logo_url: string;
  bg_color: string;
  text_color: string;
  button_bg_color: string;
  button_text_color: string;
  border_radius: PwaBorderRadius;
  show_close_button: boolean;
  update_enabled: boolean;
  update_title: string;
  update_subtitle: string;
  update_button_text: string;
  update_later_text: string;
  update_position: PwaBannerPosition;
}

export const DEFAULT_PWA_CONFIG: PwaBannerConfig = {
  enabled: true,
  title: "Only.mn апп суулгах",
  subtitle: "Илүү хурдан, илүү тохиромжтой хэрэглээ.",
  button_text: "Суулгах",
  dismiss_days: 7,
  position: "bottom",
  logo_url: "",
  bg_color: "",
  text_color: "",
  button_bg_color: "",
  button_text_color: "",
  border_radius: "2xl",
  show_close_button: true,
  update_enabled: true,
  update_title: "Шинэ хувилбар бэлэн боллоо",
  update_subtitle: "Хамгийн сүүлийн хувилбарыг ашиглахын тулд шинэчлэнэ үү.",
  update_button_text: "Шинэчлэх",
  update_later_text: "Дараа",
  update_position: "bottom",
};
