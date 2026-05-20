import { Package, Globe2, Settings } from "@/components/ui/icons";
import {
  AIConfigurationNavIcon,
  CategoriesNavIcon,
  DashboardNavIcon,
  DocumentTranslatorNavIcon,
  FoodItemsNavIcon,
  LanguagesNavIcon,
  ShoppingListsNavIcon,
  TranslationsNavIcon,
} from './animated-nav-icons';

export interface NavItem {
  title: string;
  href: string;
  icon: any;
  items?: NavItem[];
  isActive?: boolean;
  isFuture?: boolean;  // For planned features
}

export const navigationItems: NavItem[] = [
  {
    title: "Dashboard",
    href: "/",
    icon: DashboardNavIcon,
  },
  {
    title: "Inventory",
    href: "#",
    icon: Package,
    items: [
      {
        title: "Categories",
        href: "/categories",
        icon: CategoriesNavIcon,
      },
      {
        title: "Food Items",
        href: "/food-items",
        icon: FoodItemsNavIcon,
      }
    ]
  },
  {
    title: "Language & Translation",
    href: "#",
    icon: Globe2,
    items: [
      {
        title: "Languages",
        href: "/languages",
        icon: LanguagesNavIcon
      },
      {
        title: "Translations",
        href: "/translations",
        icon: TranslationsNavIcon
      }
    ]
  },
  {
    title: "Tools",
    href: "#",
    icon: Settings,
    items: [
      {
        title: "Shopping Lists",
        href: "/shopping-lists",
        icon: ShoppingListsNavIcon
      },
      {
        title: "Document Translator",
        href: "/document-translator",
        icon: DocumentTranslatorNavIcon
      },
      {
        title: "AI Configuration",
        href: "/ai-configuration",
        icon: AIConfigurationNavIcon
      }
    ]
  }
];
