// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Matt Geiger
//
// FEED — Food Equity & Efficient Delivery. Application code licensed
// under AGPL-3.0-or-later; see LICENSE. William Temple House branding is
// not covered by this license; see TRADEMARKS.md.

import {
  Apple,
  Baby,
  Ban,
  Banana,
  Bandage,
  Bath,
  BatteryPlus,
  Bean,
  Beef,
  Beer,
  Bike,
  Bone,
  BriefcaseMedical,
  BugOff,
  Cake,
  CakeSlice,
  CalendarSync,
  Candy,
  Carrot,
  Cat,
  ChefHat,
  Cigarette,
  Citrus,
  Coffee,
  Cookie,
  Croissant,
  Cross,
  CupSoda,
  Cylinder,
  Dessert,
  Dna,
  DnaOff,
  Dog,
  Donut,
  Drumstick,
  Egg,
  EggFried,
  Fish,
  Flame,
  Flashlight,
  Footprints,
  Fuel,
  Gem,
  Gift,
  GlassWater,
  GraduationCap,
  Grape,
  Ham,
  Hammer,
  HandPlatter,
  Headphones,
  Heater,
  Hop,
  HopOff,
  IceCreamBowl,
  IceCreamCone,
  LeafyGreen,
  Microwave,
  Nut,
  Package,
  Palette,
  PawPrint,
  PillBottle,
  Pizza,
  Popcorn,
  Popsicle,
  Recycle,
  Refrigerator,
  Salad,
  Sandwich,
  Shirt,
  ShoppingBasket,
  ShoppingCart,
  ShowerHead,
  Shrimp,
  Snowflake,
  Sofa,
  Soup,
  Syringe,
  Tent,
  ThermometerSnowflake,
  Toilet,
  Torus,
  Trash2,
  Utensils,
  UtensilsCrossed,
  VenusAndMars,
  WashingMachine,
  Waves,
  Wheat,
  WheatOff,
  Wine,
  WineOff,
  Wrench
} from "lucide-react";

export interface FoodIcon {
  value: string;
  label: string;
  category: IconCategory;
  component: React.FC<React.SVGProps<SVGSVGElement>>;
}

export type IconCategory = 
  | 'food' 
  | 'drink' 
  | 'health' 
  | 'household' 
  | 'clothing' 
  | 'pets'
  | 'outdoor'
  | 'other';

export const DEFAULT_ICON = 'package';

export const foodIcons: FoodIcon[] = [
  // Food category
  { value: 'apple', label: 'Apple', category: 'food', component: Apple },
  { value: 'banana', label: 'Banana', category: 'food', component: Banana },
  { value: 'bean', label: 'Bean', category: 'food', component: Bean },
  { value: 'beef', label: 'Beef', category: 'food', component: Beef },
  { value: 'cake', label: 'Cake', category: 'food', component: Cake },
  { value: 'cake-slice', label: 'Cake Slice', category: 'food', component: CakeSlice },
  { value: 'candy', label: 'Candy', category: 'food', component: Candy },
  { value: 'carrot', label: 'Carrot', category: 'food', component: Carrot },
  { value: 'chef-hat', label: 'Chef Hat', category: 'food', component: ChefHat },
  { value: 'cookie', label: 'Cookie', category: 'food', component: Cookie },
  { value: 'croissant', label: 'Croissant', category: 'food', component: Croissant },
  { value: 'cylinder', label: 'Canned Food', category: 'food', component: Cylinder },
  { value: 'dessert', label: 'Dessert', category: 'food', component: Dessert },
  { value: 'donut', label: 'Donut', category: 'food', component: Donut },
  { value: 'drumstick', label: 'Drumstick', category: 'food', component: Drumstick },
  { value: 'egg', label: 'Egg', category: 'food', component: Egg },
  { value: 'egg-fried', label: 'Fried Egg', category: 'food', component: EggFried },
  { value: 'fish', label: 'Fish', category: 'food', component: Fish },
  { value: 'grape', label: 'Grape', category: 'food', component: Grape },
  { value: 'ham', label: 'Ham', category: 'food', component: Ham },
  { value: 'hand-platter', label: 'Platter', category: 'food', component: HandPlatter },
  { value: 'ice-cream-bowl', label: 'Ice Cream Bowl', category: 'food', component: IceCreamBowl },
  { value: 'ice-cream-cone', label: 'Ice Cream Cone', category: 'food', component: IceCreamCone },
  { value: 'leafy-green', label: 'Produce', category: 'food', component: LeafyGreen },
  { value: 'nut', label: 'Nuts', category: 'food', component: Nut },
  { value: 'pizza', label: 'Pizza', category: 'food', component: Pizza },
  { value: 'popcorn', label: 'Popcorn', category: 'food', component: Popcorn },
  { value: 'popsicle', label: 'Popsicle', category: 'food', component: Popsicle },
  { value: 'salad', label: 'Salad', category: 'food', component: Salad },
  { value: 'sandwich', label: 'Sandwich', category: 'food', component: Sandwich },
  { value: 'shrimp', label: 'Seafood', category: 'food', component: Shrimp },
  { value: 'soup', label: 'Soup', category: 'food', component: Soup },
  { value: 'torus', label: 'Torus', category: 'food', component: Torus },
  { value: 'utensils', label: 'Utensils', category: 'food', component: Utensils },
  { value: 'utensils-crossed', label: 'Dining', category: 'food', component: UtensilsCrossed },
  { value: 'wheat', label: 'Wheat', category: 'food', component: Wheat },
  { value: 'wheat-off', label: 'Gluten Free', category: 'food', component: WheatOff },
  
  // Drink category
  { value: 'beer', label: 'Beer', category: 'drink', component: Beer },
  { value: 'citrus', label: 'Citrus', category: 'drink', component: Citrus },
  { value: 'coffee', label: 'Coffee', category: 'drink', component: Coffee },
  { value: 'cup-soda', label: 'Soda', category: 'drink', component: CupSoda },
  { value: 'glass-water', label: 'Water', category: 'drink', component: GlassWater },
  { value: 'wine', label: 'Wine', category: 'drink', component: Wine },
  { value: 'wine-off', label: 'No Alcohol', category: 'drink', component: WineOff },
  
  // Health category
  { value: 'bandage', label: 'Bandage', category: 'health', component: Bandage },
  { value: 'ban', label: 'Prohibited', category: 'health', component: Ban },
  { value: 'battery-plus', label: 'Energy', category: 'health', component: BatteryPlus },
  { value: 'briefcase-medical', label: 'Medical Kit', category: 'health', component: BriefcaseMedical },
  { value: 'cigarette', label: 'Cigarette', category: 'health', component: Cigarette },
  { value: 'cross', label: 'Medical', category: 'health', component: Cross },
  { value: 'dna', label: 'DNA', category: 'health', component: Dna },
  { value: 'dna-off', label: 'DNA Off', category: 'health', component: DnaOff },
  { value: 'pill-bottle', label: 'Medicine', category: 'health', component: PillBottle },
  { value: 'syringe', label: 'Syringe', category: 'health', component: Syringe },
  { value: 'venus-and-mars', label: 'Gender', category: 'health', component: VenusAndMars },
  
  // Household category
  { value: 'bath', label: 'Bath', category: 'household', component: Bath },
  { value: 'flame', label: 'Hot', category: 'household', component: Flame },
  { value: 'heater', label: 'Heater', category: 'household', component: Heater },
  { value: 'hop', label: 'Hop', category: 'household', component: Hop },
  { value: 'hop-off', label: 'Hop Off', category: 'household', component: HopOff },
  { value: 'microwave', label: 'Microwave', category: 'household', component: Microwave },
  { value: 'refrigerator', label: 'Refrigerator', category: 'household', component: Refrigerator },
  { value: 'shower-head', label: 'Shower', category: 'household', component: ShowerHead },
  { value: 'snowflake', label: 'Cold/Frozen', category: 'household', component: Snowflake },
  { value: 'sofa', label: 'Furniture', category: 'household', component: Sofa },
  { value: 'thermometer-snowflake', label: 'Freezer', category: 'household', component: ThermometerSnowflake },
  { value: 'toilet', label: 'Toilet', category: 'household', component: Toilet },
  { value: 'trash-2', label: 'Trash', category: 'household', component: Trash2 },
  { value: 'washing-machine', label: 'Laundry', category: 'household', component: WashingMachine },
  { value: 'wrench', label: 'Repair', category: 'household', component: Wrench },
  
  // Clothing category
  { value: 'shirt', label: 'Clothing', category: 'clothing', component: Shirt },
  
  // Pets category
  { value: 'bone', label: 'Pet Treats', category: 'pets', component: Bone },
  { value: 'cat', label: 'Cat', category: 'pets', component: Cat },
  { value: 'dog', label: 'Dog', category: 'pets', component: Dog },
  { value: 'paw-print', label: 'Pets', category: 'pets', component: PawPrint },
  { value: 'bug-off', label: 'No Pests', category: 'pets', component: BugOff },
  
  // Outdoor category
  { value: 'bike', label: 'Bike', category: 'outdoor', component: Bike },
  { value: 'tent', label: 'Camping', category: 'outdoor', component: Tent },
  { value: 'flashlight', label: 'Flashlight', category: 'outdoor', component: Flashlight },
  { value: 'footprints', label: 'Tracking', category: 'outdoor', component: Footprints },
  { value: 'fuel', label: 'Fuel', category: 'outdoor', component: Fuel },
  { value: 'waves', label: 'Water', category: 'outdoor', component: Waves },
  
  // Other category
  { value: 'baby', label: 'Baby', category: 'other', component: Baby },
  { value: 'calendar-sync', label: 'Calendar', category: 'other', component: CalendarSync },
  { value: 'gem', label: 'Valuable', category: 'other', component: Gem },
  { value: 'gift', label: 'Gift', category: 'other', component: Gift },
  { value: 'graduation-cap', label: 'Education', category: 'other', component: GraduationCap },
  { value: 'hammer', label: 'Tools', category: 'other', component: Hammer },
  { value: 'headphones', label: 'Electronics', category: 'other', component: Headphones },
  { value: 'package', label: 'Package', category: 'other', component: Package },
  { value: 'palette', label: 'Art', category: 'other', component: Palette },
  { value: 'recycle', label: 'Recycle', category: 'other', component: Recycle },
  { value: 'shopping-basket', label: 'Basket', category: 'other', component: ShoppingBasket },
  { value: 'shopping-cart', label: 'Cart', category: 'other', component: ShoppingCart },
];

// Group icons by category
export const iconsByCategory = foodIcons.reduce((acc, icon) => {
  if (!acc[icon.category]) {
    acc[icon.category] = [];
  }
  acc[icon.category].push(icon);
  return acc;
}, {} as Record<IconCategory, FoodIcon[]>);

// Get icon by value
export const getIconByValue = (value: string): FoodIcon | undefined => {
  return foodIcons.find(icon => icon.value === value);
};

// Get icon component by value
export const getIconComponent = (value: string | null | undefined): React.FC<React.SVGProps<SVGSVGElement>> => {
  if (!value) return Package; // Default icon
  const icon = foodIcons.find(icon => icon.value === value);
  return icon?.component || Package; // Default to Package if not found
};
